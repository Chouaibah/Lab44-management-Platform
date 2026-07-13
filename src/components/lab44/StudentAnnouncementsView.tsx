'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { useLab44Store } from '@/store/lab44';
import type { Announcement } from '@/types';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

import { Megaphone, RefreshCw } from 'lucide-react';

import { fadeSlide, BreadcrumbNav, EmptyState, timeAgo, fmtDate } from '@/lib/helpers';

export default function StudentAnnouncementsView() {
  const { auth, studentLabs, labs } = useLab44Store();
  const student = auth.student;

  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch announcements from all enrolled labs
  useEffect(() => {
    if (!student || studentLabs.length === 0) { setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const all: Announcement[] = [];
        for (const sl of studentLabs) {
          const res = await fetch(`/api/announcements?labId=${sl.labId}`);
          if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data)) {
              for (const ann of data) all.push({ ...ann, labId: ann.labId || sl.labId });
            }
          }
        }
        if (!cancelled) {
          // Sort newest first, deduplicate by id
          const seen = new Set<number>();
          const sorted = all
            .filter(a => { if (seen.has(a.id)) return false; seen.add(a.id); return true; })
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          setAnnouncements(sorted);
        }
      } catch {
        if (!cancelled) toast.error('Failed to load announcements');
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [student, studentLabs]);

  const handleRefresh = async () => {
    if (!student || studentLabs.length === 0) return;
    setLoading(true);
    try {
      const all: Announcement[] = [];
      for (const sl of studentLabs) {
        const res = await fetch(`/api/announcements?labId=${sl.labId}`);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) {
            for (const ann of data) all.push({ ...ann, labId: ann.labId || sl.labId });
          }
        }
      }
      const seen = new Set<number>();
      const sorted = all
        .filter(a => { if (seen.has(a.id)) return false; seen.add(a.id); return true; })
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setAnnouncements(sorted);
    } catch {
      toast.error('Failed to refresh');
    }
    setLoading(false);
  };

  const getLabName = (labId: number | null) => {
    if (!labId) return null;
    return labs.find(l => l.id === labId)?.name || null;
  };

  if (!student) return null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <motion.div {...fadeSlide}>
        <div className="flex items-center gap-3 mb-6 flex-wrap">
          <BreadcrumbNav items={[{ label: 'Dashboard', view: 'student-choice' }, { label: 'Announcements' }]} />
          <div className="ml-auto">
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={handleRefresh} title="Refresh">
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
          </div>
        ) : announcements.length === 0 ? (
          <EmptyState
            icon={Megaphone}
            title="No Announcements"
            description="Your instructors haven't posted any announcements yet."
          />
        ) : (
          <div className="space-y-4">
            {announcements.map(ann => {
              const labName = getLabName(ann.labId);
              return (
                <Card key={ann.id} className="shadow-sm">
                  <CardContent className="p-5">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h3 className="font-semibold text-sm">{ann.title}</h3>
                        {labName && (
                          <span className="text-[10px] text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded">
                            {labName}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap mt-1">{ann.content}</p>
                      <div className="flex items-center gap-3 mt-3 text-xs text-muted-foreground">
                        <span>By: {ann.author}</span>
                        <span>•</span>
                        <span>{fmtDate(ann.createdAt)}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </motion.div>
    </div>
  );
}
