import { NextResponse } from "next/server";
import { createSession, setSessionCookie, recordLogin } from "@/lib/auth";
import { checkAuthRateLimit } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit-log";
import bcrypt from "bcryptjs";
import { timingSafeEqual } from "crypto";

/**
 * Returns the configured admin password from the environment.
 * ADMIN_PASSWORD must be set in production; it may be either:
 *   - A bcrypt hash (recommended): generate with `npx bcryptjs-cli hash "yourpassword"`
 *   - A plaintext string (dev only): compared with timingSafeEqual to prevent timing attacks
 */
function getAdminPassword(): string | null {
  const pw = process.env.ADMIN_PASSWORD;
  if (!pw) {
    if (process.env.NODE_ENV === "production") {
      console.error("[FATAL] ADMIN_PASSWORD environment variable is not set.");
      return null;
    }
    console.warn("[WARN] ADMIN_PASSWORD not set. Set it before deploying to production.");
    return null;
  }
  return pw;
}

async function verifyAdminPassword(submitted: string): Promise<boolean> {
  const stored = getAdminPassword();
  if (!stored) return false;

  // If the stored value is a bcrypt hash, use bcrypt.compare (constant-time)
  if (stored.startsWith("$2")) {
    return bcrypt.compare(submitted, stored);
  }

  // Plaintext fallback (dev only) — still use timingSafeEqual to prevent timing attacks
  const storedBuf = Buffer.from(stored, "utf8");
  const submittedBuf = Buffer.from(submitted, "utf8");
  if (storedBuf.length !== submittedBuf.length) return false;
  return timingSafeEqual(storedBuf, submittedBuf);
}

export async function POST(request: Request) {
  try {
    const clientIp = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown";
    await checkAuthRateLimit(`auth:admin:${clientIp}`);

    const { password } = await request.json();
    if (!password) {
      return NextResponse.json({ error: "Password required." }, { status: 400 });
    }
    if (!(await verifyAdminPassword(password))) {
      return NextResponse.json({ error: "Incorrect password." }, { status: 401 });
    }

    const { token, jti } = await createSession({ role: "admin", userId: 0 });
    await setSessionCookie(token);

    const ipAddress = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || null;
    const userAgent = request.headers.get("user-agent") || null;
    await recordLogin(0, "admin", "Admin", jti, ipAddress, userAgent);
    await logAudit({ type: "auth", action: "login", message: "Admin logged in", userId: 0, userRole: "admin" });

    return NextResponse.json({ ok: true, role: "admin" });
  } catch (error: unknown) {
    if (error instanceof Error && error.message.includes("Too many")) {
      return NextResponse.json({ error: error.message }, { status: 429 });
    }
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}
