import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit-log";
import fs from "fs";
import path from "path";

const BACKUP_DIR = path.join(process.cwd(), "backups");

// GET: Download a specific backup file
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session || session.role !== "admin") {
      return NextResponse.json({ error: "Admin access required." }, { status: 403 });
    }

    const { id } = await params;
    const record = await db.backupRecord.findUnique({ where: { id: Number(id) } });
    if (!record) {
      return NextResponse.json({ error: "Backup not found." }, { status: 404 });
    }

    const filePath = path.join(BACKUP_DIR, record.filename);
    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: "Backup file not found on disk." }, { status: 404 });
    }

    const fileBuffer = fs.readFileSync(filePath);

    await logAudit({
      type: "data",
      action: "export",
      message: `Backup downloaded: ${record.filename}`,
      userId: session.userId,
      userRole: session.role,
      metadata: { filename: record.filename },
    });

    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="${record.filename}"`,
        "Content-Length": String(fileBuffer.length),
      },
    });
  } catch (error) {
    console.error("Download backup error:", error);
    return NextResponse.json({ error: "Failed to download backup." }, { status: 500 });
  }
}

// DELETE: Delete a backup file and its record
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session || session.role !== "admin") {
      return NextResponse.json({ error: "Admin access required." }, { status: 403 });
    }

    const { id } = await params;
    const record = await db.backupRecord.findUnique({ where: { id: Number(id) } });
    if (!record) {
      return NextResponse.json({ error: "Backup not found." }, { status: 404 });
    }

    // Delete the file from disk
    const filePath = path.join(BACKUP_DIR, record.filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    // Delete the record
    await db.backupRecord.delete({ where: { id: Number(id) } });

    await logAudit({
      type: "data",
      action: "delete",
      message: `Backup deleted: ${record.filename}`,
      userId: session.userId,
      userRole: session.role,
      metadata: { filename: record.filename },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Delete backup error:", error);
    return NextResponse.json({ error: "Failed to delete backup." }, { status: 500 });
  }
}
