import React, { useState, useMemo } from 'react';
import {
  BacktestResult,
  PriceRecordWithIndicators,
  SignalFilterConfig,
  DEFAULT_SIGNAL_FILTER_CONFIG,
  CANDLESTICK_PATTERN_LABELS,
} from '../types';
import { runBacktest } from '../lib/backtestEngine';
import {
  computeSignalsFromConfig,
  getSignalSetupDescription,
} from '../lib/probabilityScoring';
import {
  combineSignalsAND,
  getUnionSessionCount,
  formatCombinationComparisonLine,
} from '../lib/signalCombination';
import { SignalFilterPanel } from './SignalFilterPanel';
import { PositionSizeCalculator } from './PositionSizeCalculator';
import { CautionNotice } from './CautionNotice';
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
  CandlestickChart,
  BarChart3,
  ChevronDown,
  GitMerge,
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

  // Phase 14: Combine Signals state (default collapsed, Condition A & Condition B)
  const [isCombinedOpen, setIsCombinedOpen] = useState<boolean>(false);
  const [conditionAConfig, setConditionAConfig] = useState<SignalFilterConfig>(DEFAULT_SIGNAL_FILTER_CONFIG);
  const [conditionBConfig, setConditionBConfig] = useState<SignalFilterConfig>({
    ...DEFAULT_SIGNAL_FILTER_CONFIG,
    mode: 'relative_volume',
    relativeVolume: { threshold: 1.5 },
  });

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
        : filterConfig.mode === 'rsi_threshold'
        ? 'Mean-Reversion Setup'
        : filterConfig.mode === 'relative_volume'
        ? 'Volume-Expansion Setup'
        : 'Candlestick Pattern Setup';

    const formula =
      filterConfig.mode === 'ma_cross'
        ? `Entry next open after: ${filterConfig.maCross.fastType.toLowerCase()}${filterConfig.maCross.fastPeriod}[i-1] <= ${filterConfig.maCross.slowType.toLowerCase()}${filterConfig.maCross.slowPeriod}[i-1] AND ${filterConfig.maCross.fastType.toLowerCase()}${filterConfig.maCross.fastPeriod}[i] > ${filterConfig.maCross.slowType.toLowerCase()}${filterConfig.maCross.slowPeriod}[i]`
        : filterConfig.mode === 'rsi_threshold'
        ? `Entry next open after: rsi${filterConfig.rsiThreshold.period}[i-1] ${filterConfig.rsiThreshold.direction === 'recovery' ? '<' : '>'} ${filterConfig.rsiThreshold.threshold} AND rsi${filterConfig.rsiThreshold.period}[i] ${filterConfig.rsiThreshold.direction === 'recovery' ? '>=' : '<='} ${filterConfig.rsiThreshold.threshold}`
        : filterConfig.mode === 'relative_volume'
        ? `Entry next open after: volume[i] >= ${(filterConfig.relativeVolume?.threshold ?? 1.5).toFixed(1)}x of 20-session average volume`
        : `Entry next open after: ${CANDLESTICK_PATTERN_LABELS[filterConfig.candlestickPattern]} pattern on session i`;

    return {
      result: bt,
      signalCount: signals.length,
      setupTitle: desc,
      setupFormula: formula,
      setupCategory: category,
    };
  }, [data, filterConfig, targetPct, stopPct, maxHoldingSessions]);

  // Phase 14: Compute 2-condition combination backtest (A alone, B alone, Combined intersection)
  const combinedEvaluation = useMemo(() => {
    if (!data || data.length === 0) return null;

    const { signals: signalsA } = computeSignalsFromConfig(data, conditionAConfig);
    const { signals: signalsB } = computeSignalsFromConfig(data, conditionBConfig);
    const combinedSignals = combineSignalsAND(signalsA, signalsB);
    const unionCount = getUnionSessionCount(signalsA, signalsB);

    const btA = runBacktest(data, signalsA, targetPct, stopPct, maxHoldingSessions);
    const btB = runBacktest(data, signalsB, targetPct, stopPct, maxHoldingSessions);
    const btCombined = runBacktest(data, combinedSignals, targetPct, stopPct, maxHoldingSessions);

    const descA = getSignalSetupDescription(conditionAConfig);
    const descB = getSignalSetupDescription(conditionBConfig);

    const categoryA =
      conditionAConfig.mode === 'ma_cross'
        ? 'Trend-Following Setup'
        : conditionAConfig.mode === 'rsi_threshold'
        ? 'Mean-Reversion Setup'
        : conditionAConfig.mode === 'relative_volume'
        ? 'Volume-Expansion Setup'
        : 'Candlestick Pattern Setup';

    const categoryB =
      conditionBConfig.mode === 'ma_cross'
        ? 'Trend-Following Setup'
        : conditionBConfig.mode === 'rsi_threshold'
        ? 'Mean-Reversion Setup'
        : conditionBConfig.mode === 'relative_volume'
        ? 'Volume-Expansion Setup'
        : 'Candlestick Pattern Setup';

    const formulaA =
      conditionAConfig.mode === 'ma_cross'
        ? `Cross: ${conditionAConfig.maCross.fastType}${conditionAConfig.maCross.fastPeriod} > ${conditionAConfig.maCross.slowType}${conditionAConfig.maCross.slowPeriod}`
        : conditionAConfig.mode === 'rsi_threshold'
        ? `RSI(${conditionAConfig.rsiThreshold.period}) ${conditionAConfig.rsiThreshold.direction} ${conditionAConfig.rsiThreshold.threshold}`
        : conditionAConfig.mode === 'relative_volume'
        ? `Rel Vol ≥ ${(conditionAConfig.relativeVolume?.threshold ?? 1.5).toFixed(1)}x`
        : `${CANDLESTICK_PATTERN_LABELS[conditionAConfig.candlestickPattern]}`;

    const formulaB =
      conditionBConfig.mode === 'ma_cross'
        ? `Cross: ${conditionBConfig.maCross.fastType}${conditionBConfig.maCross.fastPeriod} > ${conditionBConfig.maCross.slowType}${conditionBConfig.maCross.slowPeriod}`
        : conditionBConfig.mode === 'rsi_threshold'
        ? `RSI(${conditionBConfig.rsiThreshold.period}) ${conditionBConfig.rsiThreshold.direction} ${conditionBConfig.rsiThreshold.threshold}`
        : conditionBConfig.mode === 'relative_volume'
        ? `Rel Vol ≥ ${(conditionBConfig.relativeVolume?.threshold ?? 1.5).toFixed(1)}x`
        : `${CANDLESTICK_PATTERN_LABELS[conditionBConfig.candlestickPattern]}`;

    const formulaCombined = `Same-session AND: (${formulaA}) AND (${formulaB})`;

    let combinedZeroNote: string;
    if (signalsA.length === 0 && signalsB.length === 0) {
      combinedZeroNote = 'Neither Condition A nor Condition B fired on this symbol, so the combined intersection has 0 trades.';
    } else if (signalsA.length === 0) {
      combinedZeroNote = 'Condition A alone had 0 signals, so the combined intersection has 0 trades.';
    } else if (signalsB.length === 0) {
      combinedZeroNote = 'Condition B alone had 0 signals, so the combined intersection has 0 trades.';
    } else {
      combinedZeroNote = `Condition A fired ${signalsA.length} time${signalsA.length === 1 ? '' : 's'} and Condition B fired ${signalsB.length} time${signalsB.length === 1 ? '' : 's'}, but they never occurred on the exact same session (0 trades).`;
    }

    return {
      signalsA,
      signalsB,
      combinedSignals,
      unionCount,
      btA,
      btB,
      btCombined,
      descA,
      descB,
      categoryA,
      categoryB,
      formulaA,
      formulaB,
      formulaCombined,
      combinedZeroNote,
    };
  }, [data, conditionAConfig, conditionBConfig, targetPct, stopPct, maxHoldingSessions]);

  const handleResetDefaults = () => {
    setTargetPct(3);
    setStopPct(2);
    setMaxHoldingSessions(20);
  };

  // Phase 17: Auto-fill hypothetical entry and stop from latest close and configured stop %
  const latestClose = useMemo(() => {
    if (!data || data.length === 0) return 0;
    return Number(data[data.length - 1].close) || 0;
  }, [data]);

  const calculatedStopPrice = useMemo(() => {
    if (latestClose <= 0) return 0;
    return Number((latestClose * (1 - stopPct / 100)).toFixed(2));
  }, [latestClose, stopPct]);

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
                <span className="absolute left-2 text-xs font-mono font-bold text-[var(--success)]">+</span>
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
                <span className="absolute left-2 text-xs font-mono font-bold text-[var(--danger)]">-</span>
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

      {/* Phase 17: Position Size Calculator (Near Target/Stop Inputs) */}
      <PositionSizeCalculator
        mode="backtest"
        symbol={symbol}
        entryPrice={latestClose}
        stopLossPrice={calculatedStopPrice}
        onSyncBacktestValues={() => ({
          entry: latestClose,
          stop: calculatedStopPrice,
        })}
      />

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
            ) : filterConfig.mode === 'rsi_threshold' ? (
              <Activity className="w-4 h-4 text-indigo-600" />
            ) : filterConfig.mode === 'relative_volume' ? (
              <BarChart3 className="w-4 h-4 text-emerald-600" />
            ) : (
              <CandlestickChart className="w-4 h-4 text-amber-600" />
            )
          }
        />
      </div>

      {/* Phase 14: Collapsible Combine Signals (2 Conditions, AND Logic) Section */}
      <div className="border-t border-neutral-200 pt-6">
        <button
          id="toggle-combine-signals-backtest-btn"
          type="button"
          onClick={() => setIsCombinedOpen(!isCombinedOpen)}
          className="w-full flex items-center justify-between p-3.5 rounded-xl bg-neutral-50 hover:bg-neutral-100/80 border border-neutral-200 hover:border-neutral-300 transition-colors text-left cursor-pointer shadow-2xs"
        >
          <div className="flex items-center gap-3">
            <span className="p-2 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200">
              <GitMerge className="w-4 h-4" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-neutral-900">
                  Combine Signals (2 Conditions, AND Logic)
                </span>
                <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded bg-neutral-200/80 text-neutral-700 border border-neutral-300">
                  Same-session intersection
                </span>
              </div>
              <p className="text-xs text-neutral-500 mt-0.5">
                Side-by-side trade execution of Condition A alone, Condition B alone, and their exact same-session intersection.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs font-semibold text-neutral-600">
            <span>{isCombinedOpen ? 'Collapse' : 'Expand Combination Lab'}</span>
            <ChevronDown
              className={`w-4 h-4 transition-transform duration-200 ${
                isCombinedOpen ? 'rotate-180' : ''
              }`}
            />
          </div>
        </button>

        {isCombinedOpen && combinedEvaluation && (
          <div className="mt-5 space-y-5">
            {/* Two Condition Pickers */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <SignalFilterPanel
                config={conditionAConfig}
                onChange={setConditionAConfig}
                title="Condition A"
                description="First independent signal rule (e.g. Trend or Reversion)"
              />
              <SignalFilterPanel
                config={conditionBConfig}
                onChange={setConditionBConfig}
                title="Condition B"
                description="Second independent signal rule (e.g. Relative Volume or Candlestick)"
              />
            </div>

            {/* Plain-language comparison line */}
            <div
              id="backtest-combination-narrowing-banner"
              className="p-3 rounded-lg bg-indigo-50/70 border border-indigo-200/80 flex items-center justify-between flex-wrap gap-2 text-xs text-indigo-950 font-medium"
            >
              <div className="flex items-center gap-2">
                <Info className="w-4 h-4 text-indigo-600 shrink-0" />
                <span>
                  {formatCombinationComparisonLine(
                    combinedEvaluation.combinedSignals.length,
                    combinedEvaluation.unionCount
                  )}
                </span>
              </div>
              <span className="text-[11px] font-mono text-indigo-800 bg-white/80 px-2 py-0.5 rounded border border-indigo-200">
                Strict same-session AND
              </span>
            </div>

            {/* Three Result Cards in Exact Order: Condition A alone, Condition B alone, Combined */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* 1. Condition A Alone */}
              <BacktestSetupCard
                title={combinedEvaluation.descA}
                category={combinedEvaluation.categoryA}
                formulaDescription={combinedEvaluation.formulaA}
                symbol={symbol}
                targetPct={targetPct}
                stopPct={stopPct}
                maxHoldingSessions={maxHoldingSessions}
                result={combinedEvaluation.btA}
                totalSignals={combinedEvaluation.signalsA.length}
                badgeLabel="Condition A Alone"
                badgeTone="blue"
                defaultExpandTable={false}
                icon={
                  conditionAConfig.mode === 'ma_cross' ? (
                    <TrendingUp className="w-4 h-4 text-blue-600" />
                  ) : conditionAConfig.mode === 'rsi_threshold' ? (
                    <Activity className="w-4 h-4 text-indigo-600" />
                  ) : conditionAConfig.mode === 'relative_volume' ? (
                    <BarChart3 className="w-4 h-4 text-emerald-600" />
                  ) : (
                    <CandlestickChart className="w-4 h-4 text-amber-600" />
                  )
                }
              />

              {/* 2. Condition B Alone */}
              <BacktestSetupCard
                title={combinedEvaluation.descB}
                category={combinedEvaluation.categoryB}
                formulaDescription={combinedEvaluation.formulaB}
                symbol={symbol}
                targetPct={targetPct}
                stopPct={stopPct}
                maxHoldingSessions={maxHoldingSessions}
                result={combinedEvaluation.btB}
                totalSignals={combinedEvaluation.signalsB.length}
                badgeLabel="Condition B Alone"
                badgeTone="emerald"
                defaultExpandTable={false}
                icon={
                  conditionBConfig.mode === 'ma_cross' ? (
                    <TrendingUp className="w-4 h-4 text-blue-600" />
                  ) : conditionBConfig.mode === 'rsi_threshold' ? (
                    <Activity className="w-4 h-4 text-indigo-600" />
                  ) : conditionBConfig.mode === 'relative_volume' ? (
                    <BarChart3 className="w-4 h-4 text-emerald-600" />
                  ) : (
                    <CandlestickChart className="w-4 h-4 text-amber-600" />
                  )
                }
              />

              {/* 3. Combined (A AND B) */}
              <BacktestSetupCard
                title={`${combinedEvaluation.descA} AND ${combinedEvaluation.descB}`}
                category="Combined Setup (AND Logic)"
                formulaDescription={combinedEvaluation.formulaCombined}
                symbol={symbol}
                targetPct={targetPct}
                stopPct={stopPct}
                maxHoldingSessions={maxHoldingSessions}
                result={combinedEvaluation.btCombined}
                totalSignals={combinedEvaluation.combinedSignals.length}
                badgeLabel="Combined (A AND B)"
                badgeTone="indigo"
                zeroTradesNote={combinedEvaluation.combinedZeroNote}
                isCombinedCard={true}
                defaultExpandTable={false}
                icon={<GitMerge className="w-4 h-4 text-indigo-600" />}
              />
            </div>
          </div>
        )}
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
  badgeLabel?: string;
  badgeTone?: 'neutral' | 'blue' | 'indigo' | 'emerald';
  zeroTradesNote?: string;
  isCombinedCard?: boolean;
  defaultExpandTable?: boolean;
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
  badgeLabel,
  badgeTone = 'neutral',
  zeroTradesNote,
  isCombinedCard = false,
  defaultExpandTable = true,
}) => {
  const [isTableExpanded, setIsTableExpanded] = useState<boolean>(defaultExpandTable);

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
  const isUltraLowSampleSize = totalTrades > 0 && totalTrades < 3;
  const hasZeroTrades = totalTrades === 0;

  return (
    <div className="border border-neutral-200 rounded-xl bg-white flex flex-col justify-between overflow-hidden shadow-2xs">
      {/* Card Header */}
      <div className="p-4 border-b border-neutral-100 bg-neutral-50/50">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              {icon}
              <h4 className="font-bold text-neutral-900 text-base">{title}</h4>
              {badgeLabel && (
                <span
                  className={`text-[10px] font-mono px-2 py-0.5 rounded font-semibold uppercase tracking-wider ${
                    badgeTone === 'indigo'
                      ? 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                      : badgeTone === 'blue'
                      ? 'bg-blue-100 text-blue-800 border border-blue-200'
                      : badgeTone === 'emerald'
                      ? 'bg-[var(--success)]/10 text-[var(--success)] border border-[var(--success)]/20'
                      : 'bg-neutral-200/80 text-neutral-800 border border-neutral-300'
                  }`}
                >
                  {badgeLabel}
                </span>
              )}
            </div>
            <div className="text-[11px] text-neutral-500 font-medium mt-0.5">{category}</div>
          </div>
          <div className="flex items-center gap-1.5 font-mono text-[10px] flex-wrap">
            <span className="bg-[var(--success)]/10 text-[var(--success)] border border-[var(--success)]/20 px-2 py-0.5 rounded font-semibold">
              Target: +{targetPct}%
            </span>
            <span className="bg-[var(--danger)]/10 text-[var(--danger)] border border-[var(--danger)]/20 px-2 py-0.5 rounded font-semibold">
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
            {zeroTradesNote ? (
              <p className="text-[11px] text-neutral-500 mt-1 max-w-sm mx-auto font-sans">
                {zeroTradesNote}
              </p>
            ) : excludedTrades > 0 ? (
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
                        ? 'text-[var(--success)]'
                        : 'text-[var(--danger)]'
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
                  <div className="text-[var(--success)] flex justify-between">
                    <span>Avg Win:</span>
                    <span>{avgWinReturn !== null ? `+${avgWinReturn.toFixed(2)}%` : '—'}</span>
                  </div>
                  <div className="text-[var(--danger)] flex justify-between">
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
                  <span className="text-[var(--success)] font-medium">{wins}W</span> /{' '}
                  <span className="text-[var(--danger)] font-medium">{losses}L</span> /{' '}
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

            {/* Ultra-low Sample (<3) Honest Caveat */}
            {isUltraLowSampleSize ? (
              <CautionNotice
                id="backtest-ultra-low-sample-alert"
                severity="critical"
                title="Too few trades to draw any conclusion:"
              >
                Only{' '}
                <span className="font-bold">{totalTrades} trade{totalTrades === 1 ? '' : 's'}</span> simulated.
                A win rate ({winRate !== null ? `${winRate.toFixed(1)}%` : '—'}) based on {totalTrades} trade{totalTrades === 1 ? '' : 's'} does not provide statistical confidence.
              </CautionNotice>
            ) : isLowSampleSize ? (
              /* Standard Low Sample Size (<10) Caveat */
              <CautionNotice
                id="backtest-low-sample-alert"
                severity="caution"
                title="Low sample size caveat:"
              >
                Only{' '}
                <span className="font-bold">{totalTrades} trades</span> occurred in the entire
                historical record for {symbol}. Small sample sizes are sensitive to market variance
                and cannot confirm statistical significance. Treat win rate and expectancy with caution.
              </CautionNotice>
            ) : null}
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
                              ? 'bg-[var(--success)]/[0.04]'
                              : isLoss
                              ? 'bg-[var(--danger)]/[0.03]'
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
                            className={`py-1.5 px-2.5 text-right font-bold font-mono ${
                              trade.returnPct > 0
                                ? 'text-[var(--success)]'
                                : trade.returnPct < 0
                                ? 'text-[var(--danger)]'
                                : 'text-neutral-600'
                            }`}
                          >
                            {trade.returnPct >= 0 ? '+' : ''}
                            {trade.returnPct.toFixed(2)}%
                          </td>
                          <td className="py-1.5 px-2.5">
                            {isWin ? (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-[var(--success)]/10 text-[var(--success)] border border-[var(--success)]/20">
                                <CheckCircle2 className="w-3 h-3 text-[var(--success)] shrink-0" strokeWidth={2} />
                                Target (+{targetPct}%)
                              </span>
                            ) : isLoss ? (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-[var(--danger)]/10 text-[var(--danger)] border border-[var(--danger)]/20">
                                <XCircle className="w-3 h-3 text-[var(--danger)] shrink-0" strokeWidth={2} />
                                Stop (-{stopPct}%)
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400 border border-neutral-200 dark:border-neutral-700">
                                <Clock className="w-3 h-3 text-neutral-400 shrink-0" strokeWidth={2} />
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
