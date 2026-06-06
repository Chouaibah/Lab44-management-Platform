'use client';

import { useState, useMemo } from 'react';
import { toast } from 'sonner';
import type { VmRequest } from './types';

type RefreshFn = (silent?: boolean) => Promise<void>;

export function useBatchActions(
  pending: VmRequest[],
  approved: VmRequest[],
  deletedVmIds: Set<number>,
  refreshData: RefreshFn,
) {
  // ── Pending batch ───────────────────────────────────────────────────────
  const [selectedIds, setSelectedIds]         = useState<Set<number>>(new Set());
  const [batchLoading, setBatchLoading]       = useState(false);
  const [batchRejectDialog, setBatchRejectDialog] = useState(false);
  const [batchRejectNote, setBatchRejectNote] = useState('');

  const pendingIds      = useMemo(() => new Set(pending.map(r => r.id)), [pending]);
  const allSelected     = pending.length > 0 && pending.every(r => selectedIds.has(r.id));
  const someSelected    = pending.some(r => selectedIds.has(r.id)) && !allSelected;
  const anyPendingSelected = pending.some(r => selectedIds.has(r.id));

  const toggleSelect = (id: number) =>
    setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const toggleSelectAll = () =>
    setSelectedIds(allSelected ? new Set() : new Set(pending.map(r => r.id)));

  const clearSelection = () => setSelectedIds(new Set());

  const handleBatchApprove = async () => {
    const ids = [...selectedIds].filter(id => pendingIds.has(id));
    if (!ids.length) return;
    setBatchLoading(true);
    try {
      const res  = await fetch('/api/vm-requests/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve', requestIds: ids }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`Batch approve: ${data.processed} approved${data.failed > 0 ? `, ${data.failed} failed` : ''}`);
        clearSelection();
        await refreshData(true);
      } else {
        toast.error(data.error || 'Batch approve failed');
      }
    } catch {
      toast.error('Failed to batch approve');
    } finally {
      setBatchLoading(false);
    }
  };

  const handleBatchReject = async () => {
    const ids = [...selectedIds].filter(id => pendingIds.has(id));
    if (!ids.length) return;
    setBatchLoading(true);
    try {
      const res  = await fetch('/api/vm-requests/batch', {
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
        await refreshData(true);
      } else {
        toast.error(data.error || 'Batch reject failed');
      }
    } catch {
      toast.error('Failed to batch reject');
    } finally {
      setBatchLoading(false);
    }
  };

  // ── Approved VMs batch ──────────────────────────────────────────────────
  const [approvedSelectedIds, setApprovedSelectedIds] = useState<Set<number>>(new Set());
  const [approvedBatchLoading, setApprovedBatchLoading] = useState(false);
  const [batchDeleteDialog, setBatchDeleteDialog]       = useState(false);

  const allApprovedSelected  = approved.length > 0 && approved.every(r => approvedSelectedIds.has(r.id));
  const someApprovedSelected = approved.some(r => approvedSelectedIds.has(r.id)) && !allApprovedSelected;
  const anyApprovedSelected  = approved.some(r => approvedSelectedIds.has(r.id));

  const toggleApprovedSelect = (id: number) =>
    setApprovedSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const toggleApprovedSelectAll = () =>
    setApprovedSelectedIds(
      allApprovedSelected
        ? new Set()
        : new Set(approved.filter(r => r.vmUuid && !deletedVmIds.has(r.id)).map(r => r.id)),
    );

  const clearApprovedSelection = () => setApprovedSelectedIds(new Set());

  const handleApprovedBatchAction = async (action: 'start' | 'stop' | 'reboot') => {
    const targets = approved.filter(r => approvedSelectedIds.has(r.id) && r.vmUuid);
    if (!targets.length) return;
    setApprovedBatchLoading(true);
    let success = 0, failed = 0;
    for (const req of targets) {
      try {
        const res = await fetch(`/api/xapi/vms/${req.vmUuid}/action`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action }),
        });
        res.ok ? success++ : failed++;
      } catch { failed++; }
    }
    toast.success(`Batch ${action}: ${success} successful${failed > 0 ? `, ${failed} failed` : ''}`);
    clearApprovedSelection();
    await refreshData(true);
    setApprovedBatchLoading(false);
  };

  const handleBatchDelete = async () => {
    const targets = approved.filter(r => approvedSelectedIds.has(r.id));
    if (!targets.length) return;
    setApprovedBatchLoading(true);
    let success = 0, failed = 0;
    for (const req of targets) {
      try {
        const res = await fetch(`/api/vm-requests/${req.id}/delete`, { method: 'DELETE' });
        res.ok ? success++ : failed++;
      } catch { failed++; }
    }
    toast.success(`Batch delete: ${success} deleted${failed > 0 ? `, ${failed} failed` : ''}`);
    setBatchDeleteDialog(false);
    clearApprovedSelection();
    await refreshData(true);
    setApprovedBatchLoading(false);
  };

  return {
    // pending
    selectedIds, toggleSelect, toggleSelectAll, clearSelection,
    allSelected, someSelected, anyPendingSelected,
    batchLoading, batchRejectDialog, setBatchRejectDialog, batchRejectNote, setBatchRejectNote,
    handleBatchApprove, handleBatchReject,
    // approved
    approvedSelectedIds, toggleApprovedSelect, toggleApprovedSelectAll, clearApprovedSelection,
    allApprovedSelected, someApprovedSelected, anyApprovedSelected,
    approvedBatchLoading, batchDeleteDialog, setBatchDeleteDialog,
    handleApprovedBatchAction, handleBatchDelete,
  };
}
