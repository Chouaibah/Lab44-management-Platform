import type { Grade, GradeColumn } from '@/types';

/**
 * Compute the weighted average for a student across given grades and columns.
 * Each grade is multiplied by its column's weight; the result is divided by total weight.
 * Returns null if the student has no graded entries.
 */
export function computeWeightedAverage(
  grades: Grade[],
  columns: GradeColumn[],
  studentId: number
): number | null {
  const studentGrades = grades.filter(g => g.studentId === studentId && g.value !== null);
  if (studentGrades.length === 0) return null;

  let totalWeight = 0;
  let weightedSum = 0;

  for (const grade of studentGrades) {
    const column = columns.find(c => c.id === grade.columnId);
    if (!column) continue;
    const weight = column.weight || 1.0;
    weightedSum += (grade.value || 0) * weight;
    totalWeight += weight;
  }

  return totalWeight > 0 ? weightedSum / totalWeight : null;
}

/**
 * Compute a simple (unweighted) average for a student.
 * All grades contribute equally regardless of column weight.
 * Returns null if the student has no graded entries.
 */
export function computeSimpleAverage(
  grades: Grade[],
  studentId: number
): number | null {
  const studentGrades = grades.filter(g => g.studentId === studentId && g.value !== null);
  if (studentGrades.length === 0) return null;
  const sum = studentGrades.reduce((acc, g) => acc + (g.value || 0), 0);
  return sum / studentGrades.length;
}

/**
 * Compute weighted average from an array of { value, weight } pairs.
 * Useful when you already have the grades and weights extracted.
 */
export function computeWeightedAverageFromPairs(
  pairs: Array<{ value: number; weight: number }>
): number | null {
  const validPairs = pairs.filter(p => p.value !== null && p.value !== undefined);
  if (validPairs.length === 0) return null;

  let totalWeight = 0;
  let weightedSum = 0;

  for (const pair of validPairs) {
    weightedSum += pair.value * pair.weight;
    totalWeight += pair.weight;
  }

  return totalWeight > 0 ? weightedSum / totalWeight : null;
}

/**
 * Format a grade value for display.
 * Returns '—' for null values.
 */
export function formatGrade(value: number | null): string {
  if (value === null) return '—';
  return value.toFixed(2);
}
