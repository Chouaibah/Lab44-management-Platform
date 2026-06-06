import { db } from "@/lib/db";
import { getSettingsMap, invalidateSettingsCache } from "@/lib/settings-cache";
import { NextResponse } from "next/server";
import { getXCPSession } from "@/lib/xcp";
import { getSession } from "@/lib/auth";

export async function GET() {
  try {
    const session = await getSession();
    if (!session || session.role !== "admin") {
      return NextResponse.json({ error: "Admin access required." }, { status: 403 });
    }

	const map = await getSettingsMap();
	return NextResponse.json({
      xcpng_host: map.xcpng_host || "",
      xcpng_username: map.xcpng_username || "",
      xcpng_password_set: !!map.xcpng_password,
    });
  } catch (error) {
    console.error("XCP-ng settings fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch settings" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== "admin") {
      return NextResponse.json({ error: "Admin access required." }, { status: 403 });
    }

    const { host, username, password } = await request.json();

    if (!host) {
      return NextResponse.json({ error: "Host is required" }, { status: 400 });
    }

    const upsert = async (key: string, value: string) => {
      await db.setting.upsert({
        where: { key },
        update: { value },
        create: { key, value },
      });
    };

	if (host) await upsert("xcpng_host", host);
	if (username) await upsert("xcpng_username", username);
	if (password && password.length > 0) await upsert("xcpng_password", password);
	invalidateSettingsCache();

	try {
      await getXCPSession();
      return NextResponse.json({
        ok: true,
        message: "Connection successful! XCP-ng host is reachable and credentials are valid.",
        connected: true,
      });
  } catch (loginErr: any) {
    const msg = loginErr.message || String(loginErr);
    console.error("[XCP-ng] Login test failed:", msg);

    if (msg.includes("SESSION_AUTHENTICATION_FAILED") || msg.includes("Login failed") || msg.includes("authentication")) {
      return NextResponse.json({ ok: false, message: `Authentication failed: ${msg}`, connected: false });
    }

    if (msg.includes("ECONNREFUSED") || msg.includes("ENOTFOUND") || msg.includes("unreachable") || msg.includes("timed out")) {
      return NextResponse.json({ ok: false, message: `Host is unreachable: ${msg}`, connected: false });
    }

    if (msg.includes("certificate") || msg.includes("CERT") || msg.includes("self-signed") || msg.includes("UNABLE_TO_VERIFY_LEAF_SIGNATURE")) {
      return NextResponse.json({ ok: false, message: `SSL certificate error. Set XCP_REJECT_UNAUTHORIZED=false in .env if using self-signed cert: ${msg}`, connected: false });
    }

    return NextResponse.json({ ok: false, message: `Connection failed: ${msg}`, connected: false });
  }
  } catch (error) {
    console.error("XCP-ng test error:", error);
    return NextResponse.json({ error: "Failed to test connection" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== "admin") {
      return NextResponse.json({ error: "Admin access required." }, { status: 403 });
    }

    const { host, username, password } = await request.json();

    const upsert = async (key: string, value: string) => {
      await db.setting.upsert({
        where: { key },
        update: { value },
        create: { key, value },
      });
    };

	if (host !== undefined) await upsert("xcpng_host", host);
	if (username !== undefined) await upsert("xcpng_username", username);
	if (password !== undefined && password.length > 0) await upsert("xcpng_password", password);
	invalidateSettingsCache();

	return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("XCP-ng save error:", error);
    return NextResponse.json({ error: "Failed to save settings" }, { status: 500 });
  }
}
