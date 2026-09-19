import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getInstructorLabIds } from "@/lib/lab-access";

/** Guard against pathological payloads. */
const MAX_UPDATES = 2000;

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }
    if (session.role !== "admin" && session.role !== "instructor") {
      return NextResponse.json({ error: "Insufficient permissions." }, { status: 403 });
    }

    const updates: Array<{ studentId: number; columnId: number; value: number | null }> =
      await request.json();

    if (!Array.isArray(updates) || updates.length === 0) {
      return NextResponse.json({ error: "Non-empty array of updates required." }, { status: 400 });
    }
    if (updates.length > MAX_UPDATES) {
      return NextResponse.json(
        { error: `Too many updates in one request (max ${MAX_UPDATES}).` },
        { status: 413 },
      );
    }

    // Normalise and reject malformed rows up front.
    const cleaned = updates.map((u) => ({
      studentId: Number.parseInt(String(u?.studentId), 10),
      columnId: Number.parseInt(String(u?.columnId), 10),
      value:
        u?.value === null || u?.value === undefined || u?.value === ""
          ? null
          : Number.parseFloat(String(u.value)),
    }));

    const valid = cleaned.filter(
      (u) =>
        Number.isInteger(u.studentId) &&
        Number.isInteger(u.columnId) &&
        (u.value === null || Number.isFinite(u.value)),
    );
    if (valid.length !== cleaned.length) {
      return NextResponse.json(
        {
          error:
            "Every update needs an integer studentId, an integer columnId and a numeric or null value.",
        },
        { status: 400 },
      );
    }

    // Resolve each column's lab. The client does not get to tell us the lab, and
    // a column id it does not own must not be writable through this endpoint.
    const columnIds = [...new Set(valid.map((u) => u.columnId))];
    const columns = await db.gradeColumn.findMany({
      where: { id: { in: columnIds } },
      select: { id: true, labId: true },
    });
    const labIdByColumn = new Map(columns.map((c) => [c.id, c.labId]));

    const missing = columnIds.filter((id) => !labIdByColumn.has(id));
    if (missing.length > 0) {
      return NextResponse.json(
        { error: `Unknown grade column(s): ${missing.join(", ")}.` },
        { status: 404 },
      );
    }

    const involvedLabIds = [...new Set(columns.map((c) => c.labId))];

    // Instructors are limited to the labs they are actually assigned to.
    if (session.role === "instructor") {
      const myLabIds = new Set(await getInstructorLabIds(session.userId));
      const forbidden = involvedLabIds.filter((labId) => !myLabIds.has(labId));
      if (forbidden.length > 0) {
        return NextResponse.json(
          { error: "One or more grade columns belong to a lab you are not assigned to." },
          { status: 403 },
        );
      }
    }

    // Every student must be enrolled in the lab that owns their column.
    const studentIds = [...new Set(valid.map((u) => u.studentId))];
    const memberships = await db.studentLab.findMany({
      where: { labId: { in: involvedLabIds }, studentId: { in: studentIds } },
      select: { studentId: true, labId: true },
    });
    const enrolled = new Set(memberships.map((m) => `${m.studentId}:${m.labId}`));

    const notEnrolled = valid.filter(
      (u) => !enrolled.has(`${u.studentId}:${labIdByColumn.get(u.columnId)}`),
    );
    if (notEnrolled.length > 0) {
      return NextResponse.json(
        {
          error:
            "One or more students are not enrolled in the lab that owns the submitted grade column.",
        },
        { status: 403 },
      );
    }

    // All-or-nothing: a partially applied grade write is worse than a failed one.
    const operations = valid.map((u) =>
      u.value === null
        ? db.grade.deleteMany({ where: { studentId: u.studentId, columnId: u.columnId } })
        : db.grade.upsert({
            where: {
              studentId_columnId: { studentId: u.studentId, columnId: u.columnId },
            },
            update: { value: u.value },
            create: { studentId: u.studentId, columnId: u.columnId, value: u.value },
          }),
    );

    await db.$transaction(operations);

    return NextResponse.json({ ok: true, count: valid.length });
  } catch (error) {
    console.error("Bulk grades error:", error);
    return NextResponse.json({ error: "Failed to save grades." }, { status: 500 });
  }
}
