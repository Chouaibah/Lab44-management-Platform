'use client';

import React, { useEffect } from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';

export function ThemeToggle() {
  const { setTheme, resolvedTheme } = useTheme();

  useEffect(() => {
    try {
      const saved = localStorage.getItem('lab44-theme-pref');
      if (saved === 'dark' || saved === 'light') setTheme(saved);
    } catch { /* ignore */ }
  }, [setTheme]);

  if (!resolvedTheme) return <div className="h-8 w-8" />;

  const toggle = () => {
    const next = resolvedTheme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    try { localStorage.setItem('lab44-theme-pref', next); } catch { /* ignore */ }
  };

  return (
    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={toggle} aria-label="Toggle theme">
      {resolvedTheme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  );
}
