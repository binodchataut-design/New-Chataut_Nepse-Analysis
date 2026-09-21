import { PriceRecord } from '../types';

/**
 * Calculates Simple Moving Average (SMA) of close prices over a given period.
 *
 * For index i < period - 1, returns null (insufficient history).
 * For index i >= period - 1, returns the arithmetic mean of closes over [i - period + 1, i].
 */
export function calculateSMA(data: { close: number }[], period: number): (number | null)[] {
  if (!data || period <= 0) return [];
  const result: (number | null)[] = new Array(data.length).fill(null);

  if (data.length < period) {
    return result;
  }

  let rollingSum = 0;
  for (let i = 0; i < data.length; i++) {
    const close = data[i].close;
    rollingSum += close;

    if (i >= period) {
      rollingSum -= data[i - period].close;
    }

    if (i >= period - 1) {
      result[i] = rollingSum / period;
    }
  }

  return result;
}

/**
 * Calculates Exponential Moving Average (EMA) of close prices over a given period.
 *
 * Uses the standard smoothing constant multiplier: alpha = 2 / (period + 1).
 * Initial EMA at index = period - 1 is the SMA of the first `period` closes.
 * For index i > period - 1: EMA[i] = Close[i] * alpha + EMA[i - 1] * (1 - alpha).
 * For index i < period - 1: returns null.
 */
export function calculateEMA(data: PriceRecord[], period: number): (number | null)[] {
  if (!data || period <= 0) return [];
  const result: (number | null)[] = new Array(data.length).fill(null);

  if (data.length < period) {
    return result;
  }

  const alpha = 2 / (period + 1);

  // Initial seed is SMA of first `period` elements
  let seedSum = 0;
  for (let i = 0; i < period; i++) {
    seedSum += data[i].close;
  }
  let prevEma = seedSum / period;
  result[period - 1] = prevEma;

  // Apply EMA recurrent formula for subsequent points
  for (let i = period; i < data.length; i++) {
    const currentClose = data[i].close;
    const currentEma = currentClose * alpha + prevEma * (1 - alpha);
    result[i] = currentEma;
    prevEma = currentEma;
  }

  return result;
}

/**
 * Calculates Relative Strength Index (RSI) using J. Welles Wilder Jr.'s standard smoothing method.
 *
 * 1. For index 0 to period - 1, returns null (needs `period` price changes, which requires period + 1 prices).
 * 2. Initial average gain/loss at index = period is the simple arithmetic mean of the first `period` gains/losses.
 * 3. Subsequent average gain/loss (Wilder's smoothing):
 *      avgGain_t = (avgGain_{t-1} * (period - 1) + currentGain) / period
 *      avgLoss_t = (avgLoss_{t-1} * (period - 1) + currentLoss) / period
 * 4. RS = avgGain / avgLoss
 *    - If avgLoss == 0 and avgGain == 0: RSI = 50 (flat line / no change)
 *    - If avgLoss == 0 and avgGain > 0: RSI = 100 (only gains, zero losses)
 *    - Otherwise: RSI = 100 - (100 / (1 + RS))
 */
export function calculateRSI(data: PriceRecord[], period: number = 14): (number | null)[] {
  if (!data || period <= 0) return [];
  const result: (number | null)[] = new Array(data.length).fill(null);

  // We need at least `period + 1` prices to have `period` session changes
  if (data.length <= period) {
    return result;
  }

  // Calculate first period gains and losses
  let gainSum = 0;
  let lossSum = 0;

  for (let i = 1; i <= period; i++) {
    const change = data[i].close - data[i - 1].close;
    if (change > 0) {
      gainSum += change;
    } else {
      lossSum += Math.abs(change);
    }
  }

  let avgGain = gainSum / period;
  let avgLoss = lossSum / period;

  if (avgLoss === 0) {
    result[period] = avgGain === 0 ? 50 : 100;
  } else {
    const rs = avgGain / avgLoss;
    result[period] = 100 - (100 / (1 + rs));
  }

  // Subsequent points using Wilder's smoothing
  for (let i = period + 1; i < data.length; i++) {
    const change = data[i].close - data[i - 1].close;
    const currentGain = change > 0 ? change : 0;
    const currentLoss = change < 0 ? Math.abs(change) : 0;

    avgGain = (avgGain * (period - 1) + currentGain) / period;
    avgLoss = (avgLoss * (period - 1) + currentLoss) / period;

    if (avgLoss === 0) {
      result[i] = avgGain === 0 ? 50 : 100;
    } else {
      const rs = avgGain / avgLoss;
      result[i] = 100 - (100 / (1 + rs));
    }
  }

  return result;
}

/**
 * Calculates Relative Volume over a given period (default: 20 sessions).
 *
 * Relative Volume = Today's Volume / 20-session average volume.
 *
 * For index i < period - 1: returns null (insufficient history).
 * For index i >= period - 1: returns volume[i] / (sum(volume[i - period + 1 .. i]) / period).
 * Safely guards against divide-by-zero (e.g. if average volume is 0).
 */
export function calculateRelativeVolume(data: PriceRecord[], period: number = 20): (number | null)[] {
  if (!data || period <= 0) return [];
  const result: (number | null)[] = new Array(data.length).fill(null);

  if (data.length < period) {
    return result;
  }

  let rollingVolumeSum = 0;
  for (let i = 0; i < data.length; i++) {
    const vol = data[i].volume || 0;
    rollingVolumeSum += vol;

    if (i >= period) {
      rollingVolumeSum -= (data[i - period].volume || 0);
    }

    if (i >= period - 1) {
      const avgVol = rollingVolumeSum / period;
      if (avgVol === 0) {
        result[i] = vol === 0 ? 1 : null;
      } else {
        result[i] = vol / avgVol;
      }
    }
  }

  return result;
}
