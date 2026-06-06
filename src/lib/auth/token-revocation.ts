/**
 * Token revocation using a DB-backed allowlist.
 *
 * How it works:
 *   Revoked JWT IDs (jti) are stored as a JSON array in the `settings` table
 *   under the key "revoked_tokens". On every authenticated request, `getSession`
 *   checks this list before accepting a token.
 *
 * Limitations and trade-offs:
 *   - This adds one extra DB read per request. Acceptable for a lab platform;
 *     for high-traffic apps, use Redis with a TTL instead.
 *   - The list is trimmed to MAX_REVOKED_TOKENS entries (FIFO) to prevent
 *     unbounded growth. Since JWTs expire in 8h, any entry older than 8h is
 *     harmless to remove — the token would be rejected by JWT expiry anyway.
 *   - Concurrent writes (two logout requests at the same time) could theoretically
 *     lose one revocation due to read-modify-write. For a single-server lab setup
 *     this is acceptable. A proper fix is a DB-level atomic operation or Redis SADD.
 */

import { db } from '../db';

const REVOCATION_SETTING_KEY = 'revoked_tokens';

/** Maximum number of JTIs kept in the revocation list. */
const MAX_REVOKED_TOKENS = 1_000;

/**
 * Trims the revocation list to the most recent MAX_REVOKED_TOKENS / 2 entries
 * when it grows too large.
 */
function trim(list: string[]): string[] {
  return list.length > MAX_REVOKED_TOKENS
    ? list.slice(-Math.floor(MAX_REVOKED_TOKENS / 2))
    : list;
}

/** Read the current revocation list from the DB. Returns [] on any error. */
async function readRevokedList(): Promise<string[]> {
  const setting = await db.setting.findUnique({
    where: { key: REVOCATION_SETTING_KEY },
  });
  if (!setting) return [];
  return JSON.parse(setting.value) as string[];
}

/** Persist the revocation list to the DB. */
async function writeRevokedList(list: string[]): Promise<void> {
  await db.setting.upsert({
    where:  { key: REVOCATION_SETTING_KEY },
    update: { value: JSON.stringify(list) },
    create: { key: REVOCATION_SETTING_KEY, value: JSON.stringify(list) },
  });
}

/**
 * Returns `true` if the given JTI has been explicitly revoked.
 * Always returns `false` on DB errors (fail-open) — a revocation DB failure
 * is logged server-side but shouldn't lock out every user.
 */
export async function isTokenRevoked(jti: string): Promise<boolean> {
  try {
    const revoked = await readRevokedList();
    return revoked.includes(jti);
  } catch (err) {
    console.error('[auth] isTokenRevoked DB error:', err);
    return false; // fail-open: prefer availability over strict security on DB outage
  }
}

/**
 * Adds a JTI to the revocation list.
 * Idempotent — adding the same JTI twice is a no-op.
 */
export async function revokeToken(jti: string): Promise<void> {
  try {
    const revoked = await readRevokedList();
    if (revoked.includes(jti)) return; // already revoked, nothing to do
    const updated = trim([...revoked, jti]);
    await writeRevokedList(updated);
  } catch (err) {
    console.error('[auth] revokeToken failed:', err);
  }
}
