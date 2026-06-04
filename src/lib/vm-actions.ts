/**
 * Shared VM action utilities.
 * Extracted from InstructorVMView, AdminVMMonitorView, StudentVMsView, SystemHealthView.
 */

/**
 * Format bytes into human-readable memory string.
 * Replaces duplicated formatMemory/formatBytes functions across VM views.
 */
export function formatMemory(bytes?: number): string {
  if (!bytes) return '—';
  if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(1)} GB`;
  if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(0)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${bytes} B`;
}

/**
 * Execute a VM power action (start, stop, reboot).
 * Returns the API response data or throws on error.
 */
export async function vmPowerAction(vmUuid: string, action: 'start' | 'stop' | 'reboot') {
  const res = await fetch(`/api/xapi/vms/${vmUuid}/action`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action }),
    credentials: 'same-origin',
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Failed to ${action} VM`);
  return data;
}

/**
 * Load detailed VM info from the xAPI.
 */
export async function loadVmDetails(vmUuid: string) {
  const res = await fetch(`/api/xapi/vms/${vmUuid}/details`, { credentials: 'same-origin' });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to load VM details');
  return data;
}

/**
 * Get VM status color and label.
 */
export function vmStatusInfo(status: string): { label: string; color: string; bgColor: string } {
  switch (status) {
    case 'Running': return { label: 'Running', color: 'text-emerald-600 dark:text-emerald-400', bgColor: 'bg-emerald-100 dark:bg-emerald-900/30' };
    case 'Halted': return { label: 'Halted', color: 'text-red-600 dark:text-red-400', bgColor: 'bg-red-100 dark:bg-red-900/30' };
    case 'Paused': return { label: 'Paused', color: 'text-amber-600 dark:text-amber-400', bgColor: 'bg-amber-100 dark:bg-amber-900/30' };
    case 'Suspended': return { label: 'Suspended', color: 'text-violet-600 dark:text-violet-400', bgColor: 'bg-violet-100 dark:bg-violet-900/30' };
    default: return { label: status || 'Unknown', color: 'text-gray-600 dark:text-gray-400', bgColor: 'bg-gray-100 dark:bg-gray-900/30' };
  }
}

/**
 * Get VM power state icon name.
 */
export function vmPowerIcon(status: string): 'Play' | 'Square' | 'RotateCw' {
  switch (status) {
    case 'Running': return 'Square';
    case 'Halted': return 'Play';
    default: return 'RotateCw';
  }
}
