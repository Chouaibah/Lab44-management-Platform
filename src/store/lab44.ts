import { create } from "zustand";
import type { AppView, AuthState, Student, GradeColumn, Grade, VMRequest, Announcement, Attendance, Lab, Instructor, StudentLab, SousGroupe, Binome, LabDocument, Notification, ResourceLink, Message, Conversation } from "@/types";

// All valid AppView values for URL validation
const VALID_VIEWS: AppView[] = [
  'student-login', 'student-register', 'student-choice', 'student-grades',
  'student-vms', 'student-vm-picker', 'student-attendance', 'student-profile', 'student-messages',
  'student-exams', 'student-exam-taking',
  'admin-login', 'admin-panel', 'admin-vm-monitor', 'admin-announcements', 'admin-attendance', 'admin-settings', 'admin-audit', 'admin-instructors', 'admin-labs', 'admin-backups',
  'instructor-login', 'instructor-panel', 'instructor-grades', 'instructor-announcements',
  'instructor-attendance', 'instructor-attendance-report', 'instructor-vms', 'instructor-messages',
  'instructor-exams',
];

function viewToUrl(view: AppView): string {
  return view === 'student-login' ? '/' : `/${view}`;
}

function viewToTitle(view: AppView): string {
  if (view === 'student-login') return 'Lab44 — Student Grades & VM Management';
  return `Lab44 — ${view.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}`;
}

export function getViewFromUrl(): AppView | null {
  if (typeof window === 'undefined') return null;
  const path = window.location.pathname;
  const view = path === '/' ? 'student-login' as AppView : path.slice(1) as AppView;
  return VALID_VIEWS.includes(view) ? view : null;
}

interface Lab44Store {
  // Navigation
  currentView: AppView;
  setView: (view: AppView) => void;
  setViewSilent: (view: AppView) => void;

  // Auth
  auth: AuthState;
  setAuth: (auth: AuthState) => void;
  logout: () => void;

  // Student data
  students: Student[];
  setStudents: (students: Student[]) => void;

  // Grade columns
  columns: GradeColumn[];
  setColumns: (columns: GradeColumn[]) => void;

  // Grades
  grades: Grade[];
  setGrades: (grades: Grade[]) => void;
  updateGrade: (studentId: number, columnId: number, value: number | null) => void;

  // VM Requests
  vmRequests: VMRequest[];
  setVmRequests: (requests: VMRequest[]) => void;

  // Announcements
  announcements: Announcement[];
  setAnnouncements: (announcements: Announcement[]) => void;

  // Attendance
  attendance: Attendance[];
  setAttendance: (attendance: Attendance[]) => void;

  // Settings
  signupEnabled: boolean;
  setSignupEnabled: (v: boolean) => void;

  // Labs
  labs: Lab[];
  setLabs: (labs: Lab[]) => void;

  // Instructors
  instructors: Instructor[];
  setInstructors: (instructors: Instructor[]) => void;

  // Student-Lab memberships
  studentLabs: StudentLab[];
  setStudentLabs: (studentLabs: StudentLab[]) => void;

  // Hide grades from students
  hideGradesFromStudents: boolean;
  setHideGradesFromStudents: (v: boolean) => void;

  // Activity Log
  activityLog: { type: string; message: string; timestamp: string }[];
  pushActivityLog: (type: string, message: string) => void;

  // SousGroupes
  sousGroupes: SousGroupe[];
  setSousGroupes: (sousGroupes: SousGroupe[]) => void;

  // Binomes
  binomes: Binome[];
  setBinomes: (binomes: Binome[]) => void;

  // Lab Documents
  labDocuments: LabDocument[];
  setLabDocuments: (docs: LabDocument[]) => void;

  // Notifications
  notifications: Notification[];
  setNotifications: (notifications: Notification[]) => void;
  addNotification: (notification: Notification) => void;
  markNotificationRead: (id: number) => void;
  unreadNotificationCount: () => number;

  // Resource Links
  resourceLinks: ResourceLink[];
  setResourceLinks: (resourceLinks: ResourceLink[]) => void;

  // Messages
  messages: Message[];
  setMessages: (messages: Message[]) => void;
  conversations: Conversation[];
  setConversations: (conversations: Conversation[]) => void;
  unreadMessageCount: number;
  setUnreadMessageCount: (count: number) => void;
  addMessage: (message: Message) => void;

