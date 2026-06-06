import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { getSession, requireRole } from "@/lib/auth";

// GET /api/exams - List exams with optional filters
// - Students: only published/active exams in their enrolled labs
// - Instructors/Admin: filtered by labId / instructorId query params
export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ ok: false, error: "Authentication required." }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const labId        = searchParams.get("labId");
    const instructorId = searchParams.get("instructorId");
    const studentId    = searchParams.get("studentId");

    const where: Record<string, unknown> = {};

    // ── Student path ───────────────────────────────────────────────────────
    if (session.role === "student") {
      // Students can only see published/active exams in their own labs.
      // Ignore any studentId / instructorId params from the URL —
      // always use the session identity.
      const studentLabs = await db.studentLab.findMany({
        where: { studentId: session.userId },
        select: { labId: true },
      });
      const labIds = studentLabs.map((sl) => sl.labId);

      where.labId  = labId
        ? (() => {
            const parsed = parseInt(labId);
            if (isNaN(parsed) || !labIds.includes(parsed)) return { in: [] };
            return parsed;
          })()
        : { in: labIds };
      where.status = { in: ["published", "active"] };

    // ── Instructor / Admin path ────────────────────────────────────────────
    } else {
      if (labId) {
        const parsed = parseInt(labId);
        if (isNaN(parsed)) {
          return NextResponse.json({ ok: false, error: "Invalid labId." }, { status: 400 });
        }
        // Instructors can only query labs they belong to
        if (session.role === "instructor") {
          const membership = await db.instructorLab.findFirst({
            where: { instructorId: session.userId, labId: parsed },
          });
          const primary = await db.instructor.findUnique({
            where: { id: session.userId }, select: { labId: true },
          });
          if (!membership && primary?.labId !== parsed) {
            return NextResponse.json({ ok: true, exams: [] });
          }
        }
        where.labId = parsed;
      }

      if (instructorId) {
        const parsed = parseInt(instructorId);
        if (isNaN(parsed)) {
          return NextResponse.json({ ok: false, error: "Invalid instructorId." }, { status: 400 });
        }
        // Instructors can only query their own exams
        if (session.role === "instructor" && parsed !== session.userId) {
          return NextResponse.json({ ok: true, exams: [] });
        }
        where.instructorId = parsed;
      }
    }

    // Ignore stray studentId param — use session for identity
    void studentId;

    const exams = await db.exam.findMany({
      where,
      include: {
        questions: { select: { id: true } },
        attempts:  { select: { id: true } },
        instructor: { select: { id: true, displayName: true } },
        lab:        { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const result = exams.map((exam) => ({
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
      publishedAt:      exam.publishedAt?.toISOString() ?? null,
      questionCount:    exam.questions.length,
      attemptCount:     exam.attempts.length,
      createdAt:        exam.createdAt.toISOString(),
      updatedAt:        exam.updatedAt.toISOString(),
    }));

    return NextResponse.json({ ok: true, exams: result });
  } catch (error) {
    console.error("Exams list error:", error);
    return NextResponse.json({ ok: false, error: "Failed to load exams." }, { status: 500 });
  }
}

// POST /api/exams - Create exam (instructor or admin only)
export async function POST(request: Request) {
  try {
    const session = await requireRole("instructor", "admin");

    const body = await request.json();
    const {
      title, description, labId, instructorId,
      durationMinutes, shuffleQuestions, showResults,
      maxAttempts, passingScore, sousGroupeId, questions,
    } = body;

    if (!title?.trim()) {
      return NextResponse.json({ ok: false, error: "Title is required." }, { status: 400 });
    }
    if (!labId) {
      return NextResponse.json({ ok: false, error: "Lab ID is required." }, { status: 400 });
    }
    if (!instructorId) {
      return NextResponse.json({ ok: false, error: "Instructor ID is required." }, { status: 400 });
    }

    const parsedLabId        = parseInt(String(labId));
    const parsedInstructorId = parseInt(String(instructorId));

    // Instructors can only create exams for themselves
    if (session.role === "instructor" && parsedInstructorId !== session.userId) {
      return NextResponse.json({ ok: false, error: "Forbidden." }, { status: 403 });
    }

    // Verify lab + instructor exist
    const [lab, instructor] = await Promise.all([
      db.lab.findUnique({ where: { id: parsedLabId } }),
      db.instructor.findUnique({ where: { id: parsedInstructorId } }),
    ]);
    if (!lab)        return NextResponse.json({ ok: false, error: "Lab not found."        }, { status: 404 });
    if (!instructor) return NextResponse.json({ ok: false, error: "Instructor not found." }, { status: 404 });

    // Build + validate questions
    const questionsData = Array.isArray(questions)
      ? questions.map((q: Record<string, unknown>, index: number) => ({
          type:          (q.type as string)  || "mcq",
          text:          (q.text as string)  || "",
          options:       q.options ? JSON.stringify(q.options) : null,
          correctAnswer: q.correctAnswer != null ? String(q.correctAnswer) : null,
          points:        typeof q.points === "number" && (q.points as number) > 0 ? q.points as number : 1.0,
          order:         (q.order as number) ?? index,
        }))
      : [];

    if (questionsData.length === 0) {
      return NextResponse.json({ ok: false, error: "At least one question is required." }, { status: 400 });
    }

    for (let i = 0; i < questionsData.length; i++) {
      const q = questionsData[i];
      if (!q.text.trim()) {
        return NextResponse.json({ ok: false, error: `Question ${i + 1}: text is required.` }, { status: 400 });
      }
      if (q.type === "mcq") {
        let opts: string[] = [];
        try { opts = q.options ? JSON.parse(q.options) : []; } catch { /* ignore */ }
        if (opts.filter((o: string) => o?.trim()).length < 2) {
          return NextResponse.json({ ok: false, error: `Question ${i + 1}: MCQ needs at least 2 options.` }, { status: 400 });
        }
      }
    }

    let parsedSousGroupeId: number | null = null;
    if (sousGroupeId != null && sousGroupeId !== "" && String(sousGroupeId) !== "0") {
      parsedSousGroupeId = parseInt(String(sousGroupeId));
      if (isNaN(parsedSousGroupeId)) {
        return NextResponse.json({ ok: false, error: "Invalid sous-groupe ID." }, { status: 400 });
      }
    }

    const exam = await db.exam.create({
      data: {
        title: title.trim(), description: description || null,
        labId: parsedLabId, instructorId: parsedInstructorId,
        durationMinutes: durationMinutes ?? 30,
        shuffleQuestions: shuffleQuestions ?? false,
        showResults: showResults ?? "immediate",
        maxAttempts: maxAttempts ?? 1,
        passingScore: passingScore ?? null,
        sousGroupeId: parsedSousGroupeId,
        questions: { create: questionsData },
      },
      include: {
        questions:  { orderBy: { order: "asc" } },
        instructor: { select: { id: true, displayName: true } },
        lab:        { select: { id: true, name: true } },
      },
    });

    return NextResponse.json({ ok: true, exam }, { status: 201 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to create exam.";
    console.error("Exam create error:", error);
    return NextResponse.json({ ok: false, error: msg.slice(0, 200) }, { status: 500 });
  }
}
