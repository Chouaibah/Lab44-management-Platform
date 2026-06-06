// ─── Core domain types ────────────────────────────────────────────────────────

export interface VmRequest {
  id: number;
  studentDbId: number;
  studentName: string;
  studentId: string;
  templateUuid: string | null;
  templateName: string | null;
  status: 'pending' | 'approved' | 'rejected';
  note: string | null;
  vmUuid: string | null;
  vmName: string | null;
  vmIp: string | null;
  accessProtocol: string | null;
  guacConnectionId: string | null;
  requestedAt: string;
  reviewedAt: string | null;
}

export interface VmPowerState {
  powerState: string;
  lastChecked: number;
}

export interface VmTemplate {
  uuid: string;
  name: string;
  description?: string;
  VCPUsMax?: number;
  memoryStaticMax?: number;
}

export interface VmDetails {
  name_label?: string;
  name?: string;
  uuid?: string;
  power_state?: string;
  vCPUs_live?: number;
  vCPUs_max?: number;
  VCPUs_at_startup?: number;
  vcpus?: number;
  memory_actual?: number;
  memory_dynamic_max?: number;
  memory_static_max?: number;
  memory?: number;
  ip?: string;
  networks?: unknown;
  os?: string;
  osVersion?: { name?: string };
  description?: string;
}

// ─── Dialog state shapes ──────────────────────────────────────────────────────

export interface ApproveDialogState {
  open: boolean;
  requestId: number | null;
  templateName: string;
}

export interface ApproveForm {
  vmName: string;
  guacProtocol: string;
  vmIp: string;
  vmUser: string;
  vmPass: string;
  note: string;
}

export interface RejectDialogState {
  open: boolean;
  requestId: number | null;
}

export interface DeleteDialogState {
  open: boolean;
  requestId: number | null;
  studentName: string;
  templateName: string;
}

export interface ConsoleDialogState {
  open: boolean;
  requestId: number | null;
  vmName: string;
  vmIp: string;
  studentName: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function formatMemory(bytes?: number): string {
  if (!bytes) return '—';
  if (bytes >= 1_073_741_824) return `${(bytes / 1_073_741_824).toFixed(1)} GB`;
  if (bytes >= 1_048_576)     return `${(bytes / 1_048_576).toFixed(0)} MB`;
  if (bytes >= 1_024)         return `${(bytes / 1_024).toFixed(0)} KB`;
  return `${bytes} B`;
}

export const EMPTY_APPROVE_FORM: ApproveForm = {
  vmName: '', guacProtocol: 'rdp', vmIp: '', vmUser: '', vmPass: '', note: '',
};

export const EMPTY_CONSOLE_DIALOG: ConsoleDialogState = {
  open: false, requestId: null, vmName: '', vmIp: '', studentName: '',
};
