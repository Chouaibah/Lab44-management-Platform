import type { ExamAttempt } from '@/types';

export interface QuestionForm {
  id?: number;
  type: 'mcq' | 'true_false' | 'short_answer';
  text: string;
  options: string[];
  correctAnswer: string;
  points: number;
  order: number;
}

export type TabView = 'list' | 'create' | 'edit' | 'results';

export interface ConfirmAction {
  examId: number;
  action: 'publish' | 'close';
}

export interface AttemptAnswer {
  id: number;
  questionId: number;
  answer: string | null;
  pointsEarned: number | null;
  question: {
    id: number;
    type: string;
    text: string;
    points: number;
    correctAnswer: string | null;
    options?: string | null;
  };
}

export type ViewingAttempt = ExamAttempt & { answers?: AttemptAnswer[] };

export function createEmptyQuestion(order: number): QuestionForm {
  return {
    type: 'mcq',
    text: '',
    options: ['', '', '', ''],
    correctAnswer: '0',
    points: 1,
    order,
  };
}

export const JSON_TEMPLATE = `{
  "questions": [
    {
      "type": "mcq",
      "text": "What is the capital of France?",
      "options": ["Paris", "London", "Berlin", "Madrid"],
      "correctAnswer": "A",
      "points": 2
    },
    {
      "type": "true_false",
      "text": "The Earth is flat.",
      "correctAnswer": "false",
      "points": 1
    },
    {
      "type": "short_answer",
      "text": "What is 2+2?",
      "correctAnswer": "4",
      "points": 1
    }
  ]
}

/* Alternative: Array format */
[
  { "type": "mcq", "text": "Question text", "options": ["A","B","C","D"], "correctAnswer": "A", "points": 1 },
  { "type": "true_false", "text": "Statement", "correctAnswer": "true", "points": 1 },
  { "type": "short_answer", "text": "Question?", "correctAnswer": "answer", "points": 2 }
]

/* Field Guide:
   - type: "mcq" | "true_false" | "short_answer"
   - text: (required) The question text
   - options: (mcq only) Array of choice strings
   - correctAnswer: "A","B","C"... for mcq | "true"/"false" for true_false | text for short_answer
   - points: (optional, default: 1) Point value
   - answer/grade: Aliases for correctAnswer/points
*/`;
