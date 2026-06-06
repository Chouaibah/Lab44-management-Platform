import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getSettingsMap } from "@/lib/settings-cache";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const students = await db.student.findMany({
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    });
    const columns = await db.gradeColumn.findMany({ orderBy: { id: "asc" }, include: { lab: { select: { name: true } } } });
    const grades = await db.grade.findMany();
    const attendance = await db.attendance.findMany({
      orderBy: [{ date: "desc" }, { studentId: "asc" }],
    });
    const studentLabs = await db.studentLab.findMany();
    const instructors = await db.instructor.findMany({
      include: { lab: true, instructorLabs: { select: { labId: true } } },
    });
    const labs = await db.lab.findMany();

    const result: Record<string, unknown> = {
      students: students.map((s) => ({
        id: s.id,
        firstName: s.firstName,
        lastName: s.lastName,
        studentId: s.studentId,
        labIds: studentLabs.filter(sl => sl.studentId === s.id).map(sl => sl.labId),
        createdAt: s.createdAt.toISOString(),
        notes: s.notes,
      })),
      columns: columns.map((c) => ({
        id: c.id,
        name: c.name,
        weight: c.weight,
        labId: c.labId,
        labName: c.lab.name,
        createdAt: c.createdAt.toISOString(),
      })),
      grades,
      attendance: attendance.map((r) => ({
        id: r.id,
        studentId: r.studentId,
        labId: r.labId,
        date: r.date,
        status: r.status,
        note: r.note,
        markedBy: r.markedBy,
      })),
      studentLabs: studentLabs.map((sl) => ({
        studentId: sl.studentId,
        labId: sl.labId,
        joinedAt: sl.joinedAt.toISOString(),
      })),
      instructors: instructors.map((i) => ({
        id: i.id,
        username: i.username,
        displayName: i.displayName,
        email: i.email,
        labId: i.labId,
        labIds: [i.labId, ...i.instructorLabs.map(il => il.labId).filter(id => id !== i.labId)],
        labName: i.lab?.name || null,
        showGrades: i.showGrades,
        createdAt: i.createdAt.toISOString(),
      })),
      labs: labs.map((l) => ({
        id: l.id,
        name: l.name,
        description: l.description,
        level: l.level,
        hasPassword: !!l.password,
        autoApprove: l.autoApprove,
        createdAt: l.createdAt.toISOString(),
      })),
    };

    if (session.role === "student") {
      const studentId = session.userId;
      const myLabIds = studentLabs
        .filter((sl) => sl.studentId === studentId)
        .map((sl) => sl.labId);

      // Respect global hide_grades_from_students and per-instructor showGrades
      const settingsMap = await getSettingsMap();
      const hideGradesFromStudents = settingsMap["hide_grades_from_students"] === "true";

      const visibleLabIds = new Set<number>();
      if (!hideGradesFromStudents) {
        for (const labId of myLabIds) {
          const labInstructors = instructors.filter((i) => {
            const iLabIds = [i.labId, ...i.instructorLabs.map(il => il.labId)];
            return iLabIds.includes(labId);
          });
          if (labInstructors.length === 0 || labInstructors.some((i) => i.showGrades)) {
            visibleLabIds.add(labId);
          }
        }
      }

      // Filter every collection to only this student's data
      result.students = students
        .filter((s) => s.id === studentId)
        .map((s) => ({
          id: s.id,
          firstName: s.firstName,
          lastName: s.lastName,
          studentId: s.studentId,
          labIds: studentLabs.filter((sl) => sl.studentId === s.id).map((sl) => sl.labId),
          createdAt: s.createdAt.toISOString(),
          // Notes are intentionally omitted — admin-only field
        }));

      // Only grade columns that belong to this student's labs
      result.columns = columns
        .filter((c) => myLabIds.includes(c.labId))
        .map((c) => ({
          id: c.id,
          name: c.name,
          weight: c.weight,
          labId: c.labId,
          labName: c.lab.name,
          createdAt: c.createdAt.toISOString(),
        }));

      result.grades = grades
        .filter((g) => g.studentId === studentId)
        .filter((g) => {
          const col = columns.find((c) => c.id === g.columnId);
          return col && visibleLabIds.has(col.labId);
        });
      result.attendance = attendance
        .filter((a) => a.studentId === studentId)
        .map((r) => ({
          id: r.id,
          studentId: r.studentId,
          labId: r.labId,
          date: r.date,
          status: r.status,
          note: r.note,
          markedBy: r.markedBy,
        }));

      // Only memberships for this student
      result.studentLabs = studentLabs
        .filter((sl) => sl.studentId === studentId)
        .map((sl) => ({
          studentId: sl.studentId,
          labId: sl.labId,
          joinedAt: sl.joinedAt.toISOString(),
        }));

      // Instructors: only those assigned to the student's labs (via primary lab or InstructorLab), with limited fields
      result.instructors = instructors
        .filter((i) => {
          const iLabIds = [i.labId, ...i.instructorLabs.map(il => il.labId)];
          return myLabIds.some(labId => iLabIds.includes(labId));
        })
        .map((i) => ({
          id: i.id,
          displayName: i.displayName,
          labId: i.labId,
          labIds: [i.labId, ...i.instructorLabs.map(il => il.labId).filter(id => id !== i.labId)],
          labName: i.lab?.name || null,
          showGrades: i.showGrades,
        }));
    }

    if (session.role === "instructor") {
      // Get all lab IDs this instructor is assigned to (primary + InstructorLab)
      const myLabIds = (() => {
        const me = instructors.find(i => i.id === session.userId);
        if (!me) return [session.labId].filter(Boolean) as number[];
        return [me.labId, ...me.instructorLabs.map(il => il.labId)];
      })();

      // Get student IDs in those labs
      const labStudentIds = new Set(
        studentLabs.filter(sl => myLabIds.includes(sl.labId)).map(sl => sl.studentId)
      );

      // Filter attendance to only records in instructor's labs
      result.attendance = attendance
        .filter((a) => myLabIds.includes(a.labId))
        .map((r) => ({
          id: r.id,
          studentId: r.studentId,
          labId: r.labId,
          date: r.date,
          status: r.status,
          note: r.note,
          markedBy: r.markedBy,
        }));

      // Filter students to only those in instructor's labs
      result.students = students
        .filter((s) => labStudentIds.has(s.id))
        .map((s) => ({
          id: s.id,
          firstName: s.firstName,
          lastName: s.lastName,
          studentId: s.studentId,
          labIds: studentLabs.filter(sl => sl.studentId === s.id && myLabIds.includes(sl.labId)).map(sl => sl.labId),
          createdAt: s.createdAt.toISOString(),
          notes: s.notes,
        }));

      // Filter grade columns and grades to only those in instructor's labs
      result.columns = columns
        .filter((c) => myLabIds.includes(c.labId))
        .map((c) => ({
          id: c.id,
          name: c.name,
          weight: c.weight,
          labId: c.labId,
          labName: c.lab.name,
          createdAt: c.createdAt.toISOString(),
        }));

      const visibleColumnIds = new Set(
        columns.filter((c) => myLabIds.includes(c.labId)).map((c) => c.id)
      );
      result.grades = grades.filter((g) => visibleColumnIds.has(g.columnId));

      // Filter studentLabs to only those in instructor's labs
      result.studentLabs = studentLabs
        .filter((sl) => myLabIds.includes(sl.labId))
        .map((sl) => ({
          studentId: sl.studentId,
          labId: sl.labId,
          joinedAt: sl.joinedAt.toISOString(),
        }));
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Data fetch error:", error);
    return NextResponse.json({ error: "Failed to load data." }, { status: 500 });
  }
}
