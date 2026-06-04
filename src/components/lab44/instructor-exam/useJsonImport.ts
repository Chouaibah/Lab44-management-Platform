'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { parseQuestionsJson } from './parseJson';
import type { QuestionForm } from './types';

interface UseJsonImportReturn {
  open: boolean;
  jsonText: string;
  mode: 'replace' | 'append';
  error: string;
  preview: QuestionForm[];
  showTemplate: boolean;
  copied: boolean;

  setOpen: (v: boolean) => void;
  setJsonText: (v: string) => void;
  setMode: (v: 'replace' | 'append') => void;
  setShowTemplate: (v: boolean) => void;
  close: () => void;

  handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleImport: (currentQuestions: QuestionForm[], setQuestions: (q: QuestionForm[]) => void, setExpandedIdx: (i: number) => void) => void;
  handleCopyTemplate: (templateText: string) => void;
}

export function useJsonImport(): UseJsonImportReturn {
  const [open, setOpen]               = useState(false);
  const [jsonText, setJsonTextRaw]    = useState('');
  const [mode, setMode]               = useState<'replace' | 'append'>('append');
  const [error, setError]             = useState('');
  const [preview, setPreview]         = useState<QuestionForm[]>([]);
  const [showTemplate, setShowTemplate] = useState(false);
  const [copied, setCopied]           = useState(false);

  const setJsonText = (v: string) => {
    setJsonTextRaw(v);
    setError('');
    setPreview([]);
  };

  const close = () => {
    setOpen(false);
    setJsonTextRaw('');
    setError('');
    setPreview([]);
  };

  const parseAndPreview = (text: string) => {
    const result = parseQuestionsJson(text);
    if (result.error) {
      setError(result.error);
      setPreview([]);
    } else {
      setPreview(result.questions);
      setError('');
    }
    return result;
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith('.json') && file.type !== 'application/json') {
      setError('Please upload a .json file');
      return;
    }
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result;
      if (typeof text === 'string') {
        setJsonTextRaw(text);
        parseAndPreview(text);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleImport = (
    currentQuestions: QuestionForm[],
    setQuestions: (q: QuestionForm[]) => void,
    setExpandedIdx: (i: number) => void,
  ) => {
    const result = parseAndPreview(jsonText);
    if (result.error || result.questions.length === 0) return;

    const imported = result.questions;
    if (mode === 'replace') {
      setQuestions(imported);
      setExpandedIdx(0);
    } else {
      setQuestions([...currentQuestions, ...imported]);
      setExpandedIdx(currentQuestions.length);
    }

    toast.success(`Imported ${imported.length} question${imported.length !== 1 ? 's' : ''}`);
    close();
  };

  const handleCopyTemplate = (templateText: string) => {
    // Use Clipboard API if available (requires HTTPS), fall back to execCommand
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(templateText).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }).catch(() => fallbackCopy(templateText));
    } else {
      fallbackCopy(templateText);
    }
  };

  const fallbackCopy = (text: string) => {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    try {
      document.execCommand('copy');
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* ignore */ }
    document.body.removeChild(ta);
  };

  return {
    open, jsonText, mode, error, preview, showTemplate, copied,
    setOpen, setJsonText, setMode, setShowTemplate, close,
    handleFileUpload, handleImport, handleCopyTemplate,
  };
}
