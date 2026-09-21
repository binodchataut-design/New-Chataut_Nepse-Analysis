import React from 'react';
import {
  LayoutDashboard,
  LineChart,
  Target,
  Sliders,
  BookOpen,
  Database,
  Sun,
  Moon,
  ChevronLeft,
  ChevronRight,
  X,
  RotateCcw,
} from 'lucide-react';
import { TabType } from '../types';
import { ResolvedTheme } from './useThemeMode';

export interface NavItemConfig {
  id: TabType;
  label: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number | string }>;
  description: string;
}

export const SIDEBAR_NAV_ITEMS: NavItemConfig[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard,
    description: 'Market Overview & Scanner',
  },
  {
    id: 'chart',
    label: 'Chart',
    icon: LineChart,
    description: 'Price Action & Indicators',
  },
  {
    id: 'lab',
    label: 'Probability Lab',
    icon: Target,
    description: 'Setup Edge & Hit Rates',
  },
  {
    id: 'backtest',
    label: 'Backtest Lab',
    icon: Sliders,
    description: 'Multi-Factor Simulation',
  },
  {
    id: 'journal',
    label: 'Trading Journal',
    icon: BookOpen,
    description: 'Trade Log & Post-Analysis',
  },
  {
    id: 'data',
    label: 'Data Status',
    icon: Database,
    description: 'Database Schema & Tables',
  },
];

interface AppSidebarProps {
  activeTab: TabType;
  onSelectTab: (tab: TabType) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
  theme: ResolvedTheme;
  hasThemeOverride: boolean;
  onToggleTheme: () => void;
  onResetThemeToSystem: () => void;
  isLiveConfigured: boolean;
}

