'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { useLab44Store } from '@/store/lab44';
import type { Exam, ExamQuestion, ExamAttempt } from '@/types';
import { fadeSlide, BreadcrumbNav, EmptyState, timeAgo } from '@/lib/helpers';
// shadcn/ui components
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
// Lucide icons
import { ClipboardCheck, Plus, Trash2, Edit2, ChevronUp, ChevronDown, Eye, Send, XCircle, CheckCircle2, Clock, FileText, GripVertical, Save, RefreshCw, Upload, Code, Copy, Check, Minus, AlertTriangle, Pencil } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface QuestionForm {
  id?: number;
  type: 'mcq' | 'true_false' | 'short_answer';
  text: string;
  options: string[];
  correctAnswer: string;
  points: number;
  order: number;
}

type TabView = 'list' | 'create' | 'edit' | 'results';

// ─── Status Badge Helper ──────────────────────────────────────────────────────

function examStatusBadge(status: string) {
  switch (status) {
    case 'draft':
      return <Badge className="bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700">Draft</Badge>;
    case 'published':
      return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800">Published</Badge>;
    case 'active':
      return <Badge className="bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800">Active</Badge>;
    case 'closed':
      return <Badge className="bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800">Closed</Badge>;
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
}

function questionTypeBadge(type: string) {
  switch (type) {
    case 'mcq':
      return <Badge className="bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-900/30 dark:text-violet-400 dark:border-violet-800 text-[10px]">MCQ</Badge>;
    case 'true_false':
      return <Badge className="bg-cyan-100 text-cyan-700 border-cyan-200 dark:bg-cyan-900/30 dark:text-cyan-400 dark:border-cyan-800 text-[10px]">True/False</Badge>;
    case 'short_answer':
      return <Badge className="bg-teal-100 text-teal-700 border-teal-200 dark:bg-teal-900/30 dark:text-teal-400 dark:border-teal-800 text-[10px]">Short Answer</Badge>;
    default:
      return <Badge variant="secondary" className="text-[10px]">{type}</Badge>;
  }
}

// ─── Default Question ─────────────────────────────────────────────────────────

function createEmptyQuestion(order: number): QuestionForm {
  return {
    type: 'mcq',
    text: '',
    options: ['', '', '', ''],
    correctAnswer: '0',
    points: 1,
    order,
  };
}

const JSON_TEMPLATE = `{
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

// ─── Format time spent (seconds → human readable) ────────────────────────────

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

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function InstructorExamView() {
  const { auth, sousGroupes, selectedLabId, labs } = useLab44Store();
  const instructor = auth.instructor;
  // Multi-lab support: effective lab ID
  const activeLabId = selectedLabId || instructor?.labId || 0;

  // ─── State ────────────────────────────────────────────────────────────────
  const [loading, setLoading] = useState(true);
  const [exams, setExams] = useState<Exam[]>([]);
  const [tab, setTab] = useState<TabView>('list');
  const [saving, setSaving] = useState(false);

  // Exam form state
  const [examTitle, setExamTitle] = useState('');
  const [examDescription, setExamDescription] = useState('');
  const [examDuration, setExamDuration] = useState('30');
  const [examMaxAttempts, setExamMaxAttempts] = useState('1');
  const [examPassingScore, setExamPassingScore] = useState('');
  const [examShuffle, setExamShuffle] = useState(false);
  const [examShowResults, setExamShowResults] = useState<'immediate' | 'manual'>('immediate');
  const [examSousGroupeId, setExamSousGroupeId] = useState<string>('');
  const [questions, setQuestions] = useState<QuestionForm[]>([createEmptyQuestion(0)]);
  const [expandedQuestion, setExpandedQuestion] = useState<number | null>(0);

  // JSON import state
  const [jsonImportOpen, setJsonImportOpen] = useState(false);
  const [jsonImportText, setJsonImportText] = useState('');
  const [jsonImportMode, setJsonImportMode] = useState<'replace' | 'append'>('append');
  const [jsonImportError, setJsonImportError] = useState('');
  const [jsonImportPreview, setJsonImportPreview] = useState<QuestionForm[]>([]);
  const [jsonShowTemplate, setJsonShowTemplate] = useState(false);
  const [jsonCopied, setJsonCopied] = useState(false);

  // Edit state
  const [editingExamId, setEditingExamId] = useState<number | null>(null);

  // Results state
  const [resultsExamId, setResultsExamId] = useState<number | null>(null);
  const [resultsExamTitle, setResultsExamTitle] = useState('');
  const [attempts, setAttempts] = useState<ExamAttempt[]>([]);
  const [attemptsLoading, setAttemptsLoading] = useState(false);

  // Delete confirmation
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Publish/close confirmation
  const [confirmAction, setConfirmAction] = useState<{ examId: number; action: 'publish' | 'close' } | null>(null);

  // View Responses state
  const [viewingAttempt, setViewingAttempt] = useState<ExamAttempt | null>(null);
  const [gradeEdits, setGradeEdits] = useState<Record<number, string>>({});
  const [savingGrades, setSavingGrades] = useState(false);

  // Lab sous-groupes
  const labSousGroupes = useMemo(() =>
    sousGroupes.filter(sg => sg.labId === activeLabId),
    [sousGroupes, activeLabId]
  );

  // ─── Data Fetching ────────────────────────────────────────────────────────

  const fetchExams = async () => {
    if (!instructor) return;
    try {
      const res = await fetch(`/api/exams?instructorId=${instructor.id}`);
      const data = await res.json();
      if (data.ok && Array.isArray(data.exams)) setExams(data.exams);
    } catch {
      toast.error('Failed to load exams');
    }
    setLoading(false);
  };

  useEffect(() => {
    if (!instructor) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/exams?instructorId=${instructor.id}`);
        const data = await res.json();
        if (!cancelled && data.ok && Array.isArray(data.exams)) setExams(data.exams);
      } catch {
        if (!cancelled) toast.error('Failed to load exams');
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [instructor]);

  // ─── Reset Form ───────────────────────────────────────────────────────────

  const resetForm = () => {
    setExamTitle('');
    setExamDescription('');
    setExamDuration('30');
    setExamMaxAttempts('1');
    setExamPassingScore('');
    setExamShuffle(false);
    setExamShowResults('immediate');
    setExamSousGroupeId('');
    setQuestions([createEmptyQuestion(0)]);
    setExpandedQuestion(0);
    setEditingExamId(null);
  };

  // ─── JSON Import Handler ────────────────────────────────────────────────────

  const handleJsonImport = () => {
    setJsonImportError('');
    setJsonImportPreview([]);
    try {
      const parsed = JSON.parse(jsonImportText);
      let importedQuestions: QuestionForm[] = [];

      // Support both array format and object with "questions" key
      const rawQuestions = Array.isArray(parsed) ? parsed : parsed.questions;
      if (!Array.isArray(rawQuestions)) {
        setJsonImportError('JSON must be an array of questions or an object with a "questions" array.');
        return;
      }

      for (let i = 0; i < rawQuestions.length; i++) {
        const q = rawQuestions[i];
        // Validate required fields
        if (!q.text || typeof q.text !== 'string') {
          setJsonImportError(`Question ${i + 1}: "text" is required and must be a string.`);
          return;
        }
        const type = (q.type === 'mcq' || q.type === 'true_false' || q.type === 'short_answer') ? q.type : 'mcq';

        let options: string[] = [];
        let correctAnswer = '';

        if (type === 'mcq') {
          if (Array.isArray(q.options)) {
            options = q.options.map((o: unknown) => String(o));
          } else if (Array.isArray(q.choices)) {
            options = q.choices.map((o: unknown) => String(o));
          } else {
            options = ['', '', '', ''];
          }
          // correctAnswer can be index (number) or letter (A, B, C...)
          if (q.correctAnswer !== undefined && q.correctAnswer !== null) {
            const ca = String(q.correctAnswer);
            // If it's a letter (A-Z), convert to index
            if (/^[A-Za-z]$/.test(ca)) {
              correctAnswer = String(ca.toUpperCase().charCodeAt(0) - 65);
            } else {
              correctAnswer = ca;
            }
          } else if (q.answer !== undefined && q.answer !== null) {
            const ca = String(q.answer);
            if (/^[A-Za-z]$/.test(ca)) {
              correctAnswer = String(ca.toUpperCase().charCodeAt(0) - 65);
            } else {
              correctAnswer = ca;
            }
          } else {
            correctAnswer = '0';
          }
        } else if (type === 'true_false') {
          correctAnswer = q.correctAnswer === 'false' || q.answer === 'false' ? 'false' : 'true';
        } else {
          // short_answer
          correctAnswer = q.correctAnswer ? String(q.correctAnswer) : (q.answer ? String(q.answer) : '');
        }

        const points = typeof q.points === 'number' ? q.points : (typeof q.grade === 'number' ? q.grade : 1);

        importedQuestions.push({
          type,
          text: q.text,
          options,
          correctAnswer,
          points,
          order: i,
        });
      }

      setJsonImportPreview(importedQuestions);

      if (importedQuestions.length === 0) {
        setJsonImportError('No valid questions found in JSON.');
        return;
      }

      if (jsonImportMode === 'replace') {
        setQuestions(importedQuestions);
      } else {
        setQuestions([...questions, ...importedQuestions]);
      }
      setExpandedQuestion(jsonImportMode === 'replace' ? 0 : questions.length);
      setJsonImportOpen(false);
      setJsonImportText('');
      setJsonImportError('');
      setJsonImportPreview([]);
      toast.success(`Imported ${importedQuestions.length} question${importedQuestions.length !== 1 ? 's' : ''}`);
    } catch (e) {
      setJsonImportError('Invalid JSON format. Please check your input.');
    }
  };

  // ─── File Upload Handler ────────────────────────────────────────────────────

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith('.json') && file.type !== 'application/json') {
      setJsonImportError('Please upload a .json file');
      return;
    }
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result;
      if (typeof text === 'string') {
        setJsonImportText(text);
        // Auto-parse for preview
        try {
          const parsed = JSON.parse(text);
          const rawQuestions = Array.isArray(parsed) ? parsed : parsed.questions;
          if (Array.isArray(rawQuestions)) {
            const preview: QuestionForm[] = [];
            for (let i = 0; i < rawQuestions.length; i++) {
              const q = rawQuestions[i];
              if (!q.text || typeof q.text !== 'string') continue;
              const type = (q.type === 'mcq' || q.type === 'true_false' || q.type === 'short_answer') ? q.type : 'mcq';
              let options: string[] = [];
              let correctAnswer = '';
              if (type === 'mcq') {
                options = Array.isArray(q.options) ? q.options.map((o: unknown) => String(o)) : Array.isArray(q.choices) ? q.choices.map((o: unknown) => String(o)) : ['', '', '', ''];
                if (q.correctAnswer !== undefined && q.correctAnswer !== null) {
                  const ca = String(q.correctAnswer);
                  correctAnswer = /^[A-Za-z]$/.test(ca) ? String(ca.toUpperCase().charCodeAt(0) - 65) : ca;
                } else if (q.answer !== undefined && q.answer !== null) {
                  const ca = String(q.answer);
                  correctAnswer = /^[A-Za-z]$/.test(ca) ? String(ca.toUpperCase().charCodeAt(0) - 65) : ca;
                } else { correctAnswer = '0'; }
              } else if (type === 'true_false') {
                correctAnswer = q.correctAnswer === 'false' || q.answer === 'false' ? 'false' : 'true';
              } else {
                correctAnswer = q.correctAnswer ? String(q.correctAnswer) : (q.answer ? String(q.answer) : '');
              }
              const points = typeof q.points === 'number' ? q.points : (typeof q.grade === 'number' ? q.grade : 1);
              preview.push({ type, text: q.text, options, correctAnswer, points, order: i });
            }
            setJsonImportPreview(preview);
            setJsonImportError('');
          } else {
            setJsonImportPreview([]);
            setJsonImportError('JSON must be an array or object with "questions" array');
          }
        } catch {
          setJsonImportPreview([]);
          setJsonImportError('Invalid JSON format');
        }
      }
    };
    reader.readAsText(file);
    // Reset the input so the same file can be re-uploaded
    e.target.value = '';
  };

  // ─── Navigate to Create ───────────────────────────────────────────────────

  const handleGoCreate = () => {
    resetForm();
    setTab('create');
  };

  // ─── Navigate to Edit ─────────────────────────────────────────────────────

  const handleGoEdit = async (exam: Exam) => {
    try {
      const res = await fetch(`/api/exams/${exam.id}`);
      const data = await res.json();
      if (!data.ok || !data.exam) { toast.error('Failed to load exam details'); return; }
      const examData = data.exam;

      setEditingExamId(examData.id);
      setExamTitle(examData.title);
      setExamDescription(examData.description || '');
      setExamDuration(String(examData.durationMinutes));
      setExamMaxAttempts(String(examData.maxAttempts));
      setExamPassingScore(examData.passingScore != null ? String(examData.passingScore) : '');
      setExamShuffle(examData.shuffleQuestions);
      setExamShowResults(examData.showResults);
      setExamSousGroupeId(examData.sousGroupeId ? String(examData.sousGroupeId) : '');

      const loadedQuestions: QuestionForm[] = (examData.questions || []).map((q: ExamQuestion & { options?: string | string[] | null }, i: number) => ({
        id: q.id,
        type: q.type as QuestionForm['type'],
        text: q.text,
        options: Array.isArray(q.options) ? q.options : (typeof q.options === 'string' ? JSON.parse(q.options) : []),
        correctAnswer: q.correctAnswer || '',
        points: q.points,
        order: q.order ?? i,
      }));

      setQuestions(loadedQuestions.length > 0 ? loadedQuestions : [createEmptyQuestion(0)]);
      setExpandedQuestion(0);
      setTab('edit');
    } catch {
      toast.error('Failed to load exam');
    }
  };

  // ─── Navigate to Results ──────────────────────────────────────────────────

  const handleGoResults = async (exam: Exam) => {
    setResultsExamId(exam.id);
    setResultsExamTitle(exam.title);
    setAttemptsLoading(true);
    setTab('results');
    try {
      const res = await fetch(`/api/exams/${exam.id}/attempts`);
      const data = await res.json();
      if (data.ok && Array.isArray(data.attempts)) setAttempts(data.attempts);
    } catch {
      toast.error('Failed to load attempts');
    }
    setAttemptsLoading(false);
  };

  // ─── Save Exam (Create or Update) ─────────────────────────────────────────

  const handleSave = async () => {
    if (!instructor) return;
    if (!examTitle.trim()) { toast.error('Title is required'); return; }

    // Validate questions
    const validQuestions = questions.filter(q => q.text.trim());
    if (validQuestions.length === 0) { toast.error('At least one question is required'); return; }

    // Validate MCQ questions have options and correct answer
    for (const q of validQuestions) {
      if (q.type === 'mcq') {
        const filledOptions = q.options.filter(o => o.trim());
        if (filledOptions.length < 2) {
          toast.error(`Question "${q.text.slice(0, 30)}..." needs at least 2 options`);
          return;
        }
      }
      if (q.type === 'true_false' && !q.correctAnswer) {
        toast.error(`True/False question "${q.text.slice(0, 30)}..." needs a correct answer`);
        return;
      }
    }

    setSaving(true);
    try {
      const payload = {
        title: examTitle.trim(),
        description: examDescription.trim() || null,
        labId: activeLabId,
        instructorId: instructor.id,
        durationMinutes: parseInt(examDuration) || 30,
        shuffleQuestions: examShuffle,
        showResults: examShowResults,
        maxAttempts: parseInt(examMaxAttempts) || 1,
        passingScore: examPassingScore ? parseFloat(examPassingScore) : null,
        sousGroupeId: examSousGroupeId && examSousGroupeId !== 'all' ? parseInt(examSousGroupeId) : null,
        questions: validQuestions.map((q, i) => ({
          type: q.type,
          text: q.text.trim(),
          options: q.type === 'mcq' ? q.options : undefined,
          correctAnswer: q.correctAnswer,
          points: q.points,
          order: i,
        })),
      };

      let res: Response;
      if (editingExamId) {
        res = await fetch(`/api/exams/${editingExamId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch('/api/exams', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }

      const data = await res.json();
      if (!data.ok) { toast.error(data.error || 'Failed to save exam'); return; }

      toast.success(editingExamId ? 'Exam updated' : 'Exam created');
      resetForm();
      setTab('list');
      fetchExams();
    } catch {
      toast.error('Connection error');
    }
    setSaving(false);
  };

  // ─── Delete Exam ──────────────────────────────────────────────────────────

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/exams/${deleteId}`, { method: 'DELETE' });
      const data = await res.json();
      if (!data.ok) { toast.error(data.error || 'Failed to delete'); return; }
      toast.success('Exam deleted');
      setDeleteId(null);
      fetchExams();
    } catch {
      toast.error('Connection error');
    }
    setDeleting(false);
  };

  // ─── Publish / Close Exam ─────────────────────────────────────────────────

  const handleStatusAction = async () => {
    if (!confirmAction) return;
    setSaving(true);
    try {
      const newStatus = confirmAction.action === 'publish' ? 'published' : 'closed';
      const res = await fetch(`/api/exams/${confirmAction.examId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (!data.ok) { toast.error(data.error || 'Failed to update status'); return; }
      toast.success(confirmAction.action === 'publish' ? 'Exam published' : 'Exam closed');
      setConfirmAction(null);
      fetchExams();
    } catch {
      toast.error('Connection error');
    }
    setSaving(false);
  };

  // ─── Question Handlers ────────────────────────────────────────────────────

  const addQuestion = () => {
    const newQ = createEmptyQuestion(questions.length);
    setQuestions([...questions, newQ]);
    setExpandedQuestion(questions.length);
  };

  const removeQuestion = (index: number) => {
    const updated = questions.filter((_, i) => i !== index);
    setQuestions(updated.map((q, i) => ({ ...q, order: i })));
    if (expandedQuestion !== null && expandedQuestion >= updated.length) {
      setExpandedQuestion(updated.length - 1);
    }
  };

  const updateQuestion = (index: number, field: keyof QuestionForm, value: unknown) => {
    const updated = [...questions];
    updated[index] = { ...updated[index], [field]: value };
    // Reset options/correctAnswer when type changes
    if (field === 'type') {
      const newType = value as QuestionForm['type'];
      if (newType === 'mcq') {
        updated[index].options = ['', '', '', ''];
        updated[index].correctAnswer = '0';
      } else if (newType === 'true_false') {
        updated[index].options = [];
        updated[index].correctAnswer = 'true';
      } else {
        updated[index].options = [];
        updated[index].correctAnswer = '';
      }
    }
    setQuestions(updated);
  };

  const updateOption = (qIndex: number, oIndex: number, value: string) => {
    const updated = [...questions];
    const opts = [...updated[qIndex].options];
    opts[oIndex] = value;
    updated[qIndex] = { ...updated[qIndex], options: opts };
    setQuestions(updated);
  };

  const addOption = (qIndex: number) => {
    const updated = [...questions];
    updated[qIndex] = { ...updated[qIndex], options: [...updated[qIndex].options, ''] };
    setQuestions(updated);
  };

  const removeOption = (qIndex: number, oIndex: number) => {
    const updated = [...questions];
    const opts = updated[qIndex].options.filter((_, i) => i !== oIndex);
    updated[qIndex] = { ...updated[qIndex], options: opts };
    // Fix correctAnswer index if needed
    if (updated[qIndex].type === 'mcq') {
      const ca = parseInt(updated[qIndex].correctAnswer);
      if (ca === oIndex) updated[qIndex].correctAnswer = '0';
      else if (ca > oIndex) updated[qIndex].correctAnswer = String(ca - 1);
    }
    setQuestions(updated);
  };

  const moveQuestion = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === questions.length - 1) return;
    const updated = [...questions];
    const swapIdx = direction === 'up' ? index - 1 : index + 1;
    [updated[index], updated[swapIdx]] = [updated[swapIdx], updated[index]];
    setQuestions(updated.map((q, i) => ({ ...q, order: i })));
  };

  // ─── Compute Total Points ─────────────────────────────────────────────────

  const totalPoints = useMemo(() =>
    questions.reduce((sum, q) => sum + (q.text.trim() ? q.points : 0), 0),
    [questions]
  );

  // ─── Guard ────────────────────────────────────────────────────────────────

  if (!instructor) return null;

  // ─── Tab Config ───────────────────────────────────────────────────────────

  const tabItems: { key: TabView; label: string; icon: React.ReactNode }[] = [
    { key: 'list', label: 'My Exams', icon: <ClipboardCheck className="h-3.5 w-3.5" /> },
    { key: 'create', label: editingExamId ? 'Edit Exam' : 'Create Exam', icon: <Plus className="h-3.5 w-3.5" /> },
  ];
  if (tab === 'results') {
    tabItems.push({ key: 'results', label: 'Results', icon: <Eye className="h-3.5 w-3.5" /> });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:py-8">
      <motion.div {...fadeSlide}>
        <BreadcrumbNav items={[
          { label: 'Instructor', view: 'instructor-panel' as const },
          { label: 'Exams' },
        ]} />

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <ClipboardCheck className="h-6 w-6 text-violet-500" />
              <span className="text-primary font-semibold">Exam Management</span>
            </h1>
            <p className="text-sm text-muted-foreground">
              {labs.find(l => l.id === activeLabId)?.name || instructor.labName || 'Lab'} · Create and manage exams
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => { fetchExams(); setLoading(true); }}>
              <RefreshCw className="h-3.5 w-3.5 mr-1" /> Refresh
            </Button>
            {tab === 'list' && (
              <Button size="sm" onClick={handleGoCreate}>
                <Plus className="h-3.5 w-3.5 mr-1" /> New Exam
              </Button>
            )}
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 mb-6 p-1 bg-muted/50 rounded-lg">
          {tabItems.map(item => (
            <button
              key={item.key}
              onClick={() => {
                if (item.key === 'create' && tab === 'edit') return; // Don't lose edit state
                if (item.key === 'list') { resetForm(); }
                setTab(item.key);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                tab === item.key
                  ? 'bg-background shadow-sm text-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
              }`}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>

        {/* ═══════════════════════════════════════════════════════════════════
            TAB: EXAM LIST
        ═══════════════════════════════════════════════════════════════════ */}
        {tab === 'list' && (
          <>
            {loading ? (
              <div className="space-y-4">
                {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)}
              </div>
            ) : exams.length === 0 ? (
              <EmptyState
                icon={ClipboardCheck}
                title="No Exams Yet"
                description="Create your first exam to assess your students."
                action={
                  <Button size="sm" onClick={handleGoCreate}>
                    <Plus className="h-3.5 w-3.5 mr-1" /> Create Exam
                  </Button>
                }
              />
            ) : (
              <div className="max-h-[calc(100vh-24rem)] overflow-y-auto space-y-3 pr-1 custom-scrollbar">
                {exams.map((exam) => {
                  const isDraft = exam.status === 'draft';
                  const isPublished = exam.status === 'published';
                  const isActive = exam.status === 'active';
                  const isClosed = exam.status === 'closed';

                  return (
                    <Card key={exam.id} className="shadow-sm">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <h3 className="font-semibold text-sm">{exam.title}</h3>
                              {examStatusBadge(exam.status)}
                              {exam.sousGroupeId && (
                                <Badge variant="outline" className="text-[10px]">
                                  Group filter
                                </Badge>
                              )}
                            </div>
                            {exam.description && (
                              <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                                {exam.description}
                              </p>
                            )}
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" /> {exam.durationMinutes}min
                              </span>
                              <span className="flex items-center gap-1">
                                <FileText className="h-3 w-3" /> {exam.questionCount || 0} Q
                              </span>
                              <span className="flex items-center gap-1">
                                <ClipboardCheck className="h-3 w-3" /> {exam.attemptCount || 0} attempts
                              </span>
                              {exam.passingScore != null && (
                                <span className="flex items-center gap-1">
                                  <CheckCircle2 className="h-3 w-3" /> Pass: {exam.passingScore}%
                                </span>
                              )}
                              <span>· {timeAgo(exam.createdAt)}</span>
                            </div>
                            {(exam as any).publishedAt && (
                              <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                                <Send className="h-3 w-3" /> Published {timeAgo((exam as any).publishedAt)}
                                {(() => {
                                  const rt = formatRemainingTime((exam as any).publishedAt, exam.durationMinutes);
                                  return rt.expired
                                    ? <span className="text-red-600 dark:text-red-400 font-medium ml-1">(Time expired)</span>
                                    : <span className="text-emerald-600 dark:text-emerald-400 font-medium ml-1">({rt.text})</span>;
                                })()}
                              </div>
                            )}
                            {exam.averageScore != null && (
                              <div className="mt-2 flex items-center gap-2">
                                <span className="text-[10px] text-muted-foreground">Avg Score:</span>
                                <span className={`text-xs font-bold ${
                                  exam.averageScore >= (exam.passingScore || 50) ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
                                }`}>
                                  {Math.round(exam.averageScore)}%
                                </span>
                              </div>
                            )}
                          </div>

                          <div className="flex items-center gap-1 shrink-0 flex-wrap justify-end">
                            {/* Results button */}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 text-xs gap-1"
                              onClick={() => handleGoResults(exam)}
                            >
                              <Eye className="h-3.5 w-3.5" />
                              <span className="hidden sm:inline">Results</span>
                            </Button>

                            {/* Edit button - only for draft */}
                            {isDraft && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => handleGoEdit(exam)}
                              >
                                <Edit2 className="h-3.5 w-3.5" />
                              </Button>
                            )}

                            {/* Publish button */}
                            {isDraft && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 text-xs gap-1 text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300"
                                onClick={() => setConfirmAction({ examId: exam.id, action: 'publish' })}
                              >
                                <Send className="h-3.5 w-3.5" />
                                <span className="hidden sm:inline">Publish</span>
                              </Button>
                            )}

                            {/* Close button */}
                            {(isPublished || isActive) && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 text-xs gap-1 text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                                onClick={() => setConfirmAction({ examId: exam.id, action: 'close' })}
                              >
                                <XCircle className="h-3.5 w-3.5" />
                                <span className="hidden sm:inline">Close</span>
                              </Button>
                            )}

                            {/* Delete button - only for drafts with no attempts */}
                            {isDraft && !(exam.attemptCount > 0) && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 hover:bg-red-100 dark:hover:bg-red-950/30"
                                onClick={() => setDeleteId(exam.id)}
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
            )}
          </>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            TAB: CREATE / EDIT EXAM
        ═══════════════════════════════════════════════════════════════════ */}
        {(tab === 'create' || tab === 'edit') && (
          <div className="space-y-6">
            {/* Exam Details Card */}
            <Card className="shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="h-4 w-4 text-violet-500" />
                  {editingExamId ? 'Edit Exam' : 'New Exam'} Details
                </CardTitle>
                <CardDescription>
                  Set the title, timing, and rules for this exam
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label className="text-xs font-medium">Title *</Label>
                    <Input
                      value={examTitle}
                      onChange={(e) => setExamTitle(e.target.value)}
                      placeholder="e.g. Midterm Exam - Operating Systems"
                    />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label className="text-xs font-medium">Description</Label>
                    <Textarea
                      value={examDescription}
                      onChange={(e) => setExamDescription(e.target.value)}
                      placeholder="Optional description or instructions for students..."
                      rows={2}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Duration (minutes)</Label>
                    <Input
                      type="number"
                      min="1"
                      value={examDuration}
                      onChange={(e) => setExamDuration(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Max Attempts</Label>
                    <Input
                      type="number"
                      min="1"
                      max="10"
                      value={examMaxAttempts}
                      onChange={(e) => setExamMaxAttempts(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Passing Score (%)</Label>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      placeholder="e.g. 50"
                      value={examPassingScore}
                      onChange={(e) => setExamPassingScore(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Show Results</Label>
                    <Select value={examShowResults} onValueChange={(v) => setExamShowResults(v as 'immediate' | 'manual')}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="immediate">Immediate (auto-show after submit)</SelectItem>
                        <SelectItem value="manual">Manual (you release results)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Sous-groupe Filter (optional)</Label>
                    <Select value={examSousGroupeId || 'all'} onValueChange={setExamSousGroupeId}>
                      <SelectTrigger>
                        <SelectValue placeholder="All students" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All students</SelectItem>
                        {labSousGroupes.map(sg => (
                          <SelectItem key={sg.id} value={String(sg.id)}>
                            {sg.name} ({sg.members.length} members)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-3 pt-1">
                    <Switch
                      checked={examShuffle}
                      onCheckedChange={setExamShuffle}
                    />
                    <Label className="text-xs font-medium cursor-pointer" onClick={() => setExamShuffle(!examShuffle)}>
                      Shuffle question order
                    </Label>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Question Builder Card */}
            <Card className="shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      <GripVertical className="h-4 w-4 text-muted-foreground" />
                      Questions
                      <Badge variant="secondary" className="text-[10px] px-1.5">
                        {questions.filter(q => q.text.trim()).length} · {totalPoints} pts
                      </Badge>
                    </CardTitle>
                    <CardDescription className="mt-0.5">
                      Add and configure questions for this exam
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => setJsonImportOpen(true)}>
                      <FileText className="h-3.5 w-3.5 mr-1" /> Import JSON
                    </Button>
                    <Button variant="outline" size="sm" onClick={addQuestion}>
                      <Plus className="h-3.5 w-3.5 mr-1" /> Add Question
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {questions.map((q, qIndex) => {
                    const isExpanded = expandedQuestion === qIndex;
                    const filledOpts = q.type === 'mcq' ? q.options.filter(o => o.trim()) : [];
                    const hasText = q.text.trim().length > 0;

                    return (
                      <div
                        key={qIndex}
                        className={`border rounded-xl transition-all ${
                          isExpanded
                            ? 'border-violet-200 dark:border-violet-800 bg-violet-50/30 dark:bg-violet-950/10'
                            : 'border-border/60 hover:border-border'
                        }`}
                      >
                        {/* Question Preview / Header */}
                        <div
                          onClick={() => setExpandedQuestion(isExpanded ? null : qIndex)}
                          className="w-full flex items-center gap-3 p-3 text-left cursor-pointer"
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setExpandedQuestion(isExpanded ? null : qIndex); }}
                        >
                          <div className="flex flex-col gap-0.5 shrink-0">
                            <button
                              onClick={(e) => { e.stopPropagation(); moveQuestion(qIndex, 'up'); }}
                              className="h-4 w-4 flex items-center justify-center rounded hover:bg-muted"
                              disabled={qIndex === 0}
                            >
                              <ChevronUp className="h-3 w-3" />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); moveQuestion(qIndex, 'down'); }}
                              className="h-4 w-4 flex items-center justify-center rounded hover:bg-muted"
                              disabled={qIndex === questions.length - 1}
                            >
                              <ChevronDown className="h-3 w-3" />
                            </button>
                          </div>

                          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-muted shrink-0 text-xs font-bold text-muted-foreground">
                            {qIndex + 1}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              {questionTypeBadge(q.type)}
                              <span className="text-xs text-muted-foreground">{q.points} pt{q.points !== 1 ? 's' : ''}</span>
                            </div>
                            {hasText ? (
                              <p className="text-sm font-medium truncate mt-0.5">
                                {q.text}
                              </p>
                            ) : (
                              <p className="text-xs text-muted-foreground italic mt-0.5">
                                Empty question — click to edit
                              </p>
                            )}
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            {questions.length > 1 && (
                              <button
                                onClick={(e) => { e.stopPropagation(); removeQuestion(qIndex); }}
                                className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-red-100 dark:hover:bg-red-950/30 transition-colors"
                              >
                                <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-red-600" />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Expanded Question Editor */}
                        {isExpanded && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.2 }}
                            className="px-3 pb-3 border-t border-border/40"
                          >
                            <div className="pt-3 space-y-4">
                              {/* Type + Points Row */}
                              <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                  <Label className="text-xs font-medium">Question Type</Label>
                                  <Select
                                    value={q.type}
                                    onValueChange={(v) => updateQuestion(qIndex, 'type', v)}
                                  >
                                    <SelectTrigger>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="mcq">Multiple Choice (MCQ)</SelectItem>
                                      <SelectItem value="true_false">True / False</SelectItem>
                                      <SelectItem value="short_answer">Short Answer</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div className="space-y-1.5">
                                  <Label className="text-xs font-medium">Points</Label>
                                  <Input
                                    type="number"
                                    min="0.5"
                                    step="0.5"
                                    value={q.points}
                                    onChange={(e) => updateQuestion(qIndex, 'points', parseFloat(e.target.value) || 1)}
                                  />
                                </div>
                              </div>

                              {/* Question Text */}
                              <div className="space-y-1.5">
                                <Label className="text-xs font-medium">Question Text *</Label>
                                <Textarea
                                  value={q.text}
                                  onChange={(e) => updateQuestion(qIndex, 'text', e.target.value)}
                                  placeholder="Enter your question here..."
                                  rows={2}
                                />
                              </div>

                              {/* MCQ Options */}
                              {q.type === 'mcq' && (
                                <div className="space-y-2">
                                  <Label className="text-xs font-medium">Options (select correct answer below)</Label>
                                  <div className="space-y-2">
                                    {q.options.map((opt, oIndex) => (
                                      <div key={oIndex} className="flex items-center gap-2">
                                        <button
                                          onClick={() => updateQuestion(qIndex, 'correctAnswer', String(oIndex))}
                                          className={`flex h-6 w-6 items-center justify-center rounded-full border-2 transition-all shrink-0 ${
                                            q.correctAnswer === String(oIndex)
                                              ? 'border-emerald-500 bg-emerald-500 text-white'
                                              : 'border-muted-foreground/30 hover:border-muted-foreground/60'
                                          }`}
                                        >
                                          {q.correctAnswer === String(oIndex) && (
                                            <CheckCircle2 className="h-3.5 w-3.5" />
                                          )}
                                        </button>
                                        <Input
                                          value={opt}
                                          onChange={(e) => updateOption(qIndex, oIndex, e.target.value)}
                                          placeholder={`Option ${String.fromCharCode(65 + oIndex)}`}
                                          className="flex-1"
                                        />
                                        {q.options.length > 2 && (
                                          <button
                                            onClick={() => removeOption(qIndex, oIndex)}
                                            className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-red-100 dark:hover:bg-red-950/30 transition-colors shrink-0"
                                          >
                                            <Trash2 className="h-3 w-3 text-muted-foreground" />
                                          </button>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => addOption(qIndex)}
                                    className="h-7 text-xs gap-1"
                                  >
                                    <Plus className="h-3 w-3" /> Add Option
                                  </Button>
                                </div>
                              )}

                              {/* True/False */}
                              {q.type === 'true_false' && (
                                <div className="space-y-1.5">
                                  <Label className="text-xs font-medium">Correct Answer</Label>
                                  <div className="flex items-center gap-2">
                                    <button
                                      onClick={() => updateQuestion(qIndex, 'correctAnswer', 'true')}
                                      className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                                        q.correctAnswer === 'true'
                                          ? 'bg-emerald-500 text-white shadow-sm'
                                          : 'bg-muted hover:bg-muted/80 text-muted-foreground'
                                      }`}
                                    >
                                      True
                                    </button>
                                    <button
                                      onClick={() => updateQuestion(qIndex, 'correctAnswer', 'false')}
                                      className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                                        q.correctAnswer === 'false'
                                          ? 'bg-red-500 text-white shadow-sm'
                                          : 'bg-muted hover:bg-muted/80 text-muted-foreground'
                                      }`}
                                    >
                                      False
                                    </button>
                                  </div>
                                </div>
                              )}

                              {/* Short Answer */}
                              {q.type === 'short_answer' && (
                                <div className="space-y-1.5">
                                  <Label className="text-xs font-medium">Correct Answer</Label>
                                  <Input
                                    value={q.correctAnswer}
                                    onChange={(e) => updateQuestion(qIndex, 'correctAnswer', e.target.value)}
                                    placeholder="Enter the expected answer"
                                  />
                                  <p className="text-[10px] text-muted-foreground">
                                    Short answer grading is case-insensitive
                                  </p>
                                </div>
                              )}
                            </div>
                          </motion.div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {questions.length === 0 && (
                  <div className="py-8 text-center">
                    <p className="text-sm text-muted-foreground mb-3">No questions added yet</p>
                    <Button variant="outline" size="sm" onClick={addQuestion}>
                      <Plus className="h-3.5 w-3.5 mr-1" /> Add First Question
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Save Actions */}
            <div className="flex items-center justify-between gap-3">
              <Button
                variant="outline"
                onClick={() => { resetForm(); setTab('list'); }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={saving || !examTitle.trim()}
              >
                {saving ? (
                  <RefreshCw className="h-3.5 w-3.5 animate-spin mr-1" />
                ) : (
                  <Save className="h-3.5 w-3.5 mr-1" />
                )}
                {saving ? 'Saving...' : editingExamId ? 'Update Exam' : 'Create Exam'}
              </Button>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            TAB: RESULTS
        ═══════════════════════════════════════════════════════════════════ */}
        {tab === 'results' && resultsExamId && (
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Eye className="h-4 w-4 text-violet-500" />
                    Results: {resultsExamTitle}
                  </CardTitle>
                  <CardDescription className="mt-0.5">
                    {attempts.length} attempt{attempts.length !== 1 ? 's' : ''} submitted
                  </CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={() => setTab('list')}>
                  Back to Exams
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {attemptsLoading ? (
                <div className="space-y-3">
                  {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-12 rounded-lg" />)}
                </div>
              ) : attempts.length === 0 ? (
                <EmptyState
                  icon={ClipboardCheck}
                  title="No Attempts Yet"
                  description="Students haven't submitted any attempts for this exam."
                />
              ) : (
                <div className="rounded-lg border overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-muted/50 border-b">
                          <th className="text-left p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Student</th>
                          <th className="text-center p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Attempt</th>
                          <th className="text-center p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Score</th>
                          <th className="text-center p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Points</th>
                          <th className="text-center p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Time</th>
                          <th className="text-center p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                          <th className="text-right p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Submitted</th>
                          <th className="text-center p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {attempts.map((attempt) => {
                          const passed = attempt.passed;
                          const scorePercent = attempt.score != null ? Math.round(attempt.score) : null;

                          return (
                            <tr key={attempt.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                              <td className="p-3">
                                <div className="flex items-center gap-2">
                                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-[10px] font-bold text-muted-foreground shrink-0">
                                    {attempt.student
                                      ? `${attempt.student.firstName[0] || ''}${attempt.student.lastName[0] || ''}`
                                      : '?'}
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-sm font-medium truncate">
                                      {attempt.student
                                        ? `${attempt.student.lastName} ${attempt.student.firstName}`
                                        : `Student #${attempt.studentId}`}
                                    </p>
                                    {attempt.student && (
                                      <p className="text-[10px] text-muted-foreground font-mono">
                                        {attempt.student.studentId}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </td>
                              <td className="p-3 text-center">
                                <Badge variant="outline" className="text-[10px]">
                                  #{attempt.attemptNumber}
                                </Badge>
                              </td>
                              <td className="p-3 text-center">
                                <span className={`text-sm font-bold ${
                                  scorePercent == null ? 'text-muted-foreground'
                                  : passed ? 'text-emerald-600 dark:text-emerald-400'
                                  : 'text-red-600 dark:text-red-400'
                                }`}>
                                  {scorePercent != null ? `${scorePercent}%` : '—'}
                                </span>
                              </td>
                              <td className="p-3 text-center text-xs text-muted-foreground">
                                {attempt.totalPoints != null && attempt.maxPoints != null
                                  ? `${attempt.totalPoints}/${attempt.maxPoints}`
                                  : '—'}
                              </td>
                              <td className="p-3 text-center text-xs text-muted-foreground">
                                {formatTimeSpent(attempt.timeSpent)}
                              </td>
                              <td className="p-3 text-center">
                                {attempt.submittedAt ? (
                                  passed ? (
                                    <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800 text-[10px]">
                                      Passed
                                    </Badge>
                                  ) : (
                                    <Badge className="bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800 text-[10px]">
                                      Failed
                                    </Badge>
                                  )
                                ) : (
                                  <Badge className="bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800 text-[10px]">
                                    In Progress
                                  </Badge>
                                )}
                              </td>
                              <td className="p-3 text-right text-xs text-muted-foreground">
                                {attempt.submittedAt ? timeAgo(attempt.submittedAt) : '—'}
                              </td>
                              <td className="p-3 text-center">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 text-xs gap-1"
                                  onClick={() => {
                                    setViewingAttempt(attempt);
                                    setGradeEdits({});
                                  }}
                                  disabled={!attempt.submittedAt}
                                >
                                  <Eye className="h-3.5 w-3.5" />
                                  <span className="hidden sm:inline">Responses</span>
                                </Button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Summary Stats */}
              {attempts.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
                  {(() => {
                    const submitted = attempts.filter(a => a.submittedAt);
                    const passedCount = submitted.filter(a => a.passed).length;
                    const avgScore = submitted.length > 0
                      ? Math.round(submitted.reduce((s, a) => s + (a.score || 0), 0) / submitted.length)
                      : 0;
                    const avgTime = submitted.length > 0
                      ? Math.round(submitted.reduce((s, a) => s + (a.timeSpent || 0), 0) / submitted.length)
                      : 0;
                    const passRate = submitted.length > 0 ? Math.round((passedCount / submitted.length) * 100) : 0;

                    return (
                      <>
                        <div className="p-3 rounded-lg bg-muted/50 text-center">
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Attempts</p>
                          <p className="text-lg font-bold">{submitted.length}</p>
                        </div>
                        <div className="p-3 rounded-lg bg-muted/50 text-center">
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Avg Score</p>
                          <p className={`text-lg font-bold ${avgScore >= 50 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                            {avgScore}%
                          </p>
                        </div>
                        <div className="p-3 rounded-lg bg-muted/50 text-center">
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Pass Rate</p>
                          <p className={`text-lg font-bold ${passRate >= 50 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                            {passRate}%
                          </p>
                        </div>
                        <div className="p-3 rounded-lg bg-muted/50 text-center">
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Avg Time</p>
                          <p className="text-lg font-bold">{formatTimeSpent(avgTime)}</p>
                        </div>
                      </>
                    );
                  })()}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            DIALOGS
        ═══════════════════════════════════════════════════════════════════ */}

        {/* Delete Confirmation */}
        <AlertDialog open={!!deleteId} onOpenChange={(open) => { if (!open) setDeleteId(null); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Exam</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this exam? This action cannot be undone. Exams with existing attempts cannot be deleted.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-red-600 hover:bg-red-700">
                {deleting ? 'Deleting...' : 'Delete'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Publish/Close Confirmation */}
        <AlertDialog open={!!confirmAction} onOpenChange={(open) => { if (!open) setConfirmAction(null); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {confirmAction?.action === 'publish' ? 'Publish Exam' : 'Close Exam'}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {confirmAction?.action === 'publish'
                  ? 'Once published, students will be able to see and take this exam. Make sure all questions are configured correctly.'
                  : 'Closing this exam will prevent any further submissions. Students who are currently taking the exam will still be able to submit.'}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleStatusAction}
                disabled={saving}
                className={confirmAction?.action === 'close' ? 'bg-red-600 hover:bg-red-700' : ''}
              >
                {saving ? 'Processing...' : confirmAction?.action === 'publish' ? 'Publish' : 'Close Exam'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* ═════════════════════════════════════════════════════════════
            JSON IMPORT DIALOG
        ══════════════════════════════════════════════════════════════ */}
        <Dialog open={jsonImportOpen} onOpenChange={(open) => { setJsonImportOpen(open); if (!open) { setJsonImportPreview([]); setJsonImportError(''); } }}>
          <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Code className="h-5 w-5 text-violet-500" />
                Import Questions from JSON
              </DialogTitle>
              <DialogDescription>
                Upload a JSON file or paste JSON to import questions. You can generate questions outside (e.g., with AI tools) and upload them here.
              </DialogDescription>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto space-y-4 pr-1">
              {/* Format Template Toggle */}
              <div className="rounded-lg border border-dashed border-violet-300 dark:border-violet-700 bg-violet-50/50 dark:bg-violet-950/20">
                <button
                  onClick={() => setJsonShowTemplate(!jsonShowTemplate)}
                  className="w-full flex items-center justify-between p-3 text-left"
                >
                  <span className="text-xs font-medium text-violet-700 dark:text-violet-300 flex items-center gap-1.5">
                    <FileText className="h-3.5 w-3.5" />
                    JSON Format Guide &amp; Template
                  </span>
                  <ChevronDown className={`h-3.5 w-3.5 text-violet-500 transition-transform ${jsonShowTemplate ? 'rotate-180' : ''}`} />
                </button>
                {jsonShowTemplate && (
                  <div className="px-3 pb-3 space-y-3">
                    <pre className="text-[10px] leading-relaxed bg-background rounded-md p-3 overflow-x-auto border max-h-56 overflow-y-auto custom-scrollbar">
                      {JSON_TEMPLATE}
                    </pre>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs h-7"
                        onClick={() => {
                          const mainTemplate = JSON_TEMPLATE.split('\n\n/*')[0];
                          navigator.clipboard.writeText(mainTemplate);
                          setJsonCopied(true);
                          setTimeout(() => setJsonCopied(false), 2000);
                        }}
                      >
                        {jsonCopied ? <Check className="h-3 w-3 mr-1 text-emerald-500" /> : <Copy className="h-3 w-3 mr-1" />}
                        {jsonCopied ? 'Copied!' : 'Copy Template'}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs h-7"
                        onClick={() => {
                          setJsonImportText(JSON_TEMPLATE.split('\n\n/*')[0]);
                          // Auto-parse
                          try {
                            const parsed = JSON.parse(JSON_TEMPLATE.split('\n\n/*')[0]);
                            const rawQuestions = Array.isArray(parsed) ? parsed : parsed.questions;
                            if (Array.isArray(rawQuestions)) {
                              const preview: QuestionForm[] = rawQuestions.map((q: Record<string, unknown>, i: number) => {
                                const type = (q.type === 'mcq' || q.type === 'true_false' || q.type === 'short_answer') ? q.type as QuestionForm['type'] : 'mcq' as const;
                                let options: string[] = [];
                                let correctAnswer = '';
                                if (type === 'mcq') {
                                  options = Array.isArray(q.options) ? q.options.map((o: unknown) => String(o)) : ['', '', '', ''];
                                  if (q.correctAnswer != null) {
                                    const ca = String(q.correctAnswer);
                                    correctAnswer = /^[A-Za-z]$/.test(ca) ? String(ca.toUpperCase().charCodeAt(0) - 65) : ca;
                                  } else { correctAnswer = '0'; }
                                } else if (type === 'true_false') {
                                  correctAnswer = q.correctAnswer === 'false' ? 'false' : 'true';
                                } else {
                                  correctAnswer = q.correctAnswer ? String(q.correctAnswer) : '';
                                }
                                const points = typeof q.points === 'number' ? q.points : 1;
                                return { type, text: q.text as string || '', options, correctAnswer, points, order: i };
                              });
                              setJsonImportPreview(preview);
                              setJsonImportError('');
                            }
                          } catch { /* ignore */ }
                        }}
                      >
                        <Code className="h-3 w-3 mr-1" /> Load Example
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {/* File Upload Area */}
              <div className="space-y-2">
                <Label className="text-xs font-medium flex items-center gap-1.5">
                  <Upload className="h-3.5 w-3.5" /> Upload JSON File
                </Label>
                <div className="relative">
                  <input
                    type="file"
                    accept=".json,application/json"
                    onChange={handleFileUpload}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  />
                  <div className="flex items-center justify-center gap-2 rounded-lg border-2 border-dashed border-muted-foreground/25 hover:border-violet-400 dark:hover:border-violet-600 bg-muted/30 hover:bg-violet-50/50 dark:hover:bg-violet-950/10 transition-colors p-4 cursor-pointer">
                    <Upload className="h-5 w-5 text-muted-foreground" />
                    <div className="text-center">
                      <p className="text-xs font-medium text-muted-foreground">Click or drag .json file here</p>
                      <p className="text-[10px] text-muted-foreground/60">Supports .json files with question arrays</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Divider */}
              <div className="flex items-center gap-2">
                <div className="flex-1 h-px bg-border" />
                <span className="text-[10px] text-muted-foreground font-medium">OR PASTE JSON</span>
                <div className="flex-1 h-px bg-border" />
              </div>

              {/* Text Input */}
              <div className="space-y-2">
                <Label className="text-xs font-medium">Paste JSON</Label>
                <Textarea
                  value={jsonImportText}
                  onChange={(e) => {
                    setJsonImportText(e.target.value);
                    setJsonImportError('');
                    setJsonImportPreview([]);
                  }}
                  placeholder='{"questions": [...]} or [{...}, {...}]'
                  rows={6}
                  className="font-mono text-xs"
                />
              </div>

              {/* Import Mode */}
              <div className="flex items-center gap-3">
                <Label className="text-xs font-medium">Mode:</Label>
                <Select value={jsonImportMode} onValueChange={(v) => setJsonImportMode(v as 'replace' | 'append')}>
                  <SelectTrigger className="w-36 h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="append">Append to existing</SelectItem>
                    <SelectItem value="replace">Replace all</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Error Display */}
              {jsonImportError && (
                <div className="rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/40 p-3">
                  <p className="text-xs text-red-600 dark:text-red-400">{jsonImportError}</p>
                </div>
              )}

              {/* Preview of Parsed Questions */}
              {jsonImportPreview.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label className="text-xs font-medium text-emerald-700 dark:text-emerald-400">Preview — {jsonImportPreview.length} question{jsonImportPreview.length !== 1 ? 's' : ''} parsed</Label>
                  </div>
                  <div className="max-h-48 overflow-y-auto rounded-lg border bg-background p-2 space-y-1.5 custom-scrollbar">
                    {jsonImportPreview.map((q, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs p-1.5 rounded bg-muted/40">
                        <span className="font-mono text-muted-foreground shrink-0">{i + 1}.</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            {questionTypeBadge(q.type)}
                            <span className="font-medium text-muted-foreground">{q.points}pt</span>
                          </div>
                          <p className="truncate">{q.text}</p>
                          {q.type === 'mcq' && q.options.length > 0 && (
                            <p className="text-[10px] text-muted-foreground mt-0.5">
                              Options: {q.options.filter(o => o.trim()).join(' / ')}
                              {q.correctAnswer !== '' && ` → Answer: ${String.fromCharCode(65 + parseInt(q.correctAnswer))}`}
                            </p>
                          )}
                          {q.type === 'true_false' && (
                            <p className="text-[10px] text-muted-foreground mt-0.5">Answer: {q.correctAnswer}</p>
                          )}
                          {q.type === 'short_answer' && q.correctAnswer && (
                            <p className="text-[10px] text-muted-foreground mt-0.5">Answer: {q.correctAnswer}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <DialogFooter className="gap-2 pt-2 border-t">
              <Button variant="outline" size="sm" onClick={() => { setJsonImportOpen(false); setJsonImportPreview([]); setJsonImportError(''); }}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleJsonImport}
                disabled={!jsonImportText.trim()}
              >
                Import Questions
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ═══════════════════════════════════════════════════════════════════
            VIEW RESPONSES DIALOG
        ═══════════════════════════════════════════════════════════════════ */}
        <Dialog open={viewingAttempt !== null} onOpenChange={(open) => { if (!open) setViewingAttempt(null); }}>
          <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5 text-violet-500" />
                Student Responses
              </DialogTitle>
              <DialogDescription>
                {viewingAttempt?.student
                  ? `${viewingAttempt.student.lastName} ${viewingAttempt.student.firstName} (${viewingAttempt.student.studentId})`
                  : `Attempt #${viewingAttempt?.attemptNumber}`}
                {' · '}Score: {viewingAttempt?.score != null ? `${Math.round(viewingAttempt.score)}%` : '—'}
                {' · '}Points: {viewingAttempt?.totalPoints ?? '—'}/{viewingAttempt?.maxPoints ?? '—'}
              </DialogDescription>
            </DialogHeader>

            {viewingAttempt && (
              <div className="flex-1 overflow-y-auto space-y-3 pr-1 custom-scrollbar -mx-1 px-1">
                {(() => {
                  const answers = (viewingAttempt as Record<string, unknown>)?.answers as Array<{
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
                  }> | undefined;

                  if (!answers || answers.length === 0) {
                    return (
                      <div className="py-8 text-center text-sm text-muted-foreground">
                        No answers recorded for this attempt.
                      </div>
                    );
                  }

                  return answers.map((a, idx) => {
                    const q = a.question;
                    const isCorrect = (a.pointsEarned ?? 0) > 0;
                    const isShortAnswer = q.type === 'short_answer';
                    const options = q.options
                      ? (typeof q.options === 'string' ? JSON.parse(q.options) : q.options)
                      : null;

                    return (
                      <Card
                        key={a.id}
                        className={`shadow-sm border-l-4 ${
                          isCorrect
                            ? 'border-l-emerald-500'
                            : a.answer
                              ? 'border-l-red-500'
                              : 'border-l-amber-500'
                        }`}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1.5">
                                <span className="text-xs font-mono text-muted-foreground">Q{idx + 1}</span>
                                {questionTypeBadge(q.type)}
                                <span className="text-xs text-muted-foreground">
                                  {a.pointsEarned?.toFixed(1) ?? '0'}/{q.points.toFixed(1)} pts
                                </span>
                                {isShortAnswer && (
                                  <Badge className="bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800 text-[9px] gap-0.5">
                                    <Pencil className="h-2.5 w-2.5" /> Editable
                                  </Badge>
                                )}
                              </div>
                              <p className="text-sm font-medium mb-2">{q.text}</p>

                              {/* MCQ Options */}
                              {q.type === 'mcq' && options && (
                                <div className="space-y-1 mb-2">
                                  {options.map((opt: string, oi: number) => {
                                    const isCorrectOption = String(oi) === q.correctAnswer;
                                    const isStudentChoice = String(oi) === a.answer;
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
                                        {isStudentChoice && !isCorrectOption && ' ✗ Student'}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}

                              {/* True/False */}
                              {q.type === 'true_false' && (
                                <div className="flex gap-2 mb-2 text-xs">
                                  <span className={`px-2.5 py-1.5 rounded ${q.correctAnswer === 'true' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : a.answer === 'true' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : 'bg-muted/50'}`}>
                                    True {q.correctAnswer === 'true' && '✓'} {a.answer === 'true' && q.correctAnswer !== 'true' && '✗ Student'}
                                  </span>
                                  <span className={`px-2.5 py-1.5 rounded ${q.correctAnswer === 'false' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : a.answer === 'false' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : 'bg-muted/50'}`}>
                                    False {q.correctAnswer === 'false' && '✓'} {a.answer === 'false' && q.correctAnswer !== 'false' && '✗ Student'}
                                  </span>
                                </div>
                              )}

                              {/* Short Answer */}
                              {q.type === 'short_answer' && (
                                <div className="space-y-1.5 mb-2">
                                  <div className="text-xs">
                                    <span className="text-muted-foreground">Student answer: </span>
                                    <span className={isCorrect ? 'text-emerald-600 dark:text-emerald-400 font-medium' : 'text-red-600 dark:text-red-400 font-medium'}>
                                      {a.answer || '(none)'}
                                    </span>
                                  </div>
                                  {q.correctAnswer && (
                                    <div className="text-xs">
                                      <span className="text-muted-foreground">Expected answer: </span>
                                      <span className="text-emerald-600 dark:text-emerald-400 font-medium">{q.correctAnswer}</span>
                                    </div>
                                  )}
                                  {/* Grade edit input */}
                                  <div className="flex items-center gap-2 mt-2 pt-2 border-t border-border/50">
                                    <Label className="text-[10px] font-medium text-muted-foreground whitespace-nowrap">
                                      Points earned:
                                    </Label>
                                    <Input
                                      type="number"
                                      min="0"
                                      max={q.points}
                                      step="0.5"
                                      value={gradeEdits[a.id] !== undefined ? gradeEdits[a.id] : (a.pointsEarned ?? 0)}
                                      onChange={(e) => setGradeEdits(prev => ({ ...prev, [a.id]: e.target.value }))}
                                      className="h-7 w-20 text-xs"
                                    />
                                    <span className="text-[10px] text-muted-foreground">/ {q.points}</span>
                                  </div>
                                </div>
                              )}

                              {/* Not answered */}
                              {!a.answer && (
                                <div className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                                  <AlertTriangle className="h-3 w-3" /> Not answered
                                </div>
                              )}
                            </div>
                            <div className="shrink-0 mt-0.5">
                              {isCorrect ? (
                                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                              ) : a.answer ? (
                                <XCircle className="h-5 w-5 text-red-500" />
                              ) : (
                                <Minus className="h-5 w-5 text-amber-500" />
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  });
                })()}
              </div>
            )}

            <DialogFooter className="gap-2 pt-2 border-t">
              <Button variant="outline" size="sm" onClick={() => setViewingAttempt(null)}>
                Close
              </Button>
              {Object.keys(gradeEdits).length > 0 && viewingAttempt && resultsExamId && (
                <Button
                  size="sm"
                  onClick={async () => {
                    setSavingGrades(true);
                    try {
                      const grades = Object.entries(gradeEdits).map(([answerId, points]) => ({
                        answerId: parseInt(answerId),
                        pointsEarned: parseFloat(points) || 0,
                      }));
                      const res = await fetch(`/api/exams/${resultsExamId}/grade`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          attemptId: viewingAttempt.id,
                          grades,
                        }),
                      });
                      const data = await res.json();
                      if (!data.ok) {
                        toast.error(data.error || 'Failed to save grades');
                        return;
                      }
                      toast.success('Grades updated successfully');
                      // Update the attempt in the local state
                      const updatedAttempt = data.attempt;
                      setAttempts(prev => prev.map(a => a.id === updatedAttempt.id ? updatedAttempt : a));
                      setViewingAttempt(updatedAttempt);
                      setGradeEdits({});
                    } catch {
                      toast.error('Failed to save grades');
                    }
                    setSavingGrades(false);
                  }}
                  disabled={savingGrades}
                >
                  {savingGrades ? (
                    <RefreshCw className="h-3.5 w-3.5 animate-spin mr-1" />
                  ) : (
                    <Save className="h-3.5 w-3.5 mr-1" />
                  )}
                  {savingGrades ? 'Saving...' : 'Save Grades'}
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </motion.div>
    </div>
  );
}
