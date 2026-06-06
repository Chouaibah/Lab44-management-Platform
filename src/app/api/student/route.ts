import { db } from "@/lib/db";
import { getSettingsMap } from "@/lib/settings-cache";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

export async function GET(_request: Request) {
  try {
    // Authentication is mandatory — the old code had NO auth check and sent all data to anyone
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }
    if (session.role !== "student") {
      return NextResponse.json({ error: "Students only." }, { status: 403 });
    }

    const studentId = session.userId;

    // Fetch only data scoped to this student
    const [student, myLabMemberships, settingsMap] = await Promise.all([
      db.student.findUnique({ where: { id: studentId } }),
      db.studentLab.findMany({ where: { studentId } }),
      getSettingsMap(),
    ]);

    if (!student) {
      return NextResponse.json({ error: "Student not found." }, { status: 404 });
    }

    const myLabIds = myLabMemberships.map((sl) => sl.labId);
    const hideGradesFromStudents = settingsMap["hide_grades_from_students"] === "true";

    // Load columns, grades, labs, and instructors — scoped to this student's labs only
    const [columns, grades, labs, instructors] = await Promise.all([
      db.gradeColumn.findMany({
        where: { labId: { in: myLabIds } },
        include: { lab: { select: { name: true } } },
      }),
      hideGradesFromStudents
        ? Promise.resolve([])
        : db.grade.findMany({ where: { studentId } }),
      db.lab.findMany({ where: { id: { in: myLabIds } } }),
      db.instructor.findMany({
        where: { labId: { in: myLabIds } },
        select: { id: true, displayName: true, labId: true, showGrades: true },
      }),
    ]);

    return NextResponse.json({
      hideGradesFromStudents,
      // Only this student — no other students' data
      students: [
        {
          id: student.id,
          firstName: student.firstName,
          lastName: student.lastName,
          studentId: student.studentId,
          labIds: myLabIds,
        },
      ],
      columns: columns.map((c) => ({
        id: c.id,
        name: c.name,
        labId: c.labId,
        labName: c.lab.name,
      })),
      grades: grades.map((g) => ({
        studentId: g.studentId,
        columnId: g.columnId,
        value: g.value,
      })),
      studentLabs: myLabMemberships.map((sl) => ({
        studentId: sl.studentId,
        labId: sl.labId,
      })),
      instructors,
      labs: labs.map((l) => ({ id: l.id, name: l.name })),
    });
  } catch (error) {
    console.error("Student data error:", error);
    return NextResponse.json({ error: "Failed to load data." }, { status: 500 });
  }
}
