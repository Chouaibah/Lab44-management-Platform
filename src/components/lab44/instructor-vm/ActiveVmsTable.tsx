'use client';

import React from 'react';
import {
  Monitor, Server, Play, Square, RotateCcw, Trash2, Eye,
  Loader2, Unplug, Terminal, RefreshCw,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { getInitials, getAvatarColor, fmtDateTime } from '@/lib/helpers';
import { vmStatusInfo } from '@/lib/vm-actions';
import type { VmRequest, VmPowerState } from './types';

interface ActiveVmsTableProps {
  approved: VmRequest[];
  deletedVmIds: Set<number>;
  showDeleted: boolean;
  vmPowerStates: Record<string, VmPowerState>;
  // Selection
  approvedSelectedIds: Set<number>;
  allApprovedSelected: boolean;
  someApprovedSelected: boolean;
  onToggleSelect: (id: number) => void;
  onToggleSelectAll: () => void;
  // Actions
  isLoading: (key: string) => boolean;
  onVmAction: (vmUuid: string, action: 'start' | 'stop' | 'reboot') => void;
  onViewDetails: (vmUuid: string) => void;
  onOpenConsole: (req: { id: number; vmName: string | null; vmIp: string | null; studentName: string }) => void;
  onDeleteRequest: (req: { id: number; studentName: string; templateName: string | null }) => void;
  onConvertToTemplate: (vmUuid: string, vmName: string) => void;
  convertLoading?: string | null;
}

export function ActiveVmsTable({
  approved, deletedVmIds, showDeleted, vmPowerStates,
  approvedSelectedIds, allApprovedSelected, someApprovedSelected,
  onToggleSelect, onToggleSelectAll,
  isLoading, onVmAction, onViewDetails, onOpenConsole, onDeleteRequest,
  onConvertToTemplate, convertLoading,
}: ActiveVmsTableProps) {
  const visible = approved.filter(r => showDeleted || !deletedVmIds.has(r.id));

  return (
    <Card className="shadow-sm mb-6">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          Active VM Assignments
          <Badge className="bg-green-500 text-white border-green-500">{approved.length}</Badge>
          {deletedVmIds.size > 0 && (
            <Badge variant="outline" className="text-red-500 border-red-500/20 text-xs ml-1">
              {deletedVmIds.size} deleted
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          Students with approved virtual machines
          {deletedVmIds.size > 0 ? ' — red badges indicate VMs no longer on XCP-ng host' : ''}
        </CardDescription>
      </CardHeader>

      <CardContent className="p-0">
        {approved.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Monitor className="h-10 w-10 text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground">No active VM assignments</p>
          </div>
        ) : (
          <ScrollArea className="max-h-[500px]">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="pl-4 w-10">
                    <Checkbox
                      checked={allApprovedSelected}
                      ref={el => { if (el) (el as HTMLButtonElement & { indeterminate?: boolean }).indeterminate = someApprovedSelected; }}
                      onCheckedChange={onToggleSelectAll}
                      aria-label="Select all approved VMs"
                    />
                  </TableHead>
                  <TableHead>Student</TableHead>
                  <TableHead className="max-w-[140px]">VM Name</TableHead>
                  <TableHead className="max-w-[120px] hidden lg:table-cell">Template</TableHead>
                  <TableHead className="hidden md:table-cell">IP Address</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden xl:table-cell">Approved</TableHead>
                  <TableHead className="text-right pr-4 sticky right-0 bg-muted/50">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((req, idx) => {
                  const isDeleted  = deletedVmIds.has(req.id);
                  const isSelected = approvedSelectedIds.has(req.id);
                  const isInstructorVm = req.studentId.startsWith('ins-');
                  const rowBg = isSelected
                    ? 'bg-emerald-50/50 dark:bg-emerald-900/10'
                    : isDeleted
                      ? 'bg-red-50/50 dark:bg-red-900/10'
                      : isInstructorVm
                        ? 'bg-blue-50/30 dark:bg-blue-900/5'
                        : idx % 2 === 0 ? 'bg-transparent' : 'bg-muted/30';

                  return (
                    <TableRow key={req.id} className={`transition-colors hover:bg-muted/50 ${rowBg}`}>
                      <TableCell className="pl-4">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => onToggleSelect(req.id)}
                          disabled={!req.vmUuid || isDeleted}
                          aria-label={`Select VM for ${req.studentName}`}
                        />
                      </TableCell>

                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className={`flex h-6 w-6 items-center justify-center rounded-full text-[9px] font-bold text-white shrink-0 ${getAvatarColor(req.studentName)}`}>
                            {getInitials(req.studentName.split(' ')[0] || '', req.studentName.split(' ')[1] || '')}
                          </div>
                          <div>
                            <p className={`font-medium text-sm ${isDeleted ? 'line-through text-muted-foreground' : ''}`}>
                              {req.studentName}
                              {isInstructorVm && (
                                <Badge variant="outline" className="ml-1.5 text-[9px] h-4 px-1 py-0 border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 align-middle">
                                  Instructor
                                </Badge>
                              )}
                            </p>
                            <p className="text-xs text-muted-foreground font-mono">{req.studentId}</p>
                          </div>
                        </div>
                      </TableCell>

                      <TableCell className={`font-medium max-w-[180px] ${isDeleted ? 'line-through text-muted-foreground' : ''}`}>
                        <span className="block truncate" title={req.vmName || ''}>{req.vmName || '—'}</span>
                      </TableCell>

                      <TableCell className="text-sm max-w-[150px] hidden lg:table-cell">
                        <span className="block truncate" title={req.templateName || ''}>{req.templateName || '—'}</span>
                      </TableCell>

                      <TableCell className="font-mono text-sm hidden md:table-cell">
                        {req.vmIp || '—'}
                      </TableCell>

                      <TableCell>
                        {isDeleted ? (
                          <Badge className="bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20 text-xs">
                            <Unplug className="h-3 w-3 mr-1" /> Deleted on Host
                          </Badge>
                        ) : req.vmUuid && vmPowerStates[req.vmUuid] ? (() => {
                          const info = vmStatusInfo(vmPowerStates[req.vmUuid].powerState);
                          return (
                            <Badge className={`${info.bgColor} ${info.color} border text-xs`}>
                              {vmPowerStates[req.vmUuid].powerState === 'Running' && (
                                <span className="relative flex h-2 w-2 mr-1.5">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                                </span>
                              )}
                              {info.label}
                            </Badge>
                          );
                        })() : req.vmUuid ? (
                          <Skeleton className="h-5 w-16" />
                        ) : (
                          <Badge className="bg-gray-500/10 text-gray-600 dark:text-gray-400 border-gray-500/20 text-xs">N/A</Badge>
                        )}
                      </TableCell>

                      <TableCell className="text-xs text-muted-foreground hidden xl:table-cell">
                        {fmtDateTime(req.reviewedAt || '')}
                      </TableCell>

                      <TableCell className="pr-4 sticky right-0 bg-background">
                        <div className="flex items-center justify-end gap-0.5 flex-nowrap">
                          {req.vmUuid && !isDeleted && (
                            <>
                              {(['start', 'stop', 'reboot'] as const).map(action => {
                                const icons = { start: Play, stop: Square, reboot: RotateCcw };
                                const colors = {
                                  start:  'text-emerald-600 hover:text-emerald-700 hover:bg-emerald-100 dark:hover:bg-emerald-900/30',
                                  stop:   'text-amber-600 hover:text-amber-700 hover:bg-amber-100 dark:hover:bg-amber-900/30',
                                  reboot: 'text-blue-600 hover:text-blue-700 hover:bg-blue-100 dark:hover:bg-blue-900/30',
                                };
                                const Icon = icons[action];
                                const loading = isLoading(`${req.vmUuid}-${action}`);
                                return (
                                  <Button
                                    key={action}
                                    variant="ghost" size="icon"
                                    className={`h-7 w-7 ${colors[action]}`}
                                    title={`${action.charAt(0).toUpperCase() + action.slice(1)} VM`}
                                    disabled={loading}
                                    onClick={() => onVmAction(req.vmUuid!, action)}
                                  >
                                    {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Icon className="h-3.5 w-3.5" />}
                                  </Button>
                                );
                              })}
                              <Button
                                variant="ghost" size="icon"
                                className="h-7 w-7 text-violet-600 hover:text-violet-700 hover:bg-violet-100 dark:hover:bg-violet-900/30"
                                title="View Details"
                                onClick={() => onViewDetails(req.vmUuid!)}
                              >
                                <Eye className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost" size="icon"
                                className="h-7 w-7 text-cyan-600 hover:text-cyan-700 hover:bg-cyan-100 dark:hover:bg-cyan-900/30"
                                title="Console (SSH/RDP)"
                                onClick={() => onOpenConsole(req)}
                              >
                                <Terminal className="h-3.5 w-3.5" />
                              </Button>
                            </>
                          )}
                          {isInstructorVm && req.vmUuid && !isDeleted && (
                            <Button
                              variant="ghost" size="icon"
                              className="h-7 w-7 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-100 dark:hover:bg-indigo-900/30"
                              title="Convert to Template"
                              disabled={convertLoading === req.vmUuid}
                              onClick={() => onConvertToTemplate(req.vmUuid!, req.vmName || req.vmUuid!)}
                            >
                              {convertLoading === req.vmUuid ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                            </Button>
                          )}
                          <Button
                            variant="ghost" size="icon"
                            className="h-7 w-7 text-red-500 hover:text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30"
                            title="Delete VM"
                            disabled={isLoading(`delete-${req.id}`)}
                            onClick={() => onDeleteRequest(req)}
                          >
                            {isLoading(`delete-${req.id}`) ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                          </Button>
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
  );
}
