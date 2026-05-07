import * as readline from 'node:readline';
import dayjs from 'dayjs';
import { initDb, getMeta, saveMeta } from './db.js';
import { deriveKey, encrypt, decrypt, generateSalt, VERIFICATION_PLAINTEXT } from './crypto.js';
import { copyToClipboard } from './clipboard.js';
import { cmdList, cmdAdd, cmdRemove, cmdEdit, cmdSee, cmdCopy } from './commands.js';
import type Database from 'better-sqlite3';

const DB_PATH = 'data/vault.db';
const TIMEOUT_MINUTES = 10;
const MAX_ATTEMPTS = 3;

let sessionKey: Buffer | null = null;
let lastActivity = dayjs();

const db: Database.Database = (() => {
  try {
    return initDb(DB_PATH);
  } catch (e) {
    console.error('Failed to open vault database.');
    process.exit(1);
  }
})();

function prompt(rl: readline.Interface, question: string): Promise<string> {
  return new Promise((resolve) => rl.question(question, resolve));
}

function promptPassword(question: string): Promise<string> {
  return new Promise((resolve) => {
    process.stdout.write(question);
    process.stdin.setRawMode?.(true);
    process.stdin.resume();
    let password = '';
    function handler(chunk: Buffer): void {
      const c = chunk.toString('utf8');
      if (c === '\r' || c === '\n') {
        process.stdin.setRawMode?.(false);
        process.stdin.removeListener('data', handler);
        process.stdout.write('\n');
        resolve(password);
      } else if (c === '\x03') {
        process.stdin.setRawMode?.(false);
        process.stdin.removeListener('data', handler);
        process.stdout.write('\n');
        wipeAndExit(0);
      } else if (c === '\x7f' || c === '\x08') {
        password = password.slice(0, -1);
      } else {
        password += c;
      }
    }
    process.stdin.on('data', handler);
  });
}

function wipeAndExit(code: number): never {
  sessionKey = null;
  process.exit(code);
}

async function authenticate(): Promise<Buffer> {
  const meta = getMeta(db);

  if (!meta) {
    console.log('No vault found. Setting up a new vault.');
    const pw = await promptPassword('Set master password: ');
    const confirm = await promptPassword('Confirm master password: ');
    if (pw !== confirm) {
      console.error('Passwords do not match. Exiting.');
      wipeAndExit(1);
    }
    const salt = generateSalt();
    const key = await deriveKey(pw, salt);
    const verification = encrypt(VERIFICATION_PLAINTEXT, key);
    saveMeta(db, { salt, verification });
    console.log('Vault created successfully.');
    return key;
  }

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const pw = await promptPassword('Master password: ');
    const key = await deriveKey(pw, meta.salt);
    try {
      const result = decrypt(meta.verification, key);
      if (result === VERIFICATION_PLAINTEXT) return key;
    } catch {
      // wrong key — decryption failed
    }
    if (attempt < MAX_ATTEMPTS) {
      console.error(`Wrong password. ${MAX_ATTEMPTS - attempt} attempt(s) remaining.`);
    }
  }

  console.error('Too many failed attempts. Exiting.');
  wipeAndExit(1);
}

async function checkTimeout(rl: readline.Interface): Promise<void> {
  if (dayjs().diff(lastActivity, 'minute') >= TIMEOUT_MINUTES) {
    console.log('\nSession timed out. Please re-enter your master password.');
    sessionKey = null;
    rl.pause();
    sessionKey = await authenticate();
    lastActivity = dayjs();
    rl.resume();
  }
}

function printHelp(): void {
  console.log(`
Commands:
  list                     List all credentials (id, name, username)
  add                      Add a new credential
  see <id>                 Show credential (password hidden; press r to reveal)
  copy <id> [--password]   Copy password to clipboard (default)
  copy <id> --username     Copy username to clipboard
  edit <id>                Edit a credential (blank = keep existing)
  remove <id>              Delete a credential
  help                     Show this help
  exit                     Lock vault and exit
`);
}

