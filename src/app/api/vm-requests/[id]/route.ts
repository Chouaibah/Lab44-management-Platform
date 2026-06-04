import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

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
