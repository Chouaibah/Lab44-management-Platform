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
      <Card key={ann.id} className={`shadow-sm ${ann.isArchived ? 'opacity-60' : ''} ${ann.pinned && !ann.isArchived ? 'border-amber-300 dark:border-amber-700' : ''}`}>
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                {ann.pinned && !ann.isArchived && <Pin className="h-3.5 w-3.5 text-amber-500" />}
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
              {/* Reaction Summary Inline */}
              {annTotalReactions > 0 && (
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  {Object.entries(annReactionCounts).map(([key, count]) => {
                    const display = REACTION_DISPLAY[key];
                    if (!display || count === 0) return null;
                    return (
                      <span key={key} className={`inline-flex items-center gap-1 text-[10px] ${display.color}`}>
                        {display.icon}
                        <span className="font-mono">{count}</span>
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs gap-1"
                onClick={() => handleViewReactions(ann.id)}
              >
                <Users className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Reactions</span>
                {annTotalReactions > 0 && (
                  <Badge variant="secondary" className="h-4 min-w-4 text-[9px] px-1">
                    {annTotalReactions}
                  </Badge>
                )}
              </Button>
              {!ann.isArchived ? (
                <>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(ann)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => handleArchive(ann.id)}
                    title="Archive"
                  >
                    <Archive className="h-3.5 w-3.5 text-muted-foreground" />
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => handleRestore(ann.id)}
                    title="Restore"
                  >
                    <ArchiveRestore className="h-3.5 w-3.5 text-emerald-600" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 hover:bg-red-100 dark:hover:bg-red-950/30"
                    onClick={() => setDeleteId(ann.id)}
                    title="Delete permanently"
                  >
                    <Trash2 className="h-3.5 w-3.5 text-red-500" />
                  </Button>
                </>
              )}
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
            <Button variant="outline" size="sm" onClick={handleRefresh}>
              <RefreshCw className="h-3.5 w-3.5 mr-1" /> Refresh
            </Button>
            <Button size="sm" onClick={() => { resetForm(); setAddOpen(true); }}>
              <Plus className="h-3.5 w-3.5 mr-1" /> New
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)}
          </div>
        ) : activeAnnouncements.length === 0 && archivedAnnouncements.length === 0 ? (
          <Card className="shadow-sm">
            <CardContent className="py-12">
              <EmptyState
                icon={Megaphone}
                title="No Announcements"
                description="Create announcements to share with your students."
              />
            </CardContent>
          </Card>
        ) : (
          <div className="max-h-[calc(100vh-22rem)] overflow-y-auto space-y-3 pr-1 custom-scrollbar">
            {/* Active announcements */}
            {activeAnnouncements.map(ann => renderAnnouncementCard(ann))}

            {/* Archived section */}
            {archivedAnnouncements.length > 0 && (
              <div className="mt-4">
                <button
                  type="button"
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-3"
                  onClick={() => setShowArchived(!showArchived)}
                >
                  <Archive className="h-4 w-4" />
                  Archived ({archivedAnnouncements.length})
                  <span className="text-xs">{showArchived ? '▲' : '▼'}</span>
                </button>
                {showArchived && (
                  <div className="space-y-3">
                    {archivedAnnouncements.map(ann => renderAnnouncementCard(ann))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Reactions Dialog */}
        <Dialog open={!!reactionsAnnId} onOpenChange={(open) => { if (!open) setReactionsAnnId(null); }}>
          <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Users className="h-4 w-4" /> Announcement Reactions
              </DialogTitle>
              <DialogDescription>
                {currentReactionsAnn?.title || 'Loading...'}
              </DialogDescription>
            </DialogHeader>

            {reactionsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="space-y-4 overflow-y-auto flex-1 min-h-0 pr-1">
                {labStudents.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Acknowledgment Rate</span>
                      <span className="text-sm font-mono">{acknowledgedCount}/{labStudents.length} ({ackRate}%)</span>
                    </div>
                    <Progress value={ackRate} className="h-2" />
                  </div>
                )}

                {totalReactions > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                      Reaction Summary
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(reactionCounts).map(([key, count]) => {
                        const display = REACTION_DISPLAY[key];
                        if (!display || count === 0) return null;
                        return (
                          <div key={key} className="flex items-center gap-1.5 bg-muted/50 rounded-full px-3 py-1.5">
                            <span className={display.color}>{display.icon}</span>
                            <span className="text-xs font-medium">{display.label}</span>
                            <Badge variant="secondary" className="h-4 min-w-4 text-[10px] px-1">{count}</Badge>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <Separator />

                {reactionsData.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" /> Reacted ({reactionsData.length})
                    </h4>
                    <ScrollArea className="max-h-48 overflow-y-auto">
                      <div className="space-y-1.5">
                        {reactionsData.map((r) => {
                          const display = REACTION_DISPLAY[r.reaction];
                          return (
                            <div key={r.id} className="flex items-center justify-between gap-2 py-1 px-2 rounded-md hover:bg-muted/30">
                              <div className="flex items-center gap-2 min-w-0">
                                {r.student ? (
                                  <StudentAvatar firstName={r.student.firstName} lastName={r.student.lastName} size="sm" />
                                ) : (
                                  <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold">?</div>
                                )}
                                <span className="text-sm whitespace-nowrap">
                                  {r.student ? `${r.student.firstName} ${r.student.lastName}` : `Student #${r.studentId}`}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                {display && (
                                  <span className={`inline-flex items-center gap-1 text-xs ${display.color}`}>
                                    {display.icon}
                                    <span className="hidden sm:inline">{display.label}</span>
                                  </span>
                                )}
                                <span className="text-[10px] text-muted-foreground">{timeAgo(r.createdAt)}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </ScrollArea>
                  </div>
                )}

                {unacknowledgedStudents.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
                      <UserX className="h-3 w-3" /> Not Yet Reacted ({unacknowledgedStudents.length})
                    </h4>
                    <ScrollArea className="max-h-36 overflow-y-auto">
                      <div className="space-y-1">
                        {unacknowledgedStudents.map((s) => (
                          <div key={s.id} className="flex items-center gap-2 py-1 px-2 rounded-md hover:bg-muted/30">
                            <StudentAvatar firstName={s.firstName} lastName={s.lastName} size="sm" />
                            <span className="text-sm text-muted-foreground truncate">{s.firstName} {s.lastName}</span>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                )}

                {reactionsData.length === 0 && unacknowledgedStudents.length === 0 && (
                  <div className="text-center py-6">
                    <p className="text-sm text-muted-foreground">No reactions yet</p>
                  </div>
                )}
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setReactionsAnnId(null)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Add Dialog */}
        <Dialog open={addOpen} onOpenChange={(open) => { setAddOpen(open); if (!open) resetForm(); }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Plus className="h-4 w-4" /> New Announcement
              </DialogTitle>
              <DialogDescription>
                Create an announcement for {labs.find(l => l.id === activeLabId)?.name || instructor.labName || 'your lab'}
              </DialogDescription>
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
              <div className="flex items-center gap-3">
                <Label className="text-xs font-medium">Pinned</Label>
                <button
                  type="button"
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${pinned ? 'bg-amber-500' : 'bg-muted'}`}
                  onClick={() => setPinned(!pinned)}
                >
                  <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${pinned ? 'translate-x-4' : 'translate-x-0.5'}`} />
                </button>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
              <Button onClick={handleAdd} disabled={saving || !title.trim() || !content.trim()}>
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <CheckCircle2 className="h-3.5 w-3.5 mr-1" />}
                {saving ? 'Creating...' : 'Create'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Dialog */}
        <Dialog open={editOpen} onOpenChange={(open) => { setEditOpen(open); if (!open) { setEditId(null); resetForm(); } }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Pencil className="h-4 w-4" /> Edit Announcement
              </DialogTitle>
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
              <div className="flex items-center gap-3">
                <Label className="text-xs font-medium">Pinned</Label>
                <button
                  type="button"
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${pinned ? 'bg-amber-500' : 'bg-muted'}`}
                  onClick={() => setPinned(!pinned)}
                >
                  <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${pinned ? 'translate-x-4' : 'translate-x-0.5'}`} />
                </button>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
              <Button onClick={handleSaveEdit} disabled={saving || !title.trim() || !content.trim()}>
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <CheckCircle2 className="h-3.5 w-3.5 mr-1" />}
                {saving ? 'Saving...' : 'Save'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

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
      </motion.div>
    </div>
  );
}
