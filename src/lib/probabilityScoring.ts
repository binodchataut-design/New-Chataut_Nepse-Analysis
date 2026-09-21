import {
  PriceRecord,
  PriceRecordWithIndicators,
  SetupOccurrence,
  SetupScoreResult,
  SignalFilterConfig,
  CANDLESTICK_PATTERN_LABELS,
} from '../types';
import { calculateSMA, calculateEMA, calculateRSI, calculateRelativeVolume } from './indicators';
import {
  detectDoji,
  detectBullishMarubozu,
  detectBearishMarubozu,
  detectHammer,
  detectHangingMan,
  detectInvertedHammer,
  detectShootingStar,
  detectSpinningTop,
  detectBullishEngulfing,
  detectBearishEngulfing,
  detectBullishHarami,
  detectBearishHarami,
  detectPiercingLine,
  detectDarkCloudCover,
  detectTweezerTop,
  detectTweezerBottom,
  detectMorningStar,
  detectEveningStar,
  detectThreeWhiteSoldiers,
  detectThreeBlackCrows,
  detectThreeInsideUp,
  detectThreeInsideDown,
} from './candlestickPatterns';

/**
 * Detects "SMA20/50 Bullish Cross" signals:
 * Signal fires on session i if:
 *   sma20[i-1] <= sma50[i-1] AND sma20[i] > sma50[i]
 * Both values must be non-null on both sessions i-1 and i.
 *
 * @param data Array of price records with precalculated indicators in chronological order.
 * @returns Array of integer indices where the bullish cross fired.
 */
export function detectTrendCrossSignals(data: PriceRecordWithIndicators[]): number[] {
  if (!data || data.length < 2) return [];

  const signals: number[] = [];

  for (let i = 1; i < data.length; i++) {
    const prev = data[i - 1];
    const curr = data[i];

    if (
      prev.sma20 !== null &&
      prev.sma50 !== null &&
      curr.sma20 !== null &&
      curr.sma50 !== null
    ) {
      if (prev.sma20 <= prev.sma50 && curr.sma20 > curr.sma50) {
        signals.push(i);
      }
    }
  }

  return signals;
}

/**
 * Detects "RSI Oversold Recovery" signals:
 * Signal fires on session i if:
 *   rsi14[i-1] < 30 AND rsi14[i] >= 30
 * Both values must be non-null on sessions i-1 and i.
 *
 * @param data Array of price records with precalculated indicators in chronological order.
 * @returns Array of integer indices where RSI oversold recovery fired.
 */
export function detectRSIRecoverySignals(data: PriceRecordWithIndicators[]): number[] {
  if (!data || data.length < 2) return [];

  const signals: number[] = [];

  for (let i = 1; i < data.length; i++) {
    const prev = data[i - 1];
    const curr = data[i];

    if (prev.rsi14 !== null && curr.rsi14 !== null) {
      if (prev.rsi14 < 30 && curr.rsi14 >= 30) {
        signals.push(i);
      }
    }
  }

  return signals;
}

/**
 * Generic bullish-cross detector:
 * Fires at index i if fastSeries[i-1] <= slowSeries[i-1] AND fastSeries[i] > slowSeries[i],
 * where both values on sessions i-1 and i are non-null.
 * Works on any two precomputed series regardless of what indicator produced them.
 *
 * @param fastSeries Faster indicator series (e.g. SMA20 or EMA10)
 * @param slowSeries Slower indicator series (e.g. SMA50 or EMA30)
 * @returns Array of integer indices where the bullish cross fired.
 */
export function detectMACrossSignals(
  fastSeries: (number | null)[],
  slowSeries: (number | null)[]
): number[] {
  if (!fastSeries || !slowSeries) return [];
  const len = Math.min(fastSeries.length, slowSeries.length);
  if (len < 2) return [];

  const signals: number[] = [];

  for (let i = 1; i < len; i++) {
    const prevFast = fastSeries[i - 1];
    const prevSlow = slowSeries[i - 1];
    const currFast = fastSeries[i];
    const currSlow = slowSeries[i];

    if (
      prevFast !== null &&
      prevSlow !== null &&
      currFast !== null &&
      currSlow !== null
    ) {
      if (prevFast <= prevSlow && currFast > currSlow) {
        signals.push(i);
      }
    }
  }

  return signals;
}

/**
 * Generic RSI threshold crossing detector:
 * - 'recovery': fires when rsi crosses from below threshold to >= threshold (rsi[i-1] < threshold && rsi[i] >= threshold).
 * - 'breakdown': fires when rsi crosses from above threshold down to <= threshold (rsi[i-1] > threshold && rsi[i] <= threshold).
 * Both values must be non-null.
 *
 * @param rsiSeries Precomputed RSI series
 * @param threshold Numerical threshold (e.g. 30 for oversold recovery, 70 for overbought breakdown)
 * @param direction 'recovery' | 'breakdown'
 * @returns Array of integer indices where the threshold crossing fired.
 */
