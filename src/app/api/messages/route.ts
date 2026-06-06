import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { logAudit } from "@/lib/audit-log";

// ─── Shared helper ────────────────────────────────────────────────────────────

async function resolveUserName(userId: number, role: string): Promise<string> {
  if (role === "student") {
    const student = await db.student.findUnique({ where: { id: userId } });
    return student ? `${student.firstName} ${student.lastName}` : "Unknown Student";
  }
  if (role === "instructor") {
    const instructor = await db.instructor.findUnique({ where: { id: userId } });
    return instructor?.displayName || "Unknown Instructor";
  }
  return "Admin";
}

// ─── Build conversations list ─────────────────────────────────────────────────

async function buildConversations(userId: number, userRole: string) {
  const [sent, received] = await Promise.all([
    db.message.findMany({
      where: { senderId: userId, senderRole: userRole },
      orderBy: { createdAt: "desc" },
      select: { receiverId: true, receiverRole: true, content: true, createdAt: true },
    }),
    db.message.findMany({
      where: { receiverId: userId, receiverRole: userRole },
      orderBy: { createdAt: "desc" },
      select: { senderId: true, senderRole: true, content: true, createdAt: true },
    }),
  ]);

  const partners = new Map<string, { id: number; role: string; lastMessage: string; lastMessageAt: Date }>();

  for (const m of sent) {
    const key = `${m.receiverId}-${m.receiverRole}`;
    const existing = partners.get(key);
    if (!existing || m.createdAt > existing.lastMessageAt) {
      partners.set(key, { id: m.receiverId, role: m.receiverRole, lastMessage: m.content, lastMessageAt: m.createdAt });
    }
  }
  for (const m of received) {
    const key = `${m.senderId}-${m.senderRole}`;
    const existing = partners.get(key);
    if (!existing || m.createdAt > existing.lastMessageAt) {
      partners.set(key, { id: m.senderId, role: m.senderRole, lastMessage: m.content, lastMessageAt: m.createdAt });
    }
  }

  const conversations = await Promise.all(
    Array.from(partners.values()).map(async (p) => {
      const [unreadCount, name] = await Promise.all([
        db.message.count({
          where: { senderId: p.id, senderRole: p.role, receiverId: userId, receiverRole: userRole, read: false },
        }),
        resolveUserName(p.id, p.role),
      ]);
      return {
        userId: p.id,
        userRole: p.role,
        userName: name,
        lastMessage: p.lastMessage,
        lastMessageAt: p.lastMessageAt.toISOString(),
        unreadCount,
      };
    })
  );

  conversations.sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());
  return conversations;
}

// ─── Build available contacts ─────────────────────────────────────────────────

async function buildAvailableContacts(userId: number, role: string) {
  if (role === "student") {
    const studentLabs = await db.studentLab.findMany({
      where: { studentId: userId },
      select: { labId: true },
    });
    const labIds = studentLabs.map((sl) => sl.labId);
    if (!labIds.length) return [];
    const instructors = await db.instructor.findMany({
      where: { labId: { in: labIds } },
      select: { id: true, displayName: true, labId: true },
    });
    return instructors.map((i) => ({ id: i.id, role: "instructor", name: i.displayName, labId: i.labId }));
  }

  if (role === "instructor") {
    const instructor = await db.instructor.findUnique({ where: { id: userId } });
    if (!instructor) return [];
    const studentLabs = await db.studentLab.findMany({
      where: { labId: instructor.labId },
      select: { studentId: true },
    });
    const studentIds = studentLabs.map((sl) => sl.studentId);
    if (!studentIds.length) return [];
    const students = await db.student.findMany({
      where: { id: { in: studentIds } },
      select: { id: true, firstName: true, lastName: true },
    });
    return students.map((s) => ({ id: s.id, role: "student", name: `${s.firstName} ${s.lastName}`, labId: instructor.labId }));
  }

  return [];
}

