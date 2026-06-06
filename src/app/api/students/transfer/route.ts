import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { logAudit } from "@/lib/audit-log";

export async function POST(request: Request) {
  try {
    const session = await requireRole("admin");
    if (!session) {
      return NextResponse.json({ error: "Admin access required." }, { status: 403 });
    }

    const body = await request.json();
    const { studentIds, fromLabId, toLabId } = body as {
      studentIds: number[];
      fromLabId?: number;
      toLabId: number;
    };

    if (!Array.isArray(studentIds) || studentIds.length === 0) {
      return NextResponse.json({ error: "studentIds must be a non-empty array." }, { status: 400 });
    }

    if (!toLabId || typeof toLabId !== "number") {
      return NextResponse.json({ error: "toLabId is required." }, { status: 400 });
    }

    // Verify target lab exists
    const targetLab = await db.lab.findUnique({ where: { id: toLabId } });
    if (!targetLab) {
      return NextResponse.json({ error: "Target lab not found." }, { status: 404 });
    }

    // Verify source lab if specified
    if (fromLabId) {
      const sourceLab = await db.lab.findUnique({ where: { id: fromLabId } });
      if (!sourceLab) {
        return NextResponse.json({ error: "Source lab not found." }, { status: 404 });
      }
    }

    let transferred = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const studentId of studentIds) {
      try {
        // Check student exists
        const student = await db.student.findUnique({ where: { id: studentId } });
        if (!student) {
          errors.push(`Student #${studentId}: not found`);
          failed++;
          continue;
        }

        // Check if already in target lab
        const existingInTarget = await db.studentLab.findUnique({
          where: { studentId_labId: { studentId, labId: toLabId } },
        });

        if (existingInTarget) {
          // Student already in target lab - just remove from source if specified
          if (fromLabId) {
            const inSource = await db.studentLab.findUnique({
              where: { studentId_labId: { studentId, labId: fromLabId } },
            });
            if (inSource && fromLabId !== toLabId) {
              await db.studentLab.delete({
                where: { studentId_labId: { studentId, labId: fromLabId } },
              });
            }
          }
          errors.push(`${student.firstName} ${student.lastName}: already in target lab`);
          failed++;
          continue;
        }

        // Remove memberships based on mode
        if (fromLabId) {
          // Mode 1: Move from specific lab only
          const inSource = await db.studentLab.findUnique({
            where: { studentId_labId: { studentId, labId: fromLabId } },
          });
          if (!inSource) {
            errors.push(`${student.firstName} ${student.lastName}: not in source lab`);
            failed++;
            continue;
          }
          await db.studentLab.delete({
            where: { studentId_labId: { studentId, labId: fromLabId } },
          });

          // Remove SousGroupeMemberships from source lab's sous-groupes
          const sourceSousGroupes = await db.sousGroupe.findMany({
            where: { labId: fromLabId },
            select: { id: true },
          });
          if (sourceSousGroupes.length > 0) {
            await db.sousGroupeMember.deleteMany({
              where: {
                studentId,
                sousGroupeId: { in: sourceSousGroupes.map(sg => sg.id) },
              },
            });
          }
        } else {
          // Mode 2: Move ALL memberships - remove from all labs
          await db.studentLab.deleteMany({
            where: { studentId },
          });

          // Remove ALL SousGroupeMemberships
          await db.sousGroupeMember.deleteMany({
            where: { studentId },
          });
        }

        // Create new StudentLab entry for target lab
        await db.studentLab.create({
          data: { studentId, labId: toLabId },
        });

        transferred++;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        errors.push(`Student #${studentId}: ${message}`);
        failed++;
      }
    }

    // Log the transfer to ActivityLog
    await logAudit({
      type: "student",
      action: "update",
      message: `Bulk transfer: ${transferred} student(s) transferred to "${targetLab.name}"${fromLabId ? ` from lab #${fromLabId}` : " (all memberships moved)"}`,
      userId: session.userId,
      userRole: session.role,
      labId: toLabId,
      metadata: {
        studentIds,
        fromLabId: fromLabId || null,
        toLabId,
        transferred,
        failed,
      },
    });

    return NextResponse.json({ ok: true, transferred, failed, errors });
  } catch (error) {
    console.error("Student transfer error:", error);
    return NextResponse.json({ error: "Failed to process transfer." }, { status: 500 });
  }
}
