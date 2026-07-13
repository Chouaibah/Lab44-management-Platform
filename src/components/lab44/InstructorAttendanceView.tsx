'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { useLab44Store } from '@/store/lab44';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

import {
  CalendarCheck, RefreshCw, Users, Calendar, Save,
  CheckCircle2, XCircle, Clock,
  UserCheck, UserX, DoorOpen, DoorClosed, Radio,
  Filter, AlertTriangle, Download,
} from 'lucide-react';

import {
  fadeSlide, BreadcrumbNav, EmptyState,
  StudentAvatar, todayDateStr,
} from '@/lib/helpers';


export default function InstructorAttendanceView() {
  const { auth, students, setStudents, attendance, setAttendance, columns, grades, sousGroupes, setSousGroupes, selectedLabId, labs } = useLab44Store();
  const instructor = auth.instructor;
  // Multi-lab support: effective lab ID
  const activeLabId = selectedLabId || instructor?.labId || 0;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [selectedDate, setSelectedDate] = useState(todayDateStr());
  const [attendanceUpdates, setAttendanceUpdates] = useState<Record<number, { status: string; note: string }>>({});

  // Group filter state
  const [selectedGroup, setSelectedGroup] = useState<string>('all');

  // ─── Session State ────────────────────────────────────────────────────────
  const [sessionOpen, setSessionOpen] = useState(false);
  const [sessionDate, setSessionDate] = useState<string | null>(null);
  const [sessionLoading, setSessionLoading] = useState(false);
  const [confirmCloseOpen, setConfirmCloseOpen] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Session group selection
  const [sessionGroupId, setSessionGroupId] = useState<string>('');
  // Active session's group (the group used when session was opened)
  const [sessionActiveSousGroupeId, setSessionActiveSousGroupeId] = useState<string>('');

  const labStudents = useMemo(() =>
    students.filter(s => s.labIds?.includes(activeLabId)),
    [students, activeLabId]
  );

  const labSousGroupes = useMemo(() =>
    sousGroupes,
    [sousGroupes]
  );

  const labColumns = useMemo(() =>
    columns.filter(c => c.labId === activeLabId),
    [columns, activeLabId]
  );

  const labAttendance = useMemo(() => {
    return attendance.filter(a => a.labId === activeLabId);
  }, [attendance, activeLabId]);

  // Filter students by selected group
  const filteredStudents = useMemo(() => {
    if (selectedGroup === 'all') return labStudents;
    const sg = labSousGroupes.find(g => String(g.id) === selectedGroup);
    if (!sg) return labStudents;
    const memberIds = new Set(sg.members.map(m => m.studentId));
    return labStudents.filter(s => memberIds.has(s.id));
  }, [labStudents, selectedGroup, labSousGroupes]);

  const todayAttendance = useMemo(() =>
    labAttendance.filter(a => a.date === selectedDate),
    [labAttendance, selectedDate]
  );

  const uniqueDates = useMemo(() => {
    const dates = new Set(labAttendance.map(a => a.date));
    return Array.from(dates).sort().reverse();
  }, [labAttendance]);

  // Students scoped to the active session's group
  const sessionStudents = useMemo(() => {
    if (!sessionActiveSousGroupeId || sessionActiveSousGroupeId === 'all') return labStudents;
    const sg = labSousGroupes.find(g => String(g.id) === sessionActiveSousGroupeId);
    if (!sg) return labStudents;
    const memberIds = new Set(sg.members.map(m => m.studentId));
    return labStudents.filter(s => memberIds.has(s.id));
  }, [labStudents, sessionActiveSousGroupeId, labSousGroupes]);

  // Session attendance (who marked during the open session)
  const sessionAttendance = useMemo(() => {
    if (!sessionDate) return [];
    return labAttendance.filter(a => a.date === sessionDate);
  }, [labAttendance, sessionDate]);

  const sessionMarkedCount = useMemo(() =>
    sessionAttendance.filter(a => a.status === 'present').length,
    [sessionAttendance]
  );

  const sessionPendingStudents = useMemo(() => {
    const markedIds = new Set(sessionAttendance.filter(a => a.status === 'present').map(a => a.studentId));
    return sessionStudents.filter(s => !markedIds.has(s.id));
  }, [sessionStudents, sessionAttendance]);

  const sessionMarkedStudents = useMemo(() => {
    const markedIds = new Set(sessionAttendance.filter(a => a.status === 'present').map(a => a.studentId));
    return sessionStudents.filter(s => markedIds.has(s.id));
  }, [sessionStudents, sessionAttendance]);

  // Fetch session state
  const fetchSessionState = useCallback(async () => {
    if (!instructor || !activeLabId) return;
    try {
      const res = await fetch(`/api/attendance/session?labId=${activeLabId}`);
      const data = await res.json();
      setSessionOpen(data.open || false);
      setSessionDate(data.date || null);
      setSessionActiveSousGroupeId(data.sousGroupeId || '');
    } catch { /* ignore */ }
  }, [instructor]);

  // Refresh attendance data
  const refreshAttendance = useCallback(async () => {
    try {
      const aRes = await fetch('/api/attendance');
      const aData = await aRes.json();
      setAttendance(Array.isArray(aData) ? aData : []);
    } catch { /* ignore */ }
  }, [setAttendance]);

  // Poll while session is open
  useEffect(() => {
    if (sessionOpen) {
      pollRef.current = setInterval(async () => {
        await refreshAttendance();
      }, 5000);
    } else {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [sessionOpen, refreshAttendance]);

  useEffect(() => {
    if (!instructor || !activeLabId) return;
    let cancelled = false;
    (async () => {
      try {
        const params = new URLSearchParams({ labId: String(activeLabId) });
        const [sRes, aRes, sgRes] = await Promise.all([
          fetch(`/api/students?${params}`),
          fetch('/api/attendance'),
          fetch(`/api/sous-groupes?labId=${activeLabId}`),
        ]);
        const sData = await sRes.json();
        const aData = await aRes.json();
        const sgData = await sgRes.json();
        if (!cancelled) {
          setStudents(Array.isArray(sData) ? sData : []);
          setAttendance(Array.isArray(aData) ? aData : []);
          setSousGroupes(sgData.sousGroupes || []);
        }
      } catch { if (!cancelled) toast.error('Failed to load data'); }
      if (!cancelled) {
        setLoading(false);
        fetchSessionState();
      }
    })();
    return () => { cancelled = true; };
  }, [instructor, activeLabId, setStudents, setAttendance, setSousGroupes, fetchSessionState]);

  // ─── Session Handlers ─────────────────────────────────────────────────────

  const handleOpenSession = async () => {
    if (!instructor || !activeLabId) return;
    setSessionLoading(true);
    try {
      const res = await fetch('/api/attendance/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'open', date: selectedDate, labId: activeLabId, sousGroupeId: sessionGroupId || undefined }),
      });
      const data = await res.json();
      if (!data.ok) { toast.error(data.error || 'Failed to open session'); return; }
      setSessionOpen(true);
      setSessionDate(selectedDate);
      setSessionActiveSousGroupeId(sessionGroupId || '');
      toast.success(`Attendance session opened for ${selectedDate}`);
    } catch { toast.error('Connection error'); }
    setSessionLoading(false);
  };

  const handleCloseSession = async () => {
    if (!instructor || !activeLabId) return;
    setSessionLoading(true);
    setConfirmCloseOpen(false);
    try {
      const res = await fetch('/api/attendance/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'close', labId: activeLabId }),
      });
      const data = await res.json();
      if (!data.ok) { toast.error(data.error || 'Failed to close session'); return; }
      setSessionOpen(false);
      setSessionActiveSousGroupeId('');
      toast.success(`Session closed. ${sessionPendingStudents.length} student(s) auto-marked absent.`);
      await refreshAttendance();
    } catch { toast.error('Connection error'); }
    setSessionLoading(false);
  };

  const getStudentAttendanceForDate = (studentId: number) => {
    return labAttendance.find(a => a.studentId === studentId && a.date === selectedDate);
  };

  const handleStatusChange = (studentId: number, status: string) => {
    setAttendanceUpdates(prev => ({
      ...prev,
      [studentId]: {
        status,
        note: prev[studentId]?.note || '',
      },
    }));
  };

  const handleNoteChange = (studentId: number, note: string) => {
    setAttendanceUpdates(prev => ({
      ...prev,
      [studentId]: {
        status: prev[studentId]?.status || 'present',
        note,
      },
    }));
  };

  const handleSaveAttendance = async () => {
    if (!instructor || !activeLabId) return;
    if (Object.keys(attendanceUpdates).length === 0) {
      toast.error('No changes to save');
      return;
    }

    setSaving(true);
    try {
      const updates = Object.entries(attendanceUpdates).map(([studentId, data]) => ({
        studentId: parseInt(studentId),
        date: selectedDate,
        labId: activeLabId,
        status: data.status,
        note: data.note || null,
      }));

      const res = await fetch('/api/attendance/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });

      const result = await res.json();
      if (!result.ok) {
        toast.error(result.error || 'Failed to save attendance');
        return;
      }

      toast.success(`Attendance saved for ${updates.length} students`);
      setAttendanceUpdates({});

      const aRes = await fetch('/api/attendance');
      const aData = await aRes.json();
      setAttendance(Array.isArray(aData) ? aData : []);
    } catch {
      toast.error('Connection error');
    }
    setSaving(false);
  };

  const handleQuickMarkAll = async (status: 'present' | 'absent') => {
    if (!instructor || !activeLabId) return;
    const newUpdates: Record<number, { status: string; note: string }> = {};
    filteredStudents.forEach(s => {
      const existing = getStudentAttendanceForDate(s.id);
      if (!existing) {
        newUpdates[s.id] = { status, note: '' };
      }
    });

    if (Object.keys(newUpdates).length === 0) {
      toast.info('All students already marked');
      return;
    }

    setAttendanceUpdates(newUpdates);
  };

  const handleExportCSV = () => {
    if (uniqueDates.length === 0 || labStudents.length === 0) {
      toast.error('No data to export');
      return;
    }
    const headers = ['Student Last Name', 'Student First Name', 'Student ID', 'Group', ...uniqueDates];
    const rows = labStudents.map(student => {
      const studentGroup = labSousGroupes.find(sg => sg.members.some(m => m.studentId === student.id));
      return [
        student.lastName,
        student.firstName,
        student.studentId,
        studentGroup?.name || '',
        ...uniqueDates.map(date => {
          const record = labAttendance.find(a => a.studentId === student.id && a.date === date);
          return record?.status || '';
        }),
      ];
    });
    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `attendance_${instructor?.labName || 'lab'}_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success('Attendance history exported to CSV');
  };

  if (!instructor) return null;

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-6 sm:py-8 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:py-8">
      <motion.div {...fadeSlide}>
        <BreadcrumbNav items={[
          { label: 'Instructor', view: 'instructor-panel' },
          { label: 'Attendance' },
        ]} />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">

              <span className="text-primary font-semibold">Attendance Management</span>
            </h1>
            <p className="text-sm text-muted-foreground">
              Mark and track student attendance
            </p>
          </div>

            <div className="flex items-center gap-2">
              <Label className="text-sm font-medium">Date:</Label>
              <Input
                type="date"
                value={selectedDate}
                onChange={(e) => {
                  setSelectedDate(e.target.value);
                  setAttendanceUpdates({});
                }}
                max={todayDateStr()}
                className="w-40"
              />
            </div>
        </div>



        {/* ─── Attendance Session Control Panel ─────────────────────────────── */}
        {sessionOpen ? (
          <Card className="shadow-sm mb-6">
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-100 dark:bg-cyan-900/30">
                    <DoorOpen className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold">Session Live</h3>
                    <p className="text-xs text-muted-foreground">
                      {sessionDate} · {sessionMarkedCount}/{sessionStudents.length} marked
                    </p>
                  </div>
                </div>
                <Button onClick={() => setConfirmCloseOpen(true)} disabled={sessionLoading} variant="destructive" size="sm" className="gap-1">
                  {sessionLoading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <DoorClosed className="h-3.5 w-3.5" />}
                  Close Session
                </Button>
              </div>

              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3 rounded-lg border bg-muted/30">
                  <div className="flex items-center gap-2 mb-2">
                    <UserCheck className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs font-semibold">Marked ({sessionMarkedStudents.length})</span>
                  </div>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {sessionMarkedStudents.length === 0 ? (
                      <p className="text-xs text-muted-foreground italic">No students marked yet...</p>
                    ) : (
                      sessionMarkedStudents.map(s => (
                        <div key={s.id} className="flex items-center gap-2 py-0.5">
                          <span className="text-xs truncate">{s.lastName} {s.firstName}</span>
                          <span className="text-[10px] text-muted-foreground font-mono ml-auto">{s.studentId}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="p-3 rounded-lg border bg-muted/30">
                  <div className="flex items-center gap-2 mb-2">
                    <UserX className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs font-semibold">Pending ({sessionPendingStudents.length})</span>
                  </div>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {sessionPendingStudents.length === 0 ? (
                      <p className="text-xs text-muted-foreground italic">All students marked!</p>
                    ) : (
                      sessionPendingStudents.map(s => (
                        <div key={s.id} className="flex items-center gap-2 py-0.5">
                          <span className="text-xs truncate">{s.lastName} {s.firstName}</span>
                          <span className="text-[10px] text-muted-foreground font-mono ml-auto">{s.studentId}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-3 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <RefreshCw className="h-2.5 w-2.5 animate-spin" style={{ animationDuration: '3s' }} />
                Auto-refreshing every 5 seconds
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="shadow-sm mb-6">
            <CardContent className="p-4">
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-100 dark:bg-cyan-900/30">
                    <DoorOpen className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold">Self-Registration Attendance</h3>
                    <p className="text-xs text-muted-foreground">
                      Open a session so students can mark themselves present for the selected date
                    </p>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex items-center gap-2 flex-1">
                    <Label className="text-xs font-medium whitespace-nowrap">Group:</Label>
                    <Select value={sessionGroupId} onValueChange={setSessionGroupId}>
                      <SelectTrigger className="h-8 w-48">
                        <SelectValue placeholder="All groups" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All groups</SelectItem>
                        {labSousGroupes.map(sg => (
                          <SelectItem key={sg.id} value={String(sg.id)}>
                            {sg.name} ({sg.members.length})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    onClick={handleOpenSession}
                    disabled={sessionLoading || !sessionGroupId}
                    className="gap-1.5"
                  >
                    {sessionLoading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <DoorOpen className="h-3.5 w-3.5" />}
                    Open Session for {selectedDate}
                  </Button>
                </div>
                {!sessionGroupId && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" /> Please select a group before opening the session
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Close Session Confirmation */}
        <AlertDialog open={confirmCloseOpen} onOpenChange={setConfirmCloseOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Close Attendance Session?</AlertDialogTitle>
              <AlertDialogDescription>
                <span className="block mb-2">
                  This will close the attendance session for <strong>{sessionDate}</strong>.
                </span>
                <span className="block mb-2">
                  <strong>{sessionMarkedCount}</strong> student(s) marked present.
                  <strong> {sessionPendingStudents.length}</strong> student(s) will be auto-marked as <span className="text-red-600 dark:text-red-400 font-semibold">absent</span>.
                </span>
                {sessionPendingStudents.length > 0 && (
                  <span className="block text-xs text-muted-foreground">
                    Pending: {sessionPendingStudents.map(s => `${s.lastName} ${s.firstName}`).join(', ')}
                  </span>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleCloseSession} className="bg-red-600 hover:bg-red-700">
                Close Session & Mark Absent
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>


        {/* ─── Group Selector & Quick Actions ─────────────────────────────── */}
        <div className="flex items-center gap-3 mb-6">
        {/* Group selector */}
        <div className="flex items-center gap-2">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <Label className="text-sm font-medium whitespace-nowrap">Group:</Label>
        <Select value={selectedGroup} onValueChange={setSelectedGroup}>
        <SelectTrigger className="w-44">
        <SelectValue placeholder="All Students" />
        </SelectTrigger>
        <SelectContent>
        <SelectItem value="all">All Students</SelectItem>
        {labSousGroupes.map(sg => (
          <SelectItem key={sg.id} value={String(sg.id)}>
          {sg.name} ({sg.members.length})
          </SelectItem>
        ))}
        </SelectContent>
        </Select>
        </div>

        {/* Quick action buttons */}
        <Button
        variant="outline"
        size="sm"
        onClick={() => handleQuickMarkAll('present')}
        className="gap-1.5"
        >
        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
        Mark All Present
        </Button>
        <Button
        variant="outline"
        size="sm"
        onClick={() => handleQuickMarkAll('absent')}
        className="gap-1.5"
        >
        <XCircle className="h-3.5 w-3.5 text-red-500" />
        Mark All Absent
        </Button>
        <Button
        onClick={handleSaveAttendance}
        disabled={saving || Object.keys(attendanceUpdates).length === 0}
        className="ml-auto gap-1.5"
        >
        {saving ? (
          <RefreshCw className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Save className="h-3.5 w-3.5" />
        )}
        {saving ? 'Saving...' : `Save (${Object.keys(attendanceUpdates).length})`}
        </Button>
        </div>

        {/* Attendance Table */}
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">

              Students Attendance
              <Badge variant="secondary" className="text-[10px] px-1.5 h-5">{filteredStudents.length}</Badge>
            </CardTitle>
            <CardDescription>
              {selectedDate} · Mark and track student attendance
            </CardDescription>
          </CardHeader>
          <CardContent>
            {filteredStudents.length === 0 ? (
              <EmptyState
                icon={Users}
                title="No Students"
                description={selectedGroup !== 'all' ? 'No students in the selected group.' : 'No students are assigned to your lab.'}
              />
            ) : (
              <div className="max-h-[50vh] overflow-y-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow className="sticky top-0 bg-background z-10">
                      <TableHead className="text-xs">Student</TableHead>
                      <TableHead className="text-xs">ID</TableHead>
                      <TableHead className="text-xs text-center">Status</TableHead>
                      <TableHead className="text-xs">Note</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredStudents.map((student) => {
                      const existing = getStudentAttendanceForDate(student.id);
                      const update = attendanceUpdates[student.id];
                      const currentStatus = update?.status || existing?.status || 'pending';
                      const currentNote = update?.note || existing?.note || '';

                      return (
                        <TableRow key={student.id} className="hover:bg-muted/30">
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              <StudentAvatar firstName={student.firstName} lastName={student.lastName} size="sm" />
                              <span>{student.lastName} {student.firstName}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground font-mono">
                            {student.studentId}
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center gap-1">
                              {['present', 'absent'].map((status) => (
                                <button
                                  key={status}
                                  onClick={() => handleStatusChange(student.id, status)}
                                  className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                                    currentStatus === status
                                      ? status === 'present' ? 'bg-emerald-500 text-white shadow-sm'
                                        : 'bg-red-500 text-white shadow-sm'
                                      : 'bg-muted hover:bg-muted/80 text-muted-foreground'
                                  }`}
                                >
                                  {status.charAt(0).toUpperCase() + status.slice(1)}
                                </button>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Input
                              value={currentNote}
                              onChange={(e) => handleNoteChange(student.id, e.target.value)}
                              placeholder="Optional note..."
                              className="h-7 text-xs"
                            />
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

        {/* Attendance History */}
        <Card className="shadow-sm mt-6 overflow-hidden">
        <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
        <div>
        <CardTitle className="text-base flex items-center gap-2">

        Attendance History
        </CardTitle>
        <CardDescription className="mt-1">
        {uniqueDates.length > 0
          ? `${uniqueDates.length} recorded session${uniqueDates.length !== 1 ? 's' : ''} · Click to view details`
          : 'No attendance records yet'}
          </CardDescription>
          </div>
           {uniqueDates.length > 0 && (
            <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-3 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Present</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-500" /> Absent</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCSV}
              className="gap-1.5"
            >
              <Download className="h-3.5 w-3.5" />
              CSV
            </Button>
            </div>
          )}
          </div>
          </CardHeader>
          <CardContent>
          {uniqueDates.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="relative mb-4">
            <div className="absolute inset-0 flex items-center justify-center">
            <div className="h-14 w-14 rounded-full bg-muted-foreground/5 animate-ping" style={{ animationDuration: '3s' }} />
            </div>
            <Calendar className="h-10 w-10 text-muted-foreground/30 relative" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">No attendance records yet</p>
            <p className="text-xs text-muted-foreground/70 mt-1">Mark attendance above to start building history</p>
            </div>
          ) : (
            <div className="space-y-1.5 max-h-80 overflow-y-auto pr-1">
            {uniqueDates.slice(0, 30).map((date, idx) => {
              const dateRecords = labAttendance.filter(a => a.date === date);
              const present = dateRecords.filter(r => r.status === 'present').length;
              const absent = dateRecords.filter(r => r.status === 'absent').length;
              const total = dateRecords.length;
              const rate = total > 0 ? Math.round((present / total) * 100) : 0;
              const isSelected = selectedDate === date;
              const pctPresent = total > 0 ? (present / total) * 100 : 0;
              const pctAbsent = total > 0 ? (absent / total) * 100 : 0;

              let dayName: string;
              let monthDay: string;
              let year: number;
              try {
                const d = new Date(date + 'T00:00:00');
                dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
                monthDay = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                year = d.getFullYear();
              } catch {
                dayName = '';
                monthDay = String(date);
                year = NaN;
              }

              return (
                <motion.div
                key={date}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.03, duration: 0.2 }}
                onClick={() => { setSelectedDate(date); setAttendanceUpdates({}); }}
                className={`group relative rounded-xl border transition-all duration-200 cursor-pointer overflow-hidden ${
                  isSelected
                  ? 'border-cyan-300 dark:border-cyan-700 bg-cyan-50/50 dark:bg-cyan-950/20 shadow-sm ring-1 ring-cyan-200/50 dark:ring-cyan-800/50'
                  : 'border-border/40 hover:border-border/80 hover:shadow-sm'
                }`}
                >
                <div className="flex items-center gap-3 p-3">
                <div className={`flex flex-col items-center justify-center w-11 h-11 rounded-lg shrink-0 transition-colors ${
                  isSelected
                  ? 'bg-cyan-100 dark:bg-cyan-900/40'
                  : rate >= 80 ? 'bg-emerald-50 dark:bg-emerald-900/20 group-hover:bg-emerald-100 dark:group-hover:bg-emerald-900/30'
                  : rate >= 60 ? 'bg-amber-50 dark:bg-amber-900/20 group-hover:bg-amber-100 dark:group-hover:bg-amber-900/30'
                  : 'bg-red-50 dark:bg-red-900/20 group-hover:bg-red-100 dark:group-hover:bg-red-900/30'
                }`}>
                <span className={`text-[10px] font-semibold leading-none ${
                  isSelected ? 'text-cyan-600 dark:text-cyan-400' : 'text-muted-foreground'
                }`}>{dayName}</span>
                <span className={`text-sm font-bold leading-tight mt-0.5 ${
                  isSelected ? 'text-cyan-700 dark:text-cyan-300' : ''
                }`}>{monthDay.split(' ')[1]}</span>
                {/* Year intentionally removed from the badge – shown only in the text next to the badge */}
                </div>

                <div className="flex-1 min-w-0 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                <span className="text-sm font-medium truncate">{monthDay}{!isNaN(year) && `, ${year}`}</span>
                {isSelected && (
                  <Badge className="bg-cyan-100 text-cyan-700 border-cyan-200 dark:bg-cyan-900/30 dark:text-cyan-400 dark:border-cyan-800 text-[9px] px-1.5 py-0 shrink-0">
                  Selected
                  </Badge>
                )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                <span className={`text-sm font-bold tabular-nums ${
                  isSelected ? 'text-cyan-600 dark:text-cyan-400'
                  : rate >= 80 ? 'text-emerald-600 dark:text-emerald-400'
                  : rate >= 60 ? 'text-amber-600 dark:text-amber-400'
                  : 'text-red-600 dark:text-red-400'
                }`}>{rate}%</span>
                </div>
                </div>

                <div className="flex items-center gap-2">
                <div className="flex-1 h-2 rounded-full bg-muted-foreground/10 dark:bg-muted-foreground/15 overflow-hidden">
                <div className="flex h-full rounded-full overflow-hidden">
                <div className="bg-emerald-500 transition-all duration-500" style={{ width: `${pctPresent}%` }} />
                <div className="bg-red-500 transition-all duration-500" style={{ width: `${pctAbsent}%` }} />
                </div>
                </div>
                </div>

                <div className="flex items-center gap-2.5 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-0.5"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />{present}P</span>
                <span className="flex items-center gap-0.5"><span className="h-1.5 w-1.5 rounded-full bg-red-500" />{absent}A</span>
                <span className="ml-auto text-muted-foreground/50">{total} total</span>
                </div>
                </div>
                </div>
                </motion.div>
              );
            })}
            </div>
          )}
          </CardContent>
          </Card>
      </motion.div>
    </div>
  );
}
