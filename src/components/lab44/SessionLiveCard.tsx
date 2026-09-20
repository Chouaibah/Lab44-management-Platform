'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { DoorOpen, ArrowRight, CheckCircle2, RefreshCw } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

/**
 * "Session Live" indicator — the exact card used by the instructor attendance
 * view (cyan icon tile + DoorOpen + "Session Live" title). Reused by the student
 * attendance view and /student-choice so an open attendance session looks the
 * same everywhere.
 *
 * - Pass `onClick`     → card becomes a tappable shortcut (adds chevron + hover).
 * - Pass `onMark`      → renders the "Mark Present" button (hidden when `marked`).
 */
export interface SessionLiveCardProps {
  /** Session date shown in the subtitle when `subtitle` is not provided. */
  date?: string | null;
  /** Replaces the default subtitle line. */
  subtitle?: React.ReactNode;
  /** Student already marked present for this session. */
  marked?: boolean;
  /** Mark request in flight. */
  marking?: boolean;
  /** Show the "Mark Present" action when provided and not yet marked. */
  onMark?: () => void;
  /** Makes the whole card actionable (navigates to the attendance view). */
  onClick?: () => void;
  className?: string;
  /** Animate entry/exit (used by the student attendance view). */
  animated?: boolean;
}

export function SessionLiveCard({
  date,
  subtitle,
  marked = false,
  marking = false,
  onMark,
  onClick,
  className = 'mb-6',
  animated = false,
}: SessionLiveCardProps) {
  const card = (
    <Card
      className={`shadow-sm ${onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''} ${animated ? '' : className}`}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-100 dark:bg-cyan-900/30 relative">
              <DoorOpen className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
              {!marked && (
                <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
                  <span
                    className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"
                    style={{ animationDuration: '1.5s' }}
                  />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-cyan-500" />
                </span>
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold">Session Live</h3>
                {marked ? (
                  <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-400 dark:border-emerald-800 text-[10px] px-1.5 py-0">
                    <CheckCircle2 className="h-3 w-3 mr-0.5" /> Confirmed
                  </Badge>
                ) : (
                  <Badge className="bg-cyan-100 text-cyan-700 border-cyan-200 dark:bg-cyan-900/40 dark:text-cyan-400 dark:border-cyan-800 text-[10px] px-1.5 py-0 animate-pulse">
                    LIVE
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {subtitle ?? date}
              </p>
            </div>
          </div>

          {onMark && !marked && (
            <Button
              onClick={(e) => {
                e.stopPropagation();
                onMark();
              }}
              disabled={marking}
              size="sm"
              className="gap-2 shadow-sm"
            >
              {marking ? <RefreshCw className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              {marking ? 'Marking...' : 'Mark Present'}
            </Button>
          )}

          {!onMark && onClick && <ArrowRight className="h-4 w-4 text-cyan-500 shrink-0" />}
        </div>
      </CardContent>
    </Card>
  );

  if (!animated) return card;

  return (
    <motion.div
      key="session-live"
      initial={{ opacity: 0, y: -10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.98 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className={className}
    >
      {card}
    </motion.div>
  );
}

export default SessionLiveCard;
