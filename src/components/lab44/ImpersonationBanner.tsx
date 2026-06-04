'use client';

import React from 'react';
import { toast } from 'sonner';
import { useLab44Store } from '@/store/lab44';
import { Button } from '@/components/ui/button';
import { Eye, LogOut } from 'lucide-react';

export default function ImpersonationBanner() {
  const { auth, setAuth, setView } = useLab44Store();

  if (!auth.isImpersonating) return null;

  const impersonatedName = auth.student
    ? `${auth.student.firstName} ${auth.student.lastName}`
    : auth.instructor?.displayName || 'Unknown';

  const impersonatedRole = auth.role === 'student' ? 'Student' : auth.role === 'instructor' ? 'Instructor' : '';

  const handleExitImpersonation = async () => {
    try {
      const res = await fetch('/api/auth/exit-impersonation', { method: 'POST' });
      const data = await res.json();
      if (!data.ok) {
        toast.error(data.error || 'Failed to exit impersonation');
        return;
      }

      // Restore admin auth state
      setAuth({
        role: 'admin',
        student: null,
        instructor: null,
        isImpersonating: false,
        originalRole: undefined,
        originalUserId: undefined,
      });

      setView('admin-panel');
      toast.success('Returned to admin view');
    } catch {
      toast.error('Connection error');
    }
  };

  return (
    <div className="fixed top-0 left-0 right-0 z-50 border-b bg-amber-50 dark:bg-amber-950/80 border-amber-200 dark:border-amber-800" role="alert">
      <div className="mx-auto max-w-7xl flex items-center justify-between px-4 py-2">
        <div className="flex items-center gap-2 text-sm font-medium text-amber-800 dark:text-amber-200">
          <Eye className="h-4 w-4 shrink-0" />
          <span>
            Viewing as <strong>{impersonatedName}</strong> ({impersonatedRole})
          </span>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900/50"
          onClick={handleExitImpersonation}
        >
          <LogOut className="h-3 w-3 mr-1" />
          Exit Impersonation
        </Button>
      </div>
    </div>
  );
}
