'use client';

export function gradeColor(value: number | null): string {
    if (value === null) return 'text-muted-foreground';
    if (value >= 12) return 'text-emerald-600 dark:text-emerald-400';
    if (value >= 8) return 'text-amber-600 dark:text-amber-400';
    return 'text-red-600 dark:text-red-400';
}

export function gradeBarColor(value: number | null): string {
    if (value === null) return 'bg-muted-foreground/30';
    if (value >= 12) return 'bg-emerald-500';
    if (value >= 8) return 'bg-amber-500';
    return 'bg-red-500';
}

export function gradeDotColor(value: number | null): string {
    if (value === null) return 'bg-muted-foreground/30';
    if (value >= 12) return 'bg-emerald-500';
    if (value >= 8) return 'bg-amber-500';
    return 'bg-red-500';
}
