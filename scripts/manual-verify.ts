import { createClient } from '@supabase/supabase-js';
import { calculateSMA, calculateEMA, calculateRSI } from '../src/lib/indicators';
import {
  detectTrendCrossSignals,
  detectRSIRecoverySignals,
  detectMACrossSignals,
  detectRSIThresholdSignals,
  scoreSetup,
} from '../src/lib/probabilityScoring';
import { runBacktest } from '../src/lib/backtestEngine';
import { PriceRecord, PriceRecordWithIndicators } from '../src/types';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY!;

const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function getPriceHistory(symbol: string): Promise<PriceRecord[]> {
  const { data, error } = await client
    .from('daily_prices')
    .select('*')
    .eq('symbol', symbol)
    .order('date', { ascending: true })
    .limit(5000);

  if (error) throw new Error(`Fetch failed for ${symbol}: ${error.message}`);
  if (!data) return [];

  return data.map((row: Record<string, unknown>) => ({
    date: String(row.date).split('T')[0],
    open: Number(row.open ?? 0),
    high: Number(row.high ?? 0),
    low: Number(row.low ?? 0),
    close: Number(row.close ?? 0),
    volume: Number(row.volume ?? 0),
    raw: row,
  }));
}

async function main() {
  const symbol = 'NABIL';
  const prices = await getPriceHistory(symbol);
  console.log(`Fetched ${prices.length} sessions for ${symbol}`);

  const sma20 = calculateSMA(prices, 20);
  const sma50 = calculateSMA(prices, 50);
  const rsi14 = calculateRSI(prices, 14);
  const ema10 = calculateEMA(prices, 10);
  const ema30 = calculateEMA(prices, 30);

  const dataWithInd: PriceRecordWithIndicators[] = prices.map((p, i) => ({
    ...p,
    sma20: sma20[i] ?? null,
    sma50: sma50[i] ?? null,
    ema20: null,
    rsi14: rsi14[i] ?? null,
    relativeVolume: null,
  }));

  const origTrend = detectTrendCrossSignals(dataWithInd);
  const genericTrend = detectMACrossSignals(sma20, sma50);
  const origRSI = detectRSIRecoverySignals(dataWithInd);
  const genericRSI = detectRSIThresholdSignals(rsi14, 30, 'recovery');

  console.log('\n=== EQUIVALENCE CHECK ===');
  console.log('MATCH (trend):', JSON.stringify(origTrend) === JSON.stringify(genericTrend));
  console.log('MATCH (rsi):', JSON.stringify(origRSI) === JSON.stringify(genericRSI));

  console.log('\n=== DEFAULT: SMA20/50 Cross Backtest (target 3%, stop 2%) ===');
  const defaultBT = runBacktest(dataWithInd, genericTrend, 3, 2, 20);
  console.log(`totalTrades=${defaultBT.totalTrades} wins=${defaultBT.wins} losses=${defaultBT.losses} expired=${defaultBT.expired}`);
  console.log(`winRate=${defaultBT.winRate?.toFixed(2)}% expectancy=${defaultBT.expectancy?.toFixed(4)}%`);
  defaultBT.trades.forEach((t, idx) => console.log(`  #${idx+1} signal=${t.signalDate} entry=${t.entryDate}@${t.entryPrice.toFixed(2)} exit=${t.exitDate}@${t.exitPrice.toFixed(2)} hold=${t.holdingSessions} return=${t.returnPct.toFixed(2)}% reason=${t.exitReason}`));

  console.log('\n=== CUSTOM: EMA10/30 Cross Backtest (target 3%, stop 2%) ===');
  const emaSignals = detectMACrossSignals(ema10, ema30);
  console.log(`EMA10/30 signal indices (${emaSignals.length}):`, JSON.stringify(emaSignals));
  const emaBT = runBacktest(dataWithInd, emaSignals, 3, 2, 20);
  console.log(`totalTrades=${emaBT.totalTrades} wins=${emaBT.wins} losses=${emaBT.losses} expired=${emaBT.expired}`);
  console.log(`winRate=${emaBT.winRate?.toFixed(2)}% expectancy=${emaBT.expectancy?.toFixed(4)}%`);
  emaBT.trades.forEach((t, idx) => console.log(`  #${idx+1} signal=${t.signalDate} entry=${t.entryDate}@${t.entryPrice.toFixed(2)} exit=${t.exitDate}@${t.exitPrice.toFixed(2)} hold=${t.holdingSessions} return=${t.returnPct.toFixed(2)}% reason=${t.exitReason}`));

  console.log('\n=== PROBABILITY SCORING (10 sessions, 2% threshold) ===');
  const defaultScore = scoreSetup(dataWithInd, genericTrend, 10, 2);
  console.log(`SMA20/50: ${defaultScore.successCount} of ${defaultScore.totalOccurrences}, hitRate=${defaultScore.hitRate?.toFixed(2)}%`);
  const emaScore = scoreSetup(dataWithInd, emaSignals, 10, 2);
  console.log(`EMA10/30: ${emaScore.successCount} of ${emaScore.totalOccurrences}, hitRate=${emaScore.hitRate?.toFixed(2)}%`);
}

main().catch((err) => { console.error('FAILED:', err); process.exit(1); });
