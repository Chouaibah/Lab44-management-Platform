import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function buildGradeMap(grades: { studentId: number; columnId: number; value: number | null }[]): Map<string, number | null> {
  const map = new Map<string, number | null>()
  for (const g of grades) {
    map.set(`${g.studentId}-${g.columnId}`, g.value)
  }
  return map
}

export function getGradeFromMap(map: Map<string, number | null>, studentId: number, columnId: number): number | null | undefined {
  return map.get(`${studentId}-${columnId}`)
}

/**
 * Convert a student's first and last name into a valid Guacamole username.
 * Example: "Samir" "Hazil" → "samir_hazil"
 */
export function toGuacUsername(firstName: string, lastName: string): string {
  const raw = `${firstName}_${lastName}`
  .toLowerCase()
  .replace(/\s+/g, '_')
  .replace(/[^a-z0-9_\-.]/g, '')
  .substring(0, 60);
  return raw || `user-${Date.now()}`;
}
