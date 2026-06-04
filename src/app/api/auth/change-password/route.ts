import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { compare, hash } from "bcryptjs";
import { getSession } from "@/lib/auth";
import { logAudit } from "@/lib/audit-log";

// Change password for logged-in user
export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { error: "Authentication required." },
        { status: 401 }
      );
    }

    const { currentPassword, newPassword } = await request.json();

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { error: "Current password and new password are required." },
        { status: 400 }
      );
    }

    if (newPassword.length < 6) {
      return NextResponse.json(
        { error: "New password must be at least 6 characters." },
        { status: 400 }
      );
    }

    if (currentPassword === newPassword) {
      return NextResponse.json(
        { error: "New password must be different from current password." },
        { status: 400 }
      );
    }

    if (session.role === "student") {
      const student = await db.student.findUnique({
        where: { id: session.userId },
      });

      if (!student) {
        return NextResponse.json(
          { error: "Student not found." },
          { status: 404 }
        );
      }

      if (!student.password) {
        return NextResponse.json(
          { error: "No password set for this account. Please contact an administrator." },
          { status: 400 }
        );
      }

      const valid = await compare(currentPassword, student.password);
      if (!valid) {
        return NextResponse.json(
          { error: "Current password is incorrect." },
          { status: 401 }
        );
      }

      const hashedPassword = await hash(newPassword, 12);
      await db.student.update({
        where: { id: student.id },
        data: { password: hashedPassword },
      });

      await logAudit({
        type: "auth",
        action: "update",
        message: `Student "${student.firstName} ${student.lastName}" (${student.studentId}) changed their password`,
        userId: student.id,
        userRole: "student",
      });

      return NextResponse.json({ ok: true, message: "Password changed successfully." });
    }

    if (session.role === "instructor") {
      const instructor = await db.instructor.findUnique({
        where: { id: session.userId },
      });

      if (!instructor) {
        return NextResponse.json(
          { error: "Instructor not found." },
          { status: 404 }
        );
      }

      // Handle both hashed and plaintext passwords
      const isHashed = instructor.password.startsWith("$2");
      const valid = isHashed
        ? await compare(currentPassword, instructor.password)
        : currentPassword === instructor.password;

      if (!valid) {
        return NextResponse.json(
          { error: "Current password is incorrect." },
          { status: 401 }
        );
      }

      const hashedPassword = await hash(newPassword, 12);
      await db.instructor.update({
        where: { id: instructor.id },
        data: { password: hashedPassword },
      });

      await logAudit({
        type: "auth",
        action: "update",
        message: `Instructor "${instructor.username}" changed their password`,
        userId: instructor.id,
        userRole: "instructor",
        labId: instructor.labId,
      });

      return NextResponse.json({ ok: true, message: "Password changed successfully." });
    }

    return NextResponse.json(
      { error: "Invalid user role for password change." },
      { status: 400 }
    );
  } catch (error) {
    console.error("Change password error:", error);
    return NextResponse.json(
      { error: "Password change failed." },
      { status: 500 }
    );
  }
}
