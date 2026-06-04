'use client';

import React, { useRef } from 'react';
import { Upload, FileJson, Check, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { questionTypeBadge } from './helpers';
import { JSON_TEMPLATE } from './types';
import type { QuestionForm } from './types';
import type { useJsonImport } from './useJsonImport';

type ImportHook = ReturnType<typeof useJsonImport>;

interface JsonImportDialogProps {
  hook: ImportHook;
  currentQuestions: QuestionForm[];
  setQuestions: (q: QuestionForm[]) => void;
  setExpandedIdx: (i: number) => void;
}

export function JsonImportDialog({
  hook, currentQuestions, setQuestions, setExpandedIdx,
}: JsonImportDialogProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const {
    open, jsonText, mode, error, preview, showTemplate, copied,
    setOpen, setJsonText, setMode, setShowTemplate, close,
    handleFileUpload, handleImport, handleCopyTemplate,
  } = hook;

  return (
    <Dialog open={open} onOpenChange={v => (v ? setOpen(true) : close())}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileJson className="h-5 w-5 text-primary" />
            Import Questions from JSON
          </DialogTitle>
          <DialogDescription>
            Paste JSON or upload a .json file. Preview before importing.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Template toggle */}
          <div>
            <Button
              variant="ghost" size="sm"
              className="gap-1.5 text-xs h-7 text-muted-foreground"
              onClick={() => setShowTemplate(!showTemplate)}
            >
              {showTemplate ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              {showTemplate ? 'Hide' : 'Show'} JSON template &amp; guide
            </Button>

            {showTemplate && (
              <div className="mt-2 relative">
                <pre className="text-[11px] bg-muted/50 border rounded-lg p-3 overflow-x-auto font-mono text-muted-foreground max-h-52">
                  {JSON_TEMPLATE}
                </pre>
                <Button
                  size="sm" variant="outline"
                  className="absolute top-2 right-2 gap-1.5 text-xs h-7"
                  onClick={() => handleCopyTemplate(JSON_TEMPLATE)}
                >
                  {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <FileJson className="h-3.5 w-3.5" />}
                  {copied ? 'Copied!' : 'Copy'}
                </Button>
              </div>
            )}
          </div>

          {/* Upload */}
          <div className="flex items-center gap-2">
            <input
              ref={fileRef}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={handleFileUpload}
            />
            <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8" onClick={() => fileRef.current?.click()}>
              <Upload className="h-3.5 w-3.5" /> Upload .json file
            </Button>
            <span className="text-xs text-muted-foreground">or paste below</span>
          </div>

          {/* JSON textarea */}
          <div>
            <Label className="text-xs font-medium mb-1 block">JSON Content</Label>
            <Textarea
              value={jsonText}
              onChange={e => setJsonText(e.target.value)}
              placeholder='[{ "type": "mcq", "text": "...", "options": [...], "correctAnswer": "A", "points": 1 }]'
              className="font-mono text-xs min-h-[120px] resize-y"
            />
          </div>

          {/* Import mode */}
          <div className="flex items-center gap-3">
            <Label className="text-xs font-medium shrink-0">Import mode:</Label>
            <Select value={mode} onValueChange={v => setMode(v as 'replace' | 'append')}>
              <SelectTrigger className="h-8 text-xs w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="append">Add to existing questions</SelectItem>
                <SelectItem value="replace">Replace all questions</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Error */}
          {error && (
            <Alert variant="destructive" className="py-2">
              <AlertDescription className="text-xs">{error}</AlertDescription>
            </Alert>
          )}

          {/* Preview */}
          {preview.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label className="text-xs font-medium">Preview</Label>
                <Badge variant="outline" className="text-[10px]">{preview.length} questions found</Badge>
              </div>
              <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1 custom-scrollbar">
                {preview.map((q, i) => (
                  <div key={i} className="flex items-start gap-2 p-2 bg-muted/40 rounded-lg">
                    <span className="text-[10px] font-mono text-muted-foreground mt-0.5 shrink-0">{i + 1}.</span>
                    {questionTypeBadge(q.type)}
                    <span className="text-xs flex-1 line-clamp-2">{q.text}</span>
                    <Badge variant="outline" className="text-[10px] shrink-0">{q.points}pt</Badge>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            <Button variant="ghost" size="sm" onClick={close}>Cancel</Button>
            <Button
              size="sm"
              disabled={!jsonText.trim() || !!error}
              onClick={() => handleImport(currentQuestions, setQuestions, setExpandedIdx)}
            >
              Import Questions
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