export function detectRSIThresholdSignals(
  rsiSeries: (number | null)[],
  threshold: number,
  direction: 'recovery' | 'breakdown'
): number[] {
  if (!rsiSeries || rsiSeries.length < 2) return [];

  const signals: number[] = [];

  for (let i = 1; i < rsiSeries.length; i++) {
    const prev = rsiSeries[i - 1];
    const curr = rsiSeries[i];

    if (prev !== null && curr !== null) {
      if (direction === 'recovery') {
        if (prev < threshold && curr >= threshold) {
          signals.push(i);
        }
      } else if (direction === 'breakdown') {
        if (prev > threshold && curr <= threshold) {
          signals.push(i);
        }
      }
    }
  }

  return signals;
}

/**
 * Generic Relative Volume threshold detector:
 * Fires at index i if relativeVolumeSeries[i] !== null AND relativeVolumeSeries[i] >= threshold.
 * Reuses existing relative volume series (ratio vs 20-session baseline volume).
 *
 * @param relativeVolumeSeries Precomputed relative volume series
 * @param threshold Numerical ratio threshold (e.g. 1.5 for 1.5x average volume)
 * @returns Array of integer indices where relative volume meets or exceeds threshold.
 */
export function detectRelativeVolumeSignals(
  relativeVolumeSeries: (number | null)[],
  threshold: number
): number[] {
  if (!relativeVolumeSeries || relativeVolumeSeries.length === 0) return [];

  const signals: number[] = [];

  for (let i = 0; i < relativeVolumeSeries.length; i++) {
    const val = relativeVolumeSeries[i];
    if (val !== null && val >= threshold) {
      signals.push(i);
    }
  }

  return signals;
}

/**
 * Scores a setup by evaluating forward performance exactly N sessions after each signal.
 *
 * - "Worked" = close[i+N] >= close[i] * (1 + threshold), default threshold 2% (0.02)
 * - If fewer than N sessions exist after the signal (signal too close to the most recent data),
 *   exclude that occurrence from scoring — do not guess or truncate the window silently.
 * - If totalOccurrences === 0, hitRate and avgForwardReturn are null.
 *
 * @param data Chronologically sorted price series with indicators
 * @param signalIndices Array of session indices where signal occurred
 * @param forwardSessions Forward window N (default 10)
 * @param threshold Forward return threshold as percent (e.g. 2 for 2%) or fraction (0.02)
 */
export function scoreSetup(
  data: PriceRecordWithIndicators[],
  signalIndices: number[],
  forwardSessions: number = 10,
  threshold: number = 2
): SetupScoreResult {
  if (!data || !signalIndices || signalIndices.length === 0 || forwardSessions <= 0) {
    return {
      totalOccurrences: 0,
      excludedOccurrences: 0,
      successCount: 0,
      hitRate: null,
      avgForwardReturn: null,
      occurrences: [],
    };
  }

  // Normalize threshold to decimal multiplier and percentage representation
  // Accepts either 2 (meaning 2%) or 0.02 (meaning 2%)
  const thresholdPct = threshold > 0.5 ? threshold : threshold * 100;
  const thresholdDec = thresholdPct / 100;

  let totalOccurrences = 0;
  let excludedOccurrences = 0;
  let successCount = 0;
  let totalReturn = 0;
  const occurrences: SetupOccurrence[] = [];

  for (const i of signalIndices) {
    if (i < 0 || i >= data.length) continue;
    const signalRec = data[i];

    // Exclude if fewer than forwardSessions exist after session i
    if (i + forwardSessions >= data.length) {
      excludedOccurrences++;
      occurrences.push({
        signalDate: signalRec.date,
        signalClose: signalRec.close,
        outcomeDate: null,
        outcomeClose: null,
        forwardReturn: null,
        worked: false,
        isExcluded: true,
        sessionsAvailable: data.length - 1 - i,
      });
      continue;
    }

    const outcomeRec = data[i + forwardSessions];
    const forwardReturn =
      signalRec.close > 0
        ? ((outcomeRec.close - signalRec.close) / signalRec.close) * 100
        : 0;

    // Evaluated: close[i+N] >= close[i] * (1 + threshold)
    const targetClose = signalRec.close * (1 + thresholdDec);
    const worked = outcomeRec.close >= targetClose;

    totalOccurrences++;
    if (worked) {
      successCount++;
    }
    totalReturn += forwardReturn;

    occurrences.push({
      signalDate: signalRec.date,
      signalClose: signalRec.close,
      outcomeDate: outcomeRec.date,
      outcomeClose: outcomeRec.close,
      forwardReturn,
      worked,
      isExcluded: false,
    });
  }

  const hitRate = totalOccurrences > 0 ? (successCount / totalOccurrences) * 100 : null;
  const avgForwardReturn = totalOccurrences > 0 ? totalReturn / totalOccurrences : null;

  return {
    totalOccurrences,
    excludedOccurrences,
    successCount,
    hitRate,
    avgForwardReturn,
    occurrences,
  };
}

/**
 * Computes signal indices and indicator series dynamically from a user-configured filter.
 */
