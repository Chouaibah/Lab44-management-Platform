'use client';

import React, { useState, useMemo } from 'react';
import {
  Dialog, DialogContent,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, ChevronRight, BarChart3 } from 'lucide-react';
import { gradeColor, getInitials, getAvatarColor } from '@/lib/helpers';
import type { Student, GradeColumn, Grade } from '@/types';

interface QuickSearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  students: Student[];
  columns: GradeColumn[];
  grades: Grade[];
  setActiveTab: (tab: string) => void;
  setSearch: (v: string) => void;
}

export function QuickSearchDialog({
  open,
  onOpenChange,
  students,
  columns,
  grades,
  setActiveTab,
  setSearch,
}: QuickSearchDialogProps) {
  const [quickSearchQuery, setQuickSearchQuery] = useState('');

  const handleOpenChange = (v: boolean) => {
    if (v) setQuickSearchQuery('');
    onOpenChange(v);
  };

  const quickSearchResults = {
    students: students.filter(s => {
      if (!quickSearchQuery) return [];
      const q = quickSearchQuery.toLowerCase();
      return s.firstName.toLowerCase().includes(q) || s.lastName.toLowerCase().includes(q) || s.studentId.toLowerCase().includes(q);
    }).slice(0, 5),
    columns: columns.filter(c => {
      if (!quickSearchQuery) return [];
      return c.name.toLowerCase().includes(quickSearchQuery.toLowerCase());
    }).slice(0, 3),
  };

  const handleQuickSearchSelect = (studentId: number) => {
    setSearch(`${students.find(s => s.id === studentId)?.lastName} ${students.find(s => s.id === studentId)?.firstName}`);
    setActiveTab('grades');
    onOpenChange(false);
    setTimeout(() => {
      const row = document.querySelector(`[data-student-id="${studentId}"]`);
      if (row) {
        row.scrollIntoView({ behavior: 'smooth', block: 'center' });
        row.classList.add('ring-2', 'ring-primary', 'ring-offset-2');
        setTimeout(() => row.classList.remove('ring-2', 'ring-primary', 'ring-offset-2'), 2000);
      }
    }, 200);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md p-0 gap-0">
        <div className="flex items-center border-b px-3">
          <Search className="h-4 w-4 mr-2 text-muted-foreground shrink-0" />
          <Input
            value={quickSearchQuery}
            onChange={(e) => setQuickSearchQuery(e.target.value)}
            placeholder="Search students or columns..."
            className="border-0 focus-visible:ring-0 h-11 px-0"
            autoFocus
          />
          <kbd className="shrink-0 ml-2 inline-flex h-5 items-center gap-0.5 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">ESC</kbd>
        </div>
        <div className="max-h-72 overflow-y-auto">
          {!quickSearchQuery ? (
            <div className="py-6 text-center">
              <p className="text-sm text-muted-foreground">Type to search students or columns</p>
            </div>
          ) : (
            <div>
              {quickSearchResults.students.length > 0 && (
                <div className="px-2 py-1.5">
                  <p className="text-xs font-semibold text-muted-foreground px-2 mb-1">Students</p>
                  {quickSearchResults.students.map(s => {
                    const sGrades = columns.map(col => grades.find(g => g.studentId === s.id && g.columnId === col.id)?.value ?? null).filter((v): v is number => v !== null);
                    const sMean = sGrades.length > 0 ? sGrades.reduce((a, b) => a + b, 0) / sGrades.length : null;
                    const sGraded = sGrades.length;
                    return (
                      <button
                        key={s.id}
                        onClick={() => handleQuickSearchSelect(s.id)}
                        className="w-full flex items-center gap-2 px-2 py-2 rounded-md text-sm hover:bg-muted transition-colors text-left"
                      >
                        <div className={`flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold text-white shrink-0 ${getAvatarColor(`${s.firstName} ${s.lastName}`)}`}>
                          {getInitials(s.firstName, s.lastName)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-medium truncate">{s.lastName} {s.firstName}</span>
                            {sMean !== null && (
                              <Badge variant="secondary" className={`text-[9px] px-1.5 py-0 h-4 font-mono ${gradeColor(sMean)}`}>
                                {sMean.toFixed(1)}/20
                              </Badge>
                            )}
                          </div>
                          <p className="text-[11px] text-muted-foreground font-mono">{s.studentId} · {sGraded}/{columns.length} graded</p>
                        </div>
                        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
                      </button>
                    );
                  })}
                </div>
              )}
              {quickSearchResults.columns.length > 0 && (
                <div className="px-2 py-1.5 border-t">
                  <p className="text-xs font-semibold text-muted-foreground px-2 mb-1">Columns</p>
                  {quickSearchResults.columns.map(c => (
                    <button
                      key={c.id}
                      onClick={() => { onOpenChange(false); }}
                      className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm hover:bg-muted transition-colors text-left"
                    >
                      <BarChart3 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="font-medium">{c.name}</span>
                    </button>
                  ))}
                </div>
              )}
              {quickSearchResults.students.length === 0 && quickSearchResults.columns.length === 0 && (
                <div className="py-6 text-center">
                  <p className="text-sm text-muted-foreground">No results found</p>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
