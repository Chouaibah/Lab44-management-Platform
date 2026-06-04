'use client';

import React from 'react';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Keyboard, Zap, Navigation, FileEdit, LayoutDashboard } from 'lucide-react';

interface ShortcutsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role?: 'student' | 'instructor' | 'admin' | null;
}

// Keyboard key component with proper visual styling
function Kbd({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <kbd className={`inline-flex h-6 min-w-[24px] items-center justify-center rounded-md border border-border bg-muted/80 px-1.5 font-mono text-[11px] font-semibold text-foreground shadow-[0_1px_0_1px_rgba(0,0,0,0.05)] ${className}`}>
      {children}
    </kbd>
  );
}

// Shortcut row component
function ShortcutRow({ keys, description }: { keys: React.ReactNode; description: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <span className="text-sm text-muted-foreground truncate">{description}</span>
      <div className="flex items-center gap-1 shrink-0">{keys}</div>
    </div>
  );
}

// Category header
function CategoryHeader({ icon: Icon, title, color }: { icon: React.ElementType; title: string; color: string }) {
  return (
    <div className="flex items-center gap-2 pt-3 pb-1">
      <div className={`flex h-5 w-5 items-center justify-center rounded ${color}`}>
        <Icon className="h-3 w-3 text-white" />
      </div>
      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</span>
    </div>
  );
}

// Student shortcuts
const STUDENT_SHORTCUTS = [
  {
    category: 'Navigation',
    icon: Navigation,
    color: 'bg-violet-500',
    shortcuts: [
      { keys: <><Kbd>G</Kbd></>, desc: 'Go to My Grades' },
      { keys: <><Kbd>V</Kbd></>, desc: 'Go to My VMs' },
      { keys: <><Kbd>A</Kbd></>, desc: 'Go to Attendance' },
      { keys: <><Kbd>H</Kbd></>, desc: 'Go to Home' },
    ],
  },
  {
    category: 'General',
    icon: Zap,
    color: 'bg-amber-500',
    shortcuts: [
      { keys: <><Kbd>?</Kbd></>, desc: 'Show shortcuts' },
      { keys: <><Kbd>Esc</Kbd></>, desc: 'Close dialogs' },
      { keys: <><Kbd>D</Kbd></>, desc: 'Toggle dark mode' },
    ],
  },
];

// Instructor shortcuts
const INSTRUCTOR_SHORTCUTS = [
  {
    category: 'Navigation',
    icon: Navigation,
    color: 'bg-violet-500',
    shortcuts: [
      { keys: <><Kbd>S</Kbd></>, desc: 'Go to Students' },
      { keys: <><Kbd>A</Kbd></>, desc: 'Go to Attendance' },
      { keys: <><Kbd>V</Kbd></>, desc: 'Go to VM Requests' },
      { keys: <><Kbd>M</Kbd></>, desc: 'Go to Announcements' },
      { keys: <><Kbd>D</Kbd></>, desc: 'Go to Dashboard' },
    ],
  },
  {
    category: 'Grades',
    icon: FileEdit,
    color: 'bg-emerald-500',
    shortcuts: [
      { keys: <><Kbd>N</Kbd></>, desc: 'New assessment column' },
      { keys: <><Kbd>⌘</Kbd><Kbd>K</Kbd></>, desc: 'Quick search' },
    ],
  },
  {
    category: 'General',
    icon: Zap,
    color: 'bg-amber-500',
    shortcuts: [
      { keys: <><Kbd>?</Kbd></>, desc: 'Show shortcuts' },
      { keys: <><Kbd>Esc</Kbd></>, desc: 'Close dialogs' },
    ],
  },
];

// Admin shortcuts
const ADMIN_SHORTCUTS = [
  {
    category: 'Navigation',
    icon: Navigation,
    color: 'bg-violet-500',
    shortcuts: [
      { keys: <><Kbd>V</Kbd></>, desc: 'Go to VM Monitor' },
      { keys: <><Kbd>U</Kbd></>, desc: 'Go to Users' },
      { keys: <><Kbd>B</Kbd></>, desc: 'Go to Backups' },
      { keys: <><Kbd>L</Kbd></>, desc: 'Go to Audit Log' },
    ],
  },
  {
    category: 'Actions',
    icon: LayoutDashboard,
    color: 'bg-rose-500',
    shortcuts: [
      { keys: <><Kbd>⌘</Kbd><Kbd>K</Kbd></>, desc: 'Quick search' },
      { keys: <><Kbd>N</Kbd></>, desc: 'New column / item' },
    ],
  },
  {
    category: 'General',
    icon: Zap,
    color: 'bg-amber-500',
    shortcuts: [
      { keys: <><Kbd>?</Kbd></>, desc: 'Show shortcuts' },
      { keys: <><Kbd>Esc</Kbd></>, desc: 'Close dialogs' },
    ],
  },
];

export function ShortcutsDialog({ open, onOpenChange, role }: ShortcutsDialogProps) {
  const shortcuts = role === 'student' ? STUDENT_SHORTCUTS
    : role === 'instructor' ? INSTRUCTOR_SHORTCUTS
    : role === 'admin' ? ADMIN_SHORTCUTS
    : STUDENT_SHORTCUTS; // default fallback

  const roleLabel = role === 'student' ? 'Student' : role === 'instructor' ? 'Instructor' : role === 'admin' ? 'Admin' : '';
  const roleColor = role === 'student' ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400 border-violet-200 dark:border-violet-800'
    : role === 'instructor' ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400 border-rose-200 dark:border-rose-800'
    : role === 'admin' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800'
    : '';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="h-4 w-4" /> Keyboard Shortcuts
            {roleLabel && (
              <Badge variant="outline" className={`text-[9px] px-1.5 py-0 h-4 ${roleColor}`}>
                {roleLabel}
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription>Quick actions to speed up your workflow</DialogDescription>
        </DialogHeader>
        <div className="space-y-0 py-1">
          {shortcuts.map((category) => (
            <div key={category.category}>
              <CategoryHeader icon={category.icon} title={category.category} color={category.color} />
              <div className="space-y-0">
                {category.shortcuts.map((s, i) => (
                  <ShortcutRow key={i} keys={s.keys} description={s.desc} />
                ))}
              </div>
            </div>
          ))}
        </div>
        <DialogFooter className="sm:justify-between">
          <p className="text-[10px] text-muted-foreground">
            Press <Kbd className="inline-flex h-4 px-1 text-[9px]">?</Kbd> to open anytime
          </p>
          <Button size="sm" onClick={() => onOpenChange(false)}>Got it</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
