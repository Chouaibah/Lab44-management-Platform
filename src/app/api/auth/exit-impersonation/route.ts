import { NextResponse } from "next/server";
import { getSession, createSession, setSessionCookie, recordLogin } from "@/lib/auth";

export async function POST() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "No active session." }, { status: 401 });
    }

    if (!session.originalRole || session.originalRole !== "admin") {
      return NextResponse.json(
        { error: "Not currently impersonating." },
        { status: 400 }
      );
    }

    const originalUserId = session.originalUserId;

    // Restore admin session
    const { token, jti } = await createSession({
      role: "admin",
      userId: originalUserId ?? 0,
    });
    await setSessionCookie(token);
    await recordLogin(originalUserId ?? 0, "admin", "Admin", jti);

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    console.error("Exit impersonation error:", error);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}
