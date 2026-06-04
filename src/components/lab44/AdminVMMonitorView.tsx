'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useLab44Store } from '@/store/lab44';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '@/components/ui/dialog';

import {
  Tooltip, TooltipTrigger, TooltipContent, TooltipProvider,
} from '@/components/ui/tooltip';

import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

import {
  Monitor, ChevronLeft, CheckCircle2, Clock, XCircle, HardDrive, Server,
  Play, Square, RotateCcw, Trash2, Check, X, Eye,
  Loader2, AlertTriangle, Info, Cpu, MemoryStick, Globe, RefreshCw,
  ListChecks, Unplug, Filter, Terminal, Settings2,
} from 'lucide-react';

import { fadeSlide, BreadcrumbNav, StatCard, vmStatusBadge, fmtDateTime, getInitials, getAvatarColor } from '@/lib/helpers';
import { vmStatusInfo } from '@/lib/vm-actions';

export default function AdminVMMonitorView() {
  const { vmRequests, setVmRequests, setView } = useLab44Store();

  // ─── Derived data ───
  const approved = useMemo(() => vmRequests.filter(r => r.status === 'approved'), [vmRequests]);
  const pending = useMemo(() => vmRequests.filter(r => r.status === 'pending'), [vmRequests]);
  const rejected = useMemo(() => vmRequests.filter(r => r.status === 'rejected'), [vmRequests]);

  // ─── VM action loading state ───
  const [vmActionLoading, setVmActionLoading] = useState<Record<string, string | null>>({});
  const [selectedVmDetails, setSelectedVmDetails] = useState<any>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // ─── Approve dialog state ───
  const [approveDialog, setApproveDialog] = useState<{ open: boolean; requestId: number | null; templateName: string }>({ open: false, requestId: null, templateName: '' });
  const [approveForm, setApproveForm] = useState({ vmName: '', guacProtocol: 'rdp', vmIp: '', vmUser: '', vmPass: '', note: '' });

  // ─── Reject dialog state ───
  const [rejectDialog, setRejectDialog] = useState<{ open: boolean; requestId: number | null }>({ open: false, requestId: null });
  const [rejectNote, setRejectNote] = useState('');

  // ─── Delete confirmation dialog ───
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; requestId: number | null; studentName: string; templateName: string }>({ open: false, requestId: null, studentName: '', templateName: '' });

  // ─── VM Details dialog ───
  const [detailsDialog, setDetailsDialog] = useState(false);

  // ─── Batch selection state ───
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [batchLoading, setBatchLoading] = useState(false);
  const [batchRejectDialog, setBatchRejectDialog] = useState(false);
  const [batchRejectNote, setBatchRejectNote] = useState('');

  // ─── Approved VM batch selection state ───
  const [approvedSelectedIds, setApprovedSelectedIds] = useState<Set<number>>(new Set());
  const [approvedBatchLoading, setApprovedBatchLoading] = useState(false);
  const [batchDeleteDialog, setBatchDeleteDialog] = useState(false);

  // ─── Deleted VM detection state ───
  const [deletedVmIds, setDeletedVmIds] = useState<Set<number>>(new Set());
  const [syncing, setSyncing] = useState(false);
  const [showDeleted, setShowDeleted] = useState(true);

  // ─── VM power state polling ───
  const [vmPowerStates, setVmPowerStates] = useState<Record<string, { powerState: string; lastChecked: number }>>({});

  // ─── Refresh helper ───
  const refreshData = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetch('/api/vm-requests');
      const data = await res.json();
      setVmRequests(data.requests || []);
      toast.success('Data refreshed');
    } catch {
      toast.error('Failed to refresh data');
    } finally {
      setRefreshing(false);
    }
  }, [setVmRequests]);

  // Load data on mount
  useEffect(() => {
    if (vmRequests.length === 0) {
      refreshData();
    }
  }, [vmRequests.length, refreshData]);

  // ─── Poll VM power states for approved VMs ───
  useEffect(() => {
    const pollPowerStates = async () => {
      const approvedWithUuid = approved.filter(r => r.vmUuid && !deletedVmIds.has(r.id));
      if (approvedWithUuid.length === 0) return;

      const BATCH_SIZE = 5;
      for (let i = 0; i < approvedWithUuid.length; i += BATCH_SIZE) {
        const batch = approvedWithUuid.slice(i, i + BATCH_SIZE);
        const results = await Promise.allSettled(
          batch.map(async (req) => {
            try {
              const res = await fetch(`/api/xapi/vms/${req.vmUuid}/details`);
              if (res.ok) {
                const data = await res.json();
                return { uuid: req.vmUuid!, powerState: data.power_state || 'Unknown' };
              }
              return null;
            } catch {
              return null;
            }
          })
        );
        const updates: Record<string, { powerState: string; lastChecked: number }> = {};
        results.forEach((result) => {
          if (result.status === 'fulfilled' && result.value) {
            updates[result.value.uuid] = {
              powerState: result.value.powerState,
              lastChecked: Date.now(),
            };
          }
        });
        if (Object.keys(updates).length > 0) {
          setVmPowerStates(prev => ({ ...prev, ...updates }));
        }
      }
    };

    pollPowerStates();
    const interval = setInterval(pollPowerStates, 30000);
    return () => clearInterval(interval);
  }, [approved, deletedVmIds]);

  // ─── Direct approve VM request (no dialog) ───
  const handleDirectApprove = async (req: { id: number; templateName: string; accessProtocol?: string }) => {
    setVmActionLoading(prev => ({ ...prev, [`approve-${req.id}`]: 'approving' }));
    try {
      const res = await fetch(`/api/vm-requests/${req.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'approved',
          vmName: req.templateName,
          accessProtocol: req.accessProtocol || 'rdp',
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`VM approved${data.xcpNgCreated ? ' and provisioned on XCP-ng' : ''}!`);
        await refreshData();
      } else {
        toast.error(data.error || 'Failed to approve');
      }
    } catch {
      toast.error('Failed to approve VM request');
    } finally {
      setVmActionLoading(prev => ({ ...prev, [`approve-${req.id}`]: null }));
    }
  };

  // ─── Console dialog state ───
  const [consoleDialog, setConsoleDialog] = useState<{
    open: boolean;
    requestId: number | null;
    vmName: string;
    vmIp: string;
    studentName: string;
  }>({ open: false, requestId: null, vmName: '', vmIp: '', studentName: '' });
  const [consoleProtocol, setConsoleProtocol] = useState<'rdp' | 'ssh'>('rdp');
  const [consoleConnecting, setConsoleConnecting] = useState(false);
  const [consoleUser, setConsoleUser] = useState('');
  const [consolePass, setConsolePass] = useState('');

  // ─── Open console dialog ───
  const openConsoleDialog = (req: { id: number; vmName: string | null; vmIp: string | null; studentName: string }) => {
    setConsoleDialog({
      open: true,
      requestId: req.id,
      vmName: req.vmName || 'VM',
      vmIp: req.vmIp || '—',
      studentName: req.studentName,
    });
    setConsoleProtocol('rdp');
    setConsoleUser('lab');
    setConsolePass('000000');
  };

  // ─── Connect via Guacamole console ───
  const handleConnectConsole = async () => {
    if (!consoleDialog.requestId) return;
    setConsoleConnecting(true);
    try {
      const params = new URLSearchParams({ protocol: consoleProtocol });
      if (consoleUser) params.set('vmUser', consoleUser);
      if (consolePass) params.set('vmPass', consolePass);
      const res = await fetch(`/api/guacamole/connect/${consoleDialog.requestId}?${params}`);
      const data = await res.json();
      if (res.ok && data.identifier && data.authToken) {
        // Construct Guacamole client URL the same way the student does
        const connectionStr = `${data.identifier}\0c\0${data.dataSource}`;
        const clientId = btoa(connectionStr).replace(/=+$/, '');
        let baseUrl = (data.url || '').replace(/[\/#]+$/, '');
        if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
          baseUrl = `http://${baseUrl}`;
        }
        window.open(`${baseUrl}/#/client/${clientId}?token=${data.authToken}`, '_blank', 'noopener,noreferrer');
        setConsoleDialog({ open: false, requestId: null, vmName: '', vmIp: '', studentName: '' });
        toast.success('Opening console...');
      } else {
        toast.error(data.error || 'Failed to open console');
      }
    } catch {
      toast.error('Failed to open console connection');
    } finally {
      setConsoleConnecting(false);
    }
  };

  // ─── VM power actions ───
  const handleVmAction = async (vmUuid: string, action: 'start' | 'stop' | 'reboot') => {
    setVmActionLoading(prev => ({ ...prev, [`${vmUuid}-${action}`]: action }));
    try {
      const res = await fetch(`/api/xapi/vms/${vmUuid}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (data.vmIp) {
        // Update IP in local state immediately
        setVmRequests(prev => prev.map(r => r.vmUuid === vmUuid ? { ...r, vmIp: data.vmIp } : r));
      }
      toast.success(data.message || `VM ${action} successful`);
      await refreshData();
    } catch {
      toast.error(`Failed to ${action} VM`);
    } finally {
      setVmActionLoading(prev => ({ ...prev, [`${vmUuid}-${action}`]: null }));
    }
  };

  // ─── Load VM details ───
  const loadVmDetails = async (vmUuid: string) => {
    setDetailsDialog(true);
    setLoadingDetails(true);
    setSelectedVmDetails(null);
    try {
      const res = await fetch(`/api/xapi/vms/${vmUuid}/details`);
      if (res.ok) {
        const data = await res.json();
        setSelectedVmDetails(data);
      } else {
        toast.error('Failed to load VM details');
      }
    } catch {
      toast.error('Failed to load VM details');
    } finally {
      setLoadingDetails(false);
    }
  };

  // ─── Approve VM request ───
  const handleApprove = async () => {
    if (!approveDialog.requestId) return;
    const id = approveDialog.requestId;
    setVmActionLoading(prev => ({ ...prev, [`approve-${id}`]: 'approving' }));
    try {
      const res = await fetch(`/api/vm-requests/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'approved',
          vmName: approveForm.vmName || approveDialog.templateName,
          accessProtocol: approveForm.guacProtocol,
          vmIp: approveForm.vmIp || null,
          note: approveForm.note || null,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`VM approved${data.xcpNgCreated ? ' and provisioned on XCP-ng' : ''}!`);
        setApproveDialog({ open: false, requestId: null, templateName: '' });
        setApproveForm({ vmName: '', guacProtocol: 'rdp', vmIp: '', vmUser: '', vmPass: '', note: '' });
        await refreshData();
      } else {
        toast.error(data.error || 'Failed to approve');
      }
    } catch {
      toast.error('Failed to approve VM request');
    } finally {
      setVmActionLoading(prev => ({ ...prev, [`approve-${id}`]: null }));
    }
  };

  // ─── Reject VM request ───
  const handleReject = async () => {
    if (!rejectDialog.requestId) return;
    const id = rejectDialog.requestId;
    setVmActionLoading(prev => ({ ...prev, [`reject-${id}`]: 'rejecting' }));
    try {
      const res = await fetch(`/api/vm-requests/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'rejected', note: rejectNote }),
      });
      if (res.ok) {
        toast.success('VM request rejected');
        setRejectDialog({ open: false, requestId: null });
        setRejectNote('');
        await refreshData();
      } else {
        toast.error('Failed to reject');
      }
    } catch {
      toast.error('Failed to reject VM request');
    } finally {
      setVmActionLoading(prev => ({ ...prev, [`reject-${id}`]: null }));
    }
  };

  // ─── Delete VM request ───
  const handleDelete = async () => {
    if (!deleteDialog.requestId) return;
    const id = deleteDialog.requestId;
    setVmActionLoading(prev => ({ ...prev, [`delete-${id}`]: 'deleting' }));
    try {
      const res = await fetch(`/api/vm-requests/${id}/delete`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('VM and all resources deleted');
        setDeleteDialog({ open: false, requestId: null, studentName: '', templateName: '' });
        await refreshData();
      } else {
        toast.error('Failed to delete');
      }
    } catch {
      toast.error('Failed to delete VM request');
    } finally {
      setVmActionLoading(prev => ({ ...prev, [`delete-${id}`]: null }));
    }
  };

  // ─── Helper: format bytes to human-readable ───
  const formatMemory = (bytes?: number) => {
    if (!bytes) return '—';
    if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(1)} GB`;
    if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(0)} MB`;
    if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${bytes} B`;
  };

  const isLoading = (key: string) => !!vmActionLoading[key];

  // ─── Batch helpers ───
  const pendingIds = useMemo(() => new Set(pending.map(r => r.id)), [pending]);
  const allSelected = pending.length > 0 && pending.every(r => selectedIds.has(r.id));
  const someSelected = pending.some(r => selectedIds.has(r.id)) && !allSelected;

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(pending.map(r => r.id)));
    }
  };

  const clearSelection = () => setSelectedIds(new Set());

  // ─── Approved VM batch helpers ───
  const allApprovedSelected = approved.length > 0 && approved.filter(r => r.vmUuid && !deletedVmIds.has(r.id)).every(r => approvedSelectedIds.has(r.id));
  const someApprovedSelected = approved.filter(r => r.vmUuid && !deletedVmIds.has(r.id)).some(r => approvedSelectedIds.has(r.id)) && !allApprovedSelected;

  const toggleApprovedSelect = (id: number) => {
    setApprovedSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleApprovedSelectAll = () => {
    const selectable = approved.filter(r => r.vmUuid && !deletedVmIds.has(r.id));
    if (allApprovedSelected) {
      setApprovedSelectedIds(new Set());
    } else {
      setApprovedSelectedIds(new Set(selectable.map(r => r.id)));
    }
  };

  const clearApprovedSelection = () => setApprovedSelectedIds(new Set());

  // ─── Approved VM batch action handler ───
  const handleApprovedBatchAction = async (action: 'start' | 'stop' | 'reboot') => {
    const selectedApproved = approved.filter(r => approvedSelectedIds.has(r.id) && r.vmUuid);
    if (selectedApproved.length === 0) return;
    setApprovedBatchLoading(true);
    let success = 0;
    let failed = 0;
    for (const req of selectedApproved) {
      try {
        const res = await fetch(`/api/xapi/vms/${req.vmUuid}/action`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action }),
        });
        if (res.ok) success++;
        else failed++;
      } catch {
        failed++;
      }
    }
    toast.success(`Batch ${action}: ${success} successful${failed > 0 ? `, ${failed} failed` : ''}`);
    clearApprovedSelection();
    await refreshData();
    setApprovedBatchLoading(false);
  };

  // ─── Batch delete approved VMs handler ───
  const handleBatchDelete = async () => {
    const selectedApproved = approved.filter(r => approvedSelectedIds.has(r.id));
    if (selectedApproved.length === 0) return;
    setApprovedBatchLoading(true);
    let success = 0;
    let failed = 0;
    for (const req of selectedApproved) {
      try {
        const res = await fetch(`/api/vm-requests/${req.id}/delete`, { method: 'DELETE' });
        if (res.ok) success++;
        else failed++;
      } catch {
        failed++;
      }
    }
    toast.success(`Batch delete: ${success} deleted${failed > 0 ? `, ${failed} failed` : ''}`);
    setBatchDeleteDialog(false);
    clearApprovedSelection();
    await refreshData();
    setApprovedBatchLoading(false);
  };

  // ─── Sync VM status with XCP-ng ───
  const handleSyncVmStatus = async () => {
    const approvedWithUuid = approved.filter(r => r.vmUuid);
    if (approvedWithUuid.length === 0) {
      toast.info('No approved VMs with UUID to check');
      return;
    }
    setSyncing(true);
    const newDeleted = new Set<number>();
    try {
      for (const req of approvedWithUuid) {
        if (!req.vmUuid) continue;
        try {
          const res = await fetch(`/api/xapi/vms/${req.vmUuid}/details`);
          if (res.status === 404) {
            newDeleted.add(req.id);
          } else if (!res.ok) {
            try {
              const data = await res.json();
              if (data.error && (data.error.toLowerCase().includes('not found') || data.error.toLowerCase().includes('does not exist'))) {
                newDeleted.add(req.id);
              }
            } catch { /* ignore parse errors */ }
          }
        } catch {
          // Network errors — don't assume deleted
        }
      }
      setDeletedVmIds(newDeleted);
      if (newDeleted.size === 0) {
        toast.success('All VMs are still active on XCP-ng');
      } else {
        toast.warning(`${newDeleted.size} VM${newDeleted.size !== 1 ? 's' : ''} no longer exist${newDeleted.size === 1 ? 's' : ''} on XCP-ng host`);
      }
    } catch {
      toast.error('Failed to sync VM status');
    }
    setSyncing(false);
  };

  // ─── Clear deleted VM requests ───
  const handleClearDeleted = async () => {
    if (deletedVmIds.size === 0) {
      toast.info('No deleted VMs to clear');
      return;
    }
    setSyncing(true);
    try {
      let cleared = 0;
      for (const id of deletedVmIds) {
        try {
          const res = await fetch(`/api/vm-requests/${id}`, { method: 'DELETE' });
          if (res.ok) cleared++;
        } catch { /* ignore */ }
      }
      toast.success(`Cleared ${cleared} deleted VM request${cleared !== 1 ? 's' : ''}`);
      setDeletedVmIds(new Set());
      await refreshData();
    } catch {
      toast.error('Failed to clear deleted VMs');
    }
    setSyncing(false);
  };

  // ─── Batch approve handler ───
  const handleBatchApprove = async () => {
    const ids = Array.from(selectedIds).filter(id => pendingIds.has(id));
    if (ids.length === 0) return;
    setBatchLoading(true);
    try {
      const res = await fetch('/api/vm-requests/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve', requestIds: ids }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`Batch approve: ${data.processed} approved${data.failed > 0 ? `, ${data.failed} failed` : ''}`);
        clearSelection();
        await refreshData();
      } else {
        toast.error(data.error || 'Batch approve failed');
      }
    } catch {
      toast.error('Failed to batch approve');
    } finally {
      setBatchLoading(false);
    }
  };

  // ─── Batch reject handler ───
  const handleBatchReject = async () => {
    const ids = Array.from(selectedIds).filter(id => pendingIds.has(id));
    if (ids.length === 0) return;
    setBatchLoading(true);
    try {
      const res = await fetch('/api/vm-requests/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reject', requestIds: ids, note: batchRejectNote || undefined }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`Batch reject: ${data.processed} rejected${data.failed > 0 ? `, ${data.failed} failed` : ''}`);
        setBatchRejectDialog(false);
        setBatchRejectNote('');
        clearSelection();
        await refreshData();
      } else {
        toast.error(data.error || 'Batch reject failed');
      }
    } catch {
      toast.error('Failed to batch reject');
    } finally {
      setBatchLoading(false);
    }
  };

  return (
    <TooltipProvider>
    <motion.div {...fadeSlide} className="mx-auto max-w-7xl px-4 py-6 sm:py-8">
      <BreadcrumbNav items={[{ label: 'Admin', view: 'admin-panel' }, { label: 'VM Monitor' }]} />
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            VM Monitor
          </h1>
          <p className="text-sm text-muted-foreground">Manage virtual machines, approve requests, and monitor resources</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={refreshData}
            disabled={refreshing}
            className="gap-1"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>

          {deletedVmIds.size > 0 && (
            <>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleClearDeleted}
                disabled={syncing}
                className="gap-1"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Clear Deleted ({deletedVmIds.size})
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowDeleted(v => !v)}
                className="gap-1"
              >
                <Filter className="h-3.5 w-3.5" />
                {showDeleted ? 'Hide Deleted' : 'Show Deleted'}
              </Button>
            </>
          )}
          <Button variant="outline" size="sm" onClick={() => setView('admin-panel')}>
            <ChevronLeft className="h-3.5 w-3.5 mr-1" /> Back to Panel
          </Button>
        </div>
      </div>

      {/* ─── Stat cards ─── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <StatCard label="Active VMs" value={String(approved.length - deletedVmIds.size)} statusColor="bg-emerald-500" icon={<CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />} iconBg="bg-emerald-100 dark:bg-emerald-900/30" />
        <StatCard label="Pending" value={String(pending.length)} statusColor="bg-amber-500" icon={<Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />} iconBg="bg-amber-100 dark:bg-amber-900/30" />
        <StatCard label="Rejected" value={String(rejected.length)} statusColor="bg-red-500" icon={<XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />} iconBg="bg-red-100 dark:bg-red-900/30" />
        <StatCard label="Total Requests" value={String(vmRequests.length)} statusColor="bg-violet-500" icon={<HardDrive className="h-4 w-4 text-violet-600 dark:text-violet-400" />} iconBg="bg-violet-100 dark:bg-violet-900/30" />
      </div>

      {/* ─── Active VM Assignments ─── */}
      <Card className="shadow-sm mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Server className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> Active VM Assignments
            {deletedVmIds.size > 0 && (
              <Badge variant="outline" className="text-red-500 border-red-500/20 text-xs ml-1">{deletedVmIds.size} deleted</Badge>
            )}
          </CardTitle>
          <CardDescription>Students with approved virtual machines{deletedVmIds.size > 0 ? ' — red badges indicate VMs no longer on XCP-ng host' : ''}</CardDescription>
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
                        ref={(el) => {
                          if (el) {
                            (el as HTMLButtonElement & { indeterminate?: boolean }).indeterminate = someApprovedSelected;
                          }
                        }}
                        onCheckedChange={toggleApprovedSelectAll}
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
                  {approved
                    .filter(req => showDeleted || !deletedVmIds.has(req.id))
                    .map((req, idx) => {
                    const isDeleted = deletedVmIds.has(req.id);
                    return (
                    <TableRow key={req.id} className={`transition-colors hover:bg-muted/50 ${approvedSelectedIds.has(req.id) ? 'bg-emerald-50/50 dark:bg-emerald-900/10' : isDeleted ? 'bg-red-50/50 dark:bg-red-900/10' : idx % 2 === 0 ? 'bg-transparent' : 'bg-muted/30'}`}>
                      <TableCell className="pl-4">
                        {req.vmUuid && !isDeleted ? (
                          <Checkbox
                            checked={approvedSelectedIds.has(req.id)}
                            onCheckedChange={() => toggleApprovedSelect(req.id)}
                            aria-label={`Select VM ${req.vmName || req.id}`}
                          />
                        ) : null}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className={`flex h-6 w-6 items-center justify-center rounded-full text-[9px] font-bold text-white shrink-0 ${getAvatarColor(req.studentName)}`}>{getInitials(req.studentName.split(' ')[0] || '', req.studentName.split(' ')[1] || '')}</div>
                          <div>
                            <p className={`font-medium text-sm ${isDeleted ? 'line-through text-muted-foreground' : ''}`}>{req.studentName}</p>
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
                      <TableCell className="font-mono text-sm hidden md:table-cell">{req.vmIp || '—'}</TableCell>
                      <TableCell>
                        {isDeleted ? (
                          <Badge className="bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20 text-xs">
                            <Unplug className="h-3 w-3 mr-1" />
                            Deleted on Host
                          </Badge>
                        ) : req.vmUuid && vmPowerStates[req.vmUuid] ? (
                          (() => {
                            const info = vmStatusInfo(vmPowerStates[req.vmUuid].powerState);
                            return (
                              <Badge className={`${info.bgColor} ${info.color} border text-xs`}>
                                <span className={`inline-block h-1.5 w-1.5 rounded-full mr-1.5 ${vmPowerStates[req.vmUuid].powerState === 'Running' ? 'bg-emerald-500 animate-pulse' : vmPowerStates[req.vmUuid].powerState === 'Halted' ? 'bg-red-500' : 'bg-amber-500'}`} />
                                {info.label}
                              </Badge>
                            );
                          })()
                        ) : !req.vmUuid ? (
                          <Badge className="bg-gray-500/10 text-gray-600 dark:text-gray-400 border-gray-500/20 text-xs">
                            No UUID
                          </Badge>
                        ) : (
                          <Badge className="bg-gray-500/10 text-gray-600 dark:text-gray-400 border-gray-500/20 text-xs">
                            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                            Loading...
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground hidden xl:table-cell">{fmtDateTime(req.reviewedAt || '')}</TableCell>
                      <TableCell className="pr-4 sticky right-0 bg-background group-hover:bg-muted/50">
                        <div className="flex items-center justify-end gap-0.5 flex-nowrap">
                          {/* Power actions — only when vmUuid exists and VM is not deleted */}
                          {req.vmUuid && !isDeleted && (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-100 dark:hover:bg-emerald-900/30"
                                title="Start VM"
                                disabled={isLoading(`${req.vmUuid}-start`)}
                                onClick={() => handleVmAction(req.vmUuid!, 'start')}
                              >
                                {isLoading(`${req.vmUuid}-start`) ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-amber-600 hover:text-amber-700 hover:bg-amber-100 dark:hover:bg-amber-900/30"
                                title="Stop VM"
                                disabled={isLoading(`${req.vmUuid}-stop`)}
                                onClick={() => handleVmAction(req.vmUuid!, 'stop')}
                              >
                                {isLoading(`${req.vmUuid}-stop`) ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Square className="h-3.5 w-3.5" />}
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-blue-600 hover:text-blue-700 hover:bg-blue-100 dark:hover:bg-blue-900/30"
                                title="Reboot VM"
                                disabled={isLoading(`${req.vmUuid}-reboot`)}
                                onClick={() => handleVmAction(req.vmUuid!, 'reboot')}
                              >
                                {isLoading(`${req.vmUuid}-reboot`) ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
                              </Button>
                            </>
                          )}
                          {req.vmUuid && !isDeleted && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-violet-600 hover:text-violet-700 hover:bg-violet-100 dark:hover:bg-violet-900/30"
                              title="View Details"
                              onClick={() => loadVmDetails(req.vmUuid!)}
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          {req.vmUuid && !isDeleted && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-teal-600 hover:text-teal-700 hover:bg-teal-100 dark:hover:bg-teal-900/30"
                              title="Console (SSH/RDP)"
                              onClick={() => openConsoleDialog(req)}
                            >
                              <Terminal className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-red-500 hover:text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30"
                            title="Delete VM"
                            disabled={isLoading(`delete-${req.id}`)}
                            onClick={() => setDeleteDialog({ open: true, requestId: req.id, studentName: req.studentName, templateName: req.templateName || '' })}
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

      {/* ─── Approved VM Batch Action Bar ─── */}
      {approvedSelectedIds.size > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          className="sticky bottom-4 z-50 flex items-center gap-3 rounded-xl border bg-background/95 backdrop-blur-sm shadow-lg px-5 py-3 mb-6"
        >
          <ListChecks className="h-5 w-5 text-emerald-500 shrink-0" />
          <span className="text-sm font-medium">
            {approvedSelectedIds.size} VM{approvedSelectedIds.size !== 1 ? 's' : ''} selected
          </span>
          <div className="flex items-center gap-2 ml-auto">
            <Button size="sm" variant="default" className="h-8 gap-1.5 bg-emerald-600 hover:bg-emerald-700" disabled={approvedBatchLoading} onClick={() => handleApprovedBatchAction('start')}>
              {approvedBatchLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
              Start
            </Button>
            <Button size="sm" variant="default" className="h-8 gap-1.5 bg-amber-600 hover:bg-amber-700" disabled={approvedBatchLoading} onClick={() => handleApprovedBatchAction('stop')}>
              {approvedBatchLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Square className="h-3.5 w-3.5" />}
              Stop
            </Button>
            <Button size="sm" variant="default" className="h-8 gap-1.5 bg-blue-600 hover:bg-blue-700" disabled={approvedBatchLoading} onClick={() => handleApprovedBatchAction('reboot')}>
              {approvedBatchLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
              Reboot
            </Button>
            <Button size="sm" variant="destructive" className="h-8 gap-1.5" disabled={approvedBatchLoading} onClick={() => setBatchDeleteDialog(true)}>
              {approvedBatchLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
              Delete
            </Button>
            <Button size="sm" variant="outline" className="h-8" onClick={clearApprovedSelection} disabled={approvedBatchLoading}>
              Cancel
            </Button>
          </div>
        </motion.div>
      )}

      {/* ─── Pending Requests ─── */}
      {pending.length > 0 && (
        <Card className="shadow-sm mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" /> Pending Requests
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
                        ref={(el) => {
                          if (el) {
                            (el as HTMLButtonElement & { indeterminate?: boolean }).indeterminate = someSelected;
                          }
                        }}
                        onCheckedChange={toggleSelectAll}
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
                    <TableRow key={req.id} className={`transition-colors hover:bg-muted/50 ${selectedIds.has(req.id) ? 'bg-emerald-50/50 dark:bg-emerald-900/10' : idx % 2 === 0 ? 'bg-transparent' : 'bg-muted/30'}`}>
                      <TableCell className="pl-4">
                        <Checkbox
                          checked={selectedIds.has(req.id)}
                          onCheckedChange={() => toggleSelect(req.id)}
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
                            variant="ghost"
                            size="sm"
                            className="h-7 gap-1.5 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-100 dark:hover:bg-emerald-900/30"
                            disabled={isLoading(`approve-${req.id}`)}
                            onClick={() => handleDirectApprove(req)}
                          >
                            {isLoading(`approve-${req.id}`) ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                            Approve
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 gap-1.5 text-violet-600 hover:text-violet-700 hover:bg-violet-100 dark:hover:bg-violet-900/30"
                            onClick={() => {
                              setApproveDialog({ open: true, requestId: req.id, templateName: req.templateName || '' });
                              setApproveForm({ vmName: '', guacProtocol: req.accessProtocol || 'rdp', vmIp: '', vmUser: '', vmPass: '', note: '' });
                            }}
                          >
                            <Settings2 className="h-3.5 w-3.5" />
                            Advanced
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 gap-1.5 text-red-500 hover:text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30"
                            disabled={isLoading(`reject-${req.id}`)}
                            onClick={() => {
                              setRejectDialog({ open: true, requestId: req.id });
                              setRejectNote('');
                            }}
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
      )}

      {/* ─── Batch Action Bar ─── */}
      {selectedIds.size > 0 && pending.some(r => selectedIds.has(r.id)) && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          className="sticky bottom-4 z-50 flex items-center gap-3 rounded-xl border bg-background/95 backdrop-blur-sm shadow-lg px-5 py-3"
        >
          <ListChecks className="h-5 w-5 text-amber-500 shrink-0" />
          <span className="text-sm font-medium">
            {selectedIds.size} selected
          </span>
          <div className="flex items-center gap-2 ml-auto">
            <Button
              size="sm"
              variant="default"
              className="h-8 gap-1.5"
              disabled={batchLoading}
              onClick={handleBatchApprove}
            >
              {batchLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              Approve Selected
            </Button>
            <Button
              size="sm"
              variant="destructive"
              className="h-8 gap-1.5"
              disabled={batchLoading}
              onClick={() => setBatchRejectDialog(true)}
            >
              {batchLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
              Reject Selected
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8"
              onClick={clearSelection}
              disabled={batchLoading}
            >
              Cancel
            </Button>
          </div>
        </motion.div>
      )}

      {/* ─── Rejected Requests (collapsed) ─── */}
      {rejected.length > 0 && (
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <XCircle className="h-4 w-4 text-red-500" /> Rejected Requests
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
                          <div className={`flex h-6 w-6 items-center justify-center rounded-full text-[9px] font-bold text-white shrink-0 ${getAvatarColor(req.studentName)}`}>{getInitials(req.studentName.split(' ')[0] || '', req.studentName.split(' ')[1] || '')}</div>
                          <div>
                            <p className="font-medium text-sm">{req.studentName}</p>
                            <p className="text-xs text-muted-foreground font-mono">{req.studentId}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{req.templateName || '—'}</TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate" title={req.note || ''}>{req.note || '—'}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{fmtDateTime(req.reviewedAt || '')}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* ═══════════════════════════════════════════════
          DIALOGS
          ═══════════════════════════════════════════════ */}

      {/* ─── Approve Dialog ─── */}
      <Dialog open={approveDialog.open} onOpenChange={(open) => { if (!open) setApproveDialog({ open: false, requestId: null, templateName: '' }); }}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-500" /> Advanced Approval
            </DialogTitle>
            <DialogDescription>
              Configure VM details before approving. Leave fields blank for defaults.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="vmName">VM Name</Label>
              <Input
                id="vmName"
                placeholder={approveDialog.templateName || 'Auto-generated from template'}
                value={approveForm.vmName}
                onChange={e => setApproveForm(prev => ({ ...prev, vmName: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">Defaults to template name if left blank</p>
            </div>
            <div className="space-y-2">
              <Label>Access Protocol</Label>
              <div className="flex gap-3">
                {(['rdp', 'ssh', 'vnc'] as const).map(p => (
                  <label key={p} className="flex items-center gap-2 cursor-pointer text-sm">
                    <input
                      type="radio"
                      name="protocol"
                      value={p}
                      checked={approveForm.guacProtocol === p}
                      onChange={() => setApproveForm(prev => ({ ...prev, guacProtocol: p }))}
                      className="accent-emerald-500"
                    />
                    <span className="uppercase font-mono font-medium">{p}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="vmIp">VM IP Address</Label>
                <Input
                  id="vmIp"
                  placeholder="192.168.1.100"
                  value={approveForm.vmIp}
                  onChange={e => setApproveForm(prev => ({ ...prev, vmIp: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="vmUser">VM Username</Label>
                <Input
                  id="vmUser"
                  placeholder="admin"
                  value={approveForm.vmUser}
                  onChange={e => setApproveForm(prev => ({ ...prev, vmUser: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="vmPass">VM Password</Label>
              <Input
                id="vmPass"
                type="password"
                placeholder="••••••••"
                value={approveForm.vmPass}
                onChange={e => setApproveForm(prev => ({ ...prev, vmPass: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="approveNote">Note (optional)</Label>
              <Textarea
                id="approveNote"
                placeholder="Add a note for the student..."
                value={approveForm.note}
                onChange={e => setApproveForm(prev => ({ ...prev, note: e.target.value }))}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setApproveDialog({ open: false, requestId: null, templateName: '' })}>Cancel</Button>
            <Button
              variant="default"
              disabled={isLoading(`approve-${approveDialog.requestId}`)}
              onClick={handleApprove}
            >
              {isLoading(`approve-${approveDialog.requestId}`) ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Check className="h-4 w-4 mr-2" />}
              Approve & Provision
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Reject Dialog ─── */}
      <Dialog open={rejectDialog.open} onOpenChange={(open) => { if (!open) setRejectDialog({ open: false, requestId: null }); }}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-red-500" /> Reject VM Request
            </DialogTitle>
            <DialogDescription>
              Provide a reason for rejecting this request (visible to the student).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="rejectNote">Reason</Label>
              <Textarea
                id="rejectNote"
                placeholder="e.g., insufficient resources, invalid template, policy violation..."
                value={rejectNote}
                onChange={e => setRejectNote(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setRejectDialog({ open: false, requestId: null })}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={isLoading(`reject-${rejectDialog.requestId}`)}
              onClick={handleReject}
            >
              {isLoading(`reject-${rejectDialog.requestId}`) ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <X className="h-4 w-4 mr-2" />}
              Reject Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Delete Confirmation Dialog ─── */}
      <Dialog open={deleteDialog.open} onOpenChange={(open) => { if (!open) setDeleteDialog({ open: false, requestId: null, studentName: '', templateName: '' }); }}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" /> Delete VM
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="flex items-start gap-3 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
              <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5 shrink-0" />
              <div className="text-sm">
                <p className="font-medium text-red-700 dark:text-red-400">This action cannot be undone!</p>
                <p className="text-red-600 dark:text-red-400/80 mt-1">
                  The VM will be <strong>destroyed on XCP-ng</strong> and all Guacamole resources (user &amp; connection) will be permanently removed.
                </p>
              </div>
            </div>
            <div className="text-sm space-y-1">
              <p><span className="text-muted-foreground">Student:</span> <strong>{deleteDialog.studentName}</strong></p>
              <p><span className="text-muted-foreground">Template:</span> <strong>{deleteDialog.templateName}</strong></p>
            </div>
          </div>
          <DialogFooter>
            <div className="flex items-center gap-3 w-full justify-end">
            <Button variant="outline" onClick={() => setDeleteDialog({ open: false, requestId: null, studentName: '', templateName: '' })}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={isLoading(`delete-${deleteDialog.requestId}`)}
              onClick={handleDelete}
            >
              {isLoading(`delete-${deleteDialog.requestId}`) ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Trash2 className="h-4 w-4 mr-2" />}
              Delete VM &amp; Resources
            </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Batch Delete Confirmation Dialog ─── */}
      <Dialog open={batchDeleteDialog} onOpenChange={(open) => { if (!open) setBatchDeleteDialog(false); }}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" /> Batch Delete VMs
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="flex items-start gap-3 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
              <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5 shrink-0" />
              <div className="text-sm">
                <p className="font-medium text-red-700 dark:text-red-400">This action cannot be undone!</p>
                <p className="text-red-600 dark:text-red-400/80 mt-1">
                  <strong>{approvedSelectedIds.size} VM{approvedSelectedIds.size !== 1 ? 's' : ''}</strong> will be <strong>destroyed on XCP-ng</strong> and all Guacamole resources (users &amp; connections) will be permanently removed.
                </p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <div className="flex items-center gap-3 w-full justify-end">
            <Button variant="outline" onClick={() => setBatchDeleteDialog(false)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={approvedBatchLoading}
              onClick={handleBatchDelete}
            >
              {approvedBatchLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Trash2 className="h-4 w-4 mr-2" />}
              Delete {approvedSelectedIds.size} VM{approvedSelectedIds.size !== 1 ? 's' : ''}
            </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Batch Reject Dialog ─── */}
      <Dialog open={batchRejectDialog} onOpenChange={(open) => { if (!open) setBatchRejectDialog(false); }}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-red-500" /> Batch Reject ({selectedIds.size} requests)
            </DialogTitle>
            <DialogDescription>
              Provide an optional reason for rejecting these requests (visible to students).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="batchRejectNote">Reason (optional)</Label>
              <Textarea
                id="batchRejectNote"
                placeholder="e.g., insufficient resources, maintenance window, policy violation..."
                value={batchRejectNote}
                onChange={e => setBatchRejectNote(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => { setBatchRejectDialog(false); setBatchRejectNote(''); }}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={batchLoading}
              onClick={handleBatchReject}
            >
              {batchLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <X className="h-4 w-4 mr-2" />}
              Reject {selectedIds.size} Requests
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── VM Details Dialog ─── */}
      <Dialog open={detailsDialog} onOpenChange={setDetailsDialog}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Info className="h-5 w-5 text-violet-500" /> VM Details
            </DialogTitle>
            <DialogDescription>Virtual machine resource information from XCP-ng</DialogDescription>
          </DialogHeader>
          <div className="py-2">
            {loadingDetails ? (
              <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" /> Loading VM details...
              </div>
            ) : selectedVmDetails ? (
              <div className="space-y-3">
                {/* VM Name & Power State */}
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div>
                    <p className="font-semibold text-sm">{selectedVmDetails.name_label || selectedVmDetails.name || 'Unknown VM'}</p>
                    <p className="text-xs text-muted-foreground font-mono mt-0.5">{selectedVmDetails.uuid || ''}</p>
                  </div>
                  <Badge
                    className={
                      selectedVmDetails.power_state === 'Running'
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                        : 'bg-gray-500/10 text-gray-600 dark:text-gray-400 border-gray-500/20'
                    }
                  >
                    <span className={`inline-block h-1.5 w-1.5 rounded-full mr-1.5 ${selectedVmDetails.power_state === 'Running' ? 'bg-emerald-500' : 'bg-gray-500'}`} />
                    {selectedVmDetails.power_state || 'Unknown'}
                  </Badge>
                </div>
                {/* Resource Grid */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center gap-2.5 p-3 rounded-lg bg-muted/30">
                    <div className="flex h-8 w-8 items-center justify-center rounded-md bg-blue-100 dark:bg-blue-900/30">
                      <Cpu className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">vCPUs</p>
                      <p className="font-semibold text-sm">{selectedVmDetails.vCPUs_live || selectedVmDetails.vCPUs_max || selectedVmDetails.VCPUs_at_startup || selectedVmDetails.vcpus || '—'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5 p-3 rounded-lg bg-muted/30">
                    <div className="flex h-8 w-8 items-center justify-center rounded-md bg-violet-100 dark:bg-violet-900/30">
                      <MemoryStick className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Memory</p>
                      <p className="font-semibold text-sm">{formatMemory(selectedVmDetails.memory_actual || selectedVmDetails.memory_dynamic_max || selectedVmDetails.memory_static_max || selectedVmDetails.memory)}</p>
                    </div>
                  </div>
                </div>
                {/* Network Info */}
                {(selectedVmDetails.ip || selectedVmDetails.networks) && (
                  <div className="p-3 rounded-lg bg-muted/30">
                    <div className="flex items-center gap-2 mb-2">
                      <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                      <p className="text-xs font-medium text-muted-foreground">Network</p>
                    </div>
                    <div className="space-y-1.5">
                      {selectedVmDetails.ip && selectedVmDetails.ip !== '127.0.0.1' && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-mono text-xs">IP Address</span>
                          <span className="font-mono text-xs text-emerald-600 dark:text-emerald-400">{selectedVmDetails.ip}</span>
                        </div>
                      )}
                      {!selectedVmDetails.ip || selectedVmDetails.ip === '127.0.0.1' ? (
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-mono text-xs">IP Address</span>
                          <span className="font-mono text-xs text-muted-foreground">No IP detected</span>
                        </div>
                      ) : null}
                      {selectedVmDetails.osVersion && selectedVmDetails.osVersion.name && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground text-xs">OS</span>
                          <span className="font-medium text-xs">{selectedVmDetails.osVersion.name}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                {/* OS / Description */}
                {selectedVmDetails.os || selectedVmDetails.description ? (
                  <div className="p-3 rounded-lg bg-muted/30 space-y-1">
                    {selectedVmDetails.os && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">OS</span>
                        <span className="font-medium text-xs">{selectedVmDetails.os}</span>
                      </div>
                    )}
                    {selectedVmDetails.description && (
                      <div className="flex items-start justify-between text-sm gap-4">
                        <span className="text-muted-foreground shrink-0">Description</span>
                        <span className="text-xs text-right">{selectedVmDetails.description}</span>
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <Info className="h-8 w-8 mb-2" />
                <p className="text-sm">No details available</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailsDialog(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Console Connect Dialog ─── */}
      <Dialog open={consoleDialog.open} onOpenChange={(open) => !open && setConsoleDialog({ open: false, requestId: null, vmName: '', vmIp: '', studentName: '' })}>
        <DialogContent className="sm:max-w-2xl w-full">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Terminal className="h-5 w-5 text-teal-600 shrink-0" />
              Console Access
            </DialogTitle>
            <DialogDescription>
              {consoleDialog.vmName} · {consoleDialog.studentName}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* VM Info */}
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/40">
              <Monitor className="h-8 w-8 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm" title={consoleDialog.vmName}>{consoleDialog.vmName}</p>
                <p className="text-xs text-muted-foreground font-mono">IP: {consoleDialog.vmIp}</p>
              </div>
            </div>

            {/* Protocol Selection */}
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground">PROTOCOL</Label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  className={`flex items-center justify-center gap-2 rounded-lg border-2 px-4 py-2.5 text-sm font-medium transition-all ${
                    consoleProtocol === 'rdp'
                      ? 'border-teal-500 bg-teal-50 text-teal-700 dark:bg-teal-900/20 dark:text-teal-300'
                      : 'border-muted bg-background text-muted-foreground hover:border-muted-foreground/30'
                  }`}
                  onClick={() => { setConsoleProtocol('rdp'); setConsoleUser('lab'); setConsolePass('000000'); }}
                >
                  <Monitor className="h-4 w-4 shrink-0" />
                  RDP
                </button>
                <button
                  type="button"
                  className={`flex items-center justify-center gap-2 rounded-lg border-2 px-4 py-2.5 text-sm font-medium transition-all ${
                    consoleProtocol === 'ssh'
                      ? 'border-teal-500 bg-teal-50 text-teal-700 dark:bg-teal-900/20 dark:text-teal-300'
                      : 'border-muted bg-background text-muted-foreground hover:border-muted-foreground/30'
                  }`}
                  onClick={() => { setConsoleProtocol('ssh'); setConsoleUser('xen'); setConsolePass('000000'); }}
                >
                  <Terminal className="h-4 w-4 shrink-0" />
                  SSH
                </button>
              </div>
            </div>

            {/* VM Credentials */}
            <div className="space-y-3">
              <Label className="text-xs font-medium text-muted-foreground">VM CREDENTIALS</Label>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Label className="text-xs text-muted-foreground w-20 shrink-0">Username</Label>
                  <Input
                    value={consoleUser}
                    onChange={e => setConsoleUser(e.target.value)}
                    className="h-9 text-sm font-mono"
                    placeholder={consoleProtocol === 'ssh' ? 'xen' : 'lab'}
                  />
                </div>
                <div className="flex items-center gap-3">
                  <Label className="text-xs text-muted-foreground w-20 shrink-0">Password</Label>
                  <Input
                    type="password"
                    value={consolePass}
                    onChange={e => setConsolePass(e.target.value)}
                    className="h-9 text-sm font-mono"
                    placeholder="000000"
                  />
                </div>
              </div>
            </div>

            {/* Connection Info */}
            <div className="flex items-center justify-between p-2.5 rounded bg-muted/30 text-xs">
              <span className="text-muted-foreground">Guacamole: Root (Admin)</span>
              <span className="font-mono text-muted-foreground">{consoleProtocol.toUpperCase()} :{consoleProtocol === 'rdp' ? '3389' : '22'}</span>
            </div>
          </div>
          <DialogFooter>
            <div className="flex items-center gap-3 w-full justify-end">
            <Button variant="outline" onClick={() => setConsoleDialog({ open: false, requestId: null, vmName: '', vmIp: '', studentName: '' })}>
              Cancel
            </Button>
            <Button
              className="gap-2 bg-teal-600 hover:bg-teal-700 text-white"
              disabled={consoleConnecting}
              onClick={handleConnectConsole}
            >
              {consoleConnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Terminal className="h-4 w-4" />}
              Connect {consoleProtocol.toUpperCase()}
            </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
    </TooltipProvider>
  );
}
