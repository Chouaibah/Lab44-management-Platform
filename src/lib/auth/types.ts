/**
 * Core auth types shared across all auth sub-modules.
 * Keep this file import-free (no db, no crypto) so it can be used
 * anywhere without side effects.
 */

export type Role = 'admin' | 'instructor' | 'student';

export interface SessionPayload {
  role: Role;
  userId: number;
  username?: string;
  labId?: number;
  /** Set when an admin is impersonating another user */
  originalRole?: string;
  originalUserId?: number;
  /** JWT ID — used to revoke individual tokens */
  jti?: string;
  iat: number;
  exp: number;
}

/**
 * Thrown by `requireAuth` and `requireRole`.
 * API route handlers should catch this and return the matching HTTP status.
 *
 * @example
 * ```ts
 * try {
 *   const session = await requireRole('admin');
 * } catch (e) {
 *   if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.statusCode });
 *   throw e;
 * }
 * ```
 */
export class AuthError extends Error {
  readonly statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.name = 'AuthError';
    this.statusCode = statusCode;
  }
}
