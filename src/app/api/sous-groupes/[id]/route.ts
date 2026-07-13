import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth, requireRole } from "@/lib/auth";

export async function GET(
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
      include: {
        members: {
          include: {
            student: { select: { id: true, firstName: true, lastName: true, studentId: true } },
          },
        },
        binomes: {
          include: {
            student1: { select: { id: true, firstName: true, lastName: true, studentId: true } },
            student2: { select: { id: true, firstName: true, lastName: true, studentId: true } },
          },
        },
        lab: { select: { id: true, name: true } },
      },
    });

    if (!sousGroupe) {
      return NextResponse.json({ error: "Sous-groupe not found." }, { status: 404 });
    }

    // Students can only view sous-groupes in their own level's labs
    if (session.role === "student") {
      const studentLabs = await db.studentLab.findMany({
        where: { studentId: session.userId },
        select: { labId: true },
      });
      const studentLabIds = studentLabs.map(sl => sl.labId);
      const hasAccess = sousGroupe.levelId
        ? await db.lab.findFirst({
            where: { id: { in: studentLabIds }, level: String(sousGroupe.levelId) },
          })
        : studentLabIds.includes(sousGroupe.labId);
      if (!hasAccess) {
        return NextResponse.json({ error: "Access denied." }, { status: 403 });
      }
    }

    return NextResponse.json({
      sousGroupe: {
        id: sousGroupe.id,
        name: sousGroupe.name,
        labId: sousGroupe.labId,
        lab: sousGroupe.lab,
        members: sousGroupe.members.map((m) => ({
          id: m.id,
          studentId: m.studentId,
          student: m.student,
        })),
        binomes: sousGroupe.binomes.map((b) => ({
          id: b.id,
          sousGroupeId: b.sousGroupeId,
          student1Id: b.student1Id,
          student2Id: b.student2Id,
          student1: b.student1,
          student2: b.student2,
        })),
        createdAt: sousGroupe.createdAt.toISOString(),
        updatedAt: sousGroupe.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    const err = error as { statusCode?: number; message?: string };
    if (err.statusCode === 401) {
      return NextResponse.json({ error: err.message || "Authentication required." }, { status: 401 });
    }
    if (err.statusCode === 403) {
      return NextResponse.json({ error: err.message || "Insufficient permissions." }, { status: 403 });
    }
    console.error("Sous-groupe get error:", error);
    return NextResponse.json({ error: "Failed to load sous-groupe." }, { status: 500 });
  }
}

export async function PUT(
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

    // If instructor, verify they can access this group (by level or lab)
    if (session.role === "instructor") {
      const instructor = await db.instructor.findUnique({
        where: { id: session.userId },
      });
      if (instructor) {
        const instructorLabs = await db.instructorLab.findMany({
          where: { instructorId: instructor.id },
          select: { labId: true },
        });
        const instructorLabIds = [instructor.labId, ...instructorLabs.map(l => l.labId)];
        let hasAccess = instructorLabIds.includes(sousGroupe.labId);
        if (!hasAccess && sousGroupe.levelId) {
          const levelLabMatch = await db.lab.findFirst({
            where: { id: { in: instructorLabIds }, level: String(sousGroupe.levelId) },
          });
          hasAccess = !!levelLabMatch;
        }
        if (!hasAccess) {
          return NextResponse.json({ error: "You can only update groups in your own labs." }, { status: 403 });
        }
      }
    }

    const { name } = await request.json();

    if (!name?.trim()) {
      return NextResponse.json({ error: "Name is required." }, { status: 400 });
    }

    const updated = await db.sousGroupe.update({
      where: { id: sousGroupeId },
      data: { name: name.trim() },
      include: {
        members: { include: { student: { select: { id: true, firstName: true, lastName: true, studentId: true } } } },
        binomes: {
          include: {
            student1: { select: { id: true, firstName: true, lastName: true, studentId: true } },
            student2: { select: { id: true, firstName: true, lastName: true, studentId: true } },
          },
        },
      },
    });

    return NextResponse.json({
      ok: true,
      sousGroupe: {
        id: updated.id,
        name: updated.name,
        labId: updated.labId,
        members: updated.members.map((m) => ({
          id: m.id,
          studentId: m.studentId,
          student: m.student,
        })),
        binomes: updated.binomes.map((b) => ({
          id: b.id,
          sousGroupeId: b.sousGroupeId,
          student1Id: b.student1Id,
          student2Id: b.student2Id,
          student1: b.student1,
          student2: b.student2,
        })),
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    const err = error as { statusCode?: number; message?: string };
    if (err.statusCode === 401) {
      return NextResponse.json({ error: err.message || "Authentication required." }, { status: 401 });
    }
    if (err.statusCode === 403) {
      return NextResponse.json({ error: err.message || "Insufficient permissions." }, { status: 403 });
    }
    console.error("Sous-groupe update error:", error);
    return NextResponse.json({ error: "Failed to update sous-groupe." }, { status: 500 });
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

    // If instructor, verify they can access this group (by level or lab)
    if (session.role === "instructor") {
      const instructor = await db.instructor.findUnique({
        where: { id: session.userId },
      });
      if (instructor) {
        const instructorLabs = await db.instructorLab.findMany({ where: { instructorId: instructor.id }, select: { labId: true } });
        const instructorLabIds = [instructor.labId, ...instructorLabs.map(l => l.labId)];
        let hasAccess = instructorLabIds.includes(sousGroupe.labId);
        if (!hasAccess && sousGroupe.levelId) {
          const levelLabMatch = await db.lab.findFirst({
            where: { id: { in: instructorLabIds }, level: String(sousGroupe.levelId) },
          });
          hasAccess = !!levelLabMatch;
        }
        if (!hasAccess) {
          return NextResponse.json({ error: "You can only delete groups in your own labs." }, { status: 403 });
        }
      }
    }

    await db.sousGroupe.delete({ where: { id: sousGroupeId } });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const err = error as { statusCode?: number; message?: string };
    if (err.statusCode === 401) {
      return NextResponse.json({ error: err.message || "Authentication required." }, { status: 401 });
    }
    if (err.statusCode === 403) {
      return NextResponse.json({ error: err.message || "Insufficient permissions." }, { status: 403 });
    }
    console.error("Sous-groupe delete error:", error);
    return NextResponse.json({ error: "Failed to delete sous-groupe." }, { status: 500 });
  }
}
