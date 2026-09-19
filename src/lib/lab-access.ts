import { db } from "./db";

/**
 * Lab-scoping helpers.
 *
 * `Lab` is the tenancy unit of this application, but most routes historically
 * trusted a client-supplied lab id (or performed no check at all). These helpers
 * derive the caller's labs from the database so authorization cannot be forged
 * by the client.
 *
 * An instructor's labs are their primary `Instructor.labId` PLUS every row in
 * `instructor_labs`. This mirrors how `GET /api/data` scopes an instructor.
 */

/** Every lab id the instructor is responsible for. Empty if they don't exist. */
export async function getInstructorLabIds(instructorId: number): Promise<number[]> {
  if (!Number.isFinite(instructorId)) return [];

  const instructor = await db.instructor.findUnique({
    where: { id: instructorId },
    select: { labId: true, instructorLabs: { select: { labId: true } } },
  });
  if (!instructor) return [];

  return [
    ...new Set<number>([
      instructor.labId,
      ...instructor.instructorLabs.map((il) => il.labId),
    ]),
  ];
}

/** True when the instructor is assigned to `labId` (primary or secondary). */
export async function instructorTeachesLab(
  instructorId: number,
  labId: number,
): Promise<boolean> {
  if (!Number.isFinite(labId)) return false;
  const labIds = await getInstructorLabIds(instructorId);
  return labIds.includes(labId);
}

/**
 * The set of student ids enrolled in any of the given labs.
 * Useful for verifying a batch of records in one query.
 */
export async function getStudentIdsInLabs(labIds: number[]): Promise<Set<number>> {
  if (labIds.length === 0) return new Set();
  const rows = await db.studentLab.findMany({
    where: { labId: { in: labIds } },
    select: { studentId: true },
  });
  return new Set(rows.map((r) => r.studentId));
}
