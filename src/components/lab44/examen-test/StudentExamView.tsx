'use client';
import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { useLab44Store } from '@/store/lab44';
import type { Exam, ExamAttempt } from '@/types';
import { fadeSlide, BreadcrumbNav, EmptyState, timeAgo } from '@/lib/helpers';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ClipboardCheck, Clock, Play, Trophy, CheckCircle2, XCircle, Eye, AlertTriangle } from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────────────────

interface StudentExam extends Exam {
  questionCount: number;
  attemptCount: number;
  attemptsLeft: number;
  attemptsRemaining: number;
  publishedAt: string | null;
  attempts: { id: number; attemptNumber: number; score: number | null; totalPoints: number | null; maxPoints: number | null; passed: boolean | null; timeSpent: number | null; submittedAt: string | null }[];
  lastAttempt: {
    id: number;
    score: number | null;
    totalPoints: number | null;
    maxPoints: number | null;
    passed: boolean | null;
    timeSpent: number | null;
    submittedAt: string | null;
  } | null;
}

interface GradedAnswer {
  questionId: number;
  answer: string | null;
  pointsEarned: number;
  correctAnswer: string | null;
  isCorrect: boolean;
  questionText: string;
  questionType: string;
  questionOptions: string | null;
  questionPoints: number;
}

// ─── Status Badge ───────────────────────────────────────────────────────────────

function ExamStatusBadge({ status }: { status: string }) {
  if (status === 'published') {
    return (
      <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800">
        Available
      </Badge>
    );
  }
  if (status === 'active') {
    return (
      <Badge className="bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800">
        In Progress
      </Badge>
    );
  }
  return <Badge variant="secondary">{status}</Badge>;
}

function PassFailBadge({ passed }: { passed: boolean | null }) {
  if (passed === null) return <Badge variant="secondary">N/A</Badge>;
  if (passed) {
    return (
      <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800">
        <CheckCircle2 className="h-3 w-3 mr-1" /> Passed
      </Badge>
    );
  }
  return (
    <Badge className="bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800">
      <XCircle className="h-3 w-3 mr-1" /> Failed
    </Badge>
  );
}

// ─── Format time spent ──────────────────────────────────────────────────────────

