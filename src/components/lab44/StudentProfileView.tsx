'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { useLab44Store } from '@/store/lab44';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
Card, CardContent, CardHeader, CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
Dialog, DialogContent, DialogDescription, DialogFooter,
DialogHeader, DialogTitle,
} from '@/components/ui/dialog';

import { Textarea } from '@/components/ui/textarea';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

import {
Pencil, RefreshCw, Save, BarChart3, CalendarCheck, Monitor, Activity,
Trophy, ArrowUpRight, ArrowDownRight, Minus, Timer, Play, Pause, RotateCcw, Coffee, Clock,
Brain, CheckCircle2, FileText, Download, StickyNote, Trash2, Plus, Flame, Sun, Moon, Lock,
} from 'lucide-react';


import {
BreadcrumbNav, CircularProgress, fadeSlide, getInitials,
getAvatarColor, fmtDate, gradeColor, timeAgo, StudentAvatar,
} from '@/lib/helpers';
import { buildGradeMap } from '@/lib/utils';
import { computeWeightedAverage } from '@/lib/grade-utils';
import ChangePasswordDialog from '@/components/lab44/ChangePasswordDialog';




interface NoteItem { text: string; createdAt: string; updatedAt?: string; }

function StudentNotes({ studentId }: { studentId: number }) {
const STORAGE_KEY = `lab44-student-notes-${studentId}`;
const MAX_CHARS = 500;

const [notes, setNotes] = useState<NoteItem[]>(() => {
if (typeof window === 'undefined') return [];
try {
const saved = localStorage.getItem(STORAGE_KEY);
return saved ? JSON.parse(saved) : [];
} catch { return []; }
});

const [isAdding, setIsAdding] = useState(false);
const [newNote, setNewNote] = useState('');
const [editingIdx, setEditingIdx] = useState<number | null>(null);
const [editText, setEditText] = useState('');

const saveNotes = useCallback((updated: NoteItem[]) => {
setNotes(updated);
try { localStorage.setItem(STORAGE_KEY, JSON.stringify(updated)); } catch { /* ignore */ }
}, [STORAGE_KEY]);

const handleAdd = useCallback(() => {
if (!newNote.trim()) { toast.error('Note cannot be empty'); return; }
const updated = [{ text: newNote.trim(), createdAt: new Date().toISOString() }, ...notes];
saveNotes(updated);
setNewNote('');
setIsAdding(false);
toast.success('Note saved');
}, [newNote, notes, saveNotes]);

const handleEdit = useCallback((idx: number) => {
if (!editText.trim()) { toast.error('Note cannot be empty'); return; }
const updated = notes.map((n, i) => i === idx ? { ...n, text: editText.trim(), updatedAt: new Date().toISOString() } : n);
saveNotes(updated);
setEditingIdx(null);
setEditText('');
toast.success('Note updated');
}, [editText, notes, saveNotes]);

const handleDelete = useCallback((idx: number) => {
const updated = notes.filter((_, i) => i !== idx);
saveNotes(updated);
toast.success('Note deleted');
}, [notes, saveNotes]);

return (
<motion.div {...fadeSlide} transition={{ delay: 0.18 }}>
<Card className="shadow-sm">
<CardHeader className="pb-3">
<CardTitle className="text-base flex items-center gap-2">
<StickyNote className="h-4 w-4 text-amber-500" /> Personal Notes
</CardTitle>
</CardHeader>
<CardContent>
<div className="space-y-3">
{notes.length === 0 && !isAdding && (
<div className="text-center py-4">
<StickyNote className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
<p className="text-sm text-muted-foreground">No notes yet</p>
<Button size="sm" variant="outline" className="mt-2 gap-1" onClick={() => setIsAdding(true)}>
<Plus className="h-3.5 w-3.5" /> Add Note
</Button>
</div>
)}
{notes.map((note, idx) => (
      <div key={`note-${idx}-${note.createdAt}`} className="rounded-lg border bg-muted/30 p-3">
{editingIdx === idx ? (
<div className="space-y-2">
<Textarea
value={editText}
onChange={(e) => { if (e.target.value.length <= MAX_CHARS) setEditText(e.target.value); }}
rows={3}
className="text-xs"
autoFocus
/>
<div className="flex items-center justify-between">
<span className="text-[10px] text-muted-foreground">{editText.length}/{MAX_CHARS}</span>
<div className="flex gap-1">
<Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditingIdx(null)}>Cancel</Button>
<Button size="sm" className="h-7 text-xs gap-1" onClick={() => handleEdit(idx)}>
<Save className="h-3 w-3" /> Save
</Button>
</div>
</div>
</div>
) : (
<>
<p className="text-sm whitespace-pre-wrap">{note.text}</p>
<div className="flex items-center justify-between mt-2">
<span className="text-[10px] text-muted-foreground">
{new Date(note.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
</span>
<div className="flex gap-1">
<Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => { setEditingIdx(idx); setEditText(note.text); }}>
<Pencil className="h-3 w-3" />
</Button>
<AlertDialog>
<AlertDialogTrigger asChild>
<Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-muted-foreground hover:text-red-600">
<Trash2 className="h-3 w-3" />
</Button>
</AlertDialogTrigger>
<AlertDialogContent>
<AlertDialogHeader>
<AlertDialogTitle>Delete Note</AlertDialogTitle>
<AlertDialogDescription>Are you sure you want to delete this note? This cannot be undone.</AlertDialogDescription>
</AlertDialogHeader>
<AlertDialogFooter>
<AlertDialogCancel>Cancel</AlertDialogCancel>
<AlertDialogAction onClick={() => handleDelete(idx)} className="bg-red-600 hover:bg-red-700">Delete</AlertDialogAction>
</AlertDialogFooter>
</AlertDialogContent>
</AlertDialog>
</div>
</div>
</>
)}
</div>
))}
{isAdding && (
<div className="space-y-2 rounded-lg border border-dashed p-3">
<Textarea
value={newNote}
onChange={(e) => { if (e.target.value.length <= MAX_CHARS) setNewNote(e.target.value); }}
placeholder="Write a personal note..."
rows={3}
className="text-xs"
autoFocus
/>
<div className="flex items-center justify-between">
<span className="text-[10px] text-muted-foreground">{newNote.length}/{MAX_CHARS}</span>
<div className="flex gap-1">
<Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setIsAdding(false); setNewNote(''); }}>Cancel</Button>
<Button size="sm" className="h-7 text-xs gap-1" onClick={handleAdd} disabled={!newNote.trim()}>
<Plus className="h-3 w-3" /> Save Note
</Button>
</div>
</div>
</div>
)}
{notes.length > 0 && !isAdding && (
<Button size="sm" variant="outline" className="w-full gap-1" onClick={() => setIsAdding(true)}>
<Plus className="h-3.5 w-3.5" /> Add Note
</Button>
)}
</div>
</CardContent>
</Card>
</motion.div>
);
}

