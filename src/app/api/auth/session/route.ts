import { NextResponse } from "next/server";
import { getSession, filterCredentialFields } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ role: null, student: null, instructor: null });
    }

  let student: Record<string, unknown> | null = null;
  let instructor: Record<string, unknown> | null = null;

    if (session.role === "student") {
      const s = await db.student.findUnique({ where: { id: session.userId } });
      if (s) {
        student = {
          id: s.id,
          firstName: s.firstName,
          lastName: s.lastName,
          studentId: s.studentId,
          createdAt: s.createdAt.toISOString(),
          notes: s.notes,
        };
      }
    } else if (session.role === "instructor") {
      const i = await db.instructor.findUnique({
        where: { id: session.userId },
        include: { instructorLabs: { select: { labId: true } } },
      });
      if (i) {
        instructor = {
          id: i.id,
          username: i.username,
          displayName: i.displayName,
          email: i.email,
          labId: i.labId,
          labIds: [i.labId, ...i.instructorLabs.map(il => il.labId).filter(id => id !== i.labId)],
          showGrades: i.showGrades,
          createdAt: i.createdAt.toISOString(),
        };
      }
    }

    const result: Record<string, unknown> = {
      role: session.role,
      student,
      instructor,
      isImpersonating: !!(session.originalRole),
      originalRole: session.originalRole || undefined,
      originalUserId: session.originalUserId || undefined,
    };
    return NextResponse.json(filterCredentialFields(result));
  } catch {
    return NextResponse.json({ role: null, student: null, instructor: null });
  }
}
