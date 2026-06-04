import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { logAudit } from "@/lib/audit-log";

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const labIdParam = searchParams.get("labId");

    if (!labIdParam) {
      return NextResponse.json({ error: "labId query parameter is required." }, { status: 400 });
    }

    const labId = parseInt(labIdParam);

    // Students: only see announcements for labs they're enrolled in
    if (session.role === "student") {
      const enrollment = await db.studentLab.findUnique({
        where: { studentId_labId: { studentId: session.userId, labId } },
      });
      if (!enrollment) {
        return NextResponse.json({ error: "You are not enrolled in this lab." }, { status: 403 });
      }
    }

    // Instructors: only see announcements for labs they teach
    // Check both the many-to-many instructorLabs table AND the instructor's primary labId
    if (session.role === "instructor") {
      const instructor = await db.instructor.findUnique({
        where: { id: session.userId },
        select: { labId: true },
      });
      const isPrimaryLab = instructor?.labId === labId;
      if (!isPrimaryLab) {
        const teaching = await db.instructorLab.findUnique({
          where: { instructorId_labId: { instructorId: session.userId, labId } },
        });
        if (!teaching) {
          return NextResponse.json({ error: "You do not teach this lab." }, { status: 403 });
        }
      }
    }

    // For students: only non-archived. For instructors: all (including archived).
    const showArchived = session.role === "instructor" || session.role === "admin";
    const where: any = { labId };
    if (!showArchived) {
      where.isArchived = false;
    }

    const announcements = await db.announcement.findMany({
      where,
      orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
      include: {
        reactions: {
          include: {
            student: {
              select: { id: true, firstName: true, lastName: true, studentId: true },
            },
          },
        },
      },
    });

    return NextResponse.json(
      announcements.map((a) => {
        // Calculate reaction counts
        const reactionCounts: Record<string, number> = {};
        for (const r of a.reactions) {
          reactionCounts[r.reaction] = (reactionCounts[r.reaction] || 0) + 1;
        }

        // Find current user's reaction (students only)
        let userReaction: string | null = null;
        if (session.role === "student") {
          const userReact = a.reactions.find((r) => r.studentId === session.userId);
          userReaction = userReact?.reaction || null;
        }

        return {
          id: a.id,
          title: a.title,
          content: a.content,
          author: a.author,
          pinned: a.pinned,
          isArchived: a.isArchived,
          labId: a.labId,
          createdAt: a.createdAt.toISOString(),
          reactionCounts,
          userReaction,
          reactions: a.reactions.map((r) => ({
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
          })),
        };
      })
    );
  } catch (error) {
    console.error("Announcements list error:", error);
    return NextResponse.json({ error: "Failed to load announcements." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }
    // Only instructors can create announcements (not admin — each instructor manages their own lab)
    if (session.role !== "instructor") {
      return NextResponse.json({ error: "Only instructors can create announcements." }, { status: 403 });
    }

    const { title, content, author, pinned, labId } = await request.json();
    if (!title || !content) {
      return NextResponse.json({ error: "Title and content required." }, { status: 400 });
    }

    // labId is mandatory — instructor must specify which lab
    if (!labId) {
      return NextResponse.json({ error: "labId is required." }, { status: 400 });
    }

    // Verify instructor teaches this lab (primary lab OR instructorLabs entry)
    const instructor = await db.instructor.findUnique({
      where: { id: session.userId },
      select: { labId: true },
    });
    const isPrimaryLab = instructor?.labId === parseInt(labId);
    if (!isPrimaryLab) {
      const teaching = await db.instructorLab.findUnique({
        where: { instructorId_labId: { instructorId: session.userId, labId: parseInt(labId) } },
      });
      if (!teaching) {
        return NextResponse.json({ error: "You do not teach this lab." }, { status: 403 });
      }
    }

    const announcement = await db.announcement.create({
      data: {
        title: title.trim(),
        content: content.trim(),
        author: author?.trim() || session.displayName || "Instructor",
        pinned: !!pinned,
        labId: parseInt(labId),
      },
    });

    await logAudit({
      type: "announcement",
      action: "create",
      message: `Announcement created: "${title.trim()}"`,
      userId: session.userId,
      userRole: session.role,
      labId: parseInt(labId),
      metadata: { id: announcement.id },
    });

    return NextResponse.json({ ok: true, id: announcement.id });
  } catch (error) {
    console.error("Announcement create error:", error);
    return NextResponse.json({ error: "Failed to create announcement." }, { status: 500 });
  }
}
