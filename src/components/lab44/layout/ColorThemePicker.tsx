'use client';

import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Palette, Check } from 'lucide-react';
import { type ColorTheme, useColorTheme } from './useColorTheme';

/* ── Theme catalogue ─────────────────────────────────────────────────────── */
/**
 * swatches: [bg, accent, highlight] shown as a three-strip mini-preview.
 * All colours are explicit hex values — NOT CSS variables — so the
 * swatches look correct regardless of which active theme the picker is
 * currently rendered inside.
 */
const THEMES: {
  id: ColorTheme;
  label: string;
  description: string;
  swatches: [string, string, string];
}[] = [
  {
    id: 'default',
    label: 'Default',
    description: 'The original theme',
    swatches: ['#1a1a1a', '#737373', '#f5f5f5'],
  },
  {
    id: 'nord',
    label: 'Nord',
    description: 'Arctic, north-bluish color palette',
    swatches: ['#2E3440', '#88C0D0', '#ECEFF4'],
  },
  {
    id: 'solarized',
    label: 'Solarized',
    description: 'Precision colors for reduced eye strain',
    swatches: ['#002B36', '#268BD2', '#FDF6E3'],
  },
  {
    id: 'dracula',
    label: 'Dracula',
    description: 'Dark theme with vibrant colors',
    swatches: ['#282A36', '#BD93F9', '#FF79C6'],
  },
  {
    id: 'monokai',
    label: 'Monokai',
    description: 'Colorful theme from code editors',
    swatches: ['#272822', '#A6E22E', '#66D9E8'],
  },
  {
    id: 'catppuccin',
    label: 'Catppuccin',
    description: 'Soothing pastel palette',
    swatches: ['#1e1e2e', '#cba6f7', '#89b4fa'],
  },
  {
    id: 'gruvbox',
    label: 'Gruvbox',
    description: 'Retro groove with earthy tones',
    swatches: ['#282828', '#83a598', '#ebdbb2'],
  },
  {
    id: 'tokyo-night',
    label: 'Tokyo Night',
    description: 'Deep blue vibes of Tokyo after dark',
    swatches: ['#1f2335', '#7aa2f7', '#bb9af7'],
  },
  {
    id: 'rose-pine',
    label: 'Rosé Pine',
    description: 'Elegant, botanical rose palette',
    swatches: ['#191724', '#c4a7e7', '#ebbcba'],
  },
  {
    id: 'ayu',
    label: 'Ayu',
    description: 'Clean, warm tones for focus',
    swatches: ['#0f1419', '#ff8f40', '#39bae6'],
  },
];

