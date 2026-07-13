'use client';

import React from 'react';
import {
  CheckCircle2, XCircle, Trash2, AlertTriangle,
  Loader2, Check, X, Info, Cpu, MemoryStick, Globe,
  Monitor, Terminal, Server, Plus, Play, Square, RotateCcw,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import type {
  ApproveDialogState, ApproveForm,
  RejectDialogState, DeleteDialogState,
  ConsoleDialogState, VmDetails, VmTemplate,
} from './types';
import { formatMemory } from './types';

// ─── Approve Dialog ───────────────────────────────────────────────────────────

interface ApproveDialogProps {
  state: ApproveDialogState;
  form: ApproveForm;
  isLoading: boolean;
  onChange: (patch: Partial<ApproveForm>) => void;
  onClose: () => void;
  onConfirm: () => void;
}

export function ApproveDialog({ state, form, isLoading, onChange, onClose, onConfirm }: ApproveDialogProps) {
  return (
    <Dialog open={state.open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-500" /> Advanced Approve
          </DialogTitle>
          <DialogDescription>Configure the VM before approving. Leave fields blank for defaults.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="vmName">VM Name</Label>
            <Input
              id="vmName"
              placeholder={state.templateName || 'Auto-generated from template'}
              value={form.vmName}
              onChange={e => onChange({ vmName: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">Defaults to template name if blank</p>
          </div>

          <div className="space-y-2">
            <Label>Access Protocol</Label>
            <div className="flex gap-3">
              {(['rdp', 'ssh', 'vnc'] as const).map(p => (
                <label key={p} className="flex items-center gap-2 cursor-pointer text-sm">
                  <input
                    type="radio" name="protocol" value={p}
                    checked={form.guacProtocol === p}
                    onChange={() => onChange({ guacProtocol: p })}
                    className="accent-emerald-500"
                  />
                  <span className="uppercase font-mono font-medium">{p}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="vmIp">IP Address</Label>
              <Input id="vmIp" placeholder="192.168.1.100" value={form.vmIp} onChange={e => onChange({ vmIp: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="vmUser">Username</Label>
              <Input id="vmUser" placeholder="admin" value={form.vmUser} onChange={e => onChange({ vmUser: e.target.value })} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="vmPass">Password</Label>
            <Input id="vmPass" type="password" placeholder="••••••••" value={form.vmPass} onChange={e => onChange({ vmPass: e.target.value })} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="approveNote">Note (optional)</Label>
            <Textarea id="approveNote" placeholder="Add a note for the student…" value={form.note} onChange={e => onChange({ note: e.target.value })} rows={2} />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={isLoading} onClick={onConfirm}>
            {isLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Check className="h-4 w-4 mr-2" />}
            Approve &amp; Provision
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Reject Dialog ────────────────────────────────────────────────────────────

interface RejectDialogProps {
  state: RejectDialogState;
  note: string;
  isLoading: boolean;
  onNoteChange: (v: string) => void;
  onClose: () => void;
  onConfirm: () => void;
}

export function RejectDialog({ state, note, isLoading, onNoteChange, onClose, onConfirm }: RejectDialogProps) {
  return (
    <Dialog open={state.open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <XCircle className="h-5 w-5 text-red-500" /> Reject VM Request
          </DialogTitle>
          <DialogDescription>Provide a reason visible to the student.</DialogDescription>
        </DialogHeader>
        <div className="py-2">
          <Textarea placeholder="e.g., insufficient resources, policy violation…" value={note} onChange={e => onNoteChange(e.target.value)} rows={3} />
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="destructive" disabled={isLoading} onClick={onConfirm}>
            {isLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <X className="h-4 w-4 mr-2" />}
            Reject Request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Delete Dialog ────────────────────────────────────────────────────────────

interface DeleteDialogProps {
  state: DeleteDialogState;
  isLoading: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

function DangerBanner({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
      <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5 shrink-0" />
      <div className="text-sm text-red-600 dark:text-red-400/80">{children}</div>
    </div>
  );
}

export function DeleteDialog({ state, isLoading, onClose, onConfirm }: DeleteDialogProps) {
  return (
    <Dialog open={state.open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-500" /> Delete VM
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <DangerBanner>
            <p className="font-medium text-red-700 dark:text-red-400">This action cannot be undone!</p>
            <p className="mt-1">The VM will be <strong>destroyed on XCP-ng</strong> and all Guacamole resources permanently removed.</p>
          </DangerBanner>
          <div className="text-sm space-y-1">
            <p><span className="text-muted-foreground">Student:</span> <strong>{state.studentName}</strong></p>
            <p><span className="text-muted-foreground">Template:</span> <strong>{state.templateName}</strong></p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="destructive" disabled={isLoading} onClick={onConfirm}>
            {isLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Trash2 className="h-4 w-4 mr-2" />}
            Delete VM &amp; Resources
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Batch Delete Dialog ──────────────────────────────────────────────────────

interface BatchDeleteDialogProps {
  open: boolean;
  count: number;
  loading: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function BatchDeleteDialog({ open, count, loading, onClose, onConfirm }: BatchDeleteDialogProps) {
  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-500" /> Batch Delete VMs
          </DialogTitle>
        </DialogHeader>
        <div className="py-2">
          <DangerBanner>
            <p className="font-medium text-red-700 dark:text-red-400">This action cannot be undone!</p>
            <p className="mt-1"><strong>{count} VM{count !== 1 ? 's' : ''}</strong> will be destroyed on XCP-ng and all Guacamole resources permanently removed.</p>
          </DangerBanner>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="destructive" disabled={loading} onClick={onConfirm}>
            {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Trash2 className="h-4 w-4 mr-2" />}
            Delete {count} VM{count !== 1 ? 's' : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Batch Reject Dialog ──────────────────────────────────────────────────────

interface BatchRejectDialogProps {
  open: boolean;
  count: number;
  note: string;
  loading: boolean;
  onNoteChange: (v: string) => void;
  onClose: () => void;
  onConfirm: () => void;
}

export function BatchRejectDialog({ open, count, note, loading, onNoteChange, onClose, onConfirm }: BatchRejectDialogProps) {
  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <XCircle className="h-5 w-5 text-red-500" /> Batch Reject ({count} requests)
          </DialogTitle>
          <DialogDescription>Optional reason visible to all students.</DialogDescription>
        </DialogHeader>
        <div className="py-2">
          <Textarea placeholder="e.g., insufficient resources…" value={note} onChange={e => onNoteChange(e.target.value)} rows={3} />
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="destructive" disabled={loading} onClick={onConfirm}>
            {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <X className="h-4 w-4 mr-2" />}
            Reject {count} Requests
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── VM Details Dialog ────────────────────────────────────────────────────────

interface VmDetailsDialogProps {
  open: boolean;
  loading: boolean;
  details: VmDetails | null;
  onClose: () => void;
}

export function VmDetailsDialog({ open, loading, details, onClose }: VmDetailsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Info className="h-5 w-5 text-violet-500" /> VM Details
          </DialogTitle>
          <DialogDescription>Resource information from XCP-ng</DialogDescription>
        </DialogHeader>
        <div className="py-2">
          {loading ? (
            <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" /> Loading…
            </div>
          ) : details ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div>
                  <p className="font-semibold text-sm">{details.name_label || details.name || 'Unknown VM'}</p>
                  <p className="text-xs text-muted-foreground font-mono mt-0.5">{details.uuid || ''}</p>
                </div>
                <Badge className={details.power_state === 'Running'
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                  : 'bg-gray-500/10 text-gray-600 dark:text-gray-400 border-gray-500/20'
                }>
                  <span className={`inline-block h-1.5 w-1.5 rounded-full mr-1.5 ${details.power_state === 'Running' ? 'bg-emerald-500' : 'bg-gray-500'}`} />
                  {details.power_state || 'Unknown'}
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {([
                  { icon: Cpu, label: 'vCPUs', value: String(details.vCPUs_live ?? details.vCPUs_max ?? details.VCPUs_at_startup ?? details.vcpus ?? '—'), color: 'blue' },
                  { icon: MemoryStick, label: 'Memory', value: formatMemory(details.memory_actual ?? details.memory_dynamic_max ?? details.memory_static_max ?? details.memory), color: 'violet' },
                ] as { icon: React.ComponentType<{ className?: string }>; label: string; value: string; color: string }[]).map(({ icon: Icon, label, value, color }) => (
                  <div key={label} className="flex items-center gap-2.5 p-3 rounded-lg bg-muted/30">
                    <div className={`flex h-8 w-8 items-center justify-center rounded-md bg-${color}-100 dark:bg-${color}-900/30`}>
                      <Icon className={`h-4 w-4 text-${color}-600 dark:text-${color}-400`} />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">{label}</p>
                      <p className="font-semibold text-sm">{value}</p>
                    </div>
                  </div>
                ))}
              </div>

              {!!(details.ip || details.networks) && (
                <div className="p-3 rounded-lg bg-muted/30">
                  <div className="flex items-center gap-2 mb-2">
                    <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                    <p className="text-xs font-medium text-muted-foreground">Network</p>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono">IP Address</span>
                    <span className={`font-mono ${details.ip && details.ip !== '127.0.0.1' ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}`}>
                      {details.ip && details.ip !== '127.0.0.1' ? details.ip : 'No IP detected'}
                    </span>
                  </div>
                  {details.osVersion?.name && (
                    <div className="flex items-center justify-between text-xs mt-1">
                      <span className="text-muted-foreground">OS</span>
                      <span className="font-medium">{details.osVersion.name}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <Info className="h-8 w-8 mb-2" />
              <p className="text-sm">No details available</p>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Console Connect Dialog ───────────────────────────────────────────────────

interface ConsoleDialogProps {
  state: ConsoleDialogState;
  protocol: 'rdp' | 'ssh';
  user: string;
  pass: string;
  connecting: boolean;
  onSwitchProtocol: (p: 'rdp' | 'ssh') => void;
  onUserChange: (v: string) => void;
  onPassChange: (v: string) => void;
  onClose: () => void;
  onConnect: () => void;
}

export function ConsoleConnectDialog({
  state, protocol, user, pass, connecting,
  onSwitchProtocol, onUserChange, onPassChange, onClose, onConnect,
}: ConsoleDialogProps) {
  return (
    <Dialog open={state.open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="sm:max-w-2xl w-full">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Terminal className="h-5 w-5 text-cyan-600 shrink-0" /> Console Access
          </DialogTitle>
          <DialogDescription>{state.vmName} · {state.studentName}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/40">
            <Monitor className="h-8 w-8 text-muted-foreground shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm">{state.vmName}</p>
              <p className="text-xs text-muted-foreground font-mono">IP: {state.vmIp}</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground">PROTOCOL</Label>
            <div className="grid grid-cols-2 gap-3">
              {(['rdp', 'ssh'] as const).map(p => (
                <button
                  key={p}
                  type="button"
                  className={`flex items-center justify-center gap-2 rounded-lg border-2 px-4 py-2.5 text-sm font-medium transition-all ${
                    protocol === p
                      ? 'border-cyan-500 bg-cyan-50 text-cyan-700 dark:bg-cyan-900/20 dark:text-cyan-300'
                      : 'border-muted bg-background text-muted-foreground hover:border-muted-foreground/30'
                  }`}
                  onClick={() => onSwitchProtocol(p)}
                >
                  {p === 'rdp' ? <Monitor className="h-4 w-4 shrink-0" /> : <Terminal className="h-4 w-4 shrink-0" />}
                  {p.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <Label className="text-xs font-medium text-muted-foreground">VM CREDENTIALS</Label>
            {[
              { label: 'Username', value: user, onChange: onUserChange, type: 'text', placeholder: protocol === 'ssh' ? 'xen' : 'lab' },
              { label: 'Password', value: pass, onChange: onPassChange, type: 'password', placeholder: '000000' },
            ].map(field => (
              <div key={field.label} className="flex items-center gap-3">
                <Label className="text-xs text-muted-foreground w-20 shrink-0">{field.label}</Label>
                <Input
                  type={field.type} value={field.value}
                  onChange={e => field.onChange(e.target.value)}
                  className="h-9 text-sm font-mono" placeholder={field.placeholder}
                />
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between p-2.5 rounded bg-muted/30 text-xs">
            <span className="text-muted-foreground">Guacamole: Temporary User</span>
            <span className="font-mono text-muted-foreground">{protocol.toUpperCase()} :{protocol === 'rdp' ? '3389' : '22'}</span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button className="gap-2 bg-cyan-600 hover:bg-cyan-700 text-white" disabled={connecting} onClick={onConnect}>
            {connecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Terminal className="h-4 w-4" />}
            Connect {protocol.toUpperCase()}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Create VM Dialog ─────────────────────────────────────────────────────────

interface CreateVmDialogProps {
  open: boolean;
  templates: VmTemplate[];
  templatesLoading: boolean;
  selectedTemplate: VmTemplate | null;
  submitting: boolean;
  onSelectTemplate: (tpl: VmTemplate) => void;
  onClose: () => void;
  onConfirm: () => void;
}

export function CreateVmDialog({
  open, templates, templatesLoading, selectedTemplate,
  submitting, onSelectTemplate, onClose, onConfirm,
}: CreateVmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="sm:max-w-2xl w-full max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5 text-rose-500 shrink-0" /> Create Virtual Machine
          </DialogTitle>
          <DialogDescription>Select a template to provision a new VM for your lab</DialogDescription>
        </DialogHeader>

        <div className="overflow-y-auto max-h-[55vh] pr-1">
          <Label className="text-xs font-medium text-muted-foreground">SELECT TEMPLATE</Label>
          {templatesLoading ? (
            <div className="space-y-2 mt-2">
              {[1, 2, 3].map(i => <div key={i} className="h-14 bg-muted animate-pulse rounded-lg" />)}
            </div>
          ) : templates.length === 0 ? (
            <p className="text-center py-8 text-sm text-muted-foreground mt-2">
              No templates available. Make sure XCP-ng is configured in Admin Settings.
            </p>
          ) : (
            <div className="grid gap-2 mt-2 max-h-[35vh] overflow-y-auto">
              {templates.map(tpl => {
                const isSelected = selectedTemplate?.uuid === tpl.uuid;
                return (
                  <button
                    key={tpl.uuid}
                    type="button"
                    className={`flex items-center gap-3 p-3 rounded-lg border-2 text-left transition-all ${
                      isSelected
                        ? 'border-rose-500 bg-rose-50 dark:bg-rose-900/20'
                        : 'border-muted hover:border-muted-foreground/30'
                    }`}
                    onClick={() => onSelectTemplate(tpl)}
                  >
                    <Server className={`h-5 w-5 shrink-0 ${isSelected ? 'text-rose-600' : 'text-muted-foreground'}`} />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{tpl.name}</p>
                      {tpl.description && <p className="text-xs text-muted-foreground truncate">{tpl.description}</p>}
                      {(tpl.VCPUsMax || tpl.memoryStaticMax) && (
                        <div className="flex items-center gap-2 mt-0.5 text-[10px] text-muted-foreground">
                          {tpl.VCPUsMax && <span>{tpl.VCPUsMax} CPU{tpl.VCPUsMax > 1 ? 's' : ''}</span>}
                          {tpl.memoryStaticMax && <span>{(tpl.memoryStaticMax / (1024 ** 3)).toFixed(1)} GB RAM</span>}
                        </div>
                      )}
                    </div>
                    {isSelected && <Badge className="bg-rose-500 text-white text-xs shrink-0">Selected</Badge>}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            className="gap-2 bg-rose-600 hover:bg-rose-700 text-white"
            disabled={submitting || !selectedTemplate}
            onClick={onConfirm}
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Create VM
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Edit VM Resources Dialog ─────────────────────────────────────────────────

export interface EditVmResourcesState {
  open: boolean;
  vmUuid: string;
  vmName: string;
  currentVcpus: number;
  currentMemoryMB: number;
}

interface EditVmResourcesDialogProps {
  state: EditVmResourcesState;
  vcpus: number;
  memoryMB: number;
  loading: boolean;
  onClose: () => void;
  onVcpusChange: (v: number) => void;
  onMemoryChange: (v: number) => void;
  onConfirm: () => void;
}

export function EditVmResourcesDialog({
  state, vcpus, memoryMB, loading,
  onClose, onVcpusChange, onMemoryChange, onConfirm,
}: EditVmResourcesDialogProps) {
  return (
    <Dialog open={state.open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Server className="h-5 w-5 text-indigo-500" /> Edit VM Resources
          </DialogTitle>
          <DialogDescription>
            {state.vmName} — Changes take effect after VM restart
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-lg bg-muted/30 text-center">
              <p className="text-xs text-muted-foreground mb-1">Current vCPUs</p>
              <p className="text-lg font-bold">{state.currentVcpus}</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/30 text-center">
              <p className="text-xs text-muted-foreground mb-1">Current RAM</p>
              <p className="text-lg font-bold">{formatMemory(state.currentMemoryMB * 1024 * 1024)}</p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">vCPUs</Label>
              <Input
                type="number"
                min={1}
                max={32}
                value={vcpus}
                onChange={e => onVcpusChange(parseInt(e.target.value) || 1)}
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">RAM (GB)</Label>
              <Input
                type="number"
                min={1}
                max={256}
                step={0.5}
                value={memoryMB / 1024}
                onChange={e => onMemoryChange(parseFloat(e.target.value) * 1024 || 1024)}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={onConfirm} disabled={loading} className="gap-1.5 bg-indigo-600 hover:bg-indigo-700">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Save Resources
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
