import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { decrypt, isValidEncryptedBackup } from "@/lib/backup-crypto";
import { runFullImport } from "@/lib/data-import";
import AdmZip from "adm-zip";

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== "admin") {
      return NextResponse.json({ error: "Admin access required." }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const password = formData.get("password") as string | null;

    if (!file) {
      return NextResponse.json({ error: "No backup file provided." }, { status: 400 });
    }

    if (!password || password.length < 4) {
      return NextResponse.json({ error: "Password must be at least 4 characters." }, { status: 400 });
    }

    // Read the uploaded file
    const fileBuffer = Buffer.from(await file.arrayBuffer());

    // Extract the zip
    let zip: AdmZip;
    try {
      zip = new AdmZip(fileBuffer);
    } catch {
      return NextResponse.json({ error: "Invalid backup file. Not a valid zip archive." }, { status: 400 });
    }

    // Check for backup.enc file
    const encEntry = zip.getEntry("backup.enc");
    if (!encEntry) {
      return NextResponse.json({ error: "Invalid backup file. Missing encrypted data." }, { status: 400 });
    }

    const encryptedData = encEntry.getData();

    if (!isValidEncryptedBackup(encryptedData)) {
      return NextResponse.json({ error: "Invalid backup file. Encrypted data is corrupted." }, { status: 400 });
    }

    // Decrypt
    let decryptedJson: string;
    try {
      decryptedJson = decrypt(encryptedData, password);
    } catch {
      return NextResponse.json({ error: "Wrong password or corrupted backup file." }, { status: 400 });
    }

    // Parse JSON
    let importData: any;
    try {
      importData = JSON.parse(decryptedJson);
    } catch {
      return NextResponse.json({ error: "Invalid backup data. JSON parsing failed." }, { status: 400 });
    }

    // Validate structure
    if (!importData.version || !importData.students) {
      return NextResponse.json({ error: "Invalid backup format. Missing required data." }, { status: 400 });
    }

    // Run the import
    const results = await runFullImport(importData);

    return NextResponse.json({
      ok: true,
      message: "Backup restored successfully.",
      results,
    });
  } catch (error) {
    console.error("Encrypted import error:", error);
    return NextResponse.json({ error: "Failed to restore backup." }, { status: 500 });
  }
}
