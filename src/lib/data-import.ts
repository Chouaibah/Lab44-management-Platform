import { db } from "./db";

const ALLOWED_IMPORT_SETTINGS_KEYS = new Set([
  "signup_enabled",
  "hide_grades_from_students",
  "lab_name",
]);

export interface ImportResults {
  labs: number;
  instructors: number;
  students: number;
  columns: number;
  grades: number;
  announcements: number;
  attendance: number;
  sousGroupes: number;
  messages: number;
}

export async function importLabs(labs: any[]): Promise<{ labIdMap: Record<number, number>; count: number }> {
  if (!Array.isArray(labs)) return { labIdMap: {}, count: 0 };

  const labIdMap: Record<number, number> = {};
  let count = 0;

  for (const l of labs) {
    if (!l.name || typeof l.name !== "string") continue;
    const existing = await db.lab.findFirst({ where: { name: l.name } });
    if (existing) {
      labIdMap[l.id] = existing.id;
    } else {
      // Hash password if provided (don't store plaintext)
      let hashedPassword: string | null = null;
      if (l.password?.trim()) {
        const { hashPassword } = await import("@/lib/auth");
        hashedPassword = await hashPassword(l.password.trim());
      }
      const created = await db.lab.create({
        data: {
          name: l.name,
          description: l.description || null,
          password: hashedPassword,
          level: l.level || null,
        },
      });
      labIdMap[l.id] = created.id;
      count++;
    }
  }

  return { labIdMap, count };
}

export async function importInstructors(
  instructors: any[],
  labIdMap: Record<number, number>
): Promise<{ instructorIdMap: Record<number, number>; count: number }> {
  if (!Array.isArray(instructors)) return { instructorIdMap: {}, count: 0 };

  const instructorIdMap: Record<number, number> = {};
  let count = 0;

  for (const i of instructors) {
    if (!i.username || typeof i.username !== "string") continue;
    const existing = await db.instructor.findFirst({ where: { username: i.username } });
    if (existing) {
      instructorIdMap[i.id] = existing.id;
      // Update lab assignment if changed
      const mappedLabId = i.labId ? labIdMap[i.labId] || i.labId : null;
      if (mappedLabId && existing.labId !== mappedLabId) {
        await db.instructor.update({ where: { id: existing.id }, data: { labId: mappedLabId } });
      }
      // Update InstructorLab records if labIds provided
      if (Array.isArray(i.labIds)) {
        const newLabIds = i.labIds.map((lid: number) => labIdMap[lid] || lid).filter((lid: number) => lid !== mappedLabId);
        const currentInstructorLabs = await db.instructorLab.findMany({
          where: { instructorId: existing.id },
          select: { labId: true },
        });
        const currentLabIds = new Set(currentInstructorLabs.map(il => il.labId));
        const toDelete = [...currentLabIds].filter(lid => !newLabIds.includes(lid));
        const toAdd = newLabIds.filter((lid: number) => !currentLabIds.has(lid));
        if (toDelete.length > 0) {
          await db.instructorLab.deleteMany({ where: { instructorId: existing.id, labId: { in: toDelete } } });
        }
        if (toAdd.length > 0) {
          await db.instructorLab.createMany({ data: toAdd.map((labId: number) => ({ instructorId: existing.id, labId })) });
        }
      }
    } else {
      const mappedLabId = i.labId ? labIdMap[i.labId] || i.labId : null;
      const extraLabIds = Array.isArray(i.labIds)
        ? i.labIds.map((lid: number) => labIdMap[lid] || lid).filter((lid: number) => lid !== mappedLabId)
        : [];
      const created = await db.instructor.create({
        data: {
          username: i.username,
          password: i.password || "changeme",
          displayName: i.displayName || i.username,
          email: i.email || null,
          labId: mappedLabId,
          instructorLabs: {
            create: extraLabIds.map((labId: number) => ({ labId })),
          },
        },
      });
      instructorIdMap[i.id] = created.id;
      count++;
    }
  }

  return { instructorIdMap, count };
}

export async function importColumns(
  columns: any[],
  labIdMap: Record<number, number>
): Promise<number> {
  if (!Array.isArray(columns)) return 0;

  let count = 0;
  for (const col of columns) {
    if (!col.name || typeof col.name !== "string") continue;
    const mappedLabId = col.labId ? labIdMap[col.labId] : undefined;
    if (!mappedLabId) {
      // Fallback to first lab
      const firstLab = await db.lab.findFirst({ orderBy: { id: "asc" } });
      if (!firstLab) continue;
      const existing = await db.gradeColumn.findFirst({
        where: { name: col.name, labId: firstLab.id },
      });
      if (!existing) {
        await db.gradeColumn.create({ data: { name: col.name, labId: firstLab.id } });
        count++;
      }
    } else {
      const existing = await db.gradeColumn.findFirst({
        where: { name: col.name, labId: mappedLabId },
      });
      if (!existing) {
        await db.gradeColumn.create({ data: { name: col.name, labId: mappedLabId } });
        count++;
      }
    }
  }
  return count;
}

