import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const SALT_LENGTH = 32;
const ITERATIONS = 100000;

/**
 * Derive a 256-bit key from a password using PBKDF2
 */
function deriveKey(password: string, salt: Buffer): Buffer {
  return crypto.pbkdf2Sync(password, salt, ITERATIONS, KEY_LENGTH, 'sha256');
}

/**
 * Encrypt a string with AES-256-GCM using a password
 * Returns: salt(32) + iv(16) + authTag(16) + ciphertext
 */
export function encrypt(data: string, password: string): Buffer {
  const salt = crypto.randomBytes(SALT_LENGTH);
  const key = deriveKey(password, salt);
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });

  const encrypted = Buffer.concat([
    cipher.update(data, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  // Concatenate: salt + iv + authTag + encrypted data
  return Buffer.concat([salt, iv, authTag, encrypted]);
}

/**
 * Decrypt a Buffer with AES-256-GCM using a password
 * Expects: salt(32) + iv(16) + authTag(16) + ciphertext
 */
export function decrypt(encryptedBuffer: Buffer, password: string): string {
  const salt = encryptedBuffer.subarray(0, SALT_LENGTH);
  const iv = encryptedBuffer.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
  const authTag = encryptedBuffer.subarray(SALT_LENGTH + IV_LENGTH, SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = encryptedBuffer.subarray(SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH);

  const key = deriveKey(password, salt);
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return decrypted.toString('utf8');
}

/**
 * Verify if a buffer looks like a valid encrypted backup
 */
export function isValidEncryptedBackup(buffer: Buffer): boolean {
  // Minimum size: salt(32) + iv(16) + authTag(16) + at least some data
  return buffer.length > SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH;
}
