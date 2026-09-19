import { NextResponse } from "next/server";
import { AuthError } from "@/lib/auth";

/**
 * Convert a thrown guard error (`requireAuth` / `requireRole`) into the correct
 * HTTP response, or return `null` for any other error so the caller can fall
 * through to its own handling.
 *
 * Why this exists: an `AuthError` thrown by a guard lands in a route's generic
 * `catch (error)` block, which reports it as a **500 server error** instead of a
 * 401/403. That is both misleading and wrong — an unauthenticated request is not
 * a server fault.
 *
 * Both `instanceof` and a duck-typed `statusCode` are checked on purpose:
 * Next.js can place the `AuthError` class in more than one route bundle, in
 * which case `instanceof` fails even though the error is ours.
 */
export function handleAuthError(error: unknown): NextResponse | null {
  let statusCode: number | null = null;

  if (error instanceof AuthError) {
    statusCode = error.statusCode;
  } else if (error && typeof error === "object") {
    const candidate = (error as { statusCode?: unknown }).statusCode;
    if (typeof candidate === "number") statusCode = candidate;
  }

  if (statusCode !== 401 && statusCode !== 403) return null;

  const message =
    error instanceof Error && error.message ? error.message : "Access denied.";

  return NextResponse.json({ ok: false, error: message }, { status: statusCode });
}
