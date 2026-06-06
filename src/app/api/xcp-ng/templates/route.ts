import { NextResponse } from "next/server";
import { callXAPI } from "@/lib/xcp";
import { getSession } from "@/lib/auth";

export async function GET() {
  try {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }
  if (session.role !== "admin" && session.role !== "instructor" && session.role !== "student") {
    return NextResponse.json({ error: "Insufficient permissions." }, { status: 403 });
  }

    const vms = await callXAPI("VM.get_all_records", []);

    const templates = Object.entries(vms)
      .filter(([, v]: [string, any]) => v.is_a_template && !v.is_a_snapshot && !v.is_control_domain)
      .map(([, v]: [string, any]) => ({
        uuid: v.uuid,
        name: v.name_label,
        description: v.name_description || undefined,
        isDefaultTemplate: v.is_default_template || false,
        VCPUsMax: parseInt(v.VCPUs_max) || undefined,
        memoryStaticMax: parseInt(v.memory_static_max) || undefined,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json({ templates });
  } catch (err: any) {
    console.error("XCP-ng templates fetch error:", err);
    return NextResponse.json({ error: "Failed to fetch templates from XCP-ng." }, { status: 502 });
  }
}
