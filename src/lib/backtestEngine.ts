import { BacktestResult, BacktestTrade, PriceRecordWithIndicators } from '../types';

/**
 * Executes a simulated trade backtest on an arbitrary series of signal session indices.
 *
 * This function accepts pure signal indices (number[]) and remains completely decoupled
 * from how signals are generated, ensuring compatibility with current indicators and
 * any future signal generators (e.g. candlestick patterns, multi-timeframe rules).
 *
 * Execution Logic:
 * 1. Entry: Next session's open price (data[i + 1].open). If i + 1 doesn't exist,
 *    it is excluded as insufficient forward data.
 * 2. Walk forward up to maxHoldingSessions:
 *    - targetPrice = entryPrice * (1 + targetPct / 100)
 *    - stopPrice = entryPrice * (1 - stopPct / 100)
 *    - Same-session collision (low <= stopPrice AND high >= targetPrice):
 *      Assumes STOP hit first (conservative daily OHLC assumption).
 *    - First trigger wins ('target' or 'stop').
 *    - Neither triggers within window -> exits at session close, marked 'expired'.
 * 3. Expired trades are excluded from winRate (wins / (wins + losses)) but included
 *    in totalTrades and overall expectancy.
 */
export function runBacktest(
  data: PriceRecordWithIndicators[],
  signalIndices: number[],
  targetPct: number = 3,
  stopPct: number = 2,
  maxHoldingSessions: number = 20
): BacktestResult {
  if (
    !data ||
    data.length === 0 ||
    !signalIndices ||
    signalIndices.length === 0 ||
    maxHoldingSessions <= 0
  ) {
    return {
      totalTrades: 0,
      excludedTrades: 0,
      wins: 0,
      losses: 0,
      expired: 0,
      winRate: null,
      avgWinReturn: null,
      avgLossReturn: null,
      expectancy: null,
      trades: [],
    };
  }

  let excludedTrades = 0;
  const trades: BacktestTrade[] = [];

  for (const i of signalIndices) {
    if (i < 0 || i >= data.length) continue;

    // Next session must exist to execute entry at open
    if (i + 1 >= data.length) {
      excludedTrades++;
      continue;
    }

    const signalBar = data[i];
    const entryBar = data[i + 1];

    // Fallback if open is missing or zero
    const entryPrice = entryBar.open > 0 ? entryBar.open : entryBar.close;
    const entryDate = entryBar.date;
    const signalDate = signalBar.date;

    const targetPrice = entryPrice * (1 + targetPct / 100);
    const stopPrice = entryPrice * (1 - stopPct / 100);

    let exitDate = '';
    let exitPrice = 0;
    let exitReason: 'target' | 'stop' | 'expired' = 'expired';
    let holdingSessions = 0;

    // Walk forward from entry session up to maxHoldingSessions
    const maxIdx = Math.min(data.length - 1, i + maxHoldingSessions);
    let resolved = false;

    for (let s = i + 1; s <= maxIdx; s++) {
      const bar = data[s];
      const hitStop = bar.low <= stopPrice;
      const hitTarget = bar.high >= targetPrice;

      if (hitStop && hitTarget) {
        // Both trigger in same session -> conservative assumption: STOP hit first
        resolved = true;
        exitDate = bar.date;
        exitPrice = stopPrice;
        exitReason = 'stop';
        holdingSessions = s - i;
        break;
      } else if (hitStop) {
        resolved = true;
        exitDate = bar.date;
        exitPrice = stopPrice;
        exitReason = 'stop';
        holdingSessions = s - i;
        break;
      } else if (hitTarget) {
        resolved = true;
        exitDate = bar.date;
        exitPrice = targetPrice;
        exitReason = 'target';
        holdingSessions = s - i;
        break;
      }
    }

    if (!resolved) {
      // Neither triggered within max holding window -> exit at final session close
      const lastBar = data[maxIdx];
      exitDate = lastBar.date;
      exitPrice = lastBar.close;
      exitReason = 'expired';
      holdingSessions = maxIdx - i;
    }

    const returnPct =
      entryPrice > 0 ? ((exitPrice - entryPrice) / entryPrice) * 100 : 0;

    trades.push({
      signalDate,
      entryDate,
      entryPrice,
      exitDate,
      exitPrice,
      exitReason,
      returnPct,
      holdingSessions,
    });
  }

  const totalTrades = trades.length;
  const wins = trades.filter((t) => t.exitReason === 'target').length;
  const losses = trades.filter((t) => t.exitReason === 'stop').length;
  const expired = trades.filter((t) => t.exitReason === 'expired').length;

  const resolvedTrades = wins + losses;
  const winRate = resolvedTrades > 0 ? (wins / resolvedTrades) * 100 : null;

  const winTrades = trades.filter((t) => t.exitReason === 'target');
  const lossTrades = trades.filter((t) => t.exitReason === 'stop');

  const avgWinReturn =
    wins > 0 ? winTrades.reduce((s, t) => s + t.returnPct, 0) / wins : null;
  const avgLossReturn =
    losses > 0 ? lossTrades.reduce((s, t) => s + t.returnPct, 0) / losses : null;

  const expectancy =
    totalTrades > 0
      ? trades.reduce((s, t) => s + t.returnPct, 0) / totalTrades
      : null;

  return {
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
  };
}
