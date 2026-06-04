'use client';

import React, { useEffect, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useLab44Store, getViewFromUrl } from '@/store/lab44';
import type { AppView } from '@/types';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Keyboard } from 'lucide-react';
import { ShortcutsDialog } from '@/components/lab44/admin/ShortcutsDialog';

// ─── Layout: static imports (must render immediately, no lazy loading) ────────
import { LabHeader, LabFooter, AppSidebar, SIDEBAR_FULL, SIDEBAR_COLLAPSED } from '@/components/lab44/layout';
import ImpersonationBanner from '@/components/lab44/ImpersonationBanner';

// ─── View Loading Skeleton ───────────────────────────────────────────────────
function ViewLoader() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="flex flex-col items-center gap-4">
        <div className="h-10 w-10 rounded-full border-4 border-muted border-t-primary animate-spin" />
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    </div>
  );
}

// ─── Lazy-loaded student views ──────────────────────────────────────────────
const StudentLoginView = dynamic(() => import('@/components/lab44/StudentLoginView'), { loading: () => <ViewLoader />, ssr: false });
const StudentRegisterView = dynamic(() => import('@/components/lab44/StudentRegisterView'), { loading: () => <ViewLoader />, ssr: false });
const StudentChoiceView = dynamic(() => import('@/components/lab44/StudentChoiceView'), { loading: () => <ViewLoader />, ssr: false });
const StudentGradesView = dynamic(() => import('@/components/lab44/StudentGradesView'), { loading: () => <ViewLoader />, ssr: false });
const StudentVMsView = dynamic(() => import('@/components/lab44/StudentVMsView'), { loading: () => <ViewLoader />, ssr: false });
const StudentVMPickerInline = dynamic(() => import('@/components/lab44/StudentVMsView').then(m => ({ default: m.StudentVMPickerView })), { loading: () => <ViewLoader />, ssr: false });
const StudentProfileView = dynamic(() => import('@/components/lab44/StudentProfileView'), { loading: () => <ViewLoader />, ssr: false });
const StudentAttendanceView = dynamic(() => import('@/components/lab44/StudentAttendanceView'), { loading: () => <ViewLoader />, ssr: false });
const StudentExamView = dynamic(() => import('@/components/lab44/examen-test/StudentExamView'), { loading: () => <ViewLoader />, ssr: false });
const StudentExamTakingView = dynamic(() => import('@/components/lab44/examen-test/StudentExamTakingView'), { loading: () => <ViewLoader />, ssr: false });

// ─── Lazy-loaded admin views ────────────────────────────────────────────────
const AdminLoginView = dynamic(() => import('@/components/lab44/AdminLoginView'), { loading: () => <ViewLoader />, ssr: false });
const AdminPanelView = dynamic(() => import('@/components/lab44/AdminPanelView'), { loading: () => <ViewLoader />, ssr: false });
const AdminVMMonitorView = dynamic(() => import('@/components/lab44/AdminVMMonitorView'), { loading: () => <ViewLoader />, ssr: false });
const AdminSettingsView = dynamic(() => import('@/components/lab44/AdminSettingsView'), { loading: () => <ViewLoader />, ssr: false });
{/*const AuditLogView = dynamic(() => import('@/components/lab44/AuditLogView'), { loading: () => <ViewLoader />, ssr: false });*/}
const BackupView = dynamic(() => import('@/components/lab44/BackupView'), { loading: () => <ViewLoader />, ssr: false });
const AdminLabsView = dynamic(() => import('@/components/lab44/AdminLabsView'), { loading: () => <ViewLoader />, ssr: false });
const AdminInstructorsView = dynamic(() => import('@/components/lab44/AdminInstructorsView'), { loading: () => <ViewLoader />, ssr: false });

