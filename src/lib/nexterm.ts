import { getSettingsMap } from "./settings-cache";
import { generateSecurePassword } from "./auth/sanitize";

/**
 * Nexterm client — the alternative to Guacamole for remote consoles.
 *
 * Verified against Nexterm `main` @ 83b9143b (v1.2.2-BETA, shipped as
 * `nexterm/aio:latest`). Facts that shape this file, all from Nexterm's source:
 *
 *   • Auth is `Authorization: Bearer <token>` and the header must be exactly two
 *     space-separated parts (the middleware does `split(" ")[1]`). The token is
 *     either an opaque session token or an API key (`nxt_…`).
 *   • Nexterm reports *business* errors as **HTTP 200 with a numeric `code`**
 *     (201 bad credentials, 202/203 TOTP, 107 registration disabled, 101 exists).
 *     Validation errors are HTTP 400 `{message}`. Both must be handled.
 *   • Credentials are NOT stored on a connection. An `identity` holds them, and
 *     an entry references it via `identities: [id]`.
 *   • The create endpoint is `PUT /api/entries` — plural.
 *   • There is no per-entry ACL: an entry is reachable either by its owner or by
 *     every member of its organization. So per-student isolation is achieved by
 *     creating the entry **with the student's own token** (via impersonation),
 *     which makes that student its owner and 403s everybody else.
 *   • Session tokens never expire. They are only needed transiently (to hand the
 *     browser a URL), so nothing is persisted here.
 */

const NEXTERM_TIMEOUT_MS = 15_000;

export interface NextermResult {
  ok: boolean;
  /** HTTP status. */
  status: number;
  /** Nexterm business code when it returned one (>=100 means "not a success"). */
  code?: number;
  message?: string;
  data: any;
}

/** Nexterm's own "backend is fine, operation failed" envelope. */
function isErrorCode(code: unknown): boolean {
  // 104 is informational ("full-text search done") and accompanies real results.
  return typeof code === "number" && code !== 104;
}

export interface NextermConfig {
  url: string;
  adminUser: string;
  adminPass: string;
}

/** Read the Nexterm connection settings. Returns null if not configured. */
export async function getNextermConfig(): Promise<NextermConfig | null> {
  const map = await getSettingsMap();
  const url = (map.nexterm_url || "").trim().replace(/\/+$/, "");
  const adminUser = (map.nexterm_admin_username || "").trim();
  const adminPass = map.nexterm_admin_password || "";
  if (!url || !adminUser || !adminPass) return null;

  const base = url.startsWith("http") ? url : `http://${url}`;
  return { url: base, adminUser, adminPass };
}

/** The URL a browser should use. Falls back to the internal URL. */
export async function getNextermPublicUrl(): Promise<string | null> {
  const config = await getNextermConfig();
  if (!config) return null;

  const map = await getSettingsMap();
  const publicUrl = (map.nexterm_public_url || "").trim().replace(/\/+$/, "");
  if (!publicUrl) return config.url;

  const withScheme = /^https?:\/\//i.test(publicUrl) ? publicUrl : `https://${publicUrl}`;
  return withScheme.replace(/\/+$/, "");
}

/**
 * One HTTP call. `token` is optional — login and first-account registration are
 * unauthenticated.
 */
async function nextermRequest(
  config: NextermConfig,
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
  path: string,
  opts: { token?: string; body?: unknown } = {},
): Promise<NextermResult> {
  const url = `${config.url}/api${path.startsWith("/") ? path : `/${path}`}`;

  const headers: Record<string, string> = { Accept: "application/json" };
  if (opts.token) {
    // Exactly two space-separated parts — Nexterm reads split(" ")[1].
    headers.Authorization = `Bearer ${opts.token}`;
  }
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";

  try {
    const res = await fetch(url, {
      method,
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      signal: AbortSignal.timeout(NEXTERM_TIMEOUT_MS),
    });

    const text = await res.text();
    let data: any = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { raw: text };
    }

    const code = typeof data?.code === "number" ? data.code : undefined;
    return {
      ok: res.ok && !isErrorCode(code),
      status: res.status,
      code,
      message: typeof data?.message === "string" ? data.message : undefined,
      data,
    };
  } catch (err: any) {
    return {
      ok: false,
      status: 0,
      message:
        err?.name === "TimeoutError"
          ? "Nexterm request timed out"
          : err?.message || "Network error reaching Nexterm",
      data: {},
    };
  }
}

// ─── Admin session ───────────────────────────────────────────────────────────

