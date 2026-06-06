// Guacamole REST API integration
// Uses Node.js native http/https modules for:
//   - Self-signed certificate support (rejectUnauthorized: false)
//   - Proper request timeouts
//   - Detailed error diagnostics

import http from "http";
import https from "https";

// ─── Low-level request helper ────────────────────────────────────────────────

interface GuacResponse {
  status: number;
  statusText: string;
  body: string;
}

function guacRequest(
  url: string,
  options: {
    method: string;
    headers?: Record<string, string>;
    body?: string;
    timeoutMs?: number;
  }
): Promise<GuacResponse> {
  const timeoutMs = options.timeoutMs ?? 15_000;

  return new Promise((resolve, reject) => {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return reject(new Error(`Invalid URL: ${url}`));
    }

    const isHttps = parsed.protocol === "https:";
    const mod = isHttps ? https : http;

    const reqOptions: https.RequestOptions = {
      hostname: parsed.hostname,
      port: parsed.port || (isHttps ? 443 : 80),
      path: parsed.pathname + parsed.search,
      method: options.method,
      headers: options.headers || {},
      timeout: timeoutMs,
      // Allow self-signed certificates — very common in internal Guacamole deployments
      rejectUnauthorized: false,
    };

    const req = mod.request(reqOptions, (res) => {
      let data = "";
      res.on("data", (chunk: Buffer) => {
        data += chunk;
      });
      res.on("end", () => {
        resolve({
          status: res.statusCode || 0,
          statusText: res.statusMessage || "",
          body: data,
        });
      });
    });

    req.on("error", (err) => {
      // Include the root cause for better diagnostics
      const cause = (err as any)?.cause?.message || "";
      const msg = cause
        ? `${err.message} (cause: ${cause})`
        : err.message;
      reject(new Error(msg));
    });

    req.on("timeout", () => {
      req.destroy();
      reject(new Error(`Request timed out after ${timeoutMs}ms`));
    });

    if (options.body) {
      req.write(options.body);
    }
    req.end();
  });
}

// ─── URL candidates ──────────────────────────────────────────────────────────

function toGuacBaseCandidates(rawUrl: string): string[] {
  const trimmed = (rawUrl || "").trim();
  if (!trimmed) return [];

  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  const parsed = new URL(withScheme);

  parsed.hash = "";
  parsed.search = "";

  const cleanPath = parsed.pathname.replace(/\/+$/, "");
  const primaryBase = `${parsed.origin}${cleanPath === "/" ? "" : cleanPath}`;

  const candidates = [primaryBase];

  // If the path doesn't end with /guacamole, add it as a variant
  if (!cleanPath || cleanPath === "/") {
    candidates.push(`${parsed.origin}/guacamole`);
  } else if (!cleanPath.toLowerCase().endsWith("/guacamole")) {
    candidates.push(`${parsed.origin}${cleanPath}/guacamole`);
  }

  // Also try HTTP if the primary is HTTPS (in case HTTPS has cert issues)
  for (const c of [...candidates]) {
    const httpVariant = c.replace(/^https:/, "http:");
    if (!candidates.includes(httpVariant)) {
      candidates.push(httpVariant);
    }
  }

  return [...new Set(candidates.map((url) => url.replace(/\/+$/, "")))];
}

function compactBodyPreview(body: string, maxLen = 220): string {
  const compact = body.replace(/\s+/g, " ").trim();
  if (!compact) return "";
  return compact.length > maxLen ? `${compact.slice(0, maxLen)}...` : compact;
}

// ─── Token ───────────────────────────────────────────────────────────────────

export async function getGuacamoleToken(
  guacUrl: string,
  username: string,
  password: string
) {
  const params = new URLSearchParams();
  params.append("username", username);
  params.append("password", password);

  const candidates = toGuacBaseCandidates(guacUrl);
  const attempts: string[] = [];

  for (const baseUrl of candidates) {
    try {
      const res = await guacRequest(`${baseUrl}/api/tokens`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params.toString(),
      });

      if (res.status !== 200) {
        const body = compactBodyPreview(res.body);
        attempts.push(
          `${baseUrl} -> HTTP ${res.status}${res.statusText ? ` ${res.statusText}` : ""}${body ? ` | ${body}` : ""}`
        );
        continue;
      }

      const data = JSON.parse(res.body);
      if (!data?.authToken || !data?.dataSource) {
        attempts.push(`${baseUrl} -> Invalid token payload: ${compactBodyPreview(res.body)}`);
        continue;
      }

      return { token: data.authToken, dataSource: data.dataSource, baseUrl };
    } catch (error: any) {
      attempts.push(`${baseUrl} -> ${error?.message || "Network error"}`);
    }
  }

  throw new Error(
    `Failed to get Guacamole token. Attempts: ${attempts.join(" ; ")}`
  );
}

