import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

// POST /api/messages/mark-read — Mark all messages from a specific user as read
export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const { senderId, senderRole } = await request.json();
    if (!senderId || !senderRole) {
      return NextResponse.json({ error: "senderId and senderRole are required." }, { status: 400 });
    }

    const result = await db.message.updateMany({
      where: {
        senderId: parseInt(String(senderId)),
        senderRole,
        receiverId: session.userId,
        receiverRole: session.role,
        read: false,
      },
      data: {
        read: true,
      },
    });

    return NextResponse.json({ ok: true, count: result.count });
  } catch (error) {
    console.error("Mark read error:", error);
    return NextResponse.json({ error: "Failed to mark messages as read." }, { status: 500 });
  }
}
