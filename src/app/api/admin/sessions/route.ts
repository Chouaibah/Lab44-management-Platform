import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(request: Request) {
  try {
    await requireRole("admin");

    const { searchParams } = new URL(request.url);
    const activeOnly = searchParams.get("active") === "true";
    const userRole = searchParams.get("userRole");
    const search = searchParams.get("search");

    const where: Record<string, unknown> = {};
    if (activeOnly) where.isActive = true;
    if (userRole && userRole !== "all") where.userRole = userRole;
    if (search) {
      where.userName = { contains: search };
    }

    const sessions = await db.sessionRecord.findMany({
      where,
      orderBy: { lastActiveAt: "desc" },
      take: 200,
    });

    // Stats
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() - 7);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [activeCount, todayLogins, weekLogins, monthLogins] = await Promise.all([
      db.sessionRecord.count({ where: { isActive: true } }),
      db.sessionRecord.count({ where: { loginAt: { gte: todayStart } } }),
      db.sessionRecord.count({ where: { loginAt: { gte: weekStart } } }),
      db.sessionRecord.count({ where: { loginAt: { gte: monthStart } } }),
    ]);

    // Login history chart data — logins per day for last 30 days
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentSessions = await db.sessionRecord.findMany({
      where: { loginAt: { gte: thirtyDaysAgo } },
      select: { loginAt: true },
    });

    // Group by day
    const loginByDay: Record<string, number> = {};
    for (let i = 0; i < 30; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() - (29 - i));
      const key = d.toISOString().slice(0, 10);
      loginByDay[key] = 0;
    }
    for (const s of recentSessions) {
      const key = s.loginAt.toISOString().slice(0, 10);
      if (key in loginByDay) {
        loginByDay[key]++;
      }
    }
    const chartData = Object.entries(loginByDay).map(([date, count]) => ({ date, count }));

    return NextResponse.json({
      sessions: sessions.map(s => ({
        id: s.id,
        userId: s.userId,
        userRole: s.userRole,
        userName: s.userName,
        tokenJti: s.tokenJti,
        ipAddress: s.ipAddress,
        userAgent: s.userAgent,
        loginAt: s.loginAt.toISOString(),
        lastActiveAt: s.lastActiveAt.toISOString(),
        logoutAt: s.logoutAt?.toISOString() || null,
        isActive: s.isActive,
      })),
      stats: {
        activeNow: activeCount,
        todayLogins,
        weekLogins,
        monthLogins,
      },
      chartData,
    });
  } catch (error: unknown) {
    if (error instanceof Error && (error.message.includes("Authentication required") || error.message.includes("Insufficient"))) {
      return NextResponse.json({ error: "Admin access required." }, { status: 403 });
    }
    console.error("Session list error:", error);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}