  // Instructor selected lab (for multi-lab support)
  selectedLabId: number | null;
  setSelectedLabId: (id: number | null) => void;
}

export const useLab44Store = create<Lab44Store>((set) => ({
  // Navigation
  currentView: "student-login",
  setView: (view) => {
    set({ currentView: view });
    if (typeof window !== 'undefined') {
      window.history.pushState({ view }, '', viewToUrl(view));
      document.title = viewToTitle(view);
    }
  },
  setViewSilent: (view) => {
    set({ currentView: view });
    if (typeof window !== 'undefined') {
      window.history.replaceState({ view }, '', viewToUrl(view));
      document.title = viewToTitle(view);
    }
  },

  // Auth
  auth: { role: null, student: null },
  setAuth: (auth) => set({ auth }),
  logout: () => {
    set({ auth: { role: null, student: null, instructor: null }, currentView: "student-login" });
    if (typeof window !== 'undefined') {
      window.history.pushState({ view: 'student-login' }, '', '/');
      document.title = viewToTitle('student-login');
    }
  },

  // Students
  students: [],
  setStudents: (students) => set({ students }),

  // Columns
  columns: [],
  setColumns: (columns) => set({ columns }),

  // Grades
  grades: [],
  setGrades: (grades) => set({ grades }),
  updateGrade: (studentId, columnId, value) =>
    set((state) => {
      const filtered = state.grades.filter(
        (g) => !(g.studentId === studentId && g.columnId === columnId)
      );
      if (value !== null) {
        filtered.push({ studentId, columnId, value });
      }
      return { grades: filtered };
    }),

  // VM Requests
  vmRequests: [],
  setVmRequests: (vmRequests) => set({ vmRequests }),

  // Announcements
  announcements: [],
  setAnnouncements: (announcements) => set({ announcements }),

  // Attendance
  attendance: [],
  setAttendance: (attendance) => set({ attendance }),

  // Settings
  signupEnabled: true,
  setSignupEnabled: (signupEnabled) => set({ signupEnabled }),

  // Labs
  labs: [],
  setLabs: (labs) => set({ labs }),

  // Instructors
  instructors: [],
  setInstructors: (instructors) => set({ instructors }),

  // Student-Lab memberships
  studentLabs: [],
  setStudentLabs: (studentLabs) => set({ studentLabs }),

  // Hide grades from students
  hideGradesFromStudents: false,
  setHideGradesFromStudents: (hideGradesFromStudents) => set({ hideGradesFromStudents }),

  // Activity Log
  activityLog: [],
  pushActivityLog: (type, message) => set((state) => ({
    activityLog: [{ type, message, timestamp: new Date().toISOString() }, ...state.activityLog].slice(0, 50),
  })),

  // SousGroupes
  sousGroupes: [],
  setSousGroupes: (sousGroupes) => set({ sousGroupes }),

  // Binomes
  binomes: [],
  setBinomes: (binomes) => set({ binomes }),

  // Lab Documents
  labDocuments: [],
  setLabDocuments: (labDocuments) => set({ labDocuments }),

  // Notifications
  notifications: [],
  setNotifications: (notifications) => set({ notifications }),
  addNotification: (notification) => set((state) => ({
    notifications: [notification, ...state.notifications].slice(0, 50),
  })),
  markNotificationRead: (id) => set((state) => ({
    notifications: state.notifications.map((n) =>
      n.id === id ? { ...n, read: true } : n
    ),
  })),
  unreadNotificationCount: () => {
    const state = useLab44Store.getState();
    return state.notifications.filter((n) => !n.read).length;
  },

  // Resource Links
  resourceLinks: [],
  setResourceLinks: (resourceLinks) => set({ resourceLinks }),

  // Messages
  messages: [],
  setMessages: (messages) => set({ messages }),
  conversations: [],
  setConversations: (conversations) => set({ conversations }),
  unreadMessageCount: 0,
  setUnreadMessageCount: (unreadMessageCount) => set({ unreadMessageCount }),
  addMessage: (message) => set((state) => ({
    messages: [...state.messages, message],
  })),

  // Instructor selected lab
  selectedLabId: null,
  setSelectedLabId: (id) => set({ selectedLabId: id }),
}));