function formatTimeSpent(seconds: number | null): string {
  if (!seconds) return '—';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

function formatRemainingTime(publishedAt: string | null, durationMinutes: number): { text: string; expired: boolean; minutes: number } {
  if (!publishedAt) return { text: `${durationMinutes} min`, expired: false, minutes: durationMinutes };
  const publishTime = new Date(publishedAt).getTime();
  const totalSeconds = durationMinutes * 60;
  const elapsed = Math.floor((Date.now() - publishTime) / 1000);
  const remaining = Math.max(0, totalSeconds - elapsed);
  const expired = remaining <= 0;
  const m = Math.floor(remaining / 60);
  const s = remaining % 60;
  return { text: expired ? 'Expired' : `${m}m ${s}s left`, expired, minutes: m };
}

// ─── Results Dialog ─────────────────────────────────────────────────────────────

function ExamResultsView({ attempt, examTitle, labName, onClose }: {
  attempt: {
    id: number;
    score: number | null;
    totalPoints: number | null;
    maxPoints: number | null;
    passed: boolean | null;
    timeSpent: number | null;
  };
  examTitle: string;
  labName?: string;
  onClose: () => void;
}) {
  const [gradedAnswers, setGradedAnswers] = useState<GradedAnswer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchResults = async () => {
      try {
        // Fetch the attempt with answers
        const res = await fetch(`/api/exams/student?attemptId=${attempt.id}`);
        if (res.ok) {
          const data = await res.json();
          if (data.gradedAnswers) {
            setGradedAnswers(data.gradedAnswers);
          }
        }
      } catch {
        // Silently handle
      }
      setLoading(false);
    };
    fetchResults();
  }, [attempt.id]);

  const scorePercent = attempt.score ?? 0;
  const scoreColor = attempt.passed ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400';

  return (
    <motion.div {...fadeSlide} className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">{examTitle} — Results</h2>
          {labName && <p className="text-sm text-muted-foreground">{labName}</p>}
        </div>
        <Button variant="outline" size="sm" onClick={onClose}>
          Back to Exams
        </Button>
      </div>

      {/* Score Summary */}
      <Card className="shadow-sm">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <div className="text-center">
              <div className={`text-4xl font-bold ${scoreColor}`}>
                {scorePercent.toFixed(1)}/20
              </div>
              <div className="text-sm text-muted-foreground mt-1">Score</div>
            </div>
            <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-lg font-semibold">
                  {attempt.totalPoints?.toFixed(1) ?? '—'} / {attempt.maxPoints?.toFixed(1) ?? '—'}
                </div>
                <div className="text-xs text-muted-foreground">Points</div>
              </div>
              <div>
                <PassFailBadge passed={attempt.passed} />
                <div className="text-xs text-muted-foreground mt-1">Result</div>
              </div>
              <div>
                <div className="text-lg font-semibold">{formatTimeSpent(attempt.timeSpent)}</div>
                <div className="text-xs text-muted-foreground">Time Spent</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Question Breakdown */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      ) : gradedAnswers.length > 0 ? (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Question Breakdown</h3>
          {gradedAnswers.map((ga, idx) => {
            const options = ga.questionOptions ? JSON.parse(ga.questionOptions) : null;
            return (
              <Card key={ga.questionId} className={`shadow-sm border-l-4 ${ga.isCorrect ? 'border-l-emerald-500' : 'border-l-red-500'}`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-mono text-muted-foreground">Q{idx + 1}</span>
                        <Badge variant="outline" className="text-[10px] capitalize">
                          {ga.questionType.replace('_', ' ')}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {ga.pointsEarned.toFixed(1)}/{ga.questionPoints.toFixed(1)} pts
                        </span>
                      </div>
                      <p className="text-sm font-medium mb-2">{ga.questionText}</p>

                      {/* Show options for MCQ */}
                      {ga.questionType === 'mcq' && options && (
                        <div className="space-y-1 mb-2">
                          {options.map((opt: string, oi: number) => {
                            const isCorrectOption = String(oi) === ga.correctAnswer;
                            const isStudentChoice = String(oi) === ga.answer;
                            return (
                              <div
                                key={oi}
                                className={`text-xs px-2 py-1 rounded ${
                                  isCorrectOption
                                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                                    : isStudentChoice && !isCorrectOption
                                      ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                      : 'bg-muted/50 text-muted-foreground'
                                }`}
                              >
                                {String.fromCharCode(65 + oi)}) {opt}
                                {isCorrectOption && ' ✓'}
                                {isStudentChoice && !isCorrectOption && ' ✗ Your answer'}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Show for true/false */}
                      {ga.questionType === 'true_false' && (
                        <div className="flex gap-2 mb-2 text-xs">
                          <span className={`px-2 py-1 rounded ${ga.correctAnswer === 'true' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-muted/50'}`}>
                            True {ga.correctAnswer === 'true' && '✓'}
                          </span>
                          <span className={`px-2 py-1 rounded ${ga.correctAnswer === 'false' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-muted/50'}`}>
                            False {ga.correctAnswer === 'false' && '✓'}
                          </span>
                        </div>
                      )}

                      {/* Show for short answer */}
                      {ga.questionType === 'short_answer' && ga.correctAnswer && (
                        <div className="text-xs mb-2">
                          <span className="text-muted-foreground">Correct answer: </span>
                          <span className="font-medium text-emerald-600 dark:text-emerald-400">{ga.correctAnswer}</span>
                        </div>
                      )}

                      {ga.answer && ga.questionType !== 'mcq' && (
                        <div className="text-xs">
                          <span className="text-muted-foreground">Your answer: </span>
                          <span className={ga.isCorrect ? 'text-emerald-600 dark:text-emerald-400 font-medium' : 'text-red-600 dark:text-red-400 font-medium'}>
                            {ga.questionType === 'true_false' ? (ga.answer === 'true' ? 'True' : 'False') : ga.answer}
                          </span>
                        </div>
                      )}

                      {!ga.answer && (
                        <div className="text-xs text-amber-600 dark:text-amber-400">
                          <AlertTriangle className="h-3 w-3 inline mr-1" /> Not answered
                        </div>
                      )}
                    </div>
                    <div className="shrink-0">
                      {ga.isCorrect ? (
                        <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                      ) : (
                        <XCircle className="h-5 w-5 text-red-500" />
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="shadow-sm border-dashed">
          <CardContent className="py-8 text-center">
            <p className="text-sm text-muted-foreground">Detailed results are not available for this attempt.</p>
            <p className="text-xs text-muted-foreground mt-1">
              Score: {scorePercent.toFixed(1)}/20 | Points: {attempt.totalPoints?.toFixed(1) ?? '—'}/{attempt.maxPoints?.toFixed(1) ?? '—'}
            </p>
          </CardContent>
        </Card>
      )}
    </motion.div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────────

export default function StudentExamView() {
  const { auth, setView, studentLabs, labs, setStudentLabs, setLabs } = useLab44Store();
  const studentId = auth.student?.id;

  const [loading, setLoading] = useState(true);
  const [availableExams, setAvailableExams] = useState<StudentExam[]>([]);
  const [completedExams, setCompletedExams] = useState<StudentExam[]>([]);
  const [viewingResults, setViewingResults] = useState<{
    attempt: StudentExam['lastAttempt'];
    examTitle: string;
    labName?: string;
  } | null>(null);
  const [startingExam, setStartingExam] = useState<number | null>(null);

  // Compute labIds from studentLabs store (same pattern as StudentChoiceView)
  // useMemo prevents infinite loop: filter/map creates new array ref on every render
  const myLabIds = useMemo(
    () => studentId
      ? (studentLabs || []).filter(sl => sl.studentId === studentId).map(sl => sl.labId)
      : [],
    [studentId, studentLabs]
  );

  // Fetch student's labs on mount if not already loaded
  useEffect(() => {
    if (!studentId || myLabIds.length > 0) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/data');
        const data = await res.json();
        if (!cancelled) {
          if (data.studentLabs) setStudentLabs(data.studentLabs);
          if (data.labs) setLabs(data.labs);
        }
      } catch {
        // Silently handle
      }
    })();
    return () => { cancelled = true; };
  }, [studentId, myLabIds.length, setStudentLabs, setLabs]);

  useEffect(() => {
    if (!studentId || myLabIds.length === 0) return;

    let cancelled = false;

    const fetchExams = async () => {
      try {
        // Fetch exams for all of the student's labs
        const res = await fetch(`/api/exams/student?studentId=${studentId}`);
        if (res.ok && !cancelled) {
          const data = await res.json();
          const allExams: StudentExam[] = data.ok ? (data.exams || []) : [];
          // Split into available (can still attempt) and completed (has at least one submitted attempt)
          // An exam can appear in BOTH sections: available if retakes remain, completed if already attempted
          const available: StudentExam[] = [];
          const completed: StudentExam[] = [];
          for (const exam of allExams) {
            const lastAttempt = exam.attempts && exam.attempts.length > 0 ? exam.attempts[0] : null;
            const examWithLast = { ...exam, lastAttempt, attemptCount: exam.attempts?.length || 0, attemptsLeft: exam.attemptsRemaining ?? 0 };
            const hasSubmittedAttempt = exam.attempts?.some((a: { submittedAt: string | null }) => a.submittedAt != null);
            // Show in completed if student has any submitted attempt
            if (hasSubmittedAttempt) {
              completed.push(examWithLast);
            }
            // Show in available if no attempts used yet, OR still has retakes AND not closed
            if (!hasSubmittedAttempt || (examWithLast.attemptsLeft > 0 && exam.status !== 'closed')) {
              available.push(examWithLast);
            }
          }
          setAvailableExams(available);
          setCompletedExams(completed);
        } else if (!res.ok) {
          toast.error('Failed to load exams');
        }
      } catch {
        if (!cancelled) toast.error('Connection error');
      }
      if (!cancelled) setLoading(false);
    };

    fetchExams();
    return () => { cancelled = true; };
  }, [studentId, myLabIds]);

  // Handle no student/lab case
  useEffect(() => {
    if (!studentId || myLabIds.length === 0) {
      // Wait a bit for the data fetch to complete before showing empty state
      const timer = setTimeout(() => setLoading(false), 1500);
      return () => clearTimeout(timer);
    }
  }, [studentId, myLabIds.length]);

  const handleStartExam = async (examId: number) => {
    setStartingExam(examId);
    try {
      // Store the exam ID in localStorage
      localStorage.setItem('lab44-active-exam', String(examId));
      setView('student-exam-taking');
    } catch {
      toast.error('Failed to start exam');
    }
    setStartingExam(null);
  };

  const handleViewResults = (exam: StudentExam) => {
    if (!exam.lastAttempt) return;
    setViewingResults({
      attempt: exam.lastAttempt,
      examTitle: exam.title,
      labName: exam.labId ? labs.find(l => l.id === exam.labId)?.name : undefined,
    });
  };

  // ─── Results View ──────────────────────────────────────────────────────────
  if (viewingResults) {
    return (
      <div className="mx-auto max-w-3xl px-4 sm:px-6 py-6">
        <BreadcrumbNav items={[
          { label: 'Home', view: 'student-choice' },
          { label: 'Exams', view: 'student-exams' },
          { label: 'Results' },
        ]} />
        <ExamResultsView
          attempt={viewingResults.attempt!}
          examTitle={viewingResults.examTitle}
          labName={viewingResults.labName}
          onClose={() => setViewingResults(null)}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 py-6">
      <BreadcrumbNav items={[
        { label: 'Home', view: 'student-choice' },
        { label: 'Exams' },
      ]} />

      {/* Header */}
      <motion.div {...fadeSlide} className="mb-6">
        <div className="flex items-center gap-3">

          <div>
            <h3 className="text-primary font-semibold">Exams</h3>
            <p className="text-sm text-muted-foreground">View available exams and your results</p>
          </div>
        </div>
      </motion.div>

      {loading ? (
        <div className="space-y-6">
          {/* Available exams skeleton */}
          <div>
            <Skeleton className="h-5 w-40 mb-3" />
            <div className="grid gap-4 sm:grid-cols-2">
              {[1, 2].map((i) => (
                <Skeleton key={i} className="h-40 rounded-xl" />
              ))}
            </div>
          </div>
          {/* Completed exams skeleton */}
          <div>
            <Skeleton className="h-5 w-40 mb-3" />
            <div className="grid gap-4 sm:grid-cols-2">
              {[1, 2].map((i) => (
                <Skeleton key={i} className="h-32 rounded-xl" />
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-8">
          {/* ─── Available Exams ─────────────────────────────────────────────── */}
          <motion.div {...fadeSlide} transition={{ delay: 0.05 }}>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
              <Play className="h-3.5 w-3.5" /> Available Exams
            </h2>

            {availableExams.length === 0 ? (
              <EmptyState
                icon={ClipboardCheck}
                title="No available exams"
                description="There are no exams available for you right now. Check back later or contact your instructor."
              />
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {availableExams.map((exam) => (
                  <motion.div
                    key={exam.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.05 }}
                  >
                    <Card className="shadow-sm hover:shadow-md transition-shadow h-full flex flex-col">
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between gap-2">
                          <CardTitle className="text-base leading-tight">{exam.title}</CardTitle>
                          <ExamStatusBadge status={exam.status} />
                        </div>
                        {exam.description && (
                          <CardDescription className="text-xs line-clamp-2">{exam.description}</CardDescription>
                        )}
                      </CardHeader>
                      <CardContent className="flex-1 flex flex-col justify-between pt-0">
                        <div className="space-y-2 mb-4">
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" /> {exam.durationMinutes} min
                            </span>
                            <span className="flex items-center gap-1">
                              <ClipboardCheck className="h-3 w-3" /> {exam.questionCount} question{exam.questionCount !== 1 ? 's' : ''}
                            </span>
                          </div>
                          {exam.publishedAt && (() => {
                            const rt = formatRemainingTime(exam.publishedAt, exam.durationMinutes);
                            return (
                              <div className={`text-xs font-medium flex items-center gap-1 ${rt.expired ? 'text-red-600 dark:text-red-400' : rt.minutes <= 5 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                                <Clock className="h-3 w-3" /> {rt.text}
                              </div>
                            );
                          })()}
                          <div className="text-xs text-muted-foreground">
                              Passing score: 10/20
                            </div>
                          {exam.attemptCount > 0 && (
                            <div className="flex items-center gap-2 text-xs">
                              <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1">
                                <AlertTriangle className="h-3 w-3" /> Already attempted ({exam.attemptCount})
                              </span>
                            </div>
                          )}
                          {exam.maxAttempts > 1 && (
                            <div className="text-xs text-muted-foreground">
                              {exam.attemptsLeft} attempt{exam.attemptsLeft !== 1 ? 's' : ''} remaining of {exam.maxAttempts}
                            </div>
                          )}
                        </div>
                        <Button
                          className="w-full"
                          size="sm"
                          onClick={() => handleStartExam(exam.id)}
                          disabled={startingExam === exam.id}
                        >
                          {startingExam === exam.id ? (
                            <span className="flex items-center gap-2">
                              <span className="h-3 w-3 rounded-full border-2 border-current border-t-transparent animate-spin" />
                              Starting...
                            </span>
                          ) : (
                            <>
                              <Play className="h-4 w-4 mr-1" />
                              {exam.attemptCount > 0 ? 'Retake Exam' : 'Start Exam'}
                            </>
                          )}
                        </Button>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>

          {/* ─── Completed Exams ─────────────────────────────────────────────── */}
          <motion.div {...fadeSlide} transition={{ delay: 0.1 }}>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
              <Trophy className="h-3.5 w-3.5" /> Completed Exams
            </h2>

            {completedExams.length === 0 ? (
              <EmptyState
                icon={Trophy}
                title="No completed exams"
                description="You haven't taken any exams yet. Available exams will appear above."
              />
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {completedExams.map((exam) => {
                  const lastAttempt = exam.lastAttempt;
                  const scorePercent = lastAttempt?.score ?? 0;
                  const scoreColor = lastAttempt?.passed
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-red-600 dark:text-red-400';

                  return (
                    <motion.div
                      key={`completed-${exam.id}`}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 }}
                    >
                      <Card className="shadow-sm h-full flex flex-col">
                        <CardHeader className="pb-2">
                          <div className="flex items-start justify-between gap-2">
                            <CardTitle className="text-base leading-tight">{exam.title}</CardTitle>
                            {exam.labId && labs.find(l => l.id === exam.labId) && (
                              <span className="text-[10px] text-muted-foreground">{labs.find(l => l.id === exam.labId)?.name}</span>
                            )}
                            {lastAttempt && <PassFailBadge passed={lastAttempt.passed} />}
                          </div>
                        </CardHeader>
                        <CardContent className="flex-1 flex flex-col justify-between pt-0">
                          {lastAttempt ? (
                            <div className="space-y-2 mb-4">
                              <div className="flex items-center gap-4">
                                <span className={`text-2xl font-bold ${scoreColor}`}>
                                  {scorePercent.toFixed(1)}/20
                                </span>
                                <div className="text-xs text-muted-foreground space-y-0.5">
                                  <div>{lastAttempt.totalPoints?.toFixed(1) ?? '—'} / {lastAttempt.maxPoints?.toFixed(1) ?? '—'} points</div>
                                  <div className="flex items-center gap-1">
                                    <Clock className="h-3 w-3" /> {formatTimeSpent(lastAttempt.timeSpent)}
                                  </div>
                                </div>
                              </div>
                              {exam.attemptsLeft > 0 && exam.status !== 'closed' && (
                                <div className="text-xs text-amber-600 dark:text-amber-400">
                                  {exam.attemptsLeft} attempt{exam.attemptsLeft !== 1 ? 's' : ''} remaining
                                </div>
                              )}
                            </div>
                          ) : (
                            <p className="text-xs text-muted-foreground mb-4">No results available</p>
                          )}
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex-1"
                              onClick={() => handleViewResults(exam)}
                              disabled={!lastAttempt}
                            >
                              <Eye className="h-3.5 w-3.5 mr-1" /> View Results
                            </Button>
                            {exam.attemptsLeft > 0 && exam.status !== 'closed' && (
                              <Button
                                size="sm"
                                className="flex-1"
                                onClick={() => handleStartExam(exam.id)}
                                disabled={startingExam === exam.id}
                              >
                                <Play className="h-3.5 w-3.5 mr-1" /> Retake
                              </Button>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </div>
  );
}
