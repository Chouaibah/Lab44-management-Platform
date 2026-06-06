export interface Student {
  id: number;
  firstName: string;
  lastName: string;
  studentId: string;
  createdAt: string;
  notes: string | null;
  labIds: number[];
}

export interface GradeColumn {
  id: number;
  name: string;
  weight: number;
  labId: number;
  labName?: string;
  createdAt: string;
}

export interface Grade {
  studentId: number;
  columnId: number;
  value: number | null;
}

export interface Setting {
  key: string;
  value: string;
}

export interface VMRequest {
  id: number;
  studentDbId: number;
  studentName: string;
  studentId: string;
  templateUuid: string | null;
  templateName: string | null;
  status: "pending" | "approved" | "rejected";
  note: string | null;
  vmUuid: string | null;
  vmName: string | null;
  vmIp: string | null;
  accessProtocol: string | null;
  guacUsername: string | null;
  guacConnectionId: string | null;
  requestedAt: string;
  reviewedAt: string | null;
}

export interface AnnouncementReaction {
  id: number;
  announcementId: number;
  studentId: number;
  reaction: "acknowledged" | "seen" | "thumbs_up" | "thumbs_down" | "question";
  createdAt: string;
  student?: Student;
}

export interface Announcement {
  id: number;
  title: string;
  content: string;
  author: string;
  category: string;
  pinned: boolean;
  showFrom: string | null;
  showUntil: string | null;
  labId: number | null;
  createdAt: string;
  reactions?: AnnouncementReaction[];
  reactionCounts?: Record<string, number>;
  userReaction?: string | null;
}

export interface Attendance {
  id: number;
  studentId: number;
  labId: number;
  date: string;
  status: "present" | "absent" | "late" | "excused";
  note: string | null;
  markedBy: number | null;
}

export interface GradesData {
  students: Student[];
  columns: GradeColumn[];
  grades: Grade[];
}

export interface Lab {
  id: number;
  name: string;
  description?: string | null;
  level?: string | null;
  hasPassword?: boolean;
  createdAt: string;
  instructorCount?: number;
  studentCount?: number;
}

export interface StudentLab {
  studentId: number;
  labId: number;
  joinedAt: string;
}

export interface Instructor {
  id: number;
  username: string;
  displayName: string;
  email?: string | null;
  labId: number;
  labIds?: number[];  // All labs this instructor is assigned to
  labName?: string;
  showGrades: boolean;
  createdAt: string;
}

export interface XCPNGTemplate {
  uuid: string;
  name: string;
  description?: string;
  isDefaultTemplate?: boolean;
  VCPUsMax?: number;
  memoryStaticMax?: number;
}

// ─── SousGroupe & Binome Types ────────────────────────────────────────────────

export interface SousGroupe {
  id: number;
  name: string;
  labId: number;
  createdAt: string;
  updatedAt: string;
  members: SousGroupeMember[];
  binomes: Binome[];
}

export interface SousGroupeMember {
  id: number;
  sousGroupeId: number;
  studentId: number;
  student?: Student;
}

export interface Binome {
  id: number;
  sousGroupeId: number;
  student1Id: number;
  student2Id: number | null;
  student1?: Student;
  student2?: Student | null;
}

export interface LabDocument {
  id: number;
  title: string;
  description: string | null;
  filePath: string;
  fileType: string;
  labId: number;
  visibleToStudents: boolean;
  createdAt: string;
}

export type AppView =
  | "student-login"
  | "student-register"
  | "student-choice"
  | "student-grades"
  | "student-vms"
  | "student-vm-picker"
  | "student-attendance"
  | "student-profile"
  | "student-messages"
  | "admin-login"
  | "admin-panel"
  | "admin-vm-monitor"
  | "admin-announcements"
  | "admin-attendance"
  | "admin-settings"
  | "admin-audit"
  | "admin-instructors"
  | "admin-labs"
  | "instructor-login"
  | "instructor-panel"
  | "instructor-grades"
  | "instructor-announcements"
  | "instructor-attendance-report"
  | "instructor-attendance"
  | "instructor-vms"
  | "instructor-messages"
  | "instructor-exams"
  | "student-exams"
  | "student-exam-taking"
  | "admin-backups";

export interface Notification {
  id: number;
  type: "grade" | "announcement" | "vm" | "attendance" | "system";
  title: string;
  message: string;
  userId: number;
  userRole: string;
  read: boolean;
  labId: number | null;
  link: string | null;
  createdAt: string;
}

export interface ResourceLink {
  id: number;
  title: string;
  url: string;
  description: string | null;
  category: "general" | "documentation" | "tutorial" | "tool" | "reference" | "video";
  labId: number;
  addedBy: string | null;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  id: number;
  senderId: number;
  senderRole: "student" | "instructor" | "admin";
  receiverId: number;
  receiverRole: "student" | "instructor" | "admin";
  labId: number | null;
  content: string;
  read: boolean;
  createdAt: string;
  senderName?: string;
  receiverName?: string;
}

export interface Conversation {
  userId: number;
  userRole: string;
  userName: string;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
}

export interface AuthState {
  role: "student" | "admin" | "instructor" | null;
  student: Student | null;
  instructor?: Instructor | null;
  isImpersonating?: boolean;
  originalRole?: string;
  originalUserId?: number;
  labIds?: number[];  // For instructors: all assigned lab IDs
}

// ─── Exam Mode Types ────────────────────────────────────────────────────────

export interface ExamQuestion {
  id: number;
  examId: number;
  type: "mcq" | "true_false" | "short_answer";
  text: string;
  options: string[] | null; // JSON array for MCQ
  correctAnswer: string | null;
  points: number;
  order: number;
}

export interface Exam {
  id: number;
  title: string;
  description: string | null;
  labId: number;
  instructorId: number;
  status: "draft" | "published" | "active" | "closed";
  durationMinutes: number;
  shuffleQuestions: boolean;
  showResults: "immediate" | "manual";
  maxAttempts: number;
  passingScore: number | null;
  sousGroupeId: number | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  questions?: ExamQuestion[];
  attemptCount?: number;
  averageScore?: number | null;
}

export interface ExamAttempt {
  id: number;
  examId: number;
  studentId: number;
  attemptNumber: number;
  startedAt: string;
  submittedAt: string | null;
  timeSpent: number | null;
  score: number | null;
  totalPoints: number | null;
  maxPoints: number | null;
  passed: boolean | null;
  answers?: ExamAnswer[];
  student?: { id: number; firstName: string; lastName: string; studentId: string };
}

export interface ExamAnswer {
  id: number;
  attemptId: number;
  questionId: number;
  answer: string | null;
  pointsEarned: number | null;
  question?: ExamQuestion;
}
