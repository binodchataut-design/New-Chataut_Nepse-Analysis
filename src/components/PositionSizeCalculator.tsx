import React, { useState, useEffect, useMemo } from 'react';
import {
  Calculator,
  AlertTriangle,
  Info,
  CheckCircle2,
  RotateCcw,
  Layers,
  Activity,
  ArrowRight,
  Shield,
} from 'lucide-react';
import {
  TradeJournalEntry,
  LiquidityMetrics,
} from '../types';
import {
  calculatePositionSize,
  checkConcentration,
  checkLiquidityFeasibility,
} from '../lib/riskManagement';

export interface PositionSizeCalculatorProps {
  /** 'backtest' for hypothetical trade sizing; 'journal' for real entry risk checks */
  mode: 'backtest' | 'journal';
  symbol: string;
  /** Initial or synced entry price */
  entryPrice?: number;
  /** Initial or synced stop-loss price */
  stopLossPrice?: number;
  /** Optional callback to apply calculated shares into an external form field (e.g. Journal) */
  onApplyShares?: (shares: number) => void;
  /** Existing open positions in Journal (used for concentration check) */
  openPositions?: TradeJournalEntry[];
  /** Liquidity metrics for the symbol from Phase 13 (used for volume feasibility check) */
  liquidityMetrics?: LiquidityMetrics | null;
  isLiquidityLoading?: boolean;
  /** If provided, overrides internal entry/stop values from external form inputs */
  controlledEntryPrice?: string;
  controlledStopLossPrice?: string;
  controlledShares?: string;
  onSyncBacktestValues?: () => { entry: number; stop: number };
}

