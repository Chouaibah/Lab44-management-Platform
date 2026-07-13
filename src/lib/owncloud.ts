/**
 * OwnCloud OCS (Open Cloud Services) API client.
 *
 * Used to:
 *   - Test the connection to an OwnCloud instance using root/admin credentials.
 *   - Provision instructor accounts automatically (create user, set 1 GB quota,
 *     add to the "instructor" group).
 *   - Look up users (so we don't try to recreate existing ones).
 *   - Delete users when instructors are removed.
 *
 * Settings consumed (read from the `Setting` table via `getSettingsMap`):
 *   - `owncloud_url`             Base URL of the OwnCloud instance
 *   - `owncloud_admin_username`  Root/admin username (e.g. "admin")
 *   - `owncloud_admin_password`  Root/admin password (stored encrypted at rest
 *                                by the settings layer; plaintext only in memory)
 *
 * All network calls go through the OCS v2 endpoint:
 *   `${owncloud_url}/ocs/v2.php/cloud/...`
 *
 * OwnCloud's OCS API expects request bodies as `application/x-www-form-urlencoded`
 * (NOT JSON). Responses are JSON when `Accept: application/json` is sent.
 * Successful OCS calls return `meta.statuscode === 100` (for "ok") — HTTP 200
 * alone is not sufficient because OCS wraps errors in a 200 envelope.
 */

import { getSettingsMap } from "./settings-cache";
import { db } from "./db";
import { encryptField, decryptField } from "./auth/encryption";
import { invalidateSettingsCache } from "./settings-cache";

// ─── Constants ───────────────────────────────────────────────────────────────

/** Quota applied to every instructor account (1 GB). */
export const INSTRUCTOR_QUOTA = "1 GB";

/** Group every instructor is added to after creation. */
export const INSTRUCTOR_GROUP = "instructor";

/** Default timeout for OCS requests (ms). */
const OCS_TIMEOUT_MS = 15_000;

interface OwnCloudConfig {
  url: string;
  adminUser: string;
  adminPass: string;
}

export interface OwnCloudResult {
  ok: boolean;
  /** OCS status code if present, otherwise HTTP status. */
  status: number;
  /** Human-readable message from OCS meta, if any. */
  message?: string;
  /** Raw parsed JSON response (or `{}` if body was not JSON). */
  data: any;
}

// ─── Config loading ──────────────────────────────────────────────────────────

/**
 * Read OwnCloud root credentials from the settings table.
 * Returns `null` if any of the three required settings is missing.
 */
export async function getOwnCloudConfig(): Promise<OwnCloudConfig | null> {
  const map = await getSettingsMap();
  const url = map.owncloud_url;
  const user = map.owncloud_admin_username;
  const pass = map.owncloud_admin_password;
  if (!url || !user || !pass) return null;

  // Normalise: ensure exactly one trailing slash is stripped, force https://
  const normalized = url.replace(/\/+$/, "").trim();
  const base = normalized.startsWith("http") ? normalized : `https://${normalized}`;
  return { url: base, adminUser: user.trim(), adminPass: pass };
}

// ─── Low-level OCS request helper ────────────────────────────────────────────

/**
 * Perform a single OCS API call.
 *
 * - GET / DELETE: no body.
 * - POST / PUT: body is form-encoded (`application/x-www-form-urlencoded`).
 *
 * The function resolves (does not throw) on network errors — it returns
 * `{ ok: false, status: 0, message: err.message }` instead, so callers can
 * use a consistent destructure pattern.
 */
