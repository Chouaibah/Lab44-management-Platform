import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSettingsMap } from "@/lib/settings-cache";
import { destroyVM } from "@/lib/xcp";
import { deleteGuacamoleConnection } from "@/lib/guacamole";   // ← changed import
import { getSession } from "@/lib/auth";

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }
    if (session.role !== "admin" && session.role !== "instructor") {
      return NextResponse.json({ error: "Insufficient permissions." }, { status: 403 });
    }

    const { id } = await params;
    const request = await db.vMRequest.findUnique({
      where: { id: parseInt(id) },
    });
    if (!request) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 });
    }

    // Clean up Guacamole connection ONLY (not the user)
    if (request.guacUsername && request.guacConnectionId) {
      const map = await getSettingsMap();
      const guacUrl = map.guacamole_url;
      const guacAdminUser = map.guacamole_root_username;
      const guacAdminPass = map.guacamole_root_password;

      if (guacUrl && guacAdminUser && guacAdminPass) {
        try {
          await deleteGuacamoleConnection(
            guacUrl,
            guacAdminUser,
            guacAdminPass,
            request.guacConnectionId,
            request.guacDataSource || "postgresql"
          );
        } catch (err) {
          console.error("Failed to clean up Guacamole connection:", err);
          // Non-fatal — continue with VM destruction
        }
      }
    }

    // Destroy VM on XCP-ng — CRITICAL: do not delete DB record if this fails
    if (request.vmUuid) {
      try {
        console.log(`[Delete VM] Attempting to destroy VM ${request.vmUuid} on XCP-ng...`);
        await destroyVM(request.vmUuid);
        console.log(`[Delete VM] VM ${request.vmUuid} destroyed successfully`);
      } catch (err: any) {
        console.error(
          `[Delete VM] CRITICAL: Failed to destroy VM ${request.vmUuid} on XCP-ng:`,
          err.message
        );
        return NextResponse.json(
          {
            error: "Failed to destroy VM on XCP-ng host.",
            vmStillExistsOnHost: true
          },
          { status: 500 }
        );
      }
    }

    // Only delete DB record after successful VM destruction
    await db.vMRequest.delete({ where: { id: parseInt(id) } });
    return NextResponse.json({ ok: true, message: "VM deleted from XCP-ng and database" });
  } catch (error) {
    console.error("Delete failed:", error);
    return NextResponse.json(
      { error: "Failed to delete VM request." },
      { status: 500 }
    );
  }
}