/** Cached admin session token (module scope — one login per app process). */
let cachedAdminToken: { token: string; url: string; at: number } | null = null;
const ADMIN_TOKEN_TTL_MS = 6 * 60 * 60 * 1000;

async function login(
  config: NextermConfig,
  username: string,
  password: string,
): Promise<NextermResult> {
  return nextermRequest(config, "POST", "/auth/login", { body: { username, password } });
}

/**
 * A session token for the configured admin account, creating that account on the
 * very first run.
 *
 * Nexterm has no environment-based admin bootstrap, but it does promote the
 * **first** registered account to administrator — so if the login fails and
 * registration succeeds, we have just created the admin. That makes a fresh
 * install work with no manual account creation.
 */
export async function getNextermAdminToken(force = false): Promise<string | null> {
  const config = await getNextermConfig();
  if (!config) return null;

  if (
    !force &&
    cachedAdminToken &&
    cachedAdminToken.url === config.url &&
    Date.now() - cachedAdminToken.at < ADMIN_TOKEN_TTL_MS
  ) {
    return cachedAdminToken.token;
  }

  let result = await login(config, config.adminUser, config.adminPass);

  if (!result.ok) {
    // First run: no accounts exist yet, so register the admin account.
    const reg = await nextermRequest(config, "POST", "/accounts/register", {
      body: {
        username: config.adminUser,
        password: config.adminPass,
        firstName: "Lab44",
        lastName: "Admin",
      },
    });

    if (reg.ok) {
      console.log("[nexterm] registered the first account, which Nexterm promotes to administrator");
      result = await login(config, config.adminUser, config.adminPass);
    } else {
      console.error(
        `[nexterm] admin login failed (code ${result.code ?? "-"} ${result.message ?? ""}) ` +
        `and first-account registration failed (code ${reg.code ?? "-"} ${reg.message ?? ""})`,
      );
    }
  }

  const token = result.data?.token;
  if (!result.ok || typeof token !== "string" || !token) return null;

  cachedAdminToken = { token, url: config.url, at: Date.now() };
  return token;
}

/** Drop the cached admin token (used when a call comes back unauthorised). */
export function invalidateNextermAdminToken(): void {
  cachedAdminToken = null;
}

// ─── Accounts ────────────────────────────────────────────────────────────────

/**
 * Nexterm usernames must be 3–15 characters, alphanumeric only.
 * A student id like "2021-0042/A" becomes "20210042A".
 */
export function toNextermUsername(raw: string): string {
  const cleaned = (raw || "").replace(/[^a-zA-Z0-9]/g, "").slice(0, 15);
  if (cleaned.length >= 3) return cleaned;
  return `${cleaned}usr`.slice(0, 15);
}

async function findUserId(token: string, username: string): Promise<number | null> {
  const config = await getNextermConfig();
  if (!config) return null;

  const res = await nextermRequest(
    config,
    "GET",
    `/users/list?search=${encodeURIComponent(username)}`,
    { token },
  );
  const users = res.data?.users;
  if (!Array.isArray(users)) return null;

  const match = users.find(
    (u: any) => String(u?.username ?? "").toLowerCase() === username.toLowerCase(),
  );
  return match && typeof match.id === "number" ? match.id : null;
}

/**
 * Ensure a Nexterm account exists for `username`, with a password nobody needs
 * to know: consoles are opened by impersonation (a session token in the URL), so
 * the password is never shown to the student.
 */
export async function nextermEnsureUser(
  username: string,
  firstName: string,
  lastName: string,
): Promise<{ ok: boolean; accountId?: number; created?: boolean; error?: string }> {
  const config = await getNextermConfig();
  if (!config) return { ok: false, error: "Nexterm is not configured." };

  const adminToken = await getNextermAdminToken();
  if (!adminToken) return { ok: false, error: "Could not authenticate with Nexterm as administrator." };

  const existing = await findUserId(adminToken, username);
  if (existing !== null) return { ok: true, accountId: existing, created: false };

  const res = await nextermRequest(config, "PUT", "/users", {
    token: adminToken,
    body: {
      username,
      password: generateSecurePassword(20),
      // Both are required by Nexterm (1–50 chars each).
      firstName: (firstName || username).slice(0, 50),
      lastName: (lastName || "-").slice(0, 50),
    },
  });

  if (res.ok) {
    const id = await findUserId(adminToken, username);
    return id !== null
      ? { ok: true, accountId: id, created: true }
      : { ok: false, error: "Account was created but could not be looked up." };
  }

  // 101 = already exists (e.g. created between the lookup and the call).
  if (res.code === 101) {
    const id = await findUserId(adminToken, username);
    if (id !== null) return { ok: true, accountId: id, created: false };
  }

  return { ok: false, error: res.message || `Nexterm returned status ${res.status}` };
}

