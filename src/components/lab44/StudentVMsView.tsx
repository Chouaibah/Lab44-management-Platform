'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { useLab44Store } from '@/store/lab44';
import { fetchWithTimeout } from '@/lib/fetch-timeout';
import type { XCPNGTemplate, VMRequest } from '@/types';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Card, CardContent, CardHeader, CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { launchNextermConsole, normalizeNextermBaseUrl } from '@/lib/nexterm-launch';

import {
  Plus, RefreshCw, Server, Monitor, Globe, Terminal, Copy, Check,
  ChevronLeft, HardDrive, Shield, Link, ExternalLink, Star, Loader2,
  Clock, Activity, Zap, Search, Trash2,
  Play, Square, RotateCcw, CircleDot, XCircle, AlertCircle,
  Power,
} from 'lucide-react';

import {
BreadcrumbNav, EmptyState, fadeSlide, vmStatusBadge, fmtDateTime,
fmtDate,
} from '@/lib/helpers';

// ─── Student VMs View ─────────────────────────────────────────────────────────

export default function StudentVMsView() {
  const { auth, vmRequests, setVmRequests, setView } = useLab44Store();
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [connectStatuses, setConnectStatuses] = useState<Record<number, 'unknown' | 'accessible'>>({});
  const [vmStates, setVmStates] = useState<Record<number, { powerState: string; ip: string | null; exists: boolean; fetchFailed: boolean }>>({});
  const student = auth.student;

  // VM action states
  const [vmActionLoading, setVmActionLoading] = useState<Record<string, string | null>>({});

  // ─── Connect dialog state ─────────────────────────────────────────────────
  const [connectDialog, setConnectDialog] = useState<{
    open: boolean;
    req: VMRequest | null;
    protocol: 'rdp' | 'ssh';
    osUser: string;
    osPass: string;
    connecting: boolean;
  }>({ open: false, req: null, protocol: 'rdp', osUser: 'lab', osPass: '000000', connecting: false });

  const openConnectDialog = (req: VMRequest, protocol: 'rdp' | 'ssh') => {
    setConnectDialog({
      open: true,
      req,
      protocol,
      osUser: protocol === 'ssh' ? 'xen' : 'lab',
      osPass: '000000',  // default password — user can change before connecting
      connecting: false,
    });
  };

  const closeConnectDialog = () => {
    setConnectDialog(prev => ({ ...prev, open: false, connecting: false }));
  };

  const switchDialogProtocol = (p: 'rdp' | 'ssh') => {
    setConnectDialog(prev => ({
      ...prev,
      protocol: p,
      osUser: p === 'ssh' ? 'xen' : 'lab',
      osPass: '000000',
    }));
  };

  const [clearingDeleted, setClearingDeleted] = useState(false);

  // Fetch VM states from XCP-ng host
  useEffect(() => {
    if (!student || loading || !Array.isArray(vmRequests)) return;
    const approvedVms = vmRequests.filter(r => r.status === 'approved' && r.vmUuid);
    if (approvedVms.length === 0) return;

    const fetchVmStates = async () => {
      setVmStates(prev => {
        const newStates: typeof prev = { ...prev };
        for (const req of approvedVms) {
          if (!req.vmUuid) continue;
          // Keep previous state as baseline so we don't overwrite good data
          if (!newStates[req.id]) {
            newStates[req.id] = { powerState: 'Unknown', ip: null, exists: true, fetchFailed: false };
          }
        }
        return newStates;
      });

      // Fetch fresh data from XCP-ng
      for (const req of approvedVms) {
        if (!req.vmUuid) continue;
        try {
          const res = await fetch(`/api/xapi/vms/${req.vmUuid}/details`);
          if (res.ok) {
            const data = await res.json();
            setVmStates(prev => ({
              ...prev,
              [req.id]: {
                powerState: data.power_state || 'Unknown',
                ip: data.ip || null,
                exists: true,
                fetchFailed: false,
              },
            }));
          } else {
            // Don't mark exists=false on first failure — the VM may still be provisioning
            // Just track that the fetch failed so we can show a "Provisioning" state
            setVmStates(prev => ({
              ...prev,
              [req.id]: {
                ...prev[req.id],
                powerState: prev[req.id]?.powerState || 'Provisioning',
                fetchFailed: true,
                exists: true, // Keep exists=true so the card stays visible
              },
            }));
          }
        } catch {
          setVmStates(prev => ({
            ...prev,
            [req.id]: {
              ...prev[req.id],
              powerState: prev[req.id]?.powerState || 'Provisioning',
              fetchFailed: true,
              exists: true,
            },
          }));
        }
      }
    };

    fetchVmStates();
    // Poll more frequently for provisioning VMs (10s) vs stable ones (30s)
    const getInterval = () => {
      const states = useLab44Store.getState().vmRequests;
      const hasProvisioning = approvedVms.some(req => {
        const state = vmStates[req.id];
        return !state || state.fetchFailed;
      });
      return hasProvisioning ? 10000 : 30000;
    };
    const interval = setInterval(fetchVmStates, 10000);
    return () => clearInterval(interval);
  }, [student, loading, vmRequests]);

  useEffect(() => {
    if (!student) return;
    if (Array.isArray(vmRequests) && vmRequests.length > 0) setLoading(false);
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/vm-requests?studentDbId=${student.id}`);
        const data = await res.json();
        if (!cancelled) setVmRequests(data.requests || []);
      } catch { if (!cancelled) toast.error('Failed to load VM requests'); }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [student, setVmRequests]);

  const handleRefresh = async () => {
    if (!student) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/vm-requests?studentDbId=${student.id}`);
      const data = await res.json();
      setVmRequests(data.requests || []);
    } catch { toast.error('Failed to load VM requests'); }
    setLoading(false);
  };

  const copyToClipboard = (text: string, id: number) => {
    const doCopy = () => {
      setCopiedId(id);
      toast.success('Copied to clipboard!');
      setTimeout(() => setCopiedId(null), 2000);
    };
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(doCopy).catch(() => fallbackCopyVm(text, doCopy));
    } else {
      fallbackCopyVm(text, doCopy);
    }
  };

  const fallbackCopyVm = (text: string, onSuccess?: () => void) => {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    try { document.execCommand('copy'); onSuccess?.(); } catch { toast.error('Copy failed — please copy manually'); }
    document.body.removeChild(ta);
  };

  const handleConnect = (req: typeof vmRequests[0]) => {
    if (!req.vmIp) return;
    const protocol = (req.accessProtocol || 'SSH').toUpperCase();
    if (protocol === 'RDP') {
      const rdpUrl = `rdp://full%20address:s:${req.vmIp}`;
      window.open(rdpUrl, '_blank');
      setConnectStatuses(prev => ({ ...prev, [req.id]: 'accessible' }));
    } else {
      const sshUrl = `ssh://student@${req.vmIp}`;
      navigator.clipboard.writeText(sshUrl);
      toast.success(`SSH command copied: ${sshUrl}`);
      setCopiedId(req.id);
      setConnectStatuses(prev => ({ ...prev, [req.id]: 'accessible' }));
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  const handleVmAction = async (vmId: string, action: 'start' | 'stop' | 'reboot') => {
    setVmActionLoading(prev => ({ ...prev, [`${vmId}-${action}`]: action }));
    try {
      const res = await fetch(`/api/xapi/vms/${vmId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (res.ok) {
        if (data.vmIp) {
          // Update IP in local state immediately
          setVmRequests(prev => prev.map(r => r.vmUuid === vmId ? { ...r, vmIp: data.vmIp } : r));
        }
        toast.success(data.message || `${action} successful`);
        handleRefresh();
      } else {
        toast.error(data.error || `Failed to ${action}`);
      }
    } catch {
      toast.error(`Failed to ${action} VM`);
    } finally {
      setVmActionLoading(prev => ({ ...prev, [`${vmId}-${action}`]: null }));
    }
  };

  const handleVmDelete = async (req: VMRequest) => {
    if (!req.vmUuid) return;
    if (!confirm(`Delete VM "${req.vmName || req.vmUuid}"? This cannot be undone.`)) return;
    setVmActionLoading(prev => ({ ...prev, [`${req.vmUuid}-destroy`]: 'destroy' }));
    try {
      const res = await fetch(`/api/xapi/vms/${req.vmUuid}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'destroy' }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success('VM deleted');
        handleRefresh();
      } else {
        toast.error(data.error || 'Failed to delete VM');
      }
    } catch {
      toast.error('Failed to delete VM');
    } finally {
      setVmActionLoading(prev => ({ ...prev, [`${req.vmUuid}-destroy`]: null }));
    }
  };

  const handleConnectFromDialog = async () => {
    const { req, protocol, osUser, osPass } = connectDialog;
    if (!req) return;

    setConnectDialog(prev => ({ ...prev, connecting: true }));
    const key = `${req.id}-guac`;
    setVmActionLoading(prev => ({ ...prev, [key]: 'connecting' }));
    try {
      const res = await fetchWithTimeout('/api/guacamole/auth/student', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId: req.id, protocol, osUser, osPass }),
      });
      const data = await res.json();
      if (res.ok) {
        const baseUrl = normalizeNextermBaseUrl(data.url);

        if (data.provider === 'nexterm') {
          // Nexterm needs TWO navigations: the first carries the session token
          // (signing the student in — nothing typed), the second opens their
          // entry. A single combined URL loses connectId, because Nexterm
          // rewrites the URL as soon as it stores the token. The shared helper
          // waits for that write instead of racing it with a fixed timer.
          launchNextermConsole({
            baseUrl,
            sessionToken: data.authToken,
            entryId: data.identifier,
          });
          toast.success('Opening the console...');
          closeConnectDialog();
        } else {
          const connectionStr = `${data.identifier}\0c\0${data.dataSource}`;
          const clientId = btoa(connectionStr).replace(/=+$/, '');
          window.open(`${baseUrl}/#/client/${clientId}?token=${data.authToken}`, '_blank', 'noopener,noreferrer');
          toast.success('Opening remote session...');
          closeConnectDialog();
        }
      } else {
        toast.error(data.error || 'Could not connect to VM');
      }
    } catch (err: any) {
      toast.error(err.message || 'Guacamole connection failed');
    } finally {
      setVmActionLoading(prev => ({ ...prev, [key]: null }));
      setConnectDialog(prev => ({ ...prev, connecting: false }));
    }
  };

  const handleClearDeleted = async () => {
    if (!student) return;
    const approvedVms = vmRequests.filter(r => r.status === 'approved' && r.vmUuid);
    if (approvedVms.length === 0) {
      toast.info('No approved VMs to check');
      return;
    }
    setClearingDeleted(true);
    try {
      const deletedIds: number[] = [];
      for (const req of approvedVms) {
        if (!req.vmUuid) continue;
        try {
          const res = await fetch(`/api/xapi/vms/${req.vmUuid}/details`);
          if (res.status === 404) {
            // VM no longer exists on host
            deletedIds.push(req.id);
          } else if (!res.ok) {
            // Other errors (500, etc.) — check response body for "not found" indicators
            try {
              const data = await res.json();
              if (data.error && (data.error.toLowerCase().includes('not found') || data.error.toLowerCase().includes('does not exist'))) {
                deletedIds.push(req.id);
              }
            } catch { /* ignore parse errors */ }
          }
        } catch {
          // Network errors — don't assume deleted
        }
      }
      if (deletedIds.length === 0) {
        toast.info('All VMs are still active on the host');
      } else {
        // Remove deleted VMs from the local state
        const remaining = vmRequests.filter(r => !deletedIds.includes(r.id));
        setVmRequests(remaining);
        // Also clear their VM states
        setVmStates(prev => {
          const next = { ...prev };
          for (const id of deletedIds) {
            delete next[id];
          }
          return next;
        });
        toast.success(`Removed ${deletedIds.length} deleted VM${deletedIds.length !== 1 ? 's' : ''} from your list`);
      }
    } catch {
      toast.error('Failed to check VM status');
    }
    setClearingDeleted(false);
  };

  if (!student) return null;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <motion.div {...fadeSlide}>
        <div className="flex items-center gap-3 mb-6 flex-wrap">
          <BreadcrumbNav items={[{ label: 'Dashboard', view: 'student-choice' }, { label: 'VMs' }]} />
          <Button onClick={() => setView('student-vm-picker')} className="ml-auto">
            <Plus className="h-4 w-4 mr-1" /> Request VM
          </Button>
          <Button variant="outline" size="icon" className="h-9 w-9" onClick={handleRefresh} title="Refresh">
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
          {/*
          <Button variant="outline" size="sm" className="h-9 gap-1" onClick={handleClearDeleted} disabled={clearingDeleted} title="Clear deleted VMs">
            {clearingDeleted ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
            Clear Deleted
          </Button>
          */}
        </div>

