'use client';

import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import type { ConsoleDialogState, VmDetails, VmTemplate } from './types';
import { EMPTY_CONSOLE_DIALOG } from './types';

type RefreshFn = (silent?: boolean) => Promise<void>;

// ─── VM Details ───────────────────────────────────────────────────────────────

export function useVmDetails() {
  const [detailsDialog, setDetailsDialog]       = useState(false);
  const [loadingDetails, setLoadingDetails]     = useState(false);
  const [selectedVmDetails, setSelectedVmDetails] = useState<VmDetails | null>(null);

  const loadVmDetails = useCallback(async (vmUuid: string) => {
    setDetailsDialog(true);
    setLoadingDetails(true);
    setSelectedVmDetails(null);
    try {
      const res = await fetch(`/api/xapi/vms/${vmUuid}/details`);
      if (res.ok) {
        setSelectedVmDetails(await res.json());
      } else {
        toast.error('Failed to load VM details');
      }
    } catch {
      toast.error('Failed to load VM details');
    } finally {
      setLoadingDetails(false);
    }
  }, []);

  return { detailsDialog, setDetailsDialog, loadingDetails, selectedVmDetails, loadVmDetails };
}

// ─── Console Connect ──────────────────────────────────────────────────────────

export function useConsoleConnect() {
  const [consoleDialog, setConsoleDialog] = useState<ConsoleDialogState>(EMPTY_CONSOLE_DIALOG);
  const [consoleProtocol, setConsoleProtocol] = useState<'rdp' | 'ssh'>('rdp');
  const [consoleUser, setConsoleUser]         = useState('');
  const [consolePass, setConsolePass]         = useState('');
  const [consoleConnecting, setConsoleConnecting] = useState(false);

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

  const closeConsoleDialog = () => setConsoleDialog(EMPTY_CONSOLE_DIALOG);

  const switchProtocol = (proto: 'rdp' | 'ssh') => {
    setConsoleProtocol(proto);
    setConsoleUser(proto === 'ssh' ? 'xen' : 'lab');
    setConsolePass('000000');
  };

  const handleConnectConsole = async () => {
    if (!consoleDialog.requestId) return;
    setConsoleConnecting(true);
    try {
      const params = new URLSearchParams({ protocol: consoleProtocol });
      if (consoleUser) params.set('vmUser', consoleUser);
      if (consolePass) params.set('vmPass', consolePass);

      const res  = await fetch(`/api/guacamole/connect/${consoleDialog.requestId}?${params}`);
      const data = await res.json();

      if (res.ok && data.identifier && data.authToken) {
        const connectionStr = `${data.identifier}\0c\0${data.dataSource}`;
        const clientId      = btoa(connectionStr).replace(/=+$/, '');
        let baseUrl         = (data.url || '').replace(/[\/#]+$/, '');
        if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
          baseUrl = `http://${baseUrl}`;
        }
        window.open(`${baseUrl}/#/client/${clientId}?token=${data.authToken}`, '_blank', 'noopener,noreferrer');
        closeConsoleDialog();
        toast.success('Opening console...');
      } else {
        toast.error(data.error || 'Failed to open console');
      }
    } catch {
      toast.error('Failed to open console');
    } finally {
      setConsoleConnecting(false);
    }
  };

  return {
    consoleDialog, consoleProtocol, consoleUser, consolePass, consoleConnecting,
    openConsoleDialog, closeConsoleDialog, switchProtocol,
    setConsoleUser, setConsolePass, handleConnectConsole,
  };
}

// ─── Create VM ────────────────────────────────────────────────────────────────

export function useCreateVm(activeLabId: number, refreshData: RefreshFn) {
  const [createVmDialog, setCreateVmDialog]       = useState(false);
  const [templates, setTemplates]                 = useState<VmTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading]   = useState(false);
  const [selectedTemplate, setSelectedTemplate]   = useState<VmTemplate | null>(null);
  const [submitting, setSubmitting]               = useState(false);

  const openCreateVmDialog = useCallback(async () => {
    setCreateVmDialog(true);
    setSelectedTemplate(null);
    setTemplatesLoading(true);
    try {
      const res  = await fetch('/api/xcp-ng/templates');
      const data = await res.json();
      if (res.ok && Array.isArray(data.templates)) setTemplates(data.templates);
    } catch {
      toast.error('Failed to load templates');
    } finally {
      setTemplatesLoading(false);
    }
  }, []);

  const handleCreateVm = async () => {
    if (!selectedTemplate || !activeLabId) return;
    setSubmitting(true);
    try {
      const res  = await fetch('/api/vm-requests/instructor-create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateUuid: selectedTemplate.uuid,
          templateName: selectedTemplate.name,
          labId: activeLabId,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`VM "${data.vmName || selectedTemplate.name}" created!`);
        setCreateVmDialog(false);
        await refreshData(true);
      } else {
        toast.error(data.error || 'Failed to create VM');
      }
    } catch {
      toast.error('Failed to create VM');
    } finally {
      setSubmitting(false);
    }
  };

  return {
    createVmDialog, setCreateVmDialog,
    templates, templatesLoading,
    selectedTemplate, setSelectedTemplate,
    submitting, openCreateVmDialog, handleCreateVm,
  };
}

