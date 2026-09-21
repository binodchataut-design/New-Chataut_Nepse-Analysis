import { useState, useEffect, useCallback } from 'react';

export type ResolvedTheme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'nepse_theme';

export interface UseThemeModeResult {
  theme: ResolvedTheme;
  hasOverride: boolean;
  toggleTheme: () => void;
  resetToSystem: () => void;
  systemIsDark: boolean;
}

export function useThemeMode(): UseThemeModeResult {
  const [storedPreference, setStoredPreference] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      return localStorage.getItem(THEME_STORAGE_KEY);
    } catch {
      return null;
    }
  });

  const [systemIsDark, setSystemIsDark] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  // Listen for real-time OS/browser theme preference changes
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => {
      setSystemIsDark(e.matches);
    };

    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  // Determine effective resolved theme
  const resolvedTheme: ResolvedTheme =
    storedPreference === 'dark'
      ? 'dark'
      : storedPreference === 'light'
      ? 'light'
      : systemIsDark
      ? 'dark'
      : 'light';

  const hasOverride = storedPreference === 'dark' || storedPreference === 'light';

  // Apply theme class to <html> root element
  useEffect(() => {
    const root = document.documentElement;
    if (resolvedTheme === 'dark') {
      root.classList.add('dark');
      root.classList.remove('light');
    } else {
      root.classList.add('light');
      root.classList.remove('dark');
    }
  }, [resolvedTheme]);

  // Toggle theme between light and dark (sets persistent manual override in localStorage)
  const toggleTheme = useCallback(() => {
    const nextTheme: ResolvedTheme = resolvedTheme === 'dark' ? 'light' : 'dark';
    try {
      localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    } catch (e) {
      console.warn('Failed to save theme preference:', e);
    }
    setStoredPreference(nextTheme);
  }, [resolvedTheme]);

  // Clear manual override to revert to system prefers-color-scheme
  const resetToSystem = useCallback(() => {
    try {
      localStorage.removeItem(THEME_STORAGE_KEY);
    } catch (e) {
      console.warn('Failed to clear theme preference:', e);
    }
    setStoredPreference(null);
  }, []);

  return {
    theme: resolvedTheme,
    hasOverride,
    toggleTheme,
    resetToSystem,
    systemIsDark,
  };
}
