import React from 'react';
import { Sun, Moon, RotateCcw } from 'lucide-react';
import { useThemeMode } from './useThemeMode';

export interface ThemeToggleProps {
  className?: string;
  showLabel?: boolean;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({
  className = '',
  showLabel = true,
}) => {
  const { theme, hasOverride, toggleTheme, resetToSystem } = useThemeMode();
  const isDark = theme === 'dark';

  return (
    <div className={`inline-flex items-center gap-1.5 ${className}`}>
      <button
        type="button"
        id="theme-toggle-btn"
        onClick={toggleTheme}
        title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        aria-label={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)] text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors cursor-pointer text-xs font-medium"
      >
        {isDark ? (
          <Sun className="w-4 h-4 text-amber-400 shrink-0" />
        ) : (
          <Moon className="w-4 h-4 text-neutral-600 shrink-0" />
        )}
        {showLabel && (
          <span className="truncate">
            {isDark ? 'Dark' : 'Light'}
            {hasOverride ? ' (Manual)' : ' (System)'}
          </span>
        )}
      </button>

      {hasOverride && (
        <button
          type="button"
          id="theme-toggle-reset"
          onClick={resetToSystem}
          title="Reset to system preference"
          aria-label="Reset to system preference"
          className="p-1.5 rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
};
