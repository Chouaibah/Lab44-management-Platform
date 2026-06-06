import { NextResponse } from "next/server";
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

// GET: Check if auto-backup is due and create one if needed
export async function GET() {
  try {
    // Read settings
    const autoBackupEnabled = await db.setting.findUnique({ where: { key: "auto_backup_enabled" } });
    if (!autoBackupEnabled || autoBackupEnabled.value !== "true") {
      return NextResponse.json({ ok: true, autoBackup: false, message: "Auto-backup is disabled." });
    }

    const intervalHoursSetting = await db.setting.findUnique({ where: { key: "auto_backup_interval_hours" } });
    const intervalHours = Number(intervalHoursSetting?.value) || 24;

    const lastBackupAtSetting = await db.setting.findUnique({ where: { key: "last_backup_at" } });
    const lastBackupAt = lastBackupAtSetting?.value ? new Date(lastBackupAtSetting.value) : null;

    const now = new Date();
    const intervalMs = intervalHours * 60 * 60 * 1000;

    // Check if enough time has passed since last backup
    if (lastBackupAt && (now.getTime() - lastBackupAt.getTime()) < intervalMs) {
      const nextBackupAt = new Date(lastBackupAt.getTime() + intervalMs);
      return NextResponse.json({
        ok: true,
        autoBackup: false,
        message: "Not yet time for auto-backup.",
        lastBackupAt: lastBackupAt.toISOString(),
        nextBackupAt: nextBackupAt.toISOString(),
      });
    }

    // Create auto backup
    ensureBackupDir();

    const filename = formatBackupFilename();
    const destPath = path.join(BACKUP_DIR, filename);

    if (!fs.existsSync(DB_PATH)) {
      return NextResponse.json({ ok: false, error: "Database file not found." }, { status: 500 });
    }

    fs.copyFileSync(DB_PATH, destPath);
    const stats = fs.statSync(destPath);

    const record = await db.backupRecord.create({
      data: {
        filename,
        size: stats.size,
        type: "scheduled",
        status: "completed",
      },
    });

    // Update last_backup_at setting
    await db.setting.upsert({
      where: { key: "last_backup_at" },
      update: { value: now.toISOString() },
      create: { key: "last_backup_at", value: now.toISOString() },
    });

    // Auto-purge old backups based on retention policy
    const retentionSetting = await db.setting.findUnique({ where: { key: "backup_retention_count" } });
    const retentionCount = Number(retentionSetting?.value) || 10;

    const allBackups = await db.backupRecord.findMany({
      orderBy: { createdAt: "desc" },
    });

    if (allBackups.length > retentionCount) {
      const toDelete = allBackups.slice(retentionCount);
      for (const backup of toDelete) {
        const filePath = path.join(BACKUP_DIR, backup.filename);
        if (fs.existsSync(filePath)) {
          try { fs.unlinkSync(filePath); } catch { /* ignore */ }
        }
        try { await db.backupRecord.delete({ where: { id: backup.id } }); } catch { /* ignore */ }
      }
    }

    await logAudit({
      type: "data",
      action: "create",
      message: `Auto-backup created: ${filename}`,
      userId: "system",
      userRole: "system",
      metadata: { filename, size: stats.size, type: "scheduled" },
    });

    return NextResponse.json({
      ok: true,
      autoBackup: true,
      message: "Auto-backup created successfully.",
      backup: record,
    });
  } catch (error) {
    console.error("Auto-backup check error:", error);
    return NextResponse.json({ error: "Failed to check auto-backup." }, { status: 500 });
  }
}
