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

    const where = labId ? { labId: parseInt(labId) } : {};

    const columns = await db.gradeColumn.findMany({
      where,
      orderBy: { id: "asc" },
      include: { lab: { select: { name: true } } },
    });
    return NextResponse.json(
      columns.map((c) => ({
        id: c.id,
        name: c.name,
        weight: c.weight,
        labId: c.labId,
        labName: c.lab.name,
        createdAt: c.createdAt.toISOString(),
      }))
    );
  } catch (error) {
    console.error("Columns list error:", error);
    return NextResponse.json({ error: "Failed to load columns." }, { status: 500 });
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

    const { name, labId, weight } = await request.json();
    if (!name) {
      return NextResponse.json({ error: "Name required." }, { status: 400 });
    }
    if (!labId) {
      return NextResponse.json({ error: "Lab ID is required." }, { status: 400 });
    }
    const parsedWeight = typeof weight === 'number' && weight > 0 ? weight : 1.0;
    const column = await db.gradeColumn.create({
      data: { name: name.trim(), weight: parsedWeight, labId: parseInt(labId) },
    });
    return NextResponse.json({ ok: true, id: column.id });
  } catch (error: unknown) {
    const err = error as { code?: string };
    if (err.code === "P2002") {
      return NextResponse.json({ error: "Column already exists in this lab." }, { status: 409 });
    }
    console.error("Column create error:", error);
    return NextResponse.json({ error: "Failed to create column." }, { status: 500 });
  }
}