// ─── Lazy-loaded instructor views ───────────────────────────────────────────
const InstructorLoginView = dynamic(() => import('@/components/lab44/InstructorLoginView'), { loading: () => <ViewLoader />, ssr: false });
const InstructorPanelView = dynamic(() => import('@/components/lab44/InstructorPanelView'), { loading: () => <ViewLoader />, ssr: false });
const InstructorAttendanceView = dynamic(() => import('@/components/lab44/InstructorAttendanceView'), { loading: () => <ViewLoader />, ssr: false });
const InstructorGradesView = dynamic(() => import('@/components/lab44/InstructorGradesView'), { loading: () => <ViewLoader />, ssr: false });
const InstructorVMView = dynamic(() => import('@/components/lab44/InstructorVMView'), { loading: () => <ViewLoader />, ssr: false });
const InstructorAnnouncementsView = dynamic(() => import('@/components/lab44/InstructorAnnouncementsView'), { loading: () => <ViewLoader />, ssr: false });
const AttendanceReportView = dynamic(() => import('@/components/lab44/AttendanceReportView'), { loading: () => <ViewLoader />, ssr: false });
const MessagingView = dynamic(() => import('@/components/lab44/MessagingView'), { loading: () => <ViewLoader />, ssr: false });
const InstructorExamView = dynamic(() => import('@/components/lab44/examen-test/InstructorExamView'), { loading: () => <ViewLoader />, ssr: false });
const StudentAnnouncementsView = dynamic(() => import('@/components/lab44/StudentAnnouncementsView'), { loading: () => <ViewLoader />, ssr: false });

// ─── VIEW MAP ────────────────────────────────────────────────────────────────

const VIEW_COMPONENTS: Record<string, React.ComponentType> = {
  'student-login': StudentLoginView,
  'student-register': StudentRegisterView,
  'student-choice': StudentChoiceView,
  'student-grades': StudentGradesView,
  'student-vms': StudentVMsView,
  'student-vm-picker': StudentVMPickerInline,
  'student-profile': StudentProfileView,
  'student-attendance': StudentAttendanceView,
  'admin-login': AdminLoginView,
  'admin-panel': AdminPanelView,
  'admin-vm-monitor': AdminVMMonitorView,
  'admin-attendance': AdminPanelView,
  'admin-instructors': AdminInstructorsView,
  'admin-labs': AdminLabsView,
  'admin-settings': AdminSettingsView,

  'admin-backups': BackupView,
  'instructor-login': InstructorLoginView,
  'instructor-panel': InstructorPanelView,
  'instructor-students': InstructorGradesView,
  'instructor-grades': InstructorGradesView,
  'instructor-announcements': InstructorAnnouncementsView,
  'instructor-attendance': InstructorAttendanceView,
  'instructor-attendance-report': AttendanceReportView,
  'instructor-vms': InstructorVMView,
  'student-announcements': StudentAnnouncementsView,
  'student-messages': MessagingView,
  'student-exams': StudentExamView,
  'student-exam-taking': StudentExamTakingView,
  'instructor-messages': MessagingView,
  'instructor-exams': InstructorExamView,
};

// ─── MAIN APP COMPONENT (shared by / and /[...slug]) ────────────────────────

