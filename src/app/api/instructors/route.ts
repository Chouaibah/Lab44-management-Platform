import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { getSession, hashPassword, generateSecurePassword } from "@/lib/auth";
import { logAudit } from "@/lib/audit-log";
import {
  createOwnCloudUser,
  storeInstructorOwnCloudPassword,
} from "@/lib/owncloud";

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }
    // Students have no business browsing the instructor directory
    if (session.role !== "admin" && session.role !== "instructor") {
      return NextResponse.json({ error: "Insufficient permissions." }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const labId = searchParams.get("labId");

    // Instructors may only list instructors for their own labs
    let where: { labId?: number } = labId ? { labId: parseInt(labId) } : {};
    if (session.role === "instructor") {
      // Get all labs this instructor is assigned to
      const instructorLabs = await db.instructorLab.findMany({
        where: { instructorId: session.userId },
        select: { labId: true },
      });
      const myLabIds = [session.labId, ...instructorLabs.map(il => il.labId)];
      if (labId) {
        if (!myLabIds.includes(parseInt(labId))) {
          return NextResponse.json({ error: "You can only view instructors for your own labs." }, { status: 403 });
        }
        where = { labId: parseInt(labId) };
      } else {
        // Show instructors that share any lab with this instructor
        where = { labId: { in: myLabIds } as unknown as number };
      }
    }

    const instructors = await db.instructor.findMany({
      where,
      include: { lab: true, instructorLabs: { select: { labId: true } } },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(
      instructors.map((i) => ({
        id: i.id,
        username: i.username,
        displayName: i.displayName,
        email: i.email,
        labId: i.labId,
        labIds: [i.labId, ...i.instructorLabs.map(il => il.labId).filter(id => id !== i.labId)],
        labName: i.lab?.name || null,
        showGrades: i.showGrades,
        createdAt: i.createdAt.toISOString(),
      }))
    );
  } catch (error) {
    console.error("Instructors list error:", error);
    return NextResponse.json({ error: "Failed to load instructors." }, { status: 500 });
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

    const { username, password, displayName, labId, labIds, securityQuestion, securityAnswer } = await request.json();

    if (!username || !password || !displayName) {
      return NextResponse.json(
        { error: "Username, password, and display name are required." },
        { status: 400 }
      );
    }

    if (labId) {
      const lab = await db.lab.findUnique({ where: { id: parseInt(labId) } });
      if (!lab) {
        return NextResponse.json({ error: "Lab not found." }, { status: 400 });
      }
    } else {
      return NextResponse.json({ error: "Lab ID is required." }, { status: 400 });
    }

    const hashedPassword = await hashPassword(password);

    // Hash security answer if provided
    const hashedSecurityAnswer = securityAnswer
      ? await hash(securityAnswer.trim().toLowerCase(), 12)
      : null;

    const primaryLabId = parseInt(labId);

    // Create instructor with InstructorLab records
    const instructor = await db.instructor.create({
      data: {
        username: username.trim(),
        password: hashedPassword,
        displayName: displayName.trim(),
        labId: primaryLabId,
        securityQuestion: securityQuestion || null,
        securityAnswer: hashedSecurityAnswer,
        // Create InstructorLab records for all assigned labs
        instructorLabs: {
          create: Array.from(new Set([
            primaryLabId,
            ...(Array.isArray(labIds) ? labIds.map((id: number) => parseInt(String(id))) : []),
          ])).filter((id) => id !== primaryLabId).map((id) => ({
            labId: id,
          })),
        },
      },
      include: { instructorLabs: { select: { labId: true } } },
    });

    await logAudit({
      type: "auth",
      action: "create",
      message: `Admin created instructor "${instructor.username}" (${instructor.displayName})`,
      userId: session.userId,
      userRole: "admin",
      labId: primaryLabId,
    });

    // Create the OwnCloud account with its OWN random password (non-blocking).
    //
    // This deliberately does NOT reuse the platform password the admin typed.
    // Separate credentials mean changing one cannot silently invalidate the
    // other, and it matches what the ownCloud button already assumes. The
    // password is stored encrypted so the instructor can retrieve it there
    // (OwnCloud has no URL-based auto-login).
    const ocPassword = generateSecurePassword(16);
    const ocResult = await createOwnCloudUser(
      username.trim(),
      ocPassword,
      displayName.trim()
    );

    if (!ocResult.ok) {
      console.warn(`OwnCloud account creation for instructor "${username}" failed: ${ocResult.error}`);
    } else if (ocResult.created) {
      try {
        await storeInstructorOwnCloudPassword(username.trim(), ocPassword);
      } catch (storeErr) {
        console.warn(`Failed to store OwnCloud password for "${username}":`, storeErr);
      }
    } else {
      // The account already existed, so the password above was never applied.
      // Storing it would hand the instructor a password that does not work;
      // the ownCloud button resets and stores one on first use instead.
      console.log(
        `[OwnCloud] Account for "${username}" already existed — left its password unchanged.`,
      );
    }

    return NextResponse.json({
      ok: true,
      id: instructor.id,
      username: instructor.username,
      labIds: [instructor.labId, ...instructor.instructorLabs.map(il => il.labId)],
    });
  } catch (error: unknown) {
    const err = error as { code?: string };
    if (err.code === "P2002") {
      return NextResponse.json({ error: "Username already exists." }, { status: 409 });
    }
    console.error("Instructor create error:", error);
    return NextResponse.json({ error: "Failed to create instructor." }, { status: 500 });
  }
}
