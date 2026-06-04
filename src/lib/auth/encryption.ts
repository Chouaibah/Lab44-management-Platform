/**
 * Field-level AES-256-GCM encryption for sensitive values stored in the DB
 * (e.g. Guacamole passwords, XCP-ng credentials).
 *
 * Format: base64( IV[12 bytes] || ciphertext )
 *
 * Why AES-GCM?
 *   - Authenticated encryption: any tampering of the ciphertext causes decryption
 *     to fail, preventing silent data corruption.
 *   - Random 96-bit IV per encrypt call: the same plaintext produces different
 *     ciphertexts every time, preventing frequency analysis.
 *
 * Key management:
 *   - Set ENCRYPTION_KEY to a random 32-char string (use `openssl rand -base64 32`).
 *   - The key is imported once and cached — `crypto.subtle.importKey` is a
 *     synchronous-style async call but it is not cheap; calling it per-request
 *     would add measurable latency.
 *   - Validation is lazy (on first use) rather than at module load, so importing
 *     from `auth.ts` in routes that don't use encryption doesn't crash the server.
 */

const ENCRYPTION_KEY_RAW = process.env.ENCRYPTION_KEY;

/** Singleton CryptoKey, imported once and reused. */
let _cachedKey: CryptoKey | null = null;

/** Import (or return cached) the AES-GCM CryptoKey. */
async function getEncryptionKey(): Promise<CryptoKey> {
  if (_cachedKey) return _cachedKey;

  if (!ENCRYPTION_KEY_RAW && process.env.NODE_ENV === 'production') {
    throw new Error(
      '[auth/encryption] ENCRYPTION_KEY is not set. ' +
      'Generate one with: openssl rand -base64 32',
    );
  }

  const raw = new TextEncoder().encode(
    ENCRYPTION_KEY_RAW ?? 'change-me-32-chars-encryption-k!',
  );

  // Validate key length (AES-256 requires exactly 32 bytes)
  if (raw.length !== 32) {
    throw new Error(
      `[auth/encryption] ENCRYPTION_KEY must be exactly 32 bytes (got ${raw.length}). ` +
      'Generate with: openssl rand -base64 32',
    );
  }

  _cachedKey = await crypto.subtle.importKey(
    'raw',
    raw,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt'],
  );

  return _cachedKey;
}

/**
 * Encrypt a plain-text string and return a base64 string safe to store in the DB.
 *
 * ```ts
 * const stored = await encryptField(rawPassword);
 * ```
 */
export async function encryptField(plain: string): Promise<string> {
  const key = await getEncryptionKey();
  const iv  = crypto.getRandomValues(new Uint8Array(12)); // 96-bit random IV

  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(plain),
  );

  // Prepend IV so we can extract it during decryption
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(encrypted), iv.length);

  return Buffer.from(combined).toString('base64');
}

/**
 * Decrypt a base64-encoded ciphertext produced by `encryptField`.
 * Throws if the key is wrong or the ciphertext has been tampered with.
 */
export async function decryptField(cipher: string): Promise<string> {
  const key      = await getEncryptionKey();
  const combined = Buffer.from(cipher, 'base64');
  const iv       = combined.slice(0, 12);
  const data     = combined.slice(12);

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    data,
  );

  return new TextDecoder().decode(decrypted);
}
