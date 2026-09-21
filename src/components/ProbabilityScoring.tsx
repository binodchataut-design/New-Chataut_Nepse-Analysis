import React, { useState, useMemo } from 'react';
import {
  PriceRecordWithIndicators,
  SetupScoreResult,
  SignalFilterConfig,
  DEFAULT_SIGNAL_FILTER_CONFIG,
  CANDLESTICK_PATTERN_LABELS,
} from '../types';
import {
  scoreSetup,
  computeSignalsFromConfig,
  getSignalSetupDescription,
} from '../lib/probabilityScoring';
import {
  combineSignalsAND,
  getUnionSessionCount,
  formatCombinationComparisonLine,
} from '../lib/signalCombination';
import { SignalFilterPanel } from './SignalFilterPanel';
import { ConfiguredMarketScanner } from './ConfiguredMarketScanner';
import {
  TrendingUp,
  RotateCcw,
  AlertTriangle,
  Info,
  CheckCircle2,
  XCircle,
  Clock,
  Layers,
  Activity,
  CandlestickChart,
  BarChart3,
  ChevronDown,
  GitMerge,
} from 'lucide-react';

interface ProbabilityScoringProps {
  symbol: string;
  data: PriceRecordWithIndicators[];
  isLoading: boolean;
  onSelectSymbolAndNavigate?: (symbol: string) => void;
}

