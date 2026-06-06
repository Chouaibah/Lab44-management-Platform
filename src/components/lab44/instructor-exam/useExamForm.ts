'use client';

import { useState, useMemo } from 'react';
import { toast } from 'sonner';
import type { Exam, ExamQuestion } from '@/types';
import { createEmptyQuestion, type QuestionForm } from './types';

interface UseExamFormReturn {
  // ── Form fields ──────────────────────────────────────────────────────────
  examTitle: string;         setExamTitle: (v: string) => void;
  examDescription: string;   setExamDescription: (v: string) => void;
  examDuration: string;      setExamDuration: (v: string) => void;
  examMaxAttempts: string;   setExamMaxAttempts: (v: string) => void;
  examPassingScore: string;  setExamPassingScore: (v: string) => void;
  examShuffle: boolean;      setExamShuffle: (v: boolean) => void;
  examShowResults: 'immediate' | 'manual'; setExamShowResults: (v: 'immediate' | 'manual') => void;
  examSousGroupeId: string;  setExamSousGroupeId: (v: string) => void;
  editingExamId: number | null;

  // ── Questions ────────────────────────────────────────────────────────────
  questions: QuestionForm[];
  expandedQuestion: number | null;
  totalPoints: number;
  setExpandedQuestion: (v: number | null) => void;
  setQuestions: (v: QuestionForm[]) => void;
  addQuestion: () => void;
  removeQuestion: (i: number) => void;
  updateQuestion: (i: number, field: keyof QuestionForm, value: unknown) => void;
  updateOption: (qIdx: number, oIdx: number, value: string) => void;
  addOption: (qIdx: number) => void;
  removeOption: (qIdx: number, oIdx: number) => void;
  moveQuestion: (i: number, dir: 'up' | 'down') => void;

  // ── Actions ──────────────────────────────────────────────────────────────
  saving: boolean;
  resetForm: () => void;
  loadExamForEdit: (exam: Exam) => Promise<boolean>;
  handleSave: (activeLabId: number, instructorId: number, onSuccess: () => void) => Promise<void>;
}

