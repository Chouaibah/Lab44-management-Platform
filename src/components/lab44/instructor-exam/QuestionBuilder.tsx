'use client';

import React from 'react';
import {
  ChevronDown, ChevronUp, Trash2, GripVertical,
  Plus, X, ArrowUp, ArrowDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { questionTypeBadge } from './helpers';
import type { QuestionForm } from './types';

interface QuestionBuilderProps {
  question: QuestionForm;
  index: number;
  total: number;
  expanded: boolean;
  onToggle: () => void;
  onUpdate: (field: keyof QuestionForm, value: unknown) => void;
  onUpdateOption: (oIdx: number, value: string) => void;
  onAddOption: () => void;
  onRemoveOption: (oIdx: number) => void;
  onMove: (dir: 'up' | 'down') => void;
  onRemove: () => void;
}

export function QuestionBuilder({
  question, index, total, expanded, onToggle,
  onUpdate, onUpdateOption, onAddOption, onRemoveOption,
  onMove, onRemove,
}: QuestionBuilderProps) {
  const isValid = question.text.trim().length > 0;

  return (
    <div className={`border rounded-xl transition-all duration-200 ${
      expanded ? 'border-primary/40 shadow-md' : 'border-border'
    } ${!isValid && !expanded ? 'border-dashed opacity-60' : ''}`}>
      {/* ── Collapsed header ── */}
      <button
        className="w-full flex items-center gap-2 p-3 text-left hover:bg-muted/30 rounded-xl transition-colors"
        onClick={onToggle}
      >
        <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className="text-xs font-mono text-muted-foreground w-5 shrink-0">{index + 1}.</span>

        <div className="flex-1 min-w-0 flex items-center gap-2">
          {questionTypeBadge(question.type)}
          <span className="text-sm truncate">
            {question.text.trim() || <span className="text-muted-foreground italic">Empty question</span>}
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <Badge variant="outline" className="text-[10px] font-mono">{question.points}pt{question.points !== 1 ? 's' : ''}</Badge>
          {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </button>

      {/* ── Expanded editor ── */}
      {expanded && (
        <div className="px-4 pb-4 space-y-4 border-t border-border/50">
          {/* Row: type + points + move + delete */}
          <div className="flex items-center gap-2 pt-3 flex-wrap">
            <Select value={question.type} onValueChange={v => onUpdate('type', v)}>
              <SelectTrigger className="h-8 w-40 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mcq">Multiple Choice</SelectItem>
                <SelectItem value="true_false">True / False</SelectItem>
                <SelectItem value="short_answer">Short Answer</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex items-center gap-1">
              <Label className="text-xs text-muted-foreground">Points:</Label>
              <Input
                type="number" min="1" max="100"
                value={question.points}
                onChange={e => onUpdate('points', Math.max(1, parseInt(e.target.value) || 1))}
                className="h-8 w-16 text-xs text-center"
              />
            </div>

            <div className="flex gap-1 ml-auto">
              <Button variant="ghost" size="icon" className="h-7 w-7" disabled={index === 0} onClick={() => onMove('up')}>
                <ArrowUp className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" disabled={index === total - 1} onClick={() => onMove('down')}>
                <ArrowDown className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost" size="icon"
                className="h-7 w-7 hover:bg-red-100 dark:hover:bg-red-950/30"
                onClick={onRemove}
              >
                <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-red-600" />
              </Button>
            </div>
          </div>

          {/* Question text */}
          <div>
            <Label className="text-xs font-medium mb-1 block">
              Question <span className="text-red-500">*</span>
            </Label>
            <Textarea
              placeholder="Type your question here…"
              value={question.text}
              onChange={e => onUpdate('text', e.target.value)}
              className="text-sm resize-none min-h-[72px]"
              rows={3}
            />
          </div>

          {/* MCQ options */}
          {question.type === 'mcq' && (
            <div className="space-y-2">
              <Label className="text-xs font-medium">Answer Options</Label>
              {question.options.map((opt, oIdx) => (
                <div key={oIdx} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name={`correct-${index}`}
                    checked={question.correctAnswer === String(oIdx)}
                    onChange={() => onUpdate('correctAnswer', String(oIdx))}
                    className="h-4 w-4 shrink-0 accent-primary"
                    title="Mark as correct answer"
                  />
                  <span className="text-xs font-mono text-muted-foreground w-5 shrink-0">
                    {String.fromCharCode(65 + oIdx)}.
                  </span>
                  <Input
                    value={opt}
                    onChange={e => onUpdateOption(oIdx, e.target.value)}
                    placeholder={`Option ${String.fromCharCode(65 + oIdx)}`}
                    className="h-8 text-xs flex-1"
                  />
                  {question.options.length > 2 && (
                    <Button
                      variant="ghost" size="icon" className="h-7 w-7 shrink-0"
                      onClick={() => onRemoveOption(oIdx)}
                    >
                      <X className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                  )}
                </div>
              ))}
              {question.options.length < 8 && (
                <Button variant="ghost" size="sm" className="text-xs gap-1 h-7" onClick={onAddOption}>
                  <Plus className="h-3.5 w-3.5" /> Add Option
                </Button>
              )}
              <p className="text-[11px] text-muted-foreground">
                Click a radio button to set the correct answer.
              </p>
            </div>
          )}

          {/* True / False */}
          {question.type === 'true_false' && (
            <div className="space-y-2">
              <Label className="text-xs font-medium">Correct Answer</Label>
              <div className="flex gap-3">
                {(['true', 'false'] as const).map(v => (
                  <label key={v} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name={`tf-${index}`}
                      checked={question.correctAnswer === v}
                      onChange={() => onUpdate('correctAnswer', v)}
                      className="h-4 w-4 accent-primary"
                    />
                    <span className={`text-sm font-medium ${
                      v === 'true' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
                    }`}>
                      {v === 'true' ? '✓ True' : '✗ False'}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Short answer */}
          {question.type === 'short_answer' && (
            <div className="space-y-1">
              <Label className="text-xs font-medium">Correct Answer (for auto-grading)</Label>
              <Input
                value={question.correctAnswer}
                onChange={e => onUpdate('correctAnswer', e.target.value)}
                placeholder="Expected answer…"
                className="text-xs h-8"
              />
              <p className="text-[11px] text-muted-foreground">
                Leave blank to grade manually.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
