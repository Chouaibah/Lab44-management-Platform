'use client';

import React from 'react';
import { CheckCircle2, XCircle, Minus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { questionTypeBadge, formatTimeSpent } from './helpers';
import type { AttemptAnswer, ViewingAttempt } from './types';

interface ViewResponsesDialogProps {
  attempt: ViewingAttempt | null;
  onClose: () => void;
}

export function ViewResponsesDialog({ attempt, onClose }: ViewResponsesDialogProps) {
  if (!attempt) return null;

  const answers: AttemptAnswer[] = (attempt.answers ?? []) as AttemptAnswer[];
  const score = attempt.score ?? null;

  return (
    <Dialog open={!!attempt} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {attempt.student
              ? `${attempt.student.firstName} ${attempt.student.lastName}`
              : `Student #${attempt.studentId}`}
            &rsquo;s Responses
          </DialogTitle>
          <DialogDescription className="flex items-center gap-3 flex-wrap">
            {score != null && (
              <>
                <span className={`font-semibold text-sm ${
                  attempt.passed
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-red-600 dark:text-red-400'
                }`}>
                  {Math.round(score)}%
                </span>
                <Progress
                  value={score}
                  className={`h-1.5 w-28 ${attempt.passed ? '[&>div]:bg-emerald-500' : '[&>div]:bg-red-500'}`}
                />
                <Badge className={`text-[10px] ${
                  attempt.passed
                    ? 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400'
                    : 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400'
                }`}>
                  {attempt.passed ? 'Passed' : 'Failed'}
                </Badge>
              </>
            )}
            <span className="text-muted-foreground text-xs">
              Time: {formatTimeSpent(attempt.timeSpent as number | null)}
            </span>
          </DialogDescription>
        </DialogHeader>

        {answers.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">No answers recorded.</p>
        ) : (
          <div className="space-y-3 py-2">
            {answers.map((ans, i) => {
              const q = ans.question;
              const opts: string[] = (() => {
                if (!q.options) return [];
                if (Array.isArray(q.options)) return q.options;
                try { return JSON.parse(q.options); } catch { return []; }
              })();

              const isCorrect =
                q.correctAnswer != null &&
                ans.answer?.trim().toLowerCase() === q.correctAnswer.trim().toLowerCase();

              const isShortAnswer = q.type === 'short_answer';

              return (
                <div key={ans.id} className={`rounded-xl border p-3 ${
                  isCorrect
                    ? 'border-emerald-200 bg-emerald-50/50 dark:border-emerald-800 dark:bg-emerald-900/10'
                    : 'border-red-200 bg-red-50/50 dark:border-red-800 dark:bg-red-900/10'
                }`}>
                  {/* Question header */}
                  <div className="flex items-start gap-2 mb-2">
                    <span className="text-xs font-mono text-muted-foreground shrink-0 mt-0.5">{i + 1}.</span>
                    {questionTypeBadge(q.type)}
                    <p className="text-sm font-medium flex-1">{q.text}</p>
                    <div className="flex items-center gap-1 shrink-0">
                      {isCorrect
                        ? <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                        : isShortAnswer
                          ? <Minus className="h-4 w-4 text-amber-500" />
                          : <XCircle className="h-4 w-4 text-red-500" />}
                      <span className="text-xs font-mono">
                        {ans.pointsEarned ?? 0}/{q.points}
                      </span>
                    </div>
                  </div>

                  {/* MCQ options */}
                  {q.type === 'mcq' && opts.length > 0 && (
                    <div className="ml-6 space-y-1">
                      {opts.map((opt, oIdx) => {
                        const letter = String.fromCharCode(65 + oIdx);
                        const isStudentChoice = ans.answer === String(oIdx) || ans.answer === letter;
                        const isCorrectOpt = q.correctAnswer === String(oIdx) || q.correctAnswer === letter;
                        return (
                          <div key={oIdx} className={`flex items-center gap-2 rounded px-2 py-0.5 text-xs ${
                            isCorrectOpt
                              ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                              : isStudentChoice
                                ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                                : 'text-muted-foreground'
                          }`}>
                            <span className="font-mono shrink-0">{letter}.</span>
                            <span className="flex-1">{opt}</span>
                            {isCorrectOpt && <CheckCircle2 className="h-3 w-3 shrink-0" />}
                            {isStudentChoice && !isCorrectOpt && <XCircle className="h-3 w-3 shrink-0" />}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* True/False */}
                  {q.type === 'true_false' && (
                    <div className="ml-6 flex gap-2 text-xs mt-1">
                      <span className="text-muted-foreground">Answer:</span>
                      <span className={`font-medium capitalize ${
                        isCorrect ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
                      }`}>{ans.answer ?? '—'}</span>
                      {!isCorrect && (
                        <span className="text-muted-foreground">
                          (correct: <span className="text-emerald-600 dark:text-emerald-400 capitalize">{q.correctAnswer}</span>)
                        </span>
                      )}
                    </div>
                  )}

                  {/* Short answer */}
                  {isShortAnswer && (
                    <div className="ml-6 space-y-1 mt-1">
                      <div className="text-xs">
                        <span className="text-muted-foreground">Student: </span>
                        <span className="font-medium">{ans.answer || <em className="text-muted-foreground">No answer</em>}</span>
                      </div>
                      {q.correctAnswer && (
                        <div className="text-xs">
                          <span className="text-muted-foreground">Expected: </span>
                          <span className="font-medium text-emerald-600 dark:text-emerald-400">{q.correctAnswer}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
