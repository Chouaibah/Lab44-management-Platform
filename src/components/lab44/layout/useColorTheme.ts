'use client';

import { useState, useEffect, useCallback } from 'react';

export type ColorTheme =
  | 'default'
  | 'nord'
  | 'solarized'
  | 'dracula'
  | 'monokai'
  | 'catppuccin'
  | 'gruvbox'
  | 'tokyo-night'
  | 'rose-pine'
  | 'ayu';

const VALID_THEMES: ColorTheme[] = [
  'default', 'nord', 'solarized', 'dracula', 'monokai',
  'catppuccin', 'gruvbox', 'tokyo-night', 'rose-pine', 'ayu',
];
const STORAGE_KEY = 'lab44-color-theme';

/** Apply / remove the data-color-theme attribute on <html>. */
function applyColorTheme(theme: ColorTheme) {
  if (theme === 'default') {
    document.documentElement.removeAttribute('data-color-theme');
  } else {
    document.documentElement.setAttribute('data-color-theme', theme);
  }
}

/**
 * Manages the user's color-theme preference.
 * Persists the choice per-browser in localStorage and applies it as a
 * `data-color-theme` attribute on `<html>`, which the CSS picks up via
 * `[data-color-theme="..."]` selectors.
 * Works independently from next-themes dark/light toggle.
 */
export function useColorTheme() {
  const [colorTheme, setColorThemeState] = useState<ColorTheme>('default');

  /* On mount, restore the saved preference and apply it. */
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as ColorTheme | null;
      if (saved && VALID_THEMES.includes(saved)) {
        setColorThemeState(saved);
        applyColorTheme(saved);
      }
    } catch {
      /* localStorage unavailable — silently ignore */
    }
  }, []);

  const setColorTheme = useCallback((theme: ColorTheme) => {
    setColorThemeState(theme);
    applyColorTheme(theme);
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      /* ignore */
    }
  }, []);

  return { colorTheme, setColorTheme };
}
