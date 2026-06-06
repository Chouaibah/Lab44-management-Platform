'use client';

import React, { useState, useCallback } from 'react';
import { toast } from 'sonner';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Upload, Eye, RefreshCw } from 'lucide-react';
import { useLab44Store } from '@/store/lab44';
import type { Student } from '@/types';

interface StudentImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  students: Student[];
  loadAll: () => void;
}

export function StudentImportDialog({ open, onOpenChange, students, loadAll }: StudentImportDialogProps) {
  const [importStudentsCsv, setImportStudentsCsv] = useState('');
  const [importStudentsPreview, setImportStudentsPreview] = useState<{ firstName: string; lastName: string; studentId: string; duplicate: boolean }[]>([]);
  const [importStudentsLoading, setImportStudentsLoading] = useState(false);
  const [importStudentsProgress, setImportStudentsProgress] = useState({ success: 0, error: 0, total: 0 });

  const handleOpenChange = (v: boolean) => {
    if (!v) {
      setImportStudentsCsv('');
      setImportStudentsPreview([]);
      setImportStudentsProgress({ success: 0, error: 0, total: 0 });
    }
    onOpenChange(v);
  };

  const pushActivity = useCallback((type: string, message: string) => {
    useLab44Store.getState().pushActivityLog(type, message);
  }, []);

  const handlePreview = () => {
    const lines = importStudentsCsv.trim().split('\n').filter(l => l.trim());
    const parsed: { firstName: string; lastName: string; studentId: string; duplicate: boolean }[] = [];
    for (const line of lines) {
      const parts = line.split(',').map(s => s.trim());
      if (parts.length >= 3 && parts[0] && parts[1] && parts[2]) {
        const isDuplicate = students.some(s => s.studentId === parts[2]);
        parsed.push({ firstName: parts[0], lastName: parts[1], studentId: parts[2], duplicate: isDuplicate });
      }
    }
    setImportStudentsPreview(parsed);
  };

  const handleImport = async () => {
    if (importStudentsPreview.length === 0) return;
    setImportStudentsLoading(true);
    let successes = 0;
    let errors = 0;
    for (const item of importStudentsPreview) {
      try {
        const res = await fetch('/api/students', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ firstName: item.firstName, lastName: item.lastName, studentId: item.studentId }) });
        const data = await res.json();
        if (data.ok) { successes++; setImportStudentsProgress({ success: successes, error: errors, total: importStudentsPreview.length }); pushActivity('student_created', `Imported student ${item.firstName} ${item.lastName}`); } else { errors++; setImportStudentsProgress({ success: successes, error: errors, total: importStudentsPreview.length }); }
      } catch { errors++; setImportStudentsProgress({ success: successes, error: errors, total: importStudentsPreview.length }); }
    }
    toast.success(`Import complete: ${successes} added, ${errors} failed`);
    setImportStudentsLoading(false);
    onOpenChange(false);
    loadAll();
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Upload className="h-4 w-4" /> Import Students</DialogTitle>
          <DialogDescription>Paste CSV data (format: firstName,lastName,studentId per line) to batch create students.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Textarea value={importStudentsCsv} onChange={(e) => setImportStudentsCsv(e.target.value)} placeholder={"John,Doe,20240001\nJane,Smith,20240002\nBob,Johnson,20240003"} rows={5} className="font-mono text-xs" />
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={handlePreview} disabled={!importStudentsCsv.trim()}>
              <Eye className="h-3.5 w-3.5 mr-1" /> Preview
            </Button>
            {importStudentsPreview.length > 0 && (() => {
              const dupCount = importStudentsPreview.filter(p => p.duplicate).length;
              return (
                <span className={`text-xs ${dupCount > 0 ? 'text-red-500 font-medium' : 'text-muted-foreground'}`}>
                  {importStudentsPreview.length} parsed{dupCount > 0 ? ` · ${dupCount} duplicate${dupCount !== 1 ? 's' : ''}` : ''}
                </span>
              );
            })()}
          </div>
          {importStudentsPreview.length > 0 && (
            <div className="max-h-48 overflow-y-auto border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="text-xs">First Name</TableHead>
                    <TableHead className="text-xs">Last Name</TableHead>
                    <TableHead className="text-xs">Student ID</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {importStudentsPreview.slice(0, 20).map((item, idx) => (
                    <TableRow key={idx} className={`text-xs ${item.duplicate ? 'bg-red-50 dark:bg-red-950/20' : ''}`}>
                      <TableCell>{item.firstName}</TableCell>
                      <TableCell>{item.lastName}</TableCell>
                      <TableCell className={`font-mono ${item.duplicate ? 'text-red-600 dark:text-red-400 font-bold' : ''}`}>{item.studentId}</TableCell>
                      <TableCell>{item.duplicate ? <Badge variant="destructive" className="text-[9px] px-1.5 py-0 h-4">Duplicate</Badge> : <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 text-emerald-600 border-emerald-200 dark:text-emerald-400">New</Badge>}</TableCell>
                    </TableRow>
                  ))}
                  {importStudentsPreview.length > 20 && (
                    <TableRow><TableCell colSpan={4} className="text-center text-xs text-muted-foreground">...and {importStudentsPreview.length - 20} more</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
          {/* Progress bar during import */}
          {importStudentsLoading && (
            <div className="space-y-2">
              <Progress value={importStudentsPreview.length > 0 ? (importStudentsProgress.success + importStudentsProgress.error) / importStudentsPreview.length * 100 : 0} className="h-2" />
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="text-emerald-600">✓ {importStudentsProgress.success} added</span>
                <span className="text-red-500">✗ {importStudentsProgress.error} failed</span>
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleImport} disabled={importStudentsPreview.length === 0 || importStudentsLoading}>
            {importStudentsLoading ? <><RefreshCw className="h-4 w-4 mr-1 animate-spin" /> Importing...</> : <><Upload className="h-4 w-4 mr-1" /> Import ({importStudentsPreview.filter(p => !p.duplicate).length})</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
