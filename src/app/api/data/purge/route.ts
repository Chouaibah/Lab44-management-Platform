import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

export async function DELETE(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== "admin") {
      return NextResponse.json({ error: "Admin access required." }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const confirm = searchParams.get("confirm");
    if (confirm !== "true") {
      return NextResponse.json(
        { error: "Double confirmation required. Append ?confirm=true to confirm." },
        { status: 400 }
      );
    }

    await db.$transaction([
      db.grade.deleteMany(),
      db.attendance.deleteMany(),
      db.vMRequest.deleteMany(),
      db.announcement.deleteMany(),
      db.student.deleteMany(),
      db.instructor.deleteMany(),
      db.lab.deleteMany(),
      db.setting.deleteMany(),
    ]);

    await db.setting.createMany({
      data: [
        { key: "signup_enabled", value: "true" },
        { key: "guacamole_url", value: "" },
        { key: "guacamole_root_username", value: "" },
        { key: "guacamole_root_password", value: "" },
        { key: "xcpng_host", value: "" },
        { key: "xcpng_username", value: "" },
        { key: "xcpng_password", value: "" },
      ],
    });

    return NextResponse.json({ ok: true, message: "All data purged and defaults restored." });
  } catch (error) {
    console.error("Data purge error:", error);
    return NextResponse.json({ error: "Failed to purge data." }, { status: 500 });
  }
}
