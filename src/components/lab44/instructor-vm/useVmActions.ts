'use client';

import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import type {
  VmRequest, ApproveDialogState, ApproveForm,
  RejectDialogState, DeleteDialogState,
  EMPTY_APPROVE_FORM,
} from './types';
import { EMPTY_APPROVE_FORM as EMPTY } from './types';

type RefreshFn = (silent?: boolean) => Promise<void>;

export function useVmActions(refreshData: RefreshFn) {
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});

  const isLoading = useCallback((key: string) => !!actionLoading[key], [actionLoading]);
  const startLoad = (key: string) => setActionLoading(p => ({ ...p, [key]: true }));
  const endLoad   = (key: string) => setActionLoading(p => ({ ...p, [key]: false }));

  // ── Approve dialog state ────────────────────────────────────────────────
  const [approveDialog, setApproveDialog] = useState<ApproveDialogState>({
    open: false, requestId: null, templateName: '',
  });
  const [approveForm, setApproveForm] = useState<ApproveForm>(EMPTY);

  const openApproveDialog = (req: Pick<VmRequest, 'id' | 'templateName' | 'accessProtocol'>) => {
    setApproveDialog({ open: true, requestId: req.id, templateName: req.templateName || '' });
    setApproveForm({ ...EMPTY, guacProtocol: req.accessProtocol || 'rdp' });
  };
  const closeApproveDialog = () => {
    setApproveDialog({ open: false, requestId: null, templateName: '' });
    setApproveForm(EMPTY);
  };

  const handleApprove = async () => {
    if (!approveDialog.requestId) return;
    const id  = approveDialog.requestId;
    const key = `approve-${id}`;
    startLoad(key);
    try {
      const res  = await fetch(`/api/vm-requests/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'approved',
          vmName: approveForm.vmName || approveDialog.templateName || null,
          accessProtocol: approveForm.guacProtocol,
          vmIp: approveForm.vmIp || null,
          note: approveForm.note || null,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`VM approved${data.xcpNgCreated ? ' and provisioned on XCP-ng' : ''}!`);
        closeApproveDialog();
        await refreshData(true);
      } else {
        toast.error(data.error || 'Failed to approve');
      }
    } catch {
      toast.error('Failed to approve VM request');
    } finally {
      endLoad(key);
    }
  };

  const handleQuickApprove = async (req: Pick<VmRequest, 'id' | 'templateName' | 'accessProtocol'>) => {
    const key = `approve-${req.id}`;
    startLoad(key);
    try {
      const res  = await fetch(`/api/vm-requests/${req.id}`, {
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
        await refreshData(true);
      } else {
        toast.error(data.error || 'Failed to approve');
      }
    } catch {
      toast.error('Failed to approve VM request');
    } finally {
      endLoad(key);
    }
  };

  // ── Reject dialog ───────────────────────────────────────────────────────
  const [rejectDialog, setRejectDialog] = useState<RejectDialogState>({
    open: false, requestId: null,
  });
  const [rejectNote, setRejectNote] = useState('');

  const openRejectDialog = (id: number) => {
    setRejectDialog({ open: true, requestId: id });
    setRejectNote('');
  };
  const closeRejectDialog = () => {
    setRejectDialog({ open: false, requestId: null });
    setRejectNote('');
  };

  const handleReject = async () => {
    if (!rejectDialog.requestId) return;
    const id  = rejectDialog.requestId;
    const key = `reject-${id}`;
    startLoad(key);
    try {
      const res = await fetch(`/api/vm-requests/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'rejected', note: rejectNote }),
      });
      if (res.ok) {
        toast.success('VM request rejected');
        closeRejectDialog();
        await refreshData(true);
      } else {
        toast.error('Failed to reject');
      }
    } catch {
      toast.error('Failed to reject VM request');
    } finally {
      endLoad(key);
    }
  };

  // ── Delete dialog ───────────────────────────────────────────────────────
  const [deleteDialog, setDeleteDialog] = useState<DeleteDialogState>({
    open: false, requestId: null, studentName: '', templateName: '',
  });

  const openDeleteDialog = (req: Pick<VmRequest, 'id' | 'studentName' | 'templateName'>) =>
    setDeleteDialog({ open: true, requestId: req.id, studentName: req.studentName, templateName: req.templateName || '' });

  const closeDeleteDialog = () =>
    setDeleteDialog({ open: false, requestId: null, studentName: '', templateName: '' });

  const handleDelete = async () => {
    if (!deleteDialog.requestId) return;
    const id  = deleteDialog.requestId;
    const key = `delete-${id}`;
    startLoad(key);
    try {
      const res = await fetch(`/api/vm-requests/${id}/delete`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('VM and all resources deleted');
        closeDeleteDialog();
        await refreshData(true);
      } else {
        toast.error('Failed to delete');
      }
    } catch {
      toast.error('Failed to delete VM request');
    } finally {
      endLoad(key);
    }
  };

  // ── VM power actions ────────────────────────────────────────────────────
  const handleVmAction = async (vmUuid: string, action: 'start' | 'stop' | 'reboot') => {
    const key = `${vmUuid}-${action}`;
    startLoad(key);
    try {
      const res  = await fetch(`/api/xapi/vms/${vmUuid}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message || `VM ${action} successful`);
        await refreshData(true);
      } else {
        toast.error(data.error || `Failed to ${action} VM`);
      }
    } catch {
      toast.error(`Failed to ${action} VM`);
    } finally {
      endLoad(key);
    }
  };

  return {
    isLoading,
    // approve
    approveDialog, approveForm, setApproveForm,
    openApproveDialog, closeApproveDialog, handleApprove,
    handleQuickApprove,
    // reject
    rejectDialog, rejectNote, setRejectNote,
    openRejectDialog, closeRejectDialog, handleReject,
    // delete
    deleteDialog,
    openDeleteDialog, closeDeleteDialog, handleDelete,
    // power
    handleVmAction,
  };
}
