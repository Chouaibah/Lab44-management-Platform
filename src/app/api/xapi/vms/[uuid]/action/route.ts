import { NextRequest, NextResponse } from "next/server";
import { callXAPI, getVMIPAddress } from "@/lib/xcp";
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
    const { action } = await req.json();
    const vmRef = await callXAPI("VM.get_by_uuid", [uuid]);

    let method = "";
    let methodParams: any[] = [];
    switch (action) {
      case "start": method = "VM.start"; methodParams = [vmRef, false, false]; break;
      case "stop": method = "VM.hard_shutdown"; methodParams = [vmRef]; break;
      case "reboot": method = "VM.hard_reboot"; methodParams = [vmRef]; break;
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
    return NextResponse.json({ error: "Failed to execute VM action." }, { status: 500 });
  }
}
