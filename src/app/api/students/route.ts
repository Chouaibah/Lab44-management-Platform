import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }
    if (session.role !== "admin" && session.role !== "instructor") {
      return NextResponse.json({ error: "Insufficient permissions." }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const labId = searchParams.get("labId");

    let students;
    if (labId) {
      const studentLabs = await db.studentLab.findMany({
        where: { labId: parseInt(labId) },
        include: { student: true },
      });
      students = studentLabs.map(sl => sl.student);
      students.sort((a, b) => a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName));
    } else {
      students = await db.student.findMany({
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      });
    }

    const allLabs = await db.studentLab.findMany({
      select: { studentId: true, labId: true },
    });

    return NextResponse.json(
      students.map((s) => ({
        id: s.id,
        firstName: s.firstName,
        lastName: s.lastName,
        studentId: s.studentId,
        labIds: allLabs.filter(sl => sl.studentId === s.id).map(sl => sl.labId),
        createdAt: s.createdAt.toISOString(),
        notes: s.notes,
      }))
    );
  } catch (error) {
    console.error("Students list error:", error);
    return NextResponse.json({ error: "Failed to load students." }, { status: 500 });
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

    const { firstName, lastName, studentId } = await request.json();
    if (!firstName || !lastName || !studentId) {
      return NextResponse.json({ error: "Missing fields." }, { status: 400 });
    }
    const student = await db.student.create({
      data: { firstName: firstName.trim(), lastName: lastName.trim(), studentId: studentId.trim() },
    });
    return NextResponse.json({ ok: true, id: student.id });
  } catch (error: unknown) {
    const err = error as { code?: string };
    if (err.code === "P2002") {
      return NextResponse.json({ error: "Student ID already registered." }, { status: 409 });
    }
    console.error("Student create error:", error);
    return NextResponse.json({ error: "Failed to create student." }, { status: 500 });
  }
}
