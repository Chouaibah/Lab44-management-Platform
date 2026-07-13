import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";

// PATCH /api/exams/[id]/grade — manual grading, instructor or admin only
// Instructors can only grade attempts for their own exams
export async function PATCH(
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

    // Instructors can only grade their own exams
    if (session.role === "instructor" && exam.instructorId !== session.userId) {
      return NextResponse.json({ ok: false, error: "Forbidden." }, { status: 403 });
    }

    const body = await request.json();
    const { attemptId, grades } = body;

    if (!attemptId) {
      return NextResponse.json({ ok: false, error: "attemptId is required." }, { status: 400 });
    }

    const parsedAttemptId = parseInt(String(attemptId));
    if (isNaN(parsedAttemptId)) {
      return NextResponse.json({ ok: false, error: "Invalid attemptId." }, { status: 400 });
    }

    if (!Array.isArray(grades) || grades.length === 0) {
      return NextResponse.json(
        { ok: false, error: "grades must be a non-empty array of { answerId, pointsEarned } objects." },
        { status: 400 }
      );
    }

    const attempt = await db.examAttempt.findFirst({ where: { id: parsedAttemptId, examId } });
    if (!attempt) {
      return NextResponse.json({ ok: false, error: "Attempt not found for this exam." }, { status: 404 });
    }

    await db.$transaction(async (tx) => {
      for (const g of grades) {
        const answerId    = parseInt(String(g.answerId));
        const pointsEarned = parseFloat(String(g.pointsEarned));

        if (isNaN(answerId) || isNaN(pointsEarned) || pointsEarned < 0) {
          throw new Error(`Invalid grade entry: answerId=${g.answerId}, pointsEarned=${g.pointsEarned}`);
        }

        const answer = await tx.examAnswer.findFirst({ where: { id: answerId, attemptId: parsedAttemptId } });
        if (!answer) throw new Error(`Answer ${answerId} not found in attempt ${parsedAttemptId}`);

        await tx.examAnswer.update({ where: { id: answerId }, data: { pointsEarned } });
      }

      // Recalculate attempt totals
      const allAnswers  = await tx.examAnswer.findMany({
        where:   { attemptId: parsedAttemptId },
        include: { question: { select: { points: true } } },
      });
      const totalPoints = allAnswers.reduce((sum, a) => sum + (a.pointsEarned ?? 0), 0);
      const maxPoints   = allAnswers.reduce((sum, a) => sum + (a.question?.points ?? 0), 0);
      const score       = maxPoints > 0 ? Math.round((totalPoints / maxPoints) * 20 * 100) / 100 : 0;
      const passed      = score >= 10;

      await tx.examAttempt.update({
        where: { id: parsedAttemptId },
        data:  { totalPoints, maxPoints, score, passed },
      });
    });

    const updated = await db.examAttempt.findUnique({
      where:   { id: parsedAttemptId },
      include: {
        answers: {
          include: {
            question: { select: { id: true, type: true, text: true, points: true, correctAnswer: true, options: true } },
          },
        },
        student: { select: { id: true, firstName: true, lastName: true, studentId: true } },
      },
    });

    return NextResponse.json({
      ok: true,
      attempt: {
        id:            updated!.id,
        examId:        updated!.examId,
        studentId:     updated!.studentId,
        student:       updated!.student,
        attemptNumber: updated!.attemptNumber,
        startedAt:     updated!.startedAt.toISOString(),
        submittedAt:   updated!.submittedAt?.toISOString() ?? null,
        timeSpent:     updated!.timeSpent,
        score:         updated!.score,
        totalPoints:   updated!.totalPoints,
        maxPoints:     updated!.maxPoints,
        passed:        updated!.passed,
        answers:       updated!.answers.map((a) => ({
          id:           a.id,
          questionId:   a.questionId,
          answer:       a.answer,
          pointsEarned: a.pointsEarned,
          question:     a.question,
        })),
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to update grades.";
    console.error("Grade update error:", error);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
