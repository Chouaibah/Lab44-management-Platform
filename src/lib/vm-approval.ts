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

  // Only "rdp" and "ssh" are real Guacamole protocols — anything else falls back
  // to rdp rather than being written straight into the connection config.
  const protocol: "rdp" | "ssh" =
    (accessProtocol || existing.accessProtocol || "rdp").toLowerCase() === "ssh"
      ? "ssh"
      : "rdp";

  // Prepare the update payload for the VMRequest.
  //
  // vmUuid / vmName are deliberately NOT seeded from the template here. Doing so
  // recorded the *template's* UUID as if it were the student's VM whenever
  // cloning failed, after which the power/destroy actions would happily act on
  // the template itself. They are now written only once a clone has succeeded.
  const updateData: Record<string, unknown> = {
    note: note || existing.note,
    reviewedAt: new Date(),
    accessProtocol: protocol,
  };

  if (vmIp || existing.vmIp) updateData.vmIp = vmIp || existing.vmIp;
  if (existing.vmUuid) updateData.vmUuid = existing.vmUuid;
  if (existing.vmName) updateData.vmName = existing.vmName;

  // Provision the VM on XCP-ng if a template is specified
  const vmProvisionPromise = existing.templateUuid
  ? (async () => {
    try {
      // Count existing VMs for this student with the same template to generate a sequential suffix
      const basePrefix = `${existing.studentName}-${existing.templateName}`
        .replace(/[^a-zA-Z0-9-_]/g, "-");
      const existingVMs = await db.vMRequest.findMany({
        where: {
          studentDbId: existing.studentDbId,
          vmName: { startsWith: basePrefix },
          status: "approved",
        },
      });
      let maxCount = 0;
      for (const vm of existingVMs) {
        const suffix = (vm.vmName || "").slice(basePrefix.length);
        const num = parseInt(suffix, 10);
        // Only count small sequential suffixes (<= 999), ignore old timestamp-based names
        if (!isNaN(num) && num > maxCount && num <= 999) maxCount = num;
      }
      const nextCount = maxCount + 1;
      const vmNameToUse = `${basePrefix}${nextCount}`
        .substring(0, 60);
      return await provisionVM(existing.templateUuid!, vmNameToUse);
    } catch (err) {
      console.error("XCP-ng VM creation failed (non-fatal):", err);
      return null;
    }
  })()
  : Promise.resolve(null);

  const [vmResult, map] = await Promise.all([vmProvisionPromise, getSettingsMap()]);

  // A request that asked for a template but whose clone failed must NOT be
  // recorded as approved: there is no VM, and the row would otherwise keep the
  // template UUID. Leave it pending so staff can retry.
  if (existing.templateUuid && !vmResult) {
    const marker = "[Auto] VM provisioning failed on XCP-ng — left pending, please retry.";
    const nextNote =
      existing.note && existing.note.includes(marker)
        ? existing.note
        : existing.note
          ? `${existing.note} | ${marker}`
          : marker;

    await db.vMRequest.update({
      where: { id },
      data: { status: "pending", reviewedAt: new Date(), note: nextNote },
    });

    return {
      ok: false,
      error: "VM provisioning failed on XCP-ng. The request was left pending.",
      vmName: existing.vmName,
      vmUuid: existing.vmUuid,
      vmIp: existing.vmIp,
    };
  }

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

        // Protocol was validated at the top of this function.

        // 3. Create the Guacamole user (silently skip if already exists)
        try {
          await createGuacamoleUser(baseUrl, adminToken, dataSource, guacUsername, guacPassword);
        } catch (e) {
          console.log("[Guac] User already exists, proceeding.");
        }

        // 4. Create a new connection for this VM
        const nameSuffix = (updateData.vmUuid as string || "").replace(/-/g, '').slice(-8);
        const connectionName =
        `${updateData.vmName || "VM"}-${protocol}-${nameSuffix}`;

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

  // Update the VM request in the database. Reaching this point means either the
  // clone succeeded or no template was requested, so the approval is real.
  updateData.status = "approved";

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
