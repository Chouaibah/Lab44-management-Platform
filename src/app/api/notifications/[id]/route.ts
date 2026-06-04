import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const { id } = await params;
    const notificationId = parseInt(id);

    const notification = await db.notification.findUnique({
      where: { id: notificationId },
    });

    if (!notification) {
      return NextResponse.json({ error: "Notification not found." }, { status: 404 });
    }

    // Only the owner can mark as read
    if (notification.userId !== session.userId || notification.userRole !== session.role) {
      // Admin can also mark others' notifications
      if (session.role !== "admin") {
        return NextResponse.json({ error: "Not authorized." }, { status: 403 });
      }
    }

    await db.notification.update({
      where: { id: notificationId },
      data: { read: true },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Notification mark read error:", error);
    return NextResponse.json({ error: "Failed to mark notification as read." }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const { id } = await params;
    const notificationId = parseInt(id);

    const notification = await db.notification.findUnique({
      where: { id: notificationId },
    });

    if (!notification) {
      return NextResponse.json({ error: "Notification not found." }, { status: 404 });
    }

    // Only the owner or admin can delete
    if (notification.userId !== session.userId || notification.userRole !== session.role) {
      if (session.role !== "admin") {
        return NextResponse.json({ error: "Not authorized." }, { status: 403 });
      }
    }

    await db.notification.delete({
      where: { id: notificationId },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Notification delete error:", error);
    return NextResponse.json({ error: "Failed to delete notification." }, { status: 500 });
  }
}
