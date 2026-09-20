import React from 'react';
import {
  SignalFilterConfig,
  MAType,
  RSIDirection,
  FilterMode,
  CandlestickPatternType,
  CANDLESTICK_PATTERN_LABELS,
  DEFAULT_SIGNAL_FILTER_CONFIG,
} from '../types';
import { Sliders, RotateCcw, TrendingUp, Activity, CandlestickChart } from 'lucide-react';
import { CandlestickHonestyNote } from './CandlestickHonestyNote';

export interface SignalFilterPanelProps {
  config: SignalFilterConfig;
  onChange: (newConfig: SignalFilterConfig) => void;
  /** If true, renders overlay visibility toggles alongside the parameter inputs (used in Chart tab) */
  showOverlayToggles?: boolean;
  fastVisible?: boolean;
  onToggleFastVisible?: (visible: boolean) => void;
  slowVisible?: boolean;
  onToggleSlowVisible?: (visible: boolean) => void;
  rsiVisible?: boolean;
  onToggleRsiVisible?: (visible: boolean) => void;
  candlePatternVisible?: boolean;
  onToggleCandlePatternVisible?: (visible: boolean) => void;
  title?: string;
  description?: string;
  className?: string;
}

export const SignalFilterPanel: React.FC<SignalFilterPanelProps> = ({
  config,
  onChange,
  showOverlayToggles = false,
  fastVisible = true,
  onToggleFastVisible,
  slowVisible = true,
  onToggleSlowVisible,
  rsiVisible = true,
  onToggleRsiVisible,
  candlePatternVisible = true,
  onToggleCandlePatternVisible,
  title,
  description,
  className = '',
}) => {
  const handleModeChange = (mode: FilterMode) => {
    onChange({
      ...config,
      mode,
    });
  };

  const handleFastTypeChange = (fastType: MAType) => {
    onChange({
      ...config,
      maCross: {
        ...config.maCross,
        fastType,
      },
    });
  };

  const handleFastPeriodChange = (val: number) => {
    const period = Math.max(1, Math.min(300, isNaN(val) ? 20 : val));
    onChange({
      ...config,
      maCross: {
        ...config.maCross,
        fastPeriod: period,
      },
    });
  };

  const handleSlowTypeChange = (slowType: MAType) => {
    onChange({
      ...config,
      maCross: {
        ...config.maCross,
        slowType,
      },
    });
  };

  const handleSlowPeriodChange = (val: number) => {
    const period = Math.max(1, Math.min(500, isNaN(val) ? 50 : val));
    onChange({
      ...config,
      maCross: {
        ...config.maCross,
        slowPeriod: period,
      },
    });
  };

  const handleRsiPeriodChange = (val: number) => {
    const period = Math.max(2, Math.min(100, isNaN(val) ? 14 : val));
    onChange({
      ...config,
      rsiThreshold: {
        ...config.rsiThreshold,
        period,
      },
    });
  };

  const handleRsiThresholdChange = (val: number) => {
    const threshold = Math.max(1, Math.min(99, isNaN(val) ? 30 : val));
    onChange({
      ...config,
      rsiThreshold: {
        ...config.rsiThreshold,
        threshold,
      },
    });
  };

  const handleRsiDirectionChange = (direction: RSIDirection) => {
    onChange({
      ...config,
      rsiThreshold: {
        ...config.rsiThreshold,
        direction,
      },
    });
  };

  const handlePatternChange = (candlestickPattern: CandlestickPatternType) => {
    onChange({
      ...config,
      candlestickPattern,
    });
  };

  const handleReset = () => {
    onChange({
      mode: config.mode, // keep currently selected mode or full reset
      maCross: { ...DEFAULT_SIGNAL_FILTER_CONFIG.maCross },
      rsiThreshold: { ...DEFAULT_SIGNAL_FILTER_CONFIG.rsiThreshold },
      candlestickPattern: DEFAULT_SIGNAL_FILTER_CONFIG.candlestickPattern,
    });
  };

  return (
    <div
      id="signal-filter-panel"
      className={`bg-white border border-neutral-200 rounded-xl p-3.5 sm:p-4 shadow-2xs ${className}`}
    >
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 pb-3 mb-3 border-b border-neutral-100">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-md bg-neutral-900 text-white">
            <Sliders className="w-3.5 h-3.5" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-neutral-900 uppercase tracking-wider">
              {title || 'Configurable Indicator & Signal Filter'}
            </h4>
            {description && (
              <p className="text-[11px] text-neutral-500">{description}</p>
            )}
          </div>
        </div>

        {/* Mode Selector Tabs */}
        <div className="flex items-center gap-2">
          <div
            id="filter-mode-toggle-group"
            className="inline-flex bg-neutral-100 p-0.5 rounded-lg border border-neutral-200"
          >
            <button
              id="filter-mode-ma-cross"
              type="button"
              onClick={() => handleModeChange('ma_cross')}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                config.mode === 'ma_cross'
                  ? 'bg-white text-neutral-900 font-semibold shadow-2xs'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              <TrendingUp className="w-3 h-3 text-blue-600" />
              <span>Moving Average Cross</span>
            </button>
            <button
              id="filter-mode-rsi-threshold"
              type="button"
              onClick={() => handleModeChange('rsi_threshold')}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                config.mode === 'rsi_threshold'
                  ? 'bg-white text-neutral-900 font-semibold shadow-2xs'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              <Activity className="w-3 h-3 text-indigo-600" />
              <span>RSI Threshold Cross</span>
            </button>
            <button
              id="filter-mode-candlestick"
              type="button"
              onClick={() => handleModeChange('candlestick')}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                config.mode === 'candlestick'
                  ? 'bg-white text-neutral-900 font-semibold shadow-2xs'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              <CandlestickChart className="w-3 h-3 text-amber-600" />
              <span>Candlestick Pattern</span>
            </button>
          </div>

          <button
            id="reset-filter-defaults-btn"
            type="button"
            onClick={handleReset}
            title="Reset indicators to defaults"
            className="p-1.5 rounded-md text-neutral-500 hover:text-neutral-800 hover:bg-neutral-100 border border-neutral-200 cursor-pointer transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Mode-specific Controls */}
      {config.mode === 'ma_cross' ? (
        <div className="flex flex-wrap items-center gap-4 text-xs">
          {/* Fast MA Controls */}
          <div className="flex items-center gap-2 bg-neutral-50/80 px-3 py-1.5 rounded-lg border border-neutral-200">
            {showOverlayToggles && onToggleFastVisible && (
              <input
                id="toggle-fast-ma-visible"
                type="checkbox"
                checked={fastVisible}
                onChange={(e) => onToggleFastVisible(e.target.checked)}
                className="w-3.5 h-3.5 rounded text-blue-600 focus:ring-blue-500 border-neutral-300 cursor-pointer"
                title="Toggle visibility on chart"
              />
            )}
            <span className="flex items-center gap-1 font-semibold text-neutral-700">
              <span className="w-2.5 h-1 bg-blue-600 rounded-xs"></span>
              Fast:
            </span>
            <select
              id="filter-fast-ma-type"
              value={config.maCross.fastType}
              onChange={(e) => handleFastTypeChange(e.target.value as MAType)}
              className="px-2 py-0.5 font-mono text-xs bg-white border border-neutral-300 rounded focus:outline-hidden focus:ring-1 focus:ring-neutral-900 cursor-pointer"
            >
              <option value="SMA">SMA</option>
              <option value="EMA">EMA</option>
            </select>
            <span className="text-neutral-400 font-mono">Period:</span>
            <input
              id="filter-fast-ma-period"
              type="number"
              min={1}
              max={300}
              value={config.maCross.fastPeriod}
              onChange={(e) => handleFastPeriodChange(parseInt(e.target.value, 10))}
              className="w-14 px-1.5 py-0.5 font-mono text-xs bg-white border border-neutral-300 rounded text-center focus:outline-hidden focus:ring-1 focus:ring-neutral-900"
            />
          </div>

          {/* Cross Separator Indicator */}
          <span className="text-neutral-400 font-mono font-medium">bullish cross above</span>

          {/* Slow MA Controls */}
          <div className="flex items-center gap-2 bg-neutral-50/80 px-3 py-1.5 rounded-lg border border-neutral-200">
            {showOverlayToggles && onToggleSlowVisible && (
              <input
                id="toggle-slow-ma-visible"
                type="checkbox"
                checked={slowVisible}
                onChange={(e) => onToggleSlowVisible(e.target.checked)}
                className="w-3.5 h-3.5 rounded text-amber-600 focus:ring-amber-500 border-neutral-300 cursor-pointer"
                title="Toggle visibility on chart"
              />
            )}
            <span className="flex items-center gap-1 font-semibold text-neutral-700">
              <span className="w-2.5 h-1 bg-amber-600 rounded-xs"></span>
              Slow:
            </span>
            <select
              id="filter-slow-ma-type"
              value={config.maCross.slowType}
              onChange={(e) => handleSlowTypeChange(e.target.value as MAType)}
              className="px-2 py-0.5 font-mono text-xs bg-white border border-neutral-300 rounded focus:outline-hidden focus:ring-1 focus:ring-neutral-900 cursor-pointer"
            >
              <option value="SMA">SMA</option>
              <option value="EMA">EMA</option>
            </select>
            <span className="text-neutral-400 font-mono">Period:</span>
            <input
              id="filter-slow-ma-period"
              type="number"
              min={1}
              max={500}
              value={config.maCross.slowPeriod}
              onChange={(e) => handleSlowPeriodChange(parseInt(e.target.value, 10))}
              className="w-14 px-1.5 py-0.5 font-mono text-xs bg-white border border-neutral-300 rounded text-center focus:outline-hidden focus:ring-1 focus:ring-neutral-900"
            />
          </div>

          <span className="text-[11px] text-neutral-400 font-mono hidden sm:inline ml-auto">
            Live recompute • Null gaps respected
          </span>
        </div>
      ) : config.mode === 'rsi_threshold' ? (
        <div className="flex flex-wrap items-center gap-4 text-xs">
          {/* RSI Controls */}
          <div className="flex items-center gap-2 bg-neutral-50/80 px-3 py-1.5 rounded-lg border border-neutral-200">
            {showOverlayToggles && onToggleRsiVisible && (
              <input
                id="toggle-rsi-visible"
                type="checkbox"
                checked={rsiVisible}
                onChange={(e) => onToggleRsiVisible(e.target.checked)}
                className="w-3.5 h-3.5 rounded text-indigo-600 focus:ring-indigo-500 border-neutral-300 cursor-pointer"
                title="Toggle RSI subchart on chart"
              />
            )}
            <span className="font-semibold text-neutral-700 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-indigo-600"></span>
              RSI Period:
            </span>
            <input
              id="filter-rsi-period"
              type="number"
              min={2}
              max={100}
              value={config.rsiThreshold.period}
              onChange={(e) => handleRsiPeriodChange(parseInt(e.target.value, 10))}
              className="w-14 px-1.5 py-0.5 font-mono text-xs bg-white border border-neutral-300 rounded text-center focus:outline-hidden focus:ring-1 focus:ring-neutral-900"
            />
          </div>

          {/* Direction Selector */}
          <div className="flex items-center gap-2 bg-neutral-50/80 px-3 py-1.5 rounded-lg border border-neutral-200">
            <span className="font-semibold text-neutral-700">Direction:</span>
            <select
              id="filter-rsi-direction"
              value={config.rsiThreshold.direction}
              onChange={(e) => handleRsiDirectionChange(e.target.value as RSIDirection)}
              className="px-2 py-0.5 font-mono text-xs bg-white border border-neutral-300 rounded focus:outline-hidden focus:ring-1 focus:ring-neutral-900 cursor-pointer"
            >
              <option value="recovery">Recovery (Crosses up into ≥)</option>
              <option value="breakdown">Breakdown (Crosses down into ≤)</option>
            </select>
          </div>

          {/* Threshold Input */}
          <div className="flex items-center gap-2 bg-neutral-50/80 px-3 py-1.5 rounded-lg border border-neutral-200">
            <span className="font-semibold text-neutral-700">Threshold:</span>
            <input
              id="filter-rsi-threshold"
              type="number"
              min={1}
              max={99}
              value={config.rsiThreshold.threshold}
              onChange={(e) => handleRsiThresholdChange(parseInt(e.target.value, 10))}
              className="w-14 px-1.5 py-0.5 font-mono text-xs bg-white border border-neutral-300 rounded text-center focus:outline-hidden focus:ring-1 focus:ring-neutral-900"
            />
            <span className="text-neutral-400 font-mono text-[11px]">
              {config.rsiThreshold.direction === 'recovery' ? 'e.g. 30' : 'e.g. 70'}
            </span>
          </div>

          <span className="text-[11px] text-neutral-400 font-mono hidden sm:inline ml-auto">
            Wilder smoothing • Live recompute
          </span>
        </div>
      ) : (
        /* Candlestick Pattern Mode Controls */
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-4 text-xs">
            <div className="flex items-center gap-2 bg-neutral-50/80 px-3 py-1.5 rounded-lg border border-neutral-200">
              {showOverlayToggles && onToggleCandlePatternVisible && (
                <input
                  id="toggle-candle-pattern-visible"
                  type="checkbox"
                  checked={candlePatternVisible}
                  onChange={(e) => onToggleCandlePatternVisible(e.target.checked)}
                  className="w-3.5 h-3.5 rounded text-amber-600 focus:ring-amber-500 border-neutral-300 cursor-pointer"
                  title="Toggle pattern markers on chart"
                />
              )}
              <span className="font-semibold text-neutral-700 flex items-center gap-1.5">
                <CandlestickChart className="w-3.5 h-3.5 text-amber-600" />
                Select Pattern:
              </span>
              <select
                id="filter-candlestick-pattern-select"
                value={config.candlestickPattern}
                onChange={(e) => handlePatternChange(e.target.value as CandlestickPatternType)}
                className="px-2.5 py-1 font-medium text-xs bg-white border border-neutral-300 rounded-md shadow-2xs focus:outline-hidden focus:ring-1 focus:ring-neutral-900 cursor-pointer"
              >
                <option value="hammer">Hammer (Bullish Reversal / Downtrend)</option>
                <option value="inverted_hammer">Inverted Hammer (Bullish Reversal / Downtrend)</option>
                <option value="hanging_man">Hanging Man (Bearish Reversal / Uptrend)</option>
                <option value="shooting_star">Shooting Star (Bearish Reversal / Uptrend)</option>
                <option value="doji">Doji (Indecision / Equilibrium)</option>
                <option value="spinning_top">Spinning Top (Indecision / Balanced Shadows)</option>
                <option value="bullish_marubozu">Bullish Marubozu (Strong Momentum Up)</option>
                <option value="bearish_marubozu">Bearish Marubozu (Strong Selling Down)</option>
              </select>
            </div>

            <div className="text-[11px] font-mono text-neutral-500 bg-neutral-100/70 px-2.5 py-1 rounded-md border border-neutral-200/60">
              {config.candlestickPattern === 'hammer' && 'Shape: body ≤ 35% range, lower shadow ≥ 2x body, upper shadow ≤ body, prior trend down'}
              {config.candlestickPattern === 'hanging_man' && 'Shape: body ≤ 35% range, lower shadow ≥ 2x body, upper shadow ≤ body, prior trend up'}
              {config.candlestickPattern === 'inverted_hammer' && 'Shape: body ≤ 35% range, upper shadow ≥ 2x body, lower shadow ≤ body, prior trend down'}
              {config.candlestickPattern === 'shooting_star' && 'Shape: body ≤ 35% range, upper shadow ≥ 2x body, lower shadow ≤ body, prior trend up'}
              {config.candlestickPattern === 'doji' && 'Shape: body ≤ 5% range (negligible real body)'}
              {config.candlestickPattern === 'bullish_marubozu' && 'Shape: close > open, body ≥ 95% range (little to no shadows)'}
              {config.candlestickPattern === 'bearish_marubozu' && 'Shape: close < open, body ≥ 95% range (little to no shadows)'}
              {config.candlestickPattern === 'spinning_top' && 'Shape: body 5-35% range, upper & lower shadows both ≥ body'}
            </div>
          </div>

          {/* Persistent Honesty / Caution Note */}
          <CandlestickHonestyNote />
        </div>
      )}
    </div>
  );
};
