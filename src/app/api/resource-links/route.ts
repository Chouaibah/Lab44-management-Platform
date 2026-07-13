import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth, requireRole } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    const session = await requireAuth();
    const { searchParams } = new URL(request.url);
    const labId = searchParams.get("labId");
    if (!labId) return NextResponse.json({ links: [] });

    // Students: verify enrollment in the lab
    if (session.role === "student") {
      const enrollment = await db.studentLab.findFirst({
        where: { studentId: session.userId, labId: parseInt(labId) },
      });
      if (!enrollment) {
        return NextResponse.json({ links: [] });
      }
    }

    const where: any = { labId: parseInt(labId) };
    if (session.role === "student") {
      where.hidden = { not: true };
    }
    const links = await db.resourceLink.findMany({
      where,
      orderBy: [{ order: "asc" }, { createdAt: "desc" }],
    });

    return NextResponse.json({ links });
  } catch {
    return NextResponse.json({ links: [] });
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireRole("admin", "instructor");
    const { title, url, description, labId } = await request.json();

    if (!title?.trim() || !url?.trim() || !labId) {
      return NextResponse.json({ error: "Title, URL, and Lab are required." }, { status: 400 });
    }

    const link = await db.resourceLink.create({
      data: {
        title: title.trim(),
        url: url.trim(),
        description: description?.trim() || null,
        labId: parseInt(labId),
        addedBy: session.username || null,
      },
    });

    return NextResponse.json({ ok: true, link });
  } catch {
    return NextResponse.json({ error: "Failed to create link." }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const session = await requireRole("admin", "instructor");
    const { id, title, url, description, hidden } = await request.json();
    if (!id) return NextResponse.json({ error: "ID required." }, { status: 400 });

    const data: Record<string, unknown> = {};
    if (title !== undefined) data.title = title.trim();
    if (url !== undefined) data.url = url.trim();
    if (description !== undefined) data.description = description?.trim() || null;
    if (hidden !== undefined) data.hidden = hidden;

    await db.resourceLink.update({ where: { id: parseInt(id) }, data });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Failed to update link." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await requireRole("admin", "instructor");
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "ID required." }, { status: 400 });

    await db.resourceLink.delete({ where: { id: parseInt(id) } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Failed to delete link." }, { status: 500 });
  }
}
