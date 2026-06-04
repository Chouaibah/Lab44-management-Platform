'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from '@/components/ui/chart';

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
} from 'recharts';

import {
  BarChart3, CalendarCheck, Download, FileText, Filter,
  RefreshCw, Users, Calendar, TrendingUp, ArrowUpDown,
  CheckCircle2, XCircle, Clock, AlertCircle, Printer,
} from 'lucide-react';

import { fadeSlide, BreadcrumbNav, EmptyState, todayDateStr } from '@/lib/helpers';

// ─── Types ────────────────────────────────────────────────────────────────────

interface StudentSummary {
  studentId: number;
  firstName: string;
  lastName: string;
  studentCode: string;
  present: number;
  absent: number;
  late: number;
  excused: number;
  total: number;
  rate: number;
}

interface DailyBreakdown {
  date: string;
  present: number;
  absent: number;
  late: number;
  excused: number;
  total: number;
  rate: number;
}

interface AttendanceReport {
  labId: number;
  labName: string;
  totalSessions: number;
  overallRate: number;
  mostCommonStatus: string;
  students: StudentSummary[];
  dailyBreakdown: DailyBreakdown[];
}

// ─── Chart Config ─────────────────────────────────────────────────────────────

const chartConfig: ChartConfig = {
  present: { label: 'Present', color: '#10b981' },
  absent: { label: 'Absent', color: '#ef4444' },
  late: { label: 'Late', color: '#f59e0b' },
};

// ─── Sort Direction Helper ────────────────────────────────────────────────────

type SortField = 'lastName' | 'rate' | 'present' | 'absent' | 'late' | 'excused';
type SortDir = 'asc' | 'desc';

// ─── Sortable Header Component (outside render) ──────────────────────────────

