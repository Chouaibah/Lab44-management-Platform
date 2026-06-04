import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const unreadOnly = searchParams.get("unread") === "true";

    const where: Record<string, unknown> = {
      userId: session.userId,
      userRole: session.role,
    };

    if (unreadOnly) {
      where.read = false;
    }

    const notifications = await db.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return NextResponse.json(
      notifications.map((n) => ({
        id: n.id,
        type: n.type,
        title: n.title,
        message: n.message,
        userId: n.userId,
        userRole: n.userRole,
        read: n.read,
        labId: n.labId,
        link: n.link,
        createdAt: n.createdAt.toISOString(),
      }))
    );
  } catch (error) {
    console.error("Notifications list error:", error);
    return NextResponse.json({ error: "Failed to load notifications." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }
    if (session.role !== "admin" && session.role !== "instructor") {
      return NextResponse.json({ error: "Insufficient permissions." }, { status: 403 });
    }

    const { type, title, message, userId, userRole, labId, link } = await request.json();
    if (!type || !title || !message || !userId) {
      return NextResponse.json({ error: "type, title, message, and userId are required." }, { status: 400 });
    }

    const validTypes = ["grade", "announcement", "vm", "attendance", "system"];
    const normalizedType = validTypes.includes(type) ? type : "system";

    const notification = await db.notification.create({
      data: {
        type: normalizedType,
        title: title.trim(),
        message: message.trim(),
        userId: parseInt(String(userId)),
        userRole: userRole || "student",
        labId: labId ? parseInt(String(labId)) : null,
        link: link || null,
      },
    });

    return NextResponse.json({
      ok: true,
      id: notification.id,
      notification: {
        id: notification.id,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        userId: notification.userId,
        userRole: notification.userRole,
        read: notification.read,
        labId: notification.labId,
        link: notification.link,
        createdAt: notification.createdAt.toISOString(),
      },
    });
  } catch (error) {
    console.error("Notification create error:", error);
    return NextResponse.json({ error: "Failed to create notification." }, { status: 500 });
  }
}
