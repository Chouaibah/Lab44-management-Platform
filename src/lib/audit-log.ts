import { db } from '@/lib/db';

type AuditAction = 'create' | 'update' | 'delete' | 'login' | 'logout' | 'approve' | 'reject' | 'import' | 'export';
type AuditType = 'auth' | 'grade' | 'vm' | 'attendance' | 'announcement' | 'settings' | 'impersonation' | 'data' | 'student';

interface AuditLogInput {
  type: AuditType;
  action: AuditAction;
  message: string;
  userId?: string | number;
  userRole?: string;
  labId?: number;
  metadata?: Record<string, unknown>;
}

export async function logAudit(input: AuditLogInput): Promise<void> {
  try {
    await db.activityLog.create({
      data: {
        type: input.type,
        action: input.action,
        message: input.message,
        userId: input.userId ? String(input.userId) : null,
        userRole: input.userRole || null,
        labId: input.labId || null,
        metadata: input.metadata ? JSON.stringify(input.metadata) : null,
      },
    });
  } catch (error) {
    console.error('Failed to log audit:', error);
  }
}
