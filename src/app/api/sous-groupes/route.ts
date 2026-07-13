import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth, requireRole } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    const session = await requireAuth();

    const { searchParams } = new URL(request.url);
    const labId = searchParams.get("labId");

    const where: Record<string, unknown> = {};
    if (labId) {
      where.labId = parseInt(labId);
    }

    // Students can only see sous-groupes in their own lab
    if (session.role === "student") {
      const studentLabs = await db.studentLab.findMany({
        where: { studentId: session.userId },
        select: { labId: true },
      });
      const labIds = studentLabs.map((sl) => sl.labId);
      where.labId = labId ? parseInt(labId) : { in: labIds };

      // Verify the student belongs to the requested lab
      if (labId && !labIds.includes(parseInt(labId))) {
        return NextResponse.json({ error: "Access denied." }, { status: 403 });
      }
    }

    // Instructors/admins: show groups from all labs at the same level
    if (labId && (session.role === "instructor" || session.role === "admin")) {
      const requestedLab = await db.lab.findUnique({
        where: { id: parseInt(labId) },
        select: { level: true },
      });
      if (requestedLab?.level) {
        const levelId = parseInt(requestedLab.level);
        delete where.labId;
        where.levelId = levelId;
      } else {
        where.labId = parseInt(labId);
      }
    }

    const sousGroupes = await db.sousGroupe.findMany({
      where,
      include: {
        members: {
          include: {
            student: {
              select: { id: true, firstName: true, lastName: true, studentId: true },
            },
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
      orderBy: { createdAt: "desc" },
    });

    // For instructors, filter members to only show students enrolled in their labs
    let instructorStudentIds: Set<number> | null = null;
    if (session.role === "instructor") {
      const instructor = await db.instructor.findUnique({ where: { id: session.userId } });
      if (instructor) {
        const instructorLabs = await db.instructorLab.findMany({
          where: { instructorId: instructor.id },
          select: { labId: true },
        });
        const instructorLabIds = [instructor.labId, ...instructorLabs.map(l => l.labId)];
        const labStudents = await db.studentLab.findMany({
          where: { labId: { in: instructorLabIds } },
          select: { studentId: true },
        });
        instructorStudentIds = new Set(labStudents.map(sl => sl.studentId));
      }
    }

    return NextResponse.json({
      sousGroupes: sousGroupes.map((sg) => {
        const filteredMembers = instructorStudentIds
          ? sg.members.filter(m => instructorStudentIds.has(m.studentId))
          : sg.members;
        return {
          id: sg.id,
          name: sg.name,
          labId: sg.labId,
          lab: sg.lab,
          members: filteredMembers.map((m) => ({
            id: m.id,
            studentId: m.studentId,
            student: m.student,
          })),
          binomes: sg.binomes.map((b) => ({
            id: b.id,
            sousGroupeId: b.sousGroupeId,
            student1Id: b.student1Id,
            student2Id: b.student2Id,
            student1: b.student1,
            student2: b.student2,
          })),
          createdAt: sg.createdAt.toISOString(),
          updatedAt: sg.updatedAt.toISOString(),
        };
      }),
    });
  } catch (error) {
    const err = error as { statusCode?: number; message?: string };
    if (err.statusCode === 401) {
      return NextResponse.json({ error: err.message || "Authentication required." }, { status: 401 });
    }
    if (err.statusCode === 403) {
      return NextResponse.json({ error: err.message || "Insufficient permissions." }, { status: 403 });
    }
    console.error("Sous-groupes list error:", error);
    return NextResponse.json({ error: "Failed to load sous-groupes." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireRole("admin", "instructor");

    const { name, labId } = await request.json();

    if (!name?.trim()) {
      return NextResponse.json({ error: "Name is required." }, { status: 400 });
    }
    if (!labId) {
      return NextResponse.json({ error: "Lab ID is required." }, { status: 400 });
    }

    // Verify lab exists
    const lab = await db.lab.findUnique({ where: { id: parseInt(labId) } });
    if (!lab) {
      return NextResponse.json({ error: "Lab not found." }, { status: 404 });
    }

    // Derive levelId from lab's level
    const levelId = lab.level ? parseInt(lab.level) : null;

    // If instructor, verify they belong to this lab
    if (session.role === "instructor") {
      const instructor = await db.instructor.findUnique({
        where: { id: session.userId },
      });
      if (!instructor) {
        return NextResponse.json({ error: "Instructor not found." }, { status: 404 });
      }
      const instructorLabs = await db.instructorLab.findMany({
        where: { instructorId: instructor.id },
        select: { labId: true },
      });
      const instructorLabIds = [instructor.labId, ...instructorLabs.map(l => l.labId)];
      if (!instructorLabIds.includes(parseInt(labId))) {
        return NextResponse.json({ error: "You can only create groups in your own lab." }, { status: 403 });
      }
    }

    const sousGroupe = await db.sousGroupe.create({
      data: {
        name: name.trim(),
        labId: parseInt(labId),
        levelId,
      },
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
        id: sousGroupe.id,
        name: sousGroupe.name,
        labId: sousGroupe.labId,
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
    console.error("Sous-groupe create error:", error);
    return NextResponse.json({ error: "Failed to create sous-groupe." }, { status: 500 });
  }
}
