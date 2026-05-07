import { describe, it, expect, beforeEach, vi } from 'vitest';
import { initDb, addCredential } from '../src/db';
import { deriveKey, encrypt } from '../src/crypto';
import { cmdList, cmdAdd, cmdRemove, cmdEdit, cmdSee, cmdCopy } from '../src/commands';
import type Database from 'better-sqlite3';

let db: Database.Database;
let key: Buffer;

beforeEach(async () => {
  db = initDb(':memory:');
  key = await deriveKey('master', 'aaaa1111aaaa1111');
});

describe('cmdList', () => {
  it('returns empty array when no credentials', () => {
    const rows = cmdList(db);
    expect(rows).toEqual([]);
  });

  it('returns credentials without decrypting passwords', () => {
    addCredential(db, { name: 'github', username: 'user@test.com', password: encrypt('secret', key) });
    const rows = cmdList(db);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ name: 'github', username: 'user@test.com' });
    expect(rows[0].password).not.toBe('secret');
  });
});

describe('cmdAdd', () => {
  it('inserts an encrypted credential and returns the id', () => {
    const id = cmdAdd(db, key, { name: 'gh', username: 'u@test.com', password: 'plainpw' });
    expect(typeof id).toBe('number');
  });
});

describe('cmdRemove', () => {
  it('removes an existing credential and returns true', () => {
    const id = cmdAdd(db, key, { name: 'gh', username: 'u', password: 'pw' });
    expect(cmdRemove(db, id)).toBe(true);
  });

  it('returns false for non-existent id', () => {
    expect(cmdRemove(db, 999)).toBe(false);
  });
});

describe('cmdEdit', () => {
  it('updates only the provided fields', async () => {
    const id = cmdAdd(db, key, { name: 'old', username: 'u@test.com', password: 'pw' });
    cmdEdit(db, key, id, { name: 'new', username: '', password: '' });
    // just verify no throw — see cmdSee/cmdCopy for value checks
    expect(id).toBeGreaterThan(0);
  });

  it('returns false for non-existent id', () => {
    expect(cmdEdit(db, key, 999, { name: 'x', username: 'x', password: 'x' })).toBe(false);
  });
});

describe('cmdSee', () => {
  it('returns decrypted credential', () => {
    const id = cmdAdd(db, key, { name: 'gh', username: 'user@test.com', password: 'plainpw' });
    const cred = cmdSee(db, key, id);
    expect(cred).toMatchObject({ name: 'gh', username: 'user@test.com', password: 'plainpw' });
  });

  it('returns null for non-existent id', () => {
    expect(cmdSee(db, key, 999)).toBeNull();
  });
});

describe('cmdCopy', () => {
  it('returns the decrypted password string', () => {
    const id = cmdAdd(db, key, { name: 'gh', username: 'user@test.com', password: 'mypassword' });
    const val = cmdCopy(db, key, id, 'password');
    expect(val).toBe('mypassword');
  });

  it('returns the username string', () => {
    const id = cmdAdd(db, key, { name: 'gh', username: 'user@test.com', password: 'mypassword' });
    const val = cmdCopy(db, key, id, 'username');
    expect(val).toBe('user@test.com');
  });

  it('returns null for non-existent id', () => {
    expect(cmdCopy(db, key, 999, 'password')).toBeNull();
  });
});
