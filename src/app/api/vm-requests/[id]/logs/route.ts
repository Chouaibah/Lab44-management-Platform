import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getVMLogs } from "@/lib/xcp";
import { getSession } from "@/lib/auth";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }
    if (session.role !== "admin" && session.role !== "instructor") {
      return NextResponse.json({ error: "Insufficient permissions." }, { status: 403 });
    }

    const { id } = await params;
    const request = await db.vMRequest.findUnique({
      where: { id: parseInt(id) },
    });
    if (!request || !request.vmUuid) {
      return NextResponse.json(
        { error: "VM not found or not provisioned" },
        { status: 404 }
      );
    }
    const logs = await getVMLogs(request.vmUuid);
    return NextResponse.json({ logs });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch logs" },
      { status: 500 }
    );
  }
}