/** A session token for the given account — Nexterm's impersonation primitive. */
export async function nextermImpersonate(
  accountId: number,
): Promise<{ ok: boolean; token?: string; error?: string }> {
  const config = await getNextermConfig();
  if (!config) return { ok: false, error: "Nexterm is not configured." };

  const adminToken = await getNextermAdminToken();
  if (!adminToken) return { ok: false, error: "Could not authenticate with Nexterm as administrator." };

  const res = await nextermRequest(config, "POST", `/users/${accountId}/login`, {
    token: adminToken,
  });

  const token = res.data?.token;
  if (!res.ok || typeof token !== "string" || !token) {
    return { ok: false, error: res.message || `Nexterm returned status ${res.status}` };
  }
  return { ok: true, token };
}

// ─── Identities & entries ────────────────────────────────────────────────────

/**
 * Ensure an identity (the stored credential pair) exists for this user.
 * Must be called with the *user's* token so the identity belongs to them.
 *
 * Note: we deliberately do NOT search for a pre-existing identity. The only list
 * endpoint (`GET /api/entries/list`) returns a nested folder tree rather than a
 * flat list, so looking entries up by name is unreliable. The ids Lab44 creates
 * are persisted on the VMRequest instead and passed back in.
 */
export async function nextermEnsureIdentity(
  token: string,
  opts: {
    name: string;
    username: string;
    password: string;
    existingIdentityId?: number | null;
  },
): Promise<{ ok: boolean; identityId?: number; created?: boolean; error?: string }> {
  const config = await getNextermConfig();
  if (!config) return { ok: false, error: "Nexterm is not configured." };

  const body = {
    name: opts.name,
    username: opts.username,
    type: "password",
    password: opts.password,
  };

  if (opts.existingIdentityId) {
    // An empty password means "no override given": the caller (an instructor
    // opening someone else's VM, or a student reconnecting) did not type a
    // credential, so the one already stored must be kept. PATCHing it with ""
    // would wipe a working VM credential.
    if (!opts.password) {
      return { ok: true, identityId: opts.existingIdentityId, created: false };
    }
    const patched = await nextermRequest(config, "PATCH", `/identities/${opts.existingIdentityId}`, {
      token,
      body,
    });
    // Keep the stored VM credential in step with the current password.
    if (patched.ok) return { ok: true, identityId: opts.existingIdentityId, created: false };
    // Otherwise it was deleted in Nexterm — fall through and recreate it.
  }

  const res = await nextermRequest(config, "PUT", "/identities", { token, body });
  const id = res.data?.id;
  if (!res.ok || typeof id !== "number") {
    return { ok: false, error: res.message || `Nexterm returned status ${res.status}` };
  }
  return { ok: true, identityId: id, created: true };
}

/** Ensure an entry (the connection) exists for this user, pointing at the VM. */
export async function nextermEnsureEntry(
  token: string,
  opts: {
    name: string;
    protocol: "rdp" | "ssh" | "vnc";
    ip: string;
    port: number;
    identityId: number;
    existingEntryId?: number | null;
  },
): Promise<{ ok: boolean; entryId?: number; created?: boolean; error?: string }> {
  const config = await getNextermConfig();
  if (!config) return { ok: false, error: "Nexterm is not configured." };

  const body = {
    name: opts.name,
    type: "server",
    // ssh renders as a terminal, rdp/vnc through the guac renderer.
    renderer: opts.protocol === "ssh" ? "terminal" : "guac",
    config: { protocol: opts.protocol, ip: opts.ip, port: opts.port },
    // No organizationId: the entry stays owned by this user, which is what makes
    // it unreachable by every other account.
    identities: [opts.identityId],
  };

  if (opts.existingEntryId) {
    const patched = await nextermRequest(config, "PATCH", `/entries/${opts.existingEntryId}`, {
      token,
      body,
    });
    // The VM's IP can change between sessions, so refresh the target each time.
    if (patched.ok) return { ok: true, entryId: opts.existingEntryId, created: false };
  }

  const res = await nextermRequest(config, "PUT", "/entries", { token, body });
  const id = res.data?.id;
  if (!res.ok || typeof id !== "number") {
    return { ok: false, error: res.message || `Nexterm returned status ${res.status}` };
  }
  return { ok: true, entryId: id, created: true };
}

