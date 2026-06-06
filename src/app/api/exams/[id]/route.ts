import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { getSession, requireRole } from "@/lib/auth";

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
    console.error("Exam get error:", error);
    return NextResponse.json({ ok: false, error: "Failed to load exam." }, { status: 500 });
  }
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
    if (title            !== undefined) updateData.title            = title.trim();
    if (description      !== undefined) updateData.description      = description;
    if (durationMinutes  !== undefined) updateData.durationMinutes  = durationMinutes;
    if (shuffleQuestions !== undefined) updateData.shuffleQuestions = shuffleQuestions;
    if (showResults      !== undefined) updateData.showResults      = showResults;
    if (maxAttempts      !== undefined) updateData.maxAttempts      = maxAttempts;
    if (passingScore     !== undefined) updateData.passingScore     = passingScore;

    if (sousGroupeId !== undefined) {
      if (sousGroupeId != null && sousGroupeId !== "" && String(sousGroupeId) !== "0") {
        const parsed = parseInt(String(sousGroupeId));
        updateData.sousGroupeId = isNaN(parsed) ? null : parsed;
      } else {
        updateData.sousGroupeId = null;
      }
    }

    if (status !== undefined) {
      updateData.status = status;
      if (status === "published" && exam.status !== "published") {
        updateData.publishedAt = new Date();
      }
    }

    if (Array.isArray(questions)) {
      const result = await db.$transaction(async (tx) => {
        await tx.examQuestion.deleteMany({ where: { examId } });
        const questionsData = questions.map((q: Record<string, unknown>, i: number) => ({
          examId,
          type:          (q.type as string)  || "mcq",
          text:          (q.text as string)  || "",
          options:       q.options ? JSON.stringify(q.options) : null,
          correctAnswer: q.correctAnswer != null ? String(q.correctAnswer) : null,
          points:        typeof q.points === "number" && (q.points as number) > 0 ? q.points as number : 1.0,
          order:         (q.order as number) ?? i,
        }));
        if (questionsData.length > 0) {
          await tx.examQuestion.createMany({ data: questionsData });
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
    console.error("Exam delete error:", error);
    return NextResponse.json({ ok: false, error: "Failed to delete exam." }, { status: 500 });
  }
}
