import { NextResponse } from "next/server";
import { clearSessionCookie, getSession, recordLogout } from "@/lib/auth";
import { logAudit } from "@/lib/audit-log";

export async function POST() {
  const session = await getSession();
  if (session) {
    if (session.jti) {
      await recordLogout(session.jti);
    }
    await logAudit({
      type: "auth",
      action: "logout",
      message: `${session.role} logged out`,
      userId: session.userId,
      userRole: session.role,
      labId: session.labId,
    });
  }
  await clearSessionCookie();
  return NextResponse.json({ ok: true });
}
