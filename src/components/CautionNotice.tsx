import React from 'react';
import { AlertTriangle, AlertCircle } from 'lucide-react';

export interface CautionNoticeProps {
  id?: string;
  title?: string;
  children: React.ReactNode;
  severity?: 'caution' | 'critical';
  className?: string;
}

/**
 * Reusable Honest Caution Notice component for Phase 19.
 * Provides unified, consistent visual presentation across Probability Lab,
 * Backtest Lab, Scanner, and Liquidity Panel.
 */
export const CautionNotice: React.FC<CautionNoticeProps> = ({
  id,
  title,
  children,
  severity = 'caution',
  className = '',
}) => {
  const isCritical = severity === 'critical';

  return (
    <div
      id={id}
      role="alert"
      className={`flex items-start gap-2.5 p-3 rounded-lg text-xs leading-relaxed border transition-colors ${
        isCritical
          ? 'bg-rose-50 border-rose-200 text-rose-950 dark:bg-rose-950/40 dark:border-rose-800/60 dark:text-rose-200'
          : 'bg-amber-50 border-amber-200 text-amber-950 dark:bg-amber-950/40 dark:border-amber-800/60 dark:text-amber-200'
      } ${className}`}
    >
      {isCritical ? (
        <AlertCircle
          className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5"
          strokeWidth={2}
          aria-hidden="true"
        />
      ) : (
        <AlertTriangle
          className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5"
          strokeWidth={2}
          aria-hidden="true"
        />
      )}
      <div className="flex-1 min-w-0">
        {title && (
          <span
            className={`font-semibold mr-1.5 ${
              isCritical
                ? 'text-rose-900 dark:text-rose-100'
                : 'text-amber-900 dark:text-amber-100'
            }`}
          >
            {title}
          </span>
        )}
        <span
          className={
            isCritical
              ? 'text-rose-900/95 dark:text-rose-200/90'
              : 'text-amber-950/95 dark:text-amber-200/90'
          }
        >
          {children}
        </span>
      </div>
    </div>
  );
};

export interface CautionBadgeProps {
  label: string;
  title?: string;
  severity?: 'caution' | 'critical';
  className?: string;
}

/**
 * Reusable Caution Badge for inline tables (Scanner, Lists, Badges).
 */
export const CautionBadge: React.FC<CautionBadgeProps> = ({
  label,
  title,
  severity = 'caution',
  className = '',
}) => {
  const isCritical = severity === 'critical';

  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1 text-[10px] font-sans font-medium px-1.5 py-0.5 rounded border transition-colors ${
        isCritical
          ? 'bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/60'
          : 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/60'
      } ${className}`}
    >
      {isCritical ? (
        <AlertCircle
          className="w-3 h-3 text-rose-600 dark:text-rose-400 shrink-0"
          strokeWidth={2}
          aria-hidden="true"
        />
      ) : (
        <AlertTriangle
          className="w-3 h-3 text-amber-600 dark:text-amber-400 shrink-0"
          strokeWidth={2}
          aria-hidden="true"
        />
      )}
      <span>{label}</span>
    </span>
  );
};
