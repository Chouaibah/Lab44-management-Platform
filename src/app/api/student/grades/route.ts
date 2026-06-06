import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }
    if (session.role !== "student") {
      return NextResponse.json({ error: "Insufficient permissions." }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const studentIdParam = searchParams.get("studentId");

    if (!studentIdParam) {
      return NextResponse.json({
        error: "Student ID required",
        message: "Please provide a studentId query parameter"
      }, { status: 400 });
    }

    const studentId = parseInt(studentIdParam);
    if (isNaN(studentId)) {
      return NextResponse.json({ error: "Invalid student ID" }, { status: 400 });
    }

    // Students can only view their own grades
    if (session.userId !== studentId) {
      return NextResponse.json({ error: "You can only view your own grades." }, { status: 403 });
    }

    // Get student
    const student = await db.student.findUnique({
      where: { id: studentId },
    });

    if (!student) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }

    // Get student's labs
    const studentLabs = await db.studentLab.findMany({
      where: { studentId },
    });
    const labIds = studentLabs.map(sl => sl.labId);

    // Get all labs
    const labs = await db.lab.findMany({
      where: { id: { in: labIds } },
    });

    // Get instructors for these labs
    const instructors = await db.instructor.findMany({
      where: { labId: { in: labIds } },
    });

    // Get grade columns for these labs
    const columns = await db.gradeColumn.findMany({
      where: { labId: { in: labIds } },
      include: { lab: { select: { name: true } } },
    });

    // Get student's grades
    const grades = await db.grade.findMany({
      where: {
        studentId,
        columnId: { in: columns.map(c => c.id) },
      },
    });

    // Check global hide setting
    const hideSetting = await db.setting.findUnique({
      where: { key: "hide_grades_from_students" },
    });
    const hideGradesFromStudents = hideSetting?.value === "true";

    // Build per-lab data
    const labData = labs.map(lab => {
      const labInstructors = instructors.filter(i => i.labId === lab.id);
      const showGrades = hideGradesFromStudents
        ? false
        : labInstructors.length === 0 || labInstructors.some(i => i.showGrades);

      const labColumns = columns.filter(c => c.labId === lab.id);
      const labGrades = labColumns.map(col => {
        const grade = grades.find(g => g.columnId === col.id);
        return {
          columnId: col.id,
          value: grade?.value ?? null,
        };
      });

      const gradedValues = labGrades
        .filter(g => g.value !== null)
        .map(g => g.value as number);

      // Simple average
      const simpleAverage = gradedValues.length > 0
        ? gradedValues.reduce((a, b) => a + b, 0) / gradedValues.length
        : null;

      // Weighted average
      let weightedAverage: number | null = null;
      if (gradedValues.length > 0) {
        let totalWeight = 0;
        let weightedSum = 0;
        for (const col of labColumns) {
          const grade = labGrades.find(g => g.columnId === col.id);
          if (grade?.value !== null && grade?.value !== undefined) {
            const w = col.weight || 1.0;
            weightedSum += (grade.value as number) * w;
            totalWeight += w;
          }
        }
        weightedAverage = totalWeight > 0 ? weightedSum / totalWeight : null;
      }

      return {
        id: lab.id,
        name: lab.name,
        columns: labColumns.map(c => ({ id: c.id, name: c.name, weight: c.weight || 1.0 })),
        grades: showGrades
          ? labGrades
          : labGrades.map(g => ({ columnId: g.columnId, value: null })),
        average: showGrades ? (weightedAverage ?? simpleAverage) : null,
        simpleAverage: showGrades ? simpleAverage : null,
        weightedAverage: showGrades ? weightedAverage : null,
        showGrades,
      };
    });

    // Calculate overall average (only for visible labs) - weighted
    const visibleLabs = labData.filter(l => l.showGrades);
    const allGradedPairs = visibleLabs.flatMap(lab => {
      const labCols = columns.filter(c => c.labId === lab.id);
      return lab.grades
        .filter(g => g.value !== null)
        .map(g => {
          const col = labCols.find(c => c.id === g.columnId);
          return { value: g.value as number, weight: col?.weight || 1.0 };
        });
    });
    const overallWeightedAverage = allGradedPairs.length > 0
      ? allGradedPairs.reduce((sum, p) => sum + p.value * p.weight, 0) /
        allGradedPairs.reduce((sum, p) => sum + p.weight, 0)
      : null;

    // Simple overall average
    const allGradedValues = visibleLabs.flatMap(lab =>
      lab.grades.filter(g => g.value !== null).map(g => g.value as number)
    );
    const overallSimpleAverage = allGradedValues.length > 0
      ? allGradedValues.reduce((a, b) => a + b, 0) / allGradedValues.length
      : null;

    const overallAverage = overallWeightedAverage ?? overallSimpleAverage;

    // Determine message
    let message: string | undefined;
    if (hideGradesFromStudents) {
      message = "Grades are currently hidden by the administrator.";
    } else if (labIds.length === 0) {
      message = "You are not enrolled in any labs yet. Go to your dashboard and join a lab.";
    } else if (visibleLabs.length === 0) {
      message = `Your instructor(s) for ${labData.filter(l => !l.showGrades).map(l => l.name).join(', ')} have not enabled grade visibility.`;
    }

    return NextResponse.json({
      labs: labData,
      overallAverage,
      overallSimpleAverage,
      overallWeightedAverage,
      anyVisible: visibleLabs.length > 0,
      message: visibleLabs.length === 0 ? message : undefined,
    });
  } catch (error) {
    console.error("Student grades error:", error);
    return NextResponse.json({ error: "Failed to load grades." }, { status: 500 });
  }
}