async function handleCommand(rl: readline.Interface, line: string): Promise<void> {
  const parts = line.trim().split(/\s+/);
  const cmd = parts[0];

  switch (cmd) {
    case 'list': {
      const rows = cmdList(db);
      if (rows.length === 0) {
        console.log('No credentials stored.');
      } else {
        console.log('\n  ID  Name                 Username');
        console.log('  --  -------------------  -------------------------');
        for (const r of rows) {
          console.log(`  ${String(r.id).padEnd(4)}${r.name.padEnd(21)}${r.username}`);
        }
        console.log();
      }
      break;
    }

    case 'add': {
      const name = await prompt(rl, 'Name: ');
      const username = await prompt(rl, 'Username/Email: ');
      const password = await promptPassword('Password: ');
      const id = cmdAdd(db, sessionKey!, { name, username, password });
      console.log(`Added credential with id ${id}.`);
      break;
    }

    case 'see': {
      const id = parseInt(parts[1]);
      if (isNaN(id)) { console.log('Usage: see <id>'); break; }
      const cred = cmdSee(db, sessionKey!, id);
      if (!cred) { console.log(`No credential found with id ${id}.`); break; }
      console.log(`\n  ID:       ${cred.id}`);
      console.log(`  Name:     ${cred.name}`);
      console.log(`  Username: ${cred.username}`);
      console.log(`  Password: ****`);
      const reveal = await prompt(rl, 'Press r to reveal password, or Enter to continue: ');
      if (reveal.trim().toLowerCase() === 'r') {
        console.log(`  Password: ${cred.password}`);
      }
      console.log();
      break;
    }

    case 'copy': {
      const id = parseInt(parts[1]);
      if (isNaN(id)) { console.log('Usage: copy <id> [--password|--username]'); break; }
      const field: 'password' | 'username' = parts[2] === '--username' ? 'username' : 'password';
      const value = cmdCopy(db, sessionKey!, id, field);
      if (value === null) { console.log(`No credential found with id ${id}.`); break; }
      try {
        await copyToClipboard(value);
        console.log(`Copied ${field} to clipboard.`);
      } catch {
        console.log('Failed to copy to clipboard.');
      }
      break;
    }

    case 'edit': {
      const id = parseInt(parts[1]);
      if (isNaN(id)) { console.log('Usage: edit <id>'); break; }
      const existing = cmdSee(db, sessionKey!, id);
      if (!existing) { console.log(`No credential found with id ${id}.`); break; }
      console.log('Leave blank to keep existing value.');
      const name = await prompt(rl, `Name [${existing.name}]: `);
      const username = await prompt(rl, `Username [${existing.username}]: `);
      const password = await promptPassword('New password (blank to keep): ');
      cmdEdit(db, sessionKey!, id, { name, username, password });
      console.log('Credential updated.');
      break;
    }

    case 'remove': {
      const id = parseInt(parts[1]);
      if (isNaN(id)) { console.log('Usage: remove <id>'); break; }
      const confirm = await prompt(rl, `Are you sure you want to delete credential ${id}? (y/n): `);
      if (confirm.trim().toLowerCase() === 'y') {
        const ok = cmdRemove(db, id);
        console.log(ok ? 'Credential removed.' : `No credential found with id ${id}.`);
      } else {
        console.log('Cancelled.');
      }
      break;
    }

    case 'help':
      printHelp();
      break;

    case 'exit':
      console.log('Goodbye.');
      wipeAndExit(0);
      break;

    case '':
      break;

    default:
      console.log(`Unknown command. Type 'help' for available commands.`);
  }
}

async function main(): Promise<void> {
  sessionKey = await authenticate();
  lastActivity = dayjs();
  console.log("Vault unlocked. Type 'help' for commands.");

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true,
  });

  process.on('SIGINT', () => {
    console.log('\nGoodbye.');
    wipeAndExit(0);
  });

  const askNext = (): void => {
    rl.question('pw> ', async (line) => {
      try {
        await checkTimeout(rl);
        await handleCommand(rl, line);
      } catch {
        console.error('An error occurred. Please try again.');
        if (sessionKey === null) {
          console.error('Session could not be restored. Exiting.');
          wipeAndExit(1);
        }
      }
      lastActivity = dayjs();
      askNext();
    });
  };

  askNext();
}

main();
