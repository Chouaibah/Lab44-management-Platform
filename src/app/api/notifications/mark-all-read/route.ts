import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

export async function POST() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const result = await db.notification.updateMany({
      where: {
        userId: session.userId,
        userRole: session.role,
        read: false,
      },
      data: { read: true },
    });

    return NextResponse.json({ ok: true, count: result.count });
  } catch (error) {
    console.error("Mark all read error:", error);
    return NextResponse.json({ error: "Failed to mark all notifications as read." }, { status: 500 });
  }
}