// ─── GET /api/messages ────────────────────────────────────────────────────────
// ?with=userId&role=role  → conversation thread
// (no params)             → conversations list + available contacts

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const withUserId = searchParams.get("with");
    const withRole = searchParams.get("role");

    // ── Thread view ───────────────────────────────────────────────────────────
    if (withUserId) {
      const otherId = parseInt(withUserId, 10);
      const otherRole = withRole || "student";

      const messages = await db.message.findMany({
        where: {
          OR: [
            { senderId: session.userId, senderRole: session.role, receiverId: otherId, receiverRole: otherRole },
            { senderId: otherId, senderRole: otherRole, receiverId: session.userId, receiverRole: session.role },
          ],
        },
        orderBy: { createdAt: "asc" },
        take: 200,
      });

      const [selfName, peerName] = await Promise.all([
        resolveUserName(session.userId, session.role),
        resolveUserName(otherId, otherRole),
      ]);

      return NextResponse.json({
        messages: messages.map((m) => ({
          id: m.id,
          senderId: m.senderId,
          senderRole: m.senderRole,
          receiverId: m.receiverId,
          receiverRole: m.receiverRole,
          labId: m.labId,
          content: m.content,
          read: m.read,
          createdAt: m.createdAt.toISOString(),
          senderName: m.senderId === session.userId ? selfName : peerName,
          receiverName: m.receiverId === session.userId ? selfName : peerName,
        })),
        peer: { id: otherId, role: otherRole, name: peerName },
        self: { id: session.userId, role: session.role, name: selfName },
      });
    }

    // ── Inbox / conversations list ─────────────────────────────────────────────
    const [conversations, availableContacts] = await Promise.all([
      buildConversations(session.userId, session.role),
      buildAvailableContacts(session.userId, session.role),
    ]);

    return NextResponse.json({ conversations, availableContacts });
  } catch (error) {
    console.error("Messages GET error:", error);
    return NextResponse.json({ error: "Failed to load messages." }, { status: 500 });
  }
}

// ─── POST /api/messages ───────────────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const { receiverId, receiverRole, content, labId } = await request.json();

    if (!receiverId || !receiverRole || !content?.trim()) {
      return NextResponse.json({ error: "receiverId, receiverRole, and content are required." }, { status: 400 });
    }
    if (!["student", "instructor", "admin"].includes(receiverRole)) {
      return NextResponse.json({ error: "Invalid receiverRole." }, { status: 400 });
    }

    // Students may only message instructors in their own lab
    if (session.role === "student") {
      const instructor = await db.instructor.findUnique({ where: { id: receiverId } });
      if (!instructor) return NextResponse.json({ error: "Instructor not found." }, { status: 404 });
      const inLab = await db.studentLab.findFirst({ where: { studentId: session.userId, labId: instructor.labId } });
      if (!inLab) return NextResponse.json({ error: "You can only message instructors in your lab." }, { status: 403 });
    }

    // Instructors may only message students in their own lab
    if (session.role === "instructor" && receiverRole === "student") {
      const instructor = await db.instructor.findUnique({ where: { id: session.userId } });
      if (!instructor) return NextResponse.json({ error: "Instructor not found." }, { status: 404 });
      const inLab = await db.studentLab.findFirst({ where: { studentId: receiverId, labId: instructor.labId } });
      if (!inLab) return NextResponse.json({ error: "You can only message students in your lab." }, { status: 403 });
    }

    const message = await db.message.create({
      data: {
        senderId: session.userId,
        senderRole: session.role,
        receiverId: parseInt(String(receiverId), 10),
        receiverRole,
        labId: labId ? parseInt(String(labId), 10) : null,
        content: content.trim(),
      },
    });

    const [senderName, receiverName] = await Promise.all([
      resolveUserName(session.userId, session.role),
      resolveUserName(message.receiverId, message.receiverRole),
    ]);

    // Notification (non-blocking)
    db.notification.create({
      data: {
        type: "system",
        title: `New message from ${senderName}`,
        message: content.trim().length > 100 ? content.trim().slice(0, 100) + "…" : content.trim(),
        userId: parseInt(String(receiverId), 10),
        userRole: receiverRole,
        read: false,
        labId: labId ? parseInt(String(labId), 10) : null,
        link: "messages",
      },
    }).catch((e) => console.error("Failed to create message notification:", e));

    logAudit({
      type: "data",
      action: "create",
      message: `Message sent from ${senderName} to ${receiverRole}:${receiverId}`,
      userId: session.userId,
      userRole: session.role,
      labId: labId ? parseInt(String(labId), 10) : undefined,
    }).catch(() => {});

    return NextResponse.json({
      ok: true,
      message: {
        id: message.id,
        senderId: message.senderId,
        senderRole: message.senderRole,
        receiverId: message.receiverId,
        receiverRole: message.receiverRole,
        labId: message.labId,
        content: message.content,
        read: message.read,
        createdAt: message.createdAt.toISOString(),
        senderName,
        receiverName,
      },
    });
  } catch (error) {
    console.error("Message POST error:", error);
    return NextResponse.json({ error: "Failed to send message." }, { status: 500 });
  }
}
