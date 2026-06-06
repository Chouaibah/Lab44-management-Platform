import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { getSession } from "@/lib/auth";
import { logAudit } from "@/lib/audit-log";

// Set or update security question for logged-in user
export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { error: "Authentication required." },
        { status: 401 }
      );
    }

    const { securityQuestion, securityAnswer } = await request.json();

    if (!securityQuestion || !securityAnswer) {
      return NextResponse.json(
        { error: "Security question and answer are required." },
        { status: 400 }
      );
    }

    if (securityAnswer.trim().length < 1) {
      return NextResponse.json(
        { error: "Security answer cannot be empty." },
        { status: 400 }
      );
    }

    // Hash the security answer for storage
    const hashedAnswer = await hash(securityAnswer.trim().toLowerCase(), 12);

    if (session.role === "student") {
      await db.student.update({
        where: { id: session.userId },
        data: {
          securityQuestion,
          securityAnswer: hashedAnswer,
        },
      });

      await logAudit({
        type: "auth",
        action: "update",
        message: `Student set their security question`,
        userId: session.userId,
        userRole: "student",
      });

      return NextResponse.json({ ok: true, message: "Security question set successfully." });
    }

    if (session.role === "instructor") {
      await db.instructor.update({
        where: { id: session.userId },
        data: {
          securityQuestion,
          securityAnswer: hashedAnswer,
        },
      });

      await logAudit({
        type: "auth",
        action: "update",
        message: `Instructor set their security question`,
        userId: session.userId,
        userRole: "instructor",
      });

      return NextResponse.json({ ok: true, message: "Security question set successfully." });
    }

    return NextResponse.json(
      { error: "Invalid user role." },
      { status: 400 }
    );
  } catch (error) {
    console.error("Set security question error:", error);
    return NextResponse.json(
      { error: "Failed to set security question." },
      { status: 500 }
    );
  }
}
