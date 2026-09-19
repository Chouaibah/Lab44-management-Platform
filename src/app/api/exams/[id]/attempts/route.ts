import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { handleAuthError } from "@/lib/api-error";

// GET /api/exams/[id]/attempts — instructor or admin only
// Instructors can only view attempts for exams in their own labs
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireRole("instructor", "admin");

    const { id } = await params;
    const examId  = parseInt(id);
    if (isNaN(examId)) {
      return NextResponse.json({ ok: false, error: "Invalid exam ID." }, { status: 400 });
    }

    const exam = await db.exam.findUnique({ where: { id: examId } });
    if (!exam) {
      return NextResponse.json({ ok: false, error: "Exam not found." }, { status: 404 });
    }

    // Instructors can only view attempts for their own exams
    if (session.role === "instructor" && exam.instructorId !== session.userId) {
      return NextResponse.json({ ok: false, error: "Forbidden." }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get("studentId");
    const where: Record<string, unknown> = { examId };

    if (studentId) {
      const parsed = parseInt(studentId);
      if (isNaN(parsed)) {
        return NextResponse.json({ ok: false, error: "Invalid studentId." }, { status: 400 });
      }
      where.studentId = parsed;
    }

    const attempts = await db.examAttempt.findMany({
      where,
      include: {
        student: { select: { id: true, firstName: true, lastName: true, studentId: true } },
        answers: {
          include: {
            question: { select: { id: true, type: true, text: true, points: true, correctAnswer: true } },
          },
        },
      },
      orderBy: [{ submittedAt: "desc" }],
    });

    const result = attempts.map((a) => ({
      id:            a.id,
      examId:        a.examId,
      studentId:     a.studentId,
      student:       a.student,
      attemptNumber: a.attemptNumber,
      startedAt:     a.startedAt.toISOString(),
      submittedAt:   a.submittedAt?.toISOString() ?? null,
      timeSpent:     a.timeSpent,
      score:         a.score,
      totalPoints:   a.totalPoints,
      maxPoints:     a.maxPoints,
      passed:        a.passed,
      answers:       a.answers.map((ans) => ({
        id:           ans.id,
        questionId:   ans.questionId,
        answer:       ans.answer,
        pointsEarned: ans.pointsEarned,
        question:     ans.question,
      })),
    }));

    return NextResponse.json({ ok: true, attempts: result });
  } catch (error) {
    const authResponse = handleAuthError(error);
    if (authResponse) return authResponse;
    console.error("Exam attempts list error:", error);
    return NextResponse.json({ ok: false, error: "Failed to load exam attempts." }, { status: 500 });
  }
}