/** Delete an entry. Requires that user's token (only the owner may delete). */
export async function nextermDeleteEntry(token: string, entryId: number): Promise<boolean> {
  const config = await getNextermConfig();
  if (!config) return false;
  const res = await nextermRequest(config, "DELETE", `/entries/${entryId}`, { token });
  return res.ok;
}

/** Nexterm's default ports, used when the caller does not specify one. */
export function defaultPortFor(protocol: "rdp" | "ssh" | "vnc"): number {
  return protocol === "ssh" ? 22 : protocol === "vnc" ? 5900 : 3389;
}

// ─── End-to-end provisioning ─────────────────────────────────────────────────

export interface NextermConsoleResult {
  ok: boolean;
  /** Where to send the browser (Nexterm's public URL). */
  publicUrl?: string;
  /**
   * A session token for the *student's* Nexterm account. Put it in the URL as
   * `?token=` and Nexterm logs them in automatically — the same mechanism its
   * own OIDC callback uses. This is what removes the need to type anything.
   */
  sessionToken?: string;
  /** The entry to open, via `?connectId=`. */
  entryId?: number;
  username?: string;
  error?: string;
}

/**
 * Give one student prompt-free access to their VM through Nexterm.
 *
 * The isolation comes from *whose token creates the objects*: both the identity
 * (which holds the VM credentials) and the entry are created with the student's
 * own impersonated token, so `accountId` is the student and `organizationId` is
 * null. Nexterm's `validateEntryAccess` then returns 403 for every other
 * account, and `listEntries` never shows it to anyone else. There is no
 * per-entry ACL, so this is the only way to scope access to a single VM.
 */
export async function provisionNextermConsole(opts: {
  /** VMRequest row to stamp the created ids onto. */
  vmRequestId: number;
  /**
   * Who owns the Nexterm objects. Usually the student the VM was requested for,
   * but an instructor-owned request (`studentDbId` is null) is provisioned under
   * the instructor's own account instead — Nexterm entries are only visible to
   * the account that created them, so "its own VM" needs its own account.
   */
  ownerFirstName: string;
  ownerLastName: string;
  /** Raw account key; sanitised to a valid Nexterm username (3-15 alnum). */
  ownerKey: string;
  protocol: "rdp" | "ssh" | "vnc";
  ip: string;
  /** Display name for the entry, e.g. the VM name. */
  entryName: string;
  /** Credentials for the VM's own OS account. */
  vmUser: string;
  vmPass: string;
  /** Ids from a previous run, so we update rather than duplicate. */
  existingEntryId?: number | null;
  existingIdentityId?: number | null;
}): Promise<NextermConsoleResult> {
  const publicUrl = await getNextermPublicUrl();
  if (!publicUrl) return { ok: false, error: "Nexterm is not configured." };

  const username = toNextermUsername(opts.ownerKey);

  const account = await nextermEnsureUser(
    username,
    opts.ownerFirstName,
    opts.ownerLastName,
  );
  if (!account.ok || !account.accountId) {
    return { ok: false, error: account.error || "Could not create the Nexterm account." };
  }

  const impersonated = await nextermImpersonate(account.accountId);
  if (!impersonated.ok || !impersonated.token) {
    return { ok: false, error: impersonated.error || "Could not obtain a Nexterm session." };
  }
  const token = impersonated.token;

  const identity = await nextermEnsureIdentity(token, {
    name: `${opts.entryName}-cred`,
    username: opts.vmUser,
    password: opts.vmPass,
    existingIdentityId: opts.existingIdentityId ?? null,
  });
  if (!identity.ok || !identity.identityId) {
    return { ok: false, error: identity.error || "Could not store the VM credentials." };
  }

  const entry = await nextermEnsureEntry(token, {
    name: opts.entryName,
    protocol: opts.protocol,
    ip: opts.ip,
    port: defaultPortFor(opts.protocol),
    identityId: identity.identityId,
    existingEntryId: opts.existingEntryId ?? null,
  });
  if (!entry.ok || !entry.entryId) {
    return { ok: false, error: entry.error || "Could not create the Nexterm connection." };
  }

  // Remember what we created so the next connect updates instead of duplicating.
  const { db } = await import("./db");
  await db.vMRequest
    .update({
      where: { id: opts.vmRequestId },
      data: {
        nextermEntryId: entry.entryId,
        nextermIdentityId: identity.identityId,
      },
    })
    .catch((err: unknown) => {
      // Non-fatal: these ids are a cache to avoid duplicate entries, not the
      // source of truth. A failure here just means the next call recreates them.
      console.warn("[nexterm] could not persist entry/identity ids:", err);
    });

  return { ok: true, publicUrl, sessionToken: token, entryId: entry.entryId, username };
}

