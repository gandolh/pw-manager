import { pbkdf2, randomBytes, createCipheriv, createDecipheriv } from 'node:crypto';
import { promisify } from 'node:util';

const pbkdf2Async = promisify(pbkdf2) as (
  password: string | Buffer,
  salt: string | Buffer,
  iterations: number,
  keylen: number,
  digest: string
) => Promise<Buffer>;

const ITERATIONS = 200_000;
const KEY_LEN = 32;
const DIGEST = 'sha256';
const IV_LEN = 12;
const AUTH_TAG_LEN = 16;
const ALGORITHM = 'aes-256-gcm';

export async function deriveKey(password: string, salt: string): Promise<Buffer> {
  return pbkdf2Async(password, salt, ITERATIONS, KEY_LEN, DIGEST);
}

export function generateSalt(): string {
  return randomBytes(16).toString('base64');
}

export function encrypt(plaintext: string, key: Buffer): string {
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]).toString('base64');
}

export function decrypt(encoded: string, key: Buffer): string {
  const data = Buffer.from(encoded, 'base64');
  if (data.length < IV_LEN + AUTH_TAG_LEN) {
    throw new Error('Malformed ciphertext');
  }
  const iv = data.subarray(0, IV_LEN);
  const authTag = data.subarray(IV_LEN, IV_LEN + AUTH_TAG_LEN);
  const ciphertext = data.subarray(IV_LEN + AUTH_TAG_LEN);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}

export const VERIFICATION_PLAINTEXT = 'pw-manager-ok';
