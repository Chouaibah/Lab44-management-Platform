import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { getSession, requireRole } from "@/lib/auth";
import { handleAuthError } from "@/lib/api-error";

/** Statuses the rest of the app understands. */
const VALID_EXAM_STATUSES = ["draft", "published", "active", "closed"];

// GET /api/exams/[id]
// - Students: correct answers are STRIPPED, only receive their own attempt data
// - Instructors/Admin: full exam including correct answers
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ ok: false, error: "Authentication required." }, { status: 401 });
    }

    const { id } = await params;
    const examId  = parseInt(id);
    if (isNaN(examId)) {
      return NextResponse.json({ ok: false, error: "Invalid exam ID." }, { status: 400 });
    }

    const exam = await db.exam.findUnique({
      where: { id: examId },
      include: {
        questions:  { orderBy: { order: "asc" } },
        instructor: { select: { id: true, displayName: true } },
        lab:        { select: { id: true, name: true } },
        _count:     { select: { attempts: true } },
      },
    });

    if (!exam) {
      return NextResponse.json({ ok: false, error: "Exam not found." }, { status: 404 });
    }

    // Students: verify enrollment and that the exam is available to them
    if (session.role === "student") {
      const enrolled = await db.studentLab.findFirst({
        where: { studentId: session.userId, labId: exam.labId },
      });
      if (!enrolled) {
        return NextResponse.json({ ok: false, error: "Forbidden." }, { status: 403 });
      }
      if (!["published", "active"].includes(exam.status)) {
        return NextResponse.json({ ok: false, error: "Exam not available." }, { status: 403 });
      }
    }

    // Instructors: verify they own or are assigned to this exam's lab
    if (session.role === "instructor") {
      const isMember = await db.instructorLab.findFirst({
        where: { instructorId: session.userId, labId: exam.labId },
      });
      const primary = await db.instructor.findUnique({
        where: { id: session.userId }, select: { labId: true },
      });
      if (!isMember && primary?.labId !== exam.labId) {
        return NextResponse.json({ ok: false, error: "Forbidden." }, { status: 403 });
      }
    }

    const isStudent = session.role === "student";

    return NextResponse.json({
      ok: true,
      exam: {
        id:               exam.id,
        title:            exam.title,
        description:      exam.description,
        labId:            exam.labId,
        lab:              exam.lab,
        instructorId:     exam.instructorId,
        instructor:       exam.instructor,
        status:           exam.status,
        durationMinutes:  exam.durationMinutes,
        shuffleQuestions: exam.shuffleQuestions,
        showResults:      exam.showResults,
        maxAttempts:      exam.maxAttempts,
        passingScore:     exam.passingScore,
        sousGroupeId:     exam.sousGroupeId,
        attemptCount:     exam._count.attempts,
        publishedAt:      exam.publishedAt?.toISOString() ?? null,
        createdAt:        exam.createdAt.toISOString(),
        updatedAt:        exam.updatedAt.toISOString(),
        questions: exam.questions.map((q) => ({
          id:      q.id,
          type:    q.type,
          text:    q.text,
          options: q.options,
          points:  q.points,
          order:   q.order,
          // Students never receive the correct answer — they submit blind
          correctAnswer: isStudent ? undefined : q.correctAnswer,
        })),
      },
    });
  } catch (error) {
    const authResponse = handleAuthError(error);
    if (authResponse) return authResponse;
    console.error("Exam get error:", error);
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ ok: false, error: `Failed to load exam: ${msg}` }, { status: 500 });
  }
}

/** Shape used to compare an incoming question with a stored one. */
function questionSignature(
  list: Array<{
    type: string;
    text: string;
    options: string | null;
    correctAnswer: string | null;
    points: number;
    order: number;
  }>,
): string {
  return JSON.stringify(
    list.map((q) => [q.type, q.text, q.options, q.correctAnswer, q.points, q.order]),
  );
}

