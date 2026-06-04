import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { logAudit } from "@/lib/audit-log";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }
    if (session.role !== "instructor") {
      return NextResponse.json({ error: "Only instructors can update announcements." }, { status: 403 });
    }

    const { id } = await params;
    const announcementId = parseInt(id);

    // Verify the announcement belongs to a lab this instructor teaches
    const announcement = await db.announcement.findUnique({
      where: { id: announcementId },
    });
    if (!announcement) {
      return NextResponse.json({ error: "Announcement not found." }, { status: 404 });
    }

    const teaching = await db.instructorLab.findUnique({
      where: { instructorId_labId: { instructorId: session.userId, labId: announcement.labId } },
    });
    if (!teaching) {
      return NextResponse.json({ error: "You can only edit announcements in your own lab." }, { status: 403 });
    }

    const data = await request.json();
    const updateData: Record<string, unknown> = {};
    if (typeof data.pinned === "boolean") updateData.pinned = data.pinned;
    if (typeof data.title === "string") updateData.title = data.title.trim();
    if (typeof data.content === "string") updateData.content = data.content.trim();
    if (typeof data.author === "string") updateData.author = data.author.trim();
    if (typeof data.isArchived === "boolean") updateData.isArchived = data.isArchived;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "No fields to update." }, { status: 400 });
    }

    await db.announcement.update({
      where: { id: announcementId },
      data: updateData,
    });

    await logAudit({
      type: "announcement",
      action: "update",
      message: `Announcement #${id} updated`,
      userId: session.userId,
      userRole: session.role,
      labId: announcement.labId,
      metadata: { id, fields: Object.keys(updateData) },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Announcement update error:", error);
    return NextResponse.json({ error: "Failed to update announcement." }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }
    if (session.role !== "instructor") {
      return NextResponse.json({ error: "Only instructors can delete announcements." }, { status: 403 });
    }

    const { id } = await params;
    const announcementId = parseInt(id);

    // Verify the announcement belongs to a lab this instructor teaches
    const announcement = await db.announcement.findUnique({
      where: { id: announcementId },
    });
    if (!announcement) {
      return NextResponse.json({ error: "Announcement not found." }, { status: 404 });
    }

    const teaching = await db.instructorLab.findUnique({
      where: { instructorId_labId: { instructorId: session.userId, labId: announcement.labId } },
    });
    if (!teaching) {
      return NextResponse.json({ error: "You can only delete announcements in your own lab." }, { status: 403 });
    }

    // Permanent delete (for archived announcements only)
    // Non-archived announcements should be archived first via PATCH
    await db.announcement.delete({ where: { id: announcementId } });

    await logAudit({
      type: "announcement",
      action: "delete",
      message: `Announcement #${id} permanently deleted`,
      userId: session.userId,
      userRole: session.role,
      labId: announcement.labId,
      metadata: { id },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Announcement delete error:", error);
    return NextResponse.json({ error: "Failed to delete announcement." }, { status: 500 });
  }
}
