'use client';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { useLab44Store } from '@/store/lab44';
import type { Exam, ExamQuestion } from '@/types';
import { CircularProgress } from '@/lib/helpers';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Clock, ChevronLeft, ChevronRight, Send, AlertTriangle, CheckCircle2, XCircle, Minus, Eye, EyeOff, ClipboardCheck } from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────────────────

interface ExamQuestionClient extends Omit<ExamQuestion, 'options'> {
  options: string[] | null;
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

interface SubmissionResult {
  attemptId: number;
  // These are null when the exam's showResults is "manual" — the server withholds
  // the score, totals and breakdown until the instructor releases them.
  score: number | null;
  totalPoints: number | null;
  maxPoints: number | null;
  passed: boolean | null;
  timeSpent: number | null;
  gradedAnswers: GradedAnswer[];
}

type Phase = 'loading' | 'taking' | 'submitting' | 'results';

// ─── Timer Hook ─────────────────────────────────────────────────────────────────

function formatTimer(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// ─── Main Component ─────────────────────────────────────────────────────────────

export default function StudentExamTakingView() {
  const { setView } = useLab44Store();

  // Phase state
  const [phase, setPhase] = useState<Phase>('loading');
  const [exam, setExam] = useState<Exam | null>(null);
  const [questions, setQuestions] = useState<ExamQuestionClient[]>([]);

  // Answer state: questionId -> answer string
  const [answers, setAnswers] = useState<Record<number, string>>({});

  // Current question index
  const [currentQ, setCurrentQ] = useState(0);

  // Timer
  const [timeLeft, setTimeLeft] = useState(0);
  const startTimeRef = useRef<number>(Date.now());
  const autoSubmitted = useRef(false);

  // Submit confirmation dialog
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);

  // Submission result
  const [result, setResult] = useState<SubmissionResult | null>(null);

  // Anti-cheat: tab visibility
  const [tabSwitches, setTabSwitches] = useState(0);
  const [showTabWarning, setShowTabWarning] = useState(false);

  // Auto-save ref
  const autoSaveRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Submit ref to avoid stale closures
  const submittedRef = useRef(false);

  // ─── Load exam data ──────────────────────────────────────────────────────
  useEffect(() => {
    const examId = localStorage.getItem('lab44-active-exam');
    if (!examId) {
      toast.error('No exam selected');
      setView('student-exams');
      return;
    }

    const loadExam = async () => {
      try {
        const res = await fetch(`/api/exams/${examId}`);
        if (!res.ok) {
          toast.error('Failed to load exam');
          setView('student-exams');
          return;
        }
        const data = await res.json();
        if (!data.ok) {
          toast.error(data.error || 'Failed to load exam');
          setView('student-exams');
          return;
        }
        const examData = data.exam;
        setExam(examData);
        setQuestions((examData.questions || []).map((q: ExamQuestion & { options?: string | string[] | null }) => ({
          ...q,
          options: Array.isArray(q.options) ? q.options : (typeof q.options === 'string' ? JSON.parse(q.options) : null),
        })));

        // Restore saved answers from localStorage
        const savedKey = `lab44-exam-answers-${examId}`;
        try {
          const saved = localStorage.getItem(savedKey);
          if (saved) {
            setAnswers(JSON.parse(saved));
          }
        } catch { /* ignore */ }

        // Calculate remaining time based on publishedAt (timer starts when instructor publishes)
        let timeLeftSeconds = examData.durationMinutes * 60;
        if (examData.publishedAt) {
          const publishTime = new Date(examData.publishedAt).getTime();
          const elapsed = Math.floor((Date.now() - publishTime) / 1000);
          timeLeftSeconds = Math.max(0, examData.durationMinutes * 60 - elapsed);
        }
        setTimeLeft(timeLeftSeconds);
        startTimeRef.current = Date.now();
        setPhase('taking');
      } catch {
        toast.error('Connection error');
        setView('student-exams');
      }
    };

    loadExam();
  }, [setView]);

  // ─── Timer ────────────────────────────────────────────────────────────────
  const handleSubmit = useCallback(() => {
    if (submittedRef.current) return;
    submittedRef.current = true;

    const timeSpent = Math.round((Date.now() - startTimeRef.current) / 1000);
    const examId = localStorage.getItem('lab44-active-exam');
    const studentId = useLab44Store.getState().auth.student?.id;

    if (!examId || !studentId) {
      toast.error('Missing exam or student information');
      setView('student-exams');
      return;
    }

    setPhase('submitting');

    const answerArray = questions.map((q) => ({
      questionId: q.id,
      answer: answers[q.id] || '',
    }));

    fetch(`/api/exams/${examId}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        studentId,
        answers: answerArray,
        timeSpent,
      }),
    })
      .then((res) => {
        if (!res.ok) return res.json().then((d) => { throw new Error(d.error || 'Submit failed'); });
        return res.json();
      })
      .then((data) => {
        if (!data.ok) throw new Error(data.error || 'Submit failed');
        const attempt = data.attempt;
        // Build graded answers from the attempt's answers
        const gradedAnswers: GradedAnswer[] = (attempt.answers || []).map((a: { questionId: number; answer: string | null; pointsEarned: number; question: { type: string; text: string; points: number; correctAnswer: string | null; options?: string | null } }) => {
          // Find the matching question from the exam to get options
          const examQuestion = questions.find(q => q.id === a.questionId);
          return {
            questionId: a.questionId,
            answer: a.answer,
            pointsEarned: a.pointsEarned ?? 0,
            correctAnswer: a.question?.correctAnswer ?? null,
            isCorrect: (a.pointsEarned ?? 0) > 0,
            questionText: a.question?.text || '',
            questionType: a.question?.type || '',
            questionOptions: examQuestion?.options ? JSON.stringify(examQuestion.options) : (a.question?.options || null),
            questionPoints: a.question?.points ?? 1,
          };
        });
        setResult({
          attemptId: attempt.id,
          score: attempt.score,
          totalPoints: attempt.totalPoints,
          maxPoints: attempt.maxPoints,
          passed: attempt.passed,
          timeSpent: attempt.timeSpent,
          gradedAnswers,
        });
        setPhase('results');
        // Clean up localStorage
        localStorage.removeItem('lab44-exam-answers-' + examId);
        localStorage.removeItem('lab44-active-exam');
        toast.success('Exam submitted successfully!');
      })
      .catch((err) => {
        toast.error(err.message || 'Failed to submit exam');
        submittedRef.current = false;
        setPhase('taking');
      });
  }, [answers, questions, setView]);

  useEffect(() => {
    if (phase !== 'taking') return;
    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          autoSubmitted.current = true;
          handleSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [phase, handleSubmit]);

  // ─── Auto-save ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'taking' || !exam) return;

    autoSaveRef.current = setInterval(() => {
      const key = `lab44-exam-answers-${exam.id}`;
      try {
        localStorage.setItem(key, JSON.stringify(answers));
      } catch { /* ignore */ }
    }, 30000);

    return () => {
      if (autoSaveRef.current) clearInterval(autoSaveRef.current);
    };
  }, [phase, exam, answers]);

  // ─── Anti-cheat: Tab visibility ───────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'taking') return;

    const handleVisibility = () => {
      if (document.hidden) {
        setTabSwitches((prev) => {
          const next = prev + 1;
          if (next >= 3) {
            toast.error('Multiple tab switches detected. This may be reported to your instructor.');
          } else {
            toast.warning(`Tab switch detected (${next}/3). Please stay on this page.`);
          }
          setShowTabWarning(true);
          setTimeout(() => setShowTabWarning(false), 3000);
          return next;
        });
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [phase]);

  // ─── Answer handling ─────────────────────────────────────────────────────
  const setAnswer = (questionId: number, answer: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: answer }));
    // Also save to localStorage immediately
    if (exam) {
      try {
        const key = `lab44-exam-answers-${exam.id}`;
        const updated = { ...answers, [questionId]: answer };
        localStorage.setItem(key, JSON.stringify(updated));
      } catch { /* ignore */ }
    }
  };

  // ─── Navigation ──────────────────────────────────────────────────────────
  const goNext = () => setCurrentQ((prev) => Math.min(prev + 1, questions.length - 1));
  const goPrev = () => setCurrentQ((prev) => Math.max(prev - 1, 0));

  // ─── Computed ─────────────────────────────────────────────────────────────
  const answeredCount = questions.filter((q) => answers[q.id] !== undefined && answers[q.id] !== '').length;
  const unansweredCount = questions.length - answeredCount;
  const examExpired = exam?.publishedAt ? (Date.now() - new Date(exam.publishedAt).getTime()) / 1000 > exam.durationMinutes * 60 : false;
  const timerColor = timeLeft <= 60 ? 'text-red-600 dark:text-red-400' : timeLeft <= 300 ? 'text-amber-600 dark:text-amber-400' : 'text-foreground';
  const timerBg = timeLeft <= 60 ? 'bg-red-50 dark:bg-red-950/30' : timeLeft <= 300 ? 'bg-amber-50 dark:bg-amber-950/30' : 'bg-muted/50';

  // Auto-redirect after time-expired auto-submit (5s to see results)
  useEffect(() => {
    if (phase === 'results' && autoSubmitted.current) {
      const t = setTimeout(() => setView('student-exams'), 5000);
      return () => clearTimeout(t);
    }
  }, [phase, setView]);

  // ─── Loading Phase ────────────────────────────────────────────────────────
  if (phase === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-[80vh]">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 rounded-full border-4 border-muted border-t-primary animate-spin" />
          <p className="text-sm text-muted-foreground">Loading exam...</p>
        </div>
      </div>
    );
  }

  // ─── Submitting Phase ─────────────────────────────────────────────────────
  if (phase === 'submitting') {
    return (
      <div className="flex items-center justify-center min-h-[80vh]">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 rounded-full border-4 border-muted border-t-primary animate-spin" />
          <p className="text-sm text-muted-foreground">Submitting your exam...</p>
          <p className="text-xs text-muted-foreground">Please do not close this page</p>
        </div>
      </div>
    );
  }

  // ─── Results Phase ────────────────────────────────────────────────────────
  if (phase === 'results' && result) {
    const hasScore = typeof result.score === 'number';
    const scorePercent = hasScore ? (result.score as number) : 0;
    const scoreColor = result.passed ? '#10b981' : '#ef4444';
    const scoreTextColor = result.passed ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400';
    const timeSpent = result.timeSpent || Math.round((Date.now() - startTimeRef.current) / 1000);

    return (
      <div className="mx-auto max-w-3xl px-4 sm:px-6 py-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="space-y-6"
        >
          {/* Score Card */}
          <Card className="shadow-md">
            <CardContent className="p-6 sm:p-8">
              <div className="flex flex-col items-center text-center">
                <h2 className="text-xl font-bold mb-6">{exam?.title || 'Exam'} — Results</h2>

                {hasScore ? (
                  <>
                    {/* Circular Progress */}
                    <div className="relative mb-4">
                      <CircularProgress value={scorePercent} size={120} strokeWidth={8} color={scoreColor} />
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className={`text-2xl font-bold ${scoreTextColor}`}>
                          {scorePercent.toFixed(1)}/20
                        </span>
                      </div>
                    </div>

                    {/* Pass/Fail Badge */}
                    {result.passed !== null && (
                      <Badge className={`text-sm px-4 py-1 mt-2 ${
                        result.passed
                          ? 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800'
                          : 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800'
                      }`}>
                        {result.passed ? (
                          <><CheckCircle2 className="h-4 w-4 mr-1" /> Passed</>
                        ) : (
                          <><XCircle className="h-4 w-4 mr-1" /> Failed</>
                        )}
                      </Badge>
                    )}
                  </>
                ) : (
                  <div className="rounded-lg bg-muted/50 px-4 py-3 mt-2">
                    <p className="text-sm font-medium">Your answers were submitted.</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Your instructor will release the results.
                    </p>
                  </div>
                )}

                {/* Stats */}
                <div className="flex items-center gap-8 mt-6 text-center">
                  {hasScore && (
                    <div>
                      <div className="text-lg font-semibold">
                        {(result.totalPoints ?? 0).toFixed(1)} / {(result.maxPoints ?? 0).toFixed(1)}
                      </div>
                      <div className="text-xs text-muted-foreground">Points</div>
                    </div>
                  )}
                  <div>
                    <div className="text-lg font-semibold">
                      {Math.floor(timeSpent / 60)}m {timeSpent % 60}s
                    </div>
                    <div className="text-xs text-muted-foreground">Time Spent</div>
                  </div>
                  <div>
                    <div className="text-lg font-semibold">{questions.length}</div>
                    <div className="text-xs text-muted-foreground">Questions</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Question Breakdown */}
          <div className="space-y-3">
            {result.gradedAnswers.length > 0 && (
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                Question Breakdown
              </h3>
            )}
            {result.gradedAnswers.map((ga, idx) => {
              const options = ga.questionOptions ? JSON.parse(ga.questionOptions) : null;
              return (
                <Card
                  key={ga.questionId}
                  className={`shadow-sm border-l-4 ${
                    ga.isCorrect
                      ? 'border-l-emerald-500'
                      : ga.answer
                        ? 'border-l-red-500'
                        : 'border-l-amber-500'
                  }`}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="text-xs font-mono text-muted-foreground">Q{idx + 1}</span>
                          <Badge variant="outline" className="text-[10px] capitalize">
                            {ga.questionType.replace('_', ' ')}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {ga.pointsEarned.toFixed(1)}/{ga.questionPoints.toFixed(1)} pts
                          </span>
                        </div>
                        <p className="text-sm font-medium mb-2">{ga.questionText}</p>

                        {/* MCQ Options */}
                        {ga.questionType === 'mcq' && options && (
                          <div className="space-y-1 mb-2">
                            {options.map((opt: string, oi: number) => {
                              const isCorrectOption = String(oi) === ga.correctAnswer;
                              const isStudentChoice = String(oi) === ga.answer;
                              return (
                                <div
                                  key={oi}
                                  className={`text-xs px-2.5 py-1.5 rounded ${
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

                        {/* True/False */}
                        {ga.questionType === 'true_false' && (
                          <div className="flex gap-2 mb-2 text-xs">
                            <span className={`px-2.5 py-1.5 rounded ${ga.correctAnswer === 'true' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : ga.answer === 'true' && ga.correctAnswer !== 'true' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : 'bg-muted/50'}`}>
                              True {ga.correctAnswer === 'true' && '✓'} {ga.answer === 'true' && ga.correctAnswer !== 'true' && '✗ Your answer'}
                            </span>
                            <span className={`px-2.5 py-1.5 rounded ${ga.correctAnswer === 'false' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : ga.answer === 'false' && ga.correctAnswer !== 'false' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : 'bg-muted/50'}`}>
                              False {ga.correctAnswer === 'false' && '✓'} {ga.answer === 'false' && ga.correctAnswer !== 'false' && '✗ Your answer'}
                            </span>
                          </div>
                        )}

                        {/* Short Answer */}
                        {ga.questionType === 'short_answer' && (
                          <div className="space-y-1 mb-2 text-xs">
                            <div>
                              <span className="text-muted-foreground">Your answer: </span>
                              <span className={ga.isCorrect ? 'text-emerald-600 dark:text-emerald-400 font-medium' : 'text-red-600 dark:text-red-400 font-medium'}>
                                {ga.answer || '(none)'}
                              </span>
                            </div>
                            {ga.correctAnswer && (
                              <div>
                                <span className="text-muted-foreground">Correct answer: </span>
                                <span className="text-emerald-600 dark:text-emerald-400 font-medium">{ga.correctAnswer}</span>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Generic answer display for other types */}
                        {ga.questionType !== 'short_answer' && ga.questionType !== 'mcq' && ga.questionType !== 'true_false' && (
                          <div className="text-xs mb-2">
                            <span className="text-muted-foreground">Your answer: </span>
                            <span className="font-medium">{ga.answer || '(none)'}</span>
                            {ga.correctAnswer && (
                              <>
                                {' | '}
                                <span className="text-muted-foreground">Correct: </span>
                                <span className="text-emerald-600 dark:text-emerald-400 font-medium">{ga.correctAnswer}</span>
                              </>
                            )}
                          </div>
                        )}

                        {!ga.answer && (
                          <div className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3" /> Not answered
                          </div>
                        )}
                      </div>
                      <div className="shrink-0 mt-0.5">
                        {ga.isCorrect ? (
                          <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                        ) : ga.answer ? (
                          <XCircle className="h-5 w-5 text-red-500" />
                        ) : (
                          <Minus className="h-5 w-5 text-amber-500" />
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Back Button */}
          <div className="flex justify-center pt-4 pb-8">
            <Button onClick={() => setView('student-exams')} size="lg">
              <ChevronLeft className="h-4 w-4 mr-1" /> Back to Exams
            </Button>
          </div>
        </motion.div>
      </div>
    );
  }

  // ─── Taking Phase ─────────────────────────────────────────────────────────
  if (!exam || questions.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[80vh]">
        <div className="flex flex-col items-center gap-4">
          <AlertTriangle className="h-8 w-8 text-amber-500" />
          <p className="text-sm text-muted-foreground">No exam data found</p>
          <Button variant="outline" onClick={() => setView('student-exams')}>Go Back</Button>
        </div>
      </div>
    );
  }

  const question = questions[currentQ];

  return (
    <div className="min-h-screen flex flex-col bg-gray-50/50 dark:bg-gray-950">
      {/* ─── Top Bar ──────────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 py-2">
          <div className="flex items-center justify-between gap-3">
            {/* Exam Title */}
            <div className="flex items-center gap-2 min-w-0">
              <ClipboardCheck className="h-4 w-4 text-primary shrink-0" />
              <span className="text-sm font-semibold truncate">{exam.title}</span>
            </div>

            {/* Timer */}
            <div className={`flex items-center gap-1.5 px-3 py-1 rounded-lg ${timerBg} shrink-0`}>
              <Clock className={`h-4 w-4 ${timerColor}`} />
              <span className={`font-mono font-bold text-sm ${timerColor}`}>
                {formatTimer(timeLeft)}
              </span>
            </div>

            {/* Progress & Submit */}
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs text-muted-foreground hidden sm:inline">
                {answeredCount}/{questions.length} answered
              </span>
              <Button
                size="sm"
                onClick={() => setShowSubmitDialog(true)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                <Send className="h-3.5 w-3.5 mr-1" /> Submit
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Expired Exam Warning Banner ──────────────────────────────────── */}
      {examExpired && timeLeft === 0 && phase === 'taking' && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          className="overflow-hidden bg-red-100 dark:bg-red-950/50 text-red-700 dark:text-red-400"
        >
          <div className="mx-auto max-w-5xl px-4 sm:px-6 py-2 flex items-center gap-2 text-sm">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>The exam time has expired. Your answers will be auto-submitted.</span>
          </div>
        </motion.div>
      )}

      {/* ─── Anti-cheat Warning Banner ──────────────────────────────────────── */}
      {(showTabWarning || tabSwitches >= 3) && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          className={`overflow-hidden ${
            tabSwitches >= 3
              ? 'bg-red-100 dark:bg-red-950/50 text-red-700 dark:text-red-400'
              : 'bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400'
          }`}
        >
          <div className="mx-auto max-w-5xl px-4 sm:px-6 py-2 flex items-center gap-2 text-sm">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>
              {tabSwitches >= 3
                ? `Warning: ${tabSwitches} tab switches detected. This will be reported to your instructor.`
                : `Tab switch detected (${tabSwitches}/3). Please stay on this page.`}
            </span>
          </div>
        </motion.div>
      )}

      {/* ─── Question Navigator Bar ──────────────────────────────────────────── */}
      <div className="border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 py-2 space-y-2">
          {/* Summary row */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs">
              <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                <CheckCircle2 className="h-3.5 w-3.5" /> {answeredCount}
              </span>
              <span className="text-muted-foreground">/</span>
              <span className="flex items-center gap-1 text-muted-foreground">
                {unansweredCount} left
              </span>
            </div>
            <div className="hidden sm:flex items-center gap-3 text-[10px] text-muted-foreground">
              <div className="flex items-center gap-1">
                <div className="h-2.5 w-2.5 rounded bg-emerald-100 dark:bg-emerald-900/30 border border-emerald-300 dark:border-emerald-700" />
                <span>Answered</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="h-2.5 w-2.5 rounded bg-muted/50 border border-border" />
                <span>Unanswered</span>
              </div>
            </div>
          </div>

          {/* Question buttons row */}
          <div className="flex items-center gap-2">
            <div className="flex-1 overflow-x-auto custom-scrollbar">
              <div className="flex items-center gap-1.5 pb-0.5">
                {questions.map((q, idx) => {
                  const isAnswered = answers[q.id] !== undefined && answers[q.id] !== '';
                  const isCurrent = idx === currentQ;
                  return (
                    <button
                      key={q.id}
                      onClick={() => setCurrentQ(idx)}
                      className={`h-8 min-w-[2rem] px-1.5 rounded-md text-xs font-bold transition-all duration-200 flex items-center justify-center shrink-0 ${
                        isCurrent
                          ? 'ring-2 ring-primary bg-primary text-primary-foreground shadow-sm'
                          : isAnswered
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 hover:bg-emerald-200'
                            : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                      }`}
                      title={`Question ${idx + 1}${isAnswered ? ' (answered)' : ' (unanswered)'}`}
                    >
                      {idx + 1}
                    </button>
                  );
                })}
              </div>
            </div>
            {/* Mobile legend - compact */}
            <div className="sm:hidden flex items-center gap-1.5 shrink-0 text-[9px] text-muted-foreground">
              <div className="h-2 w-2 rounded bg-emerald-100 dark:bg-emerald-900/30 border border-emerald-300 dark:border-emerald-700" />
              <span>Done</span>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Main Content ───────────────────────────────────────────────────── */}
      <div className="flex-1 mx-auto max-w-3xl w-full px-4 sm:px-6 py-6">
        <motion.div
          key={currentQ}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.2 }}
        >
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-muted-foreground">
                    Question {currentQ + 1} of {questions.length}
                  </span>
                  <Badge variant="outline" className="text-[10px] capitalize">
                    {question.type.replace('_', ' ')}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {question.points} pt{question.points !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>
              <CardTitle className="text-lg leading-relaxed mt-2">
                {question.text}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {/* MCQ */}
              {question.type === 'mcq' && question.options && (
                <div className="space-y-2">
                  {question.options.map((option, idx) => {
                    const isSelected = answers[question.id] === String(idx);
                    return (
                      <button
                        key={idx}
                        onClick={() => setAnswer(question.id, String(idx))}
                        className={`w-full text-left px-4 py-3 rounded-lg border-2 transition-all duration-200 ${
                          isSelected
                            ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400'
                            : 'border-border hover:border-emerald-300 hover:bg-muted/50'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`flex h-7 w-7 items-center justify-center rounded-full border-2 text-xs font-bold shrink-0 ${
                            isSelected
                              ? 'border-emerald-500 bg-emerald-500 text-white'
                              : 'border-border text-muted-foreground'
                          }`}>
                            {String.fromCharCode(65 + idx)}
                          </div>
                          <span className="text-sm">{option}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* True/False */}
              {question.type === 'true_false' && (
                <div className="flex gap-3">
                  <button
                    onClick={() => setAnswer(question.id, 'true')}
                    className={`flex-1 py-4 rounded-lg border-2 font-semibold transition-all duration-200 ${
                      answers[question.id] === 'true'
                        ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400'
                        : 'border-border hover:border-emerald-300 hover:bg-muted/50'
                    }`}
                  >
                    <CheckCircle2 className="h-5 w-5 mx-auto mb-1" />
                    True
                  </button>
                  <button
                    onClick={() => setAnswer(question.id, 'false')}
                    className={`flex-1 py-4 rounded-lg border-2 font-semibold transition-all duration-200 ${
                      answers[question.id] === 'false'
                        ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400'
                        : 'border-border hover:border-emerald-300 hover:bg-muted/50'
                    }`}
                  >
                    <XCircle className="h-5 w-5 mx-auto mb-1" />
                    False
                  </button>
                </div>
              )}

              {/* Short Answer */}
              {question.type === 'short_answer' && (
                <div>
                  <Input
                    type="text"
                    placeholder="Type your answer here..."
                    value={answers[question.id] || ''}
                    onChange={(e) => setAnswer(question.id, e.target.value)}
                    className="text-sm"
                    autoFocus
                  />
                  <p className="text-xs text-muted-foreground mt-2">
                    Enter your answer in the text field above.
                  </p>
                </div>
              )}

              {/* Navigation */}
              <div className="flex items-center justify-between mt-6 pt-4 border-t border-border">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={goPrev}
                  disabled={currentQ === 0}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" /> Previous
                </Button>
                <span className="text-xs text-muted-foreground sm:hidden">
                  {currentQ + 1}/{questions.length}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={goNext}
                  disabled={currentQ === questions.length - 1}
                >
                  Next <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* ─── Submit Confirmation Dialog ──────────────────────────────────────── */}
      <AlertDialog open={showSubmitDialog} onOpenChange={setShowSubmitDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Submit Exam?</AlertDialogTitle>
            <AlertDialogDescription>
              {unansweredCount > 0 ? (
                <>
                  You have <strong className="text-amber-600 dark:text-amber-400">{unansweredCount} unanswered question{unansweredCount !== 1 ? 's' : ''}</strong>.
                  Unanswered questions will receive 0 points. This action cannot be undone.
                </>
              ) : (
                <>
                  You have answered all {questions.length} question{questions.length !== 1 ? 's' : ''}.
                  Are you sure you want to submit? This action cannot be undone.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Continue Exam</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setShowSubmitDialog(false);
                handleSubmit();
              }}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <Send className="h-4 w-4 mr-1" /> Submit Exam
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
