// src/lib/helpers/status-badges.tsx
'use client';

import { Badge } from '@/components/ui/badge';

export function vmStatusBadge(status: string) {
    switch (status) {
        case 'approved':
            return (
                <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800">
                Approved
                </Badge>
            );
        case 'rejected':
            return (
                <Badge className="bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800">
                Rejected
                </Badge>
            );
        default:
            return (
                <Badge className="bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800">
                Pending
                </Badge>
            );
    }
}

export function attendanceStatusBadge(status: string) {
    switch (status) {
        case 'present':
            return (
                <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800">
                Present
                </Badge>
            );
        case 'absent':
            return (
                <Badge className="bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800">
                Absent
                </Badge>
            );
        default:
            return <Badge variant="secondary">{status || 'Unknown'}</Badge>;
    }
}
