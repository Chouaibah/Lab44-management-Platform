'use client';

import React from 'react';
import { ArrowLeft, Eye, CheckCircle2, XCircle, Clock, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import type { Exam, ExamAttempt } from '@/types';
import { formatTimeSpent, examStatusBadge } from './helpers';
import type { ViewingAttempt } from './types';

interface ResultsTabProps {
  exam: Exam | null;
  attempts: ExamAttempt[];
  loading: boolean;
  onBack: () => void;
  onViewAttempt: (attempt: ViewingAttempt) => void;
}

export function ResultsTab({ exam, attempts, loading, onBack, onViewAttempt }: ResultsTabProps) {
  if (!exam) return null;

  const passed    = attempts.filter(a => a.passed).length;
  const failed    = attempts.filter(a => !a.passed && a.score != null).length;
  const pending   = attempts.filter(a => a.score == null).length;
  const avgScore  = attempts.length > 0
    ? Math.round(attempts.reduce((s, a) => s + (a.score ?? 0), 0) / attempts.length)
    : null;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" className="gap-1.5" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
          Back to exams
        </Button>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <h2 className="text-sm font-semibold truncate">{exam.title}</h2>
          {examStatusBadge(exam.status)}
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Attempts', value: attempts.length, color: 'text-foreground' },
          { label: 'Passed', value: passed, color: 'text-emerald-600 dark:text-emerald-400' },
          { label: 'Failed', value: failed, color: 'text-red-600 dark:text-red-400' },
          { label: 'Avg Score', value: avgScore != null ? `${avgScore}%` : '—', color: 'text-blue-600 dark:text-blue-400' },
        ].map(stat => (
          <Card key={stat.label} className="shadow-sm">
            <CardContent className="p-3">
              <p className="text-xs text-muted-foreground">{stat.label}</p>
              <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Attempt list */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
      ) : attempts.length === 0 ? (
        <Card className="shadow-sm">
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground text-sm">No attempts yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2 max-h-[calc(100vh-28rem)] overflow-y-auto pr-1 custom-scrollbar">
          {attempts.map(attempt => {
            const score = attempt.score ?? null;
            const isPassed = attempt.passed;
            const isPending = score == null;

            return (
              <Card key={attempt.id} className="shadow-sm">
                <CardContent className="p-3">
                  <div className="flex items-center gap-3">
                    {/* Icon */}
                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                      isPending    ? 'bg-muted' :
                      isPassed     ? 'bg-emerald-100 dark:bg-emerald-900/30' :
                                     'bg-red-100 dark:bg-red-900/30'
                    }`}>
                      {isPending
                        ? <Clock className="h-4 w-4 text-muted-foreground" />
                        : isPassed
                          ? <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                          : <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />}
                    </div>

                    {/* Student name + meta */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium truncate">
                          {attempt.student
                            ? `${attempt.student.firstName} ${attempt.student.lastName}`
                            : `Student #${attempt.studentId}`}
                        </span>
                        {isPending && <Badge variant="secondary" className="text-[10px]">Pending</Badge>}
                        {!isPending && (
                          <Badge className={`text-[10px] ${isPassed
                            ? 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400'
                            : 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400'}`}>
                            {isPassed ? 'Passed' : 'Failed'}
                          </Badge>
                        )}
                      </div>

                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5 flex-wrap">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" /> {formatTimeSpent(attempt.timeSpent as number | null)}
                        </span>
                        {attempt.submittedAt && (
                          <span>Submitted {new Date(attempt.submittedAt).toLocaleDateString()}</span>
                        )}
                      </div>

                      {score != null && (
                        <div className="mt-2 flex items-center gap-2">
                          <Progress
                            value={score}
                            className={`h-1.5 flex-1 ${isPassed ? '[&>div]:bg-emerald-500' : '[&>div]:bg-red-500'}`}
                          />
                          <span className={`text-xs font-bold tabular-nums ${
                            isPassed ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
                          }`}>
                            {Math.round(score)}%
                          </span>
                        </div>
                      )}
                    </div>

                    {/* View button */}
                    <Button
                      variant="ghost" size="icon"
                      className="h-8 w-8 shrink-0"
                      onClick={() => onViewAttempt(attempt as ViewingAttempt)}
                      title="View responses"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
