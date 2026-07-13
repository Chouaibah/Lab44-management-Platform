'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { useLab44Store } from '@/store/lab44';
import type { Announcement, AnnouncementReaction } from '@/types';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import {
  Card, CardContent,
} from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

import {
  Megaphone, RefreshCw, Plus, Pencil, Trash2, Pin, CheckCircle2,
  ThumbsUp, ThumbsDown, HelpCircle, CheckCheck, Eye, Users, UserX, Loader2,
  Archive, ArchiveRestore,
} from 'lucide-react';

import {
  fadeSlide, BreadcrumbNav, EmptyState, timeAgo, StudentAvatar,
} from '@/lib/helpers';

const REACTION_DISPLAY: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  thumbs_up: { label: 'Like', icon: <ThumbsUp className="h-3.5 w-3.5" />, color: 'text-emerald-600 dark:text-emerald-400' },
  acknowledged: { label: 'Acknowledged', icon: <CheckCheck className="h-3.5 w-3.5" />, color: 'text-blue-600 dark:text-blue-400' },
  thumbs_down: { label: 'Dislike', icon: <ThumbsDown className="h-3.5 w-3.5" />, color: 'text-red-600 dark:text-red-400' },
  question: { label: 'Question', icon: <HelpCircle className="h-3.5 w-3.5" />, color: 'text-amber-600 dark:text-amber-400' },
  seen: { label: 'Seen', icon: <Eye className="h-3.5 w-3.5" />, color: 'text-gray-600 dark:text-gray-400' },
};

