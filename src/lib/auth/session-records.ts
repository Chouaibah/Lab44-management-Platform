/**
 * Session record functions — write login events, logout events, and activity
 * timestamps to the `SessionRecord` table.
 *
 * These are "best-effort" operations: all failures are caught and logged but
 * never surfaced to the caller. A failed session record must never block login.
 */

import { db } from '../db';

/**
 * Write a new session record when a user logs in.
 *
 * @param tokenJti - The JWT's `jti` claim, used to link the record to the token.
 */
export async function recordLogin(
  userId: number,
  userRole: string,
  userName: string,
  tokenJti: string,
  ipAddress?: string | null,
  userAgent?: string | null,
): Promise<void> {
  try {
    await db.sessionRecord.create({
      data: {
        userId,
        userRole,
        userName,
        tokenJti,
        ipAddress: ipAddress ?? null,
        userAgent: userAgent ?? null,
      },
    });
  } catch (err) {
    console.error('[auth] recordLogin failed — session record not written:', err);
  }
}

/**
 * Mark a session as logged out. Uses `updateMany` because the session record
 * may not exist for tokens created before session recording was added.
 */
export async function recordLogout(tokenJti: string): Promise<void> {
  try {
    await db.sessionRecord.updateMany({
      where: { tokenJti },
      data: { isActive: false, logoutAt: new Date() },
    });
  } catch (err) {
    // Silently ignore — old tokens won't have a session record.
    // Log at debug level only to avoid noise.
    if (process.env.NODE_ENV === 'development') {
      console.debug('[auth] recordLogout: no session record for jti', tokenJti);
    }
  }
}

/**
 * Update the `lastActiveAt` timestamp for an active session.
 * Called by middleware on authenticated requests.
 */
export async function recordActivity(tokenJti: string): Promise<void> {
  try {
    await db.sessionRecord.updateMany({
      where: { tokenJti },
      data: { lastActiveAt: new Date() },
    });
  } catch (err) {
    // Non-fatal: old tokens or missing records — log in dev only.
    if (process.env.NODE_ENV === 'development') {
      console.debug('[auth] recordActivity: could not update lastActiveAt for jti', tokenJti, err);
    }
  }
}