{loading ? (
          <div className="space-y-4">
            {[...Array(2)].map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)}
          </div>
        ) : !Array.isArray(vmRequests) || vmRequests.length === 0 ? (
          <EmptyState
            icon={Monitor}
            title="No VM Requests"
            description="You haven't requested any virtual machines yet."
          />
        ) : (
          <div className="space-y-4">
            {vmRequests.map((req) => (
              <Card key={req.id} className="shadow-sm">
                <CardContent className="p-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Server className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="font-semibold truncate">{req.vmName || `VM Request #${req.id}`}</span>
                        {vmStatusBadge(req.status)}
                      </div>
                      {/* Feature 5: VM Status Timeline */}
                      <VMStatusTimeline req={req} />
                      <div className="text-xs text-muted-foreground space-y-0.5 mt-1">
                        <p>Template: {req.templateName || 'Custom'}</p>
                        <p>Requested: {fmtDateTime(req.requestedAt)}</p>
                        {req.reviewedAt && <p>Reviewed: {fmtDateTime(req.reviewedAt)}</p>}
                        {req.note && <p className="text-amber-600 dark:text-amber-400">Note: {req.note}</p>}
                      </div>
                    </div>
{req.status === 'approved' && (
            <div className="flex flex-col gap-2 sm:items-end shrink-0 bg-emerald-50/80 dark:bg-emerald-950/30 rounded-lg p-3 min-w-0">
              {/* VM Power State */}
              <div className="flex items-center gap-2 mb-1">
                <span className={`relative flex h-2.5 w-2.5 shrink-0 ${
                  vmStates[req.id]?.powerState === 'Running' ? 'animate-pulse' : ''
                }`}>
                  {vmStates[req.id]?.fetchFailed ? (
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-400" />
                  ) : (
                    <>
                      <span className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${
                        vmStates[req.id]?.powerState === 'Running' ? 'bg-emerald-400' : 'bg-gray-400'
                      }`} style={{ animationDuration: '2s' }} />
                      <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                        vmStates[req.id]?.powerState === 'Running' ? 'bg-emerald-500' : 'bg-gray-500'
                      }`} />
                    </>
                  )}
                </span>
                <div className="flex flex-col">
                  <span className={`text-[10px] font-medium flex items-center gap-1 ${
                    vmStates[req.id]?.fetchFailed
                      ? 'text-amber-600 dark:text-amber-400'
                      : vmStates[req.id]?.powerState === 'Running'
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-muted-foreground'
                  }`}>
                    <Power className="h-3 w-3" />
                    {vmStates[req.id]?.fetchFailed
                      ? 'Provisioning...'
                      : vmStates[req.id]?.powerState === 'Running'
                      ? 'Running'
                      : vmStates[req.id]?.powerState || 'Checking...'}
                  </span>
                </div>
              </div>
              {/* VM IP Address (live from guest tools) - with waiting state */}
              {vmStates[req.id] === undefined || vmStates[req.id]?.fetchFailed ? (
                <div className="flex items-center gap-1.5">
                  <Globe className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                  <span className="text-xs text-amber-600 dark:text-amber-400 animate-pulse">
                    {vmStates[req.id]?.fetchFailed ? 'VM provisioning, waiting for IP...' : 'Waiting for IP address...'}
                  </span>
                </div>
              ) : vmStates[req.id]?.ip && vmStates[req.id].ip !== '127.0.0.1' ? (
                <div className="flex items-center gap-1.5">
                  <Globe className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span className="font-mono text-sm font-medium text-emerald-700 dark:text-emerald-300">{vmStates[req.id].ip}</span>
                  <button onClick={() => copyToClipboard(vmStates[req.id].ip!, req.id)} className="text-muted-foreground hover:text-foreground">
                    {copiedId === req.id ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1.5">
                  <Globe className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                  <span className="text-xs text-gray-500">No IP yet (VM may be halted)</span>
                </div>
              )}
              {/* VM Control Buttons */}
              <div className="flex flex-wrap gap-1.5 mt-1">
                {req.vmUuid && (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs gap-1 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-950/50"
                      disabled={!!vmActionLoading[`${req.vmUuid}-start`]}
                      onClick={() => handleVmAction(req.vmUuid!, 'start')}
                    >
                      {vmActionLoading[`${req.vmUuid}-start`] ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
                      Start
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs gap-1 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-950/50"
                      disabled={!!vmActionLoading[`${req.vmUuid}-stop`]}
                      onClick={() => handleVmAction(req.vmUuid!, 'stop')}
                    >
                      {vmActionLoading[`${req.vmUuid}-stop`] ? <Loader2 className="h-3 w-3 animate-spin" /> : <Square className="h-3 w-3" />}
                      Stop
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs gap-1 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800/50"
                      disabled={!!vmActionLoading[`${req.vmUuid}-reboot`]}
                      onClick={() => handleVmAction(req.vmUuid!, 'reboot')}
                    >
                      {vmActionLoading[`${req.vmUuid}-reboot`] ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
                      Reboot
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs gap-1 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-950/50"
                      disabled={!!vmActionLoading[`${req.vmUuid}-destroy`]}
                      onClick={() => handleVmDelete(req)}
                    >
                      {vmActionLoading[`${req.vmUuid}-destroy`] ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                      Delete
                    </Button>
                  </>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs gap-1 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-950/50"
                  onClick={() => openConnectDialog(req, 'rdp')}
                  disabled={!!vmActionLoading[`${req.id}-guac`]}
                >
                  {vmActionLoading[`${req.id}-guac`] ? <Loader2 className="h-3 w-3 animate-spin" /> : <ExternalLink className="h-3 w-3" />}
                  Connect RDP
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs gap-1 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-950/50"
                  onClick={() => openConnectDialog(req, 'ssh')}
                  disabled={!!vmActionLoading[`${req.id}-guac`]}
                >
                  {vmActionLoading[`${req.id}-guac`] ? <Loader2 className="h-3 w-3 animate-spin" /> : <Terminal className="h-3 w-3" />}
                  Connect SSH
                </Button>
              </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </motion.div>

      {/* ─── Connect Dialog ─────────────────────────────────────────────────── */}
      <Dialog open={connectDialog.open} onOpenChange={v => !v && closeConnectDialog()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Terminal className="h-5 w-5 text-cyan-600 shrink-0" /> Connect to VM
            </DialogTitle>
            <DialogDescription>
              {connectDialog.req?.vmName || 'VM'} · {vmStates[connectDialog.req?.id ?? -1]?.ip || connectDialog.req?.vmIp || '—'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Protocol selector */}
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground">PROTOCOL</Label>
              <div className="grid grid-cols-2 gap-3">
                {(['rdp', 'ssh'] as const).map(p => (
                  <button
                    key={p}
                    type="button"
                    className={`flex items-center justify-center gap-2 rounded-lg border-2 px-4 py-2.5 text-sm font-medium transition-all ${
                      connectDialog.protocol === p
                        ? 'border-cyan-500 bg-cyan-50 text-cyan-700 dark:bg-cyan-900/20 dark:text-cyan-300'
                        : 'border-muted bg-background text-muted-foreground hover:border-muted-foreground/30'
                    }`}
                    onClick={() => switchDialogProtocol(p)}
                  >
                    {p === 'rdp' ? <Monitor className="h-4 w-4 shrink-0" /> : <Terminal className="h-4 w-4 shrink-0" />}
                    {p.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            {/* VM credentials */}
            <div className="space-y-3">
              <Label className="text-xs font-medium text-muted-foreground">VM LOGIN CREDENTIALS</Label>
              <div className="flex items-center gap-3">
                <Label className="text-xs text-muted-foreground w-20 shrink-0">Username</Label>
                <Input
                  type="text"
                  value={connectDialog.osUser}
                  onChange={e => setConnectDialog(prev => ({ ...prev, osUser: e.target.value }))}
                  className="h-9 text-sm font-mono"
                  placeholder={connectDialog.protocol === 'ssh' ? 'xen' : 'lab'}
                />
              </div>
              <div className="flex items-center gap-3">
                <Label className="text-xs text-muted-foreground w-20 shrink-0">Password</Label>
                <Input
                  type="text"
                  value={connectDialog.osPass}
                  onChange={e => setConnectDialog(prev => ({ ...prev, osPass: e.target.value }))}
                  className="h-9 text-sm font-mono"
                  placeholder="Leave empty if no password"
                />
              </div>
            </div>

            <div className="flex items-center justify-between p-2.5 rounded bg-muted/30 text-xs">
              <span className="text-muted-foreground">Port: {connectDialog.protocol === 'rdp' ? '3389' : '22'}</span>
              <span className="font-mono text-muted-foreground">{connectDialog.protocol.toUpperCase()}</span>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeConnectDialog}>Cancel</Button>
            <Button
              className="gap-2 bg-cyan-600 hover:bg-cyan-700 text-white"
              disabled={connectDialog.connecting}
              onClick={handleConnectFromDialog}
            >
              {connectDialog.connecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Terminal className="h-4 w-4" />}
              Connect {connectDialog.protocol.toUpperCase()}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
  </div>
  );
}

// ─── Feature 5: VM Status Timeline Component ────────────────────────────────────

function VMStatusTimeline({ req }: { req: VMRequest }) {
  const steps = [
    { label: 'Created', date: req.requestedAt, color: 'bg-blue-500', done: true, active: req.status === 'pending' },
    { label: 'Pending', date: req.requestedAt, color: 'bg-amber-500', done: req.status !== 'pending', active: req.status === 'pending' },
    { label: req.status === 'rejected' ? 'Rejected' : 'Approved', date: req.reviewedAt, color: req.status === 'rejected' ? 'bg-red-500' : 'bg-emerald-500', done: req.status !== 'pending', active: req.status !== 'pending' },
  ];

  return (
    <div className="flex items-center gap-0 mt-2">
      {steps.map((step, idx) => (
        <React.Fragment key={step.label}>
          {idx > 0 && (
            <div className={`h-0.5 flex-1 min-w-[24px] max-w-[60px] ${step.done ? 'bg-muted-foreground/40' : 'bg-muted-foreground/15'}`} />
          )}
          <div className="flex flex-col items-center">
            <div className="relative">
              {step.active && step.label === 'Pending' && (
                <span className="absolute inset-0 flex items-center justify-center">
                  <span className="animate-ping absolute h-5 w-5 rounded-full bg-amber-400/40" style={{ animationDuration: '2s' }} />
                </span>
              )}
              <div className={`flex items-center justify-center rounded-full ${
                step.active
                  ? `h-5 w-5 ${step.color} shadow-md`
                  : step.done
                    ? 'h-3 w-3 bg-muted-foreground/40'
                    : 'h-3 w-3 bg-muted-foreground/15'
              }`}>
                {step.active && step.done && (
                  <Check className="h-3 w-3 text-white" />
                )}
                {step.active && step.label === 'Pending' && (
                  <Clock className="h-2.5 w-2.5 text-white" />
                )}
                {step.active && step.label === 'Rejected' && (
                  <XCircle className="h-3 w-3 text-white" />
                )}
              </div>
            </div>
            <span className={`text-[8px] mt-0.5 ${step.active ? 'font-semibold' : 'text-muted-foreground'}`}>{step.label}</span>
            {step.date && (
              <span className="text-[7px] text-muted-foreground">{fmtDate(step.date)}</span>
            )}
          </div>
        </React.Fragment>
      ))}
    </div>
  );
}

// ─── Student VM Picker View ───────────────────────────────────────────────────

export function StudentVMPickerView() {
  const { auth, setView, setVmRequests, studentLabs, labs } = useLab44Store();
  const student = auth.student;
  const [protocol, setProtocol] = useState('SSH');
  const [templateName, setTemplateName] = useState('');
  const [templateUuid, setTemplateUuid] = useState('');
  const [labId, setLabId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [templateSearch, setTemplateSearch] = useState('');

  // Enrolled labs for the selector
  const enrolledLabs = labs.filter(lab => studentLabs.some(sl => sl.labId === lab.id && sl.studentId === student?.id));

  // XCP-ng template fetching
  const [templates, setTemplates] = useState<(XCPNGTemplate & { icon: typeof Monitor; color: string; bg: string; selectedBg: string })[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(true);
  const [templatesFromXcpng, setTemplatesFromXcpng] = useState(false);
  const [templatesError, setTemplatesError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const MAX_RETRIES = 3;
  const BASE_RETRY_DELAY = 1000; // Start with 1 second
  const [creationStep, setCreationStep] = useState<'idle' | 'requesting' | 'creating' | 'done'>('idle');

  const fetchTemplatesWithRetry = async (attempt: number = 0): Promise<void> => {
    setTemplatesLoading(true);
    setTemplatesError(null);

    try {
      const res = await fetchWithTimeout('/api/xcp-ng/templates');
      const data = await res.json();

      if (!res.ok) {
        // Handle HTTP errors (502, etc.)
        const errorMsg = data.error || `Failed to fetch templates (HTTP ${res.status})`;

        // If it's a 502 and we haven't exceeded max retries, retry with exponential backoff
        if (res.status === 502 && attempt < MAX_RETRIES) {
          const delay = BASE_RETRY_DELAY * Math.pow(2, attempt);
          console.log(`XCP-ng templates fetch failed with 502, retrying in ${delay}ms (attempt ${attempt + 1}/${MAX_RETRIES})`);
          await new Promise(r => setTimeout(r, delay));
          return fetchTemplatesWithRetry(attempt + 1);
        }

        throw new Error(errorMsg);
      }

      if (Array.isArray(data.templates) && data.templates.length > 0) {
        const iconMap: Record<string, typeof Monitor> = {
          'ubuntu': Monitor, 'debian': Server, 'centos': HardDrive,
          'windows': Monitor, 'kali': Shield, 'fedora': Server,
        };
        const colorOptions = [
          { color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-100 dark:bg-emerald-900/30', selectedBg: 'bg-emerald-600 text-white' },
          { color: 'text-rose-600 dark:text-rose-400', bg: 'bg-rose-100 dark:bg-rose-900/30', selectedBg: 'bg-rose-600 text-white' },
          { color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-100 dark:bg-amber-900/30', selectedBg: 'bg-amber-600 text-white' },
          { color: 'text-cyan-600 dark:text-cyan-400', bg: 'bg-cyan-100 dark:bg-cyan-900/30', selectedBg: 'bg-cyan-600 text-white' },
          { color: 'text-violet-600 dark:text-violet-400', bg: 'bg-violet-100 dark:bg-violet-900/30', selectedBg: 'bg-violet-600 text-white' },
        ];
        const mapped = data.templates.map((t: XCPNGTemplate, i: number) => {
          const nameLower = (t.name || '').toLowerCase();
          let icon: typeof Monitor = Monitor;
          for (const [key, ic] of Object.entries(iconMap)) {
            if (nameLower.includes(key)) { icon = ic; break; }
          }
          const style = colorOptions[i % colorOptions.length];
          return { ...t, icon, ...style };
        });
        setTemplates(mapped);
        setTemplatesFromXcpng(true);
        setTemplatesError(null);
        setRetryCount(0);
      } else {
        // No templates found - this is OK, we'll show empty state
        setTemplates([]);
        setTemplatesFromXcpng(false);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'XCP-ng connection failed';
      console.error('Failed to fetch XCP-ng templates:', errorMsg);
      setTemplatesError(errorMsg);
      setTemplates([]);
      setTemplatesFromXcpng(false);
      setRetryCount(attempt);
    } finally {
      setTemplatesLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (cancelled) return;
      await fetchTemplatesWithRetry(0);
    })();
    return () => { cancelled = true; };
  }, []);

const fetchTemplates = () => fetchTemplatesWithRetry(0);

  const formatRam = (bytes?: number) => {
    if (!bytes) return null;
    const mb = bytes / (1024 * 1024);
    if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
    return `${Math.round(mb)} MB`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!student) return;
    if (!templateName) { toast.error('Please select a template'); return; }
    if (!labId) { toast.error('Please select a lab'); return; }

    setLoading(true);
    setCreationStep('requesting');

    try {
      // Step 1: Submit VM request
      const res = await fetchWithTimeout('/api/vm-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentDbId: student.id,
          studentName: `${student.firstName} ${student.lastName}`,
          studentId: student.studentId,
          labId: parseInt(labId),
          templateUuid,
          templateName,
          accessProtocol: protocol,
        }),
      });
    const data = await res.json();
    if (!data.ok) {
      toast.error(data.error || 'Failed to submit request');
      setLoading(false);
      setCreationStep('idle');
      return;
    }

    // Student request submitted successfully - VM will be created when admin approves
    setCreationStep('done');
    toast.success('VM request submitted successfully! Awaiting admin approval.');

    // Refresh VM requests
    const vmReqRes = await fetch(`/api/vm-requests?studentDbId=${student.id}`);
    const vmReqData = await vmReqRes.json();
    setVmRequests(vmReqData.requests || []);

    setView('student-vms');
    } catch {
      toast.error('Connection error');
      setCreationStep('idle');
    }
    setLoading(false);
    setTimeout(() => setCreationStep('idle'), 500);
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <motion.div {...fadeSlide}>
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="sm" onClick={() => setView('student-vms')}>
            <ChevronLeft className="h-4 w-4" /> Back
          </Button>

        </div>

        <form onSubmit={handleSubmit}>
          <div className="space-y-6">
            <div>
              <Label className="text-sm font-medium mb-1.5 block">Select Lab</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                value={labId}
                onChange={(e) => setLabId(e.target.value)}
                required
              >
                <option value="" disabled>Select a lab...</option>
                {enrolledLabs.map(lab => (
                  <option key={lab.id} value={lab.id}>{lab.name}</option>
                ))}
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between mb-3">
                <Label className="text-sm font-medium">
                  Select a Template

                </Label>
                <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={fetchTemplates} disabled={templatesLoading}>
                  <RefreshCw className={`h-3 w-3 mr-1 ${templatesLoading ? 'animate-spin' : ''}`} /> Refresh
                </Button>
              </div>

              {/* Template Search/Filter */}
              {templates.length > 5 && (
                <div className="relative mb-3">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Search templates..."
                    value={templateSearch}
                    onChange={(e) => setTemplateSearch(e.target.value)}
                    className="pl-9 h-9 text-sm"
                  />
                </div>
              )}

              {templatesLoading ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {templates
                    .filter(tpl => {
                      if (!templateSearch.trim()) return true;
                      const q = templateSearch.toLowerCase();
                      return tpl.name.toLowerCase().includes(q) || (tpl.description || '').toLowerCase().includes(q);
                    })
                    .map((tpl) => {
                    const isSelected = templateUuid === tpl.uuid;
                    const isRecommended = !templatesFromXcpng && tpl.uuid === 'tpl-ubuntu-2204';
                    return (
                      <Card
                        key={tpl.uuid}
                        className={`cursor-pointer relative overflow-hidden border-2 ${
                          isSelected
                            ? 'border-transparent shadow-md'
                            : 'border-dashed border-muted-foreground/20 hover:border-muted-foreground/40'
                        }`}
                        onClick={() => { setTemplateName(tpl.name); setTemplateUuid(tpl.uuid); }}
                      >

                        <CardContent className="p-4 relative">
                          <div className="flex items-center gap-3">
                            <div className={`flex h-10 w-10 items-center justify-center rounded-lg transition-all duration-300 shrink-0 ${
                              isSelected ? tpl.selectedBg : tpl.bg
                            }`}>
                              <tpl.icon className={`h-5 w-5 transition-colors ${isSelected ? '' : tpl.color}`} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-sm truncate">{tpl.name}</span>
                                {isRecommended && (
                                  <span className="flex items-center gap-0.5 text-[10px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-800/50 shrink-0">
                                    <Star className="h-2.5 w-2.5 fill-amber-500 text-amber-500" /> Rec
                                  </span>
                                )}
                              </div>
                              {templatesFromXcpng && (
                                <div className="flex items-center gap-2 mt-0.5 text-[10px] text-muted-foreground">
                                  {tpl.VCPUsMax ? <span>{tpl.VCPUsMax} CPU{(tpl.VCPUsMax || 0) > 1 ? 's' : ''}</span> : null}
                                  {tpl.memoryStaticMax ? <span>{formatRam(tpl.memoryStaticMax)} RAM</span> : null}
                                  {tpl.description && <span className="truncate max-w-[120px]">{tpl.description}</span>}
                                </div>
                              )}
                            </div>
                            {isSelected && (
                              <div className="absolute top-2 right-2">
                                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-white animate-pulse">
                                  <Check className="h-3 w-3" />
                                </div>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
  {/* Error State */}
  {templatesError && !templatesLoading && (
    <div className="mt-4 p-3 rounded-lg border border-destructive/20 bg-destructive/5">
      <div className="flex items-start gap-2">
        <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-destructive">Failed to load templates</p>
          <p className="text-xs text-muted-foreground mt-0.5 break-words">{templatesError}</p>
          {retryCount > 0 && (
            <p className="text-xs text-muted-foreground mt-0.5">
              Retried {retryCount} time{retryCount > 1 ? 's' : ''}
            </p>
          )}
        </div>
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="mt-2 h-7 text-xs"
        onClick={() => fetchTemplatesWithRetry(0)}
        disabled={templatesLoading}
      >
        <RefreshCw className={`h-3 w-3 mr-1 ${templatesLoading ? 'animate-spin' : ''}`} />
        Retry
      </Button>
    </div>
  )}

  {/* Fallback/Empty State */}
  {!templatesFromXcpng && !templatesLoading && !templatesError && (
    <p className="text-xs text-muted-foreground mt-2">
      XCP-ng not configured. These are local templates. Contact your instructor for XCP-ng VM provisioning.
    </p>
  )}
</div>

        <div className="flex gap-3">
              <Button type="submit" disabled={loading || !templateName}>
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {creationStep === 'requesting' ? 'Requesting VM...' : creationStep === 'creating' ? 'Creating VM on XCP-ng...' : creationStep === 'done' ? 'Done!' : 'Submitting...'}
                  </>
                ) : (
                  <><Plus className="h-4 w-4 mr-2" /> Submit Request</>
                )}
              </Button>
              <Button type="button" variant="outline" onClick={() => setView('student-vms')}>Cancel</Button>
            </div>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
