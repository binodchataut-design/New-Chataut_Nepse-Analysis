import React, { useState, useMemo } from 'react';
import {
  BacktestResult,
  PriceRecordWithIndicators,
  SignalFilterConfig,
  DEFAULT_SIGNAL_FILTER_CONFIG,
} from '../types';
import { runBacktest } from '../lib/backtestEngine';
import {
  computeSignalsFromConfig,
  getSignalSetupDescription,
} from '../lib/probabilityScoring';
import { SignalFilterPanel } from './SignalFilterPanel';
import {
  TrendingUp,
  Activity,
  AlertTriangle,
  RotateCcw,
  Sliders,
  CheckCircle2,
  XCircle,
  Clock,
  Info,
  ShieldAlert,
} from 'lucide-react';

interface BacktestLabProps {
  symbol: string;
  data: PriceRecordWithIndicators[];
  isLoading: boolean;
}

export const BacktestLab: React.FC<BacktestLabProps> = ({
  symbol,
  data,
  isLoading,
}) => {
  // Configurable signal filter definition (MA Cross or RSI Threshold)
  const [filterConfig, setFilterConfig] = useState<SignalFilterConfig>(DEFAULT_SIGNAL_FILTER_CONFIG);

  // Configurable trade execution parameters (defaults: Target 3%, Stop 2%, Holding 20 sessions)
  const [targetPct, setTargetPct] = useState<number>(3);
  const [stopPct, setStopPct] = useState<number>(2);
  const [maxHoldingSessions, setMaxHoldingSessions] = useState<number>(20);

  // Compute trade simulation dynamically from the configured signal filter
  const { result, signalCount, setupTitle, setupFormula, setupCategory } = useMemo(() => {
    if (!data || data.length === 0) {
      return {
        result: null,
        signalCount: 0,
        setupTitle: '',
        setupFormula: '',
        setupCategory: '',
      };
    }

    // Generic signal detector emits plain number[] indices
    const { signals } = computeSignalsFromConfig(data, filterConfig);

    // Run trade simulation through unchanged backtestEngine
    const bt = runBacktest(data, signals, targetPct, stopPct, maxHoldingSessions);
    const desc = getSignalSetupDescription(filterConfig);

    const category =
      filterConfig.mode === 'ma_cross'
        ? 'Trend-Following Setup'
        : 'Mean-Reversion Setup';

    const formula =
      filterConfig.mode === 'ma_cross'
        ? `Entry next open after: ${filterConfig.maCross.fastType.toLowerCase()}${filterConfig.maCross.fastPeriod}[i-1] <= ${filterConfig.maCross.slowType.toLowerCase()}${filterConfig.maCross.slowPeriod}[i-1] AND ${filterConfig.maCross.fastType.toLowerCase()}${filterConfig.maCross.fastPeriod}[i] > ${filterConfig.maCross.slowType.toLowerCase()}${filterConfig.maCross.slowPeriod}[i]`
        : `Entry next open after: rsi${filterConfig.rsiThreshold.period}[i-1] ${filterConfig.rsiThreshold.direction === 'recovery' ? '<' : '>'} ${filterConfig.rsiThreshold.threshold} AND rsi${filterConfig.rsiThreshold.period}[i] ${filterConfig.rsiThreshold.direction === 'recovery' ? '>=' : '<='} ${filterConfig.rsiThreshold.threshold}`;

    return {
      result: bt,
      signalCount: signals.length,
      setupTitle: desc,
      setupFormula: formula,
      setupCategory: category,
    };
  }, [data, filterConfig, targetPct, stopPct, maxHoldingSessions]);

  const handleResetDefaults = () => {
    setTargetPct(3);
    setStopPct(2);
    setMaxHoldingSessions(20);
  };

  if (isLoading) {
    return (
      <div className="w-full bg-white border border-neutral-200 rounded-xl p-6 text-center text-neutral-500">
        <div className="w-6 h-6 border-2 border-neutral-900 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
        <div className="text-sm">Simulating trade execution across historical price history...</div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return null;
  }

  return (
    <div id="backtest-lab-section" className="w-full bg-white border border-neutral-200 rounded-xl shadow-xs overflow-hidden space-y-6 p-5">
      {/* Header & Interactive Parameters Bar */}
      <div className="pb-4 border-b border-neutral-200 bg-neutral-50/70 -mx-5 -mt-5 p-5">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-md bg-neutral-900 text-white">
                <Sliders className="w-4 h-4" />
              </span>
              <h3 className="text-lg font-bold text-neutral-900">
                Backtest Engine (Trade Simulation)
              </h3>
            </div>
            <p className="text-xs text-neutral-500 mt-1 max-w-2xl">
              Simulates realistic trade lifecycle for <span className="font-mono font-semibold text-neutral-800">{symbol}</span>:
              Entry at next session open (t+1), target profit, stop-loss, and holding expiry.
            </p>
          </div>

          {/* Interactive Parameters Bar */}
          <div className="flex flex-wrap items-center gap-3 bg-white p-2.5 rounded-lg border border-neutral-200 shadow-2xs">
            {/* Target % Input */}
            <div className="flex items-center gap-1.5">
              <label htmlFor="target-pct-input" className="text-xs font-semibold text-neutral-700 whitespace-nowrap">
                Target:
              </label>
              <div className="relative inline-flex items-center">
                <span className="absolute left-2 text-xs font-mono font-bold text-emerald-600">+</span>
                <input
                  id="target-pct-input"
                  type="number"
                  min="0.5"
                  max="50"
                  step="0.5"
                  value={targetPct}
                  onChange={(e) => setTargetPct(Math.max(0.1, Number(e.target.value) || 0.1))}
                  className="w-18 pl-5 pr-5 py-1 text-xs font-mono font-bold text-neutral-900 bg-neutral-50 border border-neutral-300 rounded-md focus:outline-hidden focus:ring-1 focus:ring-neutral-900"
                />
                <span className="absolute right-2 text-xs font-mono text-neutral-500">%</span>
              </div>
            </div>

            {/* Stop-Loss % Input */}
            <div className="flex items-center gap-1.5">
              <label htmlFor="stop-pct-input" className="text-xs font-semibold text-neutral-700 whitespace-nowrap">
                Stop-Loss:
              </label>
              <div className="relative inline-flex items-center">
                <span className="absolute left-2 text-xs font-mono font-bold text-rose-600">-</span>
                <input
                  id="stop-pct-input"
                  type="number"
                  min="0.5"
                  max="30"
                  step="0.5"
                  value={stopPct}
                  onChange={(e) => setStopPct(Math.max(0.1, Number(e.target.value) || 0.1))}
                  className="w-18 pl-5 pr-5 py-1 text-xs font-mono font-bold text-neutral-900 bg-neutral-50 border border-neutral-300 rounded-md focus:outline-hidden focus:ring-1 focus:ring-neutral-900"
                />
                <span className="absolute right-2 text-xs font-mono text-neutral-500">%</span>
              </div>
            </div>

            {/* Max Holding Window */}
            <div className="flex items-center gap-1.5">
              <label htmlFor="max-holding-input" className="text-xs font-semibold text-neutral-700 whitespace-nowrap">
                Max Holding:
              </label>
              <div className="relative inline-flex items-center">
                <input
                  id="max-holding-input"
                  type="number"
                  min="1"
                  max="120"
                  step="1"
                  value={maxHoldingSessions}
                  onChange={(e) => setMaxHoldingSessions(Math.max(1, Number(e.target.value) || 1))}
                  className="w-16 px-2 py-1 text-xs font-mono font-bold text-neutral-900 bg-neutral-50 border border-neutral-300 rounded-md focus:outline-hidden focus:ring-1 focus:ring-neutral-900"
                />
                <span className="ml-1 text-xs font-mono text-neutral-500">sessions</span>
              </div>
            </div>

            {/* Reset Button */}
            <button
              type="button"
              id="reset-backtest-params"
              onClick={handleResetDefaults}
              title="Reset parameters to standard defaults (3% Target, 2% Stop, 20 sessions)"
              className="p-1.5 text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 rounded-md transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Signal Filter Definition Panel */}
      <SignalFilterPanel
        config={filterConfig}
        onChange={setFilterConfig}
        title="Setup Definition (Signal Source)"
        description="Choose moving average cross or RSI threshold criteria to feed signal entries into the backtest engine."
      />

      {/* Honest Methodology & Assumptions Notice */}
      <div className="p-3.5 rounded-lg bg-neutral-50 border border-neutral-200 text-xs text-neutral-600 space-y-2">
        <div className="flex items-center gap-2 font-bold text-neutral-900">
          <ShieldAlert className="w-4 h-4 text-neutral-700 shrink-0" />
          <span>Simulation Assumptions &amp; Conservative Collision Rule</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px] leading-relaxed">
          <div className="p-2.5 rounded bg-white border border-neutral-200/80">
            <strong className="text-neutral-900 block mb-0.5">1. Same-Session Stop Priority:</strong>
            If both target (+{targetPct}%) and stop (-{stopPct}%) are touched within the same trading session
            (<code className="font-mono text-[10px] bg-neutral-100 px-1 py-0.5 rounded">low &le; stopPrice AND high &ge; targetPrice</code>),
            the engine conservatively assumes the <strong>stop-loss was hit first</strong>. Daily OHLC cannot determine intraday sequence,
            so this conservative rule prevents optimistic win-rate bias.
          </div>
          <div className="p-2.5 rounded bg-white border border-neutral-200/80">
            <strong className="text-neutral-900 block mb-0.5">2. Holding Window Expiry:</strong>
            If neither target nor stop is reached within {maxHoldingSessions} trading sessions, the trade is closed at that session's
            closing price and marked <span className="font-semibold text-neutral-800">expired</span>. Expired trades are <strong>never</strong> counted
            as wins or losses and are excluded from the win rate, but are accounted for in overall expectancy.
          </div>
        </div>
      </div>

      {/* Single Dynamic Setup Backtest Card */}
      <div className="grid grid-cols-1 gap-6">
        <BacktestSetupCard
          title={setupTitle}
          category={setupCategory}
          formulaDescription={setupFormula}
          symbol={symbol}
          targetPct={targetPct}
          stopPct={stopPct}
          maxHoldingSessions={maxHoldingSessions}
          result={result}
          totalSignals={signalCount}
          icon={
            filterConfig.mode === 'ma_cross' ? (
              <TrendingUp className="w-4 h-4 text-blue-600" />
            ) : (
              <Activity className="w-4 h-4 text-indigo-600" />
            )
          }
        />
      </div>

      {/* Scope Boundary / Roadmap Disclaimer */}
      <div className="pt-2 border-t border-neutral-200 flex items-center justify-between text-xs text-neutral-500">
        <span className="flex items-center gap-1.5">
          <Info className="w-3.5 h-3.5 text-neutral-400" />
          <span>Simulation operates on fixed single-share execution without position compounding or slip fees.</span>
        </span>
        <span className="font-mono text-[11px] text-neutral-400">
          Engine Version: Phase 8 Standard
        </span>
      </div>
    </div>
  );
};

