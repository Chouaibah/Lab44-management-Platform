import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

// POST — Student marks themselves present for the current open attendance session
export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { error: "Authentication required." },
        { status: 401 }
      );
    }

    const { studentId, labId } = await request.json();
    if (!studentId) {
      return NextResponse.json(
        { error: "studentId is required." },
        { status: 400 }
      );
    }

    const studentIdNum = parseInt(String(studentId));

    // Students can only mark themselves
    if (session.role === "student" && session.userId !== studentIdNum) {
      return NextResponse.json(
        { error: "You can only mark attendance for yourself." },
        { status: 403 }
      );
    }

    // Get student's lab memberships
    const studentLabs = await db.studentLab.findMany({
      where: { studentId: studentIdNum },
      select: { labId: true },
    });

    if (studentLabs.length === 0) {
      return NextResponse.json(
        { error: "You are not enrolled in any lab." },
        { status: 400 }
      );
    }

    // Determine which labs to check for open sessions
    // If labId is provided, only check that specific lab
    let labIdsToCheck: number[];
    if (labId) {
      const labIdNum = parseInt(String(labId));
      // Verify student is enrolled in this lab
      if (!studentLabs.some(sl => sl.labId === labIdNum)) {
        return NextResponse.json(
          { error: "You are not enrolled in the specified lab." },
          { status: 403 }
        );
      }
      labIdsToCheck = [labIdNum];
    } else {
      labIdsToCheck = studentLabs.map((sl) => sl.labId);
    }

    // Check for open attendance sessions in the specified labs
    const sessionKeys = labIdsToCheck.map((id) => `attendance_session_open_${id}`);
    const dateKeys = labIdsToCheck.map((id) => `attendance_session_date_${id}`);
    const groupKeys = labIdsToCheck.map((id) => `attendance_session_group_${id}`);

    const settings = await db.setting.findMany({
      where: { key: { in: [...sessionKeys, ...dateKeys, ...groupKeys] } },
    });

    const settingsMap = new Map(settings.map((s) => [s.key, s.value]));

    // Find which labs have open sessions
    const openLabSessions: { labId: number; date: string }[] = [];
    for (const lid of labIdsToCheck) {
      const isOpen =
        settingsMap.get(`attendance_session_open_${lid}`) === "true";
      const date = settingsMap.get(`attendance_session_date_${lid}`);
      if (isOpen && date) {
        openLabSessions.push({ labId: lid, date });
      }
    }

    if (openLabSessions.length === 0) {
      return NextResponse.json(
        { error: "No attendance session is currently open for your lab." },
        { status: 400 }
      );
    }

    // Mark attendance for all open sessions (usually just one)
    const results: { labId: number; date: string; status: string; id: number }[] = [];
    for (const { labId: openLabId, date } of openLabSessions) {
      // Check if there's a group requirement for this session
      const sessionGroupSetting = settingsMap.get(`attendance_session_group_${openLabId}`);
      if (sessionGroupSetting) {
        const requiredGroupId = parseInt(sessionGroupSetting);
        // Check if the student is a member of the required sous-groupe
        const membership = await db.sousGroupeMember.findFirst({
          where: {
            sousGroupeId: requiredGroupId,
            studentId: studentIdNum,
          },
        });
        if (!membership) {
          // Get the group name for a clearer error message
          const sg = await db.sousGroupe.findUnique({
            where: { id: requiredGroupId },
            select: { name: true },
          });
          return NextResponse.json(
            { error: `This attendance session is restricted to the group "${sg?.name || 'unknown'}". You are not a member of this group.` },
            { status: 403 }
          );
        }
      }

      // Check if already marked
      const existing = await db.attendance.findUnique({
        where: {
          studentId_date_labId: { studentId: studentIdNum, date, labId: openLabId },
        },
      });

      if (existing && existing.status === "present") {
        results.push({
          labId: openLabId,
          date,
          status: "already_marked",
          id: existing.id,
        });
        continue;
      }

      // Create or update attendance record
      const record = await db.attendance.upsert({
        where: {
          studentId_date_labId: { studentId: studentIdNum, date, labId: openLabId },
        },
        update: {
          status: "present",
          note: existing?.note || null,
        },
        create: {
          studentId: studentIdNum,
          date,
          labId: openLabId,
          status: "present",
        },
      });

      results.push({ labId: openLabId, date, status: "marked", id: record.id });
    }

    return NextResponse.json({ ok: true, results });
  } catch (error) {
    console.error("Attendance mark error:", error);
    return NextResponse.json(
      { error: "Failed to mark attendance." },
      { status: 500 }
    );
  }
}
