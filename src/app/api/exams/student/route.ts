import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";

// GET /api/exams/student — students only
// studentId comes from the SESSION, never from query params.
// The labId query param is optional and used only to filter further.
export async function GET(request: Request) {
  try {
    // Only students can call this endpoint
    const session   = await requireRole("student");
    const studentId = session.userId;

    const { searchParams } = new URL(request.url);
    const labId = searchParams.get("labId");

    if (labId && isNaN(parseInt(labId))) {
      return NextResponse.json({ ok: false, error: "Invalid labId." }, { status: 400 });
    }

    // Verify student's lab memberships
    const studentLabs  = await db.studentLab.findMany({
      where: { studentId }, select: { labId: true },
    });
    const studentLabIds = studentLabs.map((sl) => sl.labId);

    if (studentLabIds.length === 0) {
      return NextResponse.json({ ok: false, error: "Not enrolled in any lab." }, { status: 403 });
    }

    // If a specific labId was provided, verify the student is enrolled
    if (labId) {
      const parsed = parseInt(labId);
      if (!studentLabIds.includes(parsed)) {
        return NextResponse.json({ ok: false, error: "Not enrolled in this lab." }, { status: 403 });
      }
    }

    // Sous-groupe memberships (for filtering group-restricted exams)
    const memberships = await db.sousGroupeMember.findMany({
      where: { studentId }, select: { sousGroupeId: true },
    });
    const sousGroupeIds = memberships.map((m) => m.sousGroupeId);

    const targetLabIds = labId ? [parseInt(labId)] : studentLabIds;

    const exams = await db.exam.findMany({
      where: { labId: { in: targetLabIds }, status: { in: ["published", "active"] } },
      include: {
        questions: { select: { id: true, type: true, points: true }, orderBy: { order: "asc" } },
        instructor: { select: { id: true, displayName: true } },
        attempts: {
          where: { studentId },
          orderBy: { attemptNumber: "desc" },
          select: {
            id: true, attemptNumber: true, startedAt: true, submittedAt: true,
            timeSpent: true, score: true, totalPoints: true, maxPoints: true, passed: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Filter out exams the student's sous-groupe doesn't have access to
    const accessible = exams.filter((exam) =>
      exam.sousGroupeId == null || sousGroupeIds.includes(exam.sousGroupeId)
    );

    const result = accessible.map((exam) => {
      const maxPts           = exam.questions.reduce((sum, q) => sum + q.points, 0);
      const bestScore        = exam.attempts.length > 0 ? Math.max(...exam.attempts.map((a) => a.score ?? 0)) : null;
      const attemptsRemaining = Math.max(0, exam.maxAttempts - exam.attempts.length);

      return {
        id:               exam.id,
        title:            exam.title,
        description:      exam.description,
        labId:            exam.labId,
        instructorId:     exam.instructorId,
        instructor:       exam.instructor,
        status:           exam.status,
        durationMinutes:  exam.durationMinutes,
        shuffleQuestions: exam.shuffleQuestions,
        showResults:      exam.showResults,
        maxAttempts:      exam.maxAttempts,
        passingScore:     exam.passingScore,
        publishedAt:      exam.publishedAt?.toISOString() ?? null,
        totalMaxPoints:   maxPts,
        questionCount:    exam.questions.length,
        attemptsRemaining,
        hasAttempts:      exam.attempts.length > 0,
        bestScore,
        attempts: exam.attempts.map((a) => ({
          id:            a.id,
          attemptNumber: a.attemptNumber,
          startedAt:     a.startedAt.toISOString(),
          submittedAt:   a.submittedAt?.toISOString() ?? null,
          timeSpent:     a.timeSpent,
          score:         a.score,
          totalPoints:   a.totalPoints,
          maxPoints:     a.maxPoints,
          passed:        a.passed,
        })),
        createdAt: exam.createdAt.toISOString(),
        updatedAt: exam.updatedAt.toISOString(),
      };
    });

    return NextResponse.json({ ok: true, exams: result });
  } catch (error) {
    console.error("Student exams list error:", error);
    return NextResponse.json({ ok: false, error: "Failed to load student exams." }, { status: 500 });
  }
}
