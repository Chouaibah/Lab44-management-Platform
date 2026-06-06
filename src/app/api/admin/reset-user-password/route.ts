import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { requireRole } from "@/lib/auth";
import { logAudit } from "@/lib/audit-log";

// Admin resets a user's password
export async function POST(request: Request) {
  try {
    const session = await requireRole("admin");

    const { userId, userRole, newPassword } = await request.json();

    if (!userId || !userRole || !newPassword) {
      return NextResponse.json(
        { error: "User ID, user role, and new password are required." },
        { status: 400 }
      );
    }

    if (newPassword.length < 6) {
      return NextResponse.json(
        { error: "New password must be at least 6 characters." },
        { status: 400 }
      );
    }

    const hashedPassword = await hash(newPassword, 12);

    if (userRole === "student") {
      const student = await db.student.findUnique({
        where: { id: Number(userId) },
      });

      if (!student) {
        return NextResponse.json(
          { error: "Student not found." },
          { status: 404 }
        );
      }

      await db.student.update({
        where: { id: student.id },
        data: { password: hashedPassword },
      });

      await logAudit({
        type: "auth",
        action: "update",
        message: `Admin reset password for student "${student.firstName} ${student.lastName}" (${student.studentId})`,
        userId: session.userId,
        userRole: "admin",
        metadata: { targetUserId: student.id, targetRole: "student" },
      });

      return NextResponse.json({ ok: true, message: "Password reset successfully." });
    }

    if (userRole === "instructor") {
      const instructor = await db.instructor.findUnique({
        where: { id: Number(userId) },
      });

      if (!instructor) {
        return NextResponse.json(
          { error: "Instructor not found." },
          { status: 404 }
        );
      }

      await db.instructor.update({
        where: { id: instructor.id },
        data: { password: hashedPassword },
      });

      await logAudit({
        type: "auth",
        action: "update",
        message: `Admin reset password for instructor "${instructor.username}" (${instructor.displayName})`,
        userId: session.userId,
        userRole: "admin",
        metadata: { targetUserId: instructor.id, targetRole: "instructor" },
      });

      return NextResponse.json({ ok: true, message: "Password reset successfully." });
    }

    return NextResponse.json(
      { error: "Invalid user role." },
      { status: 400 }
    );
  } catch (error: unknown) {
    if (error instanceof Error && error.message.includes("Authentication required")) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }
    if (error instanceof Error && error.message.includes("Insufficient permissions")) {
      return NextResponse.json({ error: "Admin access required." }, { status: 403 });
    }
    console.error("Admin password reset error:", error);
    return NextResponse.json(
      { error: "Password reset failed." },
      { status: 500 }
    );
  }
}
