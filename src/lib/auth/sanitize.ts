/**
 * Data sanitization utilities used when returning data from API routes.
 *
 * Rule of thumb:
 *   - `filterSensitiveSettings` → for the flat settings object (key-value store).
 *   - `filterCredentialFields`  → for arbitrary objects (user records, VM configs).
 *   - `sanitizeFilename`        → before using user input as a filename.
 *   - `generateSecurePassword`  → when auto-creating credentials.
 */

// ─── Sensitive keys ───────────────────────────────────────────────────────────

/**
 * Setting keys whose values should never leave the server.
 * Extend this when adding new credential-type settings.
 */
const SENSITIVE_SETTING_KEYS = new Set([
  'xcpng_password',
  'guacamole_root_password',
  'owncloud_admin_password',
]);

/**
 * Object field names considered credential-like.
 * Used by `filterCredentialFields` to strip sensitive data from API responses.
 */
const CREDENTIAL_FIELD_NAMES = new Set([
  'password',
  'guacPassword',
  'guacamole_root_password',
  'xcpng_password',
  'owncloud_admin_password',
  'secret',
  'token',
]);

// ─── Filter functions ─────────────────────────────────────────────────────────

/**
 * Replace sensitive values in the flat settings object with `"***"`.
 *
 * ```ts
 * const safe = filterSensitiveSettings(allSettings);
 * return NextResponse.json(safe);
 * ```
 */
export function filterSensitiveSettings(
  settings: Record<string, string>,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(settings).map(([key, value]) => [
      key,
      SENSITIVE_SETTING_KEYS.has(key) ? '***' : value,
    ]),
  );
}

/**
 * Omit credential fields from any object before sending it in an API response.
 * Pass `extraKeys` to strip additional fields beyond the built-in list.
 *
 * ```ts
 * const safeUser = filterCredentialFields(userRecord, new Set(['internalNote']));
 * ```
 */
export function filterCredentialFields<T extends Record<string, unknown>>(
  obj: T,
  extraKeys?: Set<string>,
): Partial<T> {
  const blocked = extraKeys
    ? new Set([...CREDENTIAL_FIELD_NAMES, ...extraKeys])
    : CREDENTIAL_FIELD_NAMES;

  return Object.fromEntries(
    Object.entries(obj).filter(([key]) => !blocked.has(key)),
  ) as Partial<T>;
}

// ─── Utilities ────────────────────────────────────────────────────────────────

/**
 * Remove characters that are unsafe in filenames (path separators, quotes,
 * control chars). Keeps alphanumerics, spaces, dots, hyphens, underscores.
 *
 * ```ts
 * const name = sanitizeFilename(userInput); // e.g. "my file.csv"
 * ```
 */
export function sanitizeFilename(name: string): string {
  return name
    .replace(/[\r\n"\\]/g, '_')   // control chars and quotes → underscore
    .replace(/[^\w .\-]/g, '');   // strip everything else except safe chars
}

/**
 * Generate a cryptographically random password of the given length.
 * Uses `crypto.getRandomValues` — suitable for use as auto-generated credentials.
 *
 * Default length: 16 characters from [A-Za-z0-9!@#$%].
 */
export function generateSecurePassword(length = 16): string {
  const CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%';
  const bytes   = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, b => CHARSET[b % CHARSET.length]).join('');
}