interface BacktestSetupCardProps {
  title: string;
  category: string;
  formulaDescription: string;
  symbol: string;
  targetPct: number;
  stopPct: number;
  maxHoldingSessions: number;
  result: BacktestResult | null;
  totalSignals: number;
  icon: React.ReactNode;
}

const BacktestSetupCard: React.FC<BacktestSetupCardProps> = ({
  title,
  category,
  formulaDescription,
  symbol,
  targetPct,
  stopPct,
  maxHoldingSessions,
  result,
  totalSignals,
  icon,
}) => {
  const [isTableExpanded, setIsTableExpanded] = useState<boolean>(true);

  if (!result) {
    return (
      <div className="border border-neutral-200 rounded-lg p-5 bg-neutral-50 text-neutral-500 text-xs">
        Loading trade calculations...
      </div>
    );
  }

  const {
    totalTrades,
    excludedTrades,
    wins,
    losses,
    expired,
    winRate,
    avgWinReturn,
    avgLossReturn,
    expectancy,
    trades,
  } = result;

  const isLowSampleSize = totalTrades > 0 && totalTrades < 10;
  const hasZeroTrades = totalTrades === 0;

  return (
    <div className="border border-neutral-200 rounded-xl bg-white flex flex-col justify-between overflow-hidden shadow-2xs">
      {/* Card Header */}
      <div className="p-4 border-b border-neutral-100 bg-neutral-50/50">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              {icon}
              <h4 className="font-bold text-neutral-900 text-base">{title}</h4>
            </div>
            <div className="text-[11px] text-neutral-500 font-medium mt-0.5">{category}</div>
          </div>
          <div className="flex items-center gap-1.5 font-mono text-[10px]">
            <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded font-semibold">
              Target: +{targetPct}%
            </span>
            <span className="bg-rose-50 text-rose-700 border border-rose-200 px-2 py-0.5 rounded font-semibold">
              Stop: -{stopPct}%
            </span>
            <span className="bg-neutral-100 text-neutral-700 px-2 py-0.5 rounded">
              Max: {maxHoldingSessions}s
            </span>
          </div>
        </div>
        <div className="text-[10px] font-mono text-neutral-400 mt-2 bg-white px-2 py-1 rounded border border-neutral-200/80">
          Trigger: {formulaDescription}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="p-4 space-y-4">
        {/* Zero Trades Honest State */}
        {hasZeroTrades ? (
          <div className="p-5 rounded-lg bg-neutral-50 border border-neutral-200 text-center">
            <Info className="w-5 h-5 text-neutral-400 mx-auto mb-1.5" />
            <div className="font-semibold text-xs text-neutral-800">
              No historical trades simulated for this setup for {symbol}
            </div>
            {excludedTrades > 0 ? (
              <p className="text-[11px] text-neutral-500 mt-1 max-w-sm mx-auto">
                {excludedTrades} signal fired on the latest session in data, but entry requires the next session open (t+1),
                so this signal is excluded until forward trading occurs.
              </p>
            ) : (
              <p className="text-[11px] text-neutral-500 mt-1 max-w-sm mx-auto">
                Neither signal fired in the recorded historical sessions for this symbol. No trades could be executed.
              </p>
            )}
          </div>
        ) : (
          <>
            {/* Primary Metrics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {/* Metric 1: Win Rate (X of Y) */}
              <div className="p-3 rounded-lg bg-neutral-50 border border-neutral-100">
                <div className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider">
                  Win Rate (X of Y)
                </div>
                <div className="text-xl font-bold font-mono text-neutral-900 mt-0.5">
                  {winRate !== null ? `${winRate.toFixed(1)}%` : '—'}
                </div>
                <div className="text-[11px] text-neutral-600 font-mono mt-0.5">
                  <span className="font-bold text-neutral-900">{wins}</span> of{' '}
                  <span className="font-bold text-neutral-900">{wins + losses}</span> resolved
                </div>
                <div className="text-[10px] text-neutral-400 mt-0.5 font-mono">
                  {expired} expired (excluded)
                </div>
              </div>

              {/* Metric 2: Expectancy */}
              <div className="p-3 rounded-lg bg-neutral-50 border border-neutral-100">
                <div className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider">
                  Expectancy (Avg Return)
                </div>
                <div
                  className={`text-xl font-bold font-mono mt-0.5 ${
                    expectancy !== null
                      ? expectancy >= 0
                        ? 'text-emerald-700'
                        : 'text-rose-700'
                      : 'text-neutral-900'
                  }`}
                >
                  {expectancy !== null ? `${expectancy >= 0 ? '+' : ''}${expectancy.toFixed(2)}%` : '—'}
                </div>
                <div className="text-[11px] text-neutral-500 font-mono mt-0.5">
                  across all <span className="font-semibold text-neutral-800">{totalTrades}</span> trades
                </div>
                <div className="text-[10px] text-neutral-400 mt-0.5">
                  includes expired positions
                </div>
              </div>

              {/* Metric 3: Avg Win vs Loss Return */}
              <div className="p-3 rounded-lg bg-neutral-50 border border-neutral-100">
                <div className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider">
                  Avg Win / Loss
                </div>
                <div className="text-xs font-mono font-bold mt-1.5 space-y-1">
                  <div className="text-emerald-700 flex justify-between">
                    <span>Avg Win:</span>
                    <span>{avgWinReturn !== null ? `+${avgWinReturn.toFixed(2)}%` : '—'}</span>
                  </div>
                  <div className="text-rose-700 flex justify-between">
                    <span>Avg Loss:</span>
                    <span>{avgLossReturn !== null ? `${avgLossReturn.toFixed(2)}%` : '—'}</span>
                  </div>
                </div>
                <div className="text-[10px] text-neutral-400 mt-1 font-mono">
                  Ratio: {avgWinReturn && avgLossReturn ? (Math.abs(avgWinReturn / avgLossReturn)).toFixed(2) : '—'}
                </div>
              </div>

              {/* Metric 4: Trade Accounting */}
              <div className="p-3 rounded-lg bg-neutral-50 border border-neutral-100">
                <div className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider">
                  Trade Accounting
                </div>
                <div className="text-xl font-bold font-mono text-neutral-900 mt-0.5">
                  {totalTrades}
                </div>
                <div className="text-[11px] text-neutral-600 font-mono mt-0.5">
                  <span className="text-emerald-700 font-medium">{wins}W</span> /{' '}
                  <span className="text-rose-700 font-medium">{losses}L</span> /{' '}
                  <span className="text-neutral-500">{expired}Exp</span>
                </div>
                <div className="text-[10px] text-neutral-400 mt-0.5 font-mono">
                  {excludedTrades > 0 ? (
                    <span className="text-amber-700">{excludedTrades} excluded (latest bar)</span>
                  ) : (
                    '0 excluded'
                  )}
                </div>
              </div>
            </div>

            {/* Low Sample Size Caveat (Under 10 trades) */}
            {isLowSampleSize && (
              <div className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold">Low sample size caveat:</span> Only{' '}
                  <span className="font-bold">{totalTrades} trades</span> occurred in the entire
                  historical record for {symbol}. Small sample sizes are sensitive to market variance
                  and cannot confirm statistical significance. Treat win rate and expectancy with caution.
                </div>
              </div>
            )}
          </>
        )}

        {/* Trade-by-Trade Table (Spot-Check) */}
        {trades.length > 0 && (
          <div className="pt-2">
            <div className="flex items-center justify-between pb-2 border-b border-neutral-100">
              <span className="text-xs font-bold text-neutral-700 uppercase tracking-wider">
                Trade-by-Trade Execution Log ({trades.length} trades)
              </span>
              <button
                type="button"
                onClick={() => setIsTableExpanded(!isTableExpanded)}
                className="text-xs text-neutral-500 hover:text-neutral-900 font-medium underline"
              >
                {isTableExpanded ? 'Hide table' : 'Show table'}
              </button>
            </div>

            {isTableExpanded && (
              <div className="mt-2 overflow-x-auto max-h-72 overflow-y-auto border border-neutral-200 rounded-lg">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-neutral-100 text-neutral-600 text-[10px] uppercase sticky top-0 border-b border-neutral-200">
                    <tr>
                      <th className="py-2 px-2.5">#</th>
                      <th className="py-2 px-2.5">Signal Date</th>
                      <th className="py-2 px-2.5">Entry (Date / Open)</th>
                      <th className="py-2 px-2.5">Exit (Date / Price)</th>
                      <th className="py-2 px-2.5">Holding</th>
                      <th className="py-2 px-2.5 text-right">Return (%)</th>
                      <th className="py-2 px-2.5">Exit Reason</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {trades.map((trade, idx) => {
                      const isWin = trade.exitReason === 'target';
                      const isLoss = trade.exitReason === 'stop';
                      const isExpired = trade.exitReason === 'expired';

                      return (
                        <tr
                          key={`trade-${idx}`}
                          className={`hover:bg-neutral-50 transition-colors ${
                            isWin
                              ? 'bg-emerald-50/20'
                              : isLoss
                              ? 'bg-rose-50/10'
                              : 'bg-neutral-50/40'
                          }`}
                        >
                          <td className="py-1.5 px-2.5 text-neutral-400">{idx + 1}</td>
                          <td className="py-1.5 px-2.5 font-bold text-neutral-900">
                            {trade.signalDate}
                          </td>
                          <td className="py-1.5 px-2.5 text-neutral-700">
                            <span>{trade.entryDate}</span>{' '}
                            <span className="text-neutral-400">@</span>{' '}
                            <span className="font-semibold text-neutral-900">
                              NPR {trade.entryPrice.toFixed(1)}
                            </span>
                          </td>
                          <td className="py-1.5 px-2.5 text-neutral-700">
                            <span>{trade.exitDate}</span>{' '}
                            <span className="text-neutral-400">@</span>{' '}
                            <span className="font-semibold text-neutral-900">
                              NPR {trade.exitPrice.toFixed(1)}
                            </span>
                          </td>
                          <td className="py-1.5 px-2.5 text-neutral-600">
                            {trade.holdingSessions} {trade.holdingSessions === 1 ? 'session' : 'sessions'}
                          </td>
                          <td
                            className={`py-1.5 px-2.5 text-right font-bold ${
                              trade.returnPct > 0
                                ? 'text-emerald-700'
                                : trade.returnPct < 0
                                ? 'text-rose-700'
                                : 'text-neutral-600'
                            }`}
                          >
                            {trade.returnPct >= 0 ? '+' : ''}
                            {trade.returnPct.toFixed(2)}%
                          </td>
                          <td className="py-1.5 px-2.5">
                            {isWin ? (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                                Target (+{targetPct}%)
                              </span>
                            ) : isLoss ? (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800">
                                <XCircle className="w-3 h-3 text-rose-600 shrink-0" />
                                Stop (-{stopPct}%)
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-neutral-200 text-neutral-700">
                                <Clock className="w-3 h-3 text-neutral-500 shrink-0" />
                                Expired ({trade.holdingSessions}s)
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
