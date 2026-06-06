import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const announcementId = parseInt(id);
    if (isNaN(announcementId)) {
      return NextResponse.json({ error: "Invalid announcement ID." }, { status: 400 });
    }

    const reactions = await db.announcementReaction.findMany({
      where: { announcementId },
      include: {
        student: {
          select: { id: true, firstName: true, lastName: true, studentId: true },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json(
      reactions.map((r) => ({
        id: r.id,
        announcementId: r.announcementId,
        studentId: r.studentId,
        reaction: r.reaction,
        createdAt: r.createdAt.toISOString(),
        student: r.student
          ? {
              id: r.student.id,
              firstName: r.student.firstName,
              lastName: r.student.lastName,
              studentId: r.student.studentId,
            }
          : undefined,
      }))
    );
  } catch (error) {
    console.error("Reactions list error:", error);
    return NextResponse.json({ error: "Failed to load reactions." }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }
    if (session.role !== "student") {
      return NextResponse.json({ error: "Only students can react." }, { status: 403 });
    }

    const { id } = await params;
    const announcementId = parseInt(id);
    if (isNaN(announcementId)) {
      return NextResponse.json({ error: "Invalid announcement ID." }, { status: 400 });
    }

    const body = await request.json();
    const validReactions = ["acknowledged", "seen", "thumbs_up", "thumbs_down", "question"];
    const reaction = validReactions.includes(body.reaction) ? body.reaction : "acknowledged";

    // Verify announcement exists
    const announcement = await db.announcement.findUnique({ where: { id: announcementId } });
    if (!announcement) {
      return NextResponse.json({ error: "Announcement not found." }, { status: 404 });
    }

    // Upsert: update if exists, create if not
    const existing = await db.announcementReaction.findUnique({
      where: {
        announcementId_studentId: {
          announcementId,
          studentId: session.userId,
        },
      },
    });

    let result;
    if (existing) {
      result = await db.announcementReaction.update({
        where: { id: existing.id },
        data: { reaction },
      });
    } else {
      result = await db.announcementReaction.create({
        data: {
          announcementId,
          studentId: session.userId,
          reaction,
        },
      });
    }

    return NextResponse.json({
      ok: true,
      id: result.id,
      reaction: result.reaction,
    });
  } catch (error) {
    console.error("Reaction create/update error:", error);
    return NextResponse.json({ error: "Failed to save reaction." }, { status: 500 });
  }
}
