'use client';

import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useLab44Store } from '@/store/lab44';
import type { Notification } from '@/types';

/**
 * Get a cookie value by name from document.cookie.
 */
function getCookie(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined;
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
  return match ? match[2] : undefined;
}

/**
 * React hook that connects to the real-time WebSocket service
 * and listens for events like grade updates, announcements,
 * attendance changes, VM status changes, and messages.
 *
 * The hook automatically joins the appropriate rooms based on
 * the authenticated user's role (admin/instructor/student).
 *
 * Only activates when a user is logged in (auth.role is set).
 */
export function useRealtime() {
  const socketRef = useRef<Socket | null>(null);
  const auth = useLab44Store((s) => s.auth);
  const pushActivityLog = useLab44Store((s) => s.pushActivityLog);
  const addNotification = useLab44Store((s) => s.addNotification);
  const setUnreadMessageCount = useLab44Store((s) => s.setUnreadMessageCount);

  useEffect(() => {
    if (!auth.role) return;

    const token = getCookie('lab44_session');

    const socket = io('/?XTransformPort=3003', {
      auth: { token },
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
    });

    socket.on('connect', () => {
      // Join role-based rooms
      if (auth.role === 'admin') {
        socket.emit('join', { room: 'admin' });
      } else if (auth.role === 'instructor' && auth.instructor) {
        socket.emit('join', { room: `instructor:${auth.instructor.id}` });
        if (auth.instructor.labId) {
          socket.emit('join', { room: `lab:${auth.instructor.labId}` });
        }
      } else if (auth.role === 'student' && auth.student) {
        socket.emit('join', { room: `student:${auth.student.id}` });
      }
    });

    socket.on('notification', (data: { type: string; message: string } & Partial<Notification>) => {
      pushActivityLog(data.type || 'info', data.message);
      // If this is a full notification object (from grade broadcast), add to store
      if (data.id && data.title && data.userId) {
        addNotification(data as unknown as Notification);
      }
      // If this is a message notification, increment unread count
      if ((data as { type: string }).type === 'message') {
        setUnreadMessageCount(useLab44Store.getState().unreadMessageCount + 1);
      }
    });

    socket.on('grade-updated', (data: { columnId: number; studentIds: number[]; labId: number }) => {
      pushActivityLog('grade', `Grades updated for column ${data.columnId}`);
    });

    socket.on('announcement-new', (data: { title: string; content: string }) => {
      pushActivityLog('announcement', `New announcement: ${data.title}`);
    });

    socket.on('attendance-updated', (data: { labId: number; date: string }) => {
      pushActivityLog('attendance', `Attendance updated for lab ${data.labId}`);
    });

    socket.on('vm-status-changed', (data: { requestId: number; status: string; studentDbId?: number }) => {
      pushActivityLog('vm', `VM request ${data.requestId} status: ${data.status}`);
      // Refresh VM requests list so the student sees the updated status immediately
      const store = useLab44Store.getState();
      const currentAuth = store.auth;
      if (currentAuth.role === 'student' && currentAuth.student) {
        fetch(`/api/vm-requests?studentDbId=${currentAuth.student.id}`)
          .then(r => r.json())
          .then(d => store.setVmRequests(d.requests || []))
          .catch(() => {});
      } else if (currentAuth.role === 'admin' || currentAuth.role === 'instructor') {
        fetch('/api/vm-requests')
          .then(r => r.json())
          .then(d => store.setVmRequests(d.requests || []))
          .catch(() => {});
      }
    });

    socket.on('session-opened', (data: { labId: number }) => {
      pushActivityLog('attendance', `Attendance session opened for lab ${data.labId}`);
    });

    socket.on('session-closed', (data: { labId: number }) => {
      pushActivityLog('attendance', `Attendance session closed for lab ${data.labId}`);
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [auth.role, auth.student?.id, auth.instructor?.id, pushActivityLog, addNotification, setUnreadMessageCount]);

  return socketRef;
}
