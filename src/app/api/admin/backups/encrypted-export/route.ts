import { db } from "@/lib/db";
import { getSettingsMap } from "@/lib/settings-cache";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { encrypt } from "@/lib/backup-crypto";
import archiver from "archiver";
import { Writable } from "stream";

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== "admin") {
      return NextResponse.json({ error: "Admin access required." }, { status: 403 });
    }

    const body = await request.json();
    const password = body.password;

    if (!password || password.length < 4) {
      return NextResponse.json({ error: "Password must be at least 4 characters." }, { status: 400 });
    }

    // Collect all data
    const [settingsMap, labs, instructors, students, columns, grades, announcements, attendance, vmRequests, sousGroupes, messages] =
      await Promise.all([
        getSettingsMap(),
        db.lab.findMany({ include: { studentLabs: true, instructors: true, gradeColumns: true, _count: { select: { studentLabs: true, instructors: true } } } }),
        db.instructor.findMany({ include: { lab: true } }),
        db.student.findMany({ include: { labs: { include: { lab: true } } } }),
        db.gradeColumn.findMany({ orderBy: { id: "asc" } }),
        db.grade.findMany(),
        db.announcement.findMany({ orderBy: [{ pinned: "desc" }, { createdAt: "desc" }] }),
        db.attendance.findMany(),
        db.vMRequest.findMany({ orderBy: { requestedAt: "desc" } }),
        db.sousGroupe.findMany({ include: { members: true } }),
        db.message.findMany({ orderBy: { createdAt: "desc" } }),
      ]);

    const exportData = {
      exportedAt: new Date().toISOString(),
      version: "2.0",
      format: "lab44-encrypted-backup",
      settings: Object.entries(settingsMap).map(([key, value]) => ({ key, value })),
      labs: labs.map((l) => ({
        id: l.id,
        name: l.name,
        description: l.description,
        password: l.password,
        createdAt: l.createdAt.toISOString(),
      })),
      instructors: instructors.map((i) => ({
        id: i.id,
        username: i.username,
        password: i.password,
        displayName: i.displayName,
        email: i.email,
        labId: i.labId,
        createdAt: i.createdAt.toISOString(),
      })),
      students: students.map((s) => ({
        id: s.id,
        firstName: s.firstName,
        lastName: s.lastName,
        studentId: s.studentId,
        password: s.password,
        labIds: s.labs.map((l: { labId: number }) => l.labId),
        createdAt: s.createdAt.toISOString(),
      })),
      gradeColumns: columns.map((c) => ({
        id: c.id,
        name: c.name,
        labId: c.labId,
        createdAt: c.createdAt.toISOString(),
      })),
      grades: grades.map((g) => ({
        studentId: g.studentId,
        columnId: g.columnId,
        value: g.value,
      })),
      announcements: announcements.map((a) => ({
        id: a.id,
        title: a.title,
        content: a.content,
        author: a.author,
        pinned: a.pinned,
        isArchived: a.isArchived,
        labId: a.labId,
        createdAt: a.createdAt.toISOString(),
      })),
      attendance: attendance.map((a) => ({
        id: a.id,
        studentId: a.studentId,
        date: a.date,
        status: a.status,
        note: a.note,
      })),
      sousGroupes: sousGroupes.map((sg) => ({
        id: sg.id,
        name: sg.name,
        labId: sg.labId,
        members: sg.members.map((m: { studentId: number }) => ({ studentId: m.studentId })),
      })),
      messages: messages.map((m) => ({
        id: m.id,
        senderId: m.senderId,
        senderRole: m.senderRole,
        receiverId: m.receiverId,
        receiverRole: m.receiverRole,
        content: m.content,
        read: m.read,
        createdAt: m.createdAt.toISOString(),
      })),
    };

    // Encrypt the JSON data
    const jsonString = JSON.stringify(exportData, null, 2);
    const encryptedData = encrypt(jsonString, password);

    // Create a zip archive
    const archive = archiver("zip", { zlib: { level: 9 } });

    const chunks: Buffer[] = [];
    const writable = new Writable({
      write(chunk: Buffer, _encoding: string, callback: (error?: Error | null) => void) {
        chunks.push(chunk);
        callback();
      },
    });

    archive.pipe(writable);

    // Add encrypted data to zip
    archive.append(encryptedData, { name: "backup.enc" });

    // Add metadata (unencrypted - just version info)
    archive.append(
      JSON.stringify({
        version: "2.0",
        format: "lab44-encrypted-backup",
        exportedAt: exportData.exportedAt,
        algorithm: "aes-256-gcm",
      }, null, 2),
      { name: "metadata.json" }
    );

    await archive.finalize();

    const zipBuffer = Buffer.concat(chunks);

    const dateStr = new Date().toISOString().split("T")[0];
    const filename = `lab44-backup-${dateStr}.lab44`;

    return new NextResponse(zipBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(zipBuffer.length),
      },
    });
  } catch (error) {
    console.error("Encrypted export error:", error);
    return NextResponse.json({ error: "Failed to create encrypted backup." }, { status: 500 });
  }
}
