import { db } from "@/lib/db";
import { getSettingsMap, invalidateSettingsCache } from "@/lib/settings-cache";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { filterSensitiveSettings } from "@/lib/auth";
import { logAudit } from "@/lib/audit-log";

const SENSITIVE_KEYS = new Set([
  "xcpng_password",
  "guacamole_root_password",
]);

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

    if (session.role !== "admin") {
      const safeResult: Record<string, string> = {};
      for (const [key, value] of Object.entries(result)) {
        if (!SENSITIVE_KEYS.has(key)) {
          safeResult[key] = value;
        }
      }
      return NextResponse.json(safeResult);
    }

    return NextResponse.json(filterSensitiveSettings(result));
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
