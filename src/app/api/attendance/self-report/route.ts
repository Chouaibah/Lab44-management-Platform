import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const { studentId, date, labId, reason } = await request.json();
    if (!studentId || !date || !reason?.trim()) {
      return NextResponse.json({ error: "studentId, date, and reason are required." }, { status: 400 });
    }

    // S18: Students can only self-report for themselves
    if (session.role === "student" && session.userId !== parseInt(studentId)) {
      return NextResponse.json({ error: "You can only report attendance for yourself." }, { status: 403 });
    }

    const student = await db.student.findUnique({ where: { id: parseInt(studentId) } });
    if (!student) {
      return NextResponse.json({ error: "Student not found." }, { status: 404 });
    }

    // Determine the labId to use
    let effectiveLabId: number | null = null;

    if (labId) {
      effectiveLabId = parseInt(String(labId));
      // Verify student is enrolled in this lab
      const membership = await db.studentLab.findUnique({
        where: { studentId_labId: { studentId: parseInt(studentId), labId: effectiveLabId } },
      });
      if (!membership) {
        return NextResponse.json({ error: "You are not enrolled in the specified lab." }, { status: 403 });
      }
    } else if (session.role === "student") {
      // For students without a specified labId, try to find their single lab
      const studentLabs = await db.studentLab.findMany({
        where: { studentId: parseInt(studentId) },
      });
      if (studentLabs.length === 0) {
        return NextResponse.json({ error: "You are not enrolled in any lab." }, { status: 400 });
      }
      if (studentLabs.length === 1) {
        effectiveLabId = studentLabs[0].labId;
      } else {
        return NextResponse.json({ error: "You are enrolled in multiple labs. Please specify a labId." }, { status: 400 });
      }
    } else {
      return NextResponse.json({ error: "labId is required." }, { status: 400 });
    }

    const existing = await db.attendance.findUnique({
      where: {
        studentId_date_labId: {
          studentId: parseInt(studentId),
          date,
          labId: effectiveLabId,
        },
      },
    });

    const selfReportNote = `[Self-Report] ${reason.trim()}`;
    let updatedRecord;

    if (existing) {
      const currentNote = existing.note || '';
      const hasSelfReport = currentNote.includes('[Self-Report]');
      const newNote = hasSelfReport
        ? currentNote.replace(/\[Self-Report\][^\[]*/, selfReportNote)
        : currentNote
        ? `${currentNote} | ${selfReportNote}`
        : selfReportNote;

      updatedRecord = await db.attendance.update({
        where: { id: existing.id },
        data: { note: newNote },
      });
    } else {
      updatedRecord = await db.attendance.create({
        data: {
          studentId: parseInt(studentId),
          date,
          labId: effectiveLabId,
          status: "absent",
          note: selfReportNote,
        },
      });
    }

    return NextResponse.json({
      ok: true,
      id: updatedRecord.id,
      note: updatedRecord.note,
    });
  } catch (error) {
    console.error("Attendance self-report error:", error);
    return NextResponse.json({ error: "Failed to submit self-report." }, { status: 500 });
  }
}
