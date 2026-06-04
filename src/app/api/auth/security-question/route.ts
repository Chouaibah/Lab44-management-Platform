import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { checkAuthRateLimit } from "@/lib/rate-limit";

// Uniform "not found" response — same shape as a real missing-question response
// to prevent distinguishing between a non-existent user and a user without a question.
const NOT_FOUND_RESPONSE = NextResponse.json({
  ok: true,
  hasSecurityQuestion: false,
  securityQuestion: null,
});

// Get security question for a user (used in password reset flow)
export async function POST(request: Request) {
  try {
    const clientIp =
      request.headers.get("x-forwarded-for") ||
      request.headers.get("x-real-ip") ||
      "unknown";
    await checkAuthRateLimit(`auth:security-question:${clientIp}`);

    const { userRole, identifier } = await request.json();

    if (!userRole || !identifier) {
      return NextResponse.json(
        { error: "User role and identifier are required." },
        { status: 400 }
      );
    }

    if (userRole === "student") {
      const student = await db.student.findUnique({
        where: { studentId: identifier.trim() },
      });

      // Return the same shape whether the user exists or not (prevents enumeration)
      if (!student || !student.securityQuestion) {
        return NOT_FOUND_RESPONSE;
      }

      return NextResponse.json({
        ok: true,
        hasSecurityQuestion: true,
        securityQuestion: student.securityQuestion,
      });
    }

    if (userRole === "instructor") {
      const instructor = await db.instructor.findUnique({
        where: { username: identifier.trim() },
      });

      // Return the same shape whether the user exists or not (prevents enumeration)
      if (!instructor || !instructor.securityQuestion) {
        return NOT_FOUND_RESPONSE;
      }

      return NextResponse.json({
        ok: true,
        hasSecurityQuestion: true,
        securityQuestion: instructor.securityQuestion,
      });
    }

    return NextResponse.json(
      { error: "Invalid user role." },
      { status: 400 }
    );
  } catch (error) {
    console.error("Security question fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch security question." },
      { status: 500 }
    );
  }
}
