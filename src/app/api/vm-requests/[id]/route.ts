import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { approveVMRequest } from "@/lib/vm-approval";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session || (session.role !== "admin" && session.role !== "instructor")) {
      return NextResponse.json({ error: "Admin or instructor access required." }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { status, vmName, accessProtocol, vmIp, note } = body;

    if (status === "approved") {
      const result = await approveVMRequest({
        id: parseInt(id),
        note: note || null,
        vmIp: vmIp || null,
        accessProtocol: accessProtocol || null,
        startVM: false,
      });
      return NextResponse.json({ ok: true, ...result });
    }

    if (status === "rejected") {
      await db.vMRequest.update({
        where: { id: parseInt(id) },
        data: {
          status: "rejected",
          note: note || null,
          reviewedAt: new Date(),
        },
      });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Invalid status." }, { status: 400 });
  } catch (error) {
    console.error("VM request PATCH error:", error);
    return NextResponse.json({ error: "Failed to update request." }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session || (session.role !== "admin" && session.role !== "instructor")) {
      return NextResponse.json({ error: "Admin or instructor access required." }, { status: 403 });
    }

    const { id } = await params;
    await db.vMRequest.delete({ where: { id: parseInt(id) } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("VM request delete error:", error);
    return NextResponse.json({ error: "Failed to delete request." }, { status: 500 });
  }
}
