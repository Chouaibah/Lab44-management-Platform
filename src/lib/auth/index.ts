// src/lib/auth/index.ts
/**
 * Public surface of the auth system. Every route imports from `@/lib/auth` —
 * this file re-exports everything from the sub-modules.
 */

export type { Role, SessionPayload } from './types';
export { AuthError }                 from './types';

export { hashPassword, verifyPassword } from './password';

export {
  createSession,
  setSessionCookie,
  clearSessionCookie,
  getSession,
  requireAuth,
  requireRole,
} from './session';

export { isTokenRevoked, revokeToken }               from './token-revocation';
export { recordLogin, recordLogout, recordActivity }  from './session-records';
export { encryptField, decryptField }                from './encryption';

export {
  filterSensitiveSettings,
  filterCredentialFields,
  sanitizeFilename,
  generateSecurePassword,
} from './sanitize';