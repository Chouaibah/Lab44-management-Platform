import { db } from "@/lib/db";
import { getSettingsMap } from "@/lib/settings-cache";
import { provisionVM, callXAPI, getVMIPAddress } from "@/lib/xcp";
import { getGuacamoleToken, createGuacamoleUser, createGuacamoleConnection, grantGuacamoleAccess } from "@/lib/guacamole";
import { deriveGuacPassword } from "@/lib/guac-password";
import { toGuacUsername } from "@/lib/utils";

interface ApproveOptions {
  id: number;
  note?: string | null;
  vmIp?: string | null;
  accessProtocol?: string | null;
  startVM?: boolean;
}

export async function approveVMRequest(opts: ApproveOptions) {
  const { id, note, vmIp, accessProtocol, startVM = false } = opts;

  const existing = await db.vMRequest.findUnique({ where: { id } });
  if (!existing) throw new Error("Request not found.");

  // Prepare the update payload for the VMRequest
  const updateData: Record<string, unknown> = {
    status: "approved",
    note: note || existing.note,
    reviewedAt: new Date(),
    accessProtocol: accessProtocol || existing.accessProtocol,
  };

  updateData.vmUuid = existing.templateUuid || existing.vmUuid || null;
  updateData.vmName = existing.templateName || existing.vmName || null;
  updateData.vmIp = vmIp || existing.vmIp || null;

  // Provision the VM on XCP-ng if a template is specified
  const vmProvisionPromise = existing.templateUuid
  ? (async () => {
    try {
      const vmNameToUse = `${existing.studentName}-${existing.templateName}-${Date.now()}`
      .replace(/[^a-zA-Z0-9-_]/g, "-")
      .substring(0, 60);
      return await provisionVM(existing.templateUuid!, vmNameToUse);
    } catch (err) {
      console.error("XCP-ng VM creation failed (non-fatal):", err);
      return null;
    }
  })()
  : Promise.resolve(null);

  const [vmResult, map] = await Promise.all([vmProvisionPromise, getSettingsMap()]);

  if (vmResult) {
    updateData.vmUuid = vmResult.uuid;
    updateData.vmName = vmResult.name;

    if (startVM) {
      try {
        const vmRefResult = await callXAPI("VM.get_by_uuid", [vmResult.uuid]);
        try {
          await callXAPI("VM.start", [vmRefResult, false, false]);
        } catch (e) {
          console.error("VM start failed (non-fatal):", e);
        }
        // Wait a few seconds and try to fetch the IP
        await new Promise((resolve) => setTimeout(resolve, 5000));
        const ip = await getVMIPAddress(vmResult.uuid);
        if (ip) updateData.vmIp = ip;
      } catch (e) {
        console.error("VM lookup/start failed:", e);
      }
    }
  }

  // ─── Guacamole provisioning: one student account, one connection per VM ───
  const guacUrl = map.guacamole_url;
  const guacRootUser = map.guacamole_root_username;
  const guacRootPass = map.guacamole_root_password;

  // Only provision Guacamole if we have a valid IP for the VM.
  // If the VM doesn't have an IP yet, the connection will be created
  // on-demand when the student first connects via the auth/student route.
  const effectiveIp = (updateData.vmIp as string) || "";

  if (guacUrl && guacRootUser && guacRootPass && effectiveIp) {
    try {
      // 1. Obtain an admin token
      const { token: adminToken, dataSource, baseUrl } = await getGuacamoleToken(
        guacUrl,
        guacRootUser,
        guacRootPass
      );

      if (adminToken) {
        // 2. Fetch the student record to build the fixed username/password
        const student = await db.student.findUnique({
          where: { studentId: existing.studentId },
        });
        if (!student) throw new Error("Student not found.");

        // Fixed username (firstname_lastname, e.g., "samir_hazil")
        const guacUsername = toGuacUsername(student.firstName, student.lastName);
        // Fixed password: firstname + studentId (e.g., "Samir20210042")
        const guacPassword = deriveGuacPassword(student.firstName, student.studentId);

        // Protocol: RDP or SSH
        const protocol = (
          (updateData.accessProtocol as string) || "rdp"
        ).toLowerCase() as "rdp" | "ssh";

        // 3. Create the Guacamole user (silently skip if already exists)
        try {
          await createGuacamoleUser(baseUrl, adminToken, dataSource, guacUsername, guacPassword);
        } catch (e) {
          console.log("[Guac] User already exists, proceeding.");
        }

        // 4. Create a new connection for this VM with CORRECT credentials
        const connectionName =
        `${student.firstName}-${student.lastName}-${updateData.vmName || "VM"}-${Date.now().toString(36)}`;

        const port = protocol === "ssh" ? "22" : "3389";
        // OS-level credentials for the VM (not the Guacamole account)
        const osUser = protocol === "ssh" ? "xen" : "lab";
        const osPass = "";

        const connectionId = await createGuacamoleConnection(
          baseUrl,
          adminToken,
          dataSource,
          connectionName,
          protocol,
          effectiveIp,
          port,
          osUser,
          osPass
        );

        // 5. Grant the student READ access to this connection
        await grantGuacamoleAccess(baseUrl, adminToken, dataSource, guacUsername, connectionId);

        // 6. Store the connection info (no password stored)
        updateData.guacUsername = guacUsername;
        updateData.guacConnectionId = connectionId;
        updateData.guacProtocol = protocol;
        updateData.guacDataSource = dataSource;
      }
    } catch (err) {
      console.error("Guacamole provisioning failed (non-fatal):", err);
    }
  } else if (guacUrl && guacRootUser && guacRootPass && !effectiveIp) {
    // Guacamole is configured but the VM has no IP yet.
    // The student auth route will create the connection on-demand when the IP becomes available.
    console.log("[Guac] VM has no IP yet — skipping connection creation. Will be created on first connect.");
  }

  // Update the VM request in the database
  await db.vMRequest.update({
    where: { id },
    data: updateData,
  });

  return {
    ok: true,
    vmName: updateData.vmName,
    vmUuid: updateData.vmUuid,
    vmIp: updateData.vmIp || null,
  };
}
