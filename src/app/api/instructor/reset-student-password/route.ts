import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { getSession, hashPassword, generateSecurePassword } from "@/lib/auth";
import { logAudit } from "@/lib/audit-log";

export async function POST(request: Request) {
  try {
    // 1. Check authentication
    const session = await getSession();
    if (!session || session.role !== "instructor") {
      return NextResponse.json({ error: "Instructor access required." }, { status: 403 });
    }

    // 2. Get studentId from request
    const { studentId } = await request.json();
    if (!studentId) {
      return NextResponse.json({ error: "Student ID is required." }, { status: 400 });
    }

    // 3. Verify student is in one of instructor's labs
    const instructor = await db.instructor.findUnique({
      where: { id: session.userId },
      include: { instructorLabs: true },
    });
    if (!instructor) {
      return NextResponse.json({ error: "Instructor not found." }, { status: 404 });
    }

    // Collect all lab IDs the instructor is assigned to (primary + InstructorLab)
    const instructorLabIds = [
      instructor.labId,
      ...instructor.instructorLabs.map((il) => il.labId),
    ];

    const studentLab = await db.studentLab.findFirst({
      where: {
        studentId: parseInt(studentId),
        labId: { in: instructorLabIds },
      },
    });
    if (!studentLab) {
      return NextResponse.json({ error: "Student is not in your lab." }, { status: 403 });
    }

    // 4. Get the student record for audit logging
    const student = await db.student.findUnique({
      where: { id: parseInt(studentId) },
    });
    if (!student) {
      return NextResponse.json({ error: "Student not found." }, { status: 404 });
    }

    // 5. Generate new password
    const newPassword = generateSecurePassword(12);
    const hashedPassword = await hashPassword(newPassword);

    // 6. Update student password
    await db.student.update({
      where: { id: parseInt(studentId) },
      data: { password: hashedPassword },
    });

    // 7. Log the action
    await logAudit({
      type: "auth",
      action: "update",
      message: `Instructor ${instructor.displayName} reset password for student "${student.firstName} ${student.lastName}" (${student.studentId})`,
      userId: session.userId,
      userRole: "instructor",
      labId: studentLab.labId,
      metadata: { targetUserId: student.id, targetRole: "student" },
    });

    return NextResponse.json({ ok: true, newPassword });
  } catch (error: unknown) {
    console.error("Instructor password reset error:", error);
    return NextResponse.json(
      { error: "Password reset failed." },
      { status: 500 }
    );
  }
}
