import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { approveVMRequest } from "@/lib/vm-approval";
import { logAudit } from "@/lib/audit-log";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session || (session.role !== "admin" && session.role !== "instructor")) {
      return NextResponse.json({ error: "Admin or instructor access required." }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const { note, vmIp, accessProtocol } = body;

    const result = await approveVMRequest({
      id: parseInt(id),
      note,
      vmIp,
      accessProtocol,
      startVM: false,
    });

    // A provisioning failure is not an approval — report it as such.
    if (result.ok === false) {
      await logAudit({
        type: "vm",
        action: "update",
        message: `VM request #${id} approval failed: ${result.error}`,
        userId: session.userId,
        userRole: session.role,
        labId: session.labId,
        metadata: { requestId: id, vmIp, accessProtocol, error: result.error },
      });
      return NextResponse.json(result, { status: 502 });
    }

    await logAudit({
      type: "vm",
      action: "approve",
      message: `VM request #${id} approved`,
      userId: session.userId,
      userRole: session.role,
      labId: session.labId,
      metadata: { requestId: id, vmIp, accessProtocol },
    });

    return NextResponse.json(result);
  } catch (error: any) {
    if (error.message === "Request not found.") {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    console.error("VM request approve error:", error);
    return NextResponse.json({ error: "Failed to approve request." }, { status: 500 });
  }
}
