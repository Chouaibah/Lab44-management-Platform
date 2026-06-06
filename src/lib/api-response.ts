import { NextResponse } from 'next/server';

/**
 * Return a success JSON response with { ok: true, ...data }
 */
export function apiOk(data: Record<string, unknown> = {}): NextResponse {
  return NextResponse.json({ ok: true, ...data });
}

/**
 * Return an error JSON response with { ok: false, error }
 */
export function apiError(error: string, status = 400): NextResponse {
  return NextResponse.json({ ok: false, error }, { status });
}

/**
 * Return a 401 Unauthorized response.
 */
export function unauthorized(msg = 'Authentication required.'): NextResponse {
  return apiError(msg, 401);
}

/**
 * Return a 403 Forbidden response.
 */
export function forbidden(msg = 'Insufficient permissions.'): NextResponse {
  return apiError(msg, 403);
}

/**
 * Return a 404 Not Found response.
 */
export function notFound(msg = 'Not found.'): NextResponse {
  return apiError(msg, 404);
}

/**
 * Return a 500 Internal Server Error response.
 */
export function serverError(msg = 'Internal server error.'): NextResponse {
  return apiError(msg, 500);
}
