import type Database from 'better-sqlite3';
import type { Credential } from './types.js';
import { addCredential, getCredential, getAllCredentials, updateCredential, deleteCredential } from './db.js';
import { encrypt, decrypt } from './crypto.js';

export function cmdList(db: Database.Database): Omit<Credential, 'password'>[] {
  return getAllCredentials(db).map(({ id, name, username }) => ({ id, name, username }));
}

export function cmdAdd(
  db: Database.Database,
  key: Buffer,
  input: { name: string; username: string; password: string }
): number {
  return addCredential(db, {
    name: input.name,
    username: input.username,
    password: encrypt(input.password, key),
  });
}

export function cmdRemove(db: Database.Database, id: number): boolean {
  if (!getCredential(db, id)) return false;
  deleteCredential(db, id);
  return true;
}

export function cmdEdit(
  db: Database.Database,
  key: Buffer,
  id: number,
  input: { name: string; username: string; password: string }
): boolean {
  const existing = getCredential(db, id);
  if (!existing) return false;
  const decryptedExisting = decrypt(existing.password, key);
  updateCredential(db, id, {
    name: input.name !== '' ? input.name : existing.name,
    username: input.username !== '' ? input.username : existing.username,
    password: encrypt(input.password !== '' ? input.password : decryptedExisting, key),
  });
  return true;
}

export function cmdSee(db: Database.Database, key: Buffer, id: number): Credential | null {
  const cred = getCredential(db, id);
  if (!cred) return null;
  return { ...cred, password: decrypt(cred.password, key) };
}

export function cmdCopy(
  db: Database.Database,
  key: Buffer,
  id: number,
  field: 'password' | 'username'
): string | null {
  const cred = getCredential(db, id);
  if (!cred) return null;
  if (field === 'username') return cred.username;
  return decrypt(cred.password, key);
}
