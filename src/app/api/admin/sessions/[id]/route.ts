import { NextResponse } from "next/server";
import { requireRole, revokeToken } from "@/lib/auth";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit-log";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole("admin");
    const { id } = await params;

    const session = await db.sessionRecord.findUnique({ where: { id: parseInt(id) } });
    if (!session) {
      return NextResponse.json({ error: "Session not found." }, { status: 404 });
    }

    // Mark as inactive
    await db.sessionRecord.update({
      where: { id: parseInt(id) },
      data: {
        isActive: false,
        logoutAt: new Date(),
      },
    });

    // Add token to revocation list
    await revokeToken(session.tokenJti);

    await logAudit({
      type: "auth",
      action: "delete",
      message: `Admin terminated session for ${session.userName} (${session.userRole})`,
      userId: 0,
      userRole: "admin",
      metadata: { terminatedSessionId: session.id, tokenJti: session.tokenJti },
    });

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    if (error instanceof Error && (error.message.includes("Authentication required") || error.message.includes("Insufficient"))) {
      return NextResponse.json({ error: "Admin access required." }, { status: 403 });
    }
    console.error("Session terminate error:", error);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}
