import { NextRequest, NextResponse } from "next/server";
import { callXAPI } from "@/lib/xcp";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function GET(
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
    const vmRef = await callXAPI("VM.get_by_uuid", [uuid]);
    const vmRecord = await callXAPI("VM.get_record", [vmRef]);

    const guestMetricsRef = vmRecord.guest_metrics;
    let networks: any = null;
    let osVersion: any = null;
    if (guestMetricsRef && guestMetricsRef !== "OpaqueRef:NULL") {
      const guestRecord = await callXAPI("VM_guest_metrics.get_record", [guestMetricsRef]);
      networks = guestRecord.networks;
      osVersion = guestRecord.os_version;
    }

    const metricsRef = vmRecord.metrics;
    let vCPUs: any = null;
    let memory: any = null;
    if (metricsRef && metricsRef !== "OpaqueRef:NULL") {
      const mRecord = await callXAPI("VM_metrics.get_record", [metricsRef]);
      memory = mRecord.memory_actual;
      vCPUs = mRecord.VCPUs_number;
    }

    const ip = networks ? (networks["0/ip"] || networks["0/ipv4/0"]) : null;

    // Update IP in database if available
    if (ip && ip !== "127.0.0.1") {
      try {
        await db.vMRequest.updateMany({
          where: { vmUuid: uuid },
          data: { vmIp: ip, updatedAt: new Date() },
        });
      } catch (e) {
        console.error("Failed to update vm_requests IP:", e);
      }
    }

    return NextResponse.json({
      name: vmRecord.name_label,
      power_state: vmRecord.power_state,
      vCPUs_max: vmRecord.VCPUs_max,
      vCPUs_live: vCPUs,
      memory_dynamic_max: vmRecord.memory_dynamic_max,
      memory_actual: memory,
      networks,
      ip,
      osVersion,
    });
  } catch (err: any) {
    console.error("XAPI VM details error:", err);
    return NextResponse.json({ error: "Failed to get VM details." }, { status: 500 });
  }
}
