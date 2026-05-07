# Password Manager — Design Spec

**Date:** 2026-05-07  
**Stack:** TypeScript, SQLite (better-sqlite3), Node.js built-in crypto, dayjs, clipboardy  
**Mode:** Interactive CLI REPL

---

## Overview

A local CLI password manager that runs as an interactive REPL. The user unlocks a SQLite vault with a master password at startup, then issues commands in a prompt loop. All passwords are encrypted at rest with AES-256-GCM. The session auto-locks after 10 minutes of inactivity.

---

## Project Structure

```
pw-manager/
├── src/
│   ├── index.ts          # REPL entry point, session management, command dispatch
│   ├── db.ts             # SQLite access via better-sqlite3, all queries
│   ├── crypto.ts         # PBKDF2 key derivation, AES-256-GCM encrypt/decrypt
│   ├── clipboard.ts      # Copy to clipboard (cross-platform via clipboardy)
│   └── commands.ts       # Command handler functions (add, remove, edit, list, see, copy)
├── data/
│   └── vault.db          # SQLite database (gitignored)
├── package.json
└── tsconfig.json
```

### Key Dependencies

| Package | Purpose |
|---|---|
| `better-sqlite3` | Synchronous SQLite driver |
| `@types/better-sqlite3` | TypeScript types |
| `clipboardy` | Cross-platform clipboard |
| `dayjs` | Datetime manipulation (session timeout) |
| `tsx` | Run TypeScript directly in dev |

---

## Database Schema

### `meta` table

Stores the salt and a verification blob used to validate the master password without storing it directly.

```sql
CREATE TABLE IF NOT EXISTS meta (
  salt TEXT NOT NULL,
  verification TEXT NOT NULL
);
```

### `credentials` table

```sql
CREATE TABLE IF NOT EXISTS credentials (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  name     TEXT NOT NULL,
  username TEXT NOT NULL,
  password TEXT NOT NULL
);
```

- `password` is stored as a base64-encoded AES-256-GCM ciphertext (includes IV and auth tag)
- The derived key is never written to disk

---

## Crypto & Session

### Key Derivation

- Algorithm: `PBKDF2(masterPassword, salt, 200_000, 32, sha256)`
- Salt: random 16 bytes, generated once on first run, stored in `meta`
- Verification blob: `"pw-manager-ok"` encrypted with the derived key, stored in `meta`
- On unlock: derive key from entered password + stored salt, decrypt verification blob, compare to `"pw-manager-ok"`

### Encryption

- Algorithm: AES-256-GCM
- Each password gets a fresh random 12-byte IV on every encrypt
- Stored format: `base64(iv + authTag + ciphertext)`

### Session Model

- Derived key held in a module-level variable (type `Buffer | null`)
- `lastActivity` timestamp tracked with `dayjs`
- Before every command: check `dayjs().diff(lastActivity, 'minute') >= 10`
  - If timed out: set key to `null`, re-prompt for master password (3 attempts max), then continue
- On `exit`, `Ctrl+C`, or `Ctrl+D`: set key to `null`, then `process.exit(0)`

### Failed Attempts

- 3 consecutive wrong master password attempts → print `Too many failed attempts. Exiting.` → `process.exit(1)`
- Applies both at startup and after session timeout re-authentication

---

## REPL & Commands

### Startup Flow

1. Open (or create) `data/vault.db`
2. Initialize tables if first run; prompt user to set a master password
3. Prompt for master password (up to 3 attempts)
4. On success, print `Vault unlocked. Type 'help' for commands.`
5. Enter REPL loop with prompt `pw> `

### Commands

| Command | Description |
|---|---|
| `list` | Print all entries: id, name, username (no password) |
| `add` | Interactive prompts for name, username, password |
| `see <id>` | Show entry details; password shown as `****`; press `r` to reveal |
| `copy <id>` | Copy password to clipboard (default) |
| `copy <id> --password` | Copy password to clipboard |
| `copy <id> --username` | Copy username to clipboard |
| `edit <id>` | Prompt for new name/username/password; blank input keeps existing value |
| `remove <id>` | Ask `Are you sure? (y/n)`, then delete on confirmation |
| `exit` | Wipe key, exit process cleanly |
| `help` | Print command reference |

---

## Error Handling

### Recoverable (print and continue)

| Situation | Message |
|---|---|
| Unknown command | `Unknown command. Type 'help' for available commands.` |
| `<id>` not found | `No credential found with id <id>.` |
| Missing argument | Usage hint for the command |
| Clipboard failure | `Failed to copy to clipboard.` |

### Non-recoverable (print and exit)

| Situation | Exit |
|---|---|
| DB unreadable or corrupted | Print error, `process.exit(1)` |
| 3 failed master password attempts | `Too many failed attempts. Exiting.`, `process.exit(1)` |

### Security Hygiene

- Stack traces are never shown to the user
- Derived key is explicitly set to `null` before any `process.exit` call
