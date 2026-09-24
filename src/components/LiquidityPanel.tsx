import React from 'react';
import { LiquidityMetrics } from '../types';
import { Droplets, AlertTriangle, CheckCircle2, Info, ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';
import { CautionNotice } from './CautionNotice';

interface LiquidityPanelProps {
  metrics: LiquidityMetrics | null;
  isLoading?: boolean;
}

export const LiquidityPanel: React.FC<LiquidityPanelProps> = ({ metrics, isLoading = false }) => {
  if (isLoading) {
    return (
      <div
        id="liquidity-panel-loading"
        className="px-4 py-3 bg-white border border-neutral-200 rounded-xl text-xs flex items-center gap-2 text-neutral-500 shadow-xs"
      >
        <Droplets className="w-4 h-4 text-neutral-400 animate-pulse" />
        <span className="italic">Calculating liquidity metrics...</span>
      </div>
    );
  }

  if (!metrics || metrics.totalSessions === 0) {
    return null;
  }

  return (
    <div
      id="liquidity-panel"
      className={`border rounded-xl shadow-xs transition-colors overflow-hidden ${
        metrics.isStale
          ? 'bg-amber-50/20 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/60'
          : 'bg-white border-neutral-200'
      }`}
    >
      {/* Panel Header */}
      <div className="px-4 py-3 border-b border-neutral-100 flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2">
          <Droplets className={`w-4 h-4 ${metrics.isStale ? 'text-amber-600 dark:text-amber-400' : 'text-neutral-600'}`} />
          <div className="flex items-baseline gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-neutral-900">
              Liquidity Profile
            </span>
            <span className="font-mono text-xs font-semibold text-neutral-500">
              {metrics.symbol}
            </span>
          </div>
        </div>

        {/* Status Indicator */}
        <div className="flex items-center gap-2">
          {metrics.isStale ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold font-mono bg-amber-50 text-amber-900 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-800/60">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" strokeWidth={2} />
              <span>Stale Trading Activity ({metrics.daysSinceLastTrade} sessions inactive)</span>
            </span>
          ) : metrics.daysSinceLastTrade !== null ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium font-mono bg-[var(--success)]/10 text-[var(--success)] border border-[var(--success)]/20">
              <CheckCircle2 className="w-3.5 h-3.5 text-[var(--success)] shrink-0" strokeWidth={2} />
              <span>
                {metrics.daysSinceLastTrade === 0
                  ? 'Active (traded on latest market session)'
                  : `Active (${metrics.daysSinceLastTrade} session${metrics.daysSinceLastTrade === 1 ? '' : 's'} ago)`}
              </span>
            </span>
          ) : null}
        </div>
      </div>

      {/* Prominent Warning Callout if Stale */}
      {metrics.isStale && (
        <div className="p-3 border-b border-neutral-200 dark:border-neutral-800">
          <CautionNotice
            id="liquidity-stale-warning"
            severity="caution"
            title="Caution: Inactive Instrument."
          >
            This stock last traded on{' '}
            <span className="font-mono font-bold">{metrics.latestSessionDate}</span>, which is{' '}
            <span className="font-mono font-bold text-[var(--danger)]">{metrics.daysSinceLastTrade} market sessions</span> behind the latest market date ({metrics.marketLatestDate}). Signals on stale instruments carry severe execution risk.
          </CautionNotice>
        </div>
      )}

      {/* Compact Metrics Row */}
      <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Metric 1: 20-Session Avg Volume */}
        <div className="p-3 rounded-lg bg-neutral-50/80 border border-neutral-200/80 space-y-1">
          <div className="text-[11px] font-medium text-neutral-500 uppercase tracking-wider">
            20-Session Avg Volume
          </div>
          <div className="text-base font-bold font-mono text-neutral-900">
            {metrics.has20SessionHistory && metrics.avgVolume20 !== null ? (
              <span>{metrics.avgVolume20.toLocaleString()} <span className="text-xs font-normal text-neutral-500">shares</span></span>
            ) : (
              <span className="text-xs font-normal text-neutral-400 italic">
                insufficient history (&lt;20 sessions)
              </span>
            )}
          </div>
          <div className="text-[11px] text-neutral-400">
            Recent short-term trading pace
          </div>
        </div>

        {/* Metric 2: 60-Session Avg Volume */}
        <div className="p-3 rounded-lg bg-neutral-50/80 border border-neutral-200/80 space-y-1">
          <div className="text-[11px] font-medium text-neutral-500 uppercase tracking-wider">
            60-Session Avg Volume
          </div>
          <div className="text-base font-bold font-mono text-neutral-900">
            {metrics.has60SessionHistory && metrics.avgVolume60 !== null ? (
              <span>{metrics.avgVolume60.toLocaleString()} <span className="text-xs font-normal text-neutral-500">shares</span></span>
            ) : (
              <span className="text-xs font-normal text-neutral-400 italic">
                insufficient history (&lt;60 sessions)
              </span>
            )}
          </div>
          <div className="text-[11px] text-neutral-400">
            Quarterly baseline activity
          </div>
        </div>

        {/* Metric 3: Liquidity Trend */}
        <div className="p-3 rounded-lg bg-neutral-50/80 border border-neutral-200/80 space-y-1">
          <div className="text-[11px] font-medium text-neutral-500 uppercase tracking-wider">
            Liquidity Trend (20 vs 60)
          </div>
          <div className="flex items-center gap-2">
            <span className="text-base font-bold font-mono text-neutral-900">
              {metrics.liquidityTrendRatio !== null ? `${metrics.liquidityTrendRatio.toFixed(2)}x` : '—'}
            </span>
            {metrics.liquidityTrendDirection === 'rising' && (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[11px] font-semibold font-mono bg-[var(--success)]/10 text-[var(--success)] border border-[var(--success)]/20">
                <ArrowUpRight className="w-3 h-3 text-[var(--success)]" strokeWidth={2} />
                Rising
              </span>
            )}
            {metrics.liquidityTrendDirection === 'fading' && (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[11px] font-semibold font-mono bg-[var(--danger)]/10 text-[var(--danger)] border border-[var(--danger)]/20">
                <ArrowDownRight className="w-3 h-3 text-[var(--danger)]" strokeWidth={2} />
                Fading
              </span>
            )}
            {metrics.liquidityTrendDirection === 'neutral' && (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[11px] font-medium font-mono bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400 border border-neutral-200 dark:border-neutral-700">
                <Minus className="w-3 h-3 text-neutral-500" strokeWidth={2} />
                Normal
              </span>
            )}
          </div>
          <div className="text-[11px] text-neutral-600 truncate" title={metrics.liquidityTrendDescription}>
            {metrics.liquidityTrendDescription}
          </div>
        </div>

        {/* Metric 4: Days Since Last Trade */}
        <div className="p-3 rounded-lg bg-neutral-50/80 border border-neutral-200/80 space-y-1">
          <div className="text-[11px] font-medium text-neutral-500 uppercase tracking-wider">
            Days Since Last Trade
          </div>
          <div className="text-base font-bold font-mono">
            {metrics.daysSinceLastTrade !== null ? (
              <span className={metrics.isStale ? 'text-[var(--danger)] font-extrabold' : 'text-neutral-900'}>
                {metrics.daysSinceLastTrade}{' '}
                <span className="text-xs font-normal text-neutral-500">
                  session{metrics.daysSinceLastTrade === 1 ? '' : 's'}
                </span>
              </span>
            ) : (
              <span className="text-neutral-400 font-normal text-xs">—</span>
            )}
          </div>
          <div className="text-[11px] text-neutral-400 flex items-center justify-between">
            <span>Market max: {metrics.marketLatestDate || 'N/A'}</span>
            {metrics.isStale && (
              <span className="text-[var(--danger)] font-semibold font-mono text-[10px]">
                &gt; 5 sessions
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Honest Disclosures Footer */}
      <div className="px-4 py-2.5 bg-neutral-100/60 border-t border-neutral-200 text-[11px] text-neutral-500 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Info className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
          <span>
            <strong className="font-semibold text-neutral-700">Trade Count:</strong> Not tracked in <code className="font-mono text-neutral-600">daily_prices</code> (schema records session volume only; no transaction counts).
          </span>
        </div>
        <span className="font-mono text-[10px] text-neutral-400">
          Evaluated across {metrics.totalSessions} total recorded sessions
        </span>
      </div>
    </div>
  );
};
