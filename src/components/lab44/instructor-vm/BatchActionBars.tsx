'use client';

import React from 'react';
import { motion } from 'framer-motion';
import {
  ListChecks, Server, Check, X, Play, Square,
  RotateCcw, Trash2, Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

// ─── Pending batch action bar ─────────────────────────────────────────────────

interface PendingBatchBarProps {
  count: number;
  loading: boolean;
  onApprove: () => void;
  onRejectOpen: () => void;
  onCancel: () => void;
}

export function PendingBatchBar({
  count, loading, onApprove, onRejectOpen, onCancel,
}: PendingBatchBarProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="sticky bottom-4 z-50 flex items-center gap-3 rounded-xl border bg-background/95 backdrop-blur-sm shadow-lg px-5 py-3 mb-6"
    >
      <ListChecks className="h-5 w-5 text-amber-500 shrink-0" />
      <span className="text-sm font-medium">{count} selected</span>

      <div className="flex items-center gap-2 ml-auto">
        <Button
          size="sm" className="h-8 gap-1.5"
          disabled={loading}
          onClick={onApprove}
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
          Approve Selected
        </Button>
        <Button
          size="sm" variant="destructive" className="h-8 gap-1.5"
          disabled={loading}
          onClick={onRejectOpen}
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
          Reject Selected
        </Button>
        <Button size="sm" variant="outline" className="h-8" disabled={loading} onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </motion.div>
  );
}

// ─── Approved VMs batch action bar ────────────────────────────────────────────

interface ApprovedBatchBarProps {
  count: number;
  loading: boolean;
  onAction: (action: 'start' | 'stop' | 'reboot') => void;
  onDeleteOpen: () => void;
  onCancel: () => void;
}

export function ApprovedBatchBar({
  count, loading, onAction, onDeleteOpen, onCancel,
}: ApprovedBatchBarProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="sticky bottom-4 z-50 flex items-center gap-3 rounded-xl border bg-background/95 backdrop-blur-sm shadow-lg px-5 py-3 mb-6"
    >
      <Server className="h-5 w-5 text-emerald-500 shrink-0" />
      <span className="text-sm font-medium">
        {count} VM{count !== 1 ? 's' : ''} selected
      </span>

      <div className="flex items-center gap-2 ml-auto">
        <Button
          size="sm" className="h-8 gap-1.5 bg-emerald-600 hover:bg-emerald-700"
          disabled={loading} onClick={() => onAction('start')}
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
          Start
        </Button>
        <Button
          size="sm" className="h-8 gap-1.5 bg-amber-600 hover:bg-amber-700"
          disabled={loading} onClick={() => onAction('stop')}
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Square className="h-3.5 w-3.5" />}
          Stop
        </Button>
        <Button
          size="sm" className="h-8 gap-1.5"
          disabled={loading} onClick={() => onAction('reboot')}
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
          Reboot
        </Button>
        <Button
          size="sm" variant="destructive" className="h-8 gap-1.5"
          disabled={loading} onClick={onDeleteOpen}
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
          Delete
        </Button>
        <Button size="sm" variant="outline" className="h-8" disabled={loading} onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </motion.div>
  );
}