// ─── Auto-Approve toggle ──────────────────────────────────────────────────────

export function useAutoApprove(activeLabId: number) {
  const [autoApprove, setAutoApprove]         = useState(false);
  const [loadingAutoApprove, setLoading]      = useState(false);

  // Load setting on mount via the parent component (passed separately to avoid double fetch)
  const initAutoApprove = useCallback(async () => {
    if (!activeLabId) return;
    try {
      const res = await fetch(`/api/labs/${activeLabId}`);
      if (res.ok) {
        const data = await res.json();
        setAutoApprove(!!data.autoApprove);
      }
    } catch { /* silently ignore */ }
  }, [activeLabId]);

  const handleAutoApproveToggle = async (checked: boolean) => {
    if (!activeLabId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/labs/${activeLabId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ autoApprove: checked }),
      });
      if (res.ok) {
        setAutoApprove(checked);
        toast.success(`Auto-approve ${checked ? 'enabled' : 'disabled'}`);
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to update auto-approve setting');
      }
    } catch {
      toast.error('Failed to update auto-approve setting');
    } finally {
      setLoading(false);
    }
  };

  return { autoApprove, loadingAutoApprove, initAutoApprove, handleAutoApproveToggle };
}

// ─── Deleted VM sync ──────────────────────────────────────────────────────────

export function useDeletedVmSync(refreshData: RefreshFn) {
  const [deletedVmIds, setDeletedVmIds] = useState<Set<number>>(new Set());
  const [syncing, setSyncing]           = useState(false);
  const [showDeleted, setShowDeleted]   = useState(true);

  const handleSyncVmStatus = async (approved: { id: number; vmUuid: string | null }[]) => {
    const targets = approved.filter(r => r.vmUuid);
    if (!targets.length) { toast.info('No approved VMs with UUID to check'); return; }
    setSyncing(true);
    const newDeleted = new Set<number>();
    try {
      for (const req of targets) {
        if (!req.vmUuid) continue;
        try {
          const res = await fetch(`/api/xapi/vms/${req.vmUuid}/details`);
          if (res.status === 404) {
            newDeleted.add(req.id);
          } else if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            const err  = (data.error || '').toLowerCase();
            if (err.includes('not found') || err.includes('does not exist')) {
              newDeleted.add(req.id);
            }
          }
        } catch { /* network error — don't assume deleted */ }
      }
      setDeletedVmIds(newDeleted);
      if (!newDeleted.size) {
        toast.success('All VMs are still active on XCP-ng');
      } else {
        toast.warning(`${newDeleted.size} VM${newDeleted.size !== 1 ? 's' : ''} no longer exist on XCP-ng host`);
      }
    } catch {
      toast.error('Failed to sync VM status');
    } finally {
      setSyncing(false);
    }
  };

  const handleClearDeleted = async () => {
    if (!deletedVmIds.size) { toast.info('No deleted VMs to clear'); return; }
    setSyncing(true);
    let cleared = 0;
    for (const id of deletedVmIds) {
      try {
        const res = await fetch(`/api/vm-requests/${id}`, { method: 'DELETE' });
        if (res.ok) cleared++;
      } catch { /* ignore */ }
    }
    toast.success(`Cleared ${cleared} deleted VM request${cleared !== 1 ? 's' : ''}`);
    setDeletedVmIds(new Set());
    await refreshData(true);
    setSyncing(false);
  };

  return {
    deletedVmIds, syncing, showDeleted, setShowDeleted,
    handleSyncVmStatus, handleClearDeleted,
  };
}
