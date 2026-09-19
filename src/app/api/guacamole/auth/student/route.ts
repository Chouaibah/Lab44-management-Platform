import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSettingsMap } from "@/lib/settings-cache";
import {
  getGuacamoleToken,
  ensureGuacamoleUser,
  createGuacamoleConnection,
  grantGuacamoleAccess,
  deleteGuacamoleConnection,
} from "@/lib/guacamole";
import { getVMIPAddress, callXAPI } from "@/lib/xcp";
import { getSession } from "@/lib/auth";
import { deriveGuacPassword } from "@/lib/guac-password";
import { toGuacUsername } from "@/lib/utils";

type GuacProtocol = "rdp" | "ssh";

export async function POST(req: Request) {
  try {
    // ── 1. Auth ──────────────────────────────────────────────────────────────
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }
    if (session.role !== "student") {
      return NextResponse.json({ error: "Insufficient permissions." }, { status: 403 });
    }

    const payload = await req.json();
    let { requestId, protocol, osUser: customOsUser, osPass: customOsPass } = payload;

    // Accept either a numeric DB id or a VM UUID string
    if (typeof requestId === "string" && requestId.includes("-")) {
      const byUuid = await db.vMRequest.findFirst({ where: { vmUuid: requestId } });
      if (!byUuid) {
        return NextResponse.json({ error: "Request not found." }, { status: 404 });
      }
      requestId = byUuid.id;
    }
    requestId = parseInt(String(requestId), 10);

    const desiredProtocol: GuacProtocol =
      protocol === "ssh" ? "ssh" : "rdp";

    // ── 2. Load the VM request and verify ownership ───────────────────────────
    const vmRequest = await db.vMRequest.findUnique({ where: { id: requestId } });
    if (!vmRequest || vmRequest.status !== "approved") {
      return NextResponse.json({ error: "Invalid or unapproved VM request." }, { status: 400 });
    }
    if (session.userId !== vmRequest.studentDbId) {
      return NextResponse.json({ error: "You can only access your own VM." }, { status: 403 });
    }

    // ── 3. Guacamole settings ─────────────────────────────────────────────────
    const map = await getSettingsMap();
    const guacUrl = map.guacamole_url;
    const guacAdminUser = map.guacamole_root_username;
    const guacAdminPass = map.guacamole_root_password;

    if (!guacUrl || !guacAdminUser || !guacAdminPass) {
      return NextResponse.json(
        { error: "Guacamole is not configured. Please ask your admin to set it up in Settings." },
        { status: 500 }
      );
    }

    // ── 4. VM power state and IP ──────────────────────────────────────────────
    let currentVmIp = vmRequest.vmIp || "";
    let vmPowerState = "Unknown";

    if (vmRequest.vmUuid) {
      try {
        const vmRef = await callXAPI("VM.get_by_uuid", [vmRequest.vmUuid]);
        vmPowerState = await callXAPI("VM.get_power_state", [vmRef]);
        const dynamicIp = await getVMIPAddress(vmRequest.vmUuid);
        if (dynamicIp && dynamicIp !== "127.0.0.1") {
          currentVmIp = dynamicIp;
        }
      } catch (err) {
        console.error("[Guac] Could not fetch VM state/IP:", err);
      }
    }

    if (vmPowerState !== "Running") {
      return NextResponse.json(
        { error: `VM is not running (state: ${vmPowerState}). Please start the VM first.` },
        { status: 400 }
      );
    }

    if (!currentVmIp) {
      return NextResponse.json(
        { error: "VM has no IP address yet. Please wait a moment and retry." },
        { status: 400 }
      );
    }

    // ── 5. Derive fixed student credentials ───────────────────────────────────
    //   username : firstname_lastname  (e.g. "samir_hazil")
    //   password : firstname + studentId  (e.g. "Samir20210042")
    const student = await db.student.findUnique({ where: { id: vmRequest.studentDbId } });
    if (!student) {
      return NextResponse.json({ error: "Student not found." }, { status: 404 });
    }

    const guacUsername = toGuacUsername(student.firstName, student.lastName);
    const guacPassword = deriveGuacPassword(student.firstName, student.studentId);

    console.log(`[Guac] Student ${student.firstName} ${student.lastName} -> guac user: ${guacUsername}, protocol: ${desiredProtocol}`);

    // ── 6. Obtain an admin token (used only for provisioning) ─────────────────
    let adminToken: string;
    let dataSource: string;
    let baseUrl: string;
    // The URL handed to the student's browser. `baseUrl` is only reachable from
    // inside the Docker network; the browser needs the public URL.
    let publicBaseUrl: string;

    try {
      const auth = await getGuacamoleToken(
        guacUrl,
        guacAdminUser,
        guacAdminPass,
        map.guacamole_public_url
      );
      adminToken = auth.token;
      dataSource = auth.dataSource;
      baseUrl = auth.baseUrl;
      publicBaseUrl = auth.publicBaseUrl;
      console.log(`[Guac] Admin auth OK — baseUrl: ${baseUrl}, dataSource: ${dataSource}`);
    } catch (err: any) {
      console.error("[Guac] Admin auth failed:", err.message);
      return NextResponse.json(
        {
          error: `Cannot reach Guacamole server. Please verify the Guacamole URL and admin credentials in Settings. Detail: ${err.message}`,
        },
        { status: 502 }
      );
    }

    // ── 7. Ensure the student's Guacamole user exists ─────────────────────────
    try {
      await ensureGuacamoleUser(baseUrl, adminToken, dataSource, guacUsername, guacPassword);
    } catch (err: any) {
      console.error("[Guac] Failed to ensure student user:", err.message);
      return NextResponse.json(
        { error: `Failed to create/update your Guacamole account. Detail: ${err.message}` },
        { status: 500 }
      );
    }

    // ── 8. Always recreate the connection with the correct parameters ──────────
    //   We ALWAYS recreate the connection because:
    //   a) Connections created during approval may have empty hostnames or wrong credentials
    //   b) The VM IP may have changed
    //   c) The student may want a different protocol (RDP vs SSH)
    //   d) This ensures the connection always matches the current VM state
    //
    //   Deleting and recreating is safe — Guacamole connections are just config objects,
    //   not active sessions. Any existing session using the old connection ID will
    //   gracefully disconnect, which is the expected behavior when reconnecting.

    // Delete the old connection if one exists
    const hasConnection =
      vmRequest.guacConnectionId && vmRequest.guacConnectionId !== "N/A";

    if (hasConnection) {
      try {
        await deleteGuacamoleConnection(
          guacUrl,
          guacAdminUser,
          guacAdminPass,
          vmRequest.guacConnectionId!,
          dataSource
        );
        console.log(`[Guac] Deleted old connection: ${vmRequest.guacConnectionId}`);
      } catch (e: any) {
        // Old connection might not exist anymore — that's fine
        console.log("[Guac] Could not delete old connection (may not exist):", e.message);
      }
    }

    // Create a new connection with the correct parameters
    const port = desiredProtocol === "ssh" ? "22" : "3389";
    // OS-level credentials for the VM (not the Guacamole account)
    // Use the credentials from the student's dialog, or fall back to defaults
    const osUser = customOsUser || (desiredProtocol === "ssh" ? "xen" : "lab");
    const osPass = customOsPass ?? "";

    const nameSuffix = (vmRequest.vmUuid || "").replace(/-/g, '').slice(-8);
    const connectionName =
      `${vmRequest.vmName || "VM"}-${desiredProtocol}-${nameSuffix}`;

    let connectionId: string;
    try {
      console.log(`[Guac] Creating ${desiredProtocol.toUpperCase()} connection: ${currentVmIp}:${port} user=${osUser} pass=${'*'.repeat(osPass.length)}`);
      connectionId = await createGuacamoleConnection(
        baseUrl,
        adminToken,
        dataSource,
        connectionName,
        desiredProtocol,
        currentVmIp,
        port,
        osUser,
        osPass
      );
      console.log(`[Guac] Created ${desiredProtocol.toUpperCase()} connection: ${connectionId} -> ${currentVmIp}:${port}`);
    } catch (err: any) {
      console.error("[Guac] Failed to create connection:", err.message);
      return NextResponse.json(
        { error: `Failed to create VM connection. Detail: ${err.message}` },
        { status: 500 }
      );
    }

    // Grant this student's Guacamole account READ access to the new connection
    try {
      await grantGuacamoleAccess(baseUrl, adminToken, dataSource, guacUsername, connectionId);
      console.log(`[Guac] Granted READ access: ${guacUsername} -> connection ${connectionId}`);
    } catch (err: any) {
      // If grant fails, the student won't be able to see the connection → "connection does not exist"
      console.error(`[Guac] CRITICAL: Failed to grant access for ${guacUsername} to connection ${connectionId}:`, err.message);
      // Continue anyway — the connection exists but the student may not be able to access it
    }

    // Persist the new connection details
    await db.vMRequest.update({
      where: { id: requestId },
      data: {
        guacUsername,
        guacConnectionId: connectionId,
        guacDataSource: dataSource,
        guacProtocol: desiredProtocol,
        vmIp: currentVmIp,
        updatedAt: new Date(),
      },
    });

    // ── 9. Get a student-scoped Guacamole token ───────────────────────────────
    let studentToken: string;
    let studentDataSource: string;
    let studentBaseUrl: string;

    try {
      const studentAuth = await getGuacamoleToken(
        baseUrl,
        guacUsername,
        guacPassword,
        map.guacamole_public_url
      );
      studentToken = studentAuth.token;
      studentDataSource = studentAuth.dataSource;
      // `baseUrl` is the internal one; give the browser the public one.
      studentBaseUrl = studentAuth.publicBaseUrl;
    } catch (error: any) {
      console.error("[Guac] Student token error:", error.message);
      return NextResponse.json(
        {
          error: `Could not authenticate with Guacamole as user "${guacUsername}". The account may have been modified externally. Detail: ${error.message}`,
        },
        { status: 500 }
      );
    }

    // ── 10. Return connection details to the client ───────────────────────────
    return NextResponse.json({
      identifier: connectionId,
      dataSource: studentDataSource,
      url: studentBaseUrl,
      authToken: studentToken,
    });
  } catch (error: any) {
    console.error("[Guac] Auth API Error:", error);
    return NextResponse.json(
      { error: `Authentication failed: ${error.message || "Unknown error"}` },
      { status: 500 }
    );
  }
}
