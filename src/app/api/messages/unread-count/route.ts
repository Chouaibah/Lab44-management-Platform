import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

// GET /api/messages/unread-count — Get unread message count for current user
export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ count: 0 });
    }

    const count = await db.message.count({
      where: {
        receiverId: session.userId,
        receiverRole: session.role,
        read: false,
      },
    });

    return NextResponse.json({ count });
  } catch (error) {
    console.error("Unread count error:", error);
    return NextResponse.json({ count: 0 });
  }
}
