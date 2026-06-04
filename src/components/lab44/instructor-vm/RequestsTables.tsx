'use client';

import React from 'react';
import {
  Clock, XCircle, Check, X, Loader2,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { getInitials, getAvatarColor, fmtDateTime } from '@/lib/helpers';
import type { VmRequest } from './types';

// ─── PendingRequestsTable ─────────────────────────────────────────────────────

interface PendingRequestsTableProps {
  pending: VmRequest[];
  selectedIds: Set<number>;
  allSelected: boolean;
  someSelected: boolean;
  isLoading: (key: string) => boolean;
  onToggleSelect: (id: number) => void;
  onToggleSelectAll: () => void;
  onQuickApprove: (req: VmRequest) => void;
  onReject: (id: number) => void;
}

export function PendingRequestsTable({
  pending, selectedIds, allSelected, someSelected,
  isLoading, onToggleSelect, onToggleSelectAll,
  onQuickApprove, onReject,
}: PendingRequestsTableProps) {
  if (pending.length === 0) return null;

  return (
    <Card className="shadow-sm mb-6">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          Pending Requests
          <Badge className="bg-amber-500 text-white border-amber-500">{pending.length}</Badge>
        </CardTitle>
        <CardDescription>Review and approve or reject student VM requests</CardDescription>
      </CardHeader>

      <CardContent className="p-0">
        <ScrollArea className="max-h-[400px]">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="pl-4 w-10">
                  <Checkbox
                    checked={allSelected}
                    ref={el => { if (el) (el as HTMLButtonElement & { indeterminate?: boolean }).indeterminate = someSelected; }}
                    onCheckedChange={onToggleSelectAll}
                    aria-label="Select all pending requests"
                  />
                </TableHead>
                <TableHead>Student</TableHead>
                <TableHead>Template</TableHead>
                <TableHead>Requested</TableHead>
                <TableHead className="text-right pr-4">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pending.map((req, idx) => (
                <TableRow
                  key={req.id}
                  className={`transition-colors hover:bg-muted/50 ${
                    selectedIds.has(req.id) ? 'bg-emerald-50/50 dark:bg-emerald-900/10' : idx % 2 === 0 ? 'bg-transparent' : 'bg-muted/30'
                  }`}
                >
                  <TableCell className="pl-4">
                    <Checkbox
                      checked={selectedIds.has(req.id)}
                      onCheckedChange={() => onToggleSelect(req.id)}
                      aria-label={`Select request from ${req.studentName}`}
                    />
                  </TableCell>

                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="relative flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500" />
                      </span>
                      <div>
                        <p className="font-medium text-sm">{req.studentName}</p>
                        <p className="text-xs text-muted-foreground font-mono">{req.studentId}</p>
                      </div>
                    </div>
                  </TableCell>

                  <TableCell className="text-sm">{req.templateName || '—'}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{fmtDateTime(req.requestedAt)}</TableCell>

                  <TableCell className="pr-4">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost" size="sm"
                        className="h-7 gap-1.5 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-100 dark:hover:bg-emerald-900/30"
                        disabled={isLoading(`approve-${req.id}`)}
                        onClick={() => onQuickApprove(req)}
                      >
                        {isLoading(`approve-${req.id}`) ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                        Approve
                      </Button>
                      <Button
                        variant="ghost" size="sm"
                        className="h-7 gap-1.5 text-red-500 hover:text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30"
                        disabled={isLoading(`reject-${req.id}`)}
                        onClick={() => onReject(req.id)}
                      >
                        {isLoading(`reject-${req.id}`) ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
                        Reject
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

// ─── RejectedTable ────────────────────────────────────────────────────────────

interface RejectedTableProps {
  rejected: VmRequest[];
}

export function RejectedTable({ rejected }: RejectedTableProps) {
  if (rejected.length === 0) return null;

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <XCircle className="h-4 w-4 text-red-500" />
          Rejected Requests
          <Badge variant="outline" className="text-red-500 border-red-500/20 text-xs">{rejected.length}</Badge>
        </CardTitle>
      </CardHeader>

      <CardContent className="p-0">
        <ScrollArea className="max-h-[250px]">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="pl-4">Student</TableHead>
                <TableHead>Template</TableHead>
                <TableHead>Note</TableHead>
                <TableHead>Rejected</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rejected.map((req, idx) => (
                <TableRow key={req.id} className={`transition-colors hover:bg-muted/50 ${idx % 2 === 0 ? 'bg-transparent' : 'bg-muted/30'}`}>
                  <TableCell className="pl-4">
                    <div className="flex items-center gap-2">
                      <div className={`flex h-6 w-6 items-center justify-center rounded-full text-[9px] font-bold text-white shrink-0 ${getAvatarColor(req.studentName)}`}>
                        {getInitials(req.studentName.split(' ')[0] || '', req.studentName.split(' ')[1] || '')}
                      </div>
                      <div>
                        <p className="font-medium text-sm">{req.studentName}</p>
                        <p className="text-xs text-muted-foreground font-mono">{req.studentId}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{req.templateName || '—'}</TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate" title={req.note || ''}>
                    {req.note || '—'}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {fmtDateTime(req.reviewedAt || '')}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
