import { describe, it, expect } from 'vitest';
import { deriveKey, encrypt, decrypt } from '../src/crypto';

describe('deriveKey', () => {
  it('returns a 32-byte Buffer', async () => {
    const key = await deriveKey('master123', 'aaaa1111aaaa1111');
    expect(key).toBeInstanceOf(Buffer);
    expect(key.length).toBe(32);
  });

  it('is deterministic for same inputs', async () => {
    const key1 = await deriveKey('master123', 'aaaa1111aaaa1111');
    const key2 = await deriveKey('master123', 'aaaa1111aaaa1111');
    expect(key1.equals(key2)).toBe(true);
  });

  it('differs for different passwords', async () => {
    const key1 = await deriveKey('password1', 'aaaa1111aaaa1111');
    const key2 = await deriveKey('password2', 'aaaa1111aaaa1111');
    expect(key1.equals(key2)).toBe(false);
  });
});

describe('encrypt / decrypt', () => {
  it('round-trips plaintext', async () => {
    const key = await deriveKey('master123', 'aaaa1111aaaa1111');
    const ciphertext = encrypt('hello world', key);
    expect(decrypt(ciphertext, key)).toBe('hello world');
  });

  it('produces different ciphertext on each call (random IV)', async () => {
    const key = await deriveKey('master123', 'aaaa1111aaaa1111');
    const c1 = encrypt('hello', key);
    const c2 = encrypt('hello', key);
    expect(c1).not.toBe(c2);
  });

  it('throws on wrong key', async () => {
    const key1 = await deriveKey('right', 'aaaa1111aaaa1111');
    const key2 = await deriveKey('wrong', 'aaaa1111aaaa1111');
    const ciphertext = encrypt('secret', key1);
    expect(() => decrypt(ciphertext, key2)).toThrow();
  });
});
