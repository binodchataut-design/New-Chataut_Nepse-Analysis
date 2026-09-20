import { PriceRecord } from '../types';

/**
 * Geometric metrics of a single session candle.
 */
export interface CandleGeometry {
  /** Absolute height of candle body: |close - open| */
  body: number;
  /** Total high-to-low range of session: high - low */
  range: number;
  /** Upper shadow height: high - max(open, close) */
  upperShadow: number;
  /** Lower shadow height: min(open, close) - low */
  lowerShadow: number;
  /** Proportion of session range occupied by body: body / range */
  bodyRatio: number;
  /** True if close > open */
  isBullishCandle: boolean;
}

/**
 * Computes single-candle geometric dimensions.
 * Skips session entirely (returns null) if range === 0, as shape cannot be classified.
 */
export function getCandleGeometry(record: PriceRecord): CandleGeometry | null {
  if (!record) return null;
  const { open, high, low, close } = record;
  const range = high - low;

  // Skip session entirely if range === 0 (zero-volume or frozen limit session)
  if (range <= 0 || !Number.isFinite(range)) {
    return null;
  }

  const body = Math.abs(close - open);
  const upperShadow = high - Math.max(open, close);
  const lowerShadow = Math.min(open, close) - low;
  const bodyRatio = body / range;
  const isBullishCandle = close > open;

  return {
    body,
    range,
    upperShadow,
    lowerShadow,
    bodyRatio,
    isBullishCandle,
  };
}

/**
 * Prior-trend check for directional context:
 * - 'down' if close[i-5] > close[i-1] (prior 5-session window sloped downward)
 * - 'up' if close[i-5] < close[i-1] (prior 5-session window sloped upward)
 * - 'flat' otherwise
 * Requires i >= 5, else 'flat' (pattern skipped as undetectable).
 */
export function getPriorTrend(data: PriceRecord[], i: number): 'up' | 'down' | 'flat' {
  if (i < 5 || !data || i >= data.length) return 'flat';
  const p5 = data[i - 5];
  const p1 = data[i - 1];
  if (!p5 || !p1) return 'flat';

  if (p5.close > p1.close) return 'down';
  if (p5.close < p1.close) return 'up';
  return 'flat';
}

/**
 * 1. Doji
 * Formula:
 *   bodyRatio <= 0.05
 * Meaning:
 *   Body is negligible vs total range (<= 5% of range), representing tight equilibrium
 *   between buyers and sellers.
 */
export function detectDoji(data: PriceRecord[]): number[] {
  if (!data || data.length === 0) return [];
  const matches: number[] = [];

  for (let i = 0; i < data.length; i++) {
    const geom = getCandleGeometry(data[i]);
    if (!geom) continue;

    // bodyRatio <= 0.05
    if (geom.bodyRatio <= 0.05) {
      matches.push(i);
    }
  }

  return matches;
}

/**
 * 2. Bullish Marubozu
 * Formula:
 *   isBullishCandle AND bodyRatio >= 0.95
 * Meaning:
 *   Almost no upper or lower shadows, strong full-bodied green candle closing near high.
 */
export function detectBullishMarubozu(data: PriceRecord[]): number[] {
  if (!data || data.length === 0) return [];
  const matches: number[] = [];

  for (let i = 0; i < data.length; i++) {
    const geom = getCandleGeometry(data[i]);
    if (!geom) continue;

    // isBullishCandle AND bodyRatio >= 0.95
    if (geom.isBullishCandle && geom.bodyRatio >= 0.95) {
      matches.push(i);
    }
  }

  return matches;
}

/**
 * 3. Bearish Marubozu
 * Formula:
 *   !isBullishCandle AND bodyRatio >= 0.95
 * Meaning:
 *   Almost no upper or lower shadows, strong full-bodied red candle closing near low.
 */
export function detectBearishMarubozu(data: PriceRecord[]): number[] {
  if (!data || data.length === 0) return [];
  const matches: number[] = [];

  for (let i = 0; i < data.length; i++) {
    const geom = getCandleGeometry(data[i]);
    if (!geom) continue;

    // !isBullishCandle AND bodyRatio >= 0.95
    if (!geom.isBullishCandle && geom.bodyRatio >= 0.95) {
      matches.push(i);
    }
  }

  return matches;
}

/**
 * 4. Hammer
 * Formula:
 *   bodyRatio <= 0.35 AND lowerShadow >= 2 * body AND upperShadow <= body AND priorTrend(i) === 'down'
 * Meaning:
 *   Small real body at upper end of trading range with long lower shadow (at least 2x body)
 *   and little to no upper shadow, occurring after a 5-session downtrend (potential bullish reversal).
 */
