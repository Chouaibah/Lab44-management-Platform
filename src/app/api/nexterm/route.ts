import { db } from "@/lib/db";
import { getSettingsMap, invalidateSettingsCache } from "@/lib/settings-cache";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

/**
 * Nexterm settings, mirroring the shape of /api/guacamole so the admin settings
 * page can treat both providers the same way.
 *
 * GET    → current values (never the password itself, only whether one is set)
 * PATCH  → save; only the fields present in the body are touched
 * POST   → test the connection by authenticating as the configured admin
 */

async function upsertSetting(key: string, value: string) {
  await db.setting.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });
}

async function requireAdmin() {
  const session = await getSession();
  if (!session || session.role !== "admin") return null;
  return session;
}

export async function GET() {
  try {
    if (!(await requireAdmin())) {
      return NextResponse.json({ error: "Admin access required." }, { status: 403 });
    }

    const map = await getSettingsMap();
    return NextResponse.json({
      nexterm_url: map.nexterm_url || "",
      // Browser-facing URL — students are sent here to open their console.
      nexterm_public_url: map.nexterm_public_url || "",
      nexterm_admin_username: map.nexterm_admin_username || "",
      // Never echo the password back, only whether one exists.
      nexterm_admin_password_set: !!map.nexterm_admin_password,
    });
  } catch (error) {
    console.error("Nexterm settings fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch Nexterm settings." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    if (!(await requireAdmin())) {
      return NextResponse.json({ error: "Admin access required." }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const { url, publicUrl, adminUsername, adminPassword } = body as {
      url?: string;
      publicUrl?: string;
      adminUsername?: string;
      adminPassword?: string;
    };

    if (url !== undefined) await upsertSetting("nexterm_url", url.trim());
    if (publicUrl !== undefined) await upsertSetting("nexterm_public_url", publicUrl.trim());
    if (adminUsername !== undefined) {
      await upsertSetting("nexterm_admin_username", adminUsername.trim());
    }
    // Only overwrite the password when a new one was actually typed.
    if (typeof adminPassword === "string" && adminPassword.length > 0) {
      await upsertSetting("nexterm_admin_password", adminPassword);
    }
    invalidateSettingsCache();

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Nexterm settings save error:", error);
    return NextResponse.json({ error: "Failed to save Nexterm settings." }, { status: 500 });
  }
}

export async function POST() {
  try {
    if (!(await requireAdmin())) {
      return NextResponse.json({ error: "Admin access required." }, { status: 403 });
    }

    const { getNextermAdminToken, invalidateNextermAdminToken } = await import("@/lib/nexterm");
    invalidateNextermAdminToken();
    const token = await getNextermAdminToken(true);

    return NextResponse.json(
      token
        ? {
            ok: true,
            connected: true,
            message:
              "Connected to Nexterm successfully. If no account existed yet, the configured one was just created as its administrator.",
          }
        : {
            ok: false,
            connected: false,
            message:
              "Could not authenticate with Nexterm. Check the URL and the admin credentials (see the app logs for the exact response).",
          },
    );
  } catch (error) {
    console.error("Nexterm connection test error:", error);
    return NextResponse.json({ error: "Failed to test the Nexterm connection." }, { status: 500 });
  }
}
