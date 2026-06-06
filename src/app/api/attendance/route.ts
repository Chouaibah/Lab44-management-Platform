import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

export async function DELETE(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }
    if (session.role !== "admin" && session.role !== "instructor") {
      return NextResponse.json({ error: "Insufficient permissions." }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date");
    const labId = searchParams.get("labId");

    if (!date) {
      return NextResponse.json({ error: "date parameter is required for deletion." }, { status: 400 });
    }

    const where: Record<string, unknown> = { date };

    // If instructor, restrict to their assigned labs
    if (session.role === "instructor") {
      const instructorLabs = await db.instructorLab.findMany({
        where: { instructorId: session.userId },
        select: { labId: true },
      });
      const myLabIds = [session.labId, ...instructorLabs.map(il => il.labId)];
      if (labId) {
        if (!myLabIds.includes(parseInt(labId))) {
          return NextResponse.json({ error: "You can only delete attendance for your own labs." }, { status: 403 });
        }
        where.labId = parseInt(labId);
      } else {
        where.labId = { in: myLabIds };
      }
    } else if (labId) {
      where.labId = parseInt(labId);
    }

    const result = await db.attendance.deleteMany({ where });

    return NextResponse.json({ ok: true, deleted: result.count });
  } catch (error) {
    console.error("Attendance delete error:", error);
    return NextResponse.json({ error: "Failed to delete attendance records." }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }
    if (session.role !== "admin" && session.role !== "instructor" && session.role !== "student") {
      return NextResponse.json({ error: "Insufficient permissions." }, { status: 403 });
    }

    // Students can only see their own records
    if (session.role === "student") {
      const { searchParams } = new URL(request.url);
      const requestedId = searchParams.get("studentDbId");
      if (!requestedId || parseInt(requestedId) !== session.userId) {
        return NextResponse.json({ error: "Students can only view their own attendance." }, { status: 403 });
      }
    }

    const { searchParams } = new URL(request.url);
    const studentDbId = searchParams.get("studentDbId");
    const date = searchParams.get("date");
    const labId = searchParams.get("labId");

    const where: Record<string, unknown> = {};
    if (studentDbId) where.studentId = parseInt(studentDbId);
    if (date) where.date = date;
    if (labId) where.labId = parseInt(labId);

    // Instructors: filter to their assigned labs
    if (session.role === "instructor") {
      const instructorLabs = await db.instructorLab.findMany({
        where: { instructorId: session.userId },
        select: { labId: true },
      });
      const myLabIds = [session.labId, ...instructorLabs.map(il => il.labId)];
      if (labId) {
        if (!myLabIds.includes(parseInt(labId))) {
          return NextResponse.json({ error: "You can only view attendance for your own labs." }, { status: 403 });
        }
        // labId already in where
      } else {
        where.labId = { in: myLabIds };
      }
    }

    const records = await db.attendance.findMany({
      where: Object.keys(where).length > 0 ? where : undefined,
      orderBy: [{ date: "desc" }, { studentId: "asc" }],
    });

    return NextResponse.json(
      records.map((r) => ({
        id: r.id,
        studentId: r.studentId,
        labId: r.labId,
        date: r.date,
        status: r.status,
        note: r.note,
        markedBy: r.markedBy,
      }))
    );
  } catch (error) {
    console.error("Attendance list error:", error);
    return NextResponse.json({ error: "Failed to load attendance records." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }
    if (session.role !== "admin" && session.role !== "instructor") {
      return NextResponse.json({ error: "Insufficient permissions." }, { status: 403 });
    }

    const { studentId, date, status, note, labId, markedBy } = await request.json();
    if (!studentId || !date || !labId) {
      return NextResponse.json({ error: "studentId, date, and labId required." }, { status: 400 });
    }

    // Instructors can only mark attendance for their assigned labs
    if (session.role === "instructor") {
      const instructorLabs = await db.instructorLab.findMany({
        where: { instructorId: session.userId },
        select: { labId: true },
      });
      const myLabIds = [session.labId, ...instructorLabs.map(il => il.labId)];
      if (!myLabIds.includes(parseInt(labId))) {
        return NextResponse.json({ error: "You can only mark attendance for your own labs." }, { status: 403 });
      }
    }

    const validStatuses = ["present", "absent", "late", "excused"];
    const normalizedStatus = validStatuses.includes(status) ? status : "present";

    const record = await db.attendance.upsert({
      where: {
        studentId_date_labId: {
          studentId: parseInt(studentId),
          date,
          labId: parseInt(labId),
        },
      },
      update: {
        status: normalizedStatus,
        note: note?.trim() || null,
        markedBy: markedBy ?? (session.role === "instructor" ? session.userId : null),
      },
      create: {
        studentId: parseInt(studentId),
        date,
        labId: parseInt(labId),
        status: normalizedStatus,
        note: note?.trim() || null,
        markedBy: markedBy ?? (session.role === "instructor" ? session.userId : null),
      },
    });

    return NextResponse.json({ ok: true, id: record.id });
  } catch (error) {
    console.error("Attendance create error:", error);
    return NextResponse.json({ error: "Failed to save attendance record." }, { status: 500 });
  }
}
