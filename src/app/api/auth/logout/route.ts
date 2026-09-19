import { NextResponse } from "next/server";
import { clearSessionCookie, getSession, recordLogout, revokeToken } from "@/lib/auth";
import { logAudit } from "@/lib/audit-log";

export async function POST() {
  const session = await getSession();
  if (session) {
    if (session.jti) {
      // Deleting the cookie only clears the browser's copy — the JWT itself stays
      // valid until it expires. Revoke the jti so a copied cookie cannot be
      // replayed after logout.
      await revokeToken(session.jti);
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
