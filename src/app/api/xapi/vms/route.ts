import { NextResponse } from "next/server";
import { callXAPI } from "@/lib/xcp";
import { getSession } from "@/lib/auth";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }
    if (session.role !== "admin" && session.role !== "instructor") {
      return NextResponse.json({ error: "Insufficient permissions." }, { status: 403 });
    }

    const vms = await callXAPI("VM.get_all_records", []);
    const filteredVms = Object.entries(vms)
      .filter(([, v]: [string, any]) => !v.is_a_template && !v.is_control_domain)
      .map(([, v]: [string, any]) => ({
        uuid: v.uuid,
        name: v.name_label,
        desc: v.name_description,
        power_state: v.power_state,
      }));
    return NextResponse.json({ ok: true, vms: filteredVms });
  } catch (err: any) {
    console.error("XAPI VMs list error:", err);
    return NextResponse.json({ error: "Failed to list VMs." }, { status: 500 });
  }
}
