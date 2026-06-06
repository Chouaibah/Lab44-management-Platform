import type { AppView } from '@/types';
import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard, FlaskConical, Users, Monitor, Database,
  History, Cog, BarChart3, Megaphone, ClipboardCheck,
  BookOpen, MessageSquare,
} from 'lucide-react';

export interface NavItem {
  view: AppView;
  icon: LucideIcon;
  label: string;
}

export const ADMIN_NAV: NavItem[] = [
  { view: 'admin-panel',        icon: LayoutDashboard, label: 'Panel'       },
  { view: 'admin-labs',         icon: FlaskConical,    label: 'Labs'        },
  { view: 'admin-instructors',  icon: Users,           label: 'Instructors' },
  { view: 'admin-vm-monitor',   icon: Monitor,         label: 'VMs'         },
  { view: 'admin-backups',      icon: Database,        label: 'Backups'     },
  { view: 'admin-settings',     icon: Cog,             label: 'Settings'    },
];

export const INSTRUCTOR_NAV: NavItem[] = [
  { view: 'instructor-panel',         icon: LayoutDashboard, label: 'Dashboard'  },
  { view: 'instructor-grades',        icon: BarChart3,       label: 'Students'   },
  { view: 'instructor-announcements', icon: Megaphone,       label: 'Announcements'   },
  { view: 'instructor-attendance',    icon: ClipboardCheck,  label: 'Attendance' },
  { view: 'instructor-vms',           icon: Monitor,         label: 'VMs'        },
  { view: 'instructor-exams',         icon: ClipboardCheck,  label: 'Exams'      },
  { view: 'instructor-messages',      icon: MessageSquare,   label: 'Messages'   },
];

export const STUDENT_NAV: NavItem[] = [
  { view: 'student-choice',         icon: LayoutDashboard, label: 'Home'         },
  { view: 'student-announcements',  icon: Megaphone,       label: 'Announcements' },
  { view: 'student-grades',         icon: BarChart3,       label: 'Grades'       },
  { view: 'student-exams',          icon: BookOpen,        label: 'Exams'        },
  { view: 'student-vms',            icon: Monitor,         label: 'VMs'          },
  { view: 'student-attendance',     icon: ClipboardCheck,  label: 'Attendance'   },
  { view: 'student-messages',       icon: MessageSquare,   label: 'Messages'     },
];
