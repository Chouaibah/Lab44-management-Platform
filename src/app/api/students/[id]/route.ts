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
    const { firstName, lastName, studentId, notes } = await request.json();
    if (!firstName || !lastName || !studentId) {
      return NextResponse.json({ error: "All fields required." }, { status: 400 });
    }
    await db.student.update({
      where: { id: parseInt(id) },
      data: {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        studentId: studentId.trim(),
        ...(notes !== undefined ? { notes: notes || null } : {}),
      },
    });
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const err = error as { code?: string };
    if (err.code === "P2002") {
      return NextResponse.json({ error: "Student ID already in use." }, { status: 409 });
    }
    console.error("Student update error:", error);
    return NextResponse.json({ error: "Failed to update student." }, { status: 500 });
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
    await db.student.delete({ where: { id: parseInt(id) } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Student delete error:", error);
    return NextResponse.json({ error: "Failed to delete student." }, { status: 500 });
  }
}
