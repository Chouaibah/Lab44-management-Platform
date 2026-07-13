import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSettingsMap } from "@/lib/settings-cache";
import { getSession, generateSecurePassword, encryptField } from "@/lib/auth";
import { provisionVM, callXAPI, getVMIPAddress } from "@/lib/xcp";
import { provisionGuacamoleTempAccess, getGuacamoleToken } from "@/lib/guacamole";

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }
    if (session.role !== "instructor") {
      return NextResponse.json({ error: "Insufficient permissions." }, { status: 403 });
    }

    const { templateUuid, templateName, labId } = await request.json();
    if (!templateUuid) {
      return NextResponse.json({ error: "Template is required." }, { status: 400 });
    }

    // Get instructor info from DB
    const instructor = await db.instructor.findUnique({ where: { id: session.userId } });
    if (!instructor) {
      return NextResponse.json({ error: "Instructor not found." }, { status: 404 });
    }

    const effectiveLabId = labId || instructor.labId;
    const protocol = "rdp";

    // Build a clean VM name from instructor's display name + template name
    const instructorName = (instructor.displayName || instructor.username)
      .replace(/[^a-zA-Z0-9-_]/g, "-")
      .substring(0, 30);
    const cleanTemplateName = (templateName || "VM")
      .replace(/[^a-zA-Z0-9-_]/g, "-")
      .substring(0, 20);
    const baseName = `${instructorName}-${cleanTemplateName}`;
    const displayName = `${baseName}-1`;

    // 1. Create VM request record (auto-approved)
    const vmRequest = await db.vMRequest.create({
      data: {
        studentDbId: instructor.id,
        studentName: `${instructor.displayName || instructor.username} (Instructor)`,
        studentId: `ins-${instructor.id}`,
        labId: effectiveLabId ? parseInt(String(effectiveLabId)) : null,
        templateUuid,
        templateName: templateName || "Unknown Template",
        accessProtocol: protocol,
        status: "approved",
        reviewedAt: new Date(),
        vmName: displayName,
      },
    });

    let vmUuid: string | null = null;
    let finalVmName = displayName;
    let vmIp: string | null = null;

    // 2. Provision VM on XCP-ng
    try {
      // Count existing VMs for this instructor with the same base name for sequential suffix
      const basePrefix = `${baseName}-`;
      const existingVMs = await db.vMRequest.findMany({
        where: {
          studentId: `ins-${instructor.id}`,
          vmName: { startsWith: basePrefix },
          status: "approved",
          id: { not: vmRequest.id },
        },
      });
      let maxCount = 0;
      for (const vm of existingVMs) {
        const suffix = (vm.vmName || "").slice(basePrefix.length);
        const num = parseInt(suffix, 10);
        if (!isNaN(num) && num > maxCount && num <= 999) maxCount = num;
      }
      const nextCount = maxCount + 1;
      const vmNameToUse = `${baseName}-${nextCount}`
        .replace(/[^a-zA-Z0-9-_]/g, "-")
        .substring(0, 60);
      const result = await provisionVM(templateUuid, vmNameToUse);
      vmUuid = result.uuid;
      finalVmName = result.name || displayName;

      // Start the VM
      try {
        const vmRef = await callXAPI("VM.get_by_uuid", [vmUuid]);
        await callXAPI("VM.start", [vmRef, false, false]);
      } catch (e) {
        console.error("VM start failed (non-fatal):", e);
      }

      // Wait and get IP
      try {
        await new Promise((resolve) => setTimeout(resolve, 5000));
        vmIp = await getVMIPAddress(vmUuid);
      } catch {
        /* best effort */
      }
    } catch (err) {
      console.error("XCP-ng VM creation failed:", err);
      // Still return the request, just without XCP-ng provisioning
    }

    // 3. Set up Guacamole access
    const map = await getSettingsMap();
    const guacUrl = map.guacamole_url;
    const guacRootUser = map.guacamole_root_username;
    const guacRootPass = map.guacamole_root_password;

    if (guacUrl && guacRootUser && guacRootPass && vmUuid) {
      try {
        const guacUsername = `ins-${instructor.id}-${Date.now()}`;
        const guacPassword = generateSecurePassword(16);
        const effectiveIp = vmIp || "";

        await provisionGuacamoleTempAccess(
          guacUrl,
          guacRootUser,
          guacRootPass,
          guacUsername,
          guacPassword,
          vmUuid,
          protocol as "ssh" | "rdp",
          effectiveIp,
          protocol === "ssh" ? "xen" : "lab",
          "000000"
        );

        const rootAuth = await getGuacamoleToken(guacUrl, guacRootUser, guacRootPass);

        await db.vMRequest.update({
          where: { id: vmRequest.id },
          data: {
            vmUuid,
            vmName: finalVmName,
            vmIp,
            guacUsername,
            guacPassword: await encryptField(guacPassword).catch(() => guacPassword),
            guacDataSource: rootAuth.dataSource,
            guacProtocol: protocol,
          },
        });
      } catch (err) {
        console.error("Guacamole setup failed (non-fatal):", err);
        // Update without Guacamole
        await db.vMRequest.update({
          where: { id: vmRequest.id },
          data: { vmUuid, vmName: finalVmName, vmIp },
        });
      }
    } else {
      // Update without Guacamole
      await db.vMRequest.update({
        where: { id: vmRequest.id },
        data: { vmUuid, vmName: finalVmName, vmIp },
      });
    }

    return NextResponse.json({
      ok: true,
      id: vmRequest.id,
      vmUuid,
      vmName: finalVmName,
      vmIp,
    });
  } catch (error) {
    console.error("Instructor VM create error:", error);
    return NextResponse.json({ error: "Failed to create VM." }, { status: 500 });
  }
}
