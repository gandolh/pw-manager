import { describe, it, expect, beforeEach } from 'vitest';
import { initDb, saveMeta, getMeta, addCredential, getCredential, getAllCredentials, updateCredential, deleteCredential } from '../src/db';
import type Database from 'better-sqlite3';

let db: Database.Database;

beforeEach(() => {
  db = initDb(':memory:');
});

describe('meta', () => {
  it('saves and retrieves meta', () => {
    saveMeta(db, { salt: 'abc', verification: 'xyz' });
    const meta = getMeta(db);
    expect(meta).toEqual({ salt: 'abc', verification: 'xyz' });
  });

  it('returns null when no meta exists', () => {
    expect(getMeta(db)).toBeNull();
  });
});

describe('credentials', () => {
  it('adds and retrieves a credential', () => {
    const id = addCredential(db, { name: 'github', username: 'user@test.com', password: 'enc123' });
    const cred = getCredential(db, id);
    expect(cred).toMatchObject({ name: 'github', username: 'user@test.com', password: 'enc123' });
  });

  it('returns null for missing credential', () => {
    expect(getCredential(db, 999)).toBeNull();
  });

  it('lists all credentials', () => {
    addCredential(db, { name: 'a', username: 'u1', password: 'p1' });
    addCredential(db, { name: 'b', username: 'u2', password: 'p2' });
    expect(getAllCredentials(db)).toHaveLength(2);
  });

  it('updates a credential', () => {
    const id = addCredential(db, { name: 'old', username: 'u', password: 'p' });
    updateCredential(db, id, { name: 'new', username: 'u2', password: 'p2' });
    expect(getCredential(db, id)).toMatchObject({ name: 'new', username: 'u2' });
  });

  it('deletes a credential', () => {
    const id = addCredential(db, { name: 'del', username: 'u', password: 'p' });
    deleteCredential(db, id);
    expect(getCredential(db, id)).toBeNull();
  });
});
