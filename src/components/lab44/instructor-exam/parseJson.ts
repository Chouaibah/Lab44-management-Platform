import type { QuestionForm } from './types';

/** Parses a raw question object from JSON into a typed QuestionForm. Returns null if invalid. */
function parseRawQuestion(q: Record<string, unknown>, i: number): QuestionForm | { error: string } {
  if (!q.text || typeof q.text !== 'string') {
    return { error: `Question ${i + 1}: "text" is required and must be a string.` };
  }

  const type: QuestionForm['type'] =
    q.type === 'mcq' || q.type === 'true_false' || q.type === 'short_answer'
      ? q.type
      : 'mcq';

  let options: string[] = [];
  let correctAnswer = '';

  if (type === 'mcq') {
    if (Array.isArray(q.options)) {
      options = q.options.map((o: unknown) => String(o));
    } else if (Array.isArray(q.choices)) {
      options = (q.choices as unknown[]).map((o: unknown) => String(o));
    } else {
      options = ['', '', '', ''];
    }

    const raw = q.correctAnswer ?? q.answer;
    if (raw != null) {
      const ca = String(raw);
      // Accept letter (A-Z) or numeric index
      correctAnswer = /^[A-Za-z]$/.test(ca)
        ? String(ca.toUpperCase().charCodeAt(0) - 65)
        : ca;
    } else {
      correctAnswer = '0';
    }
  } else if (type === 'true_false') {
    correctAnswer = q.correctAnswer === 'false' || q.answer === 'false' ? 'false' : 'true';
  } else {
    // short_answer
    correctAnswer = q.correctAnswer
      ? String(q.correctAnswer)
      : q.answer
        ? String(q.answer)
        : '';
  }

  const points =
    typeof q.points === 'number'
      ? q.points
      : typeof q.grade === 'number'
        ? q.grade
        : 1;

  return { type, text: q.text, options, correctAnswer, points, order: i };
}

export interface ParseResult {
  questions: QuestionForm[];
  error?: string;
}

/**
 * Parses a raw JSON string into an array of QuestionForms.
 * Supports both `[{...}]` and `{ "questions": [{...}] }` formats.
 */
export function parseQuestionsJson(jsonText: string): ParseResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    return { questions: [], error: 'Invalid JSON format. Please check your input.' };
  }

  const raw = Array.isArray(parsed)
    ? parsed
    : (parsed as Record<string, unknown>)?.questions;

  if (!Array.isArray(raw)) {
    return {
      questions: [],
      error: 'JSON must be an array of questions or an object with a "questions" array.',
    };
  }

  const questions: QuestionForm[] = [];
  for (let i = 0; i < raw.length; i++) {
    const result = parseRawQuestion(raw[i] as Record<string, unknown>, i);
    if ('error' in result) return { questions: [], error: result.error };
    questions.push(result);
  }

  if (questions.length === 0) {
    return { questions: [], error: 'No valid questions found in JSON.' };
  }

  return { questions };
}