export async function importStudents(
  students: any[],
  labIdMap: Record<number, number>
): Promise<{ studentIdMap: Record<string, number>; count: number }> {
  const studentIdMap: Record<string, number> = {};
  let count = 0;

  const existingStudents = await db.student.findMany();

  for (const s of students) {
    if (!s.studentId || typeof s.studentId !== "string") continue;
    const existing = existingStudents.find((es) => es.studentId === s.studentId);
    if (existing) {
      studentIdMap[s.studentId] = existing.id;
    } else {
      const created = await db.student.create({
        data: {
          firstName: s.firstName || "",
          lastName: s.lastName || "",
          studentId: s.studentId,
          password: s.password || "changeme",
        },
      });
      studentIdMap[s.studentId] = created.id;
      count++;

      // Assign to labs
      const labIds: number[] = s.labIds || (s.labId ? [s.labId] : []);
      for (const rawLabId of labIds) {
        const mappedLabId = labIdMap[rawLabId] || rawLabId;
        try {
          await db.studentLab.create({
            data: { studentId: created.id, labId: mappedLabId },
          });
        } catch { /* duplicate, ignore */ }
      }
    }
  }

  return { studentIdMap, count };
}

export async function importGrades(
  grades: any[],
  studentIdMap: Record<string, number>
): Promise<number> {
  if (!Array.isArray(grades)) return 0;

  const gradeData = grades
    .map((g: any) => {
      const studentId = g.studentDbId || studentIdMap[String(g.studentId)];
      const columnId = typeof g.columnId === "number" ? g.columnId : undefined;
      if (!studentId || !columnId || g.value === null || g.value === undefined)
        return null;
      return { studentId, columnId, value: g.value };
    })
    .filter(Boolean) as Array<{ studentId: number; columnId: number; value: any }>;

  let count = 0;
  for (const g of gradeData) {
    const existing = await db.grade.findFirst({
      where: { studentId: g.studentId, columnId: g.columnId },
    });
    if (!existing) {
      await db.grade.create({
        data: { studentId: g.studentId, columnId: g.columnId, value: g.value },
      });
      count++;
    }
  }
  return count;
}

export async function importAnnouncements(
  announcements: any[],
  labIdMap: Record<number, number>
): Promise<number> {
  if (!Array.isArray(announcements)) return 0;

  const announcementData = [];
  for (const a of announcements) {
    if (!a.title || typeof a.title !== "string") continue;
    const mappedLabId = a.labId ? labIdMap[a.labId] || null : null;
    announcementData.push({
      title: a.title,
      content: a.content || "",
      author: a.author || "Imported",
      category: a.category || "general",
      pinned: a.pinned || false,
      labId: mappedLabId,
      showFrom: a.showFrom ? new Date(a.showFrom) : null,
      showUntil: a.showUntil ? new Date(a.showUntil) : null,
    });
  }

  if (announcementData.length > 0) {
    await db.announcement.createMany({ data: announcementData as any });
  }
  return announcementData.length;
}

export async function importAttendance(
  attendance: any[],
  studentIdMap: Record<string, number>,
  labIdMap: Record<number, number>
): Promise<number> {
  if (!Array.isArray(attendance)) return 0;

  // Get all labs for fallback when labId is not specified
  const allLabs = await db.lab.findMany({ select: { id: true } });
  const defaultLabId = allLabs[0]?.id;

  const attendanceData = attendance
    .filter((r: any) => {
      const studentId = r.studentDbId || studentIdMap[String(r.studentId)];
      return studentId && r.date && r.status;
    })
    .map((r: any) => ({
      studentId: r.studentDbId || studentIdMap[String(r.studentId)],
      date: r.date,
      labId: r.labId ? (labIdMap[r.labId] || r.labId) : defaultLabId,
      status: r.status,
      note: r.note || null,
      markedBy: r.markedBy || null,
    }))
    .filter((r: any) => r.labId);

  let count = 0;
  for (const rec of attendanceData) {
    try {
      await db.attendance.upsert({
        where: {
          studentId_date_labId: {
            studentId: rec.studentId as number,
            date: rec.date as string,
            labId: rec.labId as number,
          },
        },
        update: { status: rec.status, note: rec.note },
        create: rec as any,
      });
      count++;
    } catch {}
  }
  return count;
}

