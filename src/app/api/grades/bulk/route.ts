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

    const updates: Array<{ studentId: number; columnId: number; value: number | null }> = await request.json();

    if (!Array.isArray(updates) || updates.length === 0) {
      return NextResponse.json({ error: "Non-empty array of updates required." }, { status: 400 });
    }

    const results = await Promise.all(
      updates.map(async (update) => {
        const { studentId, columnId, value } = update;
        if (!studentId || !columnId) return null;

        if (value === null) {
          await db.grade.deleteMany({
            where: { studentId, columnId },
          });
          return { studentId, columnId, value: null };
        }

        const record = await db.grade.upsert({
          where: {
            studentId_columnId: {
              studentId,
              columnId,
            },
          },
          update: { value },
          create: { studentId, columnId, value },
        });

        return record;
      })
    );

    const savedCount = results.filter(Boolean).length;

    return NextResponse.json({ ok: true, count: savedCount });
  } catch (error) {
    console.error("Bulk grades error:", error);
    return NextResponse.json({ error: "Failed to save grades." }, { status: 500 });
  }
}
