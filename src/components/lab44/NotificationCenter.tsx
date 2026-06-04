'use client';

/**
 *
 * Features:
 *  - Bell icon with animated badge in the navbar
 *  - Dropdown panel anchored below the bell, slides down from the top
 *  - Unread items highlighted, click marks as read + navigates if link exists
 *  - Per-item delete on hover
 *  - "Mark all read" in header
 *  - Closes on outside click or Escape
 *  - New real-time notifications animate in at the top of the list
 */

import React, {
  useState, useEffect, useRef, useCallback,
} from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useLab44Store } from '@/store/lab44';
import type { Notification } from '@/types';
import { timeAgo } from '@/lib/helpers';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Bell, BarChart3, Megaphone, Monitor, ClipboardCheck,
  Settings, CheckCheck, Trash2, Loader2, MessageSquare,
} from 'lucide-react';

// ─── Icon helpers ─────────────────────────────────────────────────────────────

const TYPE_CONFIG: Record<string, { icon: React.ElementType; color: string; bg: string; label: string }> = {
  grade:        { icon: BarChart3,      color: 'text-emerald-500', bg: 'bg-emerald-100 dark:bg-emerald-900/40', label: 'Grade' },
  announcement: { icon: Megaphone,      color: 'text-amber-500',   bg: 'bg-amber-100 dark:bg-amber-900/40',   label: 'Announcement' },
  vm:           { icon: Monitor,        color: 'text-violet-500',  bg: 'bg-violet-100 dark:bg-violet-900/40', label: 'VM' },
  attendance:   { icon: ClipboardCheck, color: 'text-cyan-500',    bg: 'bg-cyan-100 dark:bg-cyan-900/40',     label: 'Attendance' },
  system:       { icon: Settings,       color: 'text-rose-500',    bg: 'bg-rose-100 dark:bg-rose-900/40',     label: 'System' },
  message:      { icon: MessageSquare,  color: 'text-blue-500',    bg: 'bg-blue-100 dark:bg-blue-900/40',     label: 'Message' },
};

function getTypeConfig(type: string) {
  return TYPE_CONFIG[type] ?? { icon: Bell, color: 'text-muted-foreground', bg: 'bg-muted', label: type };
}

// ─── Single notification row ──────────────────────────────────────────────────

