import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { logAudit } from "@/lib/audit-log";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }
    if (session.role !== "admin" && session.role !== "instructor") {
      return NextResponse.json({ error: "Insufficient permissions." }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const { note } = body;

    const existing = await db.vMRequest.findUnique({ where: { id: parseInt(id) } });
    if (!existing) {
      return NextResponse.json({ error: "Request not found." }, { status: 404 });
    }

    await db.vMRequest.update({
      where: { id: parseInt(id) },
      data: {
        status: "rejected",
        note: note || existing.note,
        reviewedAt: new Date(),
      },
    });

    await logAudit({
      type: "vm",
      action: "reject",
      message: `VM request #${id} rejected for ${existing.studentName}`,
      userId: session.userId,
      userRole: session.role,
      labId: existing.labId,
      metadata: { requestId: id, studentName: existing.studentName, note: note || existing.note },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("VM request reject error:", error);
    return NextResponse.json({ error: "Failed to reject request." }, { status: 500 });
  }
}
