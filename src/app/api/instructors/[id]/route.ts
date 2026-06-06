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
    const instructor = await db.instructor.findUnique({
      where: { id: parseInt(id) },
      include: { lab: true, instructorLabs: { select: { labId: true } } },
    });
    if (!instructor) {
      return NextResponse.json({ error: "Instructor not found." }, { status: 404 });
    }
    return NextResponse.json({
      id: instructor.id,
      username: instructor.username,
      displayName: instructor.displayName,
      email: instructor.email,
      labId: instructor.labId,
      labIds: [instructor.labId, ...instructor.instructorLabs.map(il => il.labId).filter(id => id !== instructor.labId)],
      labName: instructor.lab?.name || null,
      showGrades: instructor.showGrades,
      createdAt: instructor.createdAt.toISOString(),
    });
  } catch (error) {
    console.error("Instructor get error:", error);
    return NextResponse.json({ error: "Failed to load instructor." }, { status: 500 });
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
    const { id } = await params;
    const instructorId = parseInt(id);

    if (session.role !== "admin") {
      if (session.role !== "instructor" || session.userId !== instructorId) {
        return NextResponse.json({ error: "Insufficient permissions." }, { status: 403 });
      }
    }

    const data = await request.json();

    const updateData: Record<string, unknown> = {};
    
    // Both admin and the instructor can update showGrades
    if (typeof data.showGrades === "boolean") updateData.showGrades = data.showGrades;
    
    // Only admin can update other fields
    if (session.role === "admin") {
      if (typeof data.displayName === "string") updateData.displayName = data.displayName.trim();
      if (typeof data.email === "string") updateData.email = data.email.trim() || null;
      if (data.email === null) updateData.email = null;
      if (typeof data.password === "string" && data.password.length > 0) {
        // Always hash passwords before storing — never store plaintext
        const { hashPassword } = await import("@/lib/auth");
        updateData.password = await hashPassword(data.password);
      }
      if (data.labId !== undefined && data.labId !== null) {
        const lab = await db.lab.findUnique({ where: { id: parseInt(data.labId) } });
        if (!lab) {
          return NextResponse.json({ error: "Lab not found." }, { status: 400 });
        }
        updateData.labId = parseInt(data.labId);
      }
    }

    if (Object.keys(updateData).length === 0 && !data.labIds) {
      return NextResponse.json({ error: "No fields to update." }, { status: 400 });
    }

    // Update instructorLab records if labIds is provided (admin only)
    if (session.role === "admin" && Array.isArray(data.labIds)) {
      const newLabIds = data.labIds.map((lid: number) => parseInt(String(lid)));

      // Ensure primary labId is always in the list
      const primaryLabId = data.labId ? parseInt(String(data.labId)) : (updateData.labId as number | undefined);
      const currentInstructor = await db.instructor.findUnique({
        where: { id: instructorId },
        select: { labId: true },
      });
      const effectivePrimaryLabId = primaryLabId || currentInstructor?.labId;

      if (effectivePrimaryLabId && !newLabIds.includes(effectivePrimaryLabId)) {
        newLabIds.push(effectivePrimaryLabId);
      }

      // Get current InstructorLab records
      const currentLabs = await db.instructorLab.findMany({
        where: { instructorId },
        select: { labId: true },
      });
      const currentLabIds = new Set([currentInstructor?.labId, ...currentLabs.map(il => il.labId)]);
      const targetLabIds = new Set(newLabIds);

      // Delete records that are no longer needed (but not the primary lab)
      const toDelete = [...currentLabIds].filter(lid => !targetLabIds.has(lid) && lid !== effectivePrimaryLabId);
      // Add records that are new (but not the primary lab, since that's stored in instructor.labId)
      const toAdd = [...targetLabIds].filter(lid => !currentLabIds.has(lid) && lid !== effectivePrimaryLabId);

      if (toDelete.length > 0) {
        await db.instructorLab.deleteMany({
          where: {
            instructorId,
            labId: { in: toDelete },
          },
        });
      }

      if (toAdd.length > 0) {
        await db.instructorLab.createMany({
          data: toAdd.map(labId => ({ instructorId, labId })),
        });
      }
    }

    if (Object.keys(updateData).length > 0) {
      await db.instructor.update({
        where: { id: instructorId },
        data: updateData,
      });
    }

    return NextResponse.json({ ok: true, id: instructorId });
  } catch (error) {
    console.error("Instructor update error:", error);
    return NextResponse.json({ error: "Failed to update instructor." }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }
    if (session.role !== "admin") {
      return NextResponse.json({ error: "Insufficient permissions." }, { status: 403 });
    }

    const { id } = await params;
    const instructorId = parseInt(id);

    const instructor = await db.instructor.findUnique({
      where: { id: instructorId },
      include: { instructorLabs: { select: { labId: true } } },
    });
    if (!instructor) {
      return NextResponse.json({ error: "Instructor not found." }, { status: 404 });
    }

    // Check all labs the instructor is assigned to
    const allLabIds = [instructor.labId, ...instructor.instructorLabs.map(il => il.labId)];
    for (const labId of allLabIds) {
      // Count instructors for this lab (primary + InstructorLab)
      const primaryCount = await db.instructor.count({ where: { labId } });
      const secondaryCount = await db.instructorLab.count({ where: { labId } });
      const totalInstructors = primaryCount + secondaryCount - 1; // subtract 1 because the current instructor is counted in both

      if (totalInstructors <= 0) {
        // This was the only instructor for this lab — remove student memberships
        await db.studentLab.deleteMany({ where: { labId } });
      }
    }

    // InstructorLab records cascade delete due to schema
    await db.instructor.delete({ where: { id: instructorId } });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Instructor delete error:", error);
    return NextResponse.json({ error: "Failed to delete instructor." }, { status: 500 });
  }
}