const trendIcon = (trend: 'improving' | 'stable' | 'declining') => {
if (trend === 'improving') return <ArrowUpRight className="h-3.5 w-3.5 text-emerald-500" />;
if (trend === 'declining') return <ArrowDownRight className="h-3.5 w-3.5 text-red-500" />;
return <Minus className="h-3.5 w-3.5 text-muted-foreground" />;
};

const activityIcon = (type: string) => {
if (type === 'grade') return <BarChart3 className="h-3.5 w-3.5 text-emerald-500" />;
if (type === 'attendance') return <CalendarCheck className="h-3.5 w-3.5 text-amber-500" />;
return <Monitor className="h-3.5 w-3.5 text-violet-500" />;
};

const activityDotColor = (type: string) => {
if (type === 'grade') return 'bg-emerald-500';
if (type === 'attendance') return 'bg-amber-500';
return 'bg-violet-500';
};

export default function StudentProfileView() {
const auth = useLab44Store(state => state.auth);
const columns = useLab44Store(state => state.columns);
const grades = useLab44Store(state => state.grades);
const attendance = useLab44Store(state => state.attendance);
const students = useLab44Store(state => state.students);
const vmRequests = useLab44Store(state => state.vmRequests);
const studentLabs = useLab44Store(state => state.studentLabs);
const instructors = useLab44Store(state => state.instructors);
const setView = useLab44Store(state => state.setView);
const student = auth.student;

const [hideGradesGlobal, setHideGradesGlobal] = useState(false);
const [gradesVisible, setGradesVisible] = useState(true);
const [changePasswordOpen, setChangePasswordOpen] = useState(false);

const gradeMap = useMemo(() => buildGradeMap(grades), [grades]);

const myGrades = useMemo(() => {
if (!student) return [];
const result: number[] = [];
for (const col of columns) {
const val = gradeMap.get(`${student.id}-${col.id}`);
if (val !== null && val !== undefined) result.push(val);
}
return result;
}, [columns, gradeMap, student]);

const avgGrade = myGrades.length > 0 ? (myGrades.reduce((a, b) => a + b, 0) / myGrades.length).toFixed(1) : '—';

const weightedAvgGrade = useMemo(() => {
if (!student) return null;
return computeWeightedAverage(grades, columns, student.id);
}, [grades, columns, student]);



const activityItems = useMemo(() => {
if (!student) return [];
const items: { type: string; description: string; date: string }[] = [];
columns.forEach(col => {
const val = gradeMap.get(`${student.id}-${col.id}`);
if (val !== null && val !== undefined) {
items.push({ type: 'grade', description: `Grade ${val}/20 on "${col.name}"`, date: col.createdAt });
}
});
attendance.filter(a => a.studentId === student.id).forEach(att => {
items.push({ type: 'attendance', description: `Marked ${att.status} on ${att.date}`, date: att.date });
});
vmRequests.filter(v => v.studentDbId === student.id).forEach(vm => {
items.push({ type: 'vm', description: `VM "${vm.templateName || vm.vmName || 'Request'}" ${vm.status}`, date: vm.requestedAt });
});
return items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 10);
}, [student, columns, gradeMap, attendance, vmRequests]);