// PATCH /api/exams/[id] — instructor or admin only, instructor must own the exam
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

    // Instructors can only edit their own exams
    if (session.role === "instructor" && exam.instructorId !== session.userId) {
      return NextResponse.json({ ok: false, error: "Forbidden." }, { status: 403 });
    }

    const body = await request.json();
    const {
      title, description, status, durationMinutes,
      shuffleQuestions, showResults, maxAttempts,
      passingScore, sousGroupeId, questions,
    } = body;

    const updateData: Record<string, unknown> = {};
    if (title            !== undefined) updateData.title            = String(title).trim();
    if (description      !== undefined) updateData.description      = description;
    if (shuffleQuestions !== undefined) updateData.shuffleQuestions = shuffleQuestions;
    if (showResults      !== undefined) updateData.showResults      = showResults;

    if (durationMinutes !== undefined) {
      const parsed = Number.parseInt(String(durationMinutes), 10);
      if (!Number.isInteger(parsed) || parsed <= 0) {
        return NextResponse.json(
          { ok: false, error: "durationMinutes must be a positive integer." },
          { status: 400 },
        );
      }
      updateData.durationMinutes = parsed;
    }

    if (maxAttempts !== undefined) {
      const parsed = Number.parseInt(String(maxAttempts), 10);
      if (!Number.isInteger(parsed) || parsed < 1) {
        // A value below 1 would make `existingAttempts >= maxAttempts` always
        // true and permanently lock students out of the exam.
        return NextResponse.json(
          { ok: false, error: "maxAttempts must be an integer of at least 1." },
          { status: 400 },
        );
      }
      updateData.maxAttempts = parsed;
    }

    if (passingScore !== undefined) {
      if (passingScore === null || passingScore === "") {
        updateData.passingScore = null;
      } else {
        const parsed = Number.parseFloat(String(passingScore));
        if (!Number.isFinite(parsed) || parsed < 0 || parsed > 20) {
          return NextResponse.json(
            { ok: false, error: "passingScore must be between 0 and 20 (scores are on a 0–20 scale)." },
            { status: 400 },
          );
        }
        updateData.passingScore = parsed;
      }
    }

    if (sousGroupeId !== undefined) {
      if (sousGroupeId != null && sousGroupeId !== "" && String(sousGroupeId) !== "0") {
        const parsed = parseInt(String(sousGroupeId));
        updateData.sousGroupeId = isNaN(parsed) ? null : parsed;
      } else {
        updateData.sousGroupeId = null;
      }
    }

    if (status !== undefined) {
      if (!VALID_EXAM_STATUSES.includes(String(status))) {
        return NextResponse.json(
          { ok: false, error: `status must be one of: ${VALID_EXAM_STATUSES.join(", ")}.` },
          { status: 400 },
        );
      }
      updateData.status = status;
      if (status === "published" && exam.status !== "published") {
        updateData.publishedAt = new Date();
      }
    }

    if (Array.isArray(questions)) {
      // Normalise exactly the way the create path stores a question, so the
      // incoming list can be compared with what is already persisted.
      const incoming = questions.map((q: Record<string, unknown>, i: number) => ({
        type:          (q.type as string)  || "mcq",
        text:          (q.text as string)  || "",
        options:       q.options ? JSON.stringify(q.options) : null,
        correctAnswer: q.correctAnswer != null ? String(q.correctAnswer) : null,
        points:        typeof q.points === "number" && (q.points as number) > 0 ? (q.points as number) : 1.0,
        order:         (q.order as number) ?? i,
      }));

      const existing = await db.examQuestion.findMany({
        where:   { examId },
        orderBy: { order: "asc" },
        select: {
          type: true, text: true, options: true,
          correctAnswer: true, points: true, order: true,
          _count: { select: { answers: true } },
        },
      });

      const questionsUnchanged =
        questionSignature(existing) === questionSignature(incoming);

      // Replacing questions deletes the old rows, and `ExamAnswer` cascades on
      // question delete — which would silently erase the answers of every past
      // attempt. Refuse the replacement instead; other fields still save.
      if (!questionsUnchanged) {
        const recordedAnswers = existing.reduce((sum, q) => sum + q._count.answers, 0);
        if (recordedAnswers > 0) {
          return NextResponse.json(
            {
              ok: false,
              error:
                "This exam already has graded attempts, so its questions can no longer be replaced " +
                "(doing so would delete the recorded answers). Create a new exam instead.",
            },
            { status: 409 },
          );
        }
      }

      const result = await db.$transaction(async (tx) => {
        if (!questionsUnchanged) {
          await tx.examQuestion.deleteMany({ where: { examId } });
          if (incoming.length > 0) {
            await tx.examQuestion.createMany({
              data: incoming.map((q) => ({ ...q, examId })),
            });
          }
        }
        return tx.exam.update({
          where: { id: examId }, data: updateData,
          include: {
            questions:  { orderBy: { order: "asc" } },
            instructor: { select: { id: true, displayName: true } },
            lab:        { select: { id: true, name: true } },
          },
        });
      });
      return NextResponse.json({ ok: true, exam: result });
    }

    const updated = await db.exam.update({
      where: { id: examId }, data: updateData,
      include: {
        questions:  { orderBy: { order: "asc" } },
        instructor: { select: { id: true, displayName: true } },
        lab:        { select: { id: true, name: true } },
      },
    });
    return NextResponse.json({ ok: true, exam: updated });
  } catch (error) {
    const authResponse = handleAuthError(error);
    if (authResponse) return authResponse;
    console.error("Exam update error:", error);
    return NextResponse.json({ ok: false, error: "Failed to update exam." }, { status: 500 });
  }
}

// DELETE /api/exams/[id] — instructor (own exams) or admin only
export async function DELETE(
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

    // Instructors can only delete their own exams
    if (session.role === "instructor" && exam.instructorId !== session.userId) {
      return NextResponse.json({ ok: false, error: "Forbidden." }, { status: 403 });
    }

    await db.exam.delete({ where: { id: examId } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const authResponse = handleAuthError(error);
    if (authResponse) return authResponse;
    console.error("Exam delete error:", error);
    return NextResponse.json({ ok: false, error: "Failed to delete exam." }, { status: 500 });
  }
}