function SortableHeader({ field, children, currentSortField, currentSortDir, onToggleSort }: {
  field: SortField;
  children: React.ReactNode;
  currentSortField: SortField;
  currentSortDir: SortDir;
  onToggleSort: (field: SortField) => void;
}) {
  return (
    <TableHead className="text-xs cursor-pointer select-none hover:bg-muted/50 transition-colors" onClick={() => onToggleSort(field)}>
      <div className="flex items-center gap-1">
        {children}
        <ArrowUpDown className={`h-3 w-3 ${currentSortField === field ? 'text-primary' : 'text-muted-foreground/40'}`} />
      </div>
    </TableHead>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AttendanceReportView() {
  const { auth, labs, setLabs } = useLab44Store();
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<AttendanceReport | null>(null);

  // Filter state
  const [selectedLabId, setSelectedLabId] = useState<string>('');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>(todayDateStr());

  // Sort state for student table
  const [sortField, setSortField] = useState<SortField>('lastName');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  // Load labs
  useEffect(() => {
    const loadLabs = async () => {
      try {
        const res = await fetch('/api/labs');
        const data = await res.json();
        if (data.labs) setLabs(data.labs);
      } catch { /* ignore */ }
    };
    loadLabs();
  }, [setLabs]);

  // Auto-select lab for instructor
  useEffect(() => {
    if (auth.role === 'instructor' && auth.instructor?.labId && !selectedLabId) {
      setSelectedLabId(String(auth.instructor.labId));
    }
  }, [auth, selectedLabId]);

  // Generate report
  const generateReport = useCallback(async () => {
    if (!selectedLabId) {
      toast.error('Please select a lab');
      return;
    }

    setLoading(true);
    try {
      const params = new URLSearchParams({ labId: selectedLabId });
      if (fromDate) params.set('from', fromDate);
      if (toDate) params.set('to', toDate);

      const res = await fetch(`/api/attendance/report?${params}`);
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || 'Failed to generate report');
        return;
      }

      const data: AttendanceReport = await res.json();
      setReport(data);
      toast.success('Report generated');
    } catch {
      toast.error('Connection error');
    }
    setLoading(false);
  }, [selectedLabId, fromDate, toDate]);

  // Export CSV
  const exportCSV = useCallback(async () => {
    if (!selectedLabId) return;

    try {
      const params = new URLSearchParams({ labId: selectedLabId, format: 'csv' });
      if (fromDate) params.set('from', fromDate);
      if (toDate) params.set('to', toDate);

      const res = await fetch(`/api/attendance/report?${params}`);
      if (!res.ok) {
        toast.error('Failed to export CSV');
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `attendance-report-lab${selectedLabId}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('CSV exported');
    } catch {
      toast.error('Failed to export CSV');
    }
  }, [selectedLabId, fromDate, toDate]);

  // Export PDF (print)
  const exportPDF = useCallback(() => {
    window.print();
  }, []);

  // Sort student summary
  const sortedStudents = useMemo(() => {
    if (!report) return [];
    const sorted = [...report.students].sort((a, b) => {
      let aVal: string | number;
      let bVal: string | number;

      switch (sortField) {
        case 'lastName': aVal = a.lastName; bVal = b.lastName; break;
        case 'rate': aVal = a.rate; bVal = b.rate; break;
        case 'present': aVal = a.present; bVal = b.present; break;
        case 'absent': aVal = a.absent; bVal = b.absent; break;
        case 'late': aVal = a.late; bVal = b.late; break;
        case 'excused': aVal = a.excused; bVal = b.excused; break;
        default: aVal = a.lastName; bVal = b.lastName;
      }

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return sortDir === 'asc' ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
    });
    return sorted;
  }, [report, sortField, sortDir]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  // Chart data
  const chartData = useMemo(() => {
    if (!report) return [];
    return report.dailyBreakdown.map((d) => ({
      date: d.date,
      present: d.present,
      absent: d.absent,
      late: d.late,
    }));
  }, [report]);

  // Rate badge color
  const rateColor = (rate: number) => {
    if (rate >= 80) return 'text-emerald-600 dark:text-emerald-400';
    if (rate >= 60) return 'text-amber-600 dark:text-amber-400';
    return 'text-red-600 dark:text-red-400';
  };

  const rateBgColor = (rate: number) => {
    if (rate >= 80) return 'bg-emerald-500';
    if (rate >= 60) return 'bg-amber-500';
    return 'bg-red-500';
  };

  const statusIcon = (status: string) => {
    switch (status) {
      case 'present': return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
      case 'absent': return <XCircle className="h-4 w-4 text-red-500" />;
      case 'late': return <Clock className="h-4 w-4 text-amber-500" />;
      default: return <AlertCircle className="h-4 w-4 text-violet-500" />;
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:py-8 print:py-2 print:px-2">
      <motion.div {...fadeSlide}>
        <BreadcrumbNav items={[
          ...(auth.role === 'admin'
            ? [{ label: 'Admin', view: 'admin-panel' as const }]
            : [{ label: 'Dashboard', view: 'instructor-panel' as const }]),
          { label: 'Attendance Report' },
        ]} />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <BarChart3 className="h-6 w-6 text-cyan-500" />
              <span className="text-primary font-semibold">Attendance Report</span>
            </h1>
            <p className="text-sm text-muted-foreground">
              Per-lab date-range summaries with export
            </p>
          </div>
        </div>

        {/* ─── Filter Controls ──────────────────────────────────────────────── */}
        <Card className="shadow-sm mb-6 print:hidden">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row items-end gap-4">
              <div className="flex-1 min-w-0 space-y-1.5">
                <Label className="text-xs font-medium">Lab</Label>
                <Select
                  value={selectedLabId}
                  onValueChange={setSelectedLabId}
                  disabled={auth.role === 'instructor'}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a lab..." />
                  </SelectTrigger>
                  <SelectContent>
                    {labs.map((lab) => (
                      <SelectItem key={lab.id} value={String(lab.id)}>
                        {lab.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">From</Label>
                <Input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="w-40"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">To</Label>
                <Input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="w-40"
                />
              </div>

              <Button
                onClick={generateReport}
                disabled={loading || !selectedLabId}
                className="gap-1.5 shrink-0"
              >
                {loading ? (
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Filter className="h-3.5 w-3.5" />
                )}
                {loading ? 'Generating...' : 'Generate Report'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* ─── Loading State ────────────────────────────────────────────────── */}
        {loading && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
            </div>
            <Skeleton className="h-64 rounded-xl" />
            <Skeleton className="h-64 rounded-xl" />
          </div>
        )}

        {/* ─── No Report State ──────────────────────────────────────────────── */}
        {!loading && !report && (
          <EmptyState
            icon={CalendarCheck}
            title="No Report Generated"
            description="Select a lab and date range, then click Generate Report to view attendance summaries."
          />
        )}

        {/* ─── Report Content ───────────────────────────────────────────────── */}
        {!loading && report && (
          <div className="space-y-6">
            {/* Export Buttons */}
            <div className="flex items-center gap-2 print:hidden">
              <Button variant="outline" size="sm" onClick={exportCSV} className="gap-1.5">
                <Download className="h-3.5 w-3.5" />
                Export CSV
              </Button>
              <Button variant="outline" size="sm" onClick={exportPDF} className="gap-1.5">
                <Printer className="h-3.5 w-3.5" />
                Export PDF
              </Button>
              <span className="text-xs text-muted-foreground ml-2">
                {report.labName} · {fromDate || 'All'} to {toDate || 'All'}
              </span>
            </div>

            {/* ─── Summary Cards ────────────────────────────────────────────── */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Card className="shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-500/20 shrink-0">
                      <Calendar className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Total Sessions</p>
                      <p className="text-2xl font-bold text-cyan-700 dark:text-cyan-300">{report.totalSessions}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/20 shrink-0">
                      <TrendingUp className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Avg Attendance Rate</p>
                      <p className={`text-2xl font-bold ${rateColor(report.overallRate)}`}>{report.overallRate}%</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-500/20 shrink-0">
                      {statusIcon(report.mostCommonStatus)}
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Most Common Status</p>
                      <p className="text-2xl font-bold capitalize">{report.mostCommonStatus}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* ─── Attendance Trend Chart ───────────────────────────────────── */}
            {report.dailyBreakdown.length > 0 && (
              <Card className="shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-cyan-500" />
                    Attendance Trend
                  </CardTitle>
                  <CardDescription>
                    Daily attendance over time (present vs absent vs late)
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ChartContainer config={chartConfig} className="h-[280px] w-full">
                    <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis
                        dataKey="date"
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(value: string) => {
                          try {
                            const d = new Date(value + 'T00:00:00');
                            return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                          } catch { return value; }
                        }}
                        fontSize={11}
                      />
                      <YAxis tickLine={false} axisLine={false} fontSize={11} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <ChartLegend content={<ChartLegendContent />} />
                      <Line type="monotone" dataKey="present" stroke="var(--color-present)" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="absent" stroke="var(--color-absent)" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="late" stroke="var(--color-late)" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ChartContainer>
                </CardContent>
              </Card>
            )}

            {/* ─── Student Attendance Table ──────────────────────────────────── */}
            <Card className="shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Users className="h-4 w-4 text-cyan-500" />
                      Student Attendance
                    </CardTitle>
                    <CardDescription className="mt-1">
                      {report.students.length} student{report.students.length !== 1 ? 's' : ''} · Click column headers to sort
                    </CardDescription>
                  </div>
                  <Badge variant="secondary" className="h-5 text-[10px] px-1.5">
                    Avg: {report.overallRate}%
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {report.students.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <Users className="h-10 w-10 text-muted-foreground/40 mb-3" />
                    <p className="text-sm text-muted-foreground">No students found for this lab</p>
                  </div>
                ) : (
                  <ScrollArea className="max-h-96">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <SortableHeader field="lastName" currentSortField={sortField} currentSortDir={sortDir} onToggleSort={toggleSort}>Name</SortableHeader>
                          <TableHead className="text-xs">ID</TableHead>
                          <SortableHeader field="present" currentSortField={sortField} currentSortDir={sortDir} onToggleSort={toggleSort}>Present</SortableHeader>
                          <SortableHeader field="absent" currentSortField={sortField} currentSortDir={sortDir} onToggleSort={toggleSort}>Absent</SortableHeader>
                          <SortableHeader field="late" currentSortField={sortField} currentSortDir={sortDir} onToggleSort={toggleSort}>Late</SortableHeader>
                          <SortableHeader field="excused" currentSortField={sortField} currentSortDir={sortDir} onToggleSort={toggleSort}>Excused</SortableHeader>
                          <SortableHeader field="rate" currentSortField={sortField} currentSortDir={sortDir} onToggleSort={toggleSort}>Rate</SortableHeader>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sortedStudents.map((student) => (
                          <TableRow key={student.studentId} className="hover:bg-muted/30">
                            <TableCell className="font-medium text-sm">
                              {student.lastName} {student.firstName}
                            </TableCell>
                            <TableCell className="text-xs font-mono text-muted-foreground">
                              {student.studentCode}
                            </TableCell>
                            <TableCell className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">
                              {student.present}
                            </TableCell>
                            <TableCell className="text-sm text-red-600 dark:text-red-400 font-medium">
                              {student.absent}
                            </TableCell>
                            <TableCell className="text-sm text-amber-600 dark:text-amber-400 font-medium">
                              {student.late}
                            </TableCell>
                            <TableCell className="text-sm text-violet-600 dark:text-violet-400 font-medium">
                              {student.excused}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <div className="flex-1 h-2 max-w-20 rounded-full bg-muted-foreground/10 overflow-hidden">
                                  <div
                                    className={`h-full rounded-full transition-all duration-500 ${rateBgColor(student.rate)}`}
                                    style={{ width: `${Math.min(student.rate, 100)}%` }}
                                  />
                                </div>
                                <span className={`text-sm font-bold tabular-nums min-w-[3ch] ${rateColor(student.rate)}`}>
                                  {student.rate}%
                                </span>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>

            {/* ─── Daily Breakdown Table ─────────────────────────────────────── */}
            <Card className="shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <CalendarCheck className="h-4 w-4 text-cyan-500" />
                  Daily Breakdown
                </CardTitle>
                <CardDescription>
                  {report.dailyBreakdown.length} recorded session{report.dailyBreakdown.length !== 1 ? 's' : ''}
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {report.dailyBreakdown.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <Calendar className="h-10 w-10 text-muted-foreground/40 mb-3" />
                    <p className="text-sm text-muted-foreground">No daily data available</p>
                  </div>
                ) : (
                  <ScrollArea className="max-h-80">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead className="text-xs">Date</TableHead>
                          <TableHead className="text-xs text-center">Present</TableHead>
                          <TableHead className="text-xs text-center">Absent</TableHead>
                          <TableHead className="text-xs text-center">Late</TableHead>
                          <TableHead className="text-xs text-center">Excused</TableHead>
                          <TableHead className="text-xs text-right">Rate</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {report.dailyBreakdown.map((day) => {
                          let dayName = '';
                          let monthDay = day.date;
                          try {
                            const d = new Date(day.date + 'T00:00:00');
                            dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
                            monthDay = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                          } catch { /* keep defaults */ }

                          const pctPresent = day.total > 0 ? (day.present / day.total) * 100 : 0;
                          const pctLate = day.total > 0 ? (day.late / day.total) * 100 : 0;
                          const pctExcused = day.total > 0 ? (day.excused / day.total) * 100 : 0;
                          const pctAbsent = day.total > 0 ? (day.absent / day.total) * 100 : 0;

                          return (
                            <TableRow key={day.date} className="hover:bg-muted/30">
                              <TableCell className="text-sm">
                                <div className="flex items-center gap-2">
                                  <div className="flex flex-col items-center justify-center w-10 h-10 rounded-lg bg-muted/50 shrink-0">
                                    <span className="text-[9px] font-semibold text-muted-foreground leading-none">{dayName}</span>
                                    <span className="text-xs font-bold leading-tight mt-0.5">{monthDay.split(' ')[1]}</span>
                                  </div>
                                  <span className="font-medium">{monthDay}</span>
                                </div>
                              </TableCell>
                              <TableCell className="text-center">
                                <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">{day.present}</span>
                              </TableCell>
                              <TableCell className="text-center">
                                <span className="text-sm font-medium text-red-600 dark:text-red-400">{day.absent}</span>
                              </TableCell>
                              <TableCell className="text-center">
                                <span className="text-sm font-medium text-amber-600 dark:text-amber-400">{day.late}</span>
                              </TableCell>
                              <TableCell className="text-center">
                                <span className="text-sm font-medium text-violet-600 dark:text-violet-400">{day.excused}</span>
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex items-center gap-2 justify-end">
                                  <div className="flex-1 h-2 max-w-16 rounded-full bg-muted-foreground/10 overflow-hidden">
                                    <div className="flex h-full rounded-full overflow-hidden">
                                      <div className="bg-emerald-500 transition-all duration-500" style={{ width: `${pctPresent}%` }} />
                                      <div className="bg-amber-500 transition-all duration-500" style={{ width: `${pctLate}%` }} />
                                      <div className="bg-violet-500 transition-all duration-500" style={{ width: `${pctExcused}%` }} />
                                      <div className="bg-red-500 transition-all duration-500" style={{ width: `${pctAbsent}%` }} />
                                    </div>
                                  </div>
                                  <span className={`text-sm font-bold tabular-nums min-w-[3ch] ${rateColor(day.rate)}`}>
                                    {day.rate}%
                                  </span>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </motion.div>
    </div>
  );
}
