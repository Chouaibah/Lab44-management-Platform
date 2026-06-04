import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }
    if (session.role !== "admin" && session.role !== "instructor") {
      return NextResponse.json({ error: "Insufficient permissions." }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const labId = searchParams.get("labId");
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const format = searchParams.get("format") || "json";

    if (!labId) {
      return NextResponse.json({ error: "labId is required." }, { status: 400 });
    }

    // If instructor, verify they are assigned to this lab
    if (session.role === "instructor") {
      const instructorLabs = await db.instructorLab.findMany({
        where: { instructorId: session.userId },
        select: { labId: true },
      });
      const myLabIds = [session.labId, ...instructorLabs.map(il => il.labId)];
      if (!myLabIds.includes(parseInt(labId))) {
        return NextResponse.json({ error: "You can only view reports for your own labs." }, { status: 403 });
      }
    }

    const labIdNum = parseInt(labId);

    // Get student IDs for this lab
    const studentLabs = await db.studentLab.findMany({
      where: { labId: labIdNum },
      select: { studentId: true },
    });
    const labStudentIds = studentLabs.map((sl) => sl.studentId);

    if (labStudentIds.length === 0) {
      const emptyReport = {
        labId: labIdNum,
        totalSessions: 0,
        overallRate: 0,
        mostCommonStatus: "N/A",
        students: [],
        dailyBreakdown: [],
      };

      if (format === "csv") {
        return new NextResponse("No data available", {
          headers: { "Content-Type": "text/csv" },
        });
      }
      return NextResponse.json(emptyReport);
    }

    // Build attendance query — scope to this lab
    const attendanceWhere: Record<string, unknown> = {
      studentId: { in: labStudentIds },
      labId: labIdNum,
    };

    if (from || to) {
      const dateFilter: Record<string, string> = {};
      if (from) dateFilter.gte = from;
      if (to) dateFilter.lte = to;
      attendanceWhere.date = dateFilter;
    }

    // Fetch attendance records with student info
    const records = await db.attendance.findMany({
      where: attendanceWhere,
      include: {
        student: {
          select: { id: true, firstName: true, lastName: true, studentId: true },
        },
      },
      orderBy: [{ date: "asc" }, { studentId: "asc" }],
    });

    // Get lab name
    const lab = await db.lab.findUnique({
      where: { id: labIdNum },
      select: { name: true },
    });

    // ─── Compute aggregations ─────────────────────────────────────────────

    // Total sessions (unique dates)
    const uniqueDates = [...new Set(records.map((r) => r.date))];
    const totalSessions = uniqueDates.length;

    // Per-student summary
    const studentMap = new Map<
      number,
      {
        studentId: number;
        firstName: string;
        lastName: string;
        studentCode: string;
        present: number;
        absent: number;
        late: number;
        excused: number;
        total: number;
      }
    >();

    for (const record of records) {
      const existing = studentMap.get(record.studentId) || {
        studentId: record.student.id,
        firstName: record.student.firstName,
        lastName: record.student.lastName,
        studentCode: record.student.studentId,
        present: 0,
        absent: 0,
        late: 0,
        excused: 0,
        total: 0,
      };

      existing[record.status as keyof Pick<typeof existing, "present" | "absent" | "late" | "excused">]++;
      existing.total++;
      studentMap.set(record.studentId, existing);
    }

    // Include students with no attendance records
    for (const sid of labStudentIds) {
      if (!studentMap.has(sid)) {
        const student = await db.student.findUnique({
          where: { id: sid },
          select: { id: true, firstName: true, lastName: true, studentId: true },
        });
        if (student) {
          studentMap.set(sid, {
            studentId: student.id,
            firstName: student.firstName,
            lastName: student.lastName,
            studentCode: student.studentId,
            present: 0,
            absent: 0,
            late: 0,
            excused: 0,
            total: 0,
          });
        }
      }
    }

    const studentSummary = Array.from(studentMap.values()).map((s) => ({
      studentId: s.studentId,
      firstName: s.firstName,
      lastName: s.lastName,
      studentCode: s.studentCode,
      present: s.present,
      absent: s.absent,
      late: s.late,
      excused: s.excused,
      total: s.total,
      rate: s.total > 0 ? Math.round(((s.present + s.late) / s.total) * 100) : 0,
    }));

    // Sort by last name
    studentSummary.sort((a, b) => a.lastName.localeCompare(b.lastName));

    // Daily breakdown
    const dailyMap = new Map<
      string,
      { date: string; present: number; absent: number; late: number; excused: number; total: number }
    >();

    for (const record of records) {
      const existing = dailyMap.get(record.date) || {
        date: record.date,
        present: 0,
        absent: 0,
        late: 0,
        excused: 0,
        total: 0,
      };

      existing[record.status as keyof Pick<typeof existing, "present" | "absent" | "late" | "excused">]++;
      existing.total++;
      dailyMap.set(record.date, existing);
    }

    const dailyBreakdown = Array.from(dailyMap.values())
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((d) => ({
        date: d.date,
        present: d.present,
        absent: d.absent,
        late: d.late,
        excused: d.excused,
        total: d.total,
        rate: d.total > 0 ? Math.round(((d.present + d.late) / d.total) * 100) : 0,
      }));

    // Overall rate
    const totalPresent = records.filter((r) => r.status === "present").length;
    const totalLate = records.filter((r) => r.status === "late").length;
    const overallRate = records.length > 0 ? Math.round(((totalPresent + totalLate) / records.length) * 100) : 0;

    // Most common status
    const statusCounts: Record<string, number> = { present: 0, absent: 0, late: 0, excused: 0 };
    for (const r of records) {
      if (statusCounts[r.status] !== undefined) {
        statusCounts[r.status]++;
      }
    }
    const mostCommonStatus = Object.entries(statusCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "N/A";

    const report = {
      labId: labIdNum,
      labName: lab?.name || "Unknown",
      totalSessions,
      overallRate,
      mostCommonStatus,
      students: studentSummary,
      dailyBreakdown,
    };

    // ─── CSV Export ────────────────────────────────────────────────────────
    if (format === "csv") {
      const lines: string[] = [];

      // Header section
      lines.push(`Attendance Report - ${report.labName}`);
      lines.push(`Date Range,${from || "All"} to ${to || "All"}`);
      lines.push(`Total Sessions,${totalSessions}`);
      lines.push(`Overall Attendance Rate,${overallRate}%`);
      lines.push("");

      // Student summary
      lines.push("Student Summary");
      lines.push("Last Name,First Name,Student ID,Present,Absent,Late,Excused,Total,Rate (%)");
      for (const s of studentSummary) {
        lines.push(
          `${s.lastName},${s.firstName},${s.studentCode},${s.present},${s.absent},${s.late},${s.excused},${s.total},${s.rate}`
        );
      }
      lines.push("");

      // Daily breakdown
      lines.push("Daily Breakdown");
      lines.push("Date,Present,Absent,Late,Excused,Total,Rate (%)");
      for (const d of dailyBreakdown) {
        lines.push(`${d.date},${d.present},${d.absent},${d.late},${d.excused},${d.total},${d.rate}`);
      }

      const csvContent = lines.join("\n");
      return new NextResponse(csvContent, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="attendance-report-lab${labIdNum}.csv"`,
        },
      });
    }

    return NextResponse.json(report);
  } catch (error) {
    console.error("Attendance report error:", error);
    return NextResponse.json({ error: "Failed to generate attendance report." }, { status: 500 });
  }
}
