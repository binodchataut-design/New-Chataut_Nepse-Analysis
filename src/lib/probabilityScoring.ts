import { PriceRecordWithIndicators, SetupOccurrence, SetupScoreResult } from '../types';

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
