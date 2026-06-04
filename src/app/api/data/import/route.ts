import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { runFullImport } from "@/lib/data-import";

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== "admin") {
      return NextResponse.json({ error: "Admin access required." }, { status: 403 });
    }

    const body = await request.json();

    if (!body.students || !Array.isArray(body.students)) {
      return NextResponse.json({ ok: false, error: "Missing required 'students' array." }, { status: 400 });
    }

    const results = await runFullImport(body);

    return NextResponse.json({ ok: true, results });
  } catch (error) {
    console.error("Import error:", error);
    return NextResponse.json({ ok: false, error: "Import failed." }, { status: 500 });
  }
}
