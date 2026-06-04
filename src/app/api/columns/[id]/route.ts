import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }
    if (session.role !== "admin" && session.role !== "instructor") {
      return NextResponse.json({ error: "Insufficient permissions." }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { name, weight } = body;

    const data: { name?: string; weight?: number } = {};
    if (name !== undefined) {
      if (!name) {
        return NextResponse.json({ error: "Name required." }, { status: 400 });
      }
      data.name = name.trim();
    }
    if (weight !== undefined) {
      if (typeof weight !== 'number' || weight <= 0) {
        return NextResponse.json({ error: "Weight must be a positive number." }, { status: 400 });
      }
      data.weight = weight;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "No fields to update." }, { status: 400 });
    }

    await db.gradeColumn.update({
      where: { id: parseInt(id) },
      data,
    });
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const err = error as { code?: string };
    if (err.code === "P2002") {
      return NextResponse.json({ error: "Column name already exists." }, { status: 409 });
    }
    console.error("Column update error:", error);
    return NextResponse.json({ error: "Failed to update column." }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }
    if (session.role !== "admin" && session.role !== "instructor") {
      return NextResponse.json({ error: "Insufficient permissions." }, { status: 403 });
    }

    const { id } = await params;
    await db.gradeColumn.delete({ where: { id: parseInt(id) } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Column delete error:", error);
    return NextResponse.json({ error: "Failed to delete column." }, { status: 500 });
  }
}
