'use client';

import React from 'react';
import { Plus, Eye, Edit2, Send, XCircle, Trash2, Clock, FileText, ClipboardCheck, CheckCircle2 } from 'lucide-react';
import type { Exam } from '@/types';
import { timeAgo, EmptyState } from '@/lib/helpers';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { examStatusBadge, formatRemainingTime } from './helpers';
import type { ConfirmAction } from './types';

// Exam type extended with API-only fields not yet in the shared type
type ExamWithMeta = Exam & { questionCount?: number; publishedAt?: string | null };

interface ExamListTabProps {
  loading: boolean;
  exams: Exam[];
  onGoCreate: () => void;
  onGoEdit: (exam: Exam) => void;
  onGoResults: (exam: Exam) => void;
  onDelete: (id: number) => void;
  onConfirmAction: (action: ConfirmAction) => void;
}

export function ExamListTab({
  loading, exams,
  onGoCreate, onGoEdit, onGoResults, onDelete, onConfirmAction,
}: ExamListTabProps) {
  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)}
      </div>
    );
  }

  if (exams.length === 0) {
    return (
      <EmptyState
        icon={ClipboardCheck}
        title="No Exams Yet"
        description="Create your first exam to assess your students."
        action={
          <Button size="sm" onClick={onGoCreate}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Create Exam
          </Button>
        }
      />
    );
  }

  return (
    <div className="max-h-[calc(100vh-24rem)] overflow-y-auto space-y-3 pr-1 custom-scrollbar">
      {exams.map((exam) => {
        const e = exam as ExamWithMeta;
        const isDraft     = e.status === 'draft';
        const isPublished = e.status === 'published';
        const isActive    = e.status === 'active';

        return (
          <Card key={e.id} className="shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-4">
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h3 className="font-semibold text-sm">{e.title}</h3>
                    {examStatusBadge(e.status)}
                    {e.sousGroupeId && (
                      <Badge variant="outline" className="text-[10px]">Group filter</Badge>
                    )}
                  </div>

                  {e.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                      {e.description}
                    </p>
                  )}

                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {e.durationMinutes}min</span>
                    <span className="flex items-center gap-1"><FileText className="h-3 w-3" /> {e.questionCount ?? e.questions?.length ?? 0} Q</span>
                    <span className="flex items-center gap-1"><ClipboardCheck className="h-3 w-3" /> {e.attemptCount ?? 0} attempts</span>
                    {e.passingScore != null && (
                      <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> Pass: {e.passingScore}%</span>
                    )}
                    <span>· {timeAgo(e.createdAt)}</span>
                  </div>

                  {e.publishedAt && (() => {
                    const rt = formatRemainingTime(e.publishedAt ?? null, e.durationMinutes);
                    return (
                      <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                        <Send className="h-3 w-3" /> Published {timeAgo(e.publishedAt)}
                        {rt.expired
                          ? <span className="text-red-600 dark:text-red-400 font-medium ml-1">(Time expired)</span>
                          : <span className="text-emerald-600 dark:text-emerald-400 font-medium ml-1">({rt.text})</span>
                        }
                      </div>
                    );
                  })()}

                  {e.averageScore != null && (
                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-[10px] text-muted-foreground">Avg Score:</span>
                      <span className={`text-xs font-bold ${
                        e.averageScore >= (e.passingScore || 50)
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-red-600 dark:text-red-400'
                      }`}>
                        {Math.round(e.averageScore)}%
                      </span>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0 flex-wrap justify-end">
                  <Button variant="ghost" size="sm" className="h-8 text-xs gap-1" onClick={() => onGoResults(exam)}>
                    <Eye className="h-3.5 w-3.5" /><span className="hidden sm:inline">Results</span>
                  </Button>

                  {isDraft && (
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onGoEdit(exam)}>
                      <Edit2 className="h-3.5 w-3.5" />
                    </Button>
                  )}

                  {isDraft && (
                    <Button
                      variant="ghost" size="sm"
                      className="h-8 text-xs gap-1 text-emerald-600 hover:text-emerald-700 dark:text-emerald-400"
                      onClick={() => onConfirmAction({ examId: e.id, action: 'publish' })}
                    >
                      <Send className="h-3.5 w-3.5" /><span className="hidden sm:inline">Publish</span>
                    </Button>
                  )}

                  {(isPublished || isActive) && (
                    <Button
                      variant="ghost" size="sm"
                      className="h-8 text-xs gap-1 text-red-600 hover:text-red-700 dark:text-red-400"
                      onClick={() => onConfirmAction({ examId: e.id, action: 'close' })}
                    >
                      <XCircle className="h-3.5 w-3.5" /><span className="hidden sm:inline">Close</span>
                    </Button>
                  )}

                  {isDraft && !((e.attemptCount ?? 0) > 0) && (
                    <Button
                      variant="ghost" size="icon"
                      className="h-8 w-8 hover:bg-red-100 dark:hover:bg-red-950/30"
                      onClick={() => onDelete(e.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-red-600" />
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
