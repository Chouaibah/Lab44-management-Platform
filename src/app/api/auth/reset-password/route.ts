import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { compare, hash } from "bcryptjs";
import { logAudit } from "@/lib/audit-log";
import { checkAuthRateLimit } from "@/lib/rate-limit";

// Self-service password reset using security question
export async function POST(request: Request) {
  try {
    // The only credential here is a security answer, and this route is public
    // (the proxy skips /api/auth/*), so it must be rate limited.
    const clientIp = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown";
    await checkAuthRateLimit(`auth:reset:${clientIp}`);

    const { userRole, identifier, securityAnswer, newPassword } = await request.json();

    if (!userRole || !identifier || !newPassword) {
      return NextResponse.json(
        { error: "All fields are required." },
        { status: 400 }
      );
    }

    if (typeof newPassword !== "string" || newPassword.length < 6) {
      return NextResponse.json(
        { error: "New password must be at least 6 characters." },
        { status: 400 }
      );
    }

    // A missing/non-string answer must not crash the comparison below.
    const normalizedAnswer =
      typeof securityAnswer === "string" ? securityAnswer.trim().toLowerCase() : "";

    if (userRole === "student") {
      // Find student by studentId
      const student = await db.student.findUnique({
        where: { studentId: identifier.trim() },
      });

      if (!student) {
        return NextResponse.json(
          { error: "Student not found." },
          { status: 404 }
        );
      }

      // Check if security question is set
      if (!student.securityQuestion || !student.securityAnswer) {
        return NextResponse.json(
          { error: "No security question set for this account. Please contact an administrator to reset your password." },
          { status: 400 }
        );
      }

      // Verify security answer
      const answerMatch = await compare(normalizedAnswer, student.securityAnswer);
      if (!answerMatch) {
        await logAudit({
          type: "auth",
          action: "update",
          message: `Failed password reset attempt for student "${student.studentId}" - incorrect security answer`,
          userId: student.id,
          userRole: "student",
        });
        return NextResponse.json(
          { error: "Incorrect security answer." },
          { status: 401 }
        );
      }

      // Hash and save new password
      const hashedPassword = await hash(newPassword, 12);
      await db.student.update({
        where: { id: student.id },
        data: { password: hashedPassword },
      });

      await logAudit({
        type: "auth",
        action: "update",
        message: `Student "${student.firstName} ${student.lastName}" (${student.studentId}) reset their password via security question`,
        userId: student.id,
        userRole: "student",
      });

      return NextResponse.json({ ok: true, message: "Password reset successfully." });
    }

    if (userRole === "instructor") {
      // Find instructor by username
      const instructor = await db.instructor.findUnique({
        where: { username: identifier.trim() },
      });

      if (!instructor) {
        return NextResponse.json(
          { error: "Instructor not found." },
          { status: 404 }
        );
      }

      // Check if security question is set
      if (!instructor.securityQuestion || !instructor.securityAnswer) {
        return NextResponse.json(
          { error: "No security question set for this account. Please contact an administrator to reset your password." },
          { status: 400 }
        );
      }

      // Verify security answer
      const answerMatch = await compare(normalizedAnswer, instructor.securityAnswer);
      if (!answerMatch) {
        await logAudit({
          type: "auth",
          action: "update",
          message: `Failed password reset attempt for instructor "${instructor.username}" - incorrect security answer`,
          userId: instructor.id,
          userRole: "instructor",
        });
        return NextResponse.json(
          { error: "Incorrect security answer." },
          { status: 401 }
        );
      }

      // Hash and save new password
      const hashedPassword = await hash(newPassword, 12);
      await db.instructor.update({
        where: { id: instructor.id },
        data: { password: hashedPassword },
      });

      await logAudit({
        type: "auth",
        action: "update",
        message: `Instructor "${instructor.username}" reset their password via security question`,
        userId: instructor.id,
        userRole: "instructor",
      });

      return NextResponse.json({ ok: true, message: "Password reset successfully." });
    }

    return NextResponse.json(
      { error: "Invalid user role." },
      { status: 400 }
    );
  } catch (error) {
    if (error instanceof Error && error.message.includes("Too many")) {
      return NextResponse.json({ error: error.message }, { status: 429 });
    }
    console.error("Password reset error:", error);
    return NextResponse.json(
      { error: "Password reset failed." },
      { status: 500 }
    );
  }
}
