import { NextRequest, NextResponse } from "next/server";
import { callXAPI, getVMIPAddress, setVMResources } from "@/lib/xcp";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ uuid: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }
    if (session.role !== "admin" && session.role !== "instructor" && session.role !== "student") {
      return NextResponse.json({ error: "Insufficient permissions." }, { status: 403 });
    }

    const { uuid } = await params;

    // Students may only control VMs that belong to their own approved VM request.
    // Admins and instructors may control any VM.
    if (session.role === "student") {
      const ownedRequest = await db.vMRequest.findFirst({
        where: {
          vmUuid: uuid,
          studentDbId: session.userId,
        },
      });
      if (!ownedRequest) {
        return NextResponse.json({ error: "You do not have permission to control this VM." }, { status: 403 });
      }
    }
    const { action, vmName, vcpus, memoryMB } = await req.json();
    const vmRef = await callXAPI("VM.get_by_uuid", [uuid]);

    let method = "";
    let methodParams: any[] = [];
    switch (action) {
      case "start": method = "VM.start"; methodParams = [vmRef, false, false]; break;
      case "stop": method = "VM.hard_shutdown"; methodParams = [vmRef]; break;
      case "reboot": method = "VM.hard_reboot"; methodParams = [vmRef]; break;
      case "destroy":
        try {
          try { await callXAPI("VM.hard_shutdown", [vmRef]); } catch { /* already off */ }
          await new Promise(r => setTimeout(r, 2000));
          await callXAPI("VM.destroy", [vmRef]);
          await db.vMRequest.deleteMany({ where: { vmUuid: uuid } });
          return NextResponse.json({ message: "VM destroyed successfully" });
        } catch (destroyErr: any) {
          console.error("VM destroy error:", destroyErr);
          return NextResponse.json({ error: `Failed to destroy VM: ${destroyErr.message || destroyErr}` }, { status: 500 });
        }
      case "convert-to-template":
        try {
          if (vmName) await callXAPI("VM.set_name_label", [vmRef, vmName]);
          await callXAPI("VM.set_is_a_template", [vmRef, true]);
          await db.vMRequest.deleteMany({ where: { vmUuid: uuid } });
          return NextResponse.json({ message: "VM converted to template successfully" });
        } catch (err: any) {
          const msg = (err.message || String(err)).toLowerCase();
          if (msg.includes("bad_power_state") || msg.includes("running")) {
            return NextResponse.json({ error: "You need to turn OFF the VM first before converting to template." }, { status: 400 });
          }
          return NextResponse.json({ error: `Failed to convert VM: ${err.message || err}` }, { status: 500 });
        }
      case "set-resources":
        try {
          const memoryBytes = (memoryMB || 1024) * 1024 * 1024;
          await setVMResources(uuid, vcpus || 1, memoryBytes);
          return NextResponse.json({ message: "VM resources updated successfully" });
        } catch (err: any) {
          return NextResponse.json({ error: `Failed to update VM resources: ${err.message || err}` }, { status: 500 });
        }
      default: return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    await callXAPI(method, methodParams);

    // After start/reboot, wait and fetch the new IP
    let newIp: string | null = null;
    if (action === "start" || action === "reboot") {
      // Wait for VM to boot and get IP
      await new Promise((resolve) => setTimeout(resolve, 8000));
      try {
        newIp = await getVMIPAddress(uuid);
        if (newIp && newIp !== "127.0.0.1") {
          // Update the IP in the database
          try {
            await db.vMRequest.updateMany({
              where: { vmUuid: uuid },
              data: { vmIp: newIp },
            });
          } catch {
            /* ignore DB update failure */
          }
        } else {
          newIp = null;
        }
      } catch {
        /* IP not available yet — non-fatal */
      }
    }

    return NextResponse.json({
      message: `VM ${action} successful`,
      ...(newIp ? { vmIp: newIp } : {}),
    });
  } catch (err: any) {
    console.error("XAPI VM action error:", err);
    const msg = (err.message || String(err)).toLowerCase();
    if (action === "start" && (msg.includes("bad_power_state") || msg.includes("already") || msg.includes("running"))) {
      return NextResponse.json({ error: "VM is already running." }, { status: 400 });
    }
    if (action === "stop" && (msg.includes("bad_power_state") || msg.includes("already") || msg.includes("halted"))) {
      return NextResponse.json({ error: "VM is already stopped." }, { status: 400 });
    }
    if (action === "reboot" && msg.includes("bad_power_state")) {
      return NextResponse.json({ error: "VM must be running to reboot." }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to execute VM action." }, { status: 500 });
  }
}