export async function importSousGroupes(
  sousGroupes: any[],
  labIdMap: Record<number, number>,
  studentIdMap: Record<string, number>
): Promise<number> {
  if (!Array.isArray(sousGroupes)) return 0;

  let count = 0;
  for (const sg of sousGroupes) {
    if (!sg.name || typeof sg.name !== "string") continue;
    const mappedLabId = sg.labId ? labIdMap[sg.labId] : null;
    if (!mappedLabId) continue;

    const existing = await db.sousGroupe.findFirst({
      where: { name: sg.name, labId: mappedLabId },
    });
    if (existing) continue;

    const memberData = (sg.members || [])
      .map((m: any) => {
        const dbId = studentIdMap[String(m.studentId)];
        return dbId ? { studentId: dbId } : null;
      })
      .filter(Boolean);

    await db.sousGroupe.create({
      data: {
        name: sg.name,
        labId: mappedLabId,
        members: { create: memberData },
      },
    });
    count++;
  }
  return count;
}

export async function importMessages(
  messages: any[],
  studentIdMap: Record<string, number>,
  instructorIdMap: Record<number, number>
): Promise<number> {
  if (!Array.isArray(messages)) return 0;

  let count = 0;
  for (const m of messages) {
    if (!m.content || !m.senderId || !m.receiverId) continue;

    const senderId = m.senderRole === "instructor"
      ? instructorIdMap[m.senderId] || m.senderId
      : studentIdMap[String(m.senderId)] || m.senderId;
    const receiverId = m.receiverRole === "instructor"
      ? instructorIdMap[m.receiverId] || m.receiverId
      : studentIdMap[String(m.receiverId)] || m.receiverId;

    try {
      await db.message.create({
        data: {
          senderId: typeof senderId === "number" ? senderId : parseInt(senderId),
          senderRole: m.senderRole || "student",
          receiverId: typeof receiverId === "number" ? receiverId : parseInt(receiverId),
          receiverRole: m.receiverRole || "instructor",
          content: m.content,
          read: m.read || false,
          createdAt: m.createdAt ? new Date(m.createdAt) : new Date(),
        },
      });
      count++;
    } catch { /* skip invalid messages */ }
  }
  return count;
}

export async function importSettings(settings: any): Promise<void> {
  if (!settings || typeof settings !== "object") return;

  const entries = Array.isArray(settings)
    ? settings.map((s: any) => [s.key, s.value])
    : Object.entries(settings);

  for (const [key, value] of entries) {
    if (typeof key !== "string" || typeof value !== "string") continue;
    if (!ALLOWED_IMPORT_SETTINGS_KEYS.has(key)) continue;
    await db.setting.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });
  }
}

export async function runFullImport(body: any): Promise<ImportResults> {
  const results: ImportResults = {
    labs: 0,
    instructors: 0,
    students: 0,
    columns: 0,
    grades: 0,
    announcements: 0,
    attendance: 0,
    sousGroupes: 0,
    messages: 0,
  };

  // Import labs first (v2 format)
  let labIdMap: Record<number, number> = {};
  if (body.labs && Array.isArray(body.labs)) {
    const labResult = await importLabs(body.labs);
    labIdMap = labResult.labIdMap;
    results.labs = labResult.count;
  }

  // Import instructors (v2 format)
  let instructorIdMap: Record<number, number> = {};
  if (body.instructors && Array.isArray(body.instructors)) {
    const instResult = await importInstructors(body.instructors, labIdMap);
    instructorIdMap = instResult.instructorIdMap;
    results.instructors = instResult.count;
  }

  // Import columns (v2 uses gradeColumns key, v1 uses columns)
  const columnsData = body.gradeColumns || body.columns;
  if (columnsData && Array.isArray(columnsData)) {
    results.columns = await importColumns(columnsData, labIdMap);
  }

  // Import students
  const { studentIdMap, count: studentCount } = await importStudents(
    body.students || [],
    labIdMap
  );
  results.students = studentCount;

  // Import grades
  if (body.grades) {
    results.grades = await importGrades(body.grades, studentIdMap);
  }

  // Import announcements
  if (body.announcements) {
    results.announcements = await importAnnouncements(body.announcements, labIdMap);
  }

  // Import attendance
  if (body.attendance) {
    results.attendance = await importAttendance(body.attendance, studentIdMap, labIdMap);
  }

  // Import sous-groupes (v2)
  if (body.sousGroupes) {
    results.sousGroupes = await importSousGroupes(body.sousGroupes, labIdMap, studentIdMap);
  }

  // Import messages (v2)
  if (body.messages) {
    results.messages = await importMessages(body.messages, studentIdMap, instructorIdMap);
  }

  // Import settings
  if (body.settings) {
    await importSettings(body.settings);
  }

  return results;
}
