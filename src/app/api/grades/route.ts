import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

export async function PUT(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }
    if (session.role !== "admin" && session.role !== "instructor") {
      return NextResponse.json({ error: "Insufficient permissions." }, { status: 403 });
    }

    const { studentId, columnId, value, instructorLabId } = await request.json();
    const numValue = value === "" || value == null ? null : parseFloat(value);

    // Verify instructor authorization: student must belong to the specified lab
    if (instructorLabId) {
      const membership = await db.studentLab.findUnique({
        where: {
          studentId_labId: {
            studentId: parseInt(studentId),
            labId: parseInt(instructorLabId),
          },
        },
      });
      if (!membership) {
        return NextResponse.json({ error: "Student is not in your lab. Only instructors can modify grades." }, { status: 403 });
      }
    } else {
      return NextResponse.json({ error: "Instructor authorization required. Only instructors can modify grades." }, { status: 403 });
    }

    await db.grade.upsert({
      where: {
        studentId_columnId: {
          studentId: parseInt(studentId),
          columnId: parseInt(columnId),
        },
      },
      update: { value: numValue },
      create: {
        studentId: parseInt(studentId),
        columnId: parseInt(columnId),
        value: numValue,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Grade save error:", error);
    return NextResponse.json({ error: "Failed to save grade." }, { status: 500 });
  }
}