export default function InstructorAnnouncementsView() {
  const { auth, students, studentLabs, selectedLabId, labs } = useLab44Store();
  const instructor = auth.instructor;
  const activeLabId = selectedLabId || instructor?.labId || 0;

  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [showArchived, setShowArchived] = useState(false);

  const [addOpen, setAddOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Reactions dialog
  const [reactionsAnnId, setReactionsAnnId] = useState<number | null>(null);
  const [reactionsData, setReactionsData] = useState<AnnouncementReaction[]>([]);
  const [reactionsLoading, setReactionsLoading] = useState(false);

  // Form
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [pinned, setPinned] = useState(false);

  // Fetch announcements
  useEffect(() => {
    if (!instructor || !activeLabId) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const res = await fetch(`/api/announcements?labId=${activeLabId}`);
        if (res.ok) {
          const data = await res.json();
          if (!cancelled) setAnnouncements(data);
        }
      } catch { if (!cancelled) toast.error('Failed to load announcements'); }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [instructor, activeLabId]);

  const handleRefresh = async () => {
    if (!activeLabId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/announcements?labId=${activeLabId}`);
      if (res.ok) {
        const data = await res.json();
        setAnnouncements(data);
      }
    } catch { toast.error('Failed to refresh'); }
    setLoading(false);
  };

  const activeAnnouncements = useMemo(() =>
    announcements.filter(a => !a.isArchived),
    [announcements]
  );
  const archivedAnnouncements = useMemo(() =>
    announcements.filter(a => a.isArchived),
    [announcements]
  );

  // Get students for this lab
  const labStudents = useMemo(() => {
    if (!instructor) return [];
    const labStudentIds = studentLabs
      .filter(sl => sl.labId === activeLabId)
      .map(sl => sl.studentId);
    return students.filter(s => labStudentIds.includes(s.id));
  }, [students, studentLabs, instructor, activeLabId]);

  const resetForm = () => {
    setTitle('');
    setContent('');
    setPinned(false);
  };

  const handleAdd = async () => {
    if (!instructor) return;
    if (!title.trim() || !content.trim()) {
      toast.error('Title and content are required');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/announcements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          content: content.trim(),
          author: instructor.displayName || 'Instructor',
          pinned,
          labId: activeLabId,
        }),
      });
      const data = await res.json();
      if (!data.ok) { toast.error(data.error || 'Failed to create'); setSaving(false); return; }
      toast.success('Announcement created');
      setAddOpen(false);
      resetForm();
      handleRefresh();
    } catch { toast.error('Connection error'); }
    setSaving(false);
  };

  const handleEdit = (ann: Announcement) => {
    setEditId(ann.id);
    setTitle(ann.title);
    setContent(ann.content);
    setPinned(ann.pinned);
    setEditOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editId) return;
    if (!title.trim() || !content.trim()) {
      toast.error('Title and content are required');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/announcements/${editId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          content: content.trim(),
          pinned,
        }),
      });
      const data = await res.json();
      if (!data.ok) { toast.error(data.error || 'Failed to update'); setSaving(false); return; }
      toast.success('Announcement updated');
      setEditOpen(false);
      setEditId(null);
      resetForm();
      handleRefresh();
    } catch { toast.error('Connection error'); }
    setSaving(false);
  };

  const handleArchive = async (id: number) => {
    try {
      const res = await fetch(`/api/announcements/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isArchived: true }),
      });
      const data = await res.json();
      if (!data.ok) { toast.error(data.error || 'Failed to archive'); return; }
      toast.success('Announcement archived');
      handleRefresh();
    } catch { toast.error('Connection error'); }
  };

  const handleRestore = async (id: number) => {
    try {
      const res = await fetch(`/api/announcements/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isArchived: false }),
      });
      const data = await res.json();
      if (!data.ok) { toast.error(data.error || 'Failed to restore'); return; }
      toast.success('Announcement restored');
      handleRefresh();
    } catch { toast.error('Connection error'); }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/announcements/${deleteId}`, { method: 'DELETE' });
      const data = await res.json();
      if (!data.ok) { toast.error(data.error || 'Failed to delete'); setDeleting(false); return; }
      toast.success('Announcement permanently deleted');
      setDeleteId(null);
      handleRefresh();
    } catch { toast.error('Connection error'); }
    setDeleting(false);
  };

  const handleViewReactions = async (announcementId: number) => {
    setReactionsAnnId(announcementId);
    setReactionsLoading(true);
    try {
      const res = await fetch(`/api/announcements/${announcementId}/reactions`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setReactionsData(data);
      }
    } catch {
      toast.error('Failed to load reactions');
    }
    setReactionsLoading(false);
  };

  if (!instructor) return null;

  const currentReactionsAnn = announcements.find(a => a.id === reactionsAnnId);
  const reactionCounts: Record<string, number> = currentReactionsAnn?.reactionCounts || {};
  const totalReactions = Object.values(reactionCounts).reduce((a: number, b: number) => a + b, 0);
  const acknowledgedCount = reactionsData.filter(r => r.reaction === 'acknowledged').length;
  const ackRate = labStudents.length > 0 ? Math.round((acknowledgedCount / labStudents.length) * 100) : 0;
  const reactedStudentIds = new Set(reactionsData.map(r => r.studentId));
  const unacknowledgedStudents = labStudents.filter(s => !reactedStudentIds.has(s.id));

  const renderAnnouncementCard = (ann: Announcement) => {
    const annReactionCounts: Record<string, number> = ann.reactionCounts || {};
    const annTotalReactions = Object.values(annReactionCounts).reduce((a: number, b: number) => a + b, 0);

    return (
      <Card key={ann.id} className={`shadow-sm ${ann.isArchived ? 'opacity-60' : ''}`}>
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <h3 className="font-semibold text-sm">{ann.title}</h3>
                {ann.isArchived && (
                  <Badge variant="secondary" className="text-xs">Archived</Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap break-words line-clamp-3 overflow-hidden">
                {ann.content}
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                By {ann.author} · {timeAgo(ann.createdAt)}
              </p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {!ann.isArchived && (
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(ann)}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 hover:bg-red-100 dark:hover:bg-red-950/30"
                onClick={() => setDeleteId(ann.id)}
                title="Delete"
              >
                <Trash2 className="h-3.5 w-3.5 text-red-500" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:py-8">
      <motion.div {...fadeSlide}>
        <BreadcrumbNav items={[
          { label: 'Instructor', view: 'instructor-panel' },
          { label: 'Announcements' },
        ]} />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">

              <span className="text-primary font-semibold">Announcements</span>
            </h1>
            <p className="text-sm text-muted-foreground">
              {labs.find(l => l.id === activeLabId)?.name || instructor.labName || 'Lab'} · {activeAnnouncements.length} active
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={() => { resetForm(); setAddOpen(true); }}>
              <Plus className="h-3.5 w-3.5 mr-1" /> New
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)}
          </div>
        ) : activeAnnouncements.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground border rounded-lg">
            <Megaphone className="h-8 w-8 mb-2 opacity-40" />
            <p className="text-sm font-medium">No Announcements</p>
            <p className="text-xs mt-1">Create announcements to share with your students.</p>
          </div>
        ) : (
          <div className="max-h-[calc(100vh-22rem)] overflow-y-auto space-y-3 pr-1 custom-scrollbar">
            {activeAnnouncements.map(ann => renderAnnouncementCard(ann))}
          </div>
        )}

        {/* Delete Confirmation (permanent delete for archived) */}
        <AlertDialog open={!!deleteId} onOpenChange={(open) => { if (!open) setDeleteId(null); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Permanently</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete this announcement. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-red-600 hover:bg-red-700">
                {deleting ? 'Deleting...' : 'Delete Permanently'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Create Announcement Dialog */}
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>New Announcement</DialogTitle>
              <DialogDescription>Create an announcement for your students.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Title *</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Announcement title" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Content *</Label>
                <Textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="Write your announcement..." rows={4} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
              <Button onClick={handleAdd} disabled={saving || !title.trim() || !content.trim()}>
                {saving ? 'Posting...' : 'Post'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Announcement Dialog */}
        <Dialog open={editId !== null} onOpenChange={(open) => { if (!open) setEditId(null); }}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Edit Announcement</DialogTitle>
              <DialogDescription>Update your announcement.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Title *</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Content *</Label>
                <Textarea value={content} onChange={(e) => setContent(e.target.value)} rows={4} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditId(null)}>Cancel</Button>
              <Button onClick={handleSaveEdit} disabled={saving || !title.trim() || !content.trim()}>
                {saving ? 'Saving...' : 'Save'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </motion.div>
    </div>
  );
}