export function detectHammer(data: PriceRecord[]): number[] {
  if (!data || data.length < 6) return [];
  const matches: number[] = [];

  for (let i = 5; i < data.length; i++) {
    const geom = getCandleGeometry(data[i]);
    if (!geom) continue;

    if (
      geom.bodyRatio <= 0.35 &&
      geom.lowerShadow >= 2 * geom.body &&
      geom.upperShadow <= geom.body &&
      getPriorTrend(data, i) === 'down'
    ) {
      matches.push(i);
    }
  }

  return matches;
}

/**
 * 5. Hanging Man
 * Formula:
 *   bodyRatio <= 0.35 AND lowerShadow >= 2 * body AND upperShadow <= body AND priorTrend(i) === 'up'
 * Meaning:
 *   Same physical shape as Hammer, but occurring after a 5-session uptrend (potential bearish reversal / exhaustion).
 */
export function detectHangingMan(data: PriceRecord[]): number[] {
  if (!data || data.length < 6) return [];
  const matches: number[] = [];

  for (let i = 5; i < data.length; i++) {
    const geom = getCandleGeometry(data[i]);
    if (!geom) continue;

    if (
      geom.bodyRatio <= 0.35 &&
      geom.lowerShadow >= 2 * geom.body &&
      geom.upperShadow <= geom.body &&
      getPriorTrend(data, i) === 'up'
    ) {
      matches.push(i);
    }
  }

  return matches;
}

/**
 * 6. Inverted Hammer
 * Formula:
 *   bodyRatio <= 0.35 AND upperShadow >= 2 * body AND lowerShadow <= body AND priorTrend(i) === 'down'
 * Meaning:
 *   Small real body at lower end of trading range with long upper shadow (at least 2x body)
 *   and little to no lower shadow, occurring after a 5-session downtrend (potential bullish reversal).
 */
export function detectInvertedHammer(data: PriceRecord[]): number[] {
  if (!data || data.length < 6) return [];
  const matches: number[] = [];

  for (let i = 5; i < data.length; i++) {
    const geom = getCandleGeometry(data[i]);
    if (!geom) continue;

    if (
      geom.bodyRatio <= 0.35 &&
      geom.upperShadow >= 2 * geom.body &&
      geom.lowerShadow <= geom.body &&
      getPriorTrend(data, i) === 'down'
    ) {
      matches.push(i);
    }
  }

  return matches;
}

/**
 * 7. Shooting Star
 * Formula:
 *   bodyRatio <= 0.35 AND upperShadow >= 2 * body AND lowerShadow <= body AND priorTrend(i) === 'up'
 * Meaning:
 *   Same physical shape as Inverted Hammer, but occurring after a 5-session uptrend (potential bearish reversal / rejection of highs).
 */
export function detectShootingStar(data: PriceRecord[]): number[] {
  if (!data || data.length < 6) return [];
  const matches: number[] = [];

  for (let i = 5; i < data.length; i++) {
    const geom = getCandleGeometry(data[i]);
    if (!geom) continue;

    if (
      geom.bodyRatio <= 0.35 &&
      geom.upperShadow >= 2 * geom.body &&
      geom.lowerShadow <= geom.body &&
      getPriorTrend(data, i) === 'up'
    ) {
      matches.push(i);
    }
  }

  return matches;
}

/**
 * 8. Spinning Top
 * Formula:
 *   bodyRatio > 0.05 AND bodyRatio <= 0.35 AND upperShadow >= body AND lowerShadow >= body
 * Meaning:
 *   Small real body with shadows extending significantly to both sides (each >= body height),
 *   signaling market indecision / stalemate between bulls and bears.
 */
export function detectSpinningTop(data: PriceRecord[]): number[] {
  if (!data || data.length === 0) return [];
  const matches: number[] = [];

  for (let i = 0; i < data.length; i++) {
    const geom = getCandleGeometry(data[i]);
    if (!geom) continue;

    if (
      geom.bodyRatio > 0.05 &&
      geom.bodyRatio <= 0.35 &&
      geom.upperShadow >= geom.body &&
      geom.lowerShadow >= geom.body
    ) {
      matches.push(i);
    }
  }

  return matches;
}

/* ==========================================================================
   DOUBLE-CANDLE PATTERNS (PHASE 10)
   All patterns require i >= 1 and both session i-1 and i to have valid geometries
   (non-zero range). Returns index i of the confirming session.
   ========================================================================== */

/**
 * 9. Bullish Engulfing
 * Formula:
 *   close1 < open1 (bearish) AND close2 > open2 (bullish) AND open2 <= close1 AND close2 >= open1
 * Meaning:
 *   Prior session was bearish; current session opens at or below prior close and rallies
 *   to close at or above prior open, completely engulfing the prior real body.
 */
