import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { approveVMRequest } from "@/lib/vm-approval";

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const studentDbId = searchParams.get("studentDbId");
    const labId = searchParams.get("labId");

    // Students can only view their own requests
    if (session.role === "student") {
      const studentIdParam = searchParams.get("studentDbId");
      console.log("[VM-REQUESTS] Student lookup:", { sessionUserId: session.userId, studentIdParam, match: session.userId === parseInt(studentIdParam || "NaN") });
      if (!studentIdParam || session.userId !== parseInt(studentIdParam)) {
        return NextResponse.json({ requests: [] });
      }
    }

    if (studentDbId) {
      // Exclude instructor-created VMs (studentId starts with "ins-")
      const isStudentQuery = session.role === "student";
      const requests = await db.vMRequest.findMany({
        where: {
          studentDbId: parseInt(studentDbId),
          ...(isStudentQuery ? { studentId: { not: { startsWith: "ins-" } } } : {}),
        },
        orderBy: { requestedAt: "desc" },
      });
      return NextResponse.json({
        requests: requests.map(mapRequest),
      });
    }

    let where: any = {};
    if (labId && (session.role === "admin" || session.role === "instructor")) {
      const parsedLabId = parseInt(labId);
      const labStudents = await db.studentLab.findMany({
        where: { labId: parsedLabId },
        select: { studentId: true },
      });
      const labStudentIds = labStudents.map(sl => sl.studentId);
      where = {
        OR: [
          { labId: parsedLabId },
          { labId: null, studentDbId: { in: labStudentIds } }
        ]
      };
    }

    const requests = await db.vMRequest.findMany({
      where,
      orderBy: [
        { status: "asc" },
        { requestedAt: "desc" },
      ],
    });
    return NextResponse.json({ requests: requests.map(mapRequest) });
  } catch (error) {
    console.error("VM requests error:", error);
    return NextResponse.json({ error: "Failed to load requests." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }
    if (session.role !== "student") {
      return NextResponse.json({ error: "Insufficient permissions." }, { status: 403 });
    }

    const body = await request.json();
    const { studentDbId, studentName, studentId, labId, templateUuid, templateName, accessProtocol } = body;

    // Students can only create requests for themselves
    if (session.userId !== parseInt(studentDbId)) {
      return NextResponse.json({ error: "You can only create VM requests for yourself." }, { status: 403 });
    }

    if (!studentDbId || !studentName || !studentId) {
      return NextResponse.json({ error: "Missing fields." }, { status: 400 });
    }
    if (!templateUuid || !templateName) {
      return NextResponse.json({ error: "Please select a template." }, { status: 400 });
    }

    // Check for duplicate pending request
    const dupPending = await db.vMRequest.findFirst({
      where: {
        studentDbId: parseInt(studentDbId),
        templateUuid,
        status: "pending",
      },
    });
    if (dupPending) {
      return NextResponse.json(
        { error: "You already have a pending request for this template." },
        { status: 409 }
      );
    }

    const vmRequest = await db.vMRequest.create({
      data: {
        studentDbId: parseInt(studentDbId),
        studentName,
        studentId,
        labId: labId ? parseInt(labId) : null,
        templateUuid,
        templateName,
        accessProtocol: accessProtocol || "ssh",
      },
    });

    // Check if the lab has auto-approve enabled
    let autoApproved = false;
    if (labId) {
      try {
        const lab = await db.lab.findUnique({ where: { id: parseInt(labId) }, select: { autoApprove: true } });
        if (lab?.autoApprove) {
          // `labId` comes from the client, so verify the student is actually
          // enrolled in it before auto-approving — otherwise a student could
          // self-approve by naming any auto-approve lab.
          const enrolled = vmRequest.studentDbId
            ? await db.studentLab.findUnique({
                where: {
                  studentId_labId: {
                    studentId: vmRequest.studentDbId,
                    labId: parseInt(labId),
                  },
                },
              })
            : null;

          if (!enrolled) {
            console.warn(
              `[Auto-Approve] Skipped request ${vmRequest.id}: student is not enrolled in lab ${labId}`,
            );
          } else {
            // Auto-approve the request in the background
            approveVMRequest({
              id: vmRequest.id,
              accessProtocol: accessProtocol || "ssh",
              startVM: true,
            }).then((result) => {
              if (result.ok === false) {
                console.warn(`[Auto-Approve] VM request ${vmRequest.id} failed: ${result.error}`);
              } else {
                console.log(`[Auto-Approve] VM request ${vmRequest.id} auto-approved`);
              }
            }).catch((err) => {
              console.error(`[Auto-Approve] Failed for VM request ${vmRequest.id}:`, err);
            });
            autoApproved = true;
          }
        }
      } catch (err) {
        console.error("[Auto-Approve] Check failed:", err);
      }
    }

    return NextResponse.json({ ok: true, id: vmRequest.id, autoApproved });
  } catch (error) {
    console.error("VM request create error:", error);
    return NextResponse.json({ error: "Failed to submit request." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }
    if (session.role !== "admin" && session.role !== "instructor") {
      return NextResponse.json({ error: "Insufficient permissions." }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const all = searchParams.get("all");

    if (all === "true") {
      await db.vMRequest.deleteMany({});
    } else {
      await db.vMRequest.deleteMany({ where: { status: { not: "pending" } } });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("VM requests delete error:", error);
    return NextResponse.json({ error: "Failed to delete requests." }, { status: 500 });
  }
}

function mapRequest(r: Record<string, unknown>) {
  return {
    id: r.id as number,
    studentDbId: r.studentDbId as number,
    studentName: r.studentName as string,
    studentId: r.studentId as string,
    labId: r.labId as number | null,
    templateUuid: r.templateUuid as string | null,
    templateName: r.templateName as string | null,
    status: r.status as string,
    note: r.note as string | null,
    vmUuid: r.vmUuid as string | null,
    vmName: r.vmName as string | null,
    vmIp: r.vmIp as string | null,
    accessProtocol: r.accessProtocol as string | null,
    guacUsername: r.guacUsername as string | null,
    guacConnectionId: r.guacConnectionId as string | null,
    guacDataSource: r.guacDataSource as string | null,
    guacProtocol: r.guacProtocol as string | null,
    requestedAt: (r.requestedAt as Date).toISOString(),
    reviewedAt: r.reviewedAt ? (r.reviewedAt as Date).toISOString() : null,
  };
}