export default function Lab44App() {
  const currentView = useLab44Store(state => state.currentView);
  const setView     = useLab44Store(state => state.setView);
  const auth        = useLab44Store(state => state.auth);

  // Prevent hydration mismatch — only render auth-dependent UI after mount
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  // ─── Unified Routing & Auth Guard ──────────────────────────────────────────
  useEffect(() => {
    const PUBLIC_VIEWS: AppView[] = ['student-login', 'student-register', 'admin-login', 'instructor-login'];

    const getFallbackLogin = (view: AppView | null): AppView => {
      if (view && PUBLIC_VIEWS.includes(view)) return view;
      if (view?.startsWith('admin-')) return 'admin-login';
      if (view?.startsWith('instructor-')) return 'instructor-login';
      return 'student-login';
    };

    const handleRouting = async () => {
      const viewFromUrl = getViewFromUrl();

      let parsedAuth: { role: string; student?: any; instructor?: any; isImpersonating?: boolean; originalRole?: string; originalUserId?: number } | null = null;
      try {
        const authRes = await fetch('/api/auth/session');
        if (authRes.ok) {
          parsedAuth = await authRes.json();
        }
      } catch {}

      if (!parsedAuth || !parsedAuth.role) {
        useLab44Store.getState().setAuth({ role: null, student: null, isImpersonating: false });
        useLab44Store.getState().setViewSilent(getFallbackLogin(viewFromUrl));
        return;
      }

      const role = parsedAuth.role;
      const defaultViewForRole: AppView = role === 'student' ? 'student-choice'
        : role === 'admin' ? 'admin-panel'
        : 'instructor-panel';

      let viewToSet: AppView = viewFromUrl ?? defaultViewForRole;
      let validForRole = false;

      if (role === 'student' && viewToSet.startsWith('student-')) validForRole = true;
      if (role === 'admin' && viewToSet.startsWith('admin-')) validForRole = true;
      if (role === 'instructor' && viewToSet.startsWith('instructor-')) validForRole = true;

      if (!validForRole) {
        viewToSet = defaultViewForRole;
      }

      const store = useLab44Store.getState();
      store.setAuth(parsedAuth as unknown as { role: "student" | "admin" | "instructor"; student: any; instructor?: any; isImpersonating?: boolean; originalRole?: string; originalUserId?: number; labIds?: number[] });
      store.setViewSilent(viewToSet);

      // Set selectedLabId for instructors (default to primary labId)
      if (role === 'instructor' && parsedAuth.instructor) {
        const instructorLabId = parsedAuth.instructor.labId;
        if (instructorLabId && !store.selectedLabId) {
          store.setSelectedLabId(instructorLabId);
        }
      }

      if (role === 'student') {
        Promise.all([
          fetch('/api/data').then(r => r.json()),
          fetch(`/api/vm-requests?studentDbId=${parsedAuth.student?.id || parsedAuth.userId}`).then(r => r.json()),
        ]).then(([d, vmData]) => {
          store.setStudents(d.students || []);
          store.setColumns(d.columns || []);
          store.setGrades(d.grades || []);
          store.setAttendance(d.attendance || []);
          store.setStudentLabs(d.studentLabs || []);
          store.setInstructors(d.instructors || []);
          store.setLabs(d.labs || []);
          store.setVmRequests(vmData.requests || []);
        }).catch(() => { });
        fetch('/api/messages/unread-count').then(r => r.json()).then(d => {
          store.setUnreadMessageCount(d.count || 0);
        }).catch(() => { });
      } else if (role === 'admin') {
        Promise.all([
          fetch('/api/data').then(r => r.json()),
          fetch('/api/vm-requests').then(r => r.json()),
        ]).then(([d, vmData]) => {
          store.setStudents(d.students || []);
          store.setColumns(d.columns || []);
          store.setStudentLabs(d.studentLabs || []);
          store.setVmRequests(vmData.requests || []);
        }).catch(() => { });
      } else if (role === 'instructor') {
        Promise.all([
          fetch('/api/data').then(r => r.json()),
          fetch('/api/vm-requests').then(r => r.json()),
        ]).then(([d, vmData]) => {
          store.setStudents(d.students || []);
          store.setColumns(d.columns || []);
          store.setGrades(d.grades || []);
          store.setAttendance(d.attendance || []);
          store.setStudentLabs(d.studentLabs || []);
          store.setInstructors(d.instructors || []);
          store.setVmRequests(vmData.requests || []);
        }).catch(() => { });
        fetch('/api/messages/unread-count').then(r => r.json()).then(d => {
          store.setUnreadMessageCount(d.count || 0);
        }).catch(() => { });
      }
    };

    handleRouting();

    window.addEventListener('popstate', handleRouting);
    return () => window.removeEventListener('popstate', handleRouting);
  }, []);

  const ViewComponent = VIEW_COMPONENTS[currentView] || StudentLoginView;

  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const isAuth = auth.role === 'student' || auth.role === 'admin' || auth.role === 'instructor';

  // Global keyboard shortcut: ? to open shortcuts dialog
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === '?' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        setShortcutsOpen(true);
        return;
      }

      // Role-based navigation shortcuts
      const role = auth.role;
      if (role === 'student') {
        switch (e.key.toLowerCase()) {
          case 'g': setView('student-grades'); break;
          case 'v': setView('student-vms'); break;
          case 'a': setView('student-attendance'); break;
          case 'h': setView('student-choice'); break;
        }
      } else if (role === 'instructor') {
        switch (e.key.toLowerCase()) {
          case 's': setView('instructor-grades'); break;
          case 'a': setView('instructor-attendance'); break;
          case 'v': setView('instructor-vms'); break;
          case 'm': setView('instructor-announcements'); break;
          case 'e': setView('instructor-exams'); break;
          case 'd': setView('instructor-panel'); break;
        }
      } else if (role === 'admin') {
        switch (e.key.toLowerCase()) {
          case 'v': setView('admin-vm-monitor'); break;
          case 'u': setView('admin-panel'); break;
          case 'b': setView('admin-backups'); break;
          {/*case 'l': setView('admin-audit'); break;*/}
          case 'd': setView('admin-panel'); break;
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [auth.role, setView]);

  const [mobileNavOpen, setMobileNavOpen] = React.useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Track sidebar offset for fixed sidebar positioning
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    const check = () => setIsDesktop(window.innerWidth >= 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // Prevent SSR/hydration mismatch — sidebar depends on client-only auth state
  if (!mounted) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'hsl(var(--background))' }}>
        <div style={{ height: 32, width: 32, borderRadius: '50%', border: '4px solid hsl(var(--muted))', borderTopColor: 'hsl(var(--primary))', animation: 'spin 1s linear infinite' }} />
      </div>
    );
  }

  // Sidebar offset: on desktop when authenticated, the content needs marginLeft
  const sidebarOffset = isAuth && isDesktop ? (sidebarCollapsed ? SIDEBAR_COLLAPSED : SIDEBAR_FULL) : 0;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'hsl(var(--background))', overflow: 'hidden' }}>
      <ImpersonationBanner />

      {isAuth ? (
        <>
          {/* Sidebar: position:fixed, renders itself */}
          <AppSidebar
            mobileOpen={mobileNavOpen}
            onMobileClose={() => setMobileNavOpen(false)}
            collapsed={sidebarCollapsed}
            onCollapsedChange={setSidebarCollapsed}
          />

          {/* Content area: offset by sidebar width on desktop */}
          <div style={{ marginLeft: sidebarOffset, flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, transition: 'margin-left 0.2s ease' }}>
            <LabHeader
              mobileNavOpen={mobileNavOpen}
              onMobileNavToggle={() => setMobileNavOpen(v => !v)}
            />
            <main style={{ flex: 1, position: 'relative', zIndex: 10, overflowY: 'auto' }} key={currentView}>
              <ErrorBoundary>
                <ViewComponent />
              </ErrorBoundary>
            </main>
            <LabFooter />
          </div>
        </>
      ) : (
        /* ── Unauthenticated: plain stack, no sidebar ── */
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
          <LabHeader
            mobileNavOpen={false}
            onMobileNavToggle={() => {}}
          />
          <main style={{ flex: 1, position: 'relative', zIndex: 10 }} key={currentView}>
            <ErrorBoundary>
              <ViewComponent />
            </ErrorBoundary>
          </main>
          <LabFooter />
        </div>
      )}
      {/* Global Floating Keyboard Shortcuts Button - visible for all authenticated users */}
      {isAuth && (
        <>
          <button
            onClick={() => setShortcutsOpen(true)}
            style={{
              position: 'fixed', bottom: 24, right: 24, zIndex: 50,
              display: 'flex', height: 44, width: 44, alignItems: 'center', justifyContent: 'center',
              borderRadius: '50%', background: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))', boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
              cursor: 'pointer', transition: 'all 0.15s',
            }}
            aria-label="Keyboard shortcuts"
            title="Keyboard shortcuts (?)"
          >
            <Keyboard className="h-4 w-4 text-muted-foreground" />
          </button>
          <ShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} role={auth.role} />
        </>
      )}
    </div>
  );
}
