'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useLab44Store } from '@/store/lab44';
import type { AppView } from '@/types';
import { getInitials, getAvatarColor } from '@/lib/helpers';
import { ThemeToggle } from './ThemeToggle';
import { ColorThemePicker } from './ColorThemePicker';
import { NotificationCenter } from '../NotificationCenter';
import { ADMIN_NAV, INSTRUCTOR_NAV, STUDENT_NAV } from './nav-items';
import type { NavItem } from './nav-items';
import { GraduationCap, LogOut, ChevronLeft, ChevronRight, User, FlaskConical } from 'lucide-react';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';

const SIDEBAR_FULL = 240;
const SIDEBAR_COLLAPSED = 64;
const BREAKPOINT = 768;

// ─── Tooltip ──────────────────────────────────────────────────────────────────
function Tooltip({ label, children }: { label: string; children: React.ReactNode }) {
  const [show, setShow] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const ref = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={ref}
      style={{ position: 'relative', width: '100%', display: 'flex', justifyContent: 'center' }}
      onMouseEnter={() => {
        if (ref.current) {
          const r = ref.current.getBoundingClientRect();
          setPos({ top: r.top + r.height / 2, left: r.right + 8 });
        }
        setShow(true);
      }}
      onMouseLeave={() => setShow(false)}
    >
      {children}
      {typeof window !== 'undefined' && show && createPortal(
        <div style={{
          position: 'fixed', top: pos.top, left: pos.left,
          transform: 'translateY(-50%)', zIndex: 9999,
          padding: '4px 10px', borderRadius: 6,
          background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          fontSize: 12, fontWeight: 500, color: 'hsl(var(--foreground))',
          whiteSpace: 'nowrap', pointerEvents: 'none',
        }}>
          {label}
        </div>,
        document.body,
      )}
    </div>
  );
}

// ─── Nav button ───────────────────────────────────────────────────────────────
const navBtnBase: React.CSSProperties = {
  position: 'relative', display: 'flex', alignItems: 'center',
  height: 36, borderRadius: 10, border: 'none', cursor: 'pointer',
  fontSize: 13, textAlign: 'left', whiteSpace: 'nowrap', overflow: 'hidden',
  transition: 'background 0.12s, color 0.12s',
};

function NavBtn({ item, active, collapsed, badge, badgeClass, onClick }: {
  item: NavItem; active: boolean; collapsed: boolean;
  badge?: number; badgeClass?: string; onClick: () => void;
}) {
  const Icon = item.icon;
  const hover = useCallback((el: HTMLElement, on: boolean) => {
    if (!active) {
      el.style.background = on ? 'hsl(var(--muted) / 0.6)' : 'transparent';
      el.style.color = on ? 'hsl(var(--foreground))' : 'hsl(var(--muted-foreground))';
    }
  }, [active]);

  const btn = (
    <button
      onClick={onClick}
      title={collapsed ? item.label : undefined}
      style={{
        ...navBtnBase,
        gap: collapsed ? 0 : 10,
        justifyContent: collapsed ? 'center' : 'flex-start',
        width: collapsed ? 40 : '100%',
        padding: collapsed ? 0 : '0 12px',
        fontWeight: active ? 600 : 400,
        background: active ? 'hsl(var(--primary) / 0.1)' : 'transparent',
        color: active ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))',
      }}
      onMouseEnter={e => hover(e.currentTarget, true)}
      onMouseLeave={e => hover(e.currentTarget, false)}
    >
      {active && !collapsed && (
        <span style={{
          position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)',
          width: 2, height: 20, borderRadius: '0 2px 2px 0', background: 'hsl(var(--primary))',
        }} />
      )}
      <span style={{ position: 'relative', flexShrink: 0, display: 'flex' }}>
        <Icon size={17} />
        {(badge ?? 0) > 0 && (
          <span style={{
            position: 'absolute', top: -6, right: -6, minWidth: 16, height: 16, padding: '0 3px',
            borderRadius: 9999,
            background: badgeClass === 'bg-blue-500' ? '#3b82f6' : badgeClass === 'bg-amber-500' ? '#f59e0b' : '#10b981',
            color: '#fff', fontSize: 9, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {(badge ?? 0) > 9 ? '9+' : badge}
          </span>
        )}
      </span>
      {!collapsed && <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.label}</span>}
    </button>
  );

  return collapsed ? <Tooltip label={item.label}>{btn}</Tooltip> : btn;
}

