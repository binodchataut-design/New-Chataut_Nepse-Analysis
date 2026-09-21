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
import { Sliders, RotateCcw, TrendingUp, Activity, CandlestickChart, BarChart3 } from 'lucide-react';
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

  const handleRvolThresholdChange = (val: number) => {
    const threshold = Math.max(0.1, Math.min(50, isNaN(val) ? 1.5 : val));
    onChange({
      ...config,
      relativeVolume: {
        ...config.relativeVolume,
        threshold,
      },
    });
  };

  const handleReset = () => {
    onChange({
      mode: config.mode, // keep currently selected mode or full reset
      maCross: { ...DEFAULT_SIGNAL_FILTER_CONFIG.maCross },
      rsiThreshold: { ...DEFAULT_SIGNAL_FILTER_CONFIG.rsiThreshold },
      candlestickPattern: DEFAULT_SIGNAL_FILTER_CONFIG.candlestickPattern,
      relativeVolume: { ...DEFAULT_SIGNAL_FILTER_CONFIG.relativeVolume },
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
            <button
              id="filter-mode-relative-volume"
              type="button"
              onClick={() => handleModeChange('relative_volume')}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                config.mode === 'relative_volume'
                  ? 'bg-white text-neutral-900 font-semibold shadow-2xs'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              <BarChart3 className="w-3 h-3 text-emerald-600" />
              <span>Relative Volume</span>
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
                <optgroup label="Single-Candle Patterns">
                  <option value="hammer">{CANDLESTICK_PATTERN_LABELS.hammer} (Bullish Reversal / Downtrend)</option>
                  <option value="inverted_hammer">{CANDLESTICK_PATTERN_LABELS.inverted_hammer} (Bullish Reversal / Downtrend)</option>
                  <option value="hanging_man">{CANDLESTICK_PATTERN_LABELS.hanging_man} (Bearish Reversal / Uptrend)</option>
                  <option value="shooting_star">{CANDLESTICK_PATTERN_LABELS.shooting_star} (Bearish Reversal / Uptrend)</option>
                  <option value="doji">{CANDLESTICK_PATTERN_LABELS.doji} (Indecision / Equilibrium)</option>
                  <option value="spinning_top">{CANDLESTICK_PATTERN_LABELS.spinning_top} (Indecision / Balanced Shadows)</option>
                  <option value="bullish_marubozu">{CANDLESTICK_PATTERN_LABELS.bullish_marubozu} (Strong Momentum Up)</option>
                  <option value="bearish_marubozu">{CANDLESTICK_PATTERN_LABELS.bearish_marubozu} (Strong Selling Down)</option>
                </optgroup>
                <optgroup label="Double-Candle Patterns">
                  <option value="bullish_engulfing">{CANDLESTICK_PATTERN_LABELS.bullish_engulfing} (Bullish Reversal)</option>
                  <option value="bearish_engulfing">{CANDLESTICK_PATTERN_LABELS.bearish_engulfing} (Bearish Reversal)</option>
                  <option value="bullish_harami">{CANDLESTICK_PATTERN_LABELS.bullish_harami} (Bullish Inside Body)</option>
                  <option value="bearish_harami">{CANDLESTICK_PATTERN_LABELS.bearish_harami} (Bearish Inside Body)</option>
                  <option value="piercing_line">{CANDLESTICK_PATTERN_LABELS.piercing_line} (Bullish Piercing Recovery)</option>
                  <option value="dark_cloud_cover">{CANDLESTICK_PATTERN_LABELS.dark_cloud_cover} (Bearish Dark Cloud)</option>
                  <option value="tweezer_top">{CANDLESTICK_PATTERN_LABELS.tweezer_top} (Uptrend Reversal / Matching Highs)</option>
                  <option value="tweezer_bottom">{CANDLESTICK_PATTERN_LABELS.tweezer_bottom} (Downtrend Reversal / Matching Lows)</option>
                </optgroup>
                <optgroup label="Triple-Candle Patterns">
                  <option value="morning_star">{CANDLESTICK_PATTERN_LABELS.morning_star} (Bullish Reversal)</option>
                  <option value="evening_star">{CANDLESTICK_PATTERN_LABELS.evening_star} (Bearish Reversal)</option>
                  <option value="three_white_soldiers">{CANDLESTICK_PATTERN_LABELS.three_white_soldiers} (Strong Bullish Continuation)</option>
                  <option value="three_black_crows">{CANDLESTICK_PATTERN_LABELS.three_black_crows} (Strong Bearish Continuation)</option>
                  <option value="three_inside_up">{CANDLESTICK_PATTERN_LABELS.three_inside_up} (Bullish Harami Confirmation)</option>
                  <option value="three_inside_down">{CANDLESTICK_PATTERN_LABELS.three_inside_down} (Bearish Harami Confirmation)</option>
                </optgroup>
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
              {config.candlestickPattern === 'bullish_engulfing' && 'Shape: bearish candle 1, bullish candle 2 completely engulfs candle 1 body (open2 ≤ close1, close2 ≥ open1)'}
              {config.candlestickPattern === 'bearish_engulfing' && 'Shape: bullish candle 1, bearish candle 2 completely engulfs candle 1 body (open2 ≥ close1, close2 ≤ open1)'}
              {config.candlestickPattern === 'bullish_harami' && 'Shape: bearish candle 1, smaller bullish candle 2 completely contained inside candle 1 body'}
              {config.candlestickPattern === 'bearish_harami' && 'Shape: bullish candle 1, smaller bearish candle 2 completely contained inside candle 1 body'}
              {config.candlestickPattern === 'piercing_line' && 'Shape: bearish candle 1, bullish candle 2 opens < low1 and closes between midpoint and open of body 1'}
              {config.candlestickPattern === 'dark_cloud_cover' && 'Shape: bullish candle 1, bearish candle 2 opens > high1 and closes between midpoint and open of body 1'}
              {config.candlestickPattern === 'tweezer_top' && 'Shape: highs match within 0.1%, candle 1 bullish, candle 2 bearish, prior trend up'}
              {config.candlestickPattern === 'tweezer_bottom' && 'Shape: lows match within 0.1%, candle 1 bearish, candle 2 bullish, prior trend down'}
              {config.candlestickPattern === 'morning_star' && 'Shape: large bearish candle A, small star B at/below close A, large bullish candle C closing above A midpoint'}
              {config.candlestickPattern === 'evening_star' && 'Shape: large bullish candle A, small star B at/above close A, large bearish candle C closing below A midpoint'}
              {config.candlestickPattern === 'three_white_soldiers' && 'Shape: 3 consecutive large green candles, each opening within prior body and closing higher'}
              {config.candlestickPattern === 'three_black_crows' && 'Shape: 3 consecutive large red candles, each opening within prior body and closing lower'}
              {config.candlestickPattern === 'three_inside_up' && 'Shape: large bearish candle A, bullish harami B inside A body, bullish candle C closing above A open'}
              {config.candlestickPattern === 'three_inside_down' && 'Shape: large bullish candle A, bearish harami B inside A body, bearish candle C closing below A open'}
            </div>
          </div>

          {/* Persistent Honesty / Caution Note */}
          <CandlestickHonestyNote />
        </div>
      )}

      {/* Relative Volume Threshold Controls */}
      {config.mode === 'relative_volume' && (
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <div className="flex items-center gap-2 bg-neutral-50/80 px-3 py-1.5 rounded-lg border border-neutral-200">
            <span className="font-semibold text-neutral-700">Volume Threshold:</span>
            <div className="relative inline-flex items-center">
              <span className="text-neutral-500 font-mono text-xs mr-1">&ge;</span>
              <input
                id="filter-rvol-threshold-input"
                type="number"
                min="0.1"
                max="50"
                step="0.1"
                value={config.relativeVolume?.threshold ?? 1.5}
                onChange={(e) => handleRvolThresholdChange(parseFloat(e.target.value))}
                className="w-16 px-2 py-0.5 font-mono text-xs bg-white border border-neutral-300 rounded focus:outline-hidden focus:ring-1 focus:ring-neutral-900 cursor-text"
              />
              <span className="text-neutral-500 text-xs ml-1 font-mono">x</span>
            </div>
            <span className="text-[11px] text-neutral-500 ml-1">
              (vs 20-session baseline)
            </span>
          </div>

          <div className="text-[11px] font-mono text-neutral-500 bg-neutral-100/70 px-2.5 py-1 rounded-md border border-neutral-200/60">
            Trigger: fires on session i when volume &ge; {(config.relativeVolume?.threshold ?? 1.5).toFixed(1)}x of its 20-session average volume
          </div>
        </div>
      )}
    </div>
  );
};
