import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const { id } = await params;
    const labId = parseInt(id);

    // Students may only view a lab they are a member of
    if (session.role === "student") {
      const membership = await db.studentLab.findUnique({
        where: { studentId_labId: { studentId: session.userId, labId } },
      });
      if (!membership) {
        return NextResponse.json({ error: "Lab not found." }, { status: 404 });
      }
    }

    const lab = await db.lab.findUnique({
      where: { id: labId },
      include: {
        studentLabs: {
          orderBy: { student: { lastName: "asc" } },
          include: { student: true },
        },
        instructors: {
          orderBy: { createdAt: "desc" },
          include: { instructorLabs: { select: { labId: true } } },
        },
      },
    });
    if (!lab) {
      return NextResponse.json({ error: "Lab not found." }, { status: 404 });
    }

    // Admins and instructors get the full picture
    if (session.role === "admin" || session.role === "instructor") {
      return NextResponse.json({
        id: lab.id,
        name: lab.name,
        description: lab.description,
        level: lab.level,
        hasPassword: !!lab.password,
        autoApprove: lab.autoApprove,
        createdAt: lab.createdAt.toISOString(),
        students: lab.studentLabs.map((sl) => ({
          id: sl.student.id,
          firstName: sl.student.firstName,
          lastName: sl.student.lastName,
          studentId: sl.student.studentId,
          joinedAt: sl.joinedAt.toISOString(),
        })),
        instructors: lab.instructors.map((i) => ({
          id: i.id,
          username: i.username,
          displayName: i.displayName,
          email: i.email,
          labId: i.labId,
          labIds: [i.labId, ...i.instructorLabs.map(il => il.labId).filter(lid => lid !== i.labId)],
          showGrades: i.showGrades,
          createdAt: i.createdAt.toISOString(),
        })),
      });
    }

    // Students get a limited view — no other students' data, no instructor credentials
    return NextResponse.json({
      id: lab.id,
      name: lab.name,
      description: lab.description,
      level: lab.level,
      createdAt: lab.createdAt.toISOString(),
      instructors: lab.instructors.map((i) => ({
        id: i.id,
        displayName: i.displayName,
        showGrades: i.showGrades,
      })),
    });
  } catch (error) {
    console.error("Lab get error:", error);
    return NextResponse.json({ error: "Failed to load lab." }, { status: 500 });
  }
}

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
    const data = await request.json();

    const updateData: Record<string, unknown> = {};
    if (typeof data.name === "string") updateData.name = data.name.trim();
    if (data.description !== undefined) {
      updateData.description = data.description?.trim() || null;
    }
    if (data.password !== undefined) {
      if (data.password?.trim()) {
        const { hashPassword } = await import("@/lib/auth");
        updateData.password = await hashPassword(data.password.trim());
      } else {
        updateData.password = null;
      }
    }
    if (data.autoApprove !== undefined) {
      updateData.autoApprove = Boolean(data.autoApprove);
    }
    if (data.level !== undefined) {
      updateData.level = data.level?.trim() || null;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "No fields to update." }, { status: 400 });
    }

    const lab = await db.lab.update({
      where: { id: parseInt(id) },
      data: updateData,
    });

    return NextResponse.json({ ok: true, id: lab.id, name: lab.name });
  } catch (error) {
    console.error("Lab update error:", error);
    return NextResponse.json({ error: "Failed to update lab." }, { status: 500 });
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

    const { id } = await params;
    const labId = parseInt(id);

    const { searchParams } = new URL(request.url);
    const studentIdParam = searchParams.get("studentId");

    // Students can only leave their OWN lab membership (DELETE with ?studentId=)
    if (session.role === "student") {
      if (!studentIdParam) {
        return NextResponse.json({ error: "Insufficient permissions." }, { status: 403 });
      }
      const studentId = parseInt(studentIdParam);
      if (isNaN(studentId) || session.userId !== studentId) {
        return NextResponse.json({ error: "You can only leave your own lab." }, { status: 403 });
      }
      const membership = await db.studentLab.findUnique({
        where: { studentId_labId: { studentId, labId } },
      });
      if (!membership) {
        return NextResponse.json({ error: "Student is not a member of this lab." }, { status: 404 });
      }
      await db.studentLab.delete({
        where: { studentId_labId: { studentId, labId } },
      });
      return NextResponse.json({ ok: true });
    }

    // Admin/instructor only beyond this point
    if (session.role !== "admin" && session.role !== "instructor") {
      return NextResponse.json({ error: "Insufficient permissions." }, { status: 403 });
    }

    // If studentId is provided, this is a "leave lab" request
    if (studentIdParam) {
      const studentId = parseInt(studentIdParam);
      if (!studentId || isNaN(studentId)) {
        return NextResponse.json({ error: "Valid studentId is required." }, { status: 400 });
      }

      const lab = await db.lab.findUnique({ where: { id: labId } });
      if (!lab) {
        return NextResponse.json({ error: "Lab not found." }, { status: 404 });
      }

      const membership = await db.studentLab.findUnique({
        where: { studentId_labId: { studentId, labId } },
      });
      if (!membership) {
        return NextResponse.json({ error: "Student is not a member of this lab." }, { status: 404 });
      }

      await db.studentLab.delete({
        where: { studentId_labId: { studentId, labId } },
      });

      return NextResponse.json({ ok: true });
    }

    // Otherwise, delete the entire lab
    const lab = await db.lab.findUnique({ where: { id: labId } });
    if (!lab) {
      return NextResponse.json({ error: "Lab not found." }, { status: 404 });
    }

    // Delete StudentLab entries first
    await db.studentLab.deleteMany({
      where: { labId },
    });

    // Delete lab (instructors and InstructorLabs cascade delete due to schema)
    await db.lab.delete({ where: { id: labId } });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Lab delete error:", error);
    return NextResponse.json({ error: "Failed to delete lab." }, { status: 500 });
  }
}