// ─── Section label ────────────────────────────────────────────────────────────
function SectionLabel({ label, collapsed }: { label: string; collapsed: boolean }) {
  if (collapsed) return <div style={{ height: 1, background: 'hsl(var(--border) / 0.5)', margin: '8px 8px' }} />;
  return (
    <p style={{
      fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
      color: 'hsl(var(--muted-foreground) / 0.5)', padding: '14px 12px 4px', margin: 0, userSelect: 'none',
    }}>
      {label}
    </p>
  );
}

// ─── Sidebar body (shared desktop + mobile) ───────────────────────────────────
function SidebarBody({ collapsed, onCollapse, onClose }: {
  collapsed: boolean; onCollapse?: () => void; onClose?: () => void;
}) {
  const { auth, currentView, setView, logout, unreadMessageCount, selectedLabId, setSelectedLabId, labs, setLabs } = useLab44Store();
  const isAdmin = auth.role === 'admin';
  const isInstructor = auth.role === 'instructor';

  const navItems = isAdmin ? ADMIN_NAV : isInstructor ? INSTRUCTOR_NAV : STUDENT_NAV;
  const badgeClass = isAdmin ? 'bg-blue-500' : isInstructor ? 'bg-amber-500' : 'bg-emerald-500';
  const msgView: AppView = isInstructor ? 'instructor-messages' : 'student-messages';

  const studentName = auth.student ? `${auth.student.firstName} ${auth.student.lastName}` : '';
  const instructorName = auth.instructor?.displayName ?? '';
  const displayName = isAdmin ? 'Administrator' : isInstructor ? instructorName : studentName;
  const initials = isAdmin ? 'A'
    : isInstructor ? (instructorName.charAt(0) || 'I').toUpperCase()
    : auth.student ? getInitials(auth.student.firstName, auth.student.lastName) : '?';
  const avatarBg = isAdmin ? '#3b82f6' : isInstructor ? '#f59e0b' : auth.student ? undefined : '#64748b';
  const avatarClass = !isAdmin && !isInstructor && auth.student ? getAvatarColor(studentName) : '';

  const [signOutOpen, setSignOutOpen] = useState(false);

  // Auto-fetch labs for instructor lab selector
  useEffect(() => {
    if (!isInstructor || labs.length > 0) return;
    (async () => {
      try {
        const res = await fetch('/api/labs');
        const data = await res.json();
        if (Array.isArray(data)) setLabs(data);
      } catch { /* ignore */ }
    })();
  }, [isInstructor, labs.length, setLabs]);

  const go = (view: AppView) => { setView(view); onClose?.(); };
  const handleSignOut = () => {
    setSignOutOpen(false);
    onClose?.();
    fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    logout();
    toast.success('Signed out');
  };

  const homeView = isAdmin ? 'admin-panel' : isInstructor ? 'instructor-panel' : 'student-choice';

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      width: collapsed ? SIDEBAR_COLLAPSED : SIDEBAR_FULL,
      background: 'hsl(var(--card))', borderRight: '1px solid hsl(var(--border) / 0.6)',
      transition: 'width 0.2s ease', overflow: 'hidden', position: 'relative',
    }}>
      {/* Logo row */}
      <div style={{
        display: 'flex', alignItems: 'center', height: 56,
        padding: collapsed ? 0 : '0 12px 0 16px', justifyContent: collapsed ? 'center' : 'flex-start',
        gap: 8, borderBottom: '1px solid hsl(var(--border) / 0.5)', flexShrink: 0,
      }}>
        <button onClick={() => go(homeView)} style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: 'none', border: 'none', cursor: 'pointer', padding: 0,
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = '0.7'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = '1'; }}
        >
          <GraduationCap size={20} color="hsl(var(--primary))" style={{ flexShrink: 0 }} />
          {!collapsed && <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 14, letterSpacing: '-0.02em', whiteSpace: 'nowrap' }}>Lab44</span>}
        </button>
        {!collapsed && (
          <span style={{
            fontSize: 10, fontWeight: 500, color: 'hsl(var(--muted-foreground))',
            background: 'hsl(var(--muted) / 0.6)', padding: '2px 8px', borderRadius: 9999, whiteSpace: 'nowrap',
          }}>
            {isAdmin ? 'Admin' : isInstructor ? 'Instructor' : 'Student'}
          </span>
        )}
        {/* Collapse toggle — always in the header row */}
        {onCollapse && (
          <button
            onClick={onCollapse}
            style={{
              marginLeft: collapsed ? 0 : 'auto',
              width: collapsed ? 40 : 28, height: collapsed ? 36 : 28,
              borderRadius: collapsed ? 10 : 6, border: 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer',
              background: collapsed ? 'hsl(var(--muted) / 0.4)' : 'transparent',
              color: 'hsl(var(--muted-foreground))',
              transition: 'background 0.12s, color 0.12s',
              flexShrink: 0,
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'hsl(var(--muted))'; e.currentTarget.style.color = 'hsl(var(--foreground))'; }}
            onMouseLeave={e => { e.currentTarget.style.background = collapsed ? 'hsl(var(--muted) / 0.4)' : 'transparent'; e.currentTarget.style.color = 'hsl(var(--muted-foreground))'; }}
          >
            {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={15} />}
          </button>
        )}
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: 8, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <SectionLabel label="Menu" collapsed={collapsed} />
        {navItems.map(item => (
          <NavBtn key={item.view} item={item} active={currentView === item.view} collapsed={collapsed}
            badge={item.view === msgView ? unreadMessageCount : 0} badgeClass={badgeClass} onClick={() => go(item.view)} />
        ))}
        {!isAdmin && !isInstructor && (
          <>
            <SectionLabel label="Account" collapsed={collapsed} />
            <NavBtn item={{ view: 'student-profile', icon: User, label: 'Profile' }}
              active={currentView === 'student-profile'} collapsed={collapsed} onClick={() => go('student-profile')} />
          </>
        )}

        {/* ─── Instructor Lab Selector ─────────────────────────────────── */}
        {isInstructor && auth.instructor && (() => {
          const instructor = auth.instructor!;
          const instructorLabIds: number[] = instructor.labIds?.length ? instructor.labIds : [instructor.labId];
          const currentLabId = selectedLabId || instructor.labId;
          const getLabName = (id: number) => labs.find(l => l.id === id)?.name || instructor.labName || `Lab #${id}`;
          const currentLabName = getLabName(currentLabId);

          if (instructorLabIds.length <= 1) {
            // Single lab — just a static badge
            return collapsed ? (
              <Tooltip label={currentLabName}>
                <div style={{
                  width: 40, height: 36, borderRadius: 10,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'hsl(26 90% 50% / 0.12)', flexShrink: 0,
                }}>
                  <FlaskConical size={16} color="#f59e0b" />
                </div>
              </Tooltip>
            ) : (
              <div style={{ padding: '8px 4px 2px' }}>
                <SectionLabel label="Lab" collapsed={false} />
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 7,
                  padding: '6px 12px', borderRadius: 10,
                  background: 'hsl(26 90% 50% / 0.08)',
                }}>
                  <FlaskConical size={14} color="#f59e0b" style={{ flexShrink: 0 }} />
                  <span style={{
                    fontSize: 12, fontWeight: 600, color: 'hsl(var(--foreground))',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>{currentLabName}</span>
                </div>
              </div>
            );
          }

          // Multiple labs — select dropdown
          return collapsed ? (
            <Tooltip label={`Lab: ${currentLabName}`}>
              <button
                onClick={() => {
                  const idx = instructorLabIds.indexOf(currentLabId);
                  const next = instructorLabIds[(idx + 1) % instructorLabIds.length];
                  setSelectedLabId(next);
                }}
                style={{
                  width: 40, height: 36, borderRadius: 10, border: 'none', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'hsl(26 90% 50% / 0.12)', color: '#f59e0b',
                  transition: 'background 0.12s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'hsl(26 90% 50% / 0.22)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'hsl(26 90% 50% / 0.12)'; }}
              >
                <FlaskConical size={16} />
              </button>
            </Tooltip>
          ) : (
            <div style={{ padding: '8px 4px 2px' }}>
              <SectionLabel label="Lab" collapsed={false} />
              <Select value={String(currentLabId)} onValueChange={val => setSelectedLabId(parseInt(val))}>
                <SelectTrigger className="[&>svg:last-child]:hidden" style={{
                  width: '100%', maxWidth: 220, height: 34, fontSize: 12, borderRadius: 10,
                  background: 'hsl(26 90% 50% / 0.08)',
                  border: '1px solid hsl(26 90% 50% / 0.2)',
                  color: 'hsl(var(--foreground))',
                  paddingLeft: 10, paddingRight: 24,
                  overflow: 'hidden',
                }}>
                  <SelectValue>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
                      <FlaskConical size={13} color="#f59e0b" style={{ flexShrink: 0 }} />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {currentLabName}
                      </span>
                    </span>
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {instructorLabIds.map(labId => (
                    <SelectItem key={labId} value={String(labId)}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                        <FlaskConical size={13} color="#f59e0b" />
                        {getLabName(labId)}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          );
        })()}
      </nav>

      {/* Footer */}
      <div style={{ borderTop: '1px solid hsl(var(--border) / 0.5)', padding: 8, display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0 }}>
        {/* Avatar */}
        {collapsed ? (
          <Tooltip label={displayName}>
            <button onClick={() => !isAdmin && !isInstructor && go('student-profile')}
              className={avatarClass}
              style={{
                width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 700, color: '#fff', background: avatarBg, border: 'none', cursor: 'pointer',
              }}
            >
              {initials}
            </button>
          </Tooltip>
        ) : (
          <button onClick={() => !isAdmin && !isInstructor && go('student-profile')} style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 10,
            border: 'none', cursor: 'pointer', background: 'transparent', textAlign: 'left', width: '100%',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'hsl(var(--muted) / 0.6)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
          >
            <div className={avatarClass} style={{
              width: 32, height: 32, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 700, color: '#fff', background: avatarBg,
            }}>
              {initials}
            </div>
            <div style={{ minWidth: 0 }}>
              <p style={{ fontSize: 13, fontWeight: 600, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'hsl(var(--foreground))' }}>{displayName}</p>
              <p style={{ fontSize: 10, margin: 0, color: 'hsl(var(--muted-foreground))', textTransform: 'capitalize' }}>{auth.role}</p>
            </div>
          </button>
        )}

        {/* Theme + Notifications */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '0 4px', flexDirection: collapsed ? 'column' : 'row' }}>
          <ThemeToggle />
          <ColorThemePicker collapsed={collapsed} />
          <NotificationCenter badgeClassName={badgeClass} />
        </div>

        {/* Sign out */}
        <AlertDialog open={signOutOpen} onOpenChange={setSignOutOpen}>
          {collapsed ? (
            <Tooltip label="Sign out">
              <button
                onClick={() => setSignOutOpen(true)}
                style={{
                  width: 40, height: 36, borderRadius: 10, border: 'none',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', background: 'transparent', color: 'hsl(var(--muted-foreground))',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'hsl(var(--destructive) / 0.08)'; e.currentTarget.style.color = 'hsl(var(--destructive))'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'hsl(var(--muted-foreground))'; }}
              >
                <LogOut size={16} />
              </button>
            </Tooltip>
          ) : (
            <button
              onClick={() => setSignOutOpen(true)}
              style={{
                width: '100%', height: 36, borderRadius: 10, border: 'none',
                display: 'flex', alignItems: 'center', gap: 10, padding: '0 12px',
                cursor: 'pointer', background: 'transparent', fontSize: 13,
                color: 'hsl(var(--muted-foreground))', textAlign: 'left',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'hsl(var(--destructive) / 0.08)'; e.currentTarget.style.color = 'hsl(var(--destructive))'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'hsl(var(--muted-foreground))'; }}
            >
              <LogOut size={16} /> Sign out
            </button>
          )}
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Sign out?</AlertDialogTitle>
              <AlertDialogDescription>You will be returned to the login page.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleSignOut}>Sign out</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

    </div>
  );
}

// ─── AppSidebar (exported) ────────────────────────────────────────────────────
export interface AppSidebarProps {
  mobileOpen: boolean;
  onMobileClose: () => void;
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
}

export function AppSidebar({ mobileOpen, onMobileClose, collapsed, onCollapsedChange }: AppSidebarProps) {
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const check = () => setIsDesktop(window.innerWidth >= BREAKPOINT);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const sidebarW = collapsed ? SIDEBAR_COLLAPSED : SIDEBAR_FULL;

  return (
    <>
      {isDesktop && (
        <div style={{
          position: 'fixed', top: 0, left: 0, height: '100vh',
          width: sidebarW, zIndex: 40, transition: 'width 0.2s ease',
        }}>
          <SidebarBody collapsed={collapsed} onCollapse={() => onCollapsedChange(!collapsed)} onClose={onMobileClose} />
        </div>
      )}

      <AnimatePresence>
        {mobileOpen && !isDesktop && (
          <>
            <motion.div key="backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }} onClick={onMobileClose}
              style={{ position: 'fixed', inset: 0, zIndex: 48, background: 'rgba(0,0,0,0.45)' }}
            />
            <motion.aside key="drawer" initial={{ x: -SIDEBAR_FULL }} animate={{ x: 0 }} exit={{ x: -SIDEBAR_FULL }}
              transition={{ type: 'spring', stiffness: 300, damping: 32 }}
              style={{ position: 'fixed', top: 0, left: 0, bottom: 0, width: SIDEBAR_FULL, zIndex: 49, background: 'hsl(var(--card))' }}
            >
              <SidebarBody collapsed={false} onClose={onMobileClose} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

export { SIDEBAR_FULL, SIDEBAR_COLLAPSED };