export function detectBullishEngulfing(data: PriceRecord[]): number[] {
  if (!data || data.length < 2) return [];
  const matches: number[] = [];

  for (let i = 1; i < data.length; i++) {
    const geom1 = getCandleGeometry(data[i - 1]);
    const geom2 = getCandleGeometry(data[i]);
    if (!geom1 || !geom2) continue;

    const open1 = data[i - 1].open;
    const close1 = data[i - 1].close;
    const open2 = data[i].open;
    const close2 = data[i].close;

    if (
      close1 < open1 &&
      close2 > open2 &&
      open2 <= close1 &&
      close2 >= open1
    ) {
      matches.push(i);
    }
  }

  return matches;
}

/**
 * 10. Bearish Engulfing
 * Formula:
 *   close1 > open1 (bullish) AND close2 < open2 (bearish) AND open2 >= close1 AND close2 <= open1
 * Meaning:
 *   Prior session was bullish; current session opens at or above prior close and sells off
 *   to close at or below prior open, completely engulfing the prior real body.
 */
export function detectBearishEngulfing(data: PriceRecord[]): number[] {
  if (!data || data.length < 2) return [];
  const matches: number[] = [];

  for (let i = 1; i < data.length; i++) {
    const geom1 = getCandleGeometry(data[i - 1]);
    const geom2 = getCandleGeometry(data[i]);
    if (!geom1 || !geom2) continue;

    const open1 = data[i - 1].open;
    const close1 = data[i - 1].close;
    const open2 = data[i].open;
    const close2 = data[i].close;

    if (
      close1 > open1 &&
      close2 < open2 &&
      open2 >= close1 &&
      close2 <= open1
    ) {
      matches.push(i);
    }
  }

  return matches;
}

/**
 * 11. Bullish Harami
 * Formula:
 *   close1 < open1 (bearish, larger body) AND close2 > open2 (bullish) AND
 *   min(open2, close2) >= min(open1, close1) AND max(open2, close2) <= max(open1, close1) AND body2 < body1
 * Meaning:
 *   Large bearish candle followed by a smaller bullish candle whose real body is completely
 *   contained inside the prior bearish body (indicating declining selling momentum).
 */
export function detectBullishHarami(data: PriceRecord[]): number[] {
  if (!data || data.length < 2) return [];
  const matches: number[] = [];

  for (let i = 1; i < data.length; i++) {
    const geom1 = getCandleGeometry(data[i - 1]);
    const geom2 = getCandleGeometry(data[i]);
    if (!geom1 || !geom2) continue;

    const open1 = data[i - 1].open;
    const close1 = data[i - 1].close;
    const open2 = data[i].open;
    const close2 = data[i].close;

    if (
      close1 < open1 &&
      close2 > open2 &&
      Math.min(open2, close2) >= Math.min(open1, close1) &&
      Math.max(open2, close2) <= Math.max(open1, close1) &&
      geom2.body < geom1.body
    ) {
      matches.push(i);
    }
  }

  return matches;
}

/**
 * 12. Bearish Harami
 * Formula:
 *   close1 > open1 (bullish, larger body) AND close2 < open2 (bearish) AND
 *   min(open2, close2) >= min(open1, close1) AND max(open2, close2) <= max(open1, close1) AND body2 < body1
 * Meaning:
 *   Large bullish candle followed by a smaller bearish candle whose real body is completely
 *   contained inside the prior bullish body (indicating declining buying momentum).
 */
export function detectBearishHarami(data: PriceRecord[]): number[] {
  if (!data || data.length < 2) return [];
  const matches: number[] = [];

  for (let i = 1; i < data.length; i++) {
    const geom1 = getCandleGeometry(data[i - 1]);
    const geom2 = getCandleGeometry(data[i]);
    if (!geom1 || !geom2) continue;

    const open1 = data[i - 1].open;
    const close1 = data[i - 1].close;
    const open2 = data[i].open;
    const close2 = data[i].close;

    if (
      close1 > open1 &&
      close2 < open2 &&
      Math.min(open2, close2) >= Math.min(open1, close1) &&
      Math.max(open2, close2) <= Math.max(open1, close1) &&
      geom2.body < geom1.body
    ) {
      matches.push(i);
    }
  }

  return matches;
}

/**
 * 13. Piercing Line
 * Formula:
 *   close1 < open1 (bearish) AND close2 > open2 (bullish) AND open2 < low1 AND
 *   close2 > (open1 + close1) / 2 AND close2 < open1
 * Meaning:
 *   Bearish candle 1 followed by bullish candle 2 that opens below prior low and recovers
 *   past the 50% midpoint of body 1, but closes below open1 (does not fully engulf).
 */