export const ProbabilityScoring: React.FC<ProbabilityScoringProps> = ({
  symbol,
  data,
  isLoading,
  onSelectSymbolAndNavigate,
}) => {
  // Configurable signal filter definition (MA Cross or RSI Threshold)
  const [filterConfig, setFilterConfig] = useState<SignalFilterConfig>(DEFAULT_SIGNAL_FILTER_CONFIG);

  // Configurable forward window and threshold with defaults 10 sessions / 2%
  const [forwardSessions, setForwardSessions] = useState<number>(10);
  const [thresholdPercent, setThresholdPercent] = useState<number>(2.0);

  // Phase 14: Combine Signals state (default collapsed, Condition A & Condition B)
  const [isCombinedOpen, setIsCombinedOpen] = useState<boolean>(false);
  const [conditionAConfig, setConditionAConfig] = useState<SignalFilterConfig>(DEFAULT_SIGNAL_FILTER_CONFIG);
  const [conditionBConfig, setConditionBConfig] = useState<SignalFilterConfig>({
    ...DEFAULT_SIGNAL_FILTER_CONFIG,
    mode: 'relative_volume',
    relativeVolume: { threshold: 1.5 },
  });

  // Compute signals from config and score the setup dynamically
  const { scoreResult, signalCount, setupTitle, setupFormula, setupCategory } = useMemo(() => {
    if (!data || data.length === 0) {
      return {
        scoreResult: null,
        signalCount: 0,
        setupTitle: '',
        setupFormula: '',
        setupCategory: '',
      };
    }

    const { signals } = computeSignalsFromConfig(data, filterConfig);
    const result = scoreSetup(data, signals, forwardSessions, thresholdPercent);
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
        ? `${filterConfig.maCross.fastType.toLowerCase()}${filterConfig.maCross.fastPeriod}[i-1] <= ${filterConfig.maCross.slowType.toLowerCase()}${filterConfig.maCross.slowPeriod}[i-1] AND ${filterConfig.maCross.fastType.toLowerCase()}${filterConfig.maCross.fastPeriod}[i] > ${filterConfig.maCross.slowType.toLowerCase()}${filterConfig.maCross.slowPeriod}[i]`
        : filterConfig.mode === 'rsi_threshold'
        ? `rsi${filterConfig.rsiThreshold.period}[i-1] ${filterConfig.rsiThreshold.direction === 'recovery' ? '<' : '>'} ${filterConfig.rsiThreshold.threshold} AND rsi${filterConfig.rsiThreshold.period}[i] ${filterConfig.rsiThreshold.direction === 'recovery' ? '>=' : '<='} ${filterConfig.rsiThreshold.threshold}`
        : filterConfig.mode === 'relative_volume'
        ? `volume[i] >= ${(filterConfig.relativeVolume?.threshold ?? 1.5).toFixed(1)}x of 20-session average volume`
        : `${CANDLESTICK_PATTERN_LABELS[filterConfig.candlestickPattern]} candlestick pattern geometry satisfied at session i`;

    return {
      scoreResult: result,
      signalCount: signals.length,
      setupTitle: desc,
      setupFormula: formula,
      setupCategory: category,
    };
  }, [data, filterConfig, forwardSessions, thresholdPercent]);

  // Phase 14: Compute 2-condition combination (A alone, B alone, Combined intersection)
  const combinedEvaluation = useMemo(() => {
    if (!data || data.length === 0) return null;

    const { signals: signalsA } = computeSignalsFromConfig(data, conditionAConfig);
    const { signals: signalsB } = computeSignalsFromConfig(data, conditionBConfig);
    const combinedSignals = combineSignalsAND(signalsA, signalsB);
    const unionCount = getUnionSessionCount(signalsA, signalsB);

    const scoreA = scoreSetup(data, signalsA, forwardSessions, thresholdPercent);
    const scoreB = scoreSetup(data, signalsB, forwardSessions, thresholdPercent);
    const scoreCombined = scoreSetup(data, combinedSignals, forwardSessions, thresholdPercent);

    const descA = getSignalSetupDescription(conditionAConfig);
    const descB = getSignalSetupDescription(conditionBConfig);

    const categoryA =
      conditionAConfig.mode === 'ma_cross'
        ? 'Trend-Following'
        : conditionAConfig.mode === 'rsi_threshold'
        ? 'Mean-Reversion'
        : conditionAConfig.mode === 'relative_volume'
        ? 'Volume-Expansion'
        : 'Candlestick Pattern';

    const categoryB =
      conditionBConfig.mode === 'ma_cross'
        ? 'Trend-Following'
        : conditionBConfig.mode === 'rsi_threshold'
        ? 'Mean-Reversion'
        : conditionBConfig.mode === 'relative_volume'
        ? 'Volume-Expansion'
        : 'Candlestick Pattern';

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

    const formulaCombined = `Same-session AND intersection: (${formulaA}) AND (${formulaB})`;

    // Honest zero-occurrence explanation for Combined
    let combinedZeroNote: string;
    if (signalsA.length === 0 && signalsB.length === 0) {
      combinedZeroNote = 'Neither Condition A nor Condition B fired on this symbol, so the combined intersection is necessarily zero.';
    } else if (signalsA.length === 0) {
      combinedZeroNote = 'Condition A alone had 0 occurrences, so the combined intersection is necessarily zero.';
    } else if (signalsB.length === 0) {
      combinedZeroNote = 'Condition B alone had 0 occurrences, so the combined intersection is necessarily zero.';
    } else {
      combinedZeroNote = `Condition A fired ${signalsA.length} time${signalsA.length === 1 ? '' : 's'} and Condition B fired ${signalsB.length} time${signalsB.length === 1 ? '' : 's'}, but they never occurred on the exact same session (0 intersection).`;
    }

    return {
      signalsA,
      signalsB,
      combinedSignals,
      unionCount,
      scoreA,
      scoreB,
      scoreCombined,
      descA,
      descB,
      categoryA,
      categoryB,
      formulaA,
      formulaB,
      formulaCombined,
      combinedZeroNote,
    };
  }, [data, conditionAConfig, conditionBConfig, forwardSessions, thresholdPercent]);

  const handleResetScoringParams = () => {
    setForwardSessions(10);
    setThresholdPercent(2.0);
  };

  if (isLoading) {
    return (
      <div className="w-full bg-white border border-neutral-200 rounded-xl p-6 text-center text-neutral-500">
        <div className="w-6 h-6 border-2 border-neutral-900 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
        <div className="text-sm">Calculating probability scoring across historical sessions...</div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return null;
  }

  return (
    <div className="w-full bg-white border border-neutral-200 rounded-xl shadow-xs overflow-hidden">
      {/* Header & Parameters Section */}
      <div className="p-4 sm:p-5 border-b border-neutral-200 bg-neutral-50/70">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-md bg-neutral-900 text-white">
                <Layers className="w-4 h-4" />
              </span>
              <h3 className="text-lg font-bold text-neutral-900">
                Probability Scoring (Historical Setup Hit Rates)
              </h3>
            </div>
            <p className="text-xs text-neutral-500 mt-1 max-w-2xl">
              Statistical evaluation of how often price moved favorably after specific technical
              setups occurred for <span className="font-mono font-semibold text-neutral-800">{symbol}</span>.
              Calculated on forward close vs signal close (no simulated stops or targets).
            </p>
          </div>

          {/* Interactive Scoring Parameters Bar */}
          <div className="flex flex-wrap items-center gap-3 bg-white p-2.5 rounded-lg border border-neutral-200 shadow-2xs">
            {/* Forward Window Input */}
            <div className="flex items-center gap-2">
              <label htmlFor="forward-window-input" className="text-xs font-medium text-neutral-600">
                Forward Window (N):
              </label>
              <div className="relative">
                <input
                  id="forward-window-input"
                  type="number"
                  min={1}
                  max={100}
                  step={1}
                  value={forwardSessions}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    setForwardSessions(isNaN(val) || val < 1 ? 1 : val);
                  }}
                  className="w-16 px-2 py-1 text-xs font-mono font-bold text-neutral-900 border border-neutral-300 rounded focus:ring-1 focus:ring-neutral-900 focus:outline-none"
                />
                <span className="text-[10px] text-neutral-400 ml-1">sessions</span>
              </div>
            </div>

            <div className="h-4 w-px bg-neutral-200 hidden sm:block"></div>

            {/* Threshold Input */}
            <div className="flex items-center gap-2">
              <label htmlFor="threshold-input" className="text-xs font-medium text-neutral-600">
                Threshold:
              </label>
              <div className="relative flex items-center">
                <input
                  id="threshold-input"
                  type="number"
                  min={-50}
                  max={100}
                  step={0.5}
                  value={thresholdPercent}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    setThresholdPercent(isNaN(val) ? 0 : val);
                  }}
                  className="w-16 px-2 py-1 text-xs font-mono font-bold text-neutral-900 border border-neutral-300 rounded focus:ring-1 focus:ring-neutral-900 focus:outline-none"
                />
                <span className="text-xs text-neutral-500 ml-1">%</span>
              </div>
            </div>

            {/* Reset Defaults button */}
            {(forwardSessions !== 10 || thresholdPercent !== 2.0) && (
              <button
                id="reset-scoring-params-btn"
                onClick={handleResetScoringParams}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-neutral-600 hover:text-neutral-900 px-2 py-1 rounded bg-neutral-100 hover:bg-neutral-200 transition-colors ml-auto"
                title="Reset to default 10 sessions / 2.0%"
              >
                <RotateCcw className="w-3 h-3" />
                Reset (10s / 2%)
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Signal Filter Definition Panel */}
      <div className="p-4 sm:p-5 border-b border-neutral-200 bg-neutral-50/50">
        <SignalFilterPanel
          config={filterConfig}
          onChange={setFilterConfig}
          title="Setup Definition"
          description="Configure the indicator type, periods, or thresholds that define the entry trigger for this setup."
        />
      </div>

      {/* Single Dynamic Setup Scoring Card */}
      <div className="p-4 sm:p-5">
        <SetupCard
          title={setupTitle}
          category={setupCategory}
          formulaDescription={setupFormula}
          symbol={symbol}
          forwardSessions={forwardSessions}
          thresholdPercent={thresholdPercent}
          scoreResult={scoreResult}
          totalSignalsDetected={signalCount}
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
      <div className="border-t border-neutral-200 bg-neutral-50/40">
        <div className="p-4 sm:p-5">
          <button
            id="toggle-combine-signals-btn"
            type="button"
            onClick={() => setIsCombinedOpen(!isCombinedOpen)}
            className="w-full flex items-center justify-between p-3.5 rounded-xl bg-white border border-neutral-200 hover:border-neutral-300 transition-colors text-left cursor-pointer shadow-2xs"
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
                  <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded bg-neutral-100 text-neutral-700 border border-neutral-200">
                    Same-session intersection
                  </span>
                </div>
                <p className="text-xs text-neutral-500 mt-0.5">
                  Side-by-side evaluation of Condition A alone, Condition B alone, and their exact same-session intersection.
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
                id="combination-narrowing-banner"
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
                <SetupCard
                  title={combinedEvaluation.descA}
                  category={combinedEvaluation.categoryA}
                  formulaDescription={combinedEvaluation.formulaA}
                  symbol={symbol}
                  forwardSessions={forwardSessions}
                  thresholdPercent={thresholdPercent}
                  scoreResult={combinedEvaluation.scoreA}
                  totalSignalsDetected={combinedEvaluation.signalsA.length}
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
                <SetupCard
                  title={combinedEvaluation.descB}
                  category={combinedEvaluation.categoryB}
                  formulaDescription={combinedEvaluation.formulaB}
                  symbol={symbol}
                  forwardSessions={forwardSessions}
                  thresholdPercent={thresholdPercent}
                  scoreResult={combinedEvaluation.scoreB}
                  totalSignalsDetected={combinedEvaluation.signalsB.length}
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
                <SetupCard
                  title={`${combinedEvaluation.descA} AND ${combinedEvaluation.descB}`}
                  category="Combined Setup (AND Logic)"
                  formulaDescription={combinedEvaluation.formulaCombined}
                  symbol={symbol}
                  forwardSessions={forwardSessions}
                  thresholdPercent={thresholdPercent}
                  scoreResult={combinedEvaluation.scoreCombined}
                  totalSignalsDetected={combinedEvaluation.combinedSignals.length}
                  badgeLabel="Combined (A AND B)"
                  badgeTone="indigo"
                  zeroOccurrenceNote={combinedEvaluation.combinedZeroNote}
                  isCombinedCard={true}
                  defaultExpandTable={false}
                  icon={<GitMerge className="w-4 h-4 text-indigo-600" />}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Phase 15: Market-Wide Ranking by Configurable Setup */}
      <ConfiguredMarketScanner
        conditionAConfig={isCombinedOpen ? conditionAConfig : filterConfig}
        conditionBConfig={isCombinedOpen ? conditionBConfig : undefined}
        isCombined={isCombinedOpen}
        setupDescription={
          isCombinedOpen
            ? `${combinedEvaluation?.descA || 'Condition A'} AND ${combinedEvaluation?.descB || 'Condition B'}`
            : setupTitle
        }
        forwardSessions={forwardSessions}
        thresholdPercent={thresholdPercent}
        onSelectSymbolAndNavigate={onSelectSymbolAndNavigate}
      />
    </div>
  );
};