export const AppSidebar: React.FC<AppSidebarProps> = ({
  activeTab,
  onSelectTab,
  isCollapsed,
  onToggleCollapse,
  isMobileOpen,
  onCloseMobile,
  theme,
  hasThemeOverride,
  onToggleTheme,
  onResetThemeToSystem,
  isLiveConfigured,
}) => {
  const isDark = theme === 'dark';

  const renderNavContent = (isMobileView: boolean) => {
    const collapsed = !isMobileView && isCollapsed;

    return (
      <div className="flex flex-col h-full bg-[var(--bg-secondary)] border-r border-[var(--border)] transition-all duration-200">
        {/* Brand Header */}
        <div
          className={`flex items-center justify-between border-b border-[var(--border)] ${
            collapsed ? 'p-3' : 'px-4 py-4'
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-[var(--accent)] text-[var(--accent-text)] flex items-center justify-center font-mono font-bold text-sm shrink-0 shadow-xs">
              NP
            </div>
            {!collapsed && (
              <div className="min-w-0">
                <h1 className="text-sm font-bold tracking-tight text-[var(--text-primary)] truncate">
                  NEPSE Research
                </h1>
                <p className="text-[10px] text-[var(--text-muted)] truncate">
                  Decision-Support
                </p>
              </div>
            )}
          </div>

          {/* Desktop Collapse Button */}
          {!isMobileView && (
            <button
              type="button"
              id="sidebar-collapse-toggle"
              onClick={onToggleCollapse}
              title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              className="hidden md:flex p-1.5 rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors cursor-pointer"
            >
              {collapsed ? (
                <ChevronRight className="w-4 h-4" />
              ) : (
                <ChevronLeft className="w-4 h-4" />
              )}
            </button>
          )}

          {/* Mobile Close Button */}
          {isMobileView && (
            <button
              type="button"
              id="mobile-sidebar-close"
              onClick={onCloseMobile}
              aria-label="Close menu"
              className="p-1.5 rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Navigation Sections */}
        <nav
          id="sidebar-navigation"
          aria-label="Sidebar Navigation"
          className="flex-1 py-3 px-2 space-y-1 overflow-y-auto"
        >
          {SIDEBAR_NAV_ITEMS.map((item) => {
            const isActive = activeTab === item.id;
            const Icon = item.icon;

            return (
              <button
                key={item.id}
                id={`sidebar-nav-${item.id}`}
                type="button"
                onClick={() => {
                  onSelectTab(item.id);
                  if (isMobileView) onCloseMobile();
                }}
                title={collapsed ? `${item.label} (${item.description})` : undefined}
                className={`w-full flex items-center gap-3 rounded-lg transition-all text-left group cursor-pointer ${
                  collapsed ? 'justify-center p-2.5' : 'px-3 py-2.5'
                } ${
                  isActive
                    ? 'bg-[var(--bg-tertiary)] text-[var(--text-primary)] font-semibold shadow-2xs border-l-2 border-[var(--accent)]'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]/70'
                }`}
              >
                <Icon
                  strokeWidth={1.85}
                  className={`w-4 h-4 shrink-0 transition-colors ${
                    isActive
                      ? 'text-[var(--accent)]'
                      : 'text-[var(--text-muted)] group-hover:text-[var(--text-primary)]'
                  }`}
                />
                {!collapsed && (
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-medium tracking-tight truncate leading-snug">
                      {item.label}
                    </div>
                  </div>
                )}
              </button>
            );
          })}
        </nav>

        {/* Sidebar Footer: Theme Toggle & Status */}
        <div className="p-2 border-t border-[var(--border)] bg-[var(--bg-secondary)] space-y-2">
          {/* Theme Toggle Button */}
          <div className="flex flex-col gap-1">
            <button
              type="button"
              id="theme-mode-toggle"
              onClick={onToggleTheme}
              title={
                isDark
                  ? 'Switch to Light Theme'
                  : 'Switch to Dark Theme'
              }
              aria-label={
                isDark
                  ? 'Switch to Light Theme'
                  : 'Switch to Dark Theme'
              }
              className={`w-full flex items-center gap-2.5 rounded-lg border border-[var(--border)] bg-[var(--bg-tertiary)] text-[var(--text-primary)] hover:bg-[var(--border)] transition-colors cursor-pointer ${
                collapsed ? 'justify-center p-2' : 'px-3 py-2'
              }`}
            >
              {isDark ? (
                <Sun className="w-4 h-4 text-amber-400 shrink-0" />
              ) : (
                <Moon className="w-4 h-4 text-neutral-600 shrink-0" />
              )}
              {!collapsed && (
                <div className="flex-1 flex items-center justify-between text-[11px] font-medium leading-none">
                  <span>{isDark ? 'Dark Theme' : 'Light Theme'}</span>
                  <span className="text-[10px] text-[var(--text-muted)] font-mono">
                    {hasThemeOverride ? 'Manual' : 'System'}
                  </span>
                </div>
              )}
            </button>

            {/* Reset to System preference if manual override active */}
            {!collapsed && hasThemeOverride && (
              <button
                type="button"
                id="theme-reset-system"
                onClick={onResetThemeToSystem}
                title="Reset to follow OS system theme preference"
                className="w-full flex items-center justify-center gap-1 py-1 text-[10px] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset to system theme</span>
              </button>
            )}
          </div>

          {/* Connection Status Pill */}
          {!collapsed ? (
            <div className="px-2.5 py-1.5 rounded-md bg-[var(--bg-tertiary)] border border-[var(--border)] flex items-center justify-between text-[10px] font-mono">
              <span className="text-[var(--text-muted)]">Data Source:</span>
              <span className="flex items-center gap-1.5 font-semibold text-[var(--text-primary)]">
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    isLiveConfigured
                      ? 'bg-emerald-500 animate-pulse'
                      : 'bg-amber-500'
                  }`}
                />
                {isLiveConfigured ? 'Supabase' : 'Offline'}
              </span>
            </div>
          ) : (
            <div
              className="flex justify-center p-1 text-[var(--text-muted)]"
              title={isLiveConfigured ? 'Connected to Supabase' : 'Supabase Not Connected'}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  isLiveConfigured ? 'bg-emerald-500' : 'bg-amber-500'
                }`}
              />
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Desktop Sidebar (Sticky left column) */}
      <aside
        id="desktop-app-sidebar"
        className={`hidden md:block shrink-0 sticky top-0 h-screen transition-all duration-200 z-30 ${
          isCollapsed ? 'w-16' : 'w-60'
        }`}
      >
        {renderNavContent(false)}
      </aside>

      {/* Mobile Drawer (Backdrop + Slide-over) */}
      {isMobileOpen && (
        <div
          id="mobile-sidebar-drawer"
          className="md:hidden fixed inset-0 z-50 flex"
          role="dialog"
          aria-modal="true"
        >
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
            onClick={onCloseMobile}
            aria-hidden="true"
          />

          {/* Drawer content */}
          <div className="relative w-64 max-w-[80vw] h-full shadow-2xl z-10">
            {renderNavContent(true)}
          </div>
        </div>
      )}
    </>
  );
};
