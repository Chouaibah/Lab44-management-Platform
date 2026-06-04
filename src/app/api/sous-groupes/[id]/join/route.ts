import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";

// POST /api/sous-groupes/[id]/join — allows students to join a sous-groupe
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth();

    const { id } = await params;
    const sousGroupeId = parseInt(id);

    if (isNaN(sousGroupeId)) {
      return NextResponse.json({ error: "Invalid sous-groupe ID." }, { status: 400 });
    }

    const sousGroupe = await db.sousGroupe.findUnique({
      where: { id: sousGroupeId },
      include: { members: true },
    });
    if (!sousGroupe) {
      return NextResponse.json({ error: "Sous-groupe not found." }, { status: 404 });
    }

    // Get studentId from request body (for admin/instructor) or use session user (for student)
    const body = await request.json().catch(() => ({}));
    let studentId: number;

    if (session.role === "student") {
      studentId = session.userId;
    } else if (session.role === "admin" || session.role === "instructor") {
      if (!body.studentId) {
        return NextResponse.json({ error: "Student ID is required." }, { status: 400 });
      }
      studentId = parseInt(body.studentId);
    } else {
      return NextResponse.json({ error: "Access denied." }, { status: 403 });
    }

    // Verify student exists
    const student = await db.student.findUnique({ where: { id: studentId } });
    if (!student) {
      return NextResponse.json({ error: "Student not found." }, { status: 404 });
    }

    // Verify student is enrolled in the lab that this sous-groupe belongs to
    const studentLab = await db.studentLab.findFirst({
      where: { studentId, labId: sousGroupe.labId },
    });
    if (!studentLab) {
      return NextResponse.json({ error: "You must be enrolled in this lab to join a group." }, { status: 403 });
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

    // Check if student is already a member of this sous-groupe
    const existingMember = await db.sousGroupeMember.findUnique({
      where: {
        sousGroupeId_studentId: {
          sousGroupeId,
          studentId,
        },
      },
    });

    if (existingMember) {
      return NextResponse.json({ error: "You are already a member of this group." }, { status: 409 });
    }

    // Check if student is already in another sous-groupe for this lab (one group per lab restriction)
    const existingMembership = await db.sousGroupeMember.findFirst({
      where: { studentId },
      include: { sousGroupe: { select: { id: true, name: true, labId: true } } },
    });

    if (existingMembership && existingMembership.sousGroupe.labId === sousGroupe.labId) {
      return NextResponse.json(
        { error: `You are already in group "${existingMembership.sousGroupe.name}". You can only join one group per lab.`, existingGroup: existingMembership.sousGroupe },
        { status: 409 }
      );
    }

    const member = await db.sousGroupeMember.create({
      data: {
        sousGroupeId,
        studentId,
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
      return NextResponse.json({ error: "You are already a member of this group." }, { status: 409 });
    }
    console.error("Sous-groupe join error:", error);
    return NextResponse.json({ error: "Failed to join group." }, { status: 500 });
  }
}

// DELETE /api/sous-groupes/[id]/join — allows students to leave a sous-groupe
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth();

    const { id } = await params;
    const sousGroupeId = parseInt(id);

    if (isNaN(sousGroupeId)) {
      return NextResponse.json({ error: "Invalid sous-groupe ID." }, { status: 400 });
    }

    const sousGroupe = await db.sousGroupe.findUnique({ where: { id: sousGroupeId } });
    if (!sousGroupe) {
      return NextResponse.json({ error: "Sous-groupe not found." }, { status: 404 });
    }

    // Get studentId - from session for students, from query for admin/instructor
    let studentId: number;
    if (session.role === "student") {
      studentId = session.userId;
    } else {
      const { searchParams } = new URL(request.url);
      const sid = searchParams.get("studentId");
      if (!sid) {
        return NextResponse.json({ error: "Student ID is required." }, { status: 400 });
      }
      studentId = parseInt(sid);
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
      return NextResponse.json({ error: "You are not a member of this group." }, { status: 404 });
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
    console.error("Sous-groupe leave error:", error);
    return NextResponse.json({ error: "Failed to leave group." }, { status: 500 });
  }
}
