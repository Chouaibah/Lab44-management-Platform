import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

// Hard crash at startup if SESSION_SECRET is missing
const rawSecret = process.env.SESSION_SECRET;
if (!rawSecret) {
  throw new Error("[proxy] SESSION_SECRET is not set in environment variables!");
}
const SESSION_SECRET = new TextEncoder().encode(rawSecret);

const COOKIE_NAME = "lab44_auth_session";

interface JWTPayload {
  role: "admin" | "instructor" | "student";
  userId: number;
  username?: string;
  labId?: number;
}

const ROUTE_RULES: {
  pattern: RegExp;
  allowedRoles: ("admin" | "instructor" | "student")[];
}[] = [
  { pattern: /^\/api\/auth\/admin/, allowedRoles: [] },
  { pattern: /^\/api\/auth\/instructor/, allowedRoles: [] },
  { pattern: /^\/api\/auth\/student/, allowedRoles: [] },
  { pattern: /^\/api\/students\/register/, allowedRoles: [] },
  { pattern: /^\/api\/announcements$/, allowedRoles: ["admin", "instructor", "student"] },
  // Reactions are authored by students (AnnouncementReaction.studentId is a
  // Student FK), so this sub-path must stay reachable by the student role.
  // Must be listed before the general /api/announcements/* rule below.
  { pattern: /^\/api\/announcements\/\d+\/reactions/, allowedRoles: ["admin", "instructor", "student"] },
  { pattern: /^\/api\/announcements\//, allowedRoles: ["admin", "instructor"] },
  { pattern: /^\/api\/data\/purge/, allowedRoles: ["admin"] },
  { pattern: /^\/api\/data\/import/, allowedRoles: ["admin"] },
  { pattern: /^\/api\/data\/export/, allowedRoles: ["admin"] },
  { pattern: /^\/api\/data/, allowedRoles: ["admin", "instructor", "student"] },
  { pattern: /^\/api\/settings/, allowedRoles: ["admin"] },
  { pattern: /^\/api\/instructors/, allowedRoles: ["admin", "instructor"] },
  { pattern: /^\/api\/xcp-ng\/templates/, allowedRoles: ["admin", "instructor", "student"] },
  { pattern: /^\/api\/xcp-ng/, allowedRoles: ["admin"] },
  // XCP-ng API VM routes — UUID is in the path: /api/xapi/vms/[uuid]/details or /action
  { pattern: /^\/api\/xapi\/vms\/[^/]+\/details/, allowedRoles: ["admin", "instructor", "student"] },
  { pattern: /^\/api\/xapi\/vms\/[^/]+\/action/, allowedRoles: ["admin", "instructor", "student"] },
  { pattern: /^\/api\/xapi\/vms\/[^/]+\/vnc/, allowedRoles: ["admin", "instructor", "student"] },
  { pattern: /^\/api\/xapi/, allowedRoles: ["admin", "instructor"] },
  { pattern: /^\/api\/guacamole\/auth/, allowedRoles: ["admin", "instructor", "student"] },
  { pattern: /^\/api\/guacamole\/connect/, allowedRoles: ["admin", "instructor", "student"] },
  { pattern: /^\/api\/guacamole/, allowedRoles: ["admin"] },
  { pattern: /^\/api\/vm-requests\/\d+\/approve/, allowedRoles: ["admin", "instructor"] },
  { pattern: /^\/api\/vm-requests\/\d+\/reject/, allowedRoles: ["admin", "instructor"] },
  { pattern: /^\/api\/vm-requests\/\d+\/delete/, allowedRoles: ["admin", "instructor"] },
  { pattern: /^\/api\/vm-requests\/\d+\/logs/, allowedRoles: ["admin", "instructor"] },
  { pattern: /^\/api\/vm-requests\/batch/, allowedRoles: ["admin", "instructor"] },
  { pattern: /^\/api\/vm-requests/, allowedRoles: ["admin", "instructor", "student"] },
  { pattern: /^\/api\/grades\/bulk/, allowedRoles: ["admin", "instructor"] },
  { pattern: /^\/api\/grades/, allowedRoles: ["admin", "instructor"] },
  { pattern: /^\/api\/attendance\/self-report/, allowedRoles: ["student"] },
  { pattern: /^\/api\/attendance\/session/, allowedRoles: ["admin", "instructor", "student"] },
  { pattern: /^\/api\/attendance\/mark/, allowedRoles: ["student"] },
  { pattern: /^\/api\/attendance\/bulk/, allowedRoles: ["admin", "instructor"] },
  { pattern: /^\/api\/attendance/, allowedRoles: ["admin", "instructor", "student"] },
  { pattern: /^\/api\/student-grades/, allowedRoles: ["student", "admin", "instructor"] },
  { pattern: /^\/api\/students/, allowedRoles: ["admin", "instructor"] },
  { pattern: /^\/api\/labs/, allowedRoles: ["admin", "instructor", "student"] },
  { pattern: /^\/api\/columns/, allowedRoles: ["admin", "instructor"] },
  { pattern: /^\/api\/activity-logs/, allowedRoles: ["admin"] },
  { pattern: /^\/api\/documents/, allowedRoles: ["admin", "instructor", "student"] },
  { pattern: /^\/api\/messages/, allowedRoles: ["admin", "instructor", "student"] },
  { pattern: /^\/api\/notifications/, allowedRoles: ["admin", "instructor", "student"] },
  { pattern: /^\/api\/resource-links/, allowedRoles: ["admin", "instructor", "student"] },
  { pattern: /^\/api\/sous-groupes/, allowedRoles: ["admin", "instructor", "student"] },
  { pattern: /^\/api\/binomes/, allowedRoles: ["admin", "instructor", "student"] },
  // Exam routes
  { pattern: /^\/api\/exams\/student/, allowedRoles: ["admin", "instructor", "student"] },
  { pattern: /^\/api\/exams\/\d+\/submit/, allowedRoles: ["admin", "instructor", "student"] },
  { pattern: /^\/api\/exams\/\d+\/attempts/, allowedRoles: ["admin", "instructor"] },
  { pattern: /^\/api\/exams\//, allowedRoles: ["admin", "instructor", "student"] },
  { pattern: /^\/api\/exams$/, allowedRoles: ["admin", "instructor", "student"] },
  { pattern: /^\/api\/system/, allowedRoles: ["admin"] },
  { pattern: /^\/api\/instructor\/reset-student-password/, allowedRoles: ["instructor"] },
  { pattern: /^\/api\/instructor-labs/, allowedRoles: ["admin", "instructor"] },
  { pattern: /^\/api\/health/, allowedRoles: [] },
  { pattern: /^\/api\/$/, allowedRoles: [] },
];

async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, SESSION_SECRET);
    return payload as unknown as JWTPayload;
  } catch {
    return null;
  }
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip non-API routes
  if (!pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  // Skip public auth routes (login/register)
  if (pathname.startsWith("/api/auth/")) {
    return NextResponse.next();
  }
  if (pathname.startsWith("/api/students/register")) {
    return NextResponse.next();
  }
  if (pathname.startsWith("/api/health")) {
    return NextResponse.next();
  }
  if (pathname === "/api/" || pathname === "/api/route") {
    return NextResponse.next();
  }

  // Check for session cookie
  const token = request.cookies.get(COOKIE_NAME)?.value;
  if (!token) {
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401 }
    );
  }

  // Verify JWT token
  const session = await verifyToken(token);
  if (!session) {
    const response = NextResponse.json(
      { error: "Invalid or expired session." },
      { status: 401 }
    );
    response.cookies.delete(COOKIE_NAME);
    return response;
  }

  // Check role-based access
  const matchedRule = ROUTE_RULES.find((rule) => rule.pattern.test(pathname));
  if (matchedRule && matchedRule.allowedRoles.length > 0) {
    if (!matchedRule.allowedRoles.includes(session.role)) {
      return NextResponse.json(
        { error: "Insufficient permissions." },
        { status: 403 }
      );
    }
  }

  // Pass session info to API routes via headers
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-session-role", session.role);
  requestHeaders.set("x-session-userid", String(session.userId));
  requestHeaders.set("x-session-labid", String(session.labId || ""));

  return NextResponse.next({
    request: { headers: requestHeaders },
  });
}

export const config = {
  matcher: ["/api/:path*"],
};
