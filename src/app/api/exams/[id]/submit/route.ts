import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";

// POST /api/exams/[id]/submit — students only
// studentId is taken from the SESSION, never from the request body,
// preventing students from submitting on behalf of others.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Only students can submit exams
    const session = await requireRole("student");
    const studentId = session.userId;

    const { id } = await params;
    const examId  = parseInt(id);
    if (isNaN(examId)) {
      return NextResponse.json({ ok: false, error: "Invalid exam ID." }, { status: 400 });
    }

    const exam = await db.exam.findUnique({
      where: { id: examId },
      include: { questions: { orderBy: { order: "asc" } } },
    });

    if (!exam) {
      return NextResponse.json({ ok: false, error: "Exam not found." }, { status: 404 });
    }
    if (!["published", "active"].includes(exam.status)) {
      return NextResponse.json({ ok: false, error: "Exam is not available." }, { status: 400 });
    }

    // Verify student is enrolled in the exam's lab
    const enrolled = await db.studentLab.findFirst({
      where: { studentId, labId: exam.labId },
    });
    if (!enrolled) {
      return NextResponse.json({ ok: false, error: "Not enrolled in this lab." }, { status: 403 });
    }

    // Verify sous-groupe membership if the exam is restricted
    if (exam.sousGroupeId) {
      const membership = await db.sousGroupeMember.findFirst({
        where: { sousGroupeId: exam.sousGroupeId, studentId },
      });
      if (!membership) {
        return NextResponse.json({ ok: false, error: "Not a member of the required group." }, { status: 403 });
      }
    }

    // Enforce max attempts
    const existingAttempts = await db.examAttempt.count({ where: { examId, studentId } });
    if (existingAttempts >= exam.maxAttempts) {
      return NextResponse.json(
        { ok: false, error: `Maximum attempts (${exam.maxAttempts}) reached.` },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { answers } = body;

    if (!Array.isArray(answers)) {
      return NextResponse.json({ ok: false, error: "Answers must be an array." }, { status: 400 });
    }

    // Auto-grade
    type ExamQ = typeof exam.questions[number];
    const questionMap = new Map<number, ExamQ>(exam.questions.map((q) => [q.id, q]));
    let totalPoints = 0;
    let maxPoints   = 0;

    const answerData: { questionId: number; answer: string | null; pointsEarned: number }[] = [];

    for (const ans of answers) {
      const question = questionMap.get(ans.questionId as number);
      if (!question) continue;

      maxPoints += question.points;
      let pointsEarned   = 0;
      const studentAnswer = ans.answer ?? null;

      if (studentAnswer !== null && question.correctAnswer !== null) {
        switch (question.type) {
          case "mcq":
            if (String(studentAnswer) === String(question.correctAnswer)) pointsEarned = question.points;
            break;
          case "true_false":
            if (String(studentAnswer).toLowerCase() === String(question.correctAnswer).toLowerCase()) pointsEarned = question.points;
            break;
          case "short_answer":
            if (String(studentAnswer).trim().toLowerCase() === String(question.correctAnswer).trim().toLowerCase()) pointsEarned = question.points;
            break;
        }
      }

      totalPoints += pointsEarned;
      answerData.push({ questionId: question.id, answer: studentAnswer, pointsEarned });
    }

    if (maxPoints === 0) {
      maxPoints = exam.questions.reduce((sum, q) => sum + q.points, 0);
    }

    const score  = maxPoints > 0 ? Math.round((totalPoints / maxPoints) * 10000) / 100 : 0;
    const passed = exam.passingScore != null ? score >= exam.passingScore : null;

    const attempt = await db.$transaction(async (tx) => {
      return tx.examAttempt.create({
        data: {
          examId, studentId,
          attemptNumber: existingAttempts + 1,
          submittedAt:   new Date(),
          score, totalPoints, maxPoints, passed,
          answers: { create: answerData.map((a) => ({ questionId: a.questionId, answer: a.answer, pointsEarned: a.pointsEarned })) },
        },
        include: {
          answers: {
            include: { question: { select: { id: true, type: true, text: true, points: true, correctAnswer: true } } },
          },
          student: { select: { id: true, firstName: true, lastName: true, studentId: true } },
        },
      });
    });

    // If showResults is "immediate", include answers and score; otherwise only confirm submission
    const showFull = exam.showResults === "immediate";

    return NextResponse.json(
      {
        ok: true,
        attempt: {
          id:            attempt.id,
          examId:        attempt.examId,
          studentId:     attempt.studentId,
          attemptNumber: attempt.attemptNumber,
          startedAt:     attempt.startedAt.toISOString(),
          submittedAt:   attempt.submittedAt?.toISOString() ?? null,
          timeSpent:     attempt.timeSpent,
          score:         showFull ? attempt.score  : null,
          totalPoints:   showFull ? attempt.totalPoints : null,
          maxPoints:     showFull ? attempt.maxPoints  : null,
          passed:        showFull ? attempt.passed : null,
          answers: showFull
            ? attempt.answers.map((a) => ({
                id:           a.id,
                questionId:   a.questionId,
                answer:       a.answer,
                pointsEarned: a.pointsEarned,
                question:     a.question,
              }))
            : [],
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Exam submit error:", error);
    return NextResponse.json({ ok: false, error: "Failed to submit exam." }, { status: 500 });
  }
}
