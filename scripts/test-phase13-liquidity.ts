import { createClient } from '@supabase/supabase-js';
import { computeLiquidityMetrics, getMarketTradingDates } from '../src/lib/liquidityService';
import { getPriceHistory } from '../src/lib/dataService';

const url = process.env.VITE_SUPABASE_URL || '';
const key = process.env.VITE_SUPABASE_ANON_KEY || '';

async function runTests() {
  console.log('=== PHASE 13 LIQUIDITY VERIFICATION ===\n');

  // Test 1: Introspect daily_prices table for trade_count column
  const client = createClient(url, key);
  const { data: sampleRow, error: sampleErr } = await client.from('daily_prices').select('*').limit(1);
  if (sampleErr) {
    console.error('Failed to query daily_prices:', sampleErr);
    process.exit(1);
  }
  const columns = Object.keys(sampleRow[0] || {});
  console.log('1. daily_prices Schema Check:');
  console.log('   Columns:', columns.join(', '));
  const hasTradeCount = columns.some(c => ['trade_count', 'transactions', 'trades', 'total_trades'].includes(c.toLowerCase()));
  console.log(`   Has trade count column: ${hasTradeCount}`);
  if (!hasTradeCount) {
    console.log('   ✓ Confirmed honestly: trade_count is NOT in daily_prices table.');
  }

  // Test 2: Market Trading Dates
  console.log('\n2. Market Trading Dates Fetching:');
  const marketDates = await getMarketTradingDates();
  console.log(`   Total market trading dates fetched: ${marketDates.length}`);
  console.log(`   Latest market date: ${marketDates[0]}`);
  console.log(`   Second latest date: ${marketDates[1]}`);

  // Test 3: Liquid active symbol (NABIL)
  console.log('\n3. Liquid Symbol Test (NABIL):');
  const nabilPrices = await getPriceHistory('NABIL');
  console.log(`   Loaded ${nabilPrices.length} sessions for NABIL`);
  const nabilLiquidity = computeLiquidityMetrics('NABIL', nabilPrices, marketDates);
  console.log('   20-session Avg Volume:', nabilLiquidity.avgVolume20?.toLocaleString(), 'shares');
  console.log('   60-session Avg Volume:', nabilLiquidity.avgVolume60?.toLocaleString(), 'shares');
  console.log('   Liquidity Trend Ratio:', nabilLiquidity.liquidityTrendRatio, `(${nabilLiquidity.liquidityTrendDescription})`);
  console.log('   Days Since Last Trade:', nabilLiquidity.daysSinceLastTrade, 'sessions');
  console.log('   Is Stale (>5 sessions):', nabilLiquidity.isStale);
  console.log('   Trade Count Disclosure:', nabilLiquidity.tradeCountNote);

  if (!nabilLiquidity.has20SessionHistory || !nabilLiquidity.has60SessionHistory) {
    throw new Error('NABIL should have both 20 and 60 session history');
  }
  if (nabilLiquidity.isStale) {
    throw new Error('NABIL should not be flagged as stale');
  }

  // Test 4: Stale / Thin symbol (<20 sessions, stale trading)
  console.log('\n4. Stale / Low-history Symbol Test (ADBLB87):');
  const adblbPrices = await getPriceHistory('ADBLB87');
  console.log(`   Loaded ${adblbPrices.length} sessions for ADBLB87`);
  const adblbLiquidity = computeLiquidityMetrics('ADBLB87', adblbPrices, marketDates);
  console.log('   20-session Avg Volume:', adblbLiquidity.avgVolume20 === null ? 'insufficient history (<20 sessions)' : adblbLiquidity.avgVolume20);
  console.log('   60-session Avg Volume:', adblbLiquidity.avgVolume60 === null ? 'insufficient history (<60 sessions)' : adblbLiquidity.avgVolume60);
  console.log('   Trend Description:', adblbLiquidity.liquidityTrendDescription);
  console.log('   Days Since Last Trade:', adblbLiquidity.daysSinceLastTrade, 'sessions');
  console.log('   Is Stale (>5 sessions warning triggered):', adblbLiquidity.isStale);

  if (adblbLiquidity.has20SessionHistory) {
    throw new Error('ADBLB87 has only 3 sessions and must report insufficient history');
  }
  if (!adblbLiquidity.isStale) {
    throw new Error('ADBLB87 last traded in Aug 2026 and must trigger the stale warning (> 5 sessions)');
  }

  // Test 5: Empty price history
  console.log('\n5. Empty Array Edge Case:');
  const emptyLiquidity = computeLiquidityMetrics('EMPTY', [], marketDates);
  console.log('   Empty totalSessions:', emptyLiquidity.totalSessions);
  console.log('   Empty trend description:', emptyLiquidity.liquidityTrendDescription);
  if (emptyLiquidity.totalSessions !== 0 || emptyLiquidity.avgVolume20 !== null) {
    throw new Error('Empty history must return totalSessions 0 and null averages');
  }

  console.log('\n✓ ALL PHASE 13 LIQUIDITY VERIFICATIONS PASSED SUCCESSFULLY!');
}

runTests().catch(err => {
  console.error('Verification failed:', err);
  process.exit(1);
});
