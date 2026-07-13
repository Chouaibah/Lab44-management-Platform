import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

// Helper to get session settings for a specific lab
async function getAttendanceSession(labId: number) {
  const keys = [
    `attendance_session_open_${labId}`,
    `attendance_session_date_${labId}`,
    `attendance_session_group_${labId}`,
  ];
  const settings = await db.setting.findMany({
    where: { key: { in: keys } },
  });

  const map = new Map(settings.map((s) => [s.key, s.value]));
  const open = map.get(`attendance_session_open_${labId}`) === "true";
  const date = map.get(`attendance_session_date_${labId}`) || null;
  const sousGroupeId = map.get(`attendance_session_group_${labId}`) || null;

  return { open, date, labId, sousGroupeId };
}

// Helper to get all lab IDs for an instructor
async function getInstructorLabIds(instructorId: number, primaryLabId: number): Promise<number[]> {
  const instructorLabs = await db.instructorLab.findMany({
    where: { instructorId },
    select: { labId: true },
  });
  return [primaryLabId, ...instructorLabs.map(il => il.labId)];
}

// GET — Returns current session state for a given lab (or all labs for a student)
export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { error: "Authentication required." },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const labId = searchParams.get("labId");

    // If specific labId requested
    if (labId) {
      const state = await getAttendanceSession(parseInt(labId));
      return NextResponse.json(state);
    }

    // For students: check all labs they belong to
    if (session.role === "student") {
      const studentLabs = await db.studentLab.findMany({
        where: { studentId: session.userId },
      });

      const sessions = await Promise.all(
        studentLabs.map((sl) => getAttendanceSession(sl.labId))
      );

      // Return only open sessions
      const openSessions = sessions.filter((s) => s.open);
      return NextResponse.json({ sessions: openSessions });
    }

    // For instructors: return sessions for all their assigned labs
    if (session.role === "instructor" && session.labId) {
      const myLabIds = await getInstructorLabIds(session.userId, session.labId);
      const sessions = await Promise.all(
        myLabIds.map((lid) => getAttendanceSession(lid))
      );
      return NextResponse.json({ sessions });
    }

    return NextResponse.json({ open: false, date: null, labId: null });
  } catch (error) {
    console.error("Attendance session GET error:", error);
    return NextResponse.json(
      { error: "Failed to get session state." },
      { status: 500 }
    );
  }
}

// POST — Open or close an attendance session
export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { error: "Authentication required." },
        { status: 401 }
      );
    }
    if (session.role !== "admin" && session.role !== "instructor") {
      return NextResponse.json(
        { error: "Insufficient permissions." },
        { status: 403 }
      );
    }

    const { action, date, labId, sousGroupeId } = await request.json();
    if (!labId) {
      return NextResponse.json(
        { error: "labId is required." },
        { status: 400 }
      );
    }

    const labIdNum = parseInt(String(labId));

    // If instructor, verify they are assigned to this lab
    if (session.role === "instructor") {
      const myLabIds = await getInstructorLabIds(session.userId, session.labId);
      if (!myLabIds.includes(labIdNum)) {
        return NextResponse.json(
          { error: "You can only manage attendance sessions for your own labs." },
          { status: 403 }
        );
      }
    }

    if (action === "open") {
      if (!date) {
        return NextResponse.json(
          { error: "date is required to open a session." },
          { status: 400 }
        );
      }

      // Upsert the settings
      await db.setting.upsert({
        where: { key: `attendance_session_open_${labIdNum}` },
        update: { value: "true" },
        create: {
          key: `attendance_session_open_${labIdNum}`,
          value: "true",
        },
      });

      await db.setting.upsert({
        where: { key: `attendance_session_date_${labIdNum}` },
        update: { value: date },
        create: {
          key: `attendance_session_date_${labIdNum}`,
          value: date,
        },
      });

      // Store group requirement if provided
      if (sousGroupeId && sousGroupeId !== 'all') {
        await db.setting.upsert({
          where: { key: `attendance_session_group_${labIdNum}` },
          update: { value: String(sousGroupeId) },
          create: {
            key: `attendance_session_group_${labIdNum}`,
            value: String(sousGroupeId),
          },
        });
      } else {
        // If "all" or no group, remove the group requirement
        const existing = await db.setting.findUnique({
          where: { key: `attendance_session_group_${labIdNum}` },
        });
        if (existing) {
          await db.setting.delete({ where: { key: `attendance_session_group_${labIdNum}` } });
        }
      }

      return NextResponse.json({ ok: true, open: true, date, labId: labIdNum });
    }

    if (action === "close") {
      // Get the current session date
      const dateSetting = await db.setting.findUnique({
        where: { key: `attendance_session_date_${labIdNum}` },
      });

      const sessionDate = dateSetting?.value;

      // Check if session was restricted to a specific sous-groupe
      const groupSetting = await db.setting.findUnique({
        where: { key: `attendance_session_group_${labIdNum}` },
      });
      const sessionGroupId = groupSetting?.value ? parseInt(groupSetting.value) : null;

      if (sessionDate) {
        // Get all students in this lab
        const labStudents = await db.studentLab.findMany({
          where: { labId: labIdNum },
          select: { studentId: true },
        });

        let studentIds = labStudents.map((sl) => sl.studentId);

        // If session was restricted to a specific sous-groupe, only target its members
        if (sessionGroupId) {
          const groupMembers = await db.sousGroupeMember.findMany({
            where: { sousGroupeId: sessionGroupId },
            select: { studentId: true },
          });
          const groupMemberIds = new Set(groupMembers.map((m) => m.studentId));
          studentIds = studentIds.filter((id) => groupMemberIds.has(id));
        }

        // Find which students already have attendance for this date AND lab
        const existingAttendance = await db.attendance.findMany({
          where: {
            studentId: { in: studentIds },
            date: sessionDate,
            labId: labIdNum,
          },
          select: { studentId: true },
        });

        const markedStudentIds = new Set(
          existingAttendance.map((a) => a.studentId)
        );

        // Auto-mark absent for students who didn't mark themselves
        const unmarkedStudents = studentIds.filter(
          (id) => !markedStudentIds.has(id)
        );

        if (unmarkedStudents.length > 0) {
          await Promise.all(
            unmarkedStudents.map((studentId) =>
              db.attendance.upsert({
                where: {
                  studentId_date_labId: { studentId, date: sessionDate, labId: labIdNum },
                },
                update: { status: "absent" },
                create: {
                  studentId,
                  date: sessionDate,
                  labId: labIdNum,
                  status: "absent",
                  note: "[Auto] Not marked during open session",
                },
              })
            )
          );
        }
      }

      // Close the session
      await db.setting.upsert({
        where: { key: `attendance_session_open_${labIdNum}` },
        update: { value: "false" },
        create: {
          key: `attendance_session_open_${labIdNum}`,
          value: "false",
        },
      });

      // Clean up the group requirement setting
      const existingGroup = await db.setting.findUnique({
        where: { key: `attendance_session_group_${labIdNum}` },
      });
      if (existingGroup) {
        await db.setting.delete({ where: { key: `attendance_session_group_${labIdNum}` } });
      }

      return NextResponse.json({
        ok: true,
        open: false,
        date: sessionDate,
        labId: labIdNum,
      });
    }

    return NextResponse.json(
      { error: "Invalid action. Use 'open' or 'close'." },
      { status: 400 }
    );
  } catch (error) {
    console.error("Attendance session POST error:", error);
    return NextResponse.json(
      { error: "Failed to manage attendance session." },
      { status: 500 }
    );
  }
}
