import { NextResponse } from "next/server";
import { provisionVM, callXAPI, getVMIPAddress } from "@/lib/xcp";
import { getSession } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }
    if (session.role !== "admin") {
      return NextResponse.json({ error: "Insufficient permissions." }, { status: 403 });
    }

    const { templateUuid, templateName, vmName, studentName, studentId, accessProtocol } = await request.json();

    if (!templateUuid) {
      return NextResponse.json({ error: "templateUuid is required." }, { status: 400 });
    }

    const vmNameToUse = vmName || templateName || `vm-${Date.now()}`;

    const { uuid: vmUuid, name: finalVmName } = await provisionVM(templateUuid, vmNameToUse);

    try {
      const vmRef = await callXAPI("VM.get_by_uuid", [vmUuid]);
      await callXAPI("VM.start", [vmRef, false, false]);
    } catch (startErr: any) {
      console.error("VM cloned but failed to start:", startErr);
      return NextResponse.json({
        ok: true,
        vmUuid,
        vmName: finalVmName,
        vmIp: null,
        warning: "VM was created but could not be started automatically.",
      });
    }

    let vmIp: string | null = null;
    try {
      await new Promise((resolve) => setTimeout(resolve, 5000));
      vmIp = await getVMIPAddress(vmUuid);
    } catch {
      // IP detection is best-effort
    }

    return NextResponse.json({
      ok: true,
      vmUuid,
      vmName: finalVmName,
      vmIp,
    });
  } catch (error: any) {
    console.error("XCP-ng create VM error:", error);
    return NextResponse.json({ error: "Failed to create VM on XCP-ng." }, { status: 502 });
  }
}
