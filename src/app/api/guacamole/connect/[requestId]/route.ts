import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSettingsMap } from "@/lib/settings-cache";
import {
  getGuacamoleToken,
  provisionGuacamoleTempAccess,
  createGuacamoleUser,
  grantGuacamoleAccess,
  ensureGuacamoleUser,
} from "@/lib/guacamole";
import { getSession, generateSecurePassword } from "@/lib/auth";
import { getVMIPAddress } from "@/lib/xcp";
import { deriveGuacPassword } from "@/lib/guac-password";
import { toGuacUsername } from "@/lib/utils";

type GuacProtocol = "ssh" | "rdp";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ requestId: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const { requestId } = await params;
    const url = new URL(req.url);
    const protocolOverride = url.searchParams.get("protocol");
    const vmUserOverride = url.searchParams.get("vmUser");
    const vmPassOverride = url.searchParams.get("vmPass");

    const request = await db.vMRequest.findUnique({
      where: { id: parseInt(requestId) },
    });
    if (!request) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 });
    }

    // Verify access rights
    if (session.role === "student" && session.userId !== request.studentDbId) {
      return NextResponse.json({ error: "You can only access your own VM requests." }, { status: 403 });
    }
    if (request.status !== "approved") {
      return NextResponse.json({ error: "VM request is not approved." }, { status: 400 });
    }

    const map = await getSettingsMap();
    const guacUrl = map.guacamole_url;
    const guacRootUser = map.guacamole_root_username;
    const guacRootPass = map.guacamole_root_password;

    if (!guacUrl || !guacRootUser || !guacRootPass) {
      return NextResponse.json(
        { error: "Guacamole is not configured. Please ask your admin to set it up." },
        { status: 500 }
      );
    }

    // ─── Admin / Instructor: use a temporary Guacamole user (one‑time) ───
    if (session.role === "admin" || session.role === "instructor") {
      try {
        const rolePrefix = session.role === "admin" ? "adm" : "ins";
        const tempUsername = `${rolePrefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const tempPassword = generateSecurePassword(16);

        // If the student already has a provisioned connection, reuse it
        if (request.guacConnectionId && request.guacConnectionId !== "N/A" && request.guacUsername) {
          const { token: rootToken, dataSource, baseUrl } = await getGuacamoleToken(
            guacUrl, guacRootUser, guacRootPass
          );

          // Create the temporary user and grant access to the existing connection
          await createGuacamoleUser(baseUrl, rootToken, dataSource, tempUsername, tempPassword);
          await grantGuacamoleAccess(baseUrl, rootToken, dataSource, tempUsername, request.guacConnectionId);

          // Get a token for this temporary user
          const userAuth = await getGuacamoleToken(baseUrl, tempUsername, tempPassword);

          return NextResponse.json({
            identifier: request.guacConnectionId,
            dataSource: userAuth.dataSource,
            url: userAuth.baseUrl,
            authToken: userAuth.token,
          });
        }

        // No existing connection – create a new one (fallback)
        let currentIp = request.vmIp || "";
        if (request.vmUuid) {
          try {
            const dynamicIp = await getVMIPAddress(request.vmUuid);
            if (dynamicIp && dynamicIp !== "127.0.0.1") currentIp = dynamicIp;
          } catch { /* ignore */ }
        }

        if (!currentIp) {
          return NextResponse.json(
            { error: "VM has no IP address. Start the VM first." },
            { status: 400 }
          );
        }

        const protocol: GuacProtocol = (
          protocolOverride ||
          request.accessProtocol ||
          request.guacProtocol ||
          "rdp"
        ).toLowerCase() === "ssh" ? "ssh" : "rdp";

        const defaultVmUser = protocol === "ssh" ? "xen" : "lab";
        const vmUser = vmUserOverride || defaultVmUser;
        const vmPass = vmPassOverride ?? "";

        // Provision a brand new temporary connection
        const provRes = await provisionGuacamoleTempAccess(
          guacUrl,
          guacRootUser,
          guacRootPass,
          tempUsername,
          tempPassword,
          request.vmUuid || `${rolePrefix}-session`,
          protocol,
          currentIp,
          vmUser,
          vmPass
        );

        // Get a token for the temp user using the resolved base URL
        const userAuth = await getGuacamoleToken(provRes.baseUrl, tempUsername, tempPassword);

        return NextResponse.json({
          identifier: provRes.connId,
          dataSource: userAuth.dataSource,
          url: userAuth.baseUrl,
          authToken: userAuth.token,
        });
      } catch (error: any) {
        console.error(`${session.role} Guacamole connect error:`, error.message);
        return NextResponse.json(
          { error: `Failed to connect to Guacamole: ${error.message}` },
          { status: 500 }
        );
      }
    }

    // ─── Student: use the fixed, derived student account ───
    const student = await db.student.findUnique({ where: { id: request.studentDbId } });
    if (!student) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }

    const guacUsername = toGuacUsername(student.firstName, student.lastName);
    const guacPassword = deriveGuacPassword(student.firstName, student.studentId);

    let connectionId = request.guacConnectionId;

    if (!connectionId || connectionId === "N/A") {
      return NextResponse.json(
        { error: "Guacamole access has not been provisioned yet. Please contact your instructor." },
        { status: 400 }
      );
    }

    // Ensure the student's Guacamole user exists with the correct password
    try {
      const { token: adminToken, dataSource: adminDs, baseUrl: adminBaseUrl } = await getGuacamoleToken(
        guacUrl, guacRootUser, guacRootPass
      );
      await ensureGuacamoleUser(adminBaseUrl, adminToken, adminDs, guacUsername, guacPassword);
    } catch (err: any) {
      console.error("[Guac] Failed to ensure student user:", err.message);
    }

    // Try to get a fresh student token
    try {
      const studentAuth = await getGuacamoleToken(guacUrl, guacUsername, guacPassword);
      return NextResponse.json({
        identifier: connectionId,
        dataSource: studentAuth.dataSource,
        url: studentAuth.baseUrl,
        authToken: studentAuth.token,
      });
    } catch (error: any) {
      console.error("Student token error:", error.message);
      return NextResponse.json(
        { error: `Could not authenticate with Guacamole as "${guacUsername}". ${error.message}` },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error("Guacamole connect error:", error.message);
    return NextResponse.json(
      { error: `Failed to open console connection: ${error.message}` },
      { status: 500 }
    );
  }
}
