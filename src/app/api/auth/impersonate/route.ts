import { NextResponse } from "next/server";
import { getSession, createSession, setSessionCookie, requireRole, recordLogin } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST(request: Request) {
  try {
    // Verify the requesting user is an admin
    const session = await requireRole("admin");

    // Prevent nested impersonation
    if (session.originalRole) {
      return NextResponse.json(
        { error: "Cannot impersonate while already impersonating." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { userId, userRole } = body as { userId: number; userRole: "student" | "instructor" };

    if (!userId || !userRole || !["student", "instructor"].includes(userRole)) {
      return NextResponse.json(
        { error: "userId and userRole ('student' or 'instructor') are required." },
        { status: 400 }
      );
    }

    if (userRole === "student") {
      const student = await db.student.findUnique({ where: { id: userId } });
      if (!student) {
        return NextResponse.json({ error: "Student not found." }, { status: 404 });
      }

      const { token, jti } = await createSession({
        role: "student",
        userId: student.id,
        username: student.studentId,
        originalRole: "admin",
        originalUserId: session.userId,
      });
      await setSessionCookie(token);

      // Log the impersonation
      await recordLogin(student.id, "student", `${student.firstName} ${student.lastName}`, jti);
      await db.activityLog.create({
        data: {
          type: "impersonation",
          message: `Admin #${session.userId} impersonated student ${student.firstName} ${student.lastName} (${student.studentId})`,
          userId: String(session.userId),
          userRole: "admin",
        },
      });

      return NextResponse.json({
        ok: true,
        impersonated: true,
        role: "student",
        user: {
          id: student.id,
          firstName: student.firstName,
          lastName: student.lastName,
          studentId: student.studentId,
          createdAt: student.createdAt.toISOString(),
          notes: student.notes,
        },
      });
    } else {
      const instructor = await db.instructor.findUnique({
        where: { id: userId },
        include: { lab: true, instructorLabs: { select: { labId: true } } },
      });
      if (!instructor) {
        return NextResponse.json({ error: "Instructor not found." }, { status: 404 });
      }

      const { token, jti } = await createSession({
        role: "instructor",
        userId: instructor.id,
        username: instructor.username,
        labId: instructor.labId,
        originalRole: "admin",
        originalUserId: session.userId,
      });
      await setSessionCookie(token);

      // Log the impersonation
      await recordLogin(instructor.id, "instructor", instructor.displayName, jti);
      await db.activityLog.create({
        data: {
          type: "impersonation",
          message: `Admin #${session.userId} impersonated instructor ${instructor.displayName} (${instructor.username})`,
          userId: String(session.userId),
          userRole: "admin",
        },
      });

      return NextResponse.json({
        ok: true,
        impersonated: true,
        role: "instructor",
        user: {
          id: instructor.id,
          username: instructor.username,
          displayName: instructor.displayName,
          email: instructor.email,
          labId: instructor.labId,
          labIds: [instructor.labId, ...instructor.instructorLabs.map(il => il.labId).filter(id => id !== instructor.labId)],
          labName: instructor.lab?.name || null,
          showGrades: instructor.showGrades,
          createdAt: instructor.createdAt.toISOString(),
        },
      });
    }
  } catch (error: unknown) {
    if (error instanceof Error && error.message.includes("Authentication required")) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }
    if (error instanceof Error && error.message.includes("Insufficient permissions")) {
      return NextResponse.json({ error: "Admin access required." }, { status: 403 });
    }
    console.error("Impersonation error:", error);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}
