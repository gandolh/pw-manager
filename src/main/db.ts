import DatabaseConstructor from 'better-sqlite3';
import type Database from 'better-sqlite3';
import type { Credential, Meta } from '../shared/types.js';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export function initDb(path: string): Database.Database {
  if (path !== ':memory:') {
    mkdirSync(dirname(path), { recursive: true });
  }
  const db = new DatabaseConstructor(path);
  db.exec(`
    CREATE TABLE IF NOT EXISTS meta (
      id      INTEGER PRIMARY KEY DEFAULT 1 CHECK(id = 1),
      salt    TEXT NOT NULL,
      verification TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS credentials (
      id       INTEGER PRIMARY KEY AUTOINCREMENT,
      name     TEXT NOT NULL,
      username TEXT NOT NULL,
      password TEXT NOT NULL
    );
  `);
  return db;
}

export function getMeta(db: Database.Database): Meta | null {
  const row = db.prepare('SELECT salt, verification FROM meta WHERE id = 1').get();
  return row ? (row as Meta) : null;
}

export function saveMeta(db: Database.Database, meta: Meta): void {
  db.prepare('INSERT OR REPLACE INTO meta (id, salt, verification) VALUES (1, ?, ?)').run(meta.salt, meta.verification);
}

export function addCredential(db: Database.Database, cred: Omit<Credential, 'id'>): number {
  const result = db.prepare('INSERT INTO credentials (name, username, password) VALUES (?, ?, ?)').run(cred.name, cred.username, cred.password);
  return Number(result.lastInsertRowid);
}

export function getCredential(db: Database.Database, id: number): Credential | null {
  return (db.prepare('SELECT * FROM credentials WHERE id = ?').get(id) as Credential) ?? null;
}

export function getAllCredentials(db: Database.Database): Credential[] {
  return db.prepare('SELECT * FROM credentials').all() as Credential[];
}

export function updateCredential(db: Database.Database, id: number, cred: Omit<Credential, 'id'>): void {
  db.prepare('UPDATE credentials SET name = ?, username = ?, password = ? WHERE id = ?').run(cred.name, cred.username, cred.password, id);
}

export function deleteCredential(db: Database.Database, id: number): void {
  db.prepare('DELETE FROM credentials WHERE id = ?').run(id);
}
