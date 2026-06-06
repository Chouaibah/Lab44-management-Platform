import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }
    if (session.role !== "admin" && session.role !== "instructor") {
      return NextResponse.json({ error: "Insufficient permissions." }, { status: 403 });
    }

    const records: Array<{ studentId: number; date: string; labId: number; status?: string; note?: string }> =
      await request.json();

    if (!Array.isArray(records) || records.length === 0) {
      return NextResponse.json({ error: "Non-empty array of records required." }, { status: 400 });
    }

    // Instructors: get their assigned lab IDs for validation
    let instructorLabIds: number[] | null = null;
    if (session.role === "instructor") {
      const instructorLabs = await db.instructorLab.findMany({
        where: { instructorId: session.userId },
        select: { labId: true },
      });
      instructorLabIds = [session.labId, ...instructorLabs.map(il => il.labId)];
    }

    const validStatuses = ["present", "absent", "late", "excused"];

    const results = await Promise.all(
      records.map(async (record) => {
        const { studentId, date, labId, status, note } = record;
        if (!studentId || !date || !labId) return null;

        // Instructors can only mark for their assigned labs
        if (instructorLabIds && !instructorLabIds.includes(labId)) {
          return null;
        }

        const normalizedStatus = validStatuses.includes(status || "") ? status : "present";

        return db.attendance.upsert({
          where: {
            studentId_date_labId: {
              studentId: parseInt(String(studentId)),
              date,
              labId: parseInt(String(labId)),
            },
          },
          update: {
            status: normalizedStatus,
            note: note?.trim() || null,
            markedBy: session.role === "instructor" ? session.userId : null,
          },
          create: {
            studentId: parseInt(String(studentId)),
            date,
            labId: parseInt(String(labId)),
            status: normalizedStatus,
            note: note?.trim() || null,
            markedBy: session.role === "instructor" ? session.userId : null,
          },
        });
      })
    );

    const savedCount = results.filter(Boolean).length;
    return NextResponse.json({ ok: true, count: savedCount });
  } catch (error) {
    console.error("Bulk attendance error:", error);
    return NextResponse.json({ error: "Failed to save attendance records." }, { status: 500 });
  }
}
