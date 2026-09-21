/**
 * Liquidity Service for NEPSE Trading Assistant
 * Phase 13: Computes liquidity metrics for the currently selected symbol
 * using existing price history records from daily_prices.
 *
 * Honesty rules:
 * - No invented 0-100 "liquidity score".
 * - If under 20 sessions, show "insufficient history".
 * - If daysSinceLastTrade > 5, flag as stale/inactive.
 * - If trade_count column does not exist in daily_prices, state so honestly.
 */

import { PriceRecord, LiquidityMetrics } from '../types';
import { getSupabaseClient } from './supabaseClient';

let cachedMarketDates: string[] | null = null;

/**
 * Fetches and caches the chronological descending list of market trading dates
 * from the market_index table, fallback to distinct dates in daily_prices.
 */
export async function getMarketTradingDates(): Promise<string[]> {
  if (cachedMarketDates && cachedMarketDates.length > 0) {
    return cachedMarketDates;
  }

  try {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('market_index')
      .select('date')
      .order('date', { ascending: false });

    if (!error && data && data.length > 0) {
      cachedMarketDates = data.map((r: { date: string }) => String(r.date));
      return cachedMarketDates;
    }
  } catch (err) {
    console.warn('Could not query market_index for trading dates:', err);
  }

  try {
    // Fallback: distinct dates from daily_prices
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('daily_prices')
      .select('date')
      .order('date', { ascending: false })
      .limit(100);

    if (!error && data && data.length > 0) {
      const set = Array.from(new Set(data.map((r: { date: string }) => String(r.date))));
      set.sort((a, b) => b.localeCompare(a));
      cachedMarketDates = set;
      return cachedMarketDates;
    }
  } catch (err) {
    console.warn('Could not query daily_prices fallback dates:', err);
  }

  return [];
}

/**
 * Computes pure liquidity metrics for a symbol from its chronological price history.
 * Does NOT make additional DB calls for price history (reuses existing array).
 */
export function computeLiquidityMetrics(
  symbol: string,
  priceHistory: PriceRecord[],
  marketTradingDates: string[] = []
): LiquidityMetrics {
  const totalSessions = priceHistory.length;

  if (totalSessions === 0) {
    return {
      symbol,
      totalSessions: 0,
      latestSessionDate: null,
      marketLatestDate: marketTradingDates.length > 0 ? marketTradingDates[0] : null,
      daysSinceLastTrade: null,
      isStale: false,
      has20SessionHistory: false,
      avgVolume20: null,
      has60SessionHistory: false,
      avgVolume60: null,
      liquidityTrendRatio: null,
      liquidityTrendDescription: 'No price history available',
      liquidityTrendDirection: 'insufficient',
      hasTradeCountColumn: false,
      tradeCount20: null,
      tradeCount60: null,
      tradeCountNote: 'Trade count (transactions) is not tracked in the daily_prices table',
    };
  }

  // Symbol's latest record (assuming sorted ascending by date)
  const latestRecord = priceHistory[totalSessions - 1];
  const latestSessionDate = latestRecord.date;
  const marketLatestDate = marketTradingDates.length > 0 ? marketTradingDates[0] : null;

  // Calculate daysSinceLastTrade (trading sessions between symbol's last date and market max date)
  let daysSinceLastTrade: number | null = null;
  if (marketLatestDate && latestSessionDate) {
    if (latestSessionDate >= marketLatestDate) {
      daysSinceLastTrade = 0;
    } else {
      daysSinceLastTrade = marketTradingDates.filter(
        (d) => d > latestSessionDate && d <= marketLatestDate
      ).length;
    }
  }

  const isStale = daysSinceLastTrade !== null && daysSinceLastTrade > 5;

  // 20-session average volume
  let avgVolume20: number | null = null;
  const has20SessionHistory = totalSessions >= 20;
  if (has20SessionHistory) {
    const recent20 = priceHistory.slice(-20);
    const sum20 = recent20.reduce((acc, r) => acc + (Number(r.volume) || 0), 0);
    avgVolume20 = Math.round(sum20 / 20);
  }

  // 60-session average volume
  let avgVolume60: number | null = null;
  const has60SessionHistory = totalSessions >= 60;
  if (has60SessionHistory) {
    const recent60 = priceHistory.slice(-60);
    const sum60 = recent60.reduce((acc, r) => acc + (Number(r.volume) || 0), 0);
    avgVolume60 = Math.round(sum60 / 60);
  }

  // Liquidity Trend (ratio of 20-session avg vs 60-session baseline)
  let liquidityTrendRatio: number | null = null;
  let liquidityTrendDescription = 'insufficient history (< 60 sessions)';
  let liquidityTrendDirection: 'rising' | 'fading' | 'neutral' | 'insufficient' = 'insufficient';

  if (!has20SessionHistory) {
    liquidityTrendDescription = 'insufficient history (< 20 sessions)';
    liquidityTrendDirection = 'insufficient';
  } else if (!has60SessionHistory) {
    liquidityTrendDescription = 'insufficient history (< 60 sessions)';
    liquidityTrendDirection = 'insufficient';
  } else if (avgVolume60 === null || avgVolume60 === 0) {
    if (avgVolume20 !== null && avgVolume20 > 0) {
      liquidityTrendRatio = null;
      liquidityTrendDescription = 'Activity emerging from zero 60-session baseline';
      liquidityTrendDirection = 'rising';
    } else {
      liquidityTrendRatio = 0;
      liquidityTrendDescription = 'Zero volume recorded across both baselines';
      liquidityTrendDirection = 'neutral';
    }
  } else if (avgVolume20 !== null) {
    const ratio = Number((avgVolume20 / avgVolume60).toFixed(2));
    liquidityTrendRatio = ratio;

    if (ratio >= 1.25) {
      liquidityTrendDirection = 'rising';
      liquidityTrendDescription = `${ratio}x higher than 60-session average (rising)`;
    } else if (ratio <= 0.8) {
      liquidityTrendDirection = 'fading';
      liquidityTrendDescription = `${ratio}x — below 60-session normal (fading)`;
    } else {
      liquidityTrendDirection = 'neutral';
      liquidityTrendDescription = `${ratio}x — in line with 60-session normal`;
    }
  }

  // Trade count (transactions) column check in daily_prices
  // We verified daily_prices schema: ['id', 'symbol', 'date', 'open', 'high', 'low', 'close', 'volume', 'per_change', 'possible_corporate_action', 'created_at']
  // No transaction/trade count column exists.
  const hasTradeCountColumn = false;
  const tradeCount20: number | null = null;
  const tradeCount60: number | null = null;
  const tradeCountNote = 'Trade count (transactions) is not tracked in the daily_prices table.';

  return {
    symbol,
    totalSessions,
    latestSessionDate,
    marketLatestDate,
    daysSinceLastTrade,
    isStale,
    has20SessionHistory,
    avgVolume20,
    has60SessionHistory,
    avgVolume60,
    liquidityTrendRatio,
    liquidityTrendDescription,
    liquidityTrendDirection,
    hasTradeCountColumn,
    tradeCount20,
    tradeCount60,
    tradeCountNote,
  };
}
