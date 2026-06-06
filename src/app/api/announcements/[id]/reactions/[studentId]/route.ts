import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; studentId: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const { id, studentId } = await params;
    const announcementId = parseInt(id);
    const sId = parseInt(studentId);
    if (isNaN(announcementId) || isNaN(sId)) {
      return NextResponse.json({ error: "Invalid parameters." }, { status: 400 });
    }

    // Students can only remove their own reactions; admins/instructors can remove any
    if (session.role === "student" && session.userId !== sId) {
      return NextResponse.json({ error: "You can only remove your own reaction." }, { status: 403 });
    }

    const existing = await db.announcementReaction.findUnique({
      where: {
        announcementId_studentId: {
          announcementId,
          studentId: sId,
        },
      },
    });

    if (!existing) {
      return NextResponse.json({ error: "Reaction not found." }, { status: 404 });
    }

    await db.announcementReaction.delete({
      where: { id: existing.id },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Reaction delete error:", error);
    return NextResponse.json({ error: "Failed to delete reaction." }, { status: 500 });
  }
}
