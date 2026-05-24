import { app, BrowserWindow, ipcMain, clipboard } from 'electron';
import * as path from 'node:path';
import type Database from 'better-sqlite3';
import { initDb, getMeta, saveMeta } from './db.js';
import { deriveKey, encrypt, decrypt, generateSalt, VERIFICATION_PLAINTEXT } from './crypto.js';
import { cmdList, cmdAdd, cmdRemove, cmdEdit, cmdSee, cmdCopy } from './commands.js';

const TIMEOUT_MS = 10 * 60 * 1000;

let sessionKey: Buffer | null = null;
let lastActivity = 0;
let db: Database.Database;
let mainWindow: BrowserWindow | null = null;

function isLocked(): boolean {
  if (!sessionKey) return true;
  if (Date.now() - lastActivity >= TIMEOUT_MS) {
    sessionKey = null;
    mainWindow?.webContents.send('vault:locked');
    return true;
  }
  return false;
}

function touch(): void {
  lastActivity = Date.now();
}

function requireKey(): Buffer {
  if (isLocked()) throw new Error('LOCKED');
  touch();
  return sessionKey!;
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 650,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

app.whenReady().then(() => {
  const dbPath = path.join(app.getPath('userData'), 'vault.db');
  db = initDb(dbPath);
  createWindow();
});

app.on('window-all-closed', () => {
  sessionKey = null;
  app.quit();
});

ipcMain.handle('vault:exists', () => getMeta(db) !== null);

ipcMain.handle('vault:is-locked', () => isLocked());

ipcMain.handle('vault:setup', async (_e, password: string) => {
  if (getMeta(db)) return { ok: false, error: 'Vault already exists.' };
  const salt = generateSalt();
  const key = await deriveKey(password, salt);
  const verification = encrypt(VERIFICATION_PLAINTEXT, key);
  saveMeta(db, { salt, verification });
  sessionKey = key;
  touch();
  return { ok: true };
});

ipcMain.handle('vault:unlock', async (_e, password: string) => {
  const meta = getMeta(db);
  if (!meta) return { ok: false, error: 'No vault.' };
  const key = await deriveKey(password, meta.salt);
  try {
    if (decrypt(meta.verification, key) === VERIFICATION_PLAINTEXT) {
      sessionKey = key;
      touch();
      return { ok: true };
    }
  } catch {
    // wrong key
  }
  return { ok: false, error: 'Wrong password.' };
});

ipcMain.handle('vault:lock', () => {
  sessionKey = null;
});

ipcMain.handle('vault:list', () => {
  requireKey();
  return cmdList(db);
});

ipcMain.handle('vault:add', (_e, input: { name: string; username: string; password: string }) => {
  const key = requireKey();
  return cmdAdd(db, key, input);
});

ipcMain.handle('vault:see', (_e, id: number) => {
  const key = requireKey();
  return cmdSee(db, key, id);
});

ipcMain.handle('vault:edit', (_e, id: number, input: { name: string; username: string; password: string }) => {
  const key = requireKey();
  return cmdEdit(db, key, id, input);
});

ipcMain.handle('vault:remove', (_e, id: number) => {
  requireKey();
  return cmdRemove(db, id);
});

ipcMain.handle('vault:copy', (_e, id: number, field: 'password' | 'username') => {
  const key = requireKey();
  const value = cmdCopy(db, key, id, field);
  if (value === null) return false;
  clipboard.writeText(value);
  return true;
});
