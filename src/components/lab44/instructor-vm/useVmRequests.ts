'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import type { VmRequest, VmPowerState } from './types';

const POLL_INTERVAL_MS = 30_000;
const POWER_BATCH_SIZE = 5;

export function useVmRequests(activeLabId: number) {
  const [vmRequests, setVmRequests]       = useState<VmRequest[]>([]);
  const [vmPowerStates, setVmPowerStates] = useState<Record<string, VmPowerState>>({});
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing]         = useState(false);

  // ── Core fetch ──────────────────────────────────────────────────────────
  const fetchRequests = useCallback(async (): Promise<VmRequest[]> => {
    const res  = await fetch(`/api/vm-requests?labId=${activeLabId}`);
    const data = await res.json();
    return data.requests || [];
  }, [activeLabId]);

  const refreshData = useCallback(async (silent = false) => {
    if (!activeLabId) return;
    setRefreshing(true);
    try {
      const requests = await fetchRequests();
      setVmRequests(requests);
      if (!silent) toast.success('Data refreshed');
    } catch {
      if (!silent) toast.error('Failed to refresh data');
    } finally {
      setRefreshing(false);
    }
  }, [activeLabId, fetchRequests]);

  // Initial load
  useEffect(() => {
    if (!activeLabId) return;
    let cancelled = false;
    fetchRequests()
      .then(reqs => { if (!cancelled) setVmRequests(reqs); })
      .catch(() => { if (!cancelled) toast.error('Failed to load VM requests'); })
      .finally(() => { if (!cancelled) setInitialLoading(false); });
    return () => { cancelled = true; };
  }, [activeLabId, fetchRequests]);

  // ── Power state polling ─────────────────────────────────────────────────
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
            const data = await res.json();
            return { uuid: req.vmUuid, powerState: data.power_state || 'Unknown' };
          }),
        );
        setVmPowerStates(prev => {
          const next = { ...prev };
          const now  = Date.now();
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

  return {
    vmRequests,
    setVmRequests,
    vmPowerStates,
    initialLoading,
    refreshing,
    refreshData,
  };
}
