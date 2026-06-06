import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { verifyPassword, createSession, setSessionCookie, recordLogin } from "@/lib/auth";
import { checkAuthRateLimit } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit-log";

export async function POST(request: Request) {
  try {
    const clientIp = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown";
    await checkAuthRateLimit(`auth:instructor:${clientIp}`);

    const { username, password } = await request.json();
    if (!username || !password) {
      return NextResponse.json({ error: "Username and password are required." }, { status: 400 });
    }

    const instructor = await db.instructor.findUnique({
      where: { username: username.trim() },
      include: { lab: true, instructorLabs: { select: { labId: true } } },
    });

    if (!instructor) {
      return NextResponse.json({ error: "Invalid username or password." }, { status: 401 });
    }

    const isHashed = instructor.password.startsWith("$2");
    const valid = isHashed
      ? await verifyPassword(password, instructor.password)
      : password === instructor.password;

    if (!valid) {
      return NextResponse.json({ error: "Invalid username or password." }, { status: 401 });
    }

    if (!isHashed) {
      const { hashPassword } = await import("@/lib/auth");
      const hashed = await hashPassword(instructor.password);
      await db.instructor.update({ where: { id: instructor.id }, data: { password: hashed } });
    }

    const { token, jti } = await createSession({
      role: "instructor",
      userId: instructor.id,
      username: instructor.username,
      labId: instructor.labId,
    });
    await setSessionCookie(token);

    const ipAddress = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || null;
    const userAgent = request.headers.get("user-agent") || null;
    await recordLogin(instructor.id, "instructor", instructor.displayName, jti, ipAddress, userAgent);
    await logAudit({
      type: "auth",
      action: "login",
      message: `Instructor "${instructor.username}" logged in`,
      userId: instructor.id,
      userRole: "instructor",
      labId: instructor.labId,
    });

    return NextResponse.json({
      ok: true,
      instructor: {
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
      role: "instructor",
    });
  } catch (error: unknown) {
    if (error instanceof Error && error.message.includes("Too many")) {
      return NextResponse.json({ error: error.message }, { status: 429 });
    }
    console.error("Instructor auth error:", error);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}
