import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit-log";
import fs from "fs";
import path from "path";

const BACKUP_DIR = path.join(process.cwd(), "backups");
const DB_PATH = path.join(process.cwd(), "db", "custom.db");

// POST: Restore from a backup
export async function POST(
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

    // Validate the backup file exists
    const backupPath = path.join(BACKUP_DIR, record.filename);
    if (!fs.existsSync(backupPath)) {
      return NextResponse.json({ error: "Backup file not found on disk." }, { status: 404 });
    }

    // Update status to restoring
    await db.backupRecord.update({
      where: { id: Number(id) },
      data: { status: "restoring" },
    });

    // Create a pre-restore backup of current state
    try {
      if (fs.existsSync(DB_PATH)) {
        const preRestoreFilename = `lab44-backup-pre-restore-${Date.now()}.db`;
        const preRestorePath = path.join(BACKUP_DIR, preRestoreFilename);
        if (!fs.existsSync(BACKUP_DIR)) {
          fs.mkdirSync(BACKUP_DIR, { recursive: true });
        }
        fs.copyFileSync(DB_PATH, preRestorePath);
        const stats = fs.statSync(preRestorePath);
        await db.backupRecord.create({
          data: {
            filename: preRestoreFilename,
            size: stats.size,
            type: "auto",
            status: "completed",
          },
        });
      }
    } catch (e) {
      console.error("Pre-restore backup failed:", e);
    }

    // Copy backup file to replace current database
    fs.copyFileSync(backupPath, DB_PATH);

    // Update status back to completed
    await db.backupRecord.update({
      where: { id: Number(id) },
      data: { status: "completed" },
    });

    await logAudit({
      type: "data",
      action: "update",
      message: `Database restored from backup: ${record.filename}`,
      userId: session.userId,
      userRole: session.role,
      metadata: { filename: record.filename, backupId: Number(id) },
    });

    return NextResponse.json({
      ok: true,
      message: "Database restored successfully. The application may need a restart for all changes to take effect.",
    });
  } catch (error) {
    console.error("Restore backup error:", error);

    // Reset status if possible
    try {
      const { id } = await params;
      await db.backupRecord.update({
        where: { id: Number(id) },
        data: { status: "failed" },
      });
    } catch { /* ignore */ }

    return NextResponse.json({ error: "Failed to restore backup." }, { status: 500 });
  }
}
