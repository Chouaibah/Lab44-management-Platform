import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

export async function GET() {
  try {
    const labs = await db.lab.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: { instructors: true, studentLabs: true },
        },
      },
    });
    return NextResponse.json(
      labs.map((lab) => ({
        id: lab.id,
        name: lab.name,
        description: lab.description,
        level: lab.level,
        hasPassword: !!lab.password,
        autoApprove: lab.autoApprove,
        createdAt: lab.createdAt.toISOString(),
        instructorCount: lab._count.instructors,
        studentCount: lab._count.studentLabs,
      }))
    );
  } catch (error) {
    console.error("Labs list error:", error);
    return NextResponse.json({ error: "Failed to load labs." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }
    if (session.role !== "admin") {
      return NextResponse.json({ error: "Insufficient permissions." }, { status: 403 });
    }

    const { name, description, password, level, autoApprove } = await request.json();
    if (!name || !name.trim()) {
      return NextResponse.json({ error: "Lab name is required." }, { status: 400 });
    }
    const { hashPassword } = await import("@/lib/auth");
    const hashedPassword = password?.trim() ? await hashPassword(password.trim()) : null;
    const lab = await db.lab.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        password: hashedPassword,
        level: level?.trim() || null,
        autoApprove: typeof autoApprove === "boolean" ? autoApprove : false,
      },
    });
    return NextResponse.json({ ok: true, id: lab.id, name: lab.name });
  } catch (error) {
    console.error("Lab create error:", error);
    return NextResponse.json({ error: "Failed to create lab." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }
    if (session.role !== "student") {
      return NextResponse.json({ error: "Insufficient permissions." }, { status: 403 });
    }

    const { labId, studentId, password } = await request.json();
    if (!labId || !studentId) {
      return NextResponse.json({ error: "Lab ID and Student ID are required." }, { status: 400 });
    }

    // Students can only join a lab for themselves
    if (session.userId !== parseInt(studentId)) {
      return NextResponse.json({ error: "You can only join labs for yourself." }, { status: 403 });
    }

    const lab = await db.lab.findUnique({ where: { id: parseInt(labId) } });
    if (!lab) {
      return NextResponse.json({ error: "Lab not found." }, { status: 404 });
    }

    // Verify password if lab has one — compare against the stored bcrypt hash
    if (lab.password) {
      const { verifyPassword } = await import("@/lib/auth");
      const passwordMatch = password ? await verifyPassword(password, lab.password) : false;
      if (!passwordMatch) {
        return NextResponse.json({ error: "Incorrect lab password." }, { status: 403 });
      }
    }

    const student = await db.student.findUnique({ where: { id: parseInt(studentId) } });
    if (!student) {
      return NextResponse.json({ error: "Student not found." }, { status: 404 });
    }

    const existing = await db.studentLab.findUnique({
      where: {
        studentId_labId: {
          studentId: parseInt(studentId),
          labId: parseInt(labId),
        },
      },
    });
    if (existing) {
      return NextResponse.json({ error: "Already a member of this lab." }, { status: 409 });
    }

    await db.studentLab.create({
      data: {
        studentId: parseInt(studentId),
        labId: parseInt(labId),
      },
    });

    // ─── Sous-groupe auto-assignment ──────────────────────────────────────────
    // If the student is already in a sous-groupe at the same level,
    // auto-assign them to that same group (no need to re-join).
    if (lab.level) {
      try {
        const levelId = parseInt(lab.level);
        const existingMembership = await db.sousGroupeMember.findFirst({
          where: { studentId: parseInt(studentId) },
          include: {
            sousGroupe: {
              select: { id: true, name: true, levelId: true },
            },
          },
        });

        if (existingMembership && existingMembership.sousGroupe.levelId === levelId) {
          // Student is already in a sous-groupe at this level — auto-assign
          await db.sousGroupeMember.upsert({
            where: {
              sousGroupeId_studentId: {
                sousGroupeId: existingMembership.sousGroupe.id,
                studentId: parseInt(studentId),
              },
            },
            update: {},
            create: {
              sousGroupeId: existingMembership.sousGroupe.id,
              studentId: parseInt(studentId),
            },
          });
        }
      } catch (sgError) {
        console.error("Sous-groupe auto-assignment error:", sgError);
      }
    }

    return NextResponse.json({ ok: true, labName: lab.name });
  } catch (error) {
    console.error("Lab join error:", error);
    return NextResponse.json({ error: "Failed to join lab." }, { status: 500 });
  }
}