export function detectPiercingLine(data: PriceRecord[]): number[] {
  if (!data || data.length < 2) return [];
  const matches: number[] = [];

  for (let i = 1; i < data.length; i++) {
    const geom1 = getCandleGeometry(data[i - 1]);
    const geom2 = getCandleGeometry(data[i]);
    if (!geom1 || !geom2) continue;

    const open1 = data[i - 1].open;
    const close1 = data[i - 1].close;
    const low1 = data[i - 1].low;
    const open2 = data[i].open;
    const close2 = data[i].close;

    if (
      close1 < open1 &&
      close2 > open2 &&
      open2 < low1 &&
      close2 > (open1 + close1) / 2 &&
      close2 < open1
    ) {
      matches.push(i);
    }
  }

  return matches;
}

/**
 * 14. Dark Cloud Cover
 * Formula:
 *   close1 > open1 (bullish) AND close2 < open2 (bearish) AND open2 > high1 AND
 *   close2 < (open1 + close1) / 2 AND close2 > open1
 * Meaning:
 *   Bullish candle 1 followed by bearish candle 2 that opens above prior high and sells off
 *   more than 50% into body 1, but closes above open1 (does not fully engulf).
 */
export function detectDarkCloudCover(data: PriceRecord[]): number[] {
  if (!data || data.length < 2) return [];
  const matches: number[] = [];

  for (let i = 1; i < data.length; i++) {
    const geom1 = getCandleGeometry(data[i - 1]);
    const geom2 = getCandleGeometry(data[i]);
    if (!geom1 || !geom2) continue;

    const open1 = data[i - 1].open;
    const close1 = data[i - 1].close;
    const high1 = data[i - 1].high;
    const open2 = data[i].open;
    const close2 = data[i].close;

    if (
      close1 > open1 &&
      close2 < open2 &&
      open2 > high1 &&
      close2 < (open1 + close1) / 2 &&
      close2 > open1
    ) {
      matches.push(i);
    }
  }

  return matches;
}

/**
 * 15. Tweezer Top
 * Formula:
 *   abs(high2 - high1) <= 0.001 * high1 (highs match within 0.1% tolerance) AND
 *   close1 > open1 (first bullish) AND close2 < open2 (second bearish) AND
 *   getPriorTrend(data, i) === 'up'
 * Meaning:
 *   Uptrend resistance rejection where two consecutive candles touch nearly identical highs
 *   (within 0.1%), with the first bullish and second bearish.
 */
export function detectTweezerTop(data: PriceRecord[]): number[] {
  if (!data || data.length < 6) return [];
  const matches: number[] = [];

  for (let i = 5; i < data.length; i++) {
    const geom1 = getCandleGeometry(data[i - 1]);
    const geom2 = getCandleGeometry(data[i]);
    if (!geom1 || !geom2) continue;

    const high1 = data[i - 1].high;
    const high2 = data[i].high;
    const open1 = data[i - 1].open;
    const close1 = data[i - 1].close;
    const open2 = data[i].open;
    const close2 = data[i].close;

    if (
      Math.abs(high2 - high1) <= 0.001 * high1 &&
      close1 > open1 &&
      close2 < open2 &&
      getPriorTrend(data, i) === 'up'
    ) {
      matches.push(i);
    }
  }

  return matches;
}

/**
 * 16. Tweezer Bottom
 * Formula:
 *   abs(low2 - low1) <= 0.001 * low1 (lows match within 0.1% tolerance) AND
 *   close1 < open1 (first bearish) AND close2 > open2 (second bullish) AND
 *   getPriorTrend(data, i) === 'down'
 * Meaning:
 *   Downtrend support confirmation where two consecutive candles touch nearly identical lows
 *   (within 0.1%), with the first bearish and second bullish.
 */
export function detectTweezerBottom(data: PriceRecord[]): number[] {
  if (!data || data.length < 6) return [];
  const matches: number[] = [];

  for (let i = 5; i < data.length; i++) {
    const geom1 = getCandleGeometry(data[i - 1]);
    const geom2 = getCandleGeometry(data[i]);
    if (!geom1 || !geom2) continue;

    const low1 = data[i - 1].low;
    const low2 = data[i].low;
    const open1 = data[i - 1].open;
    const close1 = data[i - 1].close;
    const open2 = data[i].open;
    const close2 = data[i].close;

    if (
      Math.abs(low2 - low1) <= 0.001 * low1 &&
      close1 < open1 &&
      close2 > open2 &&
      getPriorTrend(data, i) === 'down'
    ) {
      matches.push(i);
    }
  }

  return matches;
}
