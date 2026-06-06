'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { useAnimatedNumber } from './use-animated-number';

export function StatCard({
    label,
    value,
    sub,
    statusColor,
    icon,
    iconBg,
    numericValue,
    className,
}: {
    label: string;
    value: React.ReactNode;
    sub?: React.ReactNode;
    statusColor?: string;
    icon: React.ReactNode;
    iconBg: string;
    numericValue?: number;
    className?: string;
}) {
    const animated = useAnimatedNumber(numericValue ?? 0);

    return (
        <Tooltip>
        <TooltipTrigger asChild>
        <Card className={`shadow-sm hover:shadow-md transition-shadow${className ? ` ${className}` : ''}`}>
        <CardContent className="p-4 flex items-center gap-3">
        <div className={`flex h-9 w-9 items-center justify-center rounded-lg shrink-0 ${iconBg}`}>
        {icon}
        </div>
        <div className="min-w-0">
        <p className="text-xs text-muted-foreground font-mono uppercase tracking-wider flex items-center gap-1.5">
        {statusColor && <span className={`inline-block h-1.5 w-1.5 rounded-full ${statusColor}`} />}
        {label}
        </p>
        <p className="text-lg font-bold leading-tight truncate">
        {numericValue !== undefined ? animated : value}
        </p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
        </div>
        </CardContent>
        </Card>
        </TooltipTrigger>
        <TooltipContent>
        <p className="text-xs">
        {label}: {numericValue !== undefined ? (numericValue === 0 ? '0' : value) : value}
        </p>
        </TooltipContent>
        </Tooltip>
    );
}
