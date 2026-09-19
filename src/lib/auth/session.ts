/**
 * Session management — JWT creation, cookie handling, and session verification.
 *
 * Token lifecycle:
 *   1. User logs in → `createSession` signs a JWT → `setSessionCookie` writes it httpOnly.
 *   2. Every request → `getSession` reads the cookie, verifies the JWT signature and
 *      expiry, then checks the revocation list.
 *   3. User logs out → `clearSessionCookie` removes the cookie + `revokeToken` adds
 *      the jti to the DB revocation list (so stolen tokens are also invalidated).
 *
 * Token duration: 4 hours. This matches a typical lab session.
 * If you need "remember me", issue a separate long-lived refresh token instead of
 * extending this — mixing session and refresh in one JWT leads to revocation bugs.
 */

import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import type { Role, SessionPayload } from './types';
import { AuthError } from './types';
import { isTokenRevoked } from './token-revocation';

// ─── Constants ────────────────────────────────────────────────────────────────

const SESSION_DURATION_HOURS = 4;
const SESSION_DURATION_SECONDS = SESSION_DURATION_HOURS * 60 * 60;
const COOKIE_NAME = 'lab44_auth_session';

/**
 * SESSION_SECRET must be defined in .env for production.
 * Generate with: openssl rand -base64 32
 * Fallback value below is for development only.
 */
const SESSION_SECRET = new TextEncoder().encode(
  process.env.SESSION_SECRET ?? 'change-me-in-production-at-least-32-chars!!',
);

// ─── JWT operations ───────────────────────────────────────────────────────────

/**
 * Sign a new session JWT and return the token string and its unique JTI.
 * The JTI is stored in the DB session record and can be used to revoke the token.
 */
export async function createSession(payload: {
  role: Role;
  userId: number;
  username?: string;
  labId?: number;
  originalRole?: string;
  originalUserId?: number;
}): Promise<{ token: string; jti: string }> {
  const jti = crypto.randomUUID();

  const token = await new SignJWT({ ...payload, jti })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION_HOURS}h`)
    .sign(SESSION_SECRET);

  return { token, jti };
}

// ─── Cookie management ────────────────────────────────────────────────────────

/**
 * Whether an insecure (non-HTTPS) origin may carry the session cookie.
 *
 * Compared against the literal "true" on purpose: testing the raw value for
 * truthiness would treat the STRING "false" as enable-insecure, so an operator
 * writing `ALLOW_INSECURE_COOKIES=false` — the safe setting — would silently get
 * cookies sent over plain HTTP.
 */
function allowInsecureCookies(): boolean {
  return process.env.ALLOW_INSECURE_COOKIES === 'true';
}

/** Write the session JWT into an httpOnly cookie. */
export async function setSessionCookie(token: string): Promise<void> {
  const cookieStore = await cookies();
  const insecureAllowed = allowInsecureCookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    // "Secure" cookies are only stored over HTTPS by browsers. Browsers make an
    // exception for http://localhost, but NOT for a LAN address, so a Secure
    // cookie silently disappears when the app is used as http://192.168.x.x:3000.
    // Set ALLOW_INSECURE_COOKIES=true (compose does by default) while serving
    // plain HTTP, and false once the app is behind HTTPS.
    secure: process.env.NODE_ENV === 'production' && !insecureAllowed,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_DURATION_SECONDS,
  });
}

/** Remove the session cookie. Call this on logout alongside `revokeToken`. */
export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

// ─── Session reading ──────────────────────────────────────────────────────────

/**
 * Read and verify the session from the request cookie.
 *
 * Returns `null` (never throws) when:
 *   - No cookie is present
 *   - The JWT signature is invalid or the token is expired
 *   - The token's JTI has been revoked
 *
 * API route handlers should call `requireAuth()` or `requireRole()` instead,
 * which throw typed `AuthError`s with the correct HTTP status codes.
 */
export async function getSession(): Promise<SessionPayload | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;
    if (!token) return null;

    const { payload } = await jwtVerify(token, SESSION_SECRET);
    const session = payload as unknown as SessionPayload;

    if (session.jti && await isTokenRevoked(session.jti)) {
      return null;
    }

    return session;
  } catch {
    // jwtVerify throws on bad signature or expiry — treat as unauthenticated.
    return null;
  }
}

// ─── Route guards ─────────────────────────────────────────────────────────────

/**
 * Assert the request is authenticated. Throws `AuthError(401)` if not.
 *
 * Use inside API route handlers:
 * ```ts
 * const session = await requireAuth();
 * ```
 */
export async function requireAuth(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) throw new AuthError('Authentication required', 401);
  return session;
}

/**
 * Assert the request is authenticated AND the user has one of the given roles.
 * Throws `AuthError(401)` if not logged in, `AuthError(403)` if wrong role.
 *
 * ```ts
 * const session = await requireRole('admin', 'instructor');
 * ```
 */
export async function requireRole(...roles: Role[]): Promise<SessionPayload> {
  const session = await requireAuth();
  if (!roles.includes(session.role)) {
    throw new AuthError('Insufficient permissions', 403);
  }
  return session;
}
