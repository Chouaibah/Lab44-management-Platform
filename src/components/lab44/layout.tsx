'use client';

import React, { useState } from 'react';
import { GraduationCap, Menu, MapPin, Mail, Heart } from 'lucide-react';
import { useLab44Store } from '@/store/lab44';
import type { AppView } from '@/types';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useScrollProgress, useNotificationPoller } from './layout/hooks';

// Re-exported so consumers can import from the same path as before.
export { ThemeToggle } from './layout/ThemeToggle';
export { AppSidebar, SIDEBAR_FULL, SIDEBAR_COLLAPSED } from './layout/AppSidebar';

// ─── LabHeader ────────────────────────────────────────────────────────────────
// Responsibilities:
//   1. Scroll-progress bar (fixed, z-top)
//   2. Side-effects: notification poller, announcement sound
//   3. Mobile topbar (hamburger + logo) — lg:hidden
//
// The AppSidebar is rendered SEPARATELY by Lab44App as a true flex sibling
// so it participates correctly in the flex-row layout.

interface LabHeaderProps {
  /** Controls the mobile sidebar drawer — owned by Lab44App */
  mobileNavOpen: boolean;
  onMobileNavToggle: () => void;
}

export function LabHeader({ mobileNavOpen, onMobileNavToggle }: LabHeaderProps) {
  const { auth, setNotifications } = useLab44Store();

  const isAuth       = !!auth.role;
  const isAdmin      = auth.role === 'admin';
  const isInstructor = auth.role === 'instructor';
  const isStudent    = auth.role === 'student';

  // Side-effects only — no render output
  useScrollProgress();
  useNotificationPoller(isAuth, setNotifications);

  return (
    <>
      {/* Scroll progress bar */}
      <div
        id="scroll-progress-bar"
        className="fixed top-0 left-0 h-[3px] z-[9999] pointer-events-none rounded-r-sm"
        style={{ width: '0%', background: 'linear-gradient(90deg, #059669, #0d9488, #0891b2, #8b5cf6)' }}
        aria-hidden="true"
      />

      {/* Mobile topbar — hidden on desktop (sidebar takes over on md+) */}
      {isAuth && (
        <header className="md:hidden sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border/60 bg-card/95 backdrop-blur px-4 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={onMobileNavToggle}
            aria-label="Open navigation"
          >
            <Menu className="h-5 w-5" />
          </Button>

          <div className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5 text-primary" />
            <span className="font-mono font-bold text-sm tracking-tight">
              Lab44
              <span className="text-muted-foreground font-normal ml-1 text-xs">
                · {isAdmin ? 'Admin' : isInstructor ? 'Instructor' : 'Student'}
              </span>
            </span>
          </div>
        </header>
      )}
    </>
  );
}

// ─── LabFooter ────────────────────────────────────────────────────────────────

export function LabFooter() {
  const { auth, setView } = useLab44Store();
  const role = auth.role;

  const quickLinks: { view: AppView; label: string }[] =
    role === 'student' ? [
      { view: 'student-choice',     label: 'Dashboard'     },
      { view: 'student-grades',     label: 'Grades'        },
      { view: 'student-vms',        label: 'VMs'           },
    ] :
    role === 'admin' ? [
      { view: 'admin-panel',        label: 'Panel'         },
      { view: 'admin-vm-monitor',   label: 'VMs'           },
      { view: 'admin-settings',     label: 'Settings'      },
    ] :
    role === 'instructor' ? [
      { view: 'instructor-panel',         label: 'Dashboard'     },
      { view: 'instructor-grades',        label: 'Students'      },
      { view: 'instructor-announcements', label: 'Announcements' },
      { view: 'instructor-vms',           label: 'VM Requests'   },
    ] : [];

  return (
    <footer className="mt-auto shrink-0">
      <Separator />
      <div className="bg-muted/30">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">

            {/* Branding */}
            <div className="col-span-2 sm:col-span-1">
              <div className="flex items-center gap-2 mb-2">
                <GraduationCap className="h-5 w-5 text-primary" />
                <span className="font-mono font-bold text-sm">Lab44</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">Lab Management Platform</p>
              <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                Made with{' '}
                <Heart className="h-3 w-3 text-red-500 fill-red-500 animate-pulse" />{' '}
                by Lab44 Team
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                &copy; {new Date().getFullYear()} Lab44 · All rights reserved
              </p>
            </div>

            {/* Quick links */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wider">
                Quick Links
              </p>
              <div className="flex flex-col gap-1">
                {quickLinks.length > 0
                  ? quickLinks.map(link => (
                      <button
                        key={link.view}
                        onClick={() => setView(link.view)}
                        className="text-xs text-muted-foreground hover:text-foreground transition-colors text-left w-fit"
                      >
                        {link.label}
                      </button>
                    ))
                  : (
                    <>
                      <button onClick={() => setView('student-login')}    className="text-xs text-muted-foreground hover:text-foreground transition-colors text-left">Student Login</button>
                      <button onClick={() => setView('instructor-login')} className="text-xs text-amber-600 dark:text-amber-400 hover:text-amber-700 transition-colors text-left">Instructor Login</button>
                      <button onClick={() => setView('admin-login')}      className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 transition-colors text-left">Admin Login</button>
                    </>
                  )
                }
              </div>
            </div>

            {/* Contact */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wider">Contact</p>
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <MapPin className="h-3 w-3 shrink-0" />
                  <span>Lab 44, FGE Building, USTHB</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Mail className="h-3 w-3 shrink-0" />
                  <span>contact.fge@usthb.edu.dz</span>
                </div>
              </div>
            </div>

            {/* Info */}
            <div className="col-span-2 sm:col-span-1">
              <p className="text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wider">Info</p>
              <p className="text-xs text-muted-foreground">Version 1.0.1</p>
              <p className="text-xs text-muted-foreground mt-0.5">Beta Version</p>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
