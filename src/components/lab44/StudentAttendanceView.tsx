'use client';

import {
  Tooltip, TooltipTrigger, TooltipContent, TooltipProvider,
} from '@/components/ui/tooltip';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { useLab44Store } from '@/store/lab44';
import type { Attendance } from '@/types';
import { SessionLiveCard } from '@/components/lab44/SessionLiveCard';

import {
  Card, CardContent, CardHeader, CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';

import {
  CalendarCheck, Calendar, RefreshCw, Activity,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

import {
  BreadcrumbNav, fadeSlide, attendanceStatusBadge,
} from '@/lib/helpers';

// ─── Attendance Calendar Component ──────────────────────────────────────────────

function AttendanceCalendar({ records }: { records: Attendance[] }) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = now.getDate();
  const monthName = now.toLocaleString('en-US', { month: 'long', year: 'numeric' });

  const getAttendanceForDay = (day: number): Attendance | undefined => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return records.find(r => r.date === dateStr);
  };

  const getDayColor = (day: number): string => {
    const rec = getAttendanceForDay(day);
    if (!rec) return 'bg-muted-foreground/5 dark:bg-muted-foreground/5 text-muted-foreground';
    switch (rec.status) {
      case 'present': return 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300';
      case 'absent': return 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300';
      default: return 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300';
    }
  };

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div>
      <p className="text-sm font-semibold mb-3">{monthName}</p>
      <div className="grid grid-cols-7 gap-1">
        {dayNames.map(day => (
          <div key={day} className="text-center text-[10px] font-semibold text-muted-foreground uppercase py-1">{day}</div>
        ))}
        {cells.map((day, idx) => {
          if (day === null) return <div key={`empty-${idx}`} />;
          const isToday = day === today;
          const rec = getAttendanceForDay(day);
          return (
            <Tooltip key={day}>
              <TooltipTrigger asChild>
                <div
                  className={`relative flex flex-col items-center justify-center h-9 rounded-lg text-xs font-medium transition-colors cursor-default ${getDayColor(day)} ${isToday ? 'ring-2 ring-primary ring-offset-1 font-bold' : ''}`}
                >
                  {day}
                  {rec && (
                    <span className="absolute bottom-0.5 w-1 h-1 rounded-full bg-current opacity-40" />
                  )}
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs">{`${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`}</p>
                <p className="text-xs">{rec ? (rec.status === 'present' ? 'Present' : rec.status === 'absent' ? 'Absent' : 'Present') : 'No record'}</p>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
      <div className="flex items-center justify-center gap-3 mt-3 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded bg-emerald-100 dark:bg-emerald-900/40 border border-emerald-300 dark:border-emerald-700" /> Present</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded bg-red-100 dark:bg-red-900/40 border border-red-300 dark:border-red-700" /> Absent</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded bg-muted-foreground/5 border border-muted-foreground/20" /> No record</span>
      </div>
    </div>
  );
}

// ─── Student Attendance View ──────────────────────────────────────────────────

export default function StudentAttendanceView() {
  const { auth, attendance, setAttendance, setView, labs } = useLab44Store();
  const [loading, setLoading] = useState(true);
  const student = auth.student;

  // ─── Session State ────────────────────────────────────────────────────────
  const [sessionOpen, setSessionOpen] = useState(false);
  const [sessionDate, setSessionDate] = useState<string | null>(null);
  const [sessionLabId, setSessionLabId] = useState<number | null>(null);
  const [sessionGroupName, setSessionGroupName] = useState<string | null>(null);
  const [markingPresent, setMarkingPresent] = useState(false);
  const [alreadyMarked, setAlreadyMarked] = useState(false);

  const fetchData = useCallback(async () => {
    if (!student) return;
    setLoading(true);
    try {
      const [attRes, sessionRes] = await Promise.all([
        fetch(`/api/attendance?studentDbId=${student.id}`),
        fetch('/api/attendance/session'),
      ]);
      const attData = await attRes.json();
      const sessionData = await sessionRes.json();
      setAttendance(attData || []);
      // Check for open sessions
      const sessions = sessionData.sessions || [];
      if (sessions.length > 0) {
        const openSession = sessions[0];
        setSessionOpen(true);
        setSessionDate(openSession.date);
        setSessionLabId(openSession.labId);
        // Set group name if a group is specified
        if (openSession.sousGroupeId) {
          try {
            const sgRes = await fetch(`/api/sous-groupes?labId=${openSession.labId}`);
            const sgData = await sgRes.json();
            const groups: { id: number; name: string }[] = sgData.sousGroupes || [];
            const group = groups.find((g: { id: number; name: string }) => g.id === parseInt(openSession.sousGroupeId));
            setSessionGroupName(group?.name || null);
          } catch {
            setSessionGroupName(null);
          }
        } else {
          setSessionGroupName(null);
        }
        // Check if already marked
        const marked = (attData || []).some(
          (a: { date: string; status: string }) => a.date === openSession.date && a.status === 'present'
        );
        setAlreadyMarked(marked);
      } else {
        setSessionOpen(false);
        setSessionDate(null);
        setSessionLabId(null);
        setAlreadyMarked(false);
      }
    } catch {
      toast.error('Failed to load attendance');
    }
    setLoading(false);
  }, [student, setAttendance]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleMarkPresent = async () => {
    if (!student) return;
    setMarkingPresent(true);
    try {
      const res = await fetch('/api/attendance/mark', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId: student.id, labId: sessionLabId }),
      });
      const data = await res.json();
      if (!data.ok) {
        toast.error(data.error || 'Failed to mark attendance');
        setMarkingPresent(false);
        return;
      }
      setAlreadyMarked(true);
      toast.success('You have been marked present! ✓');
      // Refresh attendance
      const attRes = await fetch(`/api/attendance?studentDbId=${student.id}`);
      const attData = await attRes.json();
      setAttendance(attData || []);
    } catch { toast.error('Connection error'); }
    setMarkingPresent(false);
  };

  const records = [...attendance].sort((a, b) => b.date.localeCompare(a.date));
  const presentCount = records.filter(r => r.status === 'present').length;

  // Group records by labId
  const recordsByLab = useMemo(() => {
    const grouped: Record<number, Attendance[]> = {};
    for (const rec of records) {
      if (!grouped[rec.labId]) grouped[rec.labId] = [];
      grouped[rec.labId].push(rec);
    }
    return grouped;
  }, [records]);

  if (!student) return null;

  // ─── Loading State ────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8 space-y-6">
        <Skeleton className="h-6 w-64" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <motion.div {...fadeSlide}>

        {/* ─── 1. Breadcrumb + Action Bar ──────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
          <BreadcrumbNav items={[{ label: 'Dashboard', view: 'student-choice' }, { label: 'Attendance' }]} />
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
              <RefreshCw className={`h-3.5 w-3.5 mr-1 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </Button>
          </div>
        </div>

          {/* ─── 2. Attendance Session Live (instructor card style) ───────── */}
          <AnimatePresence>
            {sessionOpen && (
              <SessionLiveCard
                animated
                className="mb-6"
                date={sessionDate}
                marked={alreadyMarked}
                marking={markingPresent}
                onMark={handleMarkPresent}
                subtitle={
                  alreadyMarked ? (
                    <>
                      Attendance recorded for <span className="font-mono font-medium">{sessionDate}</span>
                      {sessionGroupName && (
                        <>
                          {' '}&middot; Group:{' '}
                          <span className="font-semibold text-violet-600 dark:text-violet-400">{sessionGroupName}</span>
                        </>
                      )}
                    </>
                  ) : (
                    <>
                      Mark yourself present for <span className="font-mono font-medium">{sessionDate}</span>
                      {sessionGroupName && (
                        <>
                          {' '}&middot; Group:{' '}
                          <span className="font-semibold text-violet-600 dark:text-violet-400">{sessionGroupName}</span>
                        </>
                      )}
                    </>
                  )
                }
              />
            )}
          </AnimatePresence>

        {/* ─── 3. Attendance Records Table ──────────────────────────────────── */}
        <Card className="shadow-sm mb-6 overflow-hidden">
        <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
        <CardTitle className="text-base flex items-center gap-2">
        <Activity className="h-4 w-4 text-emerald-500" />
        Attendance Records
        {Object.keys(recordsByLab).length > 1 && (
          <Badge variant="secondary" className="text-[10px]">
          {Object.keys(recordsByLab).length} labs
          </Badge>
        )}
        </CardTitle>
        <div className="flex items-center gap-2">
        {presentCount > 0 && (
          <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800 text-[10px] font-mono">
          {presentCount} Present
          </Badge>
        )}
        </div>
        </div>
        </CardHeader>
        <CardContent className="p-0">
        {records.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted/50 mb-4">
          <CalendarCheck className="h-8 w-8 text-muted-foreground/40" />
          </div>
          <h3 className="font-semibold mb-1">No Attendance Records</h3>
          <p className="text-sm text-muted-foreground">Your attendance has not been recorded yet.</p>
          </div>
        ) : (
          <ScrollArea className="h-[350px]">
          {Object.keys(recordsByLab).length > 1 ? (
            /* Grouped by lab when multiple labs */
            <div className="space-y-4 p-4">
            {Object.entries(recordsByLab).map(([labIdStr, labRecords]) => {
              const labId = parseInt(labIdStr);
              const lab = labs.find(l => l.id === labId);
              return (
                <div key={labId}>
                <div className="flex items-center gap-2 mb-2">
                <h4 className="text-sm font-semibold">
                {lab?.name || `Lab #${labId}`}
                </h4>
                {lab?.level && <Badge variant="outline" className="text-[9px]">{lab.level}</Badge>}
                <Badge variant="secondary" className="text-[9px]">
                {labRecords.filter(r => r.status === 'present').length}/{labRecords.length} present
                </Badge>
                </div>
                <Table>
                <TableHeader>
                <TableRow>
                <TableHead className="text-xs">Date</TableHead>
                <TableHead className="text-xs text-center">Status</TableHead>
                <TableHead className="text-xs">Note</TableHead>
                </TableRow>
                </TableHeader>
                <TableBody>
                {labRecords.map((rec, idx) => (
                  <TableRow key={rec.id} className={idx % 2 === 0 ? 'bg-transparent' : 'bg-muted/30'}>
                  <TableCell className="font-mono text-sm">{rec.date}</TableCell>
                  <TableCell className="text-center">{attendanceStatusBadge(rec.status)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                  {rec.note || '\u2014'}
                  </TableCell>
                  </TableRow>
                ))}
                </TableBody>
                </Table>
                </div>
              );
            })}
            </div>
          ) : (
            <Table>
            <TableHeader>
            <TableRow>
            <TableHead className="text-xs">Date</TableHead>
            <TableHead className="text-xs text-center">Status</TableHead>
            <TableHead className="text-xs">Note</TableHead>
            </TableRow>
            </TableHeader>
            <TableBody>
            {records.map((rec, idx) => (
              <TableRow key={rec.id} className={idx % 2 === 0 ? 'bg-transparent' : 'bg-muted/30'}>
              <TableCell className="font-mono text-sm">{rec.date}</TableCell>
              <TableCell className="text-center">{attendanceStatusBadge(rec.status)}</TableCell>
              <TableCell className="text-sm text-muted-foreground">
              {rec.note || '—'}
              </TableCell>
              </TableRow>
            ))}
            </TableBody>
            </Table>
          )}
          </ScrollArea>
        )}
        </CardContent>
        </Card>

        {/* ─── 4. Monthly Calendar Card ──────────────────────────────────────── */}
        <Card className="shadow-sm mb-6">
        <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
        <Calendar className="h-4 w-4 text-emerald-500" />
        Monthly Calendar
        </CardTitle>
        </CardHeader>
        <CardContent>
        <TooltipProvider>
        <AttendanceCalendar records={records} />
        </TooltipProvider>
        </CardContent>
        </Card>

        {/* ─── Legend ──────────────────────────────────────────────────────── */}
        <div className="mt-6 flex items-center justify-center gap-4 text-xs text-muted-foreground flex-wrap">
          <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-emerald-500" /> Present</span>
          <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-red-500" /> Absent</span>
        </div>
      </motion.div>
    </div>
  );
}
