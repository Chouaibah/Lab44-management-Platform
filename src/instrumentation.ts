/**
 * Next.js instrumentation hook — runs once when the server starts, before any
 * request is served.
 *
 * We use it to seed Lab44's `Setting` rows from environment variables so a
 * Docker install needs no manual configuration in the admin UI. See
 * `src/lib/bootstrap-settings.ts` for the (insert-only) semantics.
 *
 * Everything here is best-effort: a failure is logged and the server continues,
 * because a configuration hiccup must never take the platform down.
 */
export async function register(): Promise<void> {
  // Only meaningful in the Node.js runtime, and never during `next build`
  // (the database may not even exist at that point).
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  if (process.env.LAB44_SKIP_SETTINGS_SEED === "true") return;
  if (!process.env.DATABASE_URL) return;

  try {
    const { seedSettingsFromEnv } = await import("@/lib/bootstrap-settings");
    await seedSettingsFromEnv();
  } catch (error) {
    console.error("[bootstrap] settings seeding failed (continuing):", error);
  }
}
