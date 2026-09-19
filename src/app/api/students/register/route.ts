import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { logAudit } from "@/lib/audit-log";
import { checkRegistrationRateLimit } from "@/lib/rate-limit";

// Register a new student
export async function POST(request: Request) {
  try {
    // This endpoint is public (the proxy skips it), so it needs its own limiter —
    // otherwise it can be used to mass-create accounts. The registration bucket is
    // deliberately generous so a class behind one IP is not locked out.
    const clientIp = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown";
    await checkRegistrationRateLimit(`register:${clientIp}`);

    // Check if signup is enabled
    const signupSetting = await db.setting.findUnique({
      where: { key: "signup_enabled" },
    });
    if (!signupSetting || signupSetting.value !== "true") {
      return NextResponse.json(
        { error: "Registration is currently disabled." },
        { status: 403 }
      );
    }

    const { firstName, lastName, studentId, password, securityQuestion, securityAnswer } = await request.json();
    if (!firstName || !lastName || !studentId) {
      return NextResponse.json({ error: "All fields are required." }, { status: 400 });
    }

    // Hash password if provided
    const hashedPassword = password ? await hash(password, 12) : null;

    // Hash security answer if provided
    const hashedSecurityAnswer = securityAnswer
      ? await hash(securityAnswer.trim().toLowerCase(), 12)
      : null;

    const student = await db.student.create({
      data: {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        studentId: studentId.trim(),
        password: hashedPassword,
        securityQuestion: securityQuestion || null,
        securityAnswer: hashedSecurityAnswer,
      },
    });

    await logAudit({
      type: "student",
      action: "create",
      message: `Student registered: ${firstName.trim()} ${lastName.trim()} (${studentId.trim()})`,
      userId: student.id,
      userRole: "student",
      metadata: { studentId: studentId.trim(), hasPassword: !!password, hasSecurityQuestion: !!securityQuestion },
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
  } catch (error: unknown) {
    const err = error as { code?: string; message?: string };
    if (err.code === "P2002") {
      return NextResponse.json({ error: "Student ID already registered." }, { status: 409 });
    }
    if (err.message?.includes("Too many")) {
      return NextResponse.json({ error: err.message }, { status: 429 });
    }
    console.error("Register error:", error);
    return NextResponse.json({ error: "Registration failed." }, { status: 500 });
  }
}