async function ocsRequest(
  config: OwnCloudConfig,
  method: "GET" | "POST" | "PUT" | "DELETE",
  path: string,
  body?: Record<string, string | number | undefined>,
): Promise<OwnCloudResult> {
  const url = `${config.url}/ocs/v2.php/${path.replace(/^\//, "")}`;
  const auth = btoa(`${config.adminUser}:${config.adminPass}`);

  const headers: Record<string, string> = {
    "OCS-APIRequest": "true",
    "Accept": "application/json",
    "Authorization": `Basic ${auth}`,
  };

  const fetchOpts: RequestInit = {
    method,
    headers,
    // Self-signed certs are common in lab infra — Node 18+ honours this env
    // var, but the browser fetch used here doesn't, so we rely on the user
    // having a valid cert OR running behind a reverse proxy with one.
    // @ts-ignore - `signal` is supported in both Node and browser fetch.
    signal: AbortSignal.timeout(OCS_TIMEOUT_MS),
  };

  if (body && Object.keys(body).length > 0) {
    headers["Content-Type"] = "application/x-www-form-urlencoded";
    // Strip `undefined` values and URL-encode the rest.
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(body)) {
      if (v !== undefined && v !== null) params.append(k, String(v));
    }
    fetchOpts.body = params.toString();
  }

  try {
    const res = await fetch(url, fetchOpts);
    const text = await res.text();
    let data: any = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      // Some OCS endpoints return XML or empty bodies — treat as raw text.
      data = { raw: text };
    }

    const meta = data?.ocs?.meta;
    const ocsOk = meta?.statuscode === 100 || meta?.status === "ok";
    // Some endpoints (e.g. user search) return HTTP 200 with no OCS wrapper.
    const ok = res.ok && (ocsOk || !meta);

    return {
      ok,
      status: meta?.statuscode ?? res.status,
      message: meta?.message,
      data,
    };
  } catch (err: any) {
    return {
      ok: false,
      status: 0,
      message: err?.name === "TimeoutError"
        ? "OwnCloud request timed out"
        : (err?.message || "Network error reaching OwnCloud"),
      data: {},
    };
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Verify the configured root credentials by listing one user.
 * Returns a friendly message suitable for showing in the admin UI.
 */
export async function testOwnCloudConnection(): Promise<{ ok: boolean; message: string }> {
  const config = await getOwnCloudConfig();
  if (!config) {
    return { ok: false, message: "OwnCloud is not configured — set URL, root username and root password." };
  }
  const result = await ocsRequest(config, "GET", "cloud/users?limit=1");
  if (result.ok) {
    return { ok: true, message: "Connected to OwnCloud successfully." };
  }
  return {
    ok: false,
    message: result.message || `OwnCloud returned status ${result.status}.`,
  };
}

/**
 * Check whether a user already exists in OwnCloud.
 *
 * GET /ocs/v2.php/cloud/users/{userid}
 *   → 200 + meta.statuscode 100 if exists
 *   → 404 + meta.statuscode 998 if not found
 */
export async function ownCloudUserExists(username: string): Promise<boolean> {
  const config = await getOwnCloudConfig();
  if (!config) return false;
  const safeUser = encodeURIComponent(username);
  const result = await ocsRequest(config, "GET", `cloud/users/${safeUser}`);
  return result.ok;
}

/**
 * Create a group if it doesn't already exist. Safe to call repeatedly.
 *
 * POST /ocs/v2.php/cloud/groups
 *   body: groupid=<name>
 *   → 100 ok, or 102 "group already exists" (which we treat as success).
 */
export async function ensureOwnCloudGroup(group: string): Promise<OwnCloudResult> {
  const config = await getOwnCloudConfig();
  if (!config) {
    return { ok: false, status: 0, message: "OwnCloud is not configured.", data: {} };
  }
  const result = await ocsRequest(config, "POST", "cloud/groups", { groupid: group });
  // 102 = group already exists in OCS
  if (!result.ok && (result.status === 102 || (result.message || "").toLowerCase().includes("exists"))) {
    return { ...result, ok: true };
  }
  return result;
}

/**
 * Set the quota for an existing OwnCloud user.
 *
 * PUT /ocs/v2.php/cloud/users/{userid}
 *   body: key=quota&value=<quota>
 *
 * `quota` can be a human string like "1 GB" or a number of bytes.
 */
export async function setOwnCloudUserQuota(
  username: string,
  quota: string = INSTRUCTOR_QUOTA,
): Promise<OwnCloudResult> {
  const config = await getOwnCloudConfig();
  if (!config) {
    return { ok: false, status: 0, message: "OwnCloud is not configured.", data: {} };
  }
  const safeUser = encodeURIComponent(username);
  return ocsRequest(config, "PUT", `cloud/users/${safeUser}`, {
    key: "quota",
    value: quota,
  });
}

/**
 * Add an existing OwnCloud user to a group.
 *
 * POST /ocs/v2.php/cloud/users/{userid}/groups
 *   body: groupid=<group>
 */
export async function addOwnCloudUserToGroup(
  username: string,
  group: string = INSTRUCTOR_GROUP,
): Promise<OwnCloudResult> {
  const config = await getOwnCloudConfig();
  if (!config) {
    return { ok: false, status: 0, message: "OwnCloud is not configured.", data: {} };
  }
  const safeUser = encodeURIComponent(username);
  return ocsRequest(config, "POST", `cloud/users/${safeUser}/groups`, { groupid: group });
}

/**
 * Provision a full instructor account in OwnCloud:
 *   1. Ensure the "instructor" group exists.
 *   2. Create the user (userid, password, displayName, email).
 *   3. Set the quota to 1 GB.
 *   4. Add the user to the "instructor" group.
 *
 * If the user already exists, this is a no-op for step 2 but steps 3 and 4
 * are still applied (so existing instructors converge to the correct state).
 *
 * Returns `{ ok: true }` on success, or `{ ok: false, error }` with a
 * human-readable error message.
 */
export async function createOwnCloudUser(
  username: string,
  password: string,
  displayName: string,
  email?: string,
): Promise<{ ok: boolean; error?: string }> {
  const config = await getOwnCloudConfig();
  if (!config) {
    return { ok: false, error: "OwnCloud is not configured." };
  }

  // 0. Make sure the instructor group exists (no-op if it already does).
  const groupResult = await ensureOwnCloudGroup(INSTRUCTOR_GROUP);
  if (!groupResult.ok) {
    return {
      ok: false,
      error: `Failed to ensure group "${INSTRUCTOR_GROUP}": ${groupResult.message || groupResult.status}`,
    };
  }

  // 1. Check if user already exists — if so, skip creation and just re-apply
  //    quota + group membership (idempotent).
  const exists = await ownCloudUserExists(username);
  if (!exists) {
    const createBody: Record<string, string> = {
      userid: username,
      password,
      displayName: displayName || username,
    };
    if (email) createBody.email = email;

    const createResult = await ocsRequest(config, "POST", "cloud/users", createBody);
    if (!createResult.ok) {
      // 102 = user already exists (race / partial state) — treat as success
      if (createResult.status === 102 ||
          (createResult.message || "").toLowerCase().includes("already exists")) {
        // fall through to quota + group
      } else {
        console.error("[OwnCloud] Create user failed:", JSON.stringify(createResult.data));
        return {
          ok: false,
          error: createResult.message || `OwnCloud returned status ${createResult.status}`,
        };
      }
    }
  }

  // 2. Apply 1 GB quota (always, so existing users get corrected).
  const quotaResult = await setOwnCloudUserQuota(username, INSTRUCTOR_QUOTA);
  if (!quotaResult.ok) {
    console.warn(`[OwnCloud] Quota set failed for "${username}": ${quotaResult.message || quotaResult.status}`);
    // Non-fatal — user can still log in.
  }

  // 3. Add to instructor group (always, so existing users get corrected).
  const groupAddResult = await addOwnCloudUserToGroup(username, INSTRUCTOR_GROUP);
  if (!groupAddResult.ok) {
    console.warn(`[OwnCloud] Group add failed for "${username}": ${groupAddResult.message || groupAddResult.status}`);
    // Non-fatal.
  }

  return { ok: true };
}

/**
 * Set (or reset) the password for an existing OwnCloud user.
 *
 * PUT /ocs/v2.php/cloud/users/{userid}
 *   body: key=password&value=<newpassword>
 *
 * Used by the provision endpoint when the instructor has forgotten their
 * OwnCloud password — we reset it to a fresh random value and hand it back.
 */
export async function setOwnCloudUserPassword(
  username: string,
  newPassword: string,
): Promise<OwnCloudResult> {
  const config = await getOwnCloudConfig();
  if (!config) {
    return { ok: false, status: 0, message: "OwnCloud is not configured.", data: {} };
  }
  const safeUser = encodeURIComponent(username);
  return ocsRequest(config, "PUT", `cloud/users/${safeUser}`, {
    key: "password",
    value: newPassword,
  });
}

/**
 * Delete an OwnCloud user. Returns `{ ok: true }` if the user is gone
 * (including "already deleted" / "not found" responses).
 */
export async function deleteOwnCloudUser(username: string): Promise<{ ok: boolean; error?: string }> {
  const config = await getOwnCloudConfig();
  if (!config) {
    return { ok: false, error: "OwnCloud is not configured." };
  }
  const safeUser = encodeURIComponent(username);
  const result = await ocsRequest(config, "DELETE", `cloud/users/${safeUser}`);
  // 998 = user not found in OCS — treat as success.
  if (result.ok || result.status === 998 || result.status === 404 || result.status === 101) {
    return { ok: true };
  }
  return {
    ok: false,
    error: result.message || `OwnCloud returned status ${result.status}`,
  };
}

/**
 * Build the URL an instructor should visit to log into OwnCloud.
 * Just the base URL with a trailing slash — OwnCloud's web UI will
 * redirect unauthenticated users to the login page.
 */
export async function getOwnCloudLoginUrl(): Promise<string | null> {
  const config = await getOwnCloudConfig();
  if (!config) return null;
  return `${config.url}/`;
}

// ─── Per-instructor encrypted password storage ───────────────────────────────
//
// We need to be able to hand an instructor their OwnCloud password on demand
// (auto-login via URL is not supported by OwnCloud for security reasons).
// Storing it in plaintext would be a security risk, so we use AES-256-GCM
// via the existing `encryptField`/`decryptField` helpers.
//
// Storage location: the `Setting` table with key
//   `owncloud_user_pw_<lowercase-username>`
// These keys are stripped from API responses via the
// `owncloud_admin_password` entry in SENSITIVE_SETTING_KEYS — wait, no, that
// only matches the exact admin password key. Per-user keys are filtered by a
// dedicated guard in `/api/owncloud` and `/api/settings` (see filterRegex
// below) — but to keep things simple, we never bulk-return settings to
// non-admin clients anyway, and per-user password keys are only ever fetched
// through the dedicated provision endpoint.

const USER_PW_KEY_PREFIX = "owncloud_user_pw_";

/** Build the Setting key for a given instructor's OwnCloud password. */
function userPwSettingKey(username: string): string {
  return `${USER_PW_KEY_PREFIX}${username.toLowerCase()}`;
}

/**
 * Persist the OwnCloud password for an instructor (encrypted at rest with
 * AES-256-GCM). Call this:
 *   - When the admin creates an instructor (we know the plaintext password).
 *   - When we provision or reset the OwnCloud account from the provision endpoint.
 *
 * Idempotent: calling it again overwrites the previous stored value.
 */
export async function storeInstructorOwnCloudPassword(
  username: string,
  password: string,
): Promise<void> {
  const encrypted = await encryptField(password);
  const key = userPwSettingKey(username);
  await db.setting.upsert({
    where: { key },
    update: { value: encrypted },
    create: { key, value: encrypted },
  });
  invalidateSettingsCache();
}

/**
 * Retrieve the stored OwnCloud password for an instructor (decrypted).
 * Returns `null` if no password has been stored for this user.
 */
export async function getInstructorOwnCloudPassword(
  username: string,
): Promise<string | null> {
  const map = await getSettingsMap();
  const stored = map[userPwSettingKey(username)];
  if (!stored) return null;
  try {
    return await decryptField(stored);
  } catch (err) {
    console.error(`[OwnCloud] Failed to decrypt stored password for "${username}":`, err);
    return null;
  }
}

/**
 * Remove the stored OwnCloud password for an instructor.
 * Called when the instructor is deleted from the platform.
 */
export async function clearInstructorOwnCloudPassword(username: string): Promise<void> {
  const key = userPwSettingKey(username);
  try {
    await db.setting.delete({ where: { key } });
    invalidateSettingsCache();
  } catch {
    // Setting didn't exist — no-op.
  }
}

/**
 * Regex that matches per-instructor OwnCloud password setting keys.
 * Used by `/api/settings` to filter these out of bulk responses.
 */
export const OWNLOUD_USER_PW_KEY_REGEX = /^owncloud_user_pw_/;
