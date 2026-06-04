/**
 * Password hashing using bcrypt (cost factor 12).
 *
 * Why cost 12?
 *   - Cost 10 (~100ms) is the bcrypt default and is too fast for a lab platform
 *     where accounts are long-lived.
 *   - Cost 12 (~400ms) is the current OWASP recommendation for bcrypt.
 *   - Cost 14+ would add noticeable latency on login with no real security gain
 *     since the bottleneck is the DB query, not the hash check.
 */

import bcrypt from 'bcryptjs';

const BCRYPT_ROUNDS = 12;

/**
 * Hash a plain-text password. Always use this instead of calling bcrypt directly
 * so the cost factor is set in one place.
 */
export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

/**
 * Compare a plain-text password against a stored bcrypt hash.
 * Returns `true` if the password matches.
 */
export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
