import { db } from "@/lib/db";
import { getSettingsMap, invalidateSettingsCache } from "@/lib/settings-cache";
import { NextResponse } from "next/server";
import { getGuacamoleToken } from "@/lib/guacamole";
import { getSession } from "@/lib/auth";

async function upsertSetting(key: string, value: string) {
  await db.setting.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });
}

export async function GET() {
  try {
    const session = await getSession();
    if (!session || session.role !== "admin") {
      return NextResponse.json({ error: "Admin access required." }, { status: 403 });
    }

    const map = await getSettingsMap();
    return NextResponse.json({
      guacamole_url: map.guacamole_url || "",
      guacamole_root_username: map.guacamole_root_username || "",
      guacamole_root_password_set: !!map.guacamole_root_password,
    });
  } catch (error) {
    console.error("Guacamole settings fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch Guacamole settings." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== "admin") {
      return NextResponse.json({ error: "Admin access required." }, { status: 403 });
    }

  const body = await request.json().catch(() => ({}));
  const url = body.url || body.host || body.guacamole_url || "";
  const rootUsername = body.rootUsername || body.username || body.guac_username || "";
  const rootPassword = body.rootPassword || body.password || body.guac_password || "";

  console.log("[GUAC-POST] body:", JSON.stringify({ url, rootUsername, hasPassword: !!rootPassword }));

  if (url !== undefined && url !== null) await upsertSetting("guacamole_url", url);
  if (rootUsername !== undefined && rootUsername !== null) await upsertSetting("guacamole_root_username", rootUsername);
  if (rootPassword !== undefined && rootPassword !== null && rootPassword !== "") await upsertSetting("guacamole_root_password", rootPassword);
  invalidateSettingsCache();

  const map = await getSettingsMap();
  const guacUrl = (url !== undefined && url !== null && url !== "") ? url : (map.guacamole_url || "");
  const adminUsername = (rootUsername !== undefined && rootUsername !== null && rootUsername !== "") ? rootUsername : (map.guacamole_root_username || "");
  const adminPassword = (rootPassword !== undefined && rootPassword !== null && rootPassword !== "") ? rootPassword : (map.guacamole_root_password || "");

  if (!guacUrl) {
    return NextResponse.json({ ok: false, message: `Guacamole URL is not configured. Received url: "${url}", body: ${JSON.stringify(body)}` });
  }

  if (!adminUsername || !adminPassword) {
    return NextResponse.json({ ok: false, message: "Guacamole root credentials are not configured." });
  }

    try {
      const { dataSource } = await getGuacamoleToken(guacUrl, adminUsername, adminPassword);
      return NextResponse.json({
        ok: true,
        message: `Connection successful! Authenticated to Guacamole (dataSource: ${dataSource}).`,
        connected: true,
      });
    } catch (fetchError: unknown) {
      const err = fetchError as Error;
      return NextResponse.json({
        ok: false,
        message: `Connection failed: ${err.message || "Unknown error"}`,
        connected: false,
      });
    }
  } catch (error) {
    console.error("Guacamole test error:", error);
    return NextResponse.json({ error: "Failed to test Guacamole connection." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== "admin") {
      return NextResponse.json({ error: "Admin access required." }, { status: 403 });
    }

    const body = await request.json();
    const url = body.url !== undefined ? body.url : (body.host !== undefined ? body.host : body.guacamole_url);
    const rootUsername = body.rootUsername !== undefined ? body.rootUsername : (body.username !== undefined ? body.username : body.guac_username);
    const rootPassword = body.rootPassword !== undefined ? body.rootPassword : (body.password !== undefined ? body.password : body.guac_password);

	if (url !== undefined) await upsertSetting("guacamole_url", url);
	if (rootUsername !== undefined) await upsertSetting("guacamole_root_username", rootUsername);
	if (rootPassword !== undefined && rootPassword.length > 0) {
	await upsertSetting("guacamole_root_password", rootPassword);
	}
	invalidateSettingsCache();

	return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Guacamole save error:", error);
    return NextResponse.json({ error: "Failed to save Guacamole settings." }, { status: 500 });
  }
}