interface SetupCardProps {
  title: string;
  category: string;
  formulaDescription: string;
  symbol: string;
  forwardSessions: number;
  thresholdPercent: number;
  scoreResult: SetupScoreResult | null;
  totalSignalsDetected: number;
  icon: React.ReactNode;
  badgeLabel?: string;
  badgeTone?: 'neutral' | 'blue' | 'indigo' | 'emerald';
  zeroOccurrenceNote?: string;
  isCombinedCard?: boolean;
  defaultExpandTable?: boolean;
}

const SetupCard: React.FC<SetupCardProps> = ({
  title,
  category,
  formulaDescription,
  symbol,
  forwardSessions,
  thresholdPercent,
  scoreResult,
  totalSignalsDetected,
  icon,
  badgeLabel,
  badgeTone = 'neutral',
  zeroOccurrenceNote,
  isCombinedCard = false,
  defaultExpandTable = true,
}) => {
  const [isTableExpanded, setIsTableExpanded] = useState<boolean>(defaultExpandTable);

  if (!scoreResult) {
    return (
      <div className="border border-neutral-200 rounded-lg p-5 bg-neutral-50 text-neutral-500 text-xs">
        Loading setup calculations...
      </div>
    );
  }

  const {
    totalOccurrences,
    excludedOccurrences,
    successCount,
    hitRate,
    avgForwardReturn,
    occurrences,
  } = scoreResult;

  const isLowSampleSize = totalOccurrences > 0 && totalOccurrences < 10;
  const isUltraLowSampleSize = totalOccurrences > 0 && totalOccurrences < 3;
  const hasZeroTotal = totalOccurrences === 0;

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
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                      : 'bg-neutral-200/80 text-neutral-800 border border-neutral-300'
                  }`}
                >
                  {badgeLabel}
                </span>
              )}
            </div>
            <div className="text-[11px] text-neutral-500 font-medium mt-0.5">{category}</div>
          </div>
          <span className="text-[10px] font-mono bg-neutral-200/70 text-neutral-700 px-2 py-0.5 rounded shrink-0">
            Target: +{thresholdPercent}% @ {forwardSessions}d
          </span>
        </div>
        <div className="text-[10px] font-mono text-neutral-400 mt-2 bg-white px-2 py-1 rounded border border-neutral-200/80">
          Trigger: {formulaDescription}
        </div>
      </div>

      {/* Honest State Handling */}
      <div className="p-4 space-y-4">
        {/* Zero Occurrences Honest State */}
        {hasZeroTotal ? (
          <div className="p-4 rounded-lg bg-neutral-50 border border-neutral-200 text-center">
            <Info className="w-5 h-5 text-neutral-400 mx-auto mb-1.5" />
            <div className="font-semibold text-xs text-neutral-800">
              No historical occurrences of this setup for {symbol}
            </div>
            {zeroOccurrenceNote ? (
              <p className="text-[11px] text-neutral-500 mt-1 max-w-sm mx-auto font-sans">
                {zeroOccurrenceNote}
              </p>
            ) : excludedOccurrences > 0 ? (
              <p className="text-[11px] text-neutral-500 mt-1 max-w-sm mx-auto">
                {excludedOccurrences} occurrence was detected, but it occurred within the last {forwardSessions}{' '}
                sessions and does not yet have enough forward history to score.
              </p>
            ) : (
              <p className="text-[11px] text-neutral-500 mt-1 max-w-sm mx-auto">
                Neither signal fired in the recorded historical sessions for this symbol.
                Hit rate and return cannot be calculated.
              </p>
            )}
          </div>
        ) : (
          <>
            {/* Primary Metrics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {/* Hit Rate Metric */}
              <div className="p-3 rounded-lg bg-neutral-50 border border-neutral-100">
                <div className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider">
                  Hit Rate
                </div>
                <div className="text-xl font-bold font-mono text-neutral-900 mt-0.5">
                  {hitRate !== null ? `${hitRate.toFixed(1)}%` : '—'}
                </div>
                <div className="text-[11px] text-neutral-600 font-mono mt-0.5">
                  <span className="font-bold text-neutral-900">{successCount}</span> of{' '}
                  <span className="font-bold text-neutral-900">{totalOccurrences}</span> scored
                </div>
              </div>

              {/* Avg Forward Return */}
              <div className="p-3 rounded-lg bg-neutral-50 border border-neutral-100">
                <div className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider">
                  Avg Forward Return
                </div>
                <div
                  className={`text-xl font-bold font-mono mt-0.5 ${
                    avgForwardReturn !== null && avgForwardReturn >= 0
                      ? 'text-emerald-700'
                      : 'text-rose-700'
                  }`}
                >
                  {avgForwardReturn !== null
                    ? `${avgForwardReturn >= 0 ? '+' : ''}${avgForwardReturn.toFixed(2)}%`
                    : '—'}
                </div>
                <div className="text-[11px] text-neutral-500 mt-0.5">
                  over {forwardSessions} sessions
                </div>
              </div>

              {/* Occurrence Accounting */}
              <div className="p-3 rounded-lg bg-neutral-50 border border-neutral-100 col-span-2 sm:col-span-1">
                <div className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider">
                  Signals Evaluated
                </div>
                <div className="text-xl font-bold font-mono text-neutral-900 mt-0.5">
                  {totalSignalsDetected}
                </div>
                <div className="text-[11px] text-neutral-500 font-mono mt-0.5">
                  {excludedOccurrences > 0 ? (
                    <span className="text-amber-700 font-medium">
                      {excludedOccurrences} excluded (too recent)
                    </span>
                  ) : (
                    <span className="text-neutral-500">0 excluded</span>
                  )}
                </div>
              </div>
            </div>

            {/* Ultra-low Sample (<3) Honest Caveat */}
            {isUltraLowSampleSize ? (
              <div className="flex items-start gap-2 p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-900 text-xs">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold">Too few occurrences to draw any conclusion:</span> Only{' '}
                  <span className="font-bold">{totalOccurrences} occurrence{totalOccurrences === 1 ? '' : 's'}</span> exist in data.
                  A hit rate ({hitRate !== null ? `${hitRate.toFixed(1)}%` : '—'}) calculated on {totalOccurrences} session{totalOccurrences === 1 ? '' : 's'} does not constitute reliable statistical evidence.
                </div>
              </div>
            ) : isLowSampleSize ? (
              /* Standard Low Sample Size (<10) Caveat */
              <div className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold">Low sample size caveat:</span> Only{' '}
                  <span className="font-bold">{totalOccurrences} occurrences</span> exist in the entire
                  historical record for {symbol}. Treat this hit rate with caution — small samples cannot
                  provide statistical significance.
                </div>
              </div>
            ) : null}

            {/* Note on Excluded Occurrences if any */}
            {excludedOccurrences > 0 && (
              <div className="flex items-center gap-2 text-xs text-neutral-600 bg-neutral-50 px-3 py-2 rounded border border-neutral-200">
                <Clock className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
                <span>
                  <strong className="font-semibold">{excludedOccurrences} occurrence(s)</strong> occurred
                  within the last {forwardSessions} sessions and are excluded from scoring until their forward
                  window completes.
                </span>
              </div>
            )}
          </>
        )}

        {/* Spot-Check Occurrence Table */}
        {occurrences.length > 0 && (
          <div className="pt-2">
            <div className="flex items-center justify-between pb-2 border-b border-neutral-100">
              <span className="text-xs font-bold text-neutral-700 uppercase tracking-wider">
                Individual Occurrences Spot-Check ({occurrences.length})
              </span>
              <button
                onClick={() => setIsTableExpanded(!isTableExpanded)}
                className="text-xs text-neutral-500 hover:text-neutral-900 font-medium underline"
              >
                {isTableExpanded ? 'Hide table' : 'Show table'}
              </button>
            </div>

            {isTableExpanded && (
              <div className="mt-2 overflow-x-auto max-h-60 overflow-y-auto border border-neutral-200 rounded-lg">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-neutral-100 text-neutral-600 text-[10px] uppercase sticky top-0 border-b border-neutral-200">
                    <tr>
                      <th className="py-2 px-2.5">#</th>
                      <th className="py-2 px-2.5">Signal Date</th>
                      <th className="py-2 px-2.5">Signal Close</th>
                      <th className="py-2 px-2.5">Outcome Date (+{forwardSessions}s)</th>
                      <th className="py-2 px-2.5">Outcome Close</th>
                      <th className="py-2 px-2.5">Return (%)</th>
                      <th className="py-2 px-2.5">Worked?</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {occurrences.map((occ, idx) => {
                      if (occ.isExcluded) {
                        return (
                          <tr key={`occ-ex-${idx}`} className="bg-amber-50/40 text-neutral-500">
                            <td className="py-1.5 px-2.5">{idx + 1}</td>
                            <td className="py-1.5 px-2.5 font-bold text-neutral-800">{occ.signalDate}</td>
                            <td className="py-1.5 px-2.5">NPR {occ.signalClose.toFixed(1)}</td>
                            <td className="py-1.5 px-2.5 italic text-amber-700" colSpan={3}>
                              Pending: only {occ.sessionsAvailable ?? 0} session(s) elapsed (needs {forwardSessions})
                            </td>
                            <td className="py-1.5 px-2.5">
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-neutral-200 text-neutral-600">
                                Excluded
                              </span>
                            </td>
                          </tr>
                        );
                      }

                      return (
                        <tr
                          key={`occ-${idx}`}
                          className={`hover:bg-neutral-50 ${
                            occ.worked ? 'bg-emerald-50/20' : 'bg-rose-50/10'
                          }`}
                        >
                          <td className="py-1.5 px-2.5 text-neutral-400">{idx + 1}</td>
                          <td className="py-1.5 px-2.5 font-bold text-neutral-900">{occ.signalDate}</td>
                          <td className="py-1.5 px-2.5 text-neutral-700">
                            NPR {occ.signalClose.toFixed(1)}
                          </td>
                          <td className="py-1.5 px-2.5 text-neutral-600">{occ.outcomeDate}</td>
                          <td className="py-1.5 px-2.5 text-neutral-700">
                            {occ.outcomeClose !== null ? `NPR ${occ.outcomeClose.toFixed(1)}` : '—'}
                          </td>
                          <td
                            className={`py-1.5 px-2.5 font-bold ${
                              occ.forwardReturn !== null && occ.forwardReturn >= 0
                                ? 'text-emerald-700'
                                : 'text-rose-700'
                            }`}
                          >
                            {occ.forwardReturn !== null
                              ? `${occ.forwardReturn >= 0 ? '+' : ''}${occ.forwardReturn.toFixed(2)}%`
                              : '—'}
                          </td>
                          <td className="py-1.5 px-2.5">
                            {occ.worked ? (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                Worked (≥+{thresholdPercent}%)
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800">
                                <XCircle className="w-3 h-3 text-rose-600" />
                                No (&lt;+{thresholdPercent}%)
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
