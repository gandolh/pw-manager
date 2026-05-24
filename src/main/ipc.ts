import { ipcMain, clipboard } from 'electron';
import type Database from 'better-sqlite3';
import { getMeta, saveMeta } from './db.js';
import { deriveKey, encrypt, decrypt, generateSalt, VERIFICATION_PLAINTEXT } from './crypto.js';
import { cmdList, cmdAdd, cmdRemove, cmdEdit, cmdSee, cmdCopy } from './commands.js';
import { IPC } from '../shared/api.js';
import type { CredentialInput, CopyField } from '../shared/types.js';
import type { Session } from './session.js';

export function registerIpc(db: Database.Database, session: Session): void {
  ipcMain.handle(IPC.exists, () => getMeta(db) !== null);

  ipcMain.handle(IPC.isLocked, () => session.isLocked());

  ipcMain.handle(IPC.setup, async (_e, password: string) => {
    if (getMeta(db)) return { ok: false, error: 'Vault already exists.' };
    const salt = generateSalt();
    const key = await deriveKey(password, salt);
    const verification = encrypt(VERIFICATION_PLAINTEXT, key);
    saveMeta(db, { salt, verification });
    session.unlock(key);
    return { ok: true };
  });

  ipcMain.handle(IPC.unlock, async (_e, password: string) => {
    const meta = getMeta(db);
    if (!meta) return { ok: false, error: 'No vault.' };
    const key = await deriveKey(password, meta.salt);
    try {
      if (decrypt(meta.verification, key) === VERIFICATION_PLAINTEXT) {
        session.unlock(key);
        return { ok: true };
      }
    } catch {
      // wrong key
    }
    return { ok: false, error: 'Wrong password.' };
  });

  ipcMain.handle(IPC.lock, () => session.lock());

  ipcMain.handle(IPC.list, () => {
    session.requireKey();
    return cmdList(db);
  });

  ipcMain.handle(IPC.add, (_e, input: CredentialInput) => {
    const key = session.requireKey();
    return cmdAdd(db, key, input);
  });

  ipcMain.handle(IPC.see, (_e, id: number) => {
    const key = session.requireKey();
    return cmdSee(db, key, id);
  });

  ipcMain.handle(IPC.edit, (_e, id: number, input: CredentialInput) => {
    const key = session.requireKey();
    return cmdEdit(db, key, id, input);
  });

  ipcMain.handle(IPC.remove, (_e, id: number) => {
    session.requireKey();
    return cmdRemove(db, id);
  });

  ipcMain.handle(IPC.copy, (_e, id: number, field: CopyField) => {
    const key = session.requireKey();
    const value = cmdCopy(db, key, id, field);
    if (value === null) return false;
    clipboard.writeText(value);
    return true;
  });
}
