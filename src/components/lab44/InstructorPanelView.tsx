'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { useLab44Store } from '@/store/lab44';
import type { ResourceLink } from '@/types';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

import {
  Users, BarChart3, Monitor, RefreshCw,
  ChevronRight, BookOpen,
  Plus, Pencil, Trash2, Columns3, FileText, Download, File, Megaphone, Scale,
  Link2, ArrowUp, ArrowDown, Wrench, Library, Video, ExternalLink,
  CalendarCheck, FolderOpen, Eye, EyeOff, X, ClipboardCheck,
  KeyRound, CheckCircle, Copy,
} from 'lucide-react';

import {
  fadeSlide, BreadcrumbNav, EmptyState, timeAgo,
  vmStatusBadge, getInitials, getAvatarColor,
} from '@/lib/helpers';

// ─── Instructor Panel View (Dashboard) ─────────────────────────────────────────

export default function InstructorPanelView() {
  const { auth, students, setStudents, columns, setColumns, grades, setGrades, attendance, setAttendance, vmRequests, setVmRequests, setStudentLabs, setView, resourceLinks, setResourceLinks, sousGroupes, setSousGroupes, selectedLabId, setSelectedLabId, labs, setLabs } = useLab44Store();
  const instructor = auth.instructor;
  // Multi-lab support: effective lab ID
  const activeLabId = selectedLabId || instructor?.labId || 0;
  const [loading, setLoading] = useState(true);

  // Column management state
  const [newColName, setNewColName] = useState('');
  const [renameColId, setRenameColId] = useState<number | null>(null);
  const [renameColName, setRenameColName] = useState('');
  const [renameColOpen, setRenameColOpen] = useState(false);
  const [manageColsOpen, setManageColsOpen] = useState(false);
  const [addingColumn, setAddingColumn] = useState(false);
  const [newColWeight, setNewColWeight] = useState('1.0');
  const [editWeightColId, setEditWeightColId] = useState<number | null>(null);
  const [editWeightValue, setEditWeightValue] = useState('');
  const [editWeightOpen, setEditWeightOpen] = useState(false);

  // Lab Posts state (unified: PDF + image + description + link)
  const [documents, setDocuments] = useState<Array<{id: number; title: string; description: string | null; fileType: string | null; filePath: string | null; imageUrl: string | null; imageType: string | null; linkUrl: string | null; linkTitle: string | null; visibleToStudents: boolean; createdAt: string; labId: number}>>([]);
  const [createPostOpen, setCreatePostOpen] = useState(false);
  const [postTitle, setPostTitle] = useState('');
  const [postDescription, setPostDescription] = useState('');
  const [postFile, setPostFile] = useState<File | null>(null);
  const [postImage, setPostImage] = useState<File | null>(null);
  const [postLinkUrl, setPostLinkUrl] = useState('');
  const [postLinkTitle, setPostLinkTitle] = useState('');
  const [creatingPost, setCreatingPost] = useState(false);
  const [postVisibleToStudents, setPostVisibleToStudents] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // Resource Links state
  const [addLinkOpen, setAddLinkOpen] = useState(false);
  const [editLinkOpen, setEditLinkOpen] = useState(false);
  const [editingLink, setEditingLink] = useState<ResourceLink | null>(null);
  const [linkTitle, setLinkTitle] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [linkDescription, setLinkDescription] = useState('');
  const [linkCategory, setLinkCategory] = useState<string>('general');
  const [savingLink, setSavingLink] = useState(false);

  // Filter data by active lab
  const labStudents = useMemo(() =>
    students.filter(s => s.labIds?.includes(activeLabId)),
    [students, activeLabId]
  );
  const labStudentIds = useMemo(() => new Set(labStudents.map(s => s.id)), [labStudents]);
  const labGrades = useMemo(() =>
    grades.filter(g => labStudentIds.has(g.studentId)),
    [grades, labStudentIds]
  );
  const labVmRequests = useMemo(() =>
    vmRequests.filter(r => labStudentIds.has(r.studentDbId)),
    [vmRequests, labStudentIds]
  );

  // Filter columns to only the active lab
  const labColumns = useMemo(() =>
    columns.filter(c => c.labId === activeLabId),
    [columns, activeLabId]
  );

  // Sous-groupes for the active lab
  const labSousGroupes = useMemo(() =>
    sousGroupes.filter(sg => sg.labId === activeLabId),
    [sousGroupes, activeLabId]
  );

  // Pending VMs count
  const pendingVms = useMemo(() =>
    labVmRequests.filter(r => r.status === 'pending').length,
    [labVmRequests]
  );

  useEffect(() => {
    if (!instructor || !activeLabId) return;
    let cancelled = false;
    (async () => {
      try {
        // Ensure labs are loaded so InstructorLabSelector can resolve names
        if (labs.length === 0) {
          try {
            const labsRes = await fetch('/api/labs');
            const labsData = await labsRes.json();
            if (Array.isArray(labsData)) setLabs(labsData);
          } catch { /* ignore */ }
        }
        const params = new URLSearchParams({ labId: String(activeLabId) });
        const [sRes, dRes, vRes, docsRes, sgRes] = await Promise.all([
          fetch(`/api/students?${params}`),
          fetch('/api/data'),
          fetch('/api/vm-requests'),
          fetch(`/api/labs/${activeLabId}/documents`),
          fetch(`/api/sous-groupes?labId=${activeLabId}`),
        ]);
        // Fetch resource links
        try {
          const rlRes = await fetch(`/api/resource-links?labId=${activeLabId}`);
          const rlData = await rlRes.json();
          if (!cancelled && Array.isArray(rlData)) setResourceLinks(rlData);
        } catch { /* ignore */ }
        const sData = await sRes.json();
        const dData = await dRes.json();
        const vData = await vRes.json();
        const docsData = await docsRes.json();
        const sgData = await sgRes.json();
        if (!cancelled) {
          setStudents(Array.isArray(sData) ? sData : []);
          setColumns(dData.columns || []);
          setGrades(dData.grades || []);
          setAttendance(dData.attendance || []);
          setStudentLabs(dData.studentLabs || []);
          setVmRequests(vData.requests || []);
          setDocuments(docsData.documents || []);
          setSousGroupes(sgData.sousGroupes || []);
        }
      } catch { if (!cancelled) toast.error('Failed to load data'); }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [instructor, activeLabId, setStudents, setColumns, setGrades, setAttendance, setStudentLabs, setVmRequests, setSousGroupes]);

  const handleRefresh = async () => {
    if (!instructor || !activeLabId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ labId: String(activeLabId) });
      const [sRes, dRes, vRes, docsRes, sgRes] = await Promise.all([
        fetch(`/api/students?${params}`),
        fetch('/api/data'),
        fetch('/api/vm-requests'),
        fetch(`/api/labs/${activeLabId}/documents`),
        fetch(`/api/sous-groupes?labId=${activeLabId}`),
      ]);
      const sData = await sRes.json();
      const dData = await dRes.json();
      const vData = await vRes.json();
      const docsData = await docsRes.json();
      const sgData = await sgRes.json();
      setStudents(Array.isArray(sData) ? sData : []);
      setColumns(dData.columns || []);
      setGrades(dData.grades || []);
      setAttendance(dData.attendance || []);
      setStudentLabs(dData.studentLabs || []);
      setVmRequests(vData.requests || []);
      setDocuments(docsData.documents || []);
      setSousGroupes(sgData.sousGroupes || []);
      // Refresh resource links
      try {
        const rlRes = await fetch(`/api/resource-links?labId=${activeLabId}`);
        const rlData = await rlRes.json();
        if (Array.isArray(rlData)) setResourceLinks(rlData);
      } catch { /* ignore */ }
    } catch { toast.error('Failed to refresh'); }
    setLoading(false);
  };

  // ─── Column Management Handlers ─────────────────────────────────────────────

  const handleAddColumn = async () => {
    if (!instructor || !activeLabId) return;
    if (!newColName.trim()) { toast.error('Column name is required'); return; }
    const parsedWeight = parseFloat(newColWeight);
    if (isNaN(parsedWeight) || parsedWeight <= 0) {
      toast.error('Weight must be a positive number');
      return;
    }
    const existing = labColumns.find(c => c.name.toLowerCase() === newColName.trim().toLowerCase());
    if (existing) {
      toast.warning(`A column named "${existing.name}" already exists in your lab.`);
      return;
    }
    setAddingColumn(true);
    try {
      const res = await fetch('/api/columns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newColName.trim(), labId: activeLabId, weight: parsedWeight }),
      });
      const data = await res.json();
      if (!data.ok) { toast.error(data.error || 'Failed to add column'); return; }
      toast.success('Column added');
      setNewColName('');
      setNewColWeight('1.0');
      const dRes = await fetch('/api/data');
      const dData = await dRes.json();
      setColumns(dData.columns || []);
      setGrades(dData.grades || []);
    } catch { toast.error('Connection error'); }
    setAddingColumn(false);
  };

  const handleRenameColumn = async () => {
    if (renameColId === null || !renameColName.trim()) return;
    try {
      const res = await fetch(`/api/columns/${renameColId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: renameColName.trim() }),
      });
      const data = await res.json();
      if (!data.ok) { toast.error(data.error || 'Failed to rename'); return; }
      toast.success('Column renamed');
      setRenameColOpen(false);
      setRenameColId(null);
      const dRes = await fetch('/api/data');
      const dData = await dRes.json();
      setColumns(dData.columns || []);
      setGrades(dData.grades || []);
    } catch { toast.error('Connection error'); }
  };

  const handleUpdateWeight = async () => {
    if (editWeightColId === null) return;
    const parsedWeight = parseFloat(editWeightValue);
    if (isNaN(parsedWeight) || parsedWeight <= 0) {
      toast.error('Weight must be a positive number');
      return;
    }
    try {
      const res = await fetch(`/api/columns/${editWeightColId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weight: parsedWeight }),
      });
      const data = await res.json();
      if (!data.ok) { toast.error(data.error || 'Failed to update weight'); return; }
      toast.success('Weight updated');
      setEditWeightOpen(false);
      setEditWeightColId(null);
      const dRes = await fetch('/api/data');
      const dData = await dRes.json();
      setColumns(dData.columns || []);
      setGrades(dData.grades || []);
    } catch { toast.error('Connection error'); }
  };

  const handleDeleteColumn = async (id: number) => {
    try {
      const res = await fetch(`/api/columns/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!data.ok) { toast.error(data.error || 'Failed to delete'); return; }
      toast.success('Column deleted');
      const dRes = await fetch('/api/data');
      const dData = await dRes.json();
      setColumns(dData.columns || []);
      setGrades(dData.grades || []);
    } catch { toast.error('Connection error'); }
  };

  const handleCreatePost = async () => {
    if (!instructor || !activeLabId) return;
    if (!postTitle.trim()) { toast.error('Title is required'); return; }
    if (!postFile && !postImage && !postDescription.trim() && !postLinkUrl.trim()) {
      toast.error('At least one content element is required'); return;
    }
    if (postLinkUrl.trim() && !/^https?:\/\/.+/.test(postLinkUrl.trim())) {
      toast.error('Link URL must start with http:// or https://'); return;
    }
    setCreatingPost(true);
    try {
      const formData = new FormData();
      formData.append('title', postTitle.trim());
      if (postDescription.trim()) formData.append('description', postDescription.trim());
      if (postFile) formData.append('file', postFile);
      if (postImage) formData.append('image', postImage);
      if (postLinkUrl.trim()) formData.append('linkUrl', postLinkUrl.trim());
      if (postLinkTitle.trim()) formData.append('linkTitle', postLinkTitle.trim());
      formData.append('visibleToStudents', String(postVisibleToStudents));
      const res = await fetch(`/api/labs/${activeLabId}/documents`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!data.ok) { toast.error(data.error || 'Failed to create post'); return; }
      toast.success('Post created');
      resetPostForm();
      setCreatePostOpen(false);
      const docsRes = await fetch(`/api/labs/${activeLabId}/documents`);
      const docsData = await docsRes.json();
      setDocuments(docsData.documents || []);
    } catch { toast.error('Connection error'); }
    setCreatingPost(false);
  };

  const resetPostForm = () => {
    setPostTitle('');
    setPostDescription('');
    setPostFile(null);
    setPostImage(null);
    setPostLinkUrl('');
    setPostLinkTitle('');
    setPostVisibleToStudents(false);
    setPreviewImage(null);
  };

  const handleDeleteDocument = async (documentId: number) => {
    if (!instructor || !activeLabId) return;
    try {
      const res = await fetch(`/api/labs/${activeLabId}/documents?documentId=${documentId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!data.ok) { toast.error(data.error || 'Failed to delete'); return; }
      toast.success('Post deleted');
      setDocuments(documents.filter(d => d.id !== documentId));
    } catch { toast.error('Connection error'); }
  };

  const handleDownloadDocument = async (documentId: number, title: string) => {
    try {
      const res = await fetch(`/api/documents/${documentId}`);
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = title;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
    } catch { toast.error('Failed to download'); }
  };

  const getFileIcon = (fileType: string | null) => {
    if (fileType === 'application/pdf') return <FileText className="h-4 w-4 text-red-500" />;
    return <File className="h-4 w-4 text-muted-foreground" />;
  };

  // Toggle post visibility to students
  const handleToggleDocVisibility = async (documentId: number, currentVisibility: boolean) => {
    try {
      const res = await fetch(`/api/documents/${documentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visibleToStudents: !currentVisibility }),
      });
      const data = await res.json();
      if (!data.ok) { toast.error(data.error || 'Failed to update visibility'); return; }
      setDocuments(documents.map(d => d.id === documentId ? { ...d, visibleToStudents: !currentVisibility } : d));
      toast.success(!currentVisibility ? 'Post shared with students' : 'Post hidden from students');
    } catch { toast.error('Connection error'); }
  };

  // Image preview handler
  const handleImageSelect = (file: File | null) => {
    setPostImage(file);
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setPreviewImage(reader.result as string);
      reader.readAsDataURL(file);
    } else {
      setPreviewImage(null);
    }
  };

  // ─── Resource Links Handlers ──────────────────────────────────────────────────

  const CATEGORY_OPTIONS = [
    { value: 'general', label: 'General', icon: Link2, color: 'text-gray-600 dark:text-gray-400', bg: 'bg-gray-100 dark:bg-gray-900/30' },
    { value: 'documentation', label: 'Documentation', icon: FileText, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-100 dark:bg-blue-900/30' },
    { value: 'tutorial', label: 'Tutorial', icon: BookOpen, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-100 dark:bg-emerald-900/30' },
    { value: 'tool', label: 'Tool', icon: Wrench, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-100 dark:bg-amber-900/30' },
    { value: 'reference', label: 'Reference', icon: Library, color: 'text-violet-600 dark:text-violet-400', bg: 'bg-violet-100 dark:bg-violet-900/30' },
    { value: 'video', label: 'Video', icon: Video, color: 'text-rose-600 dark:text-rose-400', bg: 'bg-rose-100 dark:bg-rose-900/30' },
  ];

  const getCategoryInfo = (category: string) => CATEGORY_OPTIONS.find(c => c.value === category) || CATEGORY_OPTIONS[0];

  const labResourceLinks = useMemo(() =>
    resourceLinks.filter(l => l.labId === activeLabId).sort((a, b) => a.order - b.order || new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
    [resourceLinks, activeLabId]
  );

  const resetLinkForm = useCallback(() => {
    setLinkTitle('');
    setLinkUrl('');
    setLinkDescription('');
    setLinkCategory('general');
    setEditingLink(null);
  }, []);

  const handleAddLink = async () => {
    if (!instructor || !activeLabId) return;
    if (!linkTitle.trim()) { toast.error('Title is required'); return; }
    if (!linkUrl.trim()) { toast.error('URL is required'); return; }
    if (!/^https?:\/\/.+/.test(linkUrl.trim())) { toast.error('URL must start with http:// or https://'); return; }
    setSavingLink(true);
    try {
      const res = await fetch('/api/resource-links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: linkTitle.trim(), url: linkUrl.trim(), description: linkDescription.trim() || null, category: linkCategory, labId: activeLabId }),
      });
      const data = await res.json();
      if (!data.ok) { toast.error(data.error || 'Failed to add link'); return; }
      toast.success('Resource link added');
      resetLinkForm();
      setAddLinkOpen(false);
      const rlRes = await fetch(`/api/resource-links?labId=${activeLabId}`);
      const rlData = await rlRes.json();
      if (Array.isArray(rlData)) setResourceLinks(rlData);
    } catch { toast.error('Connection error'); }
    setSavingLink(false);
  };

  const handleEditLink = async () => {
    if (!editingLink || !instructor) return;
    if (!linkTitle.trim()) { toast.error('Title is required'); return; }
    if (!linkUrl.trim()) { toast.error('URL is required'); return; }
    if (!/^https?:\/\/.+/.test(linkUrl.trim())) { toast.error('URL must start with http:// or https://'); return; }
    setSavingLink(true);
    try {
      const res = await fetch(`/api/resource-links/${editingLink.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: linkTitle.trim(), url: linkUrl.trim(), description: linkDescription.trim() || null, category: linkCategory }),
      });
      const data = await res.json();
      if (!data.ok) { toast.error(data.error || 'Failed to update link'); return; }
      toast.success('Resource link updated');
      resetLinkForm();
      setEditLinkOpen(false);
      const rlRes = await fetch(`/api/resource-links?labId=${activeLabId}`);
      const rlData = await rlRes.json();
      if (Array.isArray(rlData)) setResourceLinks(rlData);
    } catch { toast.error('Connection error'); }
    setSavingLink(false);
  };

  const handleDeleteLink = async (id: number) => {
    if (!instructor) return;
    try {
      const res = await fetch(`/api/resource-links/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!data.ok) { toast.error(data.error || 'Failed to delete link'); return; }
      toast.success('Resource link deleted');
      setResourceLinks(resourceLinks.filter(l => l.id !== id));
    } catch { toast.error('Connection error'); }
  };

  const handleReorderLink = async (id: number, direction: 'up' | 'down') => {
    if (!instructor) return;
    const idx = labResourceLinks.findIndex(l => l.id === id);
    if (idx === -1) return;
    if (direction === 'up' && idx === 0) return;
    if (direction === 'down' && idx === labResourceLinks.length - 1) return;
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    const items = labResourceLinks.map((l, i) => ({ id: l.id, order: i }));
    [items[idx].order, items[swapIdx].order] = [items[swapIdx].order, items[idx].order];
    try {
      await fetch('/api/resource-links/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      });
      const reordered = [...labResourceLinks];
      [reordered[idx], reordered[swapIdx]] = [reordered[swapIdx], reordered[idx]];
      setResourceLinks(resourceLinks.map(l => {
        const newOrder = reordered.find(r => r.id === l.id);
        return newOrder ? { ...l, order: newOrder.order } : l;
      }));
    } catch { toast.error('Failed to reorder'); }
  };

  const openEditLinkDialog = (link: ResourceLink) => {
    setEditingLink(link);
    setLinkTitle(link.title);
    setLinkUrl(link.url);
    setLinkDescription(link.description || '');
    setLinkCategory(link.category);
    setEditLinkOpen(true);
  };

  // Reset password state
  const [resetPwStudentId, setResetPwStudentId] = useState<number | null>(null);
  const [resetPwStudentName, setResetPwStudentName] = useState('');
  const [resetPwConfirmOpen, setResetPwConfirmOpen] = useState(false);
  const [resetPwResultOpen, setResetPwResultOpen] = useState(false);
  const [resetPwNewPassword, setResetPwNewPassword] = useState('');
  const [resetPwLoading, setResetPwLoading] = useState(false);
  const [resetPwCopied, setResetPwCopied] = useState(false);

  const handleResetPassword = async () => {
    if (!resetPwStudentId) return;
    setResetPwLoading(true);
    try {
      const res = await fetch('/api/instructor/reset-student-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId: resetPwStudentId }),
      });
      const data = await res.json();
      if (!data.ok) {
        toast.error(data.error || 'Password reset failed');
        setResetPwLoading(false);
        return;
      }
      setResetPwNewPassword(data.newPassword);
      setResetPwConfirmOpen(false);
      setResetPwResultOpen(true);
      setResetPwCopied(false);
      toast.success(`Password reset for ${resetPwStudentName}`);
    } catch {
      toast.error('Connection error');
    }
    setResetPwLoading(false);
  };

  const handleCopyPassword = () => {
    navigator.clipboard.writeText(resetPwNewPassword);
    setResetPwCopied(true);
    setTimeout(() => setResetPwCopied(false), 2000);
  };

  const openResetPwConfirm = (studentId: number, name: string) => {
    setResetPwStudentId(studentId);
    setResetPwStudentName(name);
    setResetPwConfirmOpen(true);
  };

  // Get student's sous-groupe name
  const getStudentGroup = useCallback((studentId: number): string | null => {
    for (const sg of labSousGroupes) {
      if (sg.members.some(m => m.studentId === studentId)) {
        return sg.name;
      }
    }
    return null;
  }, [labSousGroupes]);

  if (!instructor) return null;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:py-8">
      <motion.div {...fadeSlide}>
        <BreadcrumbNav items={[{ label: 'Instructor', view: 'instructor-panel' }, { label: 'Dashboard' }]} />

        {/* ─── Hero Welcome Section ─────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="relative overflow-hidden rounded-2xl border bg-card p-6 sm:p-8 mb-8"
        >
          <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
                Welcome back, {instructor.displayName}!
              </h1>
              <p className="text-muted-foreground text-sm sm:text-base mt-1 flex items-center gap-2">
                <BookOpen className="h-4 w-4" />
                {labs.find(l => l.id === activeLabId)?.name || instructor.labName || 'Lab'} Dashboard
                {instructor.email && <span className="hidden sm:inline">&middot; {instructor.email}</span>}
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={handleRefresh} className="shrink-0">
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Refresh
            </Button>
          </div>
        </motion.div>

        {loading ? (
          <div className="space-y-6">
            <Skeleton className="h-64 rounded-xl" />
            <Skeleton className="h-48 rounded-xl" />
          </div>
        ) : (
        <div className="space-y-6">

          {/* ─── Two-Column Layout: Students + VM Requests ──────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* Students Section - Card List */}
            <Card className="shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Users className="h-4 w-4 text-violet-500" /> Enrolled Students
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-[10px]">{labStudents.length}</Badge>
                    <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => setView('instructor-grades')}>
                      View all <ChevronRight className="h-3 w-3 ml-0.5" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {labStudents.length === 0 ? (
                  <EmptyState
                    icon={Users}
                    title="No Students Yet"
                    description="No students are assigned to your lab."
                  />
                ) : (
                  <div className="max-h-80 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                    {labStudents.slice(0, 15).map((s) => {
                      const group = getStudentGroup(s.id);
                      const fullName = `${s.lastName} ${s.firstName}`;
                      const initials = getInitials(s.firstName, s.lastName);
                      const avatarColor = getAvatarColor(fullName);
                      return (
                        <div key={s.id} className="flex items-center gap-3 p-2.5 rounded-xl border border-border/40 hover:bg-muted/30 transition-colors">
                          <div className={`flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold text-white shrink-0 ${avatarColor}`}>
                            {initials}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium truncate">{fullName}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[11px] text-muted-foreground font-mono">{s.studentId}</span>
                              {group && (
                                <Badge variant="outline" className="text-[9px] h-4 px-1.5 py-0 border-violet-200 dark:border-violet-800 text-violet-600 dark:text-violet-400">
                                  {group}
                                </Badge>
                              )}
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-amber-600 dark:hover:text-amber-400 shrink-0"
                            title="Reset password"
                            onClick={() => openResetPwConfirm(s.id, fullName)}
                          >
                            <KeyRound className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      );
                    })}
                    {labStudents.length > 15 && (
                      <p className="text-xs text-muted-foreground text-center pt-1">
                        +{labStudents.length - 15} more students
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Recent VM Requests - Compact Cards */}
            <Card className="shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Monitor className="h-4 w-4 text-emerald-500" /> Recent VM Requests
                  </CardTitle>
                  {pendingVms > 0 && (
                    <Badge className="bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/40 dark:text-amber-400 dark:border-amber-800 text-[10px]">
                      {pendingVms} pending
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {labVmRequests.length === 0 ? (
                  <EmptyState
                    icon={Monitor}
                    title="No VM Requests"
                    description="No virtual machine requests in your lab."
                  />
                ) : (
                  <div className="max-h-80 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                    {labVmRequests.slice(0, 6).map((req) => (
                      <div key={req.id} className="flex items-center justify-between p-2.5 rounded-xl border border-border/40 hover:bg-muted/30 transition-colors">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted shrink-0">
                            <Monitor className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{req.studentName}</p>
                            <p className="text-[11px] text-muted-foreground">{req.templateName || 'Custom'} &middot; {timeAgo(req.requestedAt)}</p>
                          </div>
                        </div>
                        {vmStatusBadge(req.status)}
                      </div>
                    ))}
                    {labVmRequests.length > 6 && (
                      <Button variant="ghost" size="sm" className="w-full text-xs" onClick={() => setView('instructor-vms')}>
                        View all requests <ChevronRight className="h-3 w-3 ml-0.5" />
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* ─── Quick Actions: Exams ──────────────────────────────── */}
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <ClipboardCheck className="h-4 w-4 text-violet-500" /> Exam Management
                </CardTitle>
                <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => setView('instructor-exams')}>
                  Manage Exams <ChevronRight className="h-3 w-3 ml-0.5" />
                </Button>
              </div>
              <CardDescription className="mt-0.5">
                Create exams, manage questions, and view student results
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-4 rounded-xl border border-dashed border-violet-200 dark:border-violet-800 bg-violet-50/30 dark:bg-violet-950/10">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-violet-100 dark:bg-violet-900/30 shrink-0">
                  <ClipboardCheck className="h-6 w-6 text-violet-600 dark:text-violet-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold">Create & Manage Exams</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Build exams with MCQ, True/False, and Short Answer questions. Import questions via JSON. Auto-grade and show results instantly.</p>
                </div>
                <Button size="sm" onClick={() => setView('instructor-exams')} className="shrink-0">
                  <ClipboardCheck className="h-3.5 w-3.5 mr-1" /> Go to Exams
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* ─── Lab Posts Section (Unified: PDF + Image + Description + Link) ──────── */}
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <FolderOpen className="h-4 w-4 text-amber-500" /> Lab Materials
                  </CardTitle>
                  <CardDescription className="mt-0.5">
                    Create posts with documents, images, descriptions & links
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Dialog open={createPostOpen} onOpenChange={(open) => { setCreatePostOpen(open); if (!open) resetPostForm(); }}>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm" className="h-8">
                        <Plus className="h-3.5 w-3.5 mr-1" /> Create Post
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                          <Plus className="h-4 w-4" /> Create Lab Post
                        </DialogTitle>
                        <DialogDescription>
                          Add a PDF, image, description, and link — all in one post.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label className="text-xs font-medium">Title *</Label>
                          <Input value={postTitle} onChange={(e) => setPostTitle(e.target.value)} placeholder="e.g. TP1: Introduction to Linux" />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs font-medium">Description</Label>
                          <Textarea value={postDescription} onChange={(e) => setPostDescription(e.target.value)} placeholder="Add details, instructions, or context for this post..." rows={3} />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs font-medium">PDF / Document</Label>
                          <Input type="file" accept=".pdf,.doc,.docx,.ppt,.pptx,.txt" onChange={(e) => setPostFile(e.target.files?.[0] || null)} />
                          {postFile && <p className="text-[10px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1"><FileText className="h-3 w-3" /> {postFile.name}</p>}
                          <p className="text-[10px] text-muted-foreground">Allowed: PDF, Word, PowerPoint, Text. Max 20MB.</p>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs font-medium">Image</Label>
                          <Input type="file" accept="image/jpeg,image/png,image/gif,image/webp,image/svg+xml" onChange={(e) => handleImageSelect(e.target.files?.[0] || null)} />
                          {previewImage && (
                            <div className="relative mt-2 rounded-lg border border-border/40 overflow-hidden">
                              <img src={previewImage} alt="Preview" className="max-h-40 w-auto mx-auto" />
                              <button onClick={() => handleImageSelect(null)} className="absolute top-1 right-1 h-5 w-5 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70">
                                <X className="h-3 w-3" />
                              </button>
                            </div>
                          )}
                          <p className="text-[10px] text-muted-foreground">JPEG, PNG, GIF, WebP, SVG. Max 10MB.</p>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="space-y-2">
                            <Label className="text-xs font-medium">Link URL</Label>
                            <Input value={postLinkUrl} onChange={(e) => setPostLinkUrl(e.target.value)} placeholder="https://example.com" />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs font-medium">Link Title</Label>
                            <Input value={postLinkTitle} onChange={(e) => setPostLinkTitle(e.target.value)} placeholder="e.g. Official Docs" />
                          </div>
                        </div>
                        <div className="flex items-center gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => setPostVisibleToStudents(!postVisibleToStudents)}
                            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${postVisibleToStudents ? 'bg-emerald-500' : 'bg-muted'}`}
                          >
                            <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition-transform ${postVisibleToStudents ? 'translate-x-4.5' : 'translate-x-0.5'}`} />
                          </button>
                          <Label className="text-xs font-medium cursor-pointer" onClick={() => setPostVisibleToStudents(!postVisibleToStudents)}>
                            Share with students immediately
                          </Label>
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => { setCreatePostOpen(false); resetPostForm(); }}>Cancel</Button>
                        <Button onClick={handleCreatePost} disabled={creatingPost || !postTitle.trim() || (!postFile && !postImage && !postDescription.trim() && !postLinkUrl.trim())}>
                          {creatingPost ? <RefreshCw className="h-3.5 w-3.5 animate-spin mr-1" /> : <Plus className="h-3.5 w-3.5 mr-1" />}
                          {creatingPost ? 'Creating...' : 'Create Post'}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                  <Dialog open={addLinkOpen} onOpenChange={(open) => { setAddLinkOpen(open); if (!open) resetLinkForm(); }}>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm" className="h-8">
                        <Link2 className="h-3.5 w-3.5 mr-1" /> Add Link
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-md">
                      <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                          <Link2 className="h-4 w-4" /> Add Resource Link
                        </DialogTitle>
                        <DialogDescription>Add a standalone external resource URL for your lab.</DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label className="text-xs font-medium">Title *</Label>
                          <Input value={linkTitle} onChange={(e) => setLinkTitle(e.target.value)} placeholder="e.g. Python Documentation" />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs font-medium">URL *</Label>
                          <Input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://example.com" />
                          <p className="text-[10px] text-muted-foreground">URL must start with http:// or https://</p>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs font-medium">Description</Label>
                          <Textarea value={linkDescription} onChange={(e) => setLinkDescription(e.target.value)} placeholder="Brief description of the resource..." rows={2} />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs font-medium">Category</Label>
                          <Select value={linkCategory} onValueChange={setLinkCategory}>
                            <SelectTrigger className="w-full"><SelectValue placeholder="Select category" /></SelectTrigger>
                            <SelectContent>
                              {CATEGORY_OPTIONS.map((opt) => (
                                <SelectItem key={opt.value} value={opt.value}>
                                  <span className="flex items-center gap-2">
                                    <opt.icon className={`h-3.5 w-3.5 ${opt.color}`} />
                                    {opt.label}
                                  </span>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => { setAddLinkOpen(false); resetLinkForm(); }}>Cancel</Button>
                        <Button onClick={handleAddLink} disabled={savingLink || !linkTitle.trim() || !linkUrl.trim()}>
                          {savingLink ? <RefreshCw className="h-3.5 w-3.5 animate-spin mr-1" /> : <Plus className="h-3.5 w-3.5 mr-1" />}
                          {savingLink ? 'Adding...' : 'Add Link'}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                  <Button variant="outline" size="sm" className="h-8" onClick={() => setManageColsOpen(true)}>
                    <Columns3 className="h-3.5 w-3.5 mr-1" /> Columns
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {documents.length === 0 && labResourceLinks.length === 0 ? (
                <EmptyState
                  icon={FolderOpen}
                  title="No Lab Materials Yet"
                  description="Create your first post or add resource links for your students."
                />
              ) : (
                <div className="space-y-4 max-h-[calc(100vh-30rem)] overflow-y-auto pr-1">
                  {documents.map((doc) => (
                    <motion.div
                      key={doc.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="rounded-xl border border-border/40 p-4 hover:bg-muted/20 transition-colors group"
                    >
                      {/* Post Header */}
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="text-sm font-semibold truncate">{doc.title}</h4>
                            {doc.visibleToStudents ? (
                              <Badge className="text-[8px] px-1.5 py-0 h-3.5 bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800 shrink-0">
                                <Eye className="h-2.5 w-2.5 mr-0.5" />Shared
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-[8px] px-1.5 py-0 h-3.5 text-muted-foreground border-border/50 shrink-0">
                                <EyeOff className="h-2.5 w-2.5 mr-0.5" />Hidden
                              </Badge>
                            )}
                          </div>
                          <p className="text-[11px] text-muted-foreground mt-0.5">{timeAgo(doc.createdAt)}</p>
                        </div>
                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                          <Button
                            variant="ghost"
                            size="icon"
                            className={`h-7 w-7 ${doc.visibleToStudents ? 'text-emerald-600 hover:bg-emerald-100 dark:hover:bg-emerald-950/30' : 'text-muted-foreground hover:bg-muted'}`}
                            onClick={() => handleToggleDocVisibility(doc.id, doc.visibleToStudents)}
                            title={doc.visibleToStudents ? 'Hide from students' : 'Share with students'}
                          >
                            {doc.visibleToStudents ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                          </Button>
                          {doc.filePath && (
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDownloadDocument(doc.id, doc.title)} title="Download">
                              <Download className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-red-100 dark:hover:bg-red-950/30" title="Delete">
                                <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-red-600" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Post</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete <strong>&quot;{doc.title}&quot;</strong>? This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDeleteDocument(doc.id)} className="bg-red-600 hover:bg-red-700">Delete</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>

                      {/* Post Content */}
                      <div className="space-y-3">
                        {/* Description */}
                        {doc.description && (
                          <p className="text-sm text-muted-foreground whitespace-pre-line">{doc.description}</p>
                        )}

                        {/* Image */}
                        {doc.imageUrl && (
                          <div className="rounded-lg border border-border/40 overflow-hidden">
                            <img
                              src={`/api/documents/${doc.id}?type=image`}
                              alt={doc.title}
                              className="max-h-64 w-auto object-contain mx-auto"
                              loading="lazy"
                            />
                          </div>
                        )}

                        {/* Post Attachments Row */}
                        <div className="flex flex-wrap gap-2">
                          {/* PDF/Document badge */}
                          {doc.filePath && (
                            <button
                              onClick={() => handleDownloadDocument(doc.id, doc.title)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-xs font-medium text-red-700 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors cursor-pointer"
                            >
                              {getFileIcon(doc.fileType)}
                              {doc.fileType === 'application/pdf' ? 'PDF Document' : 'File'} <Download className="h-3 w-3" />
                            </button>
                          )}

                          {/* Link badge */}
                          {doc.linkUrl && (
                            <a
                              href={doc.linkUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-xs font-medium text-blue-700 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
                            >
                              <ExternalLink className="h-3 w-3" />
                              {doc.linkTitle || doc.linkUrl}
                            </a>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}

              {/* Resource Links Section */}
              {labResourceLinks.length > 0 && (
                <div className="mt-5 pt-4 border-t border-border/40">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Link2 className="h-3 w-3" /> Resource Links ({labResourceLinks.length})
                  </h4>
                  <div className="space-y-1.5">
                    {labResourceLinks.map((link) => {
                      const catInfo = getCategoryInfo(link.category);
                      const CatIcon = catInfo.icon;
                      return (
                        <div key={link.id} className="flex items-center justify-between p-2.5 rounded-lg border border-border/40 hover:bg-muted/30 transition-colors group">
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <div className={`flex h-8 w-8 items-center justify-center rounded-md ${catInfo.bg} shrink-0`}>
                              <CatIcon className={`h-4 w-4 ${catInfo.color}`} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-medium truncate">{link.title}</p>
                                <Badge variant="outline" className={`text-[9px] px-1.5 py-0 h-4 ${catInfo.color} border-current/20 shrink-0`}>
                                  {catInfo.label}
                                </Badge>
                              </div>
                              <a href={link.url} target="_blank" rel="noopener noreferrer" className="text-[11px] text-muted-foreground hover:text-primary truncate block max-w-[280px]" onClick={(e) => e.stopPropagation()}>
                                {link.url} <ExternalLink className="h-2.5 w-2.5 inline ml-0.5" />
                              </a>
                            </div>
                          </div>
                          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-2">
                            <button onClick={() => handleReorderLink(link.id, 'up')} className="p-1.5 hover:bg-muted rounded-md" title="Move up" disabled={labResourceLinks.indexOf(link) === 0}>
                              <ArrowUp className="h-3 w-3 text-muted-foreground" />
                            </button>
                            <button onClick={() => handleReorderLink(link.id, 'down')} className="p-1.5 hover:bg-muted rounded-md" title="Move down" disabled={labResourceLinks.indexOf(link) === labResourceLinks.length - 1}>
                              <ArrowDown className="h-3 w-3 text-muted-foreground" />
                            </button>
                            <button onClick={() => openEditLinkDialog(link)} className="p-1.5 hover:bg-muted rounded-md" title="Edit">
                              <Pencil className="h-3 w-3 text-muted-foreground" />
                            </button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <button className="p-1.5 hover:bg-red-100 dark:hover:bg-red-950/30 rounded-md" title="Delete">
                                  <Trash2 className="h-3 w-3 text-muted-foreground hover:text-red-600" />
                                </button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Resource Link</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to delete <strong>&quot;{link.title}&quot;</strong>? This action cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDeleteLink(link.id)} className="bg-red-600 hover:bg-red-700">Delete</AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* ─── Manage Columns Dialog ────────────────────────────────────── */}
          <Dialog open={manageColsOpen} onOpenChange={(open) => { setManageColsOpen(open); if (!open) { setNewColName(''); setNewColWeight('1.0'); setRenameColOpen(false); } }}>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Columns3 className="h-4 w-4" /> Manage Assessment Columns
                </DialogTitle>
                <DialogDescription>
                  Add, rename, set weights, or delete grade columns for <strong>{instructor.labName || 'your lab'}</strong>
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-2">
                <Label className="text-xs font-medium">Add New Column</Label>
                <div className="flex items-center gap-2">
                  <Input value={newColName} onChange={(e) => setNewColName(e.target.value)} placeholder="e.g. Midterm Exam" className="flex-1" onKeyDown={(e) => e.key === 'Enter' && handleAddColumn()} />
                  <div className="flex items-center gap-1">
                    <Label className="text-[10px] text-muted-foreground whitespace-nowrap">Wt:</Label>
                    <Input type="number" min={0.1} step={0.5} value={newColWeight} onChange={(e) => setNewColWeight(e.target.value)} className="w-16 h-9 text-center text-xs" />
                  </div>
                  <Button size="sm" onClick={handleAddColumn} disabled={addingColumn || !newColName.trim()}>
                    {addingColumn ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5 mr-1" />}
                    {addingColumn ? 'Adding...' : 'Add'}
                  </Button>
                </div>
                <p className="text-[10px] text-muted-foreground">Weight affects how much this column contributes to the weighted average. Default is 1.0.</p>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-medium">Existing Columns ({labColumns.length})</Label>
                {labColumns.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4 border rounded-lg">No assessment columns yet. Create your first one above.</p>
                ) : (
                  <div className="max-h-64 overflow-y-auto space-y-1 border rounded-lg p-2">
                    {labColumns.map(col => {
                      const colGrades = labGrades.filter(g => g.columnId === col.id && g.value !== null).map(g => g.value as number);
                      const colAvg = colGrades.length > 0 ? (colGrades.reduce((a, b) => a + b, 0) / colGrades.length).toFixed(1) : '—';
                      const isWeighted = col.weight !== 1.0;
                      return (
                        <div key={col.id} className="flex items-center justify-between p-2 rounded-md hover:bg-muted/50 transition-colors group">
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <BarChart3 className="h-3.5 w-3.5 text-violet-500 shrink-0" />
                            <span className="text-sm font-medium truncate">{col.name}</span>
                            <Badge variant="outline" className="text-[10px] font-mono shrink-0">avg {colAvg}</Badge>
                            <Badge variant="secondary" className="text-[10px] font-mono shrink-0">{colGrades.length} grades</Badge>
                            <Badge variant={isWeighted ? 'default' : 'outline'} className={`text-[10px] font-mono shrink-0 ${isWeighted ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400' : ''}`}>wt {col.weight ?? 1.0}</Badge>
                          </div>
                          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-2">
                            <button onClick={() => { setEditWeightColId(col.id); setEditWeightValue(String(col.weight ?? 1.0)); setEditWeightOpen(true); }} className="p-1.5 hover:bg-muted rounded-md" title="Edit weight">
                              <Scale className="h-3 w-3 text-amber-500" />
                            </button>
                            <button onClick={() => { setRenameColId(col.id); setRenameColName(col.name); setRenameColOpen(true); }} className="p-1.5 hover:bg-muted rounded-md" title="Rename">
                              <Pencil className="h-3 w-3 text-muted-foreground" />
                            </button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <button className="p-1.5 hover:bg-red-100 dark:hover:bg-red-950/30 rounded-md" title="Delete">
                                  <Trash2 className="h-3 w-3 text-muted-foreground hover:text-red-600" />
                                </button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Column</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to delete <strong>&quot;{col.name}&quot;</strong>? All {colGrades.length} grades in this column will be permanently deleted.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDeleteColumn(col.id)} className="bg-red-600 hover:bg-red-700">Delete</AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setManageColsOpen(false)}>Done</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Edit Weight Dialog */}
          <Dialog open={editWeightOpen} onOpenChange={setEditWeightOpen}>
            <DialogContent className="max-w-sm">
              <DialogHeader>
                <DialogTitle>Edit Column Weight</DialogTitle>
                <DialogDescription>Set the weight for this assessment column. Higher weight means it contributes more to the weighted average.</DialogDescription>
              </DialogHeader>
              <div className="space-y-2">
                <Label className="text-xs font-medium">Weight</Label>
                <Input type="number" min={0.1} step={0.5} value={editWeightValue} onChange={(e) => setEditWeightValue(e.target.value)} placeholder="1.0" onKeyDown={(e) => e.key === 'Enter' && handleUpdateWeight()} />
                <p className="text-[10px] text-muted-foreground">Default weight is 1.0 (equal contribution). Must be greater than 0.</p>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setEditWeightOpen(false)}>Cancel</Button>
                <Button onClick={handleUpdateWeight}>Update Weight</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Rename Column Dialog */}
          <Dialog open={renameColOpen} onOpenChange={setRenameColOpen}>
            <DialogContent className="max-w-sm">
              <DialogHeader>
                <DialogTitle>Rename Column</DialogTitle>
                <DialogDescription>Enter a new name for this assessment column</DialogDescription>
              </DialogHeader>
              <Input value={renameColName} onChange={(e) => setRenameColName(e.target.value)} placeholder="New column name" onKeyDown={(e) => e.key === 'Enter' && handleRenameColumn()} />
              <DialogFooter>
                <Button variant="outline" onClick={() => setRenameColOpen(false)}>Cancel</Button>
                <Button onClick={handleRenameColumn}>Rename</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Edit Resource Link Dialog */}
          <Dialog open={editLinkOpen} onOpenChange={(open) => { setEditLinkOpen(open); if (!open) resetLinkForm(); }}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Pencil className="h-4 w-4" /> Edit Resource Link
                </DialogTitle>
                <DialogDescription>Update the resource link details.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs font-medium">Title *</Label>
                  <Input value={linkTitle} onChange={(e) => setLinkTitle(e.target.value)} placeholder="e.g. Python Documentation" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-medium">URL *</Label>
                  <Input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://example.com" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-medium">Description</Label>
                  <Textarea value={linkDescription} onChange={(e) => setLinkDescription(e.target.value)} placeholder="Brief description of the resource..." rows={2} />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-medium">Category</Label>
                  <Select value={linkCategory} onValueChange={setLinkCategory}>
                    <SelectTrigger className="w-full"><SelectValue placeholder="Select category" /></SelectTrigger>
                    <SelectContent>
                      {CATEGORY_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          <span className="flex items-center gap-2">
                            <opt.icon className={`h-3.5 w-3.5 ${opt.color}`} />
                            {opt.label}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => { setEditLinkOpen(false); resetLinkForm(); }}>Cancel</Button>
                <Button onClick={handleEditLink} disabled={savingLink || !linkTitle.trim() || !linkUrl.trim()}>
                  {savingLink ? <RefreshCw className="h-3.5 w-3.5 animate-spin mr-1" /> : <Pencil className="h-3.5 w-3.5 mr-1" />}
                  {savingLink ? 'Saving...' : 'Save Changes'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* ─── Reset Password Confirmation Dialog ────────────────────────── */}
          <AlertDialog open={resetPwConfirmOpen} onOpenChange={setResetPwConfirmOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2">
                  <KeyRound className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                  Reset Student Password
                </AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to reset the password for <strong>{resetPwStudentName}</strong>?
                  A new random password will be generated. The student will need the new password to log in.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={resetPwLoading}>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleResetPassword}
                  disabled={resetPwLoading}
                  className="bg-amber-600 hover:bg-amber-700"
                >
                  {resetPwLoading ? (
                    <><RefreshCw className="h-4 w-4 mr-1 animate-spin" /> Resetting...</>
                  ) : (
                    <><KeyRound className="h-4 w-4 mr-1" /> Reset Password</>
                  )}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {/* ─── Reset Password Result Dialog ───────────────────────────────── */}
          <Dialog open={resetPwResultOpen} onOpenChange={setResetPwResultOpen}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                  Password Reset Successful
                </DialogTitle>
                <DialogDescription>
                  The password for <strong>{resetPwStudentName}</strong> has been reset. Share this new password with the student.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <Label className="text-xs font-medium">New Password</Label>
                <div className="flex items-center gap-2">
                  <Input
                    readOnly
                    value={resetPwNewPassword}
                    className="font-mono text-sm pr-10"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    className="shrink-0 h-9"
                    onClick={handleCopyPassword}
                  >
                    {resetPwCopied ? (
                      <CheckCircle className="h-4 w-4 text-emerald-600" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <p className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                  Make sure to copy this password now. It won&apos;t be shown again.
                </p>
              </div>
              <DialogFooter>
                <Button onClick={() => setResetPwResultOpen(false)} className="w-full">
                  Done
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

        </div>
        )}
      </motion.div>
    </div>
  );
}
