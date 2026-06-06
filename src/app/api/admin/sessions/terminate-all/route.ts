import { NextResponse } from "next/server";
import { requireRole, revokeToken } from "@/lib/auth";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit-log";

export async function POST(request: Request) {
  try {
    const adminSession = await requireRole("admin");

    // Get current admin's token JTI so we don't terminate their own session
    const body = await request.json().catch(() => ({}));
    const excludeJti = body.excludeJti as string | undefined;

    // Find all active sessions
    const activeSessions = await db.sessionRecord.findMany({
      where: { isActive: true },
    });

    let terminatedCount = 0;
    for (const session of activeSessions) {
      // Skip the admin's own session
      if (session.tokenJti === excludeJti) continue;
      // Also skip if it's the same admin user (userId 0, role admin)
      if (session.userId === adminSession.userId && session.userRole === "admin") continue;

      await db.sessionRecord.update({
        where: { id: session.id },
        data: {
          isActive: false,
          logoutAt: new Date(),
        },
      });

      await revokeToken(session.tokenJti);
      terminatedCount++;
    }

    await logAudit({
      type: "auth",
      action: "delete",
      message: `Admin terminated all sessions (${terminatedCount} sessions terminated)`,
      userId: 0,
      userRole: "admin",
      metadata: { terminatedCount },
    });

    return NextResponse.json({ ok: true, terminatedCount });
  } catch (error: unknown) {
    if (error instanceof Error && (error.message.includes("Authentication required") || error.message.includes("Insufficient"))) {
      return NextResponse.json({ error: "Admin access required." }, { status: 403 });
    }
    console.error("Terminate all sessions error:", error);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}
