'use client';

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import {
  Monitor, RefreshCw, Filter, Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { fadeSlide, BreadcrumbNav } from '@/lib/helpers';
import { useLab44Store } from '@/store/lab44';

import { ActiveVmsTable } from './instructor-vm/ActiveVmsTable';
import { PendingRequestsTable, RejectedTable } from './instructor-vm/RequestsTables';
import { PendingBatchBar, ApprovedBatchBar } from './instructor-vm/BatchActionBars';
import {
  ApproveDialog, RejectDialog, DeleteDialog,
  BatchDeleteDialog, BatchRejectDialog,
  VmDetailsDialog, ConsoleConnectDialog,
} from './instructor-vm/Dialogs';
import {
  Tooltip, TooltipTrigger, TooltipContent, TooltipProvider,
} from '@/components/ui/tooltip';
import { useVmActions } from './instructor-vm/useVmActions';
import { useBatchActions } from './instructor-vm/useBatchActions';
import { useVmDetails, useConsoleConnect, useDeletedVmSync } from './instructor-vm/useConsoleAndCreate';
import type { VmRequest, VmPowerState } from './instructor-vm/types';

const POLL_INTERVAL_MS = 30_000;
const POWER_BATCH_SIZE = 5;

export default function AdminVMMonitorView() {
  const { vmRequests, setVmRequests } = useLab44Store();

  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [vmPowerStates, setVmPowerStates] = useState<Record<string, VmPowerState>>({});

  const refreshData = useCallback(async (silent = false) => {
    setRefreshing(true);
    try {
      const res = await fetch('/api/vm-requests');
      const data = await res.json();
      const requests = data.requests || [];
      setVmRequests(requests);
      if (!silent) toast.success('Data refreshed');
    } catch {
      if (!silent) toast.error('Failed to refresh data');
    } finally {
      setRefreshing(false);
    }
  }, [setVmRequests]);

  useEffect(() => {
    if (vmRequests.length > 0) {
      setInitialLoading(false);
      return;
    }
    fetch('/api/vm-requests')
      .then(r => r.json())
      .then(data => setVmRequests(data.requests || []))
      .catch(() => toast.error('Failed to load VM requests'))
      .finally(() => setInitialLoading(false));
  }, [vmRequests.length, setVmRequests]);

  useEffect(() => {
    const poll = async () => {
      const targets = vmRequests.filter(r => r.status === 'approved' && r.vmUuid);
      if (targets.length === 0) return;
      for (let i = 0; i < targets.length; i += POWER_BATCH_SIZE) {
        const batch = targets.slice(i, i + POWER_BATCH_SIZE);
        const results = await Promise.allSettled(
          batch.map(async req => {
            if (!req.vmUuid) return null;
            const res = await fetch(`/api/xapi/vms/${req.vmUuid}/details`);
            if (!res.ok) return null;
            const d = await res.json();
            return { uuid: req.vmUuid, powerState: d.power_state || 'Unknown' };
          }),
        );
        setVmPowerStates(prev => {
          const next = { ...prev };
          const now = Date.now();
          for (const r of results) {
            if (r.status === 'fulfilled' && r.value) {
              next[r.value.uuid] = { powerState: r.value.powerState, lastChecked: now };
            }
          }
          return next;
        });
      }
    };
    poll();
    const id = setInterval(poll, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [vmRequests]);

  const approved = useMemo(() => vmRequests.filter(r => r.status === 'approved'), [vmRequests]);
  const pending = useMemo(() => vmRequests.filter(r => r.status === 'pending'), [vmRequests]);
  const rejected = useMemo(() => vmRequests.filter(r => r.status === 'rejected'), [vmRequests]);

  const {
    deletedVmIds, syncing, showDeleted, setShowDeleted,
    handleSyncVmStatus, handleClearDeleted,
  } = useDeletedVmSync(refreshData);

  const actions = useVmActions(refreshData);
  const batch = useBatchActions(pending, approved, deletedVmIds, refreshData);
  const details = useVmDetails();
  const console_ = useConsoleConnect();

  return (
    <TooltipProvider>
    <motion.div {...fadeSlide} className="mx-auto max-w-7xl px-4 py-6 sm:py-8">
      <BreadcrumbNav items={[
        { label: 'Admin', view: 'admin-panel' },
        { label: 'VM Monitor' },
      ]} />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <span className="text-primary font-semibold">VM Monitor</span>
          </h1>
          <p className="text-sm text-muted-foreground">
            Manage virtual machines across all labs
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => refreshData()} disabled={refreshing} className="gap-1">
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} /> Refresh
          </Button>
          {deletedVmIds.size > 0 && (
            <>
              <Button variant="destructive" size="sm" onClick={handleClearDeleted} disabled={syncing} className="gap-1">
                <Trash2 className="h-3.5 w-3.5" /> Clear Deleted ({deletedVmIds.size})
              </Button>
              <Button variant="outline" size="sm" onClick={() => setShowDeleted(v => !v)} className="gap-1">
                <Filter className="h-3.5 w-3.5" /> {showDeleted ? 'Hide' : 'Show'} Deleted
              </Button>
            </>
          )}
        </div>
      </div>

      {initialLoading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <Card key={i} className="shadow-sm">
                <CardContent className="p-4">
                  <div className="h-16 animate-pulse bg-muted rounded" />
                </CardContent>
              </Card>
            ))}
          </div>
          <Card className="shadow-sm">
            <CardContent className="p-6">
              <div className="h-64 animate-pulse bg-muted rounded" />
            </CardContent>
          </Card>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            <div className="rounded-lg border bg-card p-4">
              <p className="text-2xl font-semibold">{approved.length - deletedVmIds.size}</p>
              <p className="text-xs text-muted-foreground mt-1">Active VMs</p>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <p className="text-2xl font-semibold">{pending.length}</p>
              <p className="text-xs text-muted-foreground mt-1">Pending</p>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <p className="text-2xl font-semibold">{rejected.length}</p>
              <p className="text-xs text-muted-foreground mt-1">Rejected</p>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <p className="text-2xl font-semibold">{vmRequests.length}</p>
              <p className="text-xs text-muted-foreground mt-1">Total</p>
            </div>
          </div>

          <ActiveVmsTable
            approved={approved}
            deletedVmIds={deletedVmIds}
            showDeleted={showDeleted}
            vmPowerStates={vmPowerStates}
            approvedSelectedIds={batch.approvedSelectedIds}
            allApprovedSelected={batch.allApprovedSelected}
            someApprovedSelected={batch.someApprovedSelected}
            onToggleSelect={batch.toggleApprovedSelect}
            onToggleSelectAll={batch.toggleApprovedSelectAll}
            isLoading={actions.isLoading}
            onVmAction={actions.handleVmAction}
            onViewDetails={details.loadVmDetails}
            onOpenConsole={console_.openConsoleDialog}
            onDeleteRequest={actions.openDeleteDialog}
            onConvertToTemplate={() => {}}
            convertLoading={null}
          />

          {batch.anyApprovedSelected && (
            <ApprovedBatchBar
              count={batch.approvedSelectedIds.size}
              loading={batch.approvedBatchLoading}
              onAction={batch.handleApprovedBatchAction}
              onDeleteOpen={() => batch.setBatchDeleteDialog(true)}
              onCancel={batch.clearApprovedSelection}
            />
          )}

          <PendingRequestsTable
            pending={pending}
            selectedIds={batch.selectedIds}
            allSelected={batch.allSelected}
            someSelected={batch.someSelected}
            isLoading={actions.isLoading}
            onToggleSelect={batch.toggleSelect}
            onToggleSelectAll={batch.toggleSelectAll}
            onQuickApprove={actions.handleQuickApprove}
            onAdvancedApprove={actions.openApproveDialog}
            onReject={actions.openRejectDialog}
          />

          {batch.anyPendingSelected && (
            <PendingBatchBar
              count={batch.selectedIds.size}
              loading={batch.batchLoading}
              onApprove={batch.handleBatchApprove}
              onRejectOpen={() => batch.setBatchRejectDialog(true)}
              onCancel={batch.clearSelection}
            />
          )}

          <RejectedTable rejected={rejected} />

          {!pending.length && !approved.length && !rejected.length && (
            <Card className="shadow-sm">
              <CardContent className="py-12">
                <div className="flex flex-col items-center justify-center text-center">
                  <Monitor className="h-10 w-10 text-muted-foreground/40 mb-3" />
                  <p className="text-sm text-muted-foreground">No VM requests yet</p>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      <ApproveDialog
        state={actions.approveDialog}
        form={actions.approveForm}
        isLoading={actions.isLoading(`approve-${actions.approveDialog.requestId}`)}
        onChange={patch => actions.setApproveForm(f => ({ ...f, ...patch }))}
        onClose={actions.closeApproveDialog}
        onConfirm={actions.handleApprove}
      />

      <RejectDialog
        state={actions.rejectDialog}
        note={actions.rejectNote}
        isLoading={actions.isLoading(`reject-${actions.rejectDialog.requestId}`)}
        onNoteChange={actions.setRejectNote}
        onClose={actions.closeRejectDialog}
        onConfirm={actions.handleReject}
      />

      <DeleteDialog
        state={actions.deleteDialog}
        isLoading={actions.isLoading(`delete-${actions.deleteDialog.requestId}`)}
        onClose={actions.closeDeleteDialog}
        onConfirm={actions.handleDelete}
      />

      <BatchDeleteDialog
        open={batch.batchDeleteDialog}
        count={batch.approvedSelectedIds.size}
        loading={batch.approvedBatchLoading}
        onClose={() => batch.setBatchDeleteDialog(false)}
        onConfirm={batch.handleBatchDelete}
      />

      <BatchRejectDialog
        open={batch.batchRejectDialog}
        count={batch.selectedIds.size}
        note={batch.batchRejectNote}
        loading={batch.batchLoading}
        onNoteChange={batch.setBatchRejectNote}
        onClose={() => { batch.setBatchRejectDialog(false); batch.setBatchRejectNote(''); }}
        onConfirm={batch.handleBatchReject}
      />

      <VmDetailsDialog
        open={details.detailsDialog}
        loading={details.loadingDetails}
        details={details.selectedVmDetails}
        onClose={() => details.setDetailsDialog(false)}
      />

      <ConsoleConnectDialog
        state={console_.consoleDialog}
        protocol={console_.consoleProtocol}
        user={console_.consoleUser}
        pass={console_.consolePass}
        connecting={console_.consoleConnecting}
        onSwitchProtocol={console_.switchProtocol}
        onUserChange={console_.setConsoleUser}
        onPassChange={console_.setConsolePass}
        onClose={console_.closeConsoleDialog}
        onConnect={console_.handleConnectConsole}
      />
    </motion.div>
    </TooltipProvider>
  );
}
