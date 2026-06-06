'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { useLab44Store } from '@/store/lab44';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Card, CardContent, CardHeader, CardTitle,
} from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';

import {
  BarChart3, RefreshCw, EyeOff, ArrowLeft, BookOpen, Download,
} from 'lucide-react';

import {
  fadeSlide, BreadcrumbNav, StudentAvatar, gradeColor, CircularProgress,
} from '@/lib/helpers';

export default function StudentGradesView() {
  const { auth, setView } = useLab44Store();
  const student = auth.student;
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [gradeData, setGradeData] = useState<{
    labs: Array<{
      id: number;
      name: string;
      columns: Array<{ id: number; name: string; weight: number }>;
      grades: Array<{ columnId: number; value: number | null }>;
      average: number | null;
      simpleAverage: number | null;
      weightedAverage: number | null;
      showGrades: boolean;
    }>;
    overallAverage: number | null;
    overallSimpleAverage: number | null;
    overallWeightedAverage: number | null;
    anyVisible: boolean;
    message?: string;
  } | null>(null);

  useEffect(() => {
    if (!student) return;
    
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/student/grades?studentId=${student.id}`);
        if (!res.ok) {
          throw new Error('Failed to load grades');
        }
        const data = await res.json();
        if (!cancelled) {
          setGradeData(data);
        }
      } catch (err) {
        if (!cancelled) {
          setError('Failed to load grades');
          toast.error('Failed to load grades');
        }
      }
      if (!cancelled) {
        setLoading(false);
      }
    })();
    
    return () => { cancelled = true; };
  }, [student]);

  const handleRefresh = async () => {
    if (!student) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/student/grades?studentId=${student.id}`);
      if (!res.ok) throw new Error('Failed to load grades');
      const data = await res.json();
      setGradeData(data);
    } catch {
      setError('Failed to load grades');
      toast.error('Failed to load grades');
    }
    setLoading(false);
  };

  const handleExportCSV = () => {
    if (!gradeData) return;
    
    const rows: string[][] = [['Lab', 'Assessment', 'Weight', 'Grade', 'Percentage']];
    
    for (const lab of gradeData.labs) {
      if (!lab.showGrades) continue;
      for (const col of lab.columns) {
        const grade = lab.grades.find(g => g.columnId === col.id);
        if (grade?.value !== null && grade?.value !== undefined) {
          rows.push([lab.name, col.name, String(col.weight ?? 1.0), String(grade.value), `${Math.round((grade.value / 20) * 100)}%`]);
        }
      }

    }
    
    if (gradeData.overallAverage !== null) {
      rows.push(['Overall', 'Average', gradeData.overallAverage.toFixed(1), `${Math.round((gradeData.overallAverage / 20) * 100)}%`]);
    }
    
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${student?.studentId || 'student'}_grades.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Grades exported as CSV');
  };

  if (!student) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <h2 className="text-xl font-semibold mb-2">Not Logged In</h2>
          <Button variant="outline" onClick={() => setView('student-login')}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Go to Login
          </Button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8 space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <motion.div {...fadeSlide}>
          <BreadcrumbNav items={[{ label: 'Dashboard', view: 'student-choice' }, { label: 'Grades' }]} />
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30 mb-4">
              <BarChart3 className="h-8 w-8 text-red-600 dark:text-red-400" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Error Loading Grades</h2>
            <p className="text-sm text-muted-foreground mb-4">{error}</p>
            <Button variant="outline" onClick={handleRefresh}>
              <RefreshCw className="h-4 w-4 mr-2" /> Try Again
            </Button>
          </div>
        </motion.div>
      </div>
    );
  }

  if (!gradeData || !gradeData.anyVisible) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <motion.div {...fadeSlide}>
          <BreadcrumbNav items={[{ label: 'Dashboard', view: 'student-choice' }, { label: 'Grades' }]} />
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30 mb-4">
              <EyeOff className="h-8 w-8 text-amber-600 dark:text-amber-400" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Grades Not Available</h2>
            <p className="text-sm text-muted-foreground max-w-sm mb-4">
              {gradeData?.message || 'Your grades are not yet available. Please check back later or contact your instructor.'}
            </p>
            <Button variant="outline" onClick={() => setView('student-choice')}>
              <ArrowLeft className="h-4 w-4 mr-2" /> Back to Dashboard
            </Button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <motion.div {...fadeSlide}>
        <BreadcrumbNav items={[{ label: 'Dashboard', view: 'student-choice' }, { label: 'Grades' }]} />
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <BarChart3 className="h-6 w-6 text-violet-500" />
              <span className="text-primary font-semibold">My Grades</span>
            </h1>
            <p className="text-sm text-muted-foreground">
              {student.lastName} {student.firstName} ({student.studentId})
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleRefresh}>
              <RefreshCw className="h-3.5 w-3.5 mr-1" /> Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportCSV}>
              <Download className="h-3.5 w-3.5 mr-1" /> Export CSV
            </Button>
          </div>
        </div>

        {/* Overall Average Card */}
        {gradeData.overallAverage !== null && (
          <Card className="shadow-sm mb-6">
            <CardContent className="p-6">
              <div className="flex items-center gap-6">
                <div className="relative shrink-0">
                  <CircularProgress
                    value={Math.round((gradeData.overallAverage / 20) * 100)}
                    size={80}
                    strokeWidth={6}
                    color={gradeData.overallAverage >= 10 ? '#10b981' : '#ef4444'}
                  />
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className={`text-lg font-bold font-mono ${gradeColor(gradeData.overallAverage)}`}>
                      {gradeData.overallAverage.toFixed(1)}
                    </span>
                    <span className="text-[9px] text-muted-foreground">/20</span>
                  </div>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-muted-foreground">Overall Average</p>
                  <p className="text-2xl font-bold">
                    <span className={gradeColor(gradeData.overallAverage)}>
                      {gradeData.overallAverage.toFixed(1)}
                    </span>
                    <span className="text-muted-foreground text-lg"> /20</span>
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Lab Grades */}
        {gradeData.labs.filter(l => l.showGrades).map((lab) => (
          <Card key={lab.id} className="shadow-sm mb-6">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-violet-500" />
                  {lab.name}
                </CardTitle>
                <div className="flex items-center gap-2">
                  {lab.simpleAverage !== null && (
                    <Badge className={`font-mono ${gradeColor(lab.simpleAverage)}`}>
                      Avg: {lab.simpleAverage.toFixed(1)}/20
                    </Badge>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {lab.columns.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No assessments yet
                </p>
              ) : (
                <ScrollArea className="max-h-[300px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Assessment</TableHead>
                        <TableHead className="text-xs text-center">Weight</TableHead>
                        <TableHead className="text-xs text-center">Grade</TableHead>
                        <TableHead className="text-xs text-center">Percentage</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {lab.columns.map((col) => {
          const grade = lab.grades.find(g => g.columnId === col.id);
          const value: number | null = grade?.value ?? null;
                        return (
                          <TableRow key={col.id}>
                            <TableCell className="font-medium">{col.name}</TableCell>
                            <TableCell className="text-center">
                              <Badge variant={col.weight !== 1.0 ? 'default' : 'outline'} className={`text-[10px] font-mono ${col.weight !== 1.0 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400' : ''}`}>
                                {col.weight ?? 1.0}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center">
                              <span className={`text-sm font-bold ${gradeColor(value)}`}>
                                {value !== null && value !== undefined ? value.toFixed(1) : '—'}
                              </span>
                              <span className="text-xs text-muted-foreground">/20</span>
                            </TableCell>
                            <TableCell className="text-center">
                              {value !== null && value !== undefined ? (
                                <Badge variant="outline" className={gradeColor(value)}>
                                  {Math.round((value / 20) * 100)}%
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
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
        ))}

        {/* Hidden Labs */}
        {gradeData.labs.filter(l => !l.showGrades).length > 0 && (
          <Card className="shadow-sm bg-amber-50/50 dark:bg-amber-950/10">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 mb-2">
                <EyeOff className="h-4 w-4" />
                <span className="text-sm font-medium">Hidden Labs</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Grades for {gradeData.labs.filter(l => !l.showGrades).map(l => l.name).join(', ')} are hidden by your instructor.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Legend */}
        <div className="mt-6 flex items-center justify-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-emerald-500" /> ≥10 (Pass)</span>
          <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-red-500" /> &lt;10 (Fail)</span>
        </div>
      </motion.div>
    </div>
  );
}
