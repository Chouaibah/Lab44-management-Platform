import { NextResponse } from "next/server";
import { getHostCapacity } from "@/lib/xcp";
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

    const capacity = await getHostCapacity();
    return NextResponse.json(capacity);
  } catch (err: any) {
    console.error("Host capacity fetch error:", err);
    return NextResponse.json({ error: "Failed to fetch host capacity." }, { status: 502 });
  }
}
