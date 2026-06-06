import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth, requireRole } from "@/lib/auth";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireRole("admin", "instructor");

    const { id } = await params;
    const sousGroupeId = parseInt(id);

    if (isNaN(sousGroupeId)) {
      return NextResponse.json({ error: "Invalid sous-groupe ID." }, { status: 400 });
    }

    const sousGroupe = await db.sousGroupe.findUnique({ where: { id: sousGroupeId } });
    if (!sousGroupe) {
      return NextResponse.json({ error: "Sous-groupe not found." }, { status: 404 });
    }

    // If instructor, verify they belong to this lab
    if (session.role === "instructor") {
      const instructor = await db.instructor.findUnique({
        where: { id: session.userId },
      });
      if (instructor && instructor.labId !== sousGroupe.labId) {
        return NextResponse.json({ error: "You can only modify sous-groupes in your own lab." }, { status: 403 });
      }
    }

    const { studentId } = await request.json();

    if (!studentId) {
      return NextResponse.json({ error: "Student ID is required." }, { status: 400 });
    }

    // Verify student exists
    const student = await db.student.findUnique({ where: { id: parseInt(studentId) } });
    if (!student) {
      return NextResponse.json({ error: "Student not found." }, { status: 404 });
    }

    // Check if student is already a member
    const existingMember = await db.sousGroupeMember.findUnique({
      where: {
        sousGroupeId_studentId: {
          sousGroupeId,
          studentId: parseInt(studentId),
        },
      },
    });

    if (existingMember) {
      return NextResponse.json({ error: "Student is already a member of this sous-groupe." }, { status: 409 });
    }

    const member = await db.sousGroupeMember.create({
      data: {
        sousGroupeId,
        studentId: parseInt(studentId),
      },
      include: {
        student: { select: { id: true, firstName: true, lastName: true, studentId: true } },
      },
    });

    return NextResponse.json({
      ok: true,
      member: {
        id: member.id,
        studentId: member.studentId,
        student: member.student,
      },
    });
  } catch (error) {
    const err = error as { statusCode?: number; message?: string; code?: string };
    if (err.statusCode === 401) {
      return NextResponse.json({ error: err.message || "Authentication required." }, { status: 401 });
    }
    if (err.statusCode === 403) {
      return NextResponse.json({ error: err.message || "Insufficient permissions." }, { status: 403 });
    }
    if (err.code === "P2002") {
      return NextResponse.json({ error: "Student is already a member of this sous-groupe." }, { status: 409 });
    }
    console.error("Sous-groupe add member error:", error);
    return NextResponse.json({ error: "Failed to add member." }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireRole("admin", "instructor");

    const { id } = await params;
    const sousGroupeId = parseInt(id);

    if (isNaN(sousGroupeId)) {
      return NextResponse.json({ error: "Invalid sous-groupe ID." }, { status: 400 });
    }

    const sousGroupe = await db.sousGroupe.findUnique({ where: { id: sousGroupeId } });
    if (!sousGroupe) {
      return NextResponse.json({ error: "Sous-groupe not found." }, { status: 404 });
    }

    // If instructor, verify they belong to this lab
    if (session.role === "instructor") {
      const instructor = await db.instructor.findUnique({
        where: { id: session.userId },
      });
      if (instructor && instructor.labId !== sousGroupe.labId) {
        return NextResponse.json({ error: "You can only modify sous-groupes in your own lab." }, { status: 403 });
      }
    }

    const { searchParams } = new URL(request.url);
    const studentIdParam = searchParams.get("studentId");

    if (!studentIdParam) {
      return NextResponse.json({ error: "Student ID is required." }, { status: 400 });
    }

    const studentId = parseInt(studentIdParam);
    if (isNaN(studentId)) {
      return NextResponse.json({ error: "Invalid student ID." }, { status: 400 });
    }

    const member = await db.sousGroupeMember.findUnique({
      where: {
        sousGroupeId_studentId: {
          sousGroupeId,
          studentId,
        },
      },
    });

    if (!member) {
      return NextResponse.json({ error: "Member not found in this sous-groupe." }, { status: 404 });
    }

    await db.sousGroupeMember.delete({
      where: { id: member.id },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const err = error as { statusCode?: number; message?: string };
    if (err.statusCode === 401) {
      return NextResponse.json({ error: err.message || "Authentication required." }, { status: 401 });
    }
    if (err.statusCode === 403) {
      return NextResponse.json({ error: err.message || "Insufficient permissions." }, { status: 403 });
    }
    console.error("Sous-groupe remove member error:", error);
    return NextResponse.json({ error: "Failed to remove member." }, { status: 500 });
  }
}
