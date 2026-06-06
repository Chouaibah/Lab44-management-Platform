import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { compare } from "bcryptjs";
import { createSession, setSessionCookie, recordLogin } from "@/lib/auth";
import { checkAuthRateLimit } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit-log";

export async function POST(request: Request) {
  try {
    const clientIp = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown";
    await checkAuthRateLimit(`auth:student:${clientIp}`);

    const body = await request.json();
    const { firstName, lastName, studentId, password } = body;

    // ─── Mode 1: Password login (studentId + password) ───
    if (studentId && password) {
      const student = await db.student.findUnique({
        where: { studentId: studentId.trim() },
      });

      if (!student) {
        return NextResponse.json({ error: "Student not found." }, { status: 404 });
      }

      if (!student.password) {
        return NextResponse.json(
          { error: "This account has no password set. Please use full login with your name." },
          { status: 400 }
        );
      }

      const valid = await compare(password, student.password);
      if (!valid) {
        return NextResponse.json({ error: "Invalid password." }, { status: 401 });
      }

      const { token, jti } = await createSession({
        role: "student",
        userId: student.id,
        username: student.studentId,
      });
      await setSessionCookie(token);

      const ipAddress = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || null;
      const userAgent = request.headers.get("user-agent") || null;
      await recordLogin(student.id, "student", `${student.firstName} ${student.lastName}`, jti, ipAddress, userAgent);
      await logAudit({
        type: "auth",
        action: "login",
        message: `Student "${student.firstName} ${student.lastName}" logged in (password)`,
        userId: student.id,
        userRole: "student",
      });

      return NextResponse.json({
        ok: true,
        student: {
          id: student.id,
          firstName: student.firstName,
          lastName: student.lastName,
          studentId: student.studentId,
          createdAt: student.createdAt.toISOString(),
        },
      });
    }

    // ─── Mode 2: Legacy login (firstName + lastName + studentId) ───
    if (firstName && lastName && studentId) {
      const student = await db.student.findFirst({
        where: {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          studentId: studentId.trim(),
        },
      });

      if (!student) {
        return NextResponse.json({ error: "Student not found." }, { status: 404 });
      }

      // If student has a password set, they must use password login
      if (student.password) {
        return NextResponse.json(
          { error: "This account requires a password. Please use quick login with your Student ID and password." },
          { status: 400 }
        );
      }

      const { token: token2, jti: jti2 } = await createSession({
        role: "student",
        userId: student.id,
        username: student.studentId,
      });
      await setSessionCookie(token2);

      const ipAddress = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || null;
      const userAgent = request.headers.get("user-agent") || null;
      await recordLogin(student.id, "student", `${student.firstName} ${student.lastName}`, jti2, ipAddress, userAgent);
      await logAudit({
        type: "auth",
        action: "login",
        message: `Student "${student.firstName} ${student.lastName}" logged in (legacy)`,
        userId: student.id,
        userRole: "student",
      });

      return NextResponse.json({
        ok: true,
        student: {
          id: student.id,
          firstName: student.firstName,
          lastName: student.lastName,
          studentId: student.studentId,
          createdAt: student.createdAt.toISOString(),
        },
      });
    }

    // Missing required fields
    return NextResponse.json(
      { error: "Please provide Student ID and password, or full name and Student ID." },
      { status: 400 }
    );
  } catch (error: unknown) {
    if (error instanceof Error && error.message.includes("Too many")) {
      return NextResponse.json({ error: error.message }, { status: 429 });
    }
    console.error("Student auth error:", error);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}
