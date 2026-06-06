import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit-log";
import fs from "fs";
import path from "path";

const BACKUP_DIR = path.join(process.cwd(), "backups");
const DB_PATH = path.join(process.cwd(), "db", "custom.db");

function ensureBackupDir() {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }
}

function formatBackupFilename(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `lab44-backup-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}.db`;
}

// GET: List all backup records (sorted by date desc)
export async function GET() {
  try {
    const session = await getSession();
    if (!session || session.role !== "admin") {
      return NextResponse.json({ error: "Admin access required." }, { status: 403 });
    }

    const records = await db.backupRecord.findMany({
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ backups: records });
  } catch (error) {
    console.error("List backups error:", error);
    return NextResponse.json({ error: "Failed to list backups." }, { status: 500 });
  }
}

// POST: Create a manual backup
export async function POST() {
  try {
    const session = await getSession();
    if (!session || session.role !== "admin") {
      return NextResponse.json({ error: "Admin access required." }, { status: 403 });
    }

    ensureBackupDir();

    const filename = formatBackupFilename();
    const destPath = path.join(BACKUP_DIR, filename);

    // Check source DB exists
    if (!fs.existsSync(DB_PATH)) {
      return NextResponse.json({ error: "Database file not found." }, { status: 500 });
    }

    // Copy the SQLite database file
    fs.copyFileSync(DB_PATH, destPath);

    // Get file size
    const stats = fs.statSync(destPath);

    // Create backup record
    const record = await db.backupRecord.create({
      data: {
        filename,
        size: stats.size,
        type: "manual",
        status: "completed",
      },
    });

    // Update last_backup_at setting
    await db.setting.upsert({
      where: { key: "last_backup_at" },
      update: { value: new Date().toISOString() },
      create: { key: "last_backup_at", value: new Date().toISOString() },
    });

    await logAudit({
      type: "data",
      action: "create",
      message: `Manual backup created: ${filename}`,
      userId: session.userId,
      userRole: session.role,
      metadata: { filename, size: stats.size },
    });

    return NextResponse.json({ ok: true, backup: record });
  } catch (error) {
    console.error("Create backup error:", error);

    // Try to create a failed record
    try {
      await db.backupRecord.create({
        data: {
          filename: formatBackupFilename(),
          size: 0,
          type: "manual",
          status: "failed",
        },
      });
    } catch { /* ignore */ }

    return NextResponse.json({ error: "Failed to create backup." }, { status: 500 });
  }
}
