'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { useLab44Store } from '@/store/lab44';
import type { Announcement } from '@/types';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';

import {
  Megaphone, RefreshCw, Pin, ThumbsUp, ThumbsDown,
  HelpCircle, CheckCheck, Loader2,
} from 'lucide-react';

import { fadeSlide, BreadcrumbNav, EmptyState, timeAgo, fmtDate } from '@/lib/helpers';

const REACTION_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string; activeBg: string }> = {
  thumbs_up: { label: 'Like', icon: <ThumbsUp className="h-3.5 w-3.5" />, color: 'text-emerald-600 dark:text-emerald-400', activeBg: 'bg-emerald-100 dark:bg-emerald-900/30' },
  acknowledged: { label: 'OK', icon: <CheckCheck className="h-3.5 w-3.5" />, color: 'text-blue-600 dark:text-blue-400', activeBg: 'bg-blue-100 dark:bg-blue-900/30' },
  thumbs_down: { label: 'Dislike', icon: <ThumbsDown className="h-3.5 w-3.5" />, color: 'text-red-600 dark:text-red-400', activeBg: 'bg-red-100 dark:bg-red-900/30' },
  question: { label: 'Question', icon: <HelpCircle className="h-3.5 w-3.5" />, color: 'text-amber-600 dark:text-amber-400', activeBg: 'bg-amber-100 dark:bg-amber-900/30' },
};

export default function StudentAnnouncementsView() {
  const { auth, studentLabs, labs, setView } = useLab44Store();
  const student = auth.student;

  const [selectedLabId, setSelectedLabId] = useState<string>('');
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);

  // Set default lab
  useEffect(() => {
    if (!selectedLabId && studentLabs.length > 0) {
      setSelectedLabId(String(studentLabs[0].labId));
    }
  }, [studentLabs, selectedLabId]);

  // Fetch announcements when lab changes
  useEffect(() => {
    if (!selectedLabId) { setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const res = await fetch(`/api/announcements?labId=${selectedLabId}`);
        if (res.ok) {
          const data = await res.json();
          if (!cancelled) setAnnouncements(data);
        } else {
          const data = await res.json();
          if (!cancelled) toast.error(data.error || 'Failed to load announcements');
        }
      } catch {
        if (!cancelled) toast.error('Network error');
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [selectedLabId]);

  const handleRefresh = async () => {
    if (!selectedLabId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/announcements?labId=${selectedLabId}`);
      if (res.ok) {
        const data = await res.json();
        setAnnouncements(data);
      }
    } catch {
      toast.error('Failed to refresh');
    }
    setLoading(false);
  };

  const handleReaction = async (announcementId: number, reaction: string) => {
    const ann = announcements.find(a => a.id === announcementId);
    if (!ann) return;

    // Optimistic update
    const oldReaction = ann.userReaction;
    const newReaction = oldReaction === reaction ? null : reaction;

    setAnnouncements(prev => prev.map(a => {
      if (a.id !== announcementId) return a;
      const counts = { ...(a.reactionCounts || {}) };
      // Decrement old
      if (oldReaction && counts[oldReaction]) {
        counts[oldReaction] = counts[oldReaction] - 1;
        if (counts[oldReaction] <= 0) delete counts[oldReaction];
      }
      // Increment new
      if (newReaction) {
        counts[newReaction] = (counts[newReaction] || 0) + 1;
      }
      return { ...a, reactionCounts: counts, userReaction: newReaction };
    }));

    try {
      if (newReaction) {
        await fetch(`/api/announcements/${announcementId}/reactions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reaction: newReaction }),
        });
      } else {
        await fetch(`/api/announcements/${announcementId}/reactions/${student?.id}`, {
          method: 'DELETE',
        });
      }
    } catch {
      toast.error('Failed to update reaction');
      // Revert
      setAnnouncements(prev => prev.map(a => {
        if (a.id !== announcementId) return a;
        const counts = { ...(a.reactionCounts || {}) };
        if (newReaction && counts[newReaction]) {
          counts[newReaction] = counts[newReaction] - 1;
          if (counts[newReaction] <= 0) delete counts[newReaction];
        }
        if (oldReaction) {
          counts[oldReaction] = (counts[oldReaction] || 0) + 1;
        }
        return { ...a, reactionCounts: counts, userReaction: oldReaction };
      }));
    }
  };

  const enrolledLabs = labs.filter(lab => studentLabs.some(sl => sl.labId === lab.id && sl.studentId === student?.id));

  if (!student) return null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <motion.div {...fadeSlide}>
        <div className="flex items-center gap-3 mb-6 flex-wrap">
          <BreadcrumbNav items={[{ label: 'Dashboard', view: 'student-choice' }, { label: 'Announcements' }]} />
          <div className="ml-auto flex items-center gap-2">
            {enrolledLabs.length > 1 && (
              <select
                className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                value={selectedLabId}
                onChange={e => setSelectedLabId(e.target.value)}
              >
                {enrolledLabs.map(lab => (
                  <option key={lab.id} value={lab.id}>{lab.name}</option>
                ))}
              </select>
            )}
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={handleRefresh} title="Refresh">
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {!selectedLabId ? (
          <EmptyState
            icon={Megaphone}
            title="No Labs Enrolled"
            description="You need to be enrolled in a lab to see announcements."
          />
        ) : loading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
          </div>
        ) : announcements.length === 0 ? (
          <EmptyState
            icon={Megaphone}
            title="No Announcements"
            description="Your instructor hasn't posted any announcements yet."
          />
        ) : (
          <div className="space-y-4">
            {announcements.map(ann => (
              <Card key={ann.id} className={`shadow-sm ${ann.pinned ? 'border-amber-300 dark:border-amber-700' : ''}`}>
                <CardContent className="p-5">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        {ann.pinned && (
                          <Badge variant="outline" className="gap-1 text-[10px] border-amber-300 text-amber-700 dark:border-amber-700 dark:text-amber-400">
                            <Pin className="h-2.5 w-2.5" /> Pinned
                          </Badge>
                        )}
                        <h3 className="font-semibold text-sm">{ann.title}</h3>
                      </div>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap mt-1">{ann.content}</p>
                      <div className="flex items-center gap-3 mt-3 text-xs text-muted-foreground">
                        <span>By: {ann.author}</span>
                        <span>•</span>
                        <span>{fmtDate(ann.createdAt)}</span>
                      </div>

                      <Separator className="my-3" />

                      {/* Reaction buttons */}
                      <div className="flex items-center gap-2 flex-wrap">
                        {Object.entries(REACTION_CONFIG).map(([key, cfg]) => {
                          const count = ann.reactionCounts?.[key] || 0;
                          const isActive = ann.userReaction === key;
                          return (
                            <button
                              key={key}
                              type="button"
                              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-all border ${
                                isActive
                                  ? `${cfg.activeBg} ${cfg.color} border-current/20`
                                  : 'border-transparent text-muted-foreground hover:bg-muted/50'
                              }`}
                              onClick={() => handleReaction(ann.id, key)}
                            >
                              {cfg.icon}
                              {count > 0 && <span>{count}</span>}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
}
