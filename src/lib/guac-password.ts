/**
 * Derive the Guacamole password for a student.
 *
 * Format: firstname + studentId  (e.g. "Samir" + "20210042" → "Samir20210042")
 * - Simple and deterministic — no secrets needed, no DB storage.
 * - The student account in Guacamole is identified by firstname_lastname,
 *   and the password is always firstname + studentId.
 */
export function deriveGuacPassword(firstName: string, studentId: string): string {
  return `${firstName}${studentId}`;
}
