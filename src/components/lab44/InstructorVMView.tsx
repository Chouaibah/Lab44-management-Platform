'use client';

import React, { useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Monitor, CheckCircle2, Clock, XCircle, HardDrive,
  RefreshCw, Plus, Filter, Trash2, Unplug,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { fadeSlide, BreadcrumbNav, StatCard } from '@/lib/helpers';
import { useLab44Store } from '@/store/lab44';

// Sub-components
import { ActiveVmsTable }                    from './instructor-vm/ActiveVmsTable';
import { PendingRequestsTable, RejectedTable } from './instructor-vm/RequestsTables';
import { PendingBatchBar, ApprovedBatchBar }  from './instructor-vm/BatchActionBars';
import {
  ApproveDialog, RejectDialog, DeleteDialog,
  BatchDeleteDialog, BatchRejectDialog,
  VmDetailsDialog, ConsoleConnectDialog, CreateVmDialog,
} from './instructor-vm/Dialogs';
import {
  Tooltip, TooltipTrigger, TooltipContent, TooltipProvider,
} from '@/components/ui/tooltip';

// Hooks
import { useVmRequests }    from './instructor-vm/useVmRequests';
import { useVmActions }     from './instructor-vm/useVmActions';
import { useBatchActions }  from './instructor-vm/useBatchActions';
import {
  useVmDetails, useConsoleConnect,
  useCreateVm, useAutoApprove, useDeletedVmSync,
} from './instructor-vm/useConsoleAndCreate';

export default function InstructorVMView() {
  const { auth, selectedLabId, labs } = useLab44Store();
  const instructor  = auth.instructor;
  const activeLabId = selectedLabId || instructor?.labId || 0;

  // ── Data ────────────────────────────────────────────────────────────────
  const {
    vmRequests, vmPowerStates,
    initialLoading, refreshing, refreshData,
  } = useVmRequests(activeLabId);

  const approved = useMemo(() => vmRequests.filter(r => r.status === 'approved'), [vmRequests]);
  const pending  = useMemo(() => vmRequests.filter(r => r.status === 'pending'),  [vmRequests]);
  const rejected = useMemo(() => vmRequests.filter(r => r.status === 'rejected'), [vmRequests]);

  // ── Actions / dialogs ────────────────────────────────────────────────────
  const {
    deletedVmIds, syncing, showDeleted, setShowDeleted,
    handleSyncVmStatus, handleClearDeleted,
  } = useDeletedVmSync(refreshData);

  const actions = useVmActions(refreshData);
  const batch   = useBatchActions(pending, approved, deletedVmIds, refreshData);
  const details = useVmDetails();
  const console_ = useConsoleConnect();
  const createVm = useCreateVm(activeLabId, refreshData);
  const { autoApprove, loadingAutoApprove, initAutoApprove, handleAutoApproveToggle } = useAutoApprove(activeLabId);

  useEffect(() => { initAutoApprove(); }, [initAutoApprove]);

  if (!instructor) return null;

  const labName = labs.find(l => l.id === activeLabId)?.name || instructor.labName || 'Lab';

  return (
    <TooltipProvider>
    <motion.div {...fadeSlide} className="mx-auto max-w-7xl px-4 py-6 sm:py-8">
      <BreadcrumbNav items={[
        { label: 'Instructor', view: 'instructor-panel' },
        { label: 'VM Monitor' },
      ]} />

      {/* ── Page header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Monitor className="h-6 w-6 text-rose-500" />
            <span className="text-primary font-semibold">VM Monitor</span>
          </h1>
          <p className="text-sm text-muted-foreground">
            Manage virtual machines for your students
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => refreshData()} disabled={refreshing} className="gap-1">
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} /> Refresh
          </Button>



          <Button size="sm" onClick={createVm.openCreateVmDialog} className="gap-1 bg-rose-600 hover:bg-rose-700">
            <Plus className="h-3.5 w-3.5" /> Create VM
          </Button>

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border bg-muted/30">
            <Label htmlFor="auto-approve" className="text-xs font-medium text-muted-foreground whitespace-nowrap cursor-pointer">
              Auto-Approve
            </Label>
            <Switch
              id="auto-approve"
              checked={autoApprove}
              onCheckedChange={handleAutoApproveToggle}
              disabled={loadingAutoApprove}
              className="data-[state=checked]:bg-emerald-500"
            />
          </div>

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

      {/* ── Loading skeleton ── */}
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
          {/* ── Stat cards ── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            <StatCard label="Active VMs"      value={String(approved.length - deletedVmIds.size)} statusColor="bg-emerald-500" icon={<CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />} iconBg="bg-emerald-100 dark:bg-emerald-900/30" />
            <StatCard label="Pending"         value={String(pending.length)}                       statusColor="bg-amber-500"   icon={<Clock       className="h-4 w-4 text-amber-600 dark:text-amber-400"   />} iconBg="bg-amber-100 dark:bg-amber-900/30"   />
            <StatCard label="Rejected"        value={String(rejected.length)}                      statusColor="bg-red-500"     icon={<XCircle     className="h-4 w-4 text-red-600 dark:text-red-400"       />} iconBg="bg-red-100 dark:bg-red-900/30"       />
            <StatCard label="Total Requests"  value={String(vmRequests.length)}                    statusColor="bg-violet-500"  icon={<HardDrive   className="h-4 w-4 text-violet-600 dark:text-violet-400" />} iconBg="bg-violet-100 dark:bg-violet-900/30" />
          </div>

          {/* ── Active VMs table ── */}
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
          />

          {/* ── Approved batch action bar ── */}
          {batch.anyApprovedSelected && (
            <ApprovedBatchBar
              count={batch.approvedSelectedIds.size}
              loading={batch.approvedBatchLoading}
              onAction={batch.handleApprovedBatchAction}
              onDeleteOpen={() => batch.setBatchDeleteDialog(true)}
              onCancel={batch.clearApprovedSelection}
            />
          )}

          {/* ── Pending requests table ── */}
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

          {/* ── Pending batch action bar ── */}
          {batch.anyPendingSelected && (
            <PendingBatchBar
              count={batch.selectedIds.size}
              loading={batch.batchLoading}
              onApprove={batch.handleBatchApprove}
              onRejectOpen={() => batch.setBatchRejectDialog(true)}
              onCancel={batch.clearSelection}
            />
          )}

          {/* ── Rejected table ── */}
          <RejectedTable rejected={rejected} />

          {/* ── Empty state ── */}
          {!pending.length && !approved.length && !rejected.length && (
            <Card className="shadow-sm">
              <CardContent className="py-12">
                <div className="flex flex-col items-center justify-center text-center">
                  <Monitor className="h-10 w-10 text-muted-foreground/40 mb-3" />
                  <p className="text-sm text-muted-foreground">No VM requests from your students yet</p>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* ══════════════════════════════════════════
          DIALOGS
          ══════════════════════════════════════════ */}

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

      <CreateVmDialog
        open={createVm.createVmDialog}
        templates={createVm.templates}
        templatesLoading={createVm.templatesLoading}
        selectedTemplate={createVm.selectedTemplate}
        submitting={createVm.submitting}
        onSelectTemplate={createVm.setSelectedTemplate}
        onClose={() => createVm.setCreateVmDialog(false)}
        onConfirm={createVm.handleCreateVm}
      />
    </motion.div>
    </TooltipProvider>
  );
}
