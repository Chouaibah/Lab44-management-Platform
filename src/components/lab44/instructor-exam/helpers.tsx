import React from 'react';
import { Badge } from '@/components/ui/badge';

export function examStatusBadge(status: string) {
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

export function questionTypeBadge(type: string) {
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

export function formatTimeSpent(seconds: number | null): string {
  if (!seconds) return '—';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

export function formatRemainingTime(
  publishedAt: string | null,
  durationMinutes: number,
): { text: string; expired: boolean; minutes: number } {
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