function NotifRow({
  notif,
  onRead,
  onDelete,
  isNew,
}: {
  notif: Notification;
  onRead: (n: Notification) => void;
  onDelete: (e: React.MouseEvent, id: number) => void;
  isNew?: boolean;
}) {
  const cfg = getTypeConfig(notif.type);
  const Icon = cfg.icon;

  return (
    <motion.div
      layout
      initial={isNew ? { opacity: 0, y: -12, scale: 0.97 } : false}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: 20, scale: 0.95 }}
      transition={{ duration: 0.22, ease: [0.25, 0.1, 0.25, 1] }}
      className={`group relative flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors duration-100 ${
        notif.read
          ? 'hover:bg-muted/40'
          : 'bg-primary/[0.04] hover:bg-primary/[0.07]'
      }`}
      onClick={() => onRead(notif)}
    >
      {/* Unread dot */}
      {!notif.read && (
        <span className="absolute right-4 top-1/2 -translate-y-1/2 h-2 w-2 rounded-full bg-primary" />
      )}

      {/* Type icon */}
      <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${cfg.bg}`}>
        <Icon className={`h-4 w-4 ${cfg.color}`} />
      </div>

      {/* Text */}
      <div className="min-w-0 flex-1 pr-6 overflow-hidden">
        <p className={`text-[13px] leading-snug break-words ${notif.read ? 'text-muted-foreground' : 'text-foreground font-medium'}`}>
          <span className="font-semibold line-clamp-2">{notif.title}</span>
          {notif.message && notif.message !== notif.title && (
            <span className="font-normal"> — {notif.message.length > 60 ? notif.message.slice(0, 60) + '…' : notif.message}</span>
          )}
        </p>
        <p className={`text-[11px] mt-0.5 ${notif.read ? 'text-muted-foreground/60' : 'text-primary'}`}>
          {timeAgo(notif.createdAt)}
        </p>
      </div>

      {/* Delete button (hover only) */}
      <button
        className="absolute right-3 top-3 opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground hover:text-foreground"
        onClick={(e) => onDelete(e, notif.id)}
        title="Dismiss"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </motion.div>
  );
}

// ─── Bell button ──────────────────────────────────────────────────────────────

interface NotificationCenterProps {
  /** Tailwind class for the badge colour, e.g. 'bg-emerald-500' */
  badgeClassName?: string;
}

export function NotificationCenter({ badgeClassName = 'bg-primary' }: NotificationCenterProps) {
  const { auth, notifications, setNotifications, markNotificationRead, setView } = useLab44Store();

  const [open, setOpen]       = useState(false);
  const [loading, setLoading] = useState(false);
  const [newIds, setNewIds]   = useState<Set<number>>(new Set());

  const bellRef      = useRef<HTMLButtonElement>(null);
  const dropdownRef  = useRef<HTMLDivElement>(null);
  const prevCountRef = useRef(notifications.length);

  const unreadCount = notifications.filter((n) => !n.read).length;

  // ── API helpers ─────────────────────────────────────────────────────────────

  const fetchNotifications = useCallback(async () => {
    if (!auth.role) return;
    setLoading(true);
    try {
      const res = await fetch('/api/notifications');
      if (res.ok) {
        const data: Notification[] = await res.json();
        setNotifications(data);
      }
    } catch { /* silent */ } finally {
      setLoading(false);
    }
  }, [auth.role, setNotifications]);

  useEffect(() => {
    if (auth.role) fetchNotifications();
  }, [auth.role, fetchNotifications]);

  // Highlight newly arriving real-time notifications
  useEffect(() => {
    if (notifications.length > prevCountRef.current) {
      const incoming = notifications.slice(0, notifications.length - prevCountRef.current);
      setNewIds(new Set(incoming.map((n) => n.id)));
      const t = setTimeout(() => setNewIds(new Set()), 3000);
      return () => clearTimeout(t);
    }
    prevCountRef.current = notifications.length;
  }, [notifications]);

  // ── Click-outside / Escape ──────────────────────────────────────────────────

  useEffect(() => {
    if (!open) return;

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const handleClick = (e: MouseEvent) => {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
        bellRef.current    && !bellRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };

    document.addEventListener('keydown', handleKey);
    document.addEventListener('mousedown', handleClick);
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.removeEventListener('mousedown', handleClick);
    };
  }, [open]);

  // ── Action handlers ─────────────────────────────────────────────────────────

  const handleRead = async (notif: Notification) => {
    if (!notif.read) {
      fetch(`/api/notifications/${notif.id}`, { method: 'PATCH' }).catch(() => {});
      markNotificationRead(notif.id);
    }
    if (notif.link) {
      setView(notif.link as any);
      setOpen(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    setNotifications(notifications.filter((n) => n.id !== id));
    fetch(`/api/notifications/${id}`, { method: 'DELETE' }).catch(() => {});
  };

  const handleMarkAllRead = async () => {
    setNotifications(notifications.map((n) => ({ ...n, read: true })));
    fetch('/api/notifications/mark-all-read', { method: 'POST' }).catch(() => {});
  };

  // ── Dropdown position ───────────────────────────────────────────────────────

  const [dropdownPos, setDropdownPos] = useState<{
    left: number;
    bottom?: number;  // used when opening upward
    top?: number;     // used when opening downward
  } | null>(null);

  useEffect(() => {
    if (open && bellRef.current) {
      const calcPos = () => {
        if (!bellRef.current) return;
        const rect = bellRef.current.getBoundingClientRect();
        const spaceBelow = window.innerHeight - rect.bottom - 8;

        let left = rect.left;
        const DROPDOWN_W = 380;
        if (left + DROPDOWN_W > window.innerWidth - 8) {
          left = window.innerWidth - DROPDOWN_W - 8;
        }

        if (spaceBelow >= 300) {
          setDropdownPos({ left, top: rect.bottom + 8 });
        } else {
          setDropdownPos({ left, bottom: window.innerHeight - rect.top + 8 });
        }
      };

      calcPos();
      window.addEventListener('resize', calcPos);
      return () => window.removeEventListener('resize', calcPos);
    }
  }, [open]);

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Bell button */}
      <button
        ref={bellRef}
        onClick={() => {
          setOpen((v) => !v);
          if (!open) fetchNotifications();
        }}
        className="relative h-8 w-8 flex items-center justify-center rounded-lg hover:bg-muted/60 transition-colors"
        aria-label="Notifications"
      >
        <Bell className={`h-4 w-4 transition-transform duration-200 ${open ? 'scale-110' : ''}`} />

        <AnimatePresence>
          {unreadCount > 0 && (
            <motion.span
              key="badge"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              transition={{ type: 'spring', stiffness: 500, damping: 28 }}
              className={`absolute -top-1 -right-1 flex h-4 w-4 min-w-4 items-center justify-center rounded-full text-[9px] font-bold text-white leading-none ${badgeClassName}`}
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </motion.span>
          )}
        </AnimatePresence>
      </button>

      {/* Dropdown — portalled to body so it's never clipped by overflow:hidden parents */}
      {typeof window !== 'undefined' && createPortal(
        <AnimatePresence>
          {open && dropdownPos && (
            <motion.div
              ref={dropdownRef}
              key="notif-dropdown"
              initial={{ opacity: 0, y: dropdownPos.bottom !== undefined ? 8 : -8, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: dropdownPos.bottom !== undefined ? 8 : -8, scale: 0.97 }}
              transition={{ duration: 0.18, ease: [0.25, 0.1, 0.25, 1] }}
              style={{
                position: 'fixed',
                left: dropdownPos.left,
                ...(dropdownPos.top !== undefined
                  ? { top: dropdownPos.top, transformOrigin: 'top left' }
                  : { bottom: dropdownPos.bottom, transformOrigin: 'bottom left' }),
                zIndex: 9999,
              }}
              className="w-[380px] max-w-[calc(100vw-1rem)] bg-popover border border-border/70 rounded-2xl shadow-2xl overflow-hidden"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-border/50">
                <div className="flex items-center gap-2">
                  <h2 className="text-[15px] font-bold text-foreground">Notifications</h2>
                  {unreadCount > 0 && (
                    <span className={`inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full text-[10px] font-bold text-white ${badgeClassName}`}>
                      {unreadCount}
                    </span>
                  )}
                </div>
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllRead}
                    className="flex items-center gap-1 text-[12px] font-medium text-primary hover:text-primary/80 transition-colors"
                  >
                    <CheckCheck className="h-3.5 w-3.5" />
                    Mark all read
                  </button>
                )}
              </div>

              {/* Tabs: All / Unread */}
              <NotifTabs
                notifications={notifications}
                loading={loading}
                newIds={newIds}
                onRead={handleRead}
                onDelete={handleDelete}
              />

              {/* Footer */}
              <div className="border-t border-border/50 px-4 py-2.5 flex items-center justify-center">
                <button
                  onClick={fetchNotifications}
                  className="text-[12px] text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5"
                >
                  {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                  Refresh
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  );
}

// ─── Tabs: All / Unread ───────────────────────────────────────────────────────

function NotifTabs({
  notifications, loading, newIds, onRead, onDelete,
}: {
  notifications: Notification[];
  loading: boolean;
  newIds: Set<number>;
  onRead: (n: Notification) => void;
  onDelete: (e: React.MouseEvent, id: number) => void;
}) {
  const [tab, setTab] = useState<'all' | 'unread'>('all');

  const shown = tab === 'unread'
    ? notifications.filter((n) => !n.read)
    : notifications;

  return (
    <div className="flex flex-col">
      {/* Tab pills */}
      <div className="flex gap-1 px-4 pt-2 pb-1">
        {(['all', 'unread'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-1 rounded-full text-[12px] font-medium transition-colors ${
              tab === t
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
            }`}
          >
            {t === 'all' ? 'All' : 'Unread'}
            {t === 'unread' && notifications.filter((n) => !n.read).length > 0 && (
              <span className="ml-1 opacity-80">({notifications.filter((n) => !n.read).length})</span>
            )}
          </button>
        ))}
      </div>

      {/* List */}
      <ScrollArea className="max-h-[420px]">
        {loading && shown.length === 0 ? (
          <div className="flex items-center justify-center py-14">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : shown.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 text-center">
            <Bell className="h-9 w-9 text-muted-foreground/20 mb-3" />
            <p className="text-sm text-muted-foreground font-medium">
              {tab === 'unread' ? 'You are all caught up!' : 'No notifications yet'}
            </p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              Grade updates and announcements appear here
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border/30">
            <AnimatePresence initial={false}>
              {shown.map((notif) => (
                <NotifRow
                  key={notif.id}
                  notif={notif}
                  isNew={newIds.has(notif.id)}
                  onRead={onRead}
                  onDelete={onDelete}
                />
              ))}
            </AnimatePresence>
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