export const PositionSizeCalculator: React.FC<PositionSizeCalculatorProps> = ({
  mode,
  symbol,
  entryPrice = 0,
  stopLossPrice = 0,
  onApplyShares,
  openPositions = [],
  liquidityMetrics,
  isLiquidityLoading = false,
  controlledEntryPrice,
  controlledStopLossPrice,
  controlledShares,
  onSyncBacktestValues,
}) => {
  // Session-scoped state (remembered in component state, not persisted)
  const [accountSizeInput, setAccountSizeInput] = useState<string>('500000');
  const [riskPctInput, setRiskPctInput] = useState<string>('2.0');

  // Local entry/stop inputs if not controlled externally
  const [localEntryPrice, setLocalEntryPrice] = useState<string>(
    entryPrice > 0 ? entryPrice.toString() : ''
  );
  const [localStopPrice, setLocalStopPrice] = useState<string>(
    stopLossPrice > 0 ? stopLossPrice.toString() : ''
  );

  // Sync with incoming props if changed
  useEffect(() => {
    if (controlledEntryPrice !== undefined) {
      setLocalEntryPrice(controlledEntryPrice);
    } else if (entryPrice > 0) {
      setLocalEntryPrice(entryPrice.toString());
    }
  }, [controlledEntryPrice, entryPrice]);

  useEffect(() => {
    if (controlledStopLossPrice !== undefined) {
      setLocalStopPrice(controlledStopLossPrice);
    } else if (stopLossPrice > 0) {
      setLocalStopPrice(stopLossPrice.toString());
    }
  }, [controlledStopLossPrice, stopLossPrice]);

  const activeEntryPrice = parseFloat(localEntryPrice) || 0;
  const activeStopPrice = parseFloat(localStopPrice) || 0;
  const activeAccountSize = parseFloat(accountSizeInput) || 0;
  const activeRiskPct = parseFloat(riskPctInput) || 0;

  // 1. Pure Position Size Calculation
  const sizingResult = useMemo(() => {
    return calculatePositionSize(
      activeAccountSize,
      activeRiskPct,
      activeEntryPrice,
      activeStopPrice
    );
  }, [activeAccountSize, activeRiskPct, activeEntryPrice, activeStopPrice]);

  // Determine effective shares to check: if user in journal already typed a custom share size, evaluate that too
  const effectiveShares = useMemo(() => {
    if (controlledShares !== undefined && controlledShares.trim() !== '') {
      const parsed = parseFloat(controlledShares);
      if (!isNaN(parsed) && parsed > 0) return parsed;
    }
    return sizingResult.shares;
  }, [controlledShares, sizingResult.shares]);

  const effectivePositionValue = useMemo(() => {
    return effectiveShares * activeEntryPrice;
  }, [effectiveShares, activeEntryPrice]);

  // 2. Concentration Check (Phase 12 journal open positions)
  const concentrationResult = useMemo(() => {
    return checkConcentration(
      openPositions,
      effectivePositionValue,
      activeAccountSize,
      symbol
    );
  }, [openPositions, effectivePositionValue, activeAccountSize, symbol]);

  // 3. Liquidity Feasibility Check (Phase 13 liquidity metrics)
  const liquidityCheck = useMemo(() => {
    return checkLiquidityFeasibility(effectiveShares, liquidityMetrics);
  }, [effectiveShares, liquidityMetrics]);

  const handleSyncBacktest = () => {
    if (onSyncBacktestValues) {
      const vals = onSyncBacktestValues();
      setLocalEntryPrice(vals.entry > 0 ? vals.entry.toFixed(2) : '');
      setLocalStopPrice(vals.stop > 0 ? vals.stop.toFixed(2) : '');
    }
  };

  return (
    <div
      id={`position-size-calculator-${mode}`}
      className="p-4 sm:p-5 bg-white border border-neutral-200 rounded-xl shadow-xs space-y-4 text-neutral-900"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-neutral-100 pb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-neutral-900 text-white shadow-2xs">
            <Calculator className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs sm:text-sm font-bold text-neutral-900">
              Position Size Calculator &amp; Risk Controls
            </h4>
            <p className="text-[11px] text-neutral-500">
              Pure-math capital allocation based on NPR account size, acceptable risk %, and stop-loss distance.
            </p>
          </div>
        </div>

        {mode === 'backtest' && onSyncBacktestValues && (
          <button
            type="button"
            onClick={handleSyncBacktest}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-neutral-600 bg-neutral-100 hover:bg-neutral-200 rounded-md transition-colors cursor-pointer self-start sm:self-auto"
            title="Reset entry to latest close and stop-loss to backtest stop %"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Sync with Backtest Parameters</span>
          </button>
        )}
      </div>

      {/* Input Parameters Form */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Account Size */}
        <div>
          <label
            htmlFor={`calc-account-size-${mode}`}
            className="block text-[11px] font-semibold text-neutral-700 mb-1"
          >
            Account Capital (NPR)
          </label>
          <div className="relative">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-mono text-neutral-400">
              NPR
            </span>
            <input
              id={`calc-account-size-${mode}`}
              type="number"
              min="1000"
              step="5000"
              value={accountSizeInput}
              onChange={(e) => setAccountSizeInput(e.target.value)}
              placeholder="500000"
              className="w-full pl-11 pr-3 py-1.5 text-xs font-mono font-medium border border-neutral-300 rounded-lg focus:ring-1 focus:ring-neutral-900 focus:outline-hidden bg-neutral-50"
            />
          </div>
        </div>

        {/* Risk per Trade (%) */}
        <div>
          <label
            htmlFor={`calc-risk-pct-${mode}`}
            className="block text-[11px] font-semibold text-neutral-700 mb-1"
          >
            Risk Per Trade (%)
          </label>
          <div className="relative">
            <input
              id={`calc-risk-pct-${mode}`}
              type="number"
              min="0.1"
              max="20"
              step="0.25"
              value={riskPctInput}
              onChange={(e) => setRiskPctInput(e.target.value)}
              placeholder="2.0"
              className="w-full px-3 py-1.5 text-xs font-mono font-medium border border-neutral-300 rounded-lg focus:ring-1 focus:ring-neutral-900 focus:outline-hidden bg-neutral-50"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-mono text-neutral-400">
              %
            </span>
          </div>
        </div>

        {/* Entry Price */}
        <div>
          <label
            htmlFor={`calc-entry-price-${mode}`}
            className="block text-[11px] font-semibold text-neutral-700 mb-1"
          >
            Entry Price (NPR)
          </label>
          <input
            id={`calc-entry-price-${mode}`}
            type="number"
            step="any"
            value={localEntryPrice}
            onChange={(e) => setLocalEntryPrice(e.target.value)}
            placeholder="e.g. 520.00"
            className="w-full px-3 py-1.5 text-xs font-mono font-medium border border-neutral-300 rounded-lg focus:ring-1 focus:ring-neutral-900 focus:outline-hidden bg-neutral-50"
          />
        </div>

        {/* Stop-Loss Price */}
        <div>
          <label
            htmlFor={`calc-stop-price-${mode}`}
            className="block text-[11px] font-semibold text-neutral-700 mb-1"
          >
            Stop-Loss Price (NPR)
          </label>
          <input
            id={`calc-stop-price-${mode}`}
            type="number"
            step="any"
            value={localStopPrice}
            onChange={(e) => setLocalStopPrice(e.target.value)}
            placeholder="e.g. 495.00"
            className="w-full px-3 py-1.5 text-xs font-mono font-medium border border-neutral-300 rounded-lg focus:ring-1 focus:ring-neutral-900 focus:outline-hidden bg-neutral-50"
          />
        </div>
      </div>

      {/* Sizing Breakdown & Mathematical Results */}
      {sizingResult.isValid ? (
        <div className="space-y-3">
          {/* Main Calculation Stat Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 p-3 rounded-lg bg-neutral-50 border border-neutral-200">
            {/* 1. Risk Capital */}
            <div className="p-2 bg-white rounded-md border border-neutral-200/80">
              <div className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider">
                Risk Capital
              </div>
              <div className="text-sm font-bold font-mono text-neutral-900 mt-0.5">
                NPR {sizingResult.riskAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </div>
              <div className="text-[10px] text-neutral-500 font-mono">
                {sizingResult.riskPerTradePct}% of capital
              </div>
            </div>

            {/* 2. Risk per Share */}
            <div className="p-2 bg-white rounded-md border border-neutral-200/80">
              <div className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider">
                Risk Per Share
              </div>
              <div className="text-sm font-bold font-mono text-[var(--danger)] mt-0.5">
                NPR {sizingResult.riskPerShare.toFixed(2)}
              </div>
              <div className="text-[10px] text-neutral-500 font-mono">
                {sizingResult.entryPrice > 0
                  ? `${((sizingResult.riskPerShare / sizingResult.entryPrice) * 100).toFixed(1)}% stop distance`
                  : '—'}
              </div>
            </div>

            {/* 3. Max Sized Shares */}
            <div className="p-2 bg-white rounded-md border border-neutral-900/20 bg-neutral-900/5">
              <div className="text-[10px] uppercase font-bold text-neutral-600 tracking-wider flex items-center justify-between">
                <span>Max Shares</span>
                <span className="text-[9px] font-normal text-neutral-400">floor</span>
              </div>
              <div className="text-base font-extrabold font-mono text-neutral-900 mt-0.5">
                {sizingResult.shares.toLocaleString()}
              </div>
              <div className="text-[10px] text-neutral-500 font-mono">
                shares
              </div>
            </div>

            {/* 4. Total Position Value */}
            <div className="p-2 bg-white rounded-md border border-neutral-200/80">
              <div className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider">
                Position Value
              </div>
              <div className="text-sm font-bold font-mono text-neutral-900 mt-0.5">
                NPR {sizingResult.positionValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </div>
              <div className="text-[10px] text-neutral-500 font-mono">
                {sizingResult.shares} &times; NPR {sizingResult.entryPrice.toFixed(2)}
              </div>
            </div>

            {/* 5. Account Allocation % */}
            <div className="col-span-2 sm:col-span-1 p-2 bg-white rounded-md border border-neutral-200/80">
              <div className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider">
                Capital Sized
              </div>
              <div
                className={`text-sm font-bold font-mono mt-0.5 ${
                  sizingResult.positionPctOfAccount > 50 ? 'text-amber-700' : 'text-neutral-900'
                }`}
              >
                {sizingResult.positionPctOfAccount.toFixed(1)}%
              </div>
              <div className="text-[10px] text-neutral-500 font-mono">
                of total portfolio
              </div>
            </div>
          </div>

          {/* Quick Apply Action (Journal Mode) */}
          {mode === 'journal' && onApplyShares && sizingResult.shares > 0 && (
            <div className="flex items-center justify-between p-2 rounded-lg bg-neutral-100 border border-neutral-200">
              <span className="text-xs text-neutral-600">
                Calculated size: <strong>{sizingResult.shares} shares</strong> (NPR {sizingResult.positionValue.toLocaleString(undefined, { maximumFractionDigits: 2 })})
              </span>
              <button
                type="button"
                onClick={() => onApplyShares(sizingResult.shares)}
                className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold text-white bg-neutral-900 hover:bg-neutral-800 rounded-md transition-colors cursor-pointer"
              >
                <span>Apply to Position Size</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Traceable Arithmetic Formula Audit */}
          <div className="p-2.5 rounded-lg bg-neutral-50/70 border border-neutral-200/60 text-[11px] text-neutral-600 font-mono">
            <span className="font-sans font-semibold text-neutral-700 mr-1.5">Traceable Arithmetic:</span>
            floor((NPR {sizingResult.accountSize.toLocaleString()} &times; {sizingResult.riskPerTradePct}%) &divide; |NPR {sizingResult.entryPrice.toFixed(2)} &minus; NPR {sizingResult.stopLossPrice.toFixed(2)}|)
            &nbsp;=&nbsp;floor(NPR {sizingResult.riskAmount.toFixed(2)} &divide; NPR {sizingResult.riskPerShare.toFixed(2)})
            &nbsp;=&nbsp;<strong>{sizingResult.shares} shares</strong>
          </div>
        </div>
      ) : (
        <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold">Calculation Input Required:</div>
            <div>{sizingResult.errorMessage}</div>
          </div>
        </div>
      )}

      {/* Pre-Trade Risk Checks (Enabled for Journal mode, or optionally in Backtest if open positions exist) */}
      {mode === 'journal' && (
        <div className="pt-2 border-t border-neutral-200 space-y-3">
          <div className="flex items-center gap-1.5 text-xs font-bold text-neutral-800 uppercase tracking-wider">
            <Shield className="w-3.5 h-3.5 text-neutral-600" />
            <span>Pre-Trade Risk Checks</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* 1. Concentration Check Card */}
            <div
              id="concentration-check-card"
              className={`p-3 rounded-lg border text-xs space-y-1.5 ${
                concentrationResult.isHighExposure
                  ? 'bg-amber-50/70 border-amber-200 text-amber-900'
                  : 'bg-neutral-50 border-neutral-200 text-neutral-700'
              }`}
            >
              <div className="flex items-center justify-between font-semibold">
                <div className="flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-neutral-600" />
                  <span>Portfolio Concentration</span>
                </div>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                    concentrationResult.isHighExposure
                      ? 'bg-amber-200 text-amber-900'
                      : 'bg-neutral-200 text-neutral-800'
                  }`}
                >
                  {concentrationResult.totalExposurePct.toFixed(1)}% Exposure
                </span>
              </div>

              <p className="text-[11px] leading-relaxed text-neutral-600">
                {concentrationResult.explanation}
              </p>

              {concentrationResult.isHighExposure && (
                <div className="flex items-center gap-1 text-[11px] font-medium text-amber-800 pt-0.5">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-600" />
                  <span>
                    Factual Flag: Total exposure exceeds 50% of your account capital.
                  </span>
                </div>
              )}

              {concentrationResult.hasSameSymbol && (
                <div className="flex items-center gap-1 text-[11px] font-medium text-blue-800 pt-0.5">
                  <Info className="w-3.5 h-3.5 shrink-0 text-blue-600" />
                  <span>
                    Notice: You already have {concentrationResult.sameSymbolCount} open position(s) in {symbol}.
                  </span>
                </div>
              )}
            </div>

            {/* 2. Liquidity Feasibility Check Card */}
            <div
              id="liquidity-feasibility-card"
              className={`p-3 rounded-lg border text-xs space-y-1.5 ${
                liquidityCheck.isHighVolumePct
                  ? 'bg-amber-50/70 border-amber-200 text-amber-900'
                  : 'bg-neutral-50 border-neutral-200 text-neutral-700'
              }`}
            >
              <div className="flex items-center justify-between font-semibold">
                <div className="flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-neutral-600" />
                  <span>Liquidity Feasibility (Phase 13)</span>
                </div>
                {liquidityCheck.positionAsPctOfDailyVolume !== null ? (
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                      liquidityCheck.isHighVolumePct
                        ? 'bg-amber-200 text-amber-900'
                        : 'bg-[var(--success)]/10 text-[var(--success)] border border-[var(--success)]/20'
                    }`}
                  >
                    {liquidityCheck.positionAsPctOfDailyVolume.toFixed(1)}% of 20d Vol
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-neutral-200 text-neutral-700">
                    N/A
                  </span>
                )}
              </div>

              {isLiquidityLoading ? (
                <div className="text-[11px] text-neutral-500 italic">
                  Loading liquidity metrics for {symbol}...
                </div>
              ) : (
                <p className="text-[11px] leading-relaxed text-neutral-600">
                  {liquidityCheck.message}
                </p>
              )}

              {liquidityCheck.isHighVolumePct && (
                <div className="flex items-center gap-1 text-[11px] font-medium text-amber-800 pt-0.5">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-600" />
                  <span>
                    Factual Flag: Position represents &gt;20% of typical daily volume.
                  </span>
                </div>
              )}

              {liquidityCheck.hasSufficientHistory && !liquidityCheck.isHighVolumePct && (
                <div className="flex items-center gap-1 text-[11px] font-medium text-[var(--success)] pt-0.5">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-[var(--success)]" />
                  <span>Feasible order size under normal market depth.</span>
                </div>
              )}
            </div>
          </div>

          <div className="text-[10px] text-neutral-400 italic">
            * Factual observations only — no trades are blocked. You retain complete execution authority.
          </div>
        </div>
      )}
    </div>
  );
};