export function computeSignalsFromConfig(
  data: PriceRecord[],
  config: SignalFilterConfig
): {
  signals: number[];
  fastSeries?: (number | null)[];
  slowSeries?: (number | null)[];
  rsiSeries?: (number | null)[];
} {
  if (!data || data.length < 2) {
    return { signals: [] };
  }

  if (config.mode === 'ma_cross') {
    const fastPeriod = Math.max(1, Math.round(config.maCross.fastPeriod || 20));
    const slowPeriod = Math.max(1, Math.round(config.maCross.slowPeriod || 50));

    const fastSeries =
      config.maCross.fastType === 'EMA'
        ? calculateEMA(data, fastPeriod)
        : calculateSMA(data, fastPeriod);

    const slowSeries =
      config.maCross.slowType === 'EMA'
        ? calculateEMA(data, slowPeriod)
        : calculateSMA(data, slowPeriod);

    const signals = detectMACrossSignals(fastSeries, slowSeries);
    return { signals, fastSeries, slowSeries };
  } else if (config.mode === 'rsi_threshold') {
    const period = Math.max(2, Math.round(config.rsiThreshold.period || 14));
    const threshold = Number.isFinite(config.rsiThreshold.threshold)
      ? config.rsiThreshold.threshold
      : 30;
    const direction = config.rsiThreshold.direction || 'recovery';

    const rsiSeries = calculateRSI(data, period);
    const signals = detectRSIThresholdSignals(rsiSeries, threshold, direction);
    return { signals, rsiSeries };
  } else if (config.mode === 'relative_volume') {
    const threshold = Number.isFinite(config.relativeVolume?.threshold)
      ? config.relativeVolume.threshold
      : 1.5;

    // Reuse existing pre-computed relativeVolume if present on records, otherwise calculate
    let rvolSeries: (number | null)[];
    if (data.length > 0 && (data[0] as PriceRecordWithIndicators).relativeVolume !== undefined) {
      rvolSeries = (data as PriceRecordWithIndicators[]).map((d) => d.relativeVolume ?? null);
    } else {
      rvolSeries = calculateRelativeVolume(data, 20);
    }

    const signals = detectRelativeVolumeSignals(rvolSeries, threshold);
    return { signals };
  } else {
    // Candlestick Pattern Detection
    let signals: number[] = [];
    switch (config.candlestickPattern) {
      case 'doji':
        signals = detectDoji(data);
        break;
      case 'bullish_marubozu':
        signals = detectBullishMarubozu(data);
        break;
      case 'bearish_marubozu':
        signals = detectBearishMarubozu(data);
        break;
      case 'hammer':
        signals = detectHammer(data);
        break;
      case 'hanging_man':
        signals = detectHangingMan(data);
        break;
      case 'inverted_hammer':
        signals = detectInvertedHammer(data);
        break;
      case 'shooting_star':
        signals = detectShootingStar(data);
        break;
      case 'spinning_top':
        signals = detectSpinningTop(data);
        break;
      case 'bullish_engulfing':
        signals = detectBullishEngulfing(data);
        break;
      case 'bearish_engulfing':
        signals = detectBearishEngulfing(data);
        break;
      case 'bullish_harami':
        signals = detectBullishHarami(data);
        break;
      case 'bearish_harami':
        signals = detectBearishHarami(data);
        break;
      case 'piercing_line':
        signals = detectPiercingLine(data);
        break;
      case 'dark_cloud_cover':
        signals = detectDarkCloudCover(data);
        break;
      case 'tweezer_top':
        signals = detectTweezerTop(data);
        break;
      case 'tweezer_bottom':
        signals = detectTweezerBottom(data);
        break;
      case 'morning_star':
        signals = detectMorningStar(data);
        break;
      case 'evening_star':
        signals = detectEveningStar(data);
        break;
      case 'three_white_soldiers':
        signals = detectThreeWhiteSoldiers(data);
        break;
      case 'three_black_crows':
        signals = detectThreeBlackCrows(data);
        break;
      case 'three_inside_up':
        signals = detectThreeInsideUp(data);
        break;
      case 'three_inside_down':
        signals = detectThreeInsideDown(data);
        break;
      default:
        signals = [];
    }
    return { signals };
  }
}

/**
 * Returns a clean, human-readable description of a configured setup.
 */
export function getSignalSetupDescription(config: SignalFilterConfig): string {
  if (config.mode === 'ma_cross') {
    return `${config.maCross.fastType}(${config.maCross.fastPeriod}) / ${config.maCross.slowType}(${config.maCross.slowPeriod}) Bullish Cross`;
  } else if (config.mode === 'rsi_threshold') {
    const dirLabel =
      config.rsiThreshold.direction === 'recovery'
        ? `Recovery (crosses ≥ ${config.rsiThreshold.threshold})`
        : `Breakdown (crosses ≤ ${config.rsiThreshold.threshold})`;
    return `RSI(${config.rsiThreshold.period}) ${dirLabel}`;
  } else if (config.mode === 'relative_volume') {
    const threshold = config.relativeVolume?.threshold ?? 1.5;
    return `Relative Volume ≥ ${threshold.toFixed(1)}x`;
  } else {
    const label = CANDLESTICK_PATTERN_LABELS[config.candlestickPattern] || 'Candlestick Pattern';
    return `${label} Pattern`;
  }
}

