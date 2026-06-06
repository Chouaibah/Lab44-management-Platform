'use client';

import React from 'react';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui/tooltip';
import { Check } from 'lucide-react';

export function AchievementBadge({
  icon: Icon,
  label,
  description,
  color,
  unlocked,
}: {
  icon: React.ElementType;
  label: string;
  description: string;
  color: string;
  unlocked: boolean;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className={`relative flex flex-col items-center gap-1.5 p-3 rounded-xl transition-all duration-300 ${
            unlocked ? 'opacity-100' : 'opacity-40 grayscale'
          }`}
        >
          <div
            className={`flex h-12 w-12 items-center justify-center rounded-full ${
              unlocked ? color : 'bg-muted'
            } shadow-md ${unlocked ? 'animate-pulse' : ''}`}
          >
            <Icon className={`h-5 w-5 ${unlocked ? 'text-white' : 'text-muted-foreground'}`} />
          </div>
          <span className="text-[10px] font-semibold text-center leading-tight max-w-[70px]">
            {label}
          </span>
          {unlocked && (
            <div className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center">
              <Check className="h-3 w-3 text-emerald-500" />
            </div>
          )}
        </div>
      </TooltipTrigger>
      <TooltipContent>
        <p className="font-semibold text-xs">{label}</p>
        <p className="text-[10px] text-muted-foreground">{description}</p>
        {!unlocked && <p className="text-[10px] text-amber-500 mt-0.5">🔒 Locked</p>}
      </TooltipContent>
    </Tooltip>
  );
}

import {
  Star,
  Trophy,
  Award,
  Target,
  Flame,
  UserCheck,
  BookOpen,
  Zap,
} from 'lucide-react';

export function computeAchievements(
  avgGrade: number | null,
  attendRate: number,
  totalGraded: number,
  columnsTotal: number
) {
  return [
    {
      icon: Star,
      label: 'Perfect Score',
      description: 'Average grade of 20/20',
      color: 'bg-amber-500',
      unlocked: avgGrade !== null && avgGrade >= 20,
    },
    {
      icon: Trophy,
      label: 'Excellence',
      description: 'Average grade ≥ 16',
      color: 'bg-emerald-500',
      unlocked: avgGrade !== null && avgGrade >= 16,
    },
    {
      icon: Award,
      label: 'Honor Roll',
      description: 'Average grade ≥ 12',
      color: 'bg-violet-500',
      unlocked: avgGrade !== null && avgGrade >= 12,
    },
    {
      icon: Target,
      label: 'On Track',
      description: 'Average grade ≥ 10',
      color: 'bg-cyan-500',
      unlocked: avgGrade !== null && avgGrade >= 10,
    },
    {
      icon: Flame,
      label: 'Streak',
      description: 'All assessments graded',
      color: 'bg-rose-500',
      unlocked: totalGraded > 0 && totalGraded >= columnsTotal,
    },
    {
      icon: UserCheck,
      label: 'Attendance Star',
      description: 'Attendance rate ≥ 90%',
      color: 'bg-teal-500',
      unlocked: attendRate >= 90,
    },
    {
      icon: BookOpen,
      label: 'Dedicated',
      description: 'Attendance rate ≥ 70%',
      color: 'bg-orange-500',
      unlocked: attendRate >= 70,
    },
    {
      icon: Zap,
      label: 'First Steps',
      description: 'Complete at least 1 assessment',
      color: 'bg-indigo-500',
      unlocked: totalGraded >= 1,
    },
  ];
}