useEffect(() => {
if (!student) return;
const fetchGradeVisibility = async () => {
try {
const settingsRes = await fetch('/api/settings');
const settings = await settingsRes.json();
const globalHide = settings.hide_grades_from_students === 'true';
setHideGradesGlobal(globalHide);
const joinedLabIds = studentLabs.filter(sl => sl.studentId === student.id).map(sl => sl.labId);
if (joinedLabIds.length > 0 && instructors.length > 0) {
const labInstructors = instructors.filter(i => joinedLabIds.includes(i.labId));
const anyHidden = labInstructors.some(i => !i.showGrades);
setGradesVisible(!globalHide && !anyHidden);
} else {
setGradesVisible(!globalHide);
}
} catch {
setGradesVisible(true);
}
};
fetchGradeVisibility();
}, [student, studentLabs, instructors]);



if (!student) return null;

const fullName = `${student.firstName} ${student.lastName}`;
const initials = getInitials(student.firstName, student.lastName);
const avatarColor = getAvatarColor(fullName);

const myAttendance = attendance.filter(a => a.studentId === student.id);
const totalSessions = myAttendance.length;
const presentCount = myAttendance.filter(a => a.status === 'present').length;
const attendRate = totalSessions > 0 ? Math.round((presentCount / totalSessions) * 100) : 0;
const attendColor = attendRate >= 80 ? 'text-emerald-600 dark:text-emerald-400' : attendRate >= 60 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400';
const attendStroke = attendRate >= 80 ? 'rgb(16,185,129)' : attendRate >= 60 ? 'rgb(245,158,11)' : 'rgb(239,68,68)';

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
<motion.div {...fadeSlide}>
<div className="flex items-center gap-3 mb-8">
<BreadcrumbNav items={[{ label: 'Dashboard', view: 'student-choice' }, { label: 'Profile' }]} />
<div className="ml-auto flex items-center gap-2">
<Button variant="outline" size="sm" onClick={() => setView('student-choice')}>
Back
</Button>
</div>
</div>

<motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }}>
<Card className="shadow-sm mb-6">
<CardContent className="p-8 flex flex-col items-center text-center">
<div className="relative mb-4">
<div className="absolute -inset-1 rounded-full bg-primary/20 blur-[2px] animate-pulse" />
<StudentAvatar firstName={student.firstName} lastName={student.lastName} size="xl" className="relative ring-2 ring-white dark:ring-gray-900" />
</div>
<h2 className="text-xl font-bold">{fullName}</h2>
<p className="text-sm text-muted-foreground font-mono mt-1">ID: {student.studentId}</p>
<p className="text-xs text-muted-foreground mt-0.5">Registered {fmtDate(student.createdAt)}</p>
<Separator className="my-4 w-48 mx-auto" />
<div className="flex items-center justify-center mt-1">
<div className="relative">
<CircularProgress value={attendRate} size={36} strokeWidth={3} color={attendStroke} />
<span className={`absolute inset-0 flex items-center justify-center text-[10px] font-bold ${attendColor}`}>{attendRate}%</span>
</div>
</div>
<p className="text-xs text-muted-foreground font-mono uppercase tracking-wider mt-2">Attendance</p>
</CardContent>
</Card>
</motion.div>

<motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.2 }}>
<Card className="shadow-sm mb-6">
<CardHeader className="pb-3">
<CardTitle className="text-base">Account Details</CardTitle>
</CardHeader>
<CardContent>
<div className="space-y-3">
<div className="flex items-center justify-between">
<span className="text-sm text-muted-foreground">First Name</span>
<span className="text-sm font-medium">{student.firstName}</span>
</div>
<Separator />
<div className="flex items-center justify-between">
<span className="text-sm text-muted-foreground">Last Name</span>
<span className="text-sm font-medium">{student.lastName}</span>
</div>
<Separator />
<div className="flex items-center justify-between">
<span className="text-sm text-muted-foreground">Student ID</span>
<span className="text-sm font-medium font-mono">{student.studentId}</span>
</div>
<Separator />
<div className="flex items-center justify-between">
<span className="text-sm text-muted-foreground">Account Created</span>
<span className="text-sm font-medium">{fmtDate(student.createdAt)}</span>
</div>
<Separator />
<div className="flex items-center justify-between pt-1">
<span className="text-sm text-muted-foreground">Password</span>
<Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => setChangePasswordOpen(true)}>
<Lock className="h-3 w-3" /> Change Password
</Button>
</div>
</div>
</CardContent>
</Card>
</motion.div>

{student && (
<div className="mt-6">
<StudentNotes studentId={student.id} />
</div>
)}

</motion.div>

<ChangePasswordDialog open={changePasswordOpen} onOpenChange={setChangePasswordOpen} />
</div>
  );
}
