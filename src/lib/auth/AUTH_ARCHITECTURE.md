# Authentication & Security Architecture

##  Overview
This application uses a **Session-based JWT (JSON Web Token)** architecture stored in **HttpOnly cookies**. This approach combines the stateless payload benefits of JWTs with the high security of traditional server-side sessions, protecting against common web vulnerabilities like XSS (Cross-Site Scripting) and CSRF (Cross-Site Request Forgery).

---

## Authentication Flow

### 1. Login
1. The user submits their credentials.
2. The server verifies the password against the database using **Bcrypt** (cost factor 12).
3. Upon success, the server generates a **JWT** containing the user's ID, role, and a unique token ID (`jti`).
4. The JWT is signed with a secure secret and sent to the client.
5. The browser stores the JWT in an **HttpOnly, Secure, SameSite=Lax cookie**.
6. A "best-effort" audit log is written to the `SessionRecord` table.

### 2. Active Session (Subsequent Requests)
1. The browser automatically sends the HttpOnly cookie with every request.
2. The server middleware/guards (`requireAuth` / `requireRole`) read the cookie.
3. The JWT signature and expiration time (4 hours) are verified.
4. The server checks the **Database Revocation List** to ensure the token hasn't been explicitly logged out.
5. If valid, the request proceeds; if not, a `401 Unauthorized` or `403 Forbidden` error is thrown.

### 3. Logout
1. The server deletes the session cookie from the browser.
2. The token's unique ID (`jti`) is added to the **Revocation List** in the database.
3. Even if an attacker intercepted the cookie, they cannot use it because the server will now recognize the `jti` as revoked.

---

##  Core Components

| File | Responsibility |
| :--- | :--- |
| **`session.ts`** | The core engine. Handles JWT signing (`jose`), cookie management, and route guards (`requireAuth`, `requireRole`). |
| **`password.ts`** | Handles user password hashing and verification using `bcryptjs` with a cost factor of 12. |
| **`token-revocation.ts`** | Manages a database-backed blocklist. Stores revoked JWT IDs (`jti`) to allow instant logout and session invalidation. |
| **`encryption.ts`** | Provides **AES-256-GCM** field-level encryption for storing third-party credentials (e.g., XCP-ng, Guacamole) in the database. |
| **`session-records.ts`** | Audit logging. Tracks login events, active sessions, and logout timestamps without blocking the main auth flow. |
| **`sanitize.ts`** | Prevents data leaks by stripping sensitive fields (passwords, tokens) from API responses before they reach the frontend. |
| **`types.ts`** | Shared TypeScript interfaces (`SessionPayload`, `Role`) and custom `AuthError` classes. |

---

##  Security Features & Protections

*   **XSS Protection (HttpOnly):** Because the JWT is stored in an `HttpOnly` cookie, malicious JavaScript injected into the page **cannot read or steal the token**.
*   **CSRF Protection (SameSite=Lax):** The `SameSite=Lax` attribute prevents the browser from sending the cookie along with cross-site requests, mitigating Cross-Site Request Forgery attacks.
*   **Tamper-Proof Tokens:** JWTs are signed using `HS256`. Any modification to the token payload by the client will cause the signature verification to fail.
*   **Silent Data Corruption Prevention:** Field-level encryption uses **AES-256-GCM** (Authenticated Encryption). If a database value is tampered with, decryption will fail rather than returning corrupted data.
*   **Fail-Open Revocation:** If the database goes down, the revocation check fails "open" (allows access) to prevent locking out all users during an outage, prioritizing availability.

---

##  Architectural Decisions (Why we built it this way)

### Why use a 4-hour Session Token instead of 15-min Access + Refresh Tokens?
Many modern tutorials recommend short-lived Access Tokens (15 mins) and long-lived Refresh Tokens (7 days) with **Token Rotation**. However, that pattern is primarily designed to mitigate **XSS vulnerabilities** in Single Page Applications (SPAs) where tokens are stored in `localStorage` or JavaScript memory.

**Our approach is superior for this use case because:**
1.  **HttpOnly Cookies are Immune to XSS:** Since JavaScript cannot read our cookies, the strict 15-minute expiration rule is unnecessary.
2.  **Simplicity:** Access/Refresh token flows require complex client-side logic to handle token refreshing, race conditions (multiple requests refreshing at once), and token rotation state management.
3.  **Revocation:** By using a database-backed revocation list (`token-revocation.ts`), we get the "instant logout" capability of server-side sessions while keeping the payload benefits of JWTs.

### Why store Revoked Tokens in the Database?
Standard JWTs are "stateless," meaning the server cannot revoke them once issued without a blocklist. By storing a trimmed list of revoked `jti`s (JWT IDs) in the `settings` table, we can instantly invalidate stolen tokens or force logouts without waiting for the 4-hour expiration. The list is automatically trimmed (FIFO) to prevent unbounded database growth.

### Why AES-256-GCM for Database Fields?
While user passwords are hashed (one-way) using Bcrypt, third-party credentials (like infrastructure passwords) must be retrievable by the application to connect to external services. **AES-256-GCM** provides:
1.  **Confidentiality:** Data is unreadable if the database is compromised.
2.  **Integrity:** The GCM mode ensures that if an attacker modifies the encrypted data in the DB, decryption will throw an error instead of silently returning corrupted passwords.
