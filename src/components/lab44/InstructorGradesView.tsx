'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { useLab44Store } from '@/store/lab44';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import {
  BarChart3, RefreshCw, Search, Plus, Pencil, Save, X, Users, UserPlus, Trash2,
  Eye, EyeOff, Check, Download,
} from 'lucide-react';

import {
  fadeSlide, BreadcrumbNav, EmptyState, StudentAvatar, gradeColor,
} from '@/lib/helpers';
import type { SousGroupe } from '@/types';
import { buildGradeMap } from '@/lib/utils';

export default function InstructorGradesView() {
  const { auth, students, setStudents, columns, setColumns, grades, setGrades, setStudentLabs, setAuth, selectedLabId, labs } = useLab44Store();
  const instructor = auth.instructor;
  // Multi-lab support: effective lab ID
  const activeLabId = selectedLabId || instructor?.labId || 0;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Grade editing state
  const [gradeEdits, setGradeEdits] = useState<Record<string, string>>({});
  const [addColumnOpen, setAddColumnOpen] = useState(false);
  const [newColumnName, setNewColumnName] = useState('');
  const [addingColumn, setAddingColumn] = useState(false);

  // Student management state
  const [addStudentOpen, setAddStudentOpen] = useState(false);
  const [newFirstName, setNewFirstName] = useState('');
  const [newLastName, setNewLastName] = useState('');
  const [newStudentId, setNewStudentId] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [addingStudent, setAddingStudent] = useState(false);

  const [deleteStudentId, setDeleteStudentId] = useState<number | null>(null);
  const [deleteStudentName, setDeleteStudentName] = useState('');
  const [deleting, setDeleting] = useState(false);

  // Show grades toggle state
  const [showGrades, setShowGrades] = useState(instructor?.showGrades ?? true);
  const [togglingGrades, setTogglingGrades] = useState(false);

  // Sync showGrades with auth store when instructor data loads/changes
  useEffect(() => {
    if (instructor?.showGrades !== undefined) {
      setShowGrades(instructor.showGrades);
    }
  }, [instructor?.showGrades]);

  // Sous-groupes data for group column
  const [sousGroupes, setSousGroupes] = useState<SousGroupe[]>([]);

  // Group management state
  const [createGroupOpen, setCreateGroupOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [renamingGroupId, setRenamingGroupId] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [renamingGroup, setRenamingGroup] = useState(false);
  const [deleteGroupId, setDeleteGroupId] = useState<number | null>(null);
  const [deleteGroupName, setDeleteGroupName] = useState('');
  const [deletingGroup, setDeletingGroup] = useState(false);
  const [addStudentGroupId, setAddStudentGroupId] = useState<number | null>(null);
  const [addingStudentToGroup, setAddingStudentToGroup] = useState(false);
  const [removeStudentInfo, setRemoveStudentInfo] = useState<{ groupId: number; studentId: number; studentName: string } | null>(null);
  const [removingStudent, setRemovingStudent] = useState(false);
  const [groupActionLoading, setGroupActionLoading] = useState<number | null>(null);

  // Column deletion state
  const [deleteColumnId, setDeleteColumnId] = useState<number | null>(null);
  const [deleteColumnName, setDeleteColumnName] = useState('');
  const [deletingColumn, setDeletingColumn] = useState(false);

  const labStudents = useMemo(() =>
    students.filter(s => s.labIds?.includes(activeLabId)),
    [students, activeLabId]
  );

  const labColumns = useMemo(() =>
    columns.filter(c => c.labId === activeLabId),
    [columns, activeLabId]
  );

  const filteredStudents = useMemo(() => {
    if (!searchQuery.trim()) return labStudents;
    const query = searchQuery.toLowerCase();
    return labStudents.filter(s =>
      s.firstName.toLowerCase().includes(query) ||
      s.lastName.toLowerCase().includes(query) ||
      s.studentId.toLowerCase().includes(query)
    );
  }, [labStudents, searchQuery]);

  const gradeMap = useMemo(() => buildGradeMap(grades), [grades]);

  const getStudentGrade = (studentId: number, columnId: number): number | null => {
    return gradeMap.get(`${studentId}-${columnId}`) ?? null;
  };

  const handleGradeChange = (studentId: number, columnId: number, value: string) => {
    const key = `${studentId}-${columnId}`;
    // Allow empty, partial (e.g. "12."), and clamp completed numbers to 0–20
    if (value === '' || value === '-') {
      setGradeEdits(prev => ({ ...prev, [key]: value }));
      return;
    }
    // Allow trailing decimal point while typing
    if (value.endsWith('.')) {
      const before = value.slice(0, -1);
      if (/^\d+$/.test(before)) {
        setGradeEdits(prev => ({ ...prev, [key]: value }));
        return;
      }
    }
    const num = parseFloat(value);
    if (isNaN(num)) return;
    const clamped = Math.min(20, Math.max(0, num));
    setGradeEdits(prev => ({ ...prev, [key]: String(clamped) }));
  };

  const getGradeEditValue = (studentId: number, columnId: number): string => {
    const key = `${studentId}-${columnId}`;
    if (gradeEdits[key] !== undefined) return gradeEdits[key];
    const grade = getStudentGrade(studentId, columnId);
    return grade !== null ? String(grade) : '';
  };

  const hasGradeEdits = Object.keys(gradeEdits).length > 0;

  useEffect(() => {
    if (!instructor || !activeLabId) return;
    let cancelled = false;
    (async () => {
      try {
        const params = new URLSearchParams({ labId: String(activeLabId) });
        const [sRes, dRes, sgRes] = await Promise.all([
          fetch(`/api/students?${params}`),
          fetch('/api/data'),
          fetch(`/api/sous-groupes?labId=${activeLabId}`),
        ]);
        const sData = await sRes.json();
        const dData = await dRes.json();
        const sgData = await sgRes.json();
        if (!cancelled) {
          setStudents(Array.isArray(sData) ? sData : []);
          setColumns(dData.columns || []);
          setGrades(dData.grades || []);
          setStudentLabs(dData.studentLabs || []);
          setSousGroupes(sgData.sousGroupes || []);
        }
      } catch { if (!cancelled) toast.error('Failed to load data'); }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [instructor, activeLabId, setStudents, setColumns, setGrades, setStudentLabs]);

  const handleRefresh = async () => {
    if (!instructor || !activeLabId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ labId: String(activeLabId) });
      const [sRes, dRes, sgRes] = await Promise.all([
        fetch(`/api/students?${params}`),
        fetch('/api/data'),
        fetch(`/api/sous-groupes?labId=${activeLabId}`),
      ]);
      const sData = await sRes.json();
      const dData = await dRes.json();
      const sgData = await sgRes.json();
      setStudents(Array.isArray(sData) ? sData : []);
      setColumns(dData.columns || []);
      setGrades(dData.grades || []);
      setStudentLabs(dData.studentLabs || []);
      setSousGroupes(sgData.sousGroupes || []);
      setGradeEdits({});
    } catch { toast.error('Failed to refresh'); }
    setLoading(false);
  };

  const handleSaveGrades = async () => {
    if (!instructor || Object.keys(gradeEdits).length === 0) return;
    setSaving(true);
    try {
      const updates = Object.entries(gradeEdits).map(([key, value]) => {
        const [studentId, columnId] = key.split('-').map(Number);
        const numValue = value === '' ? null : parseFloat(value);
        return { studentId, columnId, value: numValue };
      }).filter(u => u.value === null || (!isNaN(u.value) && u.value >= 0 && u.value <= 20));

      const res = await fetch('/api/grades/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      const data = await res.json();
      if (!data.ok) { toast.error(data.error || 'Failed to save grades'); return; }
      toast.success(`Saved ${updates.length} grade(s)`);
      setGradeEdits({});
      const dRes = await fetch('/api/data');
      const dData = await dRes.json();
      setGrades(dData.grades || []);
    } catch { toast.error('Connection error'); }
    setSaving(false);
  };

  const handleAddColumn = async () => {
    if (!instructor) return;
    if (!newColumnName.trim()) { toast.error('Column name required'); return; }
    setAddingColumn(true);
    try {
      const res = await fetch('/api/columns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newColumnName.trim(), labId: activeLabId, weight: 1.0 }),
      });
      const data = await res.json();
      if (!data.ok) { toast.error(data.error || 'Failed to add column'); return; }
      toast.success('Column added');
      setNewColumnName('');
      setAddColumnOpen(false);
      const dRes = await fetch('/api/data');
      const dData = await dRes.json();
      setColumns(dData.columns || []);
    } catch { toast.error('Connection error'); }
    setAddingColumn(false);
  };

  const handleAddStudent = async () => {
    if (!instructor) return;
    if (!newFirstName.trim() || !newLastName.trim() || !newStudentId.trim()) {
      toast.error('First name, last name, and student ID are required');
      return;
    }

    // Check if student already exists
    const existingStudent = students.find(s => s.studentId.toLowerCase() === newStudentId.trim().toLowerCase());
    
    if (existingStudent) {
      const alreadyInLab = existingStudent.labIds?.includes(activeLabId);
      if (alreadyInLab) {
        toast.error('Student already in your lab');
        return;
      }
      // Add existing student to lab
      setAddingStudent(true);
      try {
        const res = await fetch(`/api/students/${existingStudent.id}/labs`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ labId: activeLabId }),
        });
        const data = await res.json();
        if (!data.ok) { toast.error(data.error || 'Failed to add student'); return; }
        toast.success('Student added to your lab');
        setNewFirstName(''); setNewLastName(''); setNewStudentId(''); setNewNotes('');
        setAddStudentOpen(false);
        handleRefresh();
      } catch { toast.error('Connection error'); }
      setAddingStudent(false);
      return;
    }

    // Create new student
    setAddingStudent(true);
    try {
      const res = await fetch('/api/students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: newFirstName.trim(),
          lastName: newLastName.trim(),
          studentId: newStudentId.trim(),
          notes: newNotes.trim() || null,
          labId: activeLabId,
        }),
      });
      const data = await res.json();
      if (!data.ok) { toast.error(data.error || 'Failed to add student'); return; }
      toast.success('Student added successfully');
      setNewFirstName(''); setNewLastName(''); setNewStudentId(''); setNewNotes('');
      setAddStudentOpen(false);
      handleRefresh();
    } catch { toast.error('Connection error'); }
    setAddingStudent(false);
  };

  const handleRemoveStudent = async () => {
    if (!instructor || !deleteStudentId) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/labs/${activeLabId}?studentId=${deleteStudentId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!data.ok) { toast.error(data.error || 'Failed to remove'); return; }
      toast.success('Student removed from lab');
      setDeleteStudentId(null);
      handleRefresh();
    } catch { toast.error('Connection error'); }
    setDeleting(false);
  };

  // ── Sous-groupes refresh helper ──
  const refreshSousGroupes = async () => {
    if (!instructor || !activeLabId) return;
    try {
      const sgRes = await fetch(`/api/sous-groupes?labId=${activeLabId}`);
      const sgData = await sgRes.json();
      setSousGroupes(sgData.sousGroupes || []);
    } catch { toast.error('Failed to refresh groups'); }
  };

  // ── Group management handlers ──
  const handleCreateGroup = async () => {
    if (!instructor || !newGroupName.trim()) return;
    setCreatingGroup(true);
    try {
      const res = await fetch('/api/sous-groupes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newGroupName.trim(), labId: activeLabId }),
      });
      const data = await res.json();
      if (!data.ok) { toast.error(data.error || 'Failed to create group'); return; }
      toast.success(`Group "${newGroupName.trim()}" created`);
      setNewGroupName('');
      setCreateGroupOpen(false);
      refreshSousGroupes();
    } catch { toast.error('Connection error'); }
    setCreatingGroup(false);
  };

  const handleRenameGroup = async (groupId: number) => {
    if (!renameValue.trim()) { setRenamingGroupId(null); return; }
    setRenamingGroup(true);
    try {
      const res = await fetch(`/api/sous-groupes/${groupId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: renameValue.trim() }),
      });
      const data = await res.json();
      if (!data.ok) { toast.error(data.error || 'Failed to rename group'); return; }
      toast.success('Group renamed');
      setRenamingGroupId(null);
      refreshSousGroupes();
    } catch { toast.error('Connection error'); }
    setRenamingGroup(false);
  };

  const handleDeleteGroup = async () => {
    if (!deleteGroupId) return;
    setDeletingGroup(true);
    try {
      const res = await fetch(`/api/sous-groupes/${deleteGroupId}`, { method: 'DELETE' });
      const data = await res.json();
      if (!data.ok) { toast.error(data.error || 'Failed to delete group'); return; }
      toast.success('Group deleted');
      setDeleteGroupId(null);
      setDeleteGroupName('');
      refreshSousGroupes();
    } catch { toast.error('Connection error'); }
    setDeletingGroup(false);
  };

  const handleAddStudentToGroup = async (groupId: number, studentId: number) => {
    setAddingStudentToGroup(true);
    setGroupActionLoading(groupId);
    try {
      const res = await fetch(`/api/sous-groupes/${groupId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId }),
      });
      const data = await res.json();
      if (!data.ok) { toast.error(data.error || 'Failed to add student'); return; }
      toast.success('Student added to group');
      setAddStudentGroupId(null);
      refreshSousGroupes();
    } catch { toast.error('Connection error'); }
    setAddingStudentToGroup(false);
    setGroupActionLoading(null);
  };

  const handleRemoveStudentFromGroup = async () => {
    if (!removeStudentInfo) return;
    setRemovingStudent(true);
    setGroupActionLoading(removeStudentInfo.groupId);
    try {
      const res = await fetch(`/api/sous-groupes/${removeStudentInfo.groupId}/members?studentId=${removeStudentInfo.studentId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!data.ok) { toast.error(data.error || 'Failed to remove student'); return; }
      toast.success('Student removed from group');
      setRemoveStudentInfo(null);
      refreshSousGroupes();
    } catch { toast.error('Connection error'); }
    setRemovingStudent(false);
    setGroupActionLoading(null);
  };

  // Compute students in each group and unassigned students
  const studentsInAnyGroup = useMemo(() => {
    const ids = new Set<number>();
    sousGroupes.forEach(sg => sg.members.forEach(m => ids.add(m.studentId)));
    return ids;
  }, [sousGroupes]);

  const unassignedLabStudents = useMemo(() =>
    labStudents.filter(s => !studentsInAnyGroup.has(s.id)),
    [labStudents, studentsInAnyGroup]
  );

  const handleExportCSV = () => {
    if (labColumns.length === 0 || filteredStudents.length === 0) {
      toast.error('No data to export');
      return;
    }
    const headers = ['Student Last Name', 'Student First Name', 'Student ID', 'Group', ...labColumns.map(c => c.name), 'Average'];
    const rows = filteredStudents.map(student => {
      const studentGrades = labColumns.map(col => getStudentGrade(student.id, col.id));
      const validGrades = studentGrades.filter((g): g is number => g !== null);
      const simpleAvg = validGrades.length > 0 ? validGrades.reduce((a, b) => a + b, 0) / validGrades.length : null;
      const studentGroup = sousGroupes.find(sg => sg.members.some(m => m.studentId === student.id));
      return [
        student.lastName,
        student.firstName,
        student.studentId,
        studentGroup?.name || '',
        ...labColumns.map(col => {
          const grade = getStudentGrade(student.id, col.id);
          return grade !== null ? String(grade) : '';
        }),
        avg !== null ? avg.toFixed(2) : '',
      ];
    });
    const csvContent = [headers, ...rows].map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `grades_${instructor?.labName || 'lab'}_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success('Grades exported to CSV');
  };

  const handleDeleteColumn = (columnId: number) => {
    const col = labColumns.find(c => c.id === columnId);
    if (!col) return;
    setDeleteColumnId(columnId);
    setDeleteColumnName(col.name);
  };

  const confirmDeleteColumn = async () => {
    if (!deleteColumnId) return;
    setDeletingColumn(true);
    try {
      const res = await fetch(`/api/columns/${deleteColumnId}`, { method: 'DELETE' });
      const data = await res.json();
      if (!data.ok) { toast.error(data.error || 'Failed to delete column'); return; }
      toast.success('Column deleted');
      setDeleteColumnId(null);
      setDeleteColumnName('');
      handleRefresh();
    } catch { toast.error('Connection error'); }
    setDeletingColumn(false);
  };

  if (!instructor) return null;

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:py-8">
      <motion.div {...fadeSlide}>
        <BreadcrumbNav items={[
          { label: 'Instructor', view: 'instructor-panel' },
          { label: 'Students' },
        ]} />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">

                <span className="text-primary font-semibold">Students</span>
              </h1>
              <p className="text-sm text-muted-foreground">
                Manage Student Grades & Groups
              </p>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-64 rounded-xl" />
          </div>
        ) : (
          <Tabs defaultValue="grades" className="space-y-6">
            <TabsList>
              <TabsTrigger value="grades">Grade Entry</TabsTrigger>
              <TabsTrigger value="groups">Groups</TabsTrigger>
            </TabsList>

            <TabsContent value="grades" className="space-y-6">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={async () => {
                if (!instructor || togglingGrades) return;
                setTogglingGrades(true);
                try {
                  const newValue = !showGrades;
                  const res = await fetch(`/api/instructors/${instructor.id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ showGrades: newValue }),
                  });
                  const data = await res.json();
                  if (!res.ok) {
                    toast.error(data.error || 'Failed to update');
                    setTogglingGrades(false);
                    return;
                  }
                  setShowGrades(newValue);
                  if (auth.instructor) {
                    setAuth({ ...auth, instructor: { ...auth.instructor, showGrades: newValue } });
                  }
                  toast.success(newValue ? 'Grades are now visible to students' : 'Grades are now hidden from students');
                } catch { toast.error('Connection error'); }
                setTogglingGrades(false);
              }}
              disabled={togglingGrades}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all cursor-pointer border ${showGrades ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800' : 'bg-muted text-muted-foreground border-border'}`}
              title={showGrades ? 'Students can see their grades' : 'Students cannot see their grades'}
            >
              {togglingGrades ? <RefreshCw className="h-3 w-3 animate-spin" /> : showGrades ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
              {showGrades ? 'Visible' : 'Hidden'}
            </button>
            <div className="relative ml-auto">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search..."
                className="pl-8 w-36"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2">
                  <X className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                </button>
              )}
            </div>
            <Button size="sm" variant="outline" onClick={handleExportCSV}>
              <Download className="h-3.5 w-3.5 mr-1" /> Export CSV
            </Button>
            <Button size="sm" variant="outline" onClick={() => setAddColumnOpen(true)}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Add Column
            </Button>
            {hasGradeEdits && (
              <Button size="sm" onClick={handleSaveGrades} disabled={saving}>
                {saving ? <RefreshCw className="h-3.5 w-3.5 animate-spin mr-1" /> : <Save className="h-3.5 w-3.5 mr-1" />}
                {saving ? 'Saving...' : `Save (${Object.keys(gradeEdits).length})`}
              </Button>
            )}
          </div>
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">

                Grade Entry
                <Button size="icon" variant="ghost" className="h-6 w-6 ml-1" onClick={() => setAddStudentOpen(true)} title="Add student">

                </Button>
              </CardTitle>
              <CardDescription>
                Enter grades (0-20). Use Save button to save changes. Remove students with the trash icon.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {labColumns.length === 0 ? (
                <EmptyState
                  icon={BarChart3}
                  title="No Grade Columns"
                  description="Add a grade column to start entering grades."
                />
              ) : filteredStudents.length === 0 ? (
                <EmptyState
                  icon={Users}
                  title="No Students"
                  description="Add students to your lab to start entering grades."
                />
              ) : (
                <div className="max-h-[calc(100vh-28rem)] overflow-auto rounded-md border border-border/50">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs sticky left-0 bg-background min-w-[150px]">Student</TableHead>
                        <TableHead className="text-xs sticky bg-background w-24">ID</TableHead>
                        <TableHead className="text-xs bg-background w-28">Group</TableHead>
                        {labColumns.map(col => (
                          <TableHead key={col.id} className="text-xs text-center min-w-[80px]">
                            <div className="flex items-center justify-center gap-0.5">
                              <span className="truncate">{col.name}</span>
                              <button
                                onClick={() => handleDeleteColumn(col.id)}
                                className="shrink-0 ml-0.5 rounded p-0.5 hover:bg-red-100 dark:hover:bg-red-950/30 transition-colors"
                                title={`Delete "${col.name}" column`}
                              >
                                <X className="h-2.5 w-2.5 text-muted-foreground hover:text-red-600" />
                              </button>
                            </div>
                          </TableHead>
                        ))}
                        <TableHead className="text-xs text-center w-20">
                          <div>Avg</div>
                          <div className="text-[9px] text-muted-foreground font-normal">simple</div>
                        </TableHead>
                        <TableHead className="text-xs text-center w-12"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredStudents.map((student) => {
                        const studentGrades = labColumns.map(col => getStudentGrade(student.id, col.id));
                        const validGrades = studentGrades.filter((g): g is number => g !== null);
                        const simpleAvg = validGrades.length > 0 ? validGrades.reduce((a, b) => a + b, 0) / validGrades.length : null;
                        const avg = simpleAvg;

                        return (
                          <TableRow key={student.id} className="hover:bg-muted/30">
                            <TableCell className="font-medium sticky left-0 bg-background">
                              <div className="flex items-center gap-2">
                                <StudentAvatar firstName={student.firstName} lastName={student.lastName} size="sm" />
                                <span>{student.lastName} {student.firstName}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground font-mono bg-background">
                              {student.studentId}
                            </TableCell>
                            <TableCell className="text-xs bg-background">
                              {(() => {
                                const studentGroup = sousGroupes.find(sg => sg.members.some(m => m.studentId === student.id));
                                return studentGroup ? (
                                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 border-violet-200 text-violet-700 dark:border-violet-700 dark:text-violet-400 bg-violet-50 dark:bg-violet-950/30">
                                    {studentGroup.name}
                                  </Badge>
                                ) : (
                                  <span className="text-muted-foreground/50">—</span>
                                );
                              })()}
                            </TableCell>
                            {labColumns.map(col => {
                              const editValue = getGradeEditValue(student.id, col.id);
                              const originalValue = getStudentGrade(student.id, col.id);
                              const hasEdit = gradeEdits[`${student.id}-${col.id}`] !== undefined;
                              const displayValue = hasEdit ? editValue : (originalValue !== null ? String(originalValue) : '');

                              return (
                                <TableCell key={col.id} className="text-center">
                                  <Input
                                    type="text"
                                    inputMode="decimal"
                                    value={displayValue}
                                    onChange={(e) => handleGradeChange(student.id, col.id, e.target.value)}
                                    className={`w-16 h-8 text-center mx-auto ${
                                      hasEdit ? 'border-violet-500 bg-violet-50 dark:bg-violet-950/30' : ''
                                    }`}
                                  />
                                </TableCell>
                              );
                            })}
                            <TableCell className="text-center">
                              <span className={`text-sm font-bold ${gradeColor(avg)}`}>
                                {avg !== null ? avg.toFixed(1) : '—'}
                              </span>
                            </TableCell>
                            <TableCell className="text-center">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 hover:bg-red-100 dark:hover:bg-red-950/30"
                                onClick={() => {
                                  setDeleteStudentId(student.id);
                                  setDeleteStudentName(`${student.lastName} ${student.firstName}`);
                                }}
                                title="Remove from lab"
                              >
                                <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-red-600" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
            </TabsContent>

            <TabsContent value="groups" className="space-y-6">
          <div className="flex items-center gap-2">
            <Button className="ml-auto" size="sm" variant="outline" onClick={() => setCreateGroupOpen(true)}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Create Group
            </Button>
          </div>
        {/* ── Groups Management Card ── */}
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">

                Groups
                {sousGroupes.length > 0 && (
                  <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0 h-5">
                    {sousGroupes.length}
                  </Badge>
                )}
              </CardTitle>
            </div>
            <CardDescription>
              Manage groups for {instructor.labName || 'your lab'}. Each student can only be in one group per lab.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {sousGroupes.length === 0 ? (
              <EmptyState
                icon={Users}
                title="No Groups Yet"
                description="Create groups to organize your students into sub-groups."
                action={
                  <Button size="sm" onClick={() => setCreateGroupOpen(true)}>
                    <Plus className="h-3.5 w-3.5 mr-1" /> Create First Group
                  </Button>
                }
              />
            ) : (
              <div className="space-y-4">
                {sousGroupes.map((group) => (
                  <motion.div
                    key={group.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-lg border bg-card p-4"
                  >
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-center gap-2 min-w-0">
                        {renamingGroupId === group.id ? (
                          <div className="flex items-center gap-1.5">
                            <Input
                              value={renameValue}
                              onChange={(e) => setRenameValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleRenameGroup(group.id);
                                if (e.key === 'Escape') setRenamingGroupId(null);
                              }}
                              className="h-7 text-sm w-40"
                              autoFocus
                              disabled={renamingGroup}
                            />
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6"
                              onClick={() => handleRenameGroup(group.id)}
                              disabled={renamingGroup}
                            >
                              {renamingGroup ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3 text-emerald-600" />}
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6"
                              onClick={() => setRenamingGroupId(null)}
                              disabled={renamingGroup}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        ) : (
                          <>
                            <h4 className="font-semibold text-sm truncate">{group.name}</h4>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6 shrink-0"
                              onClick={() => {
                                setRenamingGroupId(group.id);
                                setRenameValue(group.name);
                              }}
                              title="Rename group"
                            >
                              <Pencil className="h-3 w-3 text-muted-foreground" />
                            </Button>
                          </>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5">
                          {group.members.length} member{group.members.length !== 1 ? 's' : ''}
                        </Badge>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 hover:bg-red-100 dark:hover:bg-red-950/30"
                          onClick={() => {
                            setDeleteGroupId(group.id);
                            setDeleteGroupName(group.name);
                          }}
                          title="Delete group"
                        >
                          <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-red-600" />
                        </Button>
                      </div>
                    </div>

                    {/* Members */}
                    {group.members.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        {group.members.map((member) => {
                          const studentName = member.student
                            ? `${member.student.lastName} ${member.student.firstName}`
                            : `Student #${member.studentId}`;
                          return (
                            <Badge
                              key={member.id}
                              variant="secondary"
                              className="text-xs px-2 py-0.5 h-6 gap-1 pr-1"
                            >
                              <span>{studentName}</span>
                              <button
                                onClick={() =>
                                  setRemoveStudentInfo({
                                    groupId: group.id,
                                    studentId: member.studentId,
                                    studentName,
                                  })
                                }
                                className="ml-0.5 rounded-full p-0.5 hover:bg-red-200 dark:hover:bg-red-800/50 transition-colors"
                                title={`Remove ${studentName}`}
                                disabled={groupActionLoading === group.id}
                              >
                                <X className="h-2.5 w-2.5" />
                              </button>
                            </Badge>
                          );
                        })}
                      </div>
                    )}

                    {group.members.length === 0 && (
                      <p className="text-xs text-muted-foreground mb-3 italic">No members yet</p>
                    )}

                    {/* Add Student */}
                    <Popover
                      open={addStudentGroupId === group.id}
                      onOpenChange={(open) => {
                        setAddStudentGroupId(open ? group.id : null);
                      }}
                    >
                      <PopoverTrigger asChild>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          disabled={groupActionLoading === group.id || addingStudentToGroup}
                        >
                          {addingStudentToGroup && groupActionLoading === group.id ? (
                            <RefreshCw className="h-3 w-3 animate-spin mr-1" />
                          ) : (
                            <UserPlus className="h-3 w-3 mr-1" />
                          )}
                          Add Student
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-64 p-2" align="start">
                        <div className="space-y-1">
                          <p className="text-xs font-medium text-muted-foreground px-2 py-1">
                            Students not in any group
                          </p>
                          {unassignedLabStudents.length === 0 ? (
                            <p className="text-xs text-muted-foreground px-2 py-3 text-center italic">
                              No unassigned students
                            </p>
                          ) : (
                            <ScrollArea className="max-h-48">
                              {unassignedLabStudents.map((student) => (
                                <button
                                  key={student.id}
                                  onClick={() => handleAddStudentToGroup(group.id, student.id)}
                                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs hover:bg-muted transition-colors text-left"
                                  disabled={addingStudentToGroup}
                                >
                                  <StudentAvatar
                                    firstName={student.firstName}
                                    lastName={student.lastName}
                                    size="sm"
                                  />
                                  <span className="truncate">
                                    {student.lastName} {student.firstName}
                                  </span>
                                  <span className="ml-auto text-muted-foreground font-mono text-[10px]">
                                    {student.studentId}
                                  </span>
                                </button>
                              ))}
                            </ScrollArea>
                          )}
                        </div>
                      </PopoverContent>
                    </Popover>
                  </motion.div>
                ))}

                {/* Summary */}
                <Separator />
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    {studentsInAnyGroup.size} of {labStudents.length} student{labStudents.length !== 1 ? 's' : ''} assigned to groups
                  </span>
                  {unassignedLabStudents.length > 0 && (
                    <span className="text-amber-600 dark:text-amber-400">
                      {unassignedLabStudents.length} unassigned
                    </span>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
            </TabsContent>
          </Tabs>
        )}

        {/* Add Student Dialog */}
        <Dialog open={addStudentOpen} onOpenChange={(open) => { setAddStudentOpen(open); if (!open) { setNewFirstName(''); setNewLastName(''); setNewStudentId(''); setNewNotes(''); } }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <UserPlus className="h-4 w-4" /> Add Student
              </DialogTitle>
              <DialogDescription>
                Add a new student to your lab or add an existing student by ID
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">First Name *</Label>
                  <Input value={newFirstName} onChange={(e) => setNewFirstName(e.target.value)} placeholder="John" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Last Name *</Label>
                  <Input value={newLastName} onChange={(e) => setNewLastName(e.target.value)} placeholder="Doe" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Student ID *</Label>
                <Input value={newStudentId} onChange={(e) => setNewStudentId(e.target.value)} placeholder="e.g. 20240001" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Notes</Label>
                <Textarea value={newNotes} onChange={(e) => setNewNotes(e.target.value)} placeholder="Optional notes..." rows={2} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAddStudentOpen(false)}>Cancel</Button>
              <Button onClick={handleAddStudent} disabled={addingStudent || !newFirstName.trim() || !newLastName.trim() || !newStudentId.trim()}>
                {addingStudent ? <RefreshCw className="h-3.5 w-3.5 animate-spin mr-1" /> : <Plus className="h-3.5 w-3.5 mr-1" />}
                {addingStudent ? 'Adding...' : 'Add Student'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Add Column Dialog */}
        <Dialog open={addColumnOpen} onOpenChange={(open) => { setAddColumnOpen(open); if (!open) setNewColumnName(''); }}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Plus className="h-4 w-4" /> Add Grade Column
              </DialogTitle>
              <DialogDescription>
                Create a new assessment column for {instructor.labName || 'your lab'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Column Name</Label>
                <Input
                  value={newColumnName}
                  onChange={(e) => setNewColumnName(e.target.value)}
                  placeholder="e.g. Midterm Exam"
                  onKeyDown={(e) => e.key === 'Enter' && handleAddColumn()}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAddColumnOpen(false)}>Cancel</Button>
              <Button onClick={handleAddColumn} disabled={addingColumn || !newColumnName.trim()}>
                {addingColumn ? <RefreshCw className="h-3.5 w-3.5 animate-spin mr-1" /> : <Plus className="h-3.5 w-3.5 mr-1" />}
                {addingColumn ? 'Adding...' : 'Add Column'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Remove Student Confirmation */}
        <AlertDialog open={!!deleteStudentId} onOpenChange={(open) => { if (!open) setDeleteStudentId(null); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove Student from Lab</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to remove <strong>{deleteStudentName}</strong> from your lab? The student will still exist in the system but will no longer be associated with your lab.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleRemoveStudent} disabled={deleting} className="bg-red-600 hover:bg-red-700">
                {deleting ? 'Removing...' : 'Remove from Lab'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Create Group Dialog */}
        <Dialog open={createGroupOpen} onOpenChange={(open) => { setCreateGroupOpen(open); if (!open) setNewGroupName(''); }}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Users className="h-4 w-4 text-violet-500" /> Create Group
              </DialogTitle>
              <DialogDescription>
                Create a new group for {instructor.labName || 'your lab'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Group Name</Label>
                <Input
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  placeholder="e.g. Group A"
                  onKeyDown={(e) => e.key === 'Enter' && handleCreateGroup()}
                  autoFocus
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateGroupOpen(false)}>Cancel</Button>
              <Button onClick={handleCreateGroup} disabled={creatingGroup || !newGroupName.trim()}>
                {creatingGroup ? <RefreshCw className="h-3.5 w-3.5 animate-spin mr-1" /> : <Plus className="h-3.5 w-3.5 mr-1" />}
                {creatingGroup ? 'Creating...' : 'Create Group'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Group Confirmation */}
        <AlertDialog open={!!deleteGroupId} onOpenChange={(open) => { if (!open) { setDeleteGroupId(null); setDeleteGroupName(''); } }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Group</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete the group <strong>{deleteGroupName}</strong>? All members will be removed from this group. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteGroup} disabled={deletingGroup} className="bg-red-600 hover:bg-red-700">
                {deletingGroup ? 'Deleting...' : 'Delete Group'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Delete Column Confirmation */}
        <AlertDialog open={deleteColumnId !== null} onOpenChange={(open) => { if (!open) setDeleteColumnId(null); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Column &quot;{deleteColumnName}&quot;?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete this column and all grades associated with it. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={confirmDeleteColumn} disabled={deletingColumn} className="bg-red-600 hover:bg-red-700">
                {deletingColumn ? 'Deleting...' : 'Delete Column'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Remove Student from Group Confirmation */}
        <AlertDialog open={!!removeStudentInfo} onOpenChange={(open) => { if (!open) setRemoveStudentInfo(null); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove Student from Group</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to remove <strong>{removeStudentInfo?.studentName}</strong> from this group? The student will be unassigned and can be added to another group.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleRemoveStudentFromGroup} disabled={removingStudent} className="bg-red-600 hover:bg-red-700">
                {removingStudent ? 'Removing...' : 'Remove from Group'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </motion.div>
    </div>
  );
}