/* ── Component ───────────────────────────────────────────────────────────── */
export function ColorThemePicker({ collapsed }: { collapsed?: boolean }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const { colorTheme, setColorTheme } = useColorTheme();

  const isActive = colorTheme !== 'default';

  /* ── Position popup relative to the trigger button ── */
  const openPicker = () => {
    if (!btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    const POPUP_H = 480; /* max height (scrollable) */
    const POPUP_W = 256;
    const top = Math.max(
      8,
      Math.min(
        rect.bottom - POPUP_H,       /* prefer flush with button bottom */
        window.innerHeight - POPUP_H - 8,
      ),
    );
    const left = Math.min(rect.right + 8, window.innerWidth - POPUP_W - 8);
    setPos({ top: Math.max(8, top), left });
    setOpen(true);
  };

  return (
    <div style={{ position: 'relative' }}>

      {/* ── Trigger button ── */}
      <button
        ref={btnRef}
        onClick={openPicker}
        aria-label="Switch color theme"
        style={{
          width: 32,
          height: 32,
          borderRadius: 6,
          border: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          background: 'transparent',
          color: isActive ? 'var(--primary)' : 'var(--muted-foreground)',
          transition: 'background 0.12s, color 0.12s',
          position: 'relative',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.background = 'var(--muted)';
          if (!isActive) e.currentTarget.style.color = 'var(--foreground)';
        }}
        onMouseLeave={e => {
          e.currentTarget.style.background = 'transparent';
          if (!isActive) e.currentTarget.style.color = 'var(--muted-foreground)';
        }}
      >
        <Palette size={15} />
        {/* Dot badge when a non-default theme is active */}
        {isActive && (
          <span style={{
            position: 'absolute',
            bottom: 4,
            right: 4,
            width: 5,
            height: 5,
            borderRadius: '50%',
            background: 'var(--primary)',
            border: '1.5px solid var(--card)',
          }} />
        )}
      </button>

      {/* ── Dropdown popup via portal ── */}
      {open && typeof window !== 'undefined' && createPortal(
        <>
          {/* Click-away backdrop — invisible, full-screen */}
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 9990 }}
            onClick={() => setOpen(false)}
          />

          {/* Popup card
              KEY FIX: background uses var(--popover) directly — NOT hsl(var(...)).
              When CSS vars hold oklch() values, wrapping in hsl() produces an
              invalid expression that browsers silently discard, leaving the
              background transparent. Using var() directly avoids that entirely. */}
          <div
            role="menu"
            aria-label="Color theme selector"
            style={{
              position: 'fixed',
              top: pos.top,
              left: pos.left,
              zIndex: 9991,
              width: 256,
              borderRadius: 14,
              /* ↓ SOLID background — the transparency bug fix */
              background: 'var(--popover)',
              border: '1px solid var(--border)',
              boxShadow: '0 12px 40px rgba(0,0,0,0.22), 0 2px 8px rgba(0,0,0,0.12)',
              overflow: 'hidden',
            }}
          >
            {/* Header */}
            <div style={{
              padding: '10px 12px 6px',
              borderBottom: '1px solid var(--border)',
            }}>
              <p style={{
                margin: 0,
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: '0.10em',
                textTransform: 'uppercase',
                color: 'var(--muted-foreground)',
              }}>
                Color Theme
              </p>
            </div>

            {/* Scrollable theme list */}
            <div style={{
              overflowY: 'auto',
              maxHeight: 420,
              padding: '4px',
            }}>
              {THEMES.map(theme => {
                const selected = colorTheme === theme.id;
                return (
                  <button
                    key={theme.id}
                    role="menuitem"
                    onClick={() => { setColorTheme(theme.id); setOpen(false); }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      width: '100%',
                      padding: '7px 8px',
                      borderRadius: 9,
                      border: 'none',
                      cursor: 'pointer',
                      textAlign: 'left',
                      /* Solid background — no opacity trick needed */
                      background: selected ? 'var(--secondary)' : 'transparent',
                      transition: 'background 0.1s',
                    }}
                    onMouseEnter={e => {
                      if (!selected)
                        (e.currentTarget as HTMLElement).style.background = 'var(--muted)';
                    }}
                    onMouseLeave={e => {
                      if (!selected)
                        (e.currentTarget as HTMLElement).style.background = 'transparent';
                    }}
                  >
                    {/* Three-strip color swatch */}
                    <div style={{
                      display: 'flex',
                      flexShrink: 0,
                      width: 38,
                      height: 24,
                      borderRadius: 6,
                      overflow: 'hidden',
                      outline: '1px solid rgba(0,0,0,0.15)',
                      outlineOffset: '-1px',
                    }}>
                      {theme.swatches.map((color, i) => (
                        <div key={i} style={{ flex: 1, background: color }} />
                      ))}
                    </div>

                    {/* Label + description */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{
                        margin: 0,
                        fontSize: 13,
                        fontWeight: selected ? 600 : 500,
                        color: 'var(--foreground)',
                        lineHeight: 1.3,
                      }}>
                        {theme.label}
                      </p>
                      <p style={{
                        margin: 0,
                        fontSize: 11,
                        color: 'var(--muted-foreground)',
                        lineHeight: 1.3,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}>
                        {theme.description}
                      </p>
                    </div>

                    {/* Active checkmark */}
                    {selected && (
                      <Check
                        size={14}
                        style={{ color: 'var(--primary)', flexShrink: 0 }}
                      />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Footer note */}
            <div style={{
              padding: '6px 12px 8px',
              borderTop: '1px solid var(--border)',
            }}>
              <p style={{
                margin: 0,
                fontSize: 10,
                color: 'var(--muted-foreground)',
              }}>
                Works with light & dark mode ✦
              </p>
            </div>
          </div>
        </>,
        document.body,
      )}
    </div>
  );
}
