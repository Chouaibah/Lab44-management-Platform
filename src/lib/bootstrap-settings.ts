import { db } from "@/lib/db";

/**
 * First-boot configuration.
 *
 * Lab44 keeps its integration settings in the `Setting` table, which normally
 * means an admin has to type the Guacamole / ownCloud / XCP-ng details into the
 * UI before anything works. In a Docker deployment all of that is already known
 * from the environment, so we seed it instead.
 *
 * Two rules make this safe to run on every boot:
 *
 *   1. It only ever INSERTS keys that do not exist yet — an existing value is
 *      never overwritten, so anything edited later in the admin UI wins.
 *   2. It never throws: failures are logged and boot continues, because a
 *      settings problem must not stop the platform from starting.
 *
 * Note the internal/public URL split. The server reaches Guacamole and ownCloud
 * over the Docker network (`http://guacamole:8080`), but a user's browser cannot
 * resolve those names, so it needs the public URL (`https://guacamole.example.com`).
 * Both are seeded separately; see `guacamole.ts` and `owncloud.ts`.
 */

/** Ensure a URL carries a scheme, since the downstream code assumes one. */
function normalizeUrl(value: string, defaultScheme: "http" | "https"): string {
  const trimmed = value.trim().replace(/\/+$/, "");
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `${defaultScheme}://${trimmed}`;
}

function buildEntries(): Array<{ key: string; value: string }> {
  const raw: Array<{ key: string; value: string | undefined; scheme?: "http" | "https" }> = [
    // ── XCP-ng hypervisor (external hardware, not part of the compose stack) ──
    { key: "xcpng_host", value: process.env.XCPNG_HOST },
    { key: "xcpng_username", value: process.env.XCPNG_USERNAME },
    { key: "xcpng_password", value: process.env.XCPNG_PASSWORD },

    // ── Apache Guacamole ─────────────────────────────────────────────────────
    { key: "guacamole_url", value: process.env.GUACAMOLE_INTERNAL_URL, scheme: "http" },
    { key: "guacamole_public_url", value: process.env.GUACAMOLE_PUBLIC_URL, scheme: "https" },
    { key: "guacamole_root_username", value: process.env.GUACAMOLE_ADMIN_USERNAME },
    { key: "guacamole_root_password", value: process.env.GUACAMOLE_ADMIN_PASSWORD },

    // ── ownCloud ─────────────────────────────────────────────────────────────
    { key: "owncloud_url", value: process.env.OWNCLOUD_INTERNAL_URL, scheme: "http" },
    { key: "owncloud_public_url", value: process.env.OWNCLOUD_PUBLIC_URL, scheme: "https" },
    { key: "owncloud_admin_username", value: process.env.OWNCLOUD_ADMIN_USERNAME },
    { key: "owncloud_admin_password", value: process.env.OWNCLOUD_ADMIN_PASSWORD },

    // ── Nexterm (only used when remote_provider = "nexterm") ─────────────────
    { key: "nexterm_url", value: process.env.NEXTERM_INTERNAL_URL, scheme: "http" },
    { key: "nexterm_public_url", value: process.env.NEXTERM_PUBLIC_URL, scheme: "https" },
    { key: "nexterm_admin_username", value: process.env.NEXTERM_ADMIN_USERNAME },
    { key: "nexterm_admin_password", value: process.env.NEXTERM_ADMIN_PASSWORD },

    // ── Platform flags ───────────────────────────────────────────────────────
    { key: "signup_enabled", value: process.env.SIGNUP_ENABLED },

    // Which remote-console backend Lab44 provisions VM access through:
    // "guacamole" (default) or "nexterm". Seeded once; changing it later is done
    // in the admin UI or by switching the stack with ./scripts/install.sh.
    { key: "remote_provider", value: process.env.REMOTE_PROVIDER },
  ];

  return raw
    .filter((e) => typeof e.value === "string" && e.value.trim() !== "")
    .map((e) => ({
      key: e.key,
      value: e.scheme ? normalizeUrl(e.value as string, e.scheme) : (e.value as string).trim(),
    }));
}

/**
 * Insert any settings that the environment provides and the database lacks.
 * Returns the number of settings created (0 once the install is configured).
 */
export async function seedSettingsFromEnv(): Promise<number> {
  const entries = buildEntries();
  if (entries.length === 0) return 0;

  // createMany + skipDuplicates compiles to `ON CONFLICT DO NOTHING`, so this is
  // a single idempotent INSERT that cannot clobber an edited value.
  const result = await db.setting.createMany({
    data: entries,
    skipDuplicates: true,
  });

  if (result.count > 0) {
    console.log(`[bootstrap] seeded ${result.count} setting(s) from environment`);
  }
  return result.count;
}
