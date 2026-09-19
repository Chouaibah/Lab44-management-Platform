import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { instructorTeachesLab } from "@/lib/lab-access";

export async function PUT(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }
    if (session.role !== "admin" && session.role !== "instructor") {
      return NextResponse.json({ error: "Insufficient permissions." }, { status: 403 });
    }

    const { studentId, columnId, value } = await request.json();

    const studentIdNum = Number.parseInt(String(studentId), 10);
    const columnIdNum = Number.parseInt(String(columnId), 10);
    if (!Number.isInteger(studentIdNum) || !Number.isInteger(columnIdNum)) {
      return NextResponse.json({ error: "Valid studentId and columnId are required." }, { status: 400 });
    }

    const numValue = value === "" || value == null ? null : Number.parseFloat(String(value));
    if (numValue !== null && !Number.isFinite(numValue)) {
      return NextResponse.json({ error: "value must be a number or null." }, { status: 400 });
    }

    // The column is authoritative for which lab this grade belongs to. The lab id
    // sent by the client is not trustworthy, so it is no longer used for authz.
    const column = await db.gradeColumn.findUnique({
      where: { id: columnIdNum },
      select: { labId: true },
    });
    if (!column) {
      return NextResponse.json({ error: "Grade column not found." }, { status: 404 });
    }

    // An instructor may only touch grades in a lab they are actually assigned to.
    if (session.role === "instructor") {
      if (!(await instructorTeachesLab(session.userId, column.labId))) {
        return NextResponse.json(
          { error: "This grade column belongs to a lab you are not assigned to." },
          { status: 403 },
        );
      }
    }

    // ...and the student must be enrolled in that same lab.
    const membership = await db.studentLab.findUnique({
      where: {
        studentId_labId: {
          studentId: studentIdNum,
          labId: column.labId,
        },
      },
    });
    if (!membership) {
      return NextResponse.json(
        { error: "Student is not enrolled in the lab this column belongs to." },
        { status: 403 },
      );
    }

    await db.grade.upsert({
      where: {
        studentId_columnId: {
          studentId: studentIdNum,
          columnId: columnIdNum,
        },
      },
      update: { value: numValue },
      create: {
        studentId: studentIdNum,
        columnId: columnIdNum,
        value: numValue,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Grade save error:", error);
    return NextResponse.json({ error: "Failed to save grade." }, { status: 500 });
  }
}
