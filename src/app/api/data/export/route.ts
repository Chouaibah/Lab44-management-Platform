import { db } from "@/lib/db";
import { getSettingsMap } from "@/lib/settings-cache";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }
    if (session.role !== "admin") {
      return NextResponse.json({ error: "Insufficient permissions." }, { status: 403 });
    }

        const [settingsMap, labs, instructors, students, columns, grades, announcements, attendance, vmRequests] =
        await Promise.all([
        getSettingsMap(),
        db.lab.findMany({ include: { studentLabs: true, instructors: true, gradeColumns: true, _count: { select: { studentLabs: true, instructors: true } } } }),
        db.instructor.findMany({
        include: { lab: true, instructorLabs: { select: { labId: true } } },
        }),
        db.student.findMany({
        include: { labs: { include: { lab: true } } },
        }),
        db.gradeColumn.findMany({ orderBy: { id: "asc" } }),
        db.grade.findMany(),
        db.announcement.findMany({ orderBy: [{ pinned: "desc" }, { createdAt: "desc" }] }),
        db.attendance.findMany(),
        db.vMRequest.findMany({ orderBy: { requestedAt: "desc" } }),
        ]);

        const exportData = {
        exportedAt: new Date().toISOString(),
        version: "1.0",
        settings: Object.entries(settingsMap).map(([key, value]) => ({ key, value })),
      labs: labs.map((l) => ({
        id: l.id,
        name: l.name,
        description: l.description,
        level: l.level,
        createdAt: l.createdAt.toISOString(),
        instructorCount: l._count.instructors,
        studentCount: l._count.studentLabs,
      })),
      instructors: instructors.map((i) => ({
        id: i.id,
        username: i.username,
        displayName: i.displayName,
        email: i.email,
        labId: i.labId,
        labIds: [i.labId, ...i.instructorLabs.map(il => il.labId).filter(id => id !== i.labId)],
        labName: i.lab?.name || null,
        createdAt: i.createdAt.toISOString(),
      })),
      students: students.map((s) => ({
        id: s.id,
        firstName: s.firstName,
        lastName: s.lastName,
        studentId: s.studentId,
        labIds: s.labs.map(l => l.labId),
        createdAt: s.createdAt.toISOString(),
      })),
      gradeColumns: columns.map((c) => ({
        id: c.id,
        name: c.name,
        createdAt: c.createdAt.toISOString(),
      })),
      grades: grades.map((g) => ({
        studentId: g.studentId,
        columnId: g.columnId,
        value: g.value,
      })),
      announcements: announcements.map((a) => ({
        id: a.id,
        title: a.title,
        content: a.content,
        author: a.author,
        pinned: a.pinned,
        isArchived: a.isArchived,
        labId: a.labId,
        createdAt: a.createdAt.toISOString(),
      })),
      attendance: attendance.map((a) => ({
        id: a.id,
        studentId: a.studentId,
        labId: a.labId,
        date: a.date,
        status: a.status,
        note: a.note,
        markedBy: a.markedBy,
      })),
      vmRequests: vmRequests.map((r) => ({
        id: r.id,
        studentDbId: r.studentDbId,
        studentName: r.studentName,
        studentId: r.studentId,
        templateUuid: r.templateUuid,
        templateName: r.templateName,
        status: r.status,
        note: r.note,
        vmUuid: r.vmUuid,
        vmName: r.vmName,
        vmIp: r.vmIp,
        accessProtocol: r.accessProtocol,
        guacUsername: r.guacUsername,
        guacConnectionId: r.guacConnectionId,
        requestedAt: r.requestedAt.toISOString(),
        reviewedAt: r.reviewedAt?.toISOString() ?? null,
      })),
    };

    return new NextResponse(JSON.stringify(exportData, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="lab44-export-${new Date().toISOString().split("T")[0]}.json"`,
      },
    });
  } catch (error) {
    console.error("Data export error:", error);
    return NextResponse.json({ error: "Failed to export data." }, { status: 500 });
  }
}