export function useExamForm(): UseExamFormReturn {
  const [examTitle, setExamTitle]               = useState('');
  const [examDescription, setExamDescription]   = useState('');
  const [examDuration, setExamDuration]         = useState('30');
  const [examMaxAttempts, setExamMaxAttempts]   = useState('1');
  const [examPassingScore, setExamPassingScore] = useState('');
  const [examShuffle, setExamShuffle]           = useState(false);
  const [examShowResults, setExamShowResults]   = useState<'immediate' | 'manual'>('immediate');
  const [examSousGroupeId, setExamSousGroupeId] = useState('');
  const [questions, setQuestions]               = useState<QuestionForm[]>([createEmptyQuestion(0)]);
  const [expandedQuestion, setExpandedQuestion] = useState<number | null>(0);
  const [editingExamId, setEditingExamId]       = useState<number | null>(null);
  const [saving, setSaving]                     = useState(false);

  const totalPoints = useMemo(
    () => questions.reduce((sum, q) => sum + (q.text.trim() ? q.points : 0), 0),
    [questions],
  );

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

  /** Fetch exam by id and populate form. Returns true on success. */
  const loadExamForEdit = async (exam: Exam): Promise<boolean> => {
    try {
      const res  = await fetch(`/api/exams/${exam.id}`);
      const data = await res.json();
      if (!data.ok || !data.exam) { toast.error('Failed to load exam details'); return false; }

      const e = data.exam;
      setEditingExamId(e.id);
      setExamTitle(e.title);
      setExamDescription(e.description || '');
      setExamDuration(String(e.durationMinutes));
      setExamMaxAttempts(String(e.maxAttempts));
      setExamPassingScore(e.passingScore != null ? String(e.passingScore) : '');
      setExamShuffle(e.shuffleQuestions);
      setExamShowResults(e.showResults);
      setExamSousGroupeId(e.sousGroupeId ? String(e.sousGroupeId) : '');

      const loaded: QuestionForm[] = (e.questions || []).map(
        (q: ExamQuestion & { options?: string | string[] | null }, i: number) => ({
          id: q.id,
          type: q.type as QuestionForm['type'],
          text: q.text,
          options: Array.isArray(q.options)
            ? q.options
            : typeof q.options === 'string'
              ? JSON.parse(q.options)
              : [],
          correctAnswer: q.correctAnswer || '',
          points: q.points,
          order: q.order ?? i,
        }),
      );
      setQuestions(loaded.length > 0 ? loaded : [createEmptyQuestion(0)]);
      setExpandedQuestion(0);
      return true;
    } catch {
      toast.error('Failed to load exam');
      return false;
    }
  };

  const handleSave = async (
    activeLabId: number,
    instructorId: number,
    onSuccess: () => void,
  ) => {
    if (!examTitle.trim()) { toast.error('Title is required'); return; }

    const validQuestions = questions.filter(q => q.text.trim());
    if (validQuestions.length === 0) { toast.error('At least one question is required'); return; }

    for (const q of validQuestions) {
      if (q.type === 'mcq' && q.options.filter(o => o.trim()).length < 2) {
        toast.error(`Question "${q.text.slice(0, 30)}..." needs at least 2 options`);
        return;
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
        instructorId,
        durationMinutes: parseInt(examDuration) || 30,
        shuffleQuestions: examShuffle,
        showResults: examShowResults,
        maxAttempts: parseInt(examMaxAttempts) || 1,
        passingScore: examPassingScore ? parseFloat(examPassingScore) : null,
        sousGroupeId: examSousGroupeId && examSousGroupeId !== 'all'
          ? parseInt(examSousGroupeId)
          : null,
        questions: validQuestions.map((q, i) => ({
          type: q.type,
          text: q.text.trim(),
          options: q.type === 'mcq' ? q.options : undefined,
          correctAnswer: q.correctAnswer,
          points: q.points,
          order: i,
        })),
      };

      const res = editingExamId
        ? await fetch(`/api/exams/${editingExamId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
        : await fetch('/api/exams', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });

      const data = await res.json();
      if (!data.ok) { toast.error(data.error || 'Failed to save exam'); return; }

      toast.success(editingExamId ? 'Exam updated' : 'Exam created');
      resetForm();
      onSuccess();
    } catch {
      toast.error('Connection error');
    } finally {
      setSaving(false);
    }
  };

  // ── Question mutation helpers ───────────────────────────────────────────

  const addQuestion = () => {
    setQuestions(prev => {
      const next = [...prev, createEmptyQuestion(prev.length)];
      setExpandedQuestion(prev.length);
      return next;
    });
  };

  const removeQuestion = (index: number) => {
    setQuestions(prev => {
      const next = prev.filter((_, i) => i !== index).map((q, i) => ({ ...q, order: i }));
      setExpandedQuestion(e => (e !== null && e >= next.length ? next.length - 1 : e));
      return next;
    });
  };

  const updateQuestion = (index: number, field: keyof QuestionForm, value: unknown) => {
    setQuestions(prev => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      if (field === 'type') {
        const t = value as QuestionForm['type'];
        next[index].options       = t === 'mcq' ? ['', '', '', ''] : [];
        next[index].correctAnswer = t === 'mcq' ? '0' : t === 'true_false' ? 'true' : '';
      }
      return next;
    });
  };

  const updateOption = (qIdx: number, oIdx: number, value: string) => {
    setQuestions(prev => {
      const next = [...prev];
      const opts = [...next[qIdx].options];
      opts[oIdx] = value;
      next[qIdx] = { ...next[qIdx], options: opts };
      return next;
    });
  };

  const addOption = (qIdx: number) => {
    setQuestions(prev => {
      const next = [...prev];
      next[qIdx] = { ...next[qIdx], options: [...next[qIdx].options, ''] };
      return next;
    });
  };

  const removeOption = (qIdx: number, oIdx: number) => {
    setQuestions(prev => {
      const next = [...prev];
      const opts = next[qIdx].options.filter((_, i) => i !== oIdx);
      const ca   = parseInt(next[qIdx].correctAnswer);
      const newCa = ca === oIdx ? '0' : ca > oIdx ? String(ca - 1) : String(ca);
      next[qIdx] = { ...next[qIdx], options: opts, correctAnswer: newCa };
      return next;
    });
  };

  const moveQuestion = (index: number, dir: 'up' | 'down') => {
    setQuestions(prev => {
      if (dir === 'up' && index === 0) return prev;
      if (dir === 'down' && index === prev.length - 1) return prev;
      const next    = [...prev];
      const swapIdx = dir === 'up' ? index - 1 : index + 1;
      [next[index], next[swapIdx]] = [next[swapIdx], next[index]];
      return next.map((q, i) => ({ ...q, order: i }));
    });
  };

  return {
    examTitle, setExamTitle,
    examDescription, setExamDescription,
    examDuration, setExamDuration,
    examMaxAttempts, setExamMaxAttempts,
    examPassingScore, setExamPassingScore,
    examShuffle, setExamShuffle,
    examShowResults, setExamShowResults,
    examSousGroupeId, setExamSousGroupeId,
    editingExamId,
    questions, expandedQuestion, totalPoints,
    setExpandedQuestion, setQuestions,
    addQuestion, removeQuestion, updateQuestion,
    updateOption, addOption, removeOption, moveQuestion,
    saving, resetForm, loadExamForEdit, handleSave,
  };
}
