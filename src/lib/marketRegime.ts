import { MarketRegimeInfo, MarketRegimeType } from '../types';
import { calculateSMA } from './indicators';

export interface MarketIndexSessionInput {
  date: string;
  close: number;
}

/**
 * Classifies the overall NEPSE market regime based purely on the index's closing
 * price relative to its 50-session and 200-session Simple Moving Averages.
 *
 * Rules:
 * - 'Insufficient History': fewer than 200 sessions available in market_index (SMA200 is null).
 * - 'Bullish': index close > SMA50 AND SMA50 > SMA200
 * - 'Bearish': index close < SMA50 AND SMA50 < SMA200
 * - 'Neutral': all other conditions (e.g. index close > SMA50 but SMA50 <= SMA200, or index close < SMA50 but SMA50 >= SMA200)
 *
 * This function is pure, auditable, and descriptive — not a directional prediction.
 */
export function classifyMarketRegime(
  history: MarketIndexSessionInput[]
): MarketRegimeInfo | null {
  if (!history || history.length === 0) {
    return null;
  }

  // Ensure chronological order ascending by date (oldest to newest)
  const sorted = [...history].sort((a, b) => a.date.localeCompare(b.date));
  const sessionCount = sorted.length;
  const lastIndex = sorted.length - 1;
  const lastSession = sorted[lastIndex];
  const currentClose = Number(lastSession.close);

  // Compute SMA50 and SMA200 using the verified calculateSMA function from indicators.ts
  const sma50Series = calculateSMA(sorted, 50);
  const sma200Series = calculateSMA(sorted, 200);

  const sma50 = sma50Series[lastIndex];
  const sma200 = sma200Series[lastIndex];

  const distanceSMA50Pct =
    sma50 !== null && sma50 > 0
      ? Number((((currentClose - sma50) / sma50) * 100).toFixed(2))
      : null;

  const distanceSMA200Pct =
    sma200 !== null && sma200 > 0
      ? Number((((currentClose - sma200) / sma200) * 100).toFixed(2))
      : null;

  const ruleExplanation =
    'Bullish: index above both 50 and 200-session averages, with 50 above 200. Bearish: index below both 50 and 200-session averages, with 50 below 200. Otherwise Neutral.';

  // Rule 4: If history has fewer than 200 sessions, SMA200 cannot be computed.
  // Report 'Insufficient History' rather than guessing or falling back to only SMA50.
  if (sessionCount < 200 || sma200 === null) {
    return {
      regime: 'Insufficient History',
      currentClose,
      sma50,
      sma200: null,
      distanceSMA50Pct,
      distanceSMA200Pct: null,
      sessionCount,
      date: lastSession.date,
      ruleExplanation,
      descriptiveSummary: `Index has ${sessionCount} session${sessionCount === 1 ? '' : 's'} recorded (< 200 required for 200-session SMA).`,
    };
  }

  // Rule 3: Classification
  let regime: MarketRegimeType = 'Neutral';
  let descriptiveSummary = '';

  if (sma50 !== null && currentClose > sma50 && sma50 > sma200) {
    regime = 'Bullish';
    descriptiveSummary = `Index (${currentClose.toFixed(2)}) is trading above both its 50-session (${sma50.toFixed(2)}) and 200-session (${sma200.toFixed(2)}) averages, with SMA50 above SMA200.`;
  } else if (sma50 !== null && currentClose < sma50 && sma50 < sma200) {
    regime = 'Bearish';
    descriptiveSummary = `Index (${currentClose.toFixed(2)}) is trading below both its 50-session (${sma50.toFixed(2)}) and 200-session (${sma200.toFixed(2)}) averages, with SMA50 below SMA200.`;
  } else {
    regime = 'Neutral';
    if (sma50 !== null) {
      if (currentClose > sma50 && sma50 <= sma200) {
        descriptiveSummary = `Index (${currentClose.toFixed(2)}) is above its 50-session average (${sma50.toFixed(2)}), but SMA50 remains below its 200-session average (${sma200.toFixed(2)}).`;
      } else if (currentClose < sma50 && sma50 >= sma200) {
        descriptiveSummary = `Index (${currentClose.toFixed(2)}) is below its 50-session average (${sma50.toFixed(2)}), while SMA50 remains above its 200-session average (${sma200.toFixed(2)}).`;
      } else {
        descriptiveSummary = `Moving averages are mixed relative to index close (${currentClose.toFixed(2)} vs SMA50 ${sma50.toFixed(2)} and SMA200 ${sma200.toFixed(2)}).`;
      }
    } else {
      descriptiveSummary = `Index close is ${currentClose.toFixed(2)}.`;
    }
  }

  return {
    regime,
    currentClose,
    sma50,
    sma200,
    distanceSMA50Pct,
    distanceSMA200Pct,
    sessionCount,
    date: lastSession.date,
    ruleExplanation,
    descriptiveSummary,
  };
}
