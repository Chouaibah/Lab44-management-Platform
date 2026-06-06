'use client';

import React, { useEffect } from 'react';
import { useLab44Store } from '@/store/lab44';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { BookOpen, FlaskConical } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

/**
 * Reusable lab selector for instructor views.
 * Shows a dropdown to switch between labs the instructor is assigned to.
 * Falls back to instructor.labId if labIds is undefined.
 * Also auto-fetches labs from API if the store's labs array is empty.
 */
export default function InstructorLabSelector() {
  const { auth, selectedLabId, setSelectedLabId, labs, setLabs } = useLab44Store();
  const instructor = auth.instructor;

  // Auto-fetch labs if not loaded yet
  useEffect(() => {
    if (!instructor || labs.length > 0) return;
    (async () => {
      try {
        const res = await fetch('/api/labs');
        const data = await res.json();
        if (Array.isArray(data)) setLabs(data);
      } catch { /* ignore */ }
    })();
  }, [instructor, labs.length, setLabs]);

  if (!instructor) return null;

  // Get all labs this instructor can access
  const instructorLabIds: number[] = instructor.labIds && instructor.labIds.length > 0
    ? instructor.labIds
    : [instructor.labId];

  // Resolve lab name from store
  const getLabName = (labId: number): string => {
    const lab = labs.find(l => l.id === labId);
    return lab?.name || instructor.labName || `Lab #${labId}`;
  };

  const getLabLevel = (labId: number): string | undefined => {
    const lab = labs.find(l => l.id === labId);
    return lab?.level;
  };

  // If only one lab, show it as a prominent badge with name
  if (instructorLabIds.length <= 1) {
    const labName = getLabName(instructor.labId);
    const labLevel = getLabLevel(instructor.labId);
    return (
      <div className="flex items-center gap-2 mt-2">
        <FlaskConical className="h-3.5 w-3.5 text-amber-500" />
        <Badge variant="outline" className="text-xs font-medium px-2 py-0.5 border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400">
          {labName}
        </Badge>
        {labLevel && (
          <Badge variant="secondary" className="text-[10px]">
            {labLevel}
          </Badge>
        )}
      </div>
    );
  }

  const currentLabId = selectedLabId || instructor.labId;
  const currentLabName = getLabName(currentLabId);
  const currentLabLevel = getLabLevel(currentLabId);

  return (
    <div className="flex items-center gap-2 mt-2">
      <Label className="text-xs font-medium text-muted-foreground whitespace-nowrap">Lab:</Label>
      <Select
        value={String(currentLabId)}
        onValueChange={(val) => setSelectedLabId(parseInt(val))}
      >
        <SelectTrigger className="h-8 w-56">
          <SelectValue>
            <span className="flex items-center gap-1.5">
              <FlaskConical className="h-3 w-3 text-amber-500" />
              {currentLabName}
              {currentLabLevel && <span className="text-[10px] text-muted-foreground">({currentLabLevel})</span>}
            </span>
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {instructorLabIds.map(labId => {
            const name = getLabName(labId);
            const level = getLabLevel(labId);
            return (
              <SelectItem key={labId} value={String(labId)}>
                <span className="flex items-center gap-1.5">
                  <FlaskConical className="h-3 w-3 text-amber-500" />
                  {name}
                  {level ? <span className="text-[10px] text-muted-foreground">({level})</span> : ''}
                </span>
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
      {currentLabLevel && (
        <Badge variant="secondary" className="text-[10px]">
          {currentLabLevel}
        </Badge>
      )}
    </div>
  );
}

/**
 * Hook to get the effective lab ID for the current instructor.
 * Uses selectedLabId from store, falls back to instructor.labId.
 */
export function useInstructorLabId(): number {
  const { auth, selectedLabId } = useLab44Store();
  const instructor = auth.instructor;
  return selectedLabId || instructor?.labId || 0;
}

/**
 * Hook to get all lab IDs for the current instructor.
 * Falls back to [instructor.labId] if labIds is undefined.
 */
export function useInstructorLabIds(): number[] {
  const { auth } = useLab44Store();
  const instructor = auth.instructor;
  if (!instructor) return [];
  return instructor.labIds && instructor.labIds.length > 0
    ? instructor.labIds
    : [instructor.labId];
}