// ─── User management ─────────────────────────────────────────────────────────

export async function createGuacamoleUser(
  guacUrl: string,
  token: string,
  dataSource: string,
  username: string,
  password: string
) {
  const res = await guacRequest(
    `${guacUrl}/api/session/data/${dataSource}/users`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Guacamole-Token": token,
      },
      body: JSON.stringify({ username, password, attributes: {} }),
    }
  );

  if (res.status !== 200 && res.status !== 201) {
    throw new Error(
      `Failed to create Guacamole user: HTTP ${res.status} ${compactBodyPreview(res.body)}`
    );
  }
  return true;
}

/**
 * Ensure the student's Guacamole user exists with the correct password.
 * - If the user doesn't exist: create it.
 * - If the user already exists: update the password to match our derived credentials.
 * - If a real error occurs, it is re-thrown.
 */
export async function ensureGuacamoleUser(
  guacUrl: string,
  adminToken: string,
  dataSource: string,
  username: string,
  password: string
): Promise<void> {
  try {
    await createGuacamoleUser(guacUrl, adminToken, dataSource, username, password);
    console.log(`[Guac] Created user: ${username}`);
  } catch (e: any) {
    const msg = e?.message || "";
    // Guacamole returns 400 when the user already exists — update password instead
    if (msg.includes("400") || msg.toLowerCase().includes("already exists")) {
      console.log(`[Guac] User already exists, updating password: ${username}`);
      await updateGuacamoleUserPassword(guacUrl, adminToken, dataSource, username, password);
    } else {
      // Real error — re-throw
      console.error(`[Guac] Failed to ensure user ${username}:`, e);
      throw e;
    }
  }
}

/**
 * Update a Guacamole user's password.
 */
export async function updateGuacamoleUserPassword(
  guacUrl: string,
  adminToken: string,
  dataSource: string,
  username: string,
  password: string
): Promise<void> {
  const res = await guacRequest(
    `${guacUrl}/api/session/data/${dataSource}/users/${username}`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "Guacamole-Token": adminToken,
      },
      body: JSON.stringify({ username, password, attributes: {} }),
    }
  );

  if (res.status !== 200 && res.status !== 204) {
    throw new Error(
      `Failed to update Guacamole user password: HTTP ${res.status} ${compactBodyPreview(res.body)}`
    );
  }
}

// ─── Connection management ────────────────────────────────────────────────────

export async function createGuacamoleConnection(
  guacUrl: string,
  token: string,
  dataSource: string,
  name: string,
  protocol: "rdp" | "ssh" | "vnc",
  host: string,
  port: string,
  user: string,
  pass: string
) {
  const parameters: Record<string, string> = {
    hostname: host,
    port: port,
  };

  if (protocol !== "vnc") {
    if (user) parameters["username"] = user;
    if (pass) parameters["password"] = pass;
  }

  if (protocol === "rdp") {
    parameters["ignore-cert"] = "true";
    parameters["security"] = "any";
  }

  if (protocol === "ssh") {
    // For SSH, also add useful defaults
    parameters["color-scheme"] = "gray-black";
    parameters["font-size"] = "14";
  }

  const res = await guacRequest(
    `${guacUrl}/api/session/data/${dataSource}/connections`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Guacamole-Token": token,
      },
      body: JSON.stringify({
        parentIdentifier: "ROOT",
        name,
        protocol,
        parameters,
        attributes: {
          // No limits — a student can connect to multiple VMs simultaneously.
          "max-connections": "",
          "max-connections-per-user": "",
        },
      }),
    }
  );

  if (res.status !== 200 && res.status !== 201) {
    throw new Error(
      `Failed to create Guacamole connection: HTTP ${res.status} ${compactBodyPreview(res.body)}`
    );
  }

  const data = JSON.parse(res.body);
  return data.identifier as string;
}

