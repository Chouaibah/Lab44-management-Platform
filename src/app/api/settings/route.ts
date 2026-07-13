import { db } from "@/lib/db";
import { getSettingsMap, invalidateSettingsCache } from "@/lib/settings-cache";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { filterSensitiveSettings } from "@/lib/auth";
import { logAudit } from "@/lib/audit-log";
import { OWNLOUD_USER_PW_KEY_REGEX } from "@/lib/owncloud";

const SENSITIVE_KEYS = new Set([
  "xcpng_password",
  "guacamole_root_password",
  "owncloud_admin_password",
]);

/**
 * Strip per-instructor OwnCloud password entries (and any other sensitive
 * keys) from a settings map before sending it to the client.
 */
function sanitizeSettings(map: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(map)) {
    if (SENSITIVE_KEYS.has(k)) continue;
    if (OWNLOUD_USER_PW_KEY_REGEX.test(k)) continue;
    out[k] = v;
  }
  return out;
}

async function ensureDefaults() {
  const count = await db.setting.count();
  if (count === 0) {
    await db.setting.createMany({
      data: [
        { key: "signup_enabled", value: "true" },
        { key: "guacamole_url", value: "" },
      ],
    });
  }
}

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    await ensureDefaults();
    const result = await getSettingsMap();

    // Both branches use the same sanitizer — per-instructor OwnCloud
    // passwords must never leave the server via this bulk endpoint
    // (they're only retrievable via /api/owncloud/provision).
    if (session.role !== "admin") {
      return NextResponse.json(sanitizeSettings(result));
    }

    return NextResponse.json(sanitizeSettings(result));
  } catch (error) {
    console.error("Settings error:", error);
    return NextResponse.json({ error: "Failed to load settings." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== "admin") {
      return NextResponse.json({ error: "Admin access required." }, { status: 403 });
    }

    const { key, value } = await request.json();
    if (!key || value === undefined) {
      return NextResponse.json({ error: "key and value required." }, { status: 400 });
    }
        await db.setting.upsert({
        where: { key },
        update: { value: String(value) },
        create: { key, value: String(value) },
        });
        invalidateSettingsCache();

        await logAudit({
          type: "settings",
          action: "update",
          message: `Setting updated: ${key}`,
          userId: session.userId,
          userRole: session.role,
          metadata: { key },
        });

        return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Settings update error:", error);
    return NextResponse.json({ error: "Failed to update setting." }, { status: 500 });
  }
}
