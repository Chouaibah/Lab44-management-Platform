import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import {
  createOwnCloudUser,
  ownCloudUserExists,
  getOwnCloudLoginUrl,
  getOwnCloudConfig,
  setOwnCloudUserPassword,
  storeInstructorOwnCloudPassword,
  getInstructorOwnCloudPassword,
} from "@/lib/owncloud";

/**
 * POST /api/owncloud/provision
 *
 * Called by the instructor panel's "Open OwnCloud" button. Ensures the
 * current instructor has a usable OwnCloud account + password and returns
 * both the login URL and the password (so the instructor can copy-paste
 * it into the OwnCloud login form).
 *
 * Why no auto-login? OwnCloud does NOT support URL-based auto-login for
 * security reasons (no `?user=X&password=Y` redirect). The realistic UX
 * is therefore:
 *
 *   1. Instructor clicks the button.
 *   2. Backend returns the password (decrypted from our encrypted store).
 *   3. Frontend copies the password to the clipboard + shows a toast.
 *   4. Backend also opens OwnCloud's login page in a new tab.
 *   5. Instructor pastes the password into the login form.
 *
 * Resolution strategy:
 *   - OwnCloud not configured → 400.
 *   - Account exists + we have a stored password → return it.
 *   - Account exists + we have NO stored password (e.g. account was created
 *     outside this platform, or before the encrypted-storage feature was
 *     added) → reset the password via OCS API, store it encrypted, return it.
 *   - Account doesn't exist → create it (1 GB quota, "instructor" group)
 *     with a fresh random password, store it encrypted, return it.
 */
export async function POST() {
  try {
    const session = await getSession();
    if (!session || session.role !== "instructor") {
      return NextResponse.json({ error: "Instructor access required." }, { status: 403 });
    }

    const config = await getOwnCloudConfig();
    if (!config) {
      return NextResponse.json({ error: "OwnCloud is not configured." }, { status: 400 });
    }

    const instructor = await db.instructor.findUnique({ where: { id: session.userId } });
    if (!instructor) {
      return NextResponse.json({ error: "Instructor not found." }, { status: 404 });
    }

    const loginUrl = await getOwnCloudLoginUrl();
    if (!loginUrl) {
      return NextResponse.json({ error: "OwnCloud is not configured." }, { status: 400 });
    }

    const username = instructor.username;
    const exists = await ownCloudUserExists(username);

    if (exists) {
      // Try to use the stored password first — that's the one the instructor
      // was originally given and may have used elsewhere.
      const storedPw = await getInstructorOwnCloudPassword(username);
      if (storedPw) {
        return NextResponse.json({
          ok: true,
          loginUrl,
          username,
          password: storedPw,
          source: "stored",
        });
      }

      // No stored password — reset it via the OCS API and persist the new one.
      const { generateSecurePassword } = await import("@/lib/auth");
      const newPassword = generateSecurePassword(16);
      const resetResult = await setOwnCloudUserPassword(username, newPassword);
      if (!resetResult.ok) {
        return NextResponse.json({
          ok: false,
          error: `Failed to reset OwnCloud password: ${resetResult.message || resetResult.status}`,
        });
      }
      try {
        await storeInstructorOwnCloudPassword(username, newPassword);
      } catch (storeErr) {
        console.warn(`Failed to store OwnCloud password for "${username}":`, storeErr);
      }
      return NextResponse.json({
        ok: true,
        loginUrl,
        username,
        password: newPassword,
        source: "reset",
      });
    }

    // Account doesn't exist — provision it from scratch.
    const { generateSecurePassword } = await import("@/lib/auth");
    const ocPassword = generateSecurePassword(16);
    const result = await createOwnCloudUser(
      username,
      ocPassword,
      instructor.displayName,
      instructor.email || undefined,
    );

    if (!result.ok) {
      return NextResponse.json({
        ok: false,
        error: result.error || "Failed to create OwnCloud account.",
      });
    }

    try {
      await storeInstructorOwnCloudPassword(username, ocPassword);
    } catch (storeErr) {
      console.warn(`Failed to store OwnCloud password for "${username}":`, storeErr);
    }

    return NextResponse.json({
      ok: true,
      loginUrl,
      username,
      password: ocPassword,
      source: "created",
    });
  } catch (error) {
    console.error("OwnCloud provision error:", error);
    return NextResponse.json({ error: "Failed to provision OwnCloud account." }, { status: 500 });
  }
}
