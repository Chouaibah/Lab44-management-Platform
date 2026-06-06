'use client';

import { useEffect, useRef, useState } from 'react';
import type { Notification } from '@/types';

// ─── Scroll Progress ─────────────────────────────────────────────────────────
// Fixes the original bug: the element's width was never updated (CSS var was set
// on :root but the inline style stayed at '0%'). Now we write directly to the element.

export function useScrollProgress() {
  useEffect(() => {
    const bar = document.getElementById('scroll-progress-bar');
    const onScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = document.documentElement;
      const max = scrollHeight - clientHeight;
      const pct = max > 0 ? (scrollTop / max) * 100 : 0;
      if (bar) bar.style.width = `${pct}%`;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
}

// ─── Notification Poller ──────────────────────────────────────────────────────

export function useNotificationPoller(
  isAuth: boolean,
  setNotifications: (n: Notification[]) => void,
) {
  useEffect(() => {
    if (!isAuth) return;
    const poll = async () => {
      try {
        const res = await fetch('/api/notifications');
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) setNotifications(data);
        }
      } catch { /* network error — silently ignore */ }
    };
    poll();
    const id = setInterval(poll, 30_000);
    return () => clearInterval(id);
  }, [isAuth, setNotifications]);
}

// ─── Announcement Sound ───────────────────────────────────────────────────────

let audioCtx: AudioContext | null = null;

function playNotificationSound() {
  try {
    if (!audioCtx) audioCtx = new AudioContext();
    const ctx = audioCtx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.setValueAtTime(1108.73, ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.4);
  } catch { /* audio not available */ }
}

export function useAnnouncementSound(
  announcementCount: number,
  isStudent: boolean,
) {
  const [soundEnabled, setSoundEnabled] = useState(() => {
    if (typeof window === 'undefined') return true;
    try { return localStorage.getItem('lab44-notif-sound') !== 'false'; }
    catch { return true; }
  });
  const prevCountRef = useRef(0);

  useEffect(() => {
    if (!isStudent) return;
    if (prevCountRef.current > 0 && announcementCount > prevCountRef.current && soundEnabled) {
      playNotificationSound();
    }
    prevCountRef.current = announcementCount;
  }, [announcementCount, isStudent, soundEnabled]);

  return { soundEnabled, setSoundEnabled };
}
