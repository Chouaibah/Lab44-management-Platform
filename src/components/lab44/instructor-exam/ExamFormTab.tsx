'use client';

import React from 'react';
import { ArrowLeft, Save, Plus, Upload, FileJson, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { SousGroupe } from '@/types';
import type { QuestionForm } from './types';
import { QuestionBuilder } from './QuestionBuilder';
import type { useExamForm } from './useExamForm';

type FormHook = ReturnType<typeof useExamForm>;

interface ExamFormTabProps {
  form: FormHook;
  sousGroupes: SousGroupe[];
  onBack: () => void;
  onSave: () => void;
  onOpenJsonImport: () => void;
}

export function ExamFormTab({
  form, sousGroupes, onBack, onSave, onOpenJsonImport,
}: ExamFormTabProps) {
  const {
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
    setExpandedQuestion,
    addQuestion, removeQuestion, updateQuestion,
    updateOption, addOption, removeOption, moveQuestion,
    saving,
  } = form;

  return (
    <div className="space-y-4">
      {/* ── Header bar ── */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" className="gap-1.5" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
          Back to exams
        </Button>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="font-mono text-xs">
            {totalPoints} pts · {questions.filter(q => q.text.trim()).length} Q
          </Badge>
          <Button size="sm" onClick={onSave} disabled={saving} className="gap-1.5">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {editingExamId ? 'Update Exam' : 'Create Exam'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* ── Settings panel ── */}
        <Card className="lg:col-span-1 h-fit shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Exam Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">
                Title <span className="text-red-500">*</span>
              </Label>
              <Input
                value={examTitle}
                onChange={e => setExamTitle(e.target.value)}
                placeholder="e.g. Midterm – Networks"
                className="h-8 text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Description</Label>
              <Textarea
                value={examDescription}
                onChange={e => setExamDescription(e.target.value)}
                placeholder="Optional instructions…"
                rows={3}
                className="text-sm resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Duration (min)</Label>
                <Input
                  type="number" min="1" max="480"
                  value={examDuration}
                  onChange={e => setExamDuration(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Max Attempts</Label>
                <Input
                  type="number" min="1" max="10"
                  value={examMaxAttempts}
                  onChange={e => setExamMaxAttempts(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Passing Score (%)</Label>
              <Input
                type="number" min="0" max="100"
                value={examPassingScore}
                onChange={e => setExamPassingScore(e.target.value)}
                placeholder="e.g. 60"
                className="h-8 text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Show Results To</Label>
              <Select value={examShowResults} onValueChange={v => setExamShowResults(v as 'immediate' | 'manual')}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="immediate">Immediately after submit</SelectItem>
                  <SelectItem value="manual">Only when I release</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Group Filter</Label>
              <Select value={examSousGroupeId || 'all'} onValueChange={setExamSousGroupeId}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All groups</SelectItem>
                  {sousGroupes.map(sg => (
                    <SelectItem key={sg.id} value={String(sg.id)}>
                      {sg.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium">Shuffle Questions</Label>
              <Switch
                checked={examShuffle}
                onCheckedChange={setExamShuffle}
              />
            </div>
          </CardContent>
        </Card>

        {/* ── Question builder panel ── */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium">
              Questions{' '}
              <span className="text-muted-foreground font-normal">
                ({questions.filter(q => q.text.trim()).length} valid)
              </span>
            </h3>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs" onClick={onOpenJsonImport}>
                <FileJson className="h-3.5 w-3.5" /> Import JSON
              </Button>
              <Button size="sm" className="gap-1.5 h-8 text-xs" onClick={addQuestion}>
                <Plus className="h-3.5 w-3.5" /> Add Question
              </Button>
            </div>
          </div>

          <div className="space-y-2 max-h-[calc(100vh-22rem)] overflow-y-auto pr-1 custom-scrollbar">
            {questions.map((q, i) => (
              <QuestionBuilder
                key={i}
                question={q}
                index={i}
                total={questions.length}
                expanded={expandedQuestion === i}
                onToggle={() => setExpandedQuestion(expandedQuestion === i ? null : i)}
                onUpdate={(field, val) => updateQuestion(i, field, val)}
                onUpdateOption={(oIdx, val) => updateOption(i, oIdx, val)}
                onAddOption={() => addOption(i)}
                onRemoveOption={oIdx => removeOption(i, oIdx)}
                onMove={dir => moveQuestion(i, dir)}
                onRemove={() => removeQuestion(i)}
              />
            ))}
          </div>

          <Button variant="ghost" size="sm" className="w-full border-dashed border gap-1.5 text-xs" onClick={addQuestion}>
            <Plus className="h-3.5 w-3.5" /> Add another question
          </Button>
        </div>
      </div>
    </div>
  );
}
