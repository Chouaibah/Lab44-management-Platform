import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getSettingsMap, invalidateSettingsCache } from "@/lib/settings-cache";
import { testOwnCloudConnection } from "@/lib/owncloud";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Upsert a setting row and invalidate the in-memory cache. */
async function upsertSetting(key: string, value: string): Promise<void> {
  await db.setting.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });
}

/** Normalise user-supplied OwnCloud URL: trim, strip trailing slashes, add scheme. */
function normalizeUrl(raw: string): string {
  const trimmed = raw.trim().replace(/\/+$/, "");
  return trimmed.startsWith("http") ? trimmed : `https://${trimmed}`;
}

// ─── GET: read OwnCloud config (URL is public; root creds are not) ───────────

export async function GET() {
  try {
    const session = await getSession();
    if (!session || (session.role !== "admin" && session.role !== "instructor")) {
      return NextResponse.json({ error: "Access denied." }, { status: 403 });
    }

    const map = await getSettingsMap();
    const result: Record<string, any> = {
      owncloud_url: map.owncloud_url || "",
      // Browser-facing URL used for login links. Empty means "same as
      // owncloud_url", which is correct whenever the internal URL is itself
      // reachable by users' browsers.
      owncloud_public_url: map.owncloud_public_url || "",
      // Indicates whether the "instructor" group + 1 GB quota are applied
      // automatically when an instructor account is created.
      owncloud_instructor_group: "instructor",
      owncloud_instructor_quota: "1 GB",
    };
    if (session.role === "admin") {
      result.owncloud_admin_username = map.owncloud_admin_username || "";
      // Never echo the password back — just whether it's set.
      result.owncloud_admin_password_set = !!map.owncloud_admin_password;
    }
    return NextResponse.json(result);
  } catch (error) {
    console.error("OwnCloud settings GET error:", error);
    return NextResponse.json({ error: "Failed to load settings." }, { status: 500 });
  }
}

// ─── POST: save + test connection (requires all three fields) ───────────────

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== "admin") {
      return NextResponse.json({ error: "Admin access required." }, { status: 403 });
    }

    const { url, publicUrl, adminUsername, adminPassword } = await request.json();
    if (!url || !adminUsername || !adminPassword) {
      return NextResponse.json(
        { error: "URL, root username, and root password are required." },
        { status: 400 },
      );
    }

    const normalizedUrl = normalizeUrl(url);

    await upsertSetting("owncloud_url", normalizedUrl);
    if (publicUrl !== undefined) {
      await upsertSetting("owncloud_public_url", publicUrl ? normalizeUrl(publicUrl) : "");
    }
    await upsertSetting("owncloud_admin_username", adminUsername.trim());
    // NOTE: stored as plaintext in the settings table — the table is
    // admin-only and `owncloud_admin_password` is stripped from all
    // API responses via the SENSITIVE_SETTING_KEYS set.
    await upsertSetting("owncloud_admin_password", adminPassword);
    invalidateSettingsCache();

    const testResult = await testOwnCloudConnection();

    return NextResponse.json({
      ok: testResult.ok,
      message: testResult.ok
        ? "Connected to OwnCloud successfully"
        : testResult.message,
    });
  } catch (error) {
    console.error("OwnCloud settings POST error:", error);
    return NextResponse.json({ error: "Failed to test connection." }, { status: 500 });
  }
}

// ─── PATCH: save changes without testing (password optional) ────────────────

export async function PATCH(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== "admin") {
      return NextResponse.json({ error: "Admin access required." }, { status: 403 });
    }

    const { url, publicUrl, adminUsername, adminPassword } = await request.json();
    if (!url) {
      return NextResponse.json({ error: "URL is required." }, { status: 400 });
    }

    await upsertSetting("owncloud_url", normalizeUrl(url));
    if (publicUrl !== undefined) {
      await upsertSetting("owncloud_public_url", publicUrl ? normalizeUrl(publicUrl) : "");
    }
    if (adminUsername !== undefined) {
      await upsertSetting("owncloud_admin_username", adminUsername.trim());
    }
    // Only overwrite the stored password if the admin actually typed a new one.
    if (typeof adminPassword === "string" && adminPassword.length > 0) {
      await upsertSetting("owncloud_admin_password", adminPassword);
    }
    invalidateSettingsCache();

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("OwnCloud settings PATCH error:", error);
    return NextResponse.json({ error: "Failed to save settings." }, { status: 500 });
  }
}
