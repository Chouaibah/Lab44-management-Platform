import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit-log";
import fs from "fs";
import path from "path";

const BACKUP_DIR = path.join(process.cwd(), "backups");

// DELETE: Purge old backups based on retention policy
export async function DELETE(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== "admin") {
      return NextResponse.json({ error: "Admin access required." }, { status: 403 });
    }

    const url = new URL(request.url);
    const retain = Math.max(1, Number(url.searchParams.get("retain")) || 10);

    // Get all backups sorted by date desc, keep the newest `retain` ones
    const allBackups = await db.backupRecord.findMany({
      orderBy: { createdAt: "desc" },
    });

    if (allBackups.length <= retain) {
      return NextResponse.json({ ok: true, message: "No backups to purge.", purged: 0 });
    }

    const toDelete = allBackups.slice(retain);
    let purgedCount = 0;

    for (const backup of toDelete) {
      // Delete the file from disk
      const filePath = path.join(BACKUP_DIR, backup.filename);
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch { /* ignore file delete errors */ }
      }

      // Delete the record
      try {
        await db.backupRecord.delete({ where: { id: backup.id } });
        purgedCount++;
      } catch { /* ignore record delete errors */ }
    }

    await logAudit({
      type: "data",
      action: "delete",
      message: `Purged ${purgedCount} old backups (retained ${retain})`,
      userId: session.userId,
      userRole: session.role,
      metadata: { purgedCount, retained: retain },
    });

    return NextResponse.json({ ok: true, purged: purgedCount, retained: retain });
  } catch (error) {
    console.error("Purge backups error:", error);
    return NextResponse.json({ error: "Failed to purge backups." }, { status: 500 });
  }
}