export async function grantGuacamoleAccess(
  guacUrl: string,
  token: string,
  dataSource: string,
  username: string,
  connectionId: string
) {
  const res = await guacRequest(
    `${guacUrl}/api/session/data/${dataSource}/users/${username}/permissions`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "Guacamole-Token": token,
      },
      body: JSON.stringify([
        {
          op: "add",
          path: `/connectionPermissions/${connectionId}`,
          value: "READ",
        },
      ]),
    }
  );

  if (res.status !== 200 && res.status !== 204) {
    throw new Error(
      `Failed to grant access: HTTP ${res.status} ${compactBodyPreview(res.body)}`
    );
  }
  return true;
}

/**
 * Delete only a Guacamole connection (does NOT delete the student user).
 * Used when a VM changes IP or protocol so we recreate the connection only.
 */
export async function deleteGuacamoleConnection(
  guacUrl: string,
  adminUser: string,
  adminPass: string,
  connectionId: string,
  dataSource?: string
): Promise<void> {
  const { token, baseUrl, dataSource: ds } = await getGuacamoleToken(
    guacUrl,
    adminUser,
    adminPass
  );
  const finalDs = dataSource || ds;
  const res = await guacRequest(
    `${baseUrl}/api/session/data/${finalDs}/connections/${connectionId}`,
    {
      method: "DELETE",
      headers: { "Guacamole-Token": token },
    }
  );
  if (res.status !== 200 && res.status !== 204) {
    console.error(
      "Failed to delete Guacamole connection:",
      res.status,
      compactBodyPreview(res.body)
    );
  }
}

/**
 * Delete both a connection and the associated Guacamole user.
 * Used for temporary admin/instructor sessions only.
 */
export async function deleteGuacamoleUserAndConnection(
  guacUrl: string,
  adminUser: string,
  adminPass: string,
  studentUsername: string,
  connId: string,
  _hardcodedDataSource?: string
) {
  const { token, dataSource, baseUrl } = await getGuacamoleToken(
    guacUrl,
    adminUser,
    adminPass
  );

  if (connId) {
    try {
      const res = await guacRequest(
        `${baseUrl}/api/session/data/${dataSource}/connections/${connId}`,
        {
          method: "DELETE",
          headers: { "Guacamole-Token": token },
        }
      );
      if (res.status !== 200 && res.status !== 204) {
        console.error("Failed to delete guac connection:", res.status, compactBodyPreview(res.body));
      }
    } catch (e) {
      console.error("Failed to delete guac connection", e);
    }
  }

  if (studentUsername) {
    try {
      const res = await guacRequest(
        `${baseUrl}/api/session/data/${dataSource}/users/${studentUsername}`,
        {
          method: "DELETE",
          headers: { "Guacamole-Token": token },
        }
      );
      if (res.status !== 200 && res.status !== 204) {
        console.error("Failed to delete guac user:", res.status, compactBodyPreview(res.body));
      }
    } catch (e) {
      console.error("Failed to delete guac user", e);
    }
  }
}

/**
 * Provision a temporary Guacamole user + connection (for admin/instructor).
 * These users are ephemeral and should be cleaned up after the session.
 */
export async function provisionGuacamoleTempAccess(
  guacUrl: string,
  adminUser: string,
  adminPass: string,
  tempUsername: string,
  tempPassword: string,
  vmIdentifier: string,
  protocol: "rdp" | "ssh" | "vnc",
  host: string,
  vmUser: string,
  vmPass: string
) {
  const { token, dataSource, baseUrl } = await getGuacamoleToken(
    guacUrl,
    adminUser,
    adminPass
  );

  await ensureGuacamoleUser(baseUrl, token, dataSource, tempUsername, tempPassword);

  const defaultPort =
    protocol === "rdp" ? "3389" : protocol === "ssh" ? "22" : "5900";
  const connectionName = `${vmIdentifier}-${protocol}-${tempUsername}-${Date.now().toString(36)}`;

  const connId = await createGuacamoleConnection(
    baseUrl,
    token,
    dataSource,
    connectionName,
    protocol,
    host,
    defaultPort,
    vmUser,
    vmPass
  );

  await grantGuacamoleAccess(baseUrl, token, dataSource, tempUsername, connId);

  return { connId, dataSource, baseUrl };
}
