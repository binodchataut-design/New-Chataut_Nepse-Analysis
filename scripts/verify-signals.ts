import { getPriceHistory } from '../src/lib/dataService';
import { calculateSMA, calculateRSI } from '../src/lib/indicators';
import {
  detectTrendCrossSignals,
  detectRSIRecoverySignals,
  detectMACrossSignals,
  detectRSIThresholdSignals,
} from '../src/lib/probabilityScoring';

async function verify() {
  const symbols = ['NABIL', 'SHIVM', 'CHCL', 'SCB'];
  for (const sym of symbols) {
    const prices = await getPriceHistory(sym);
    if (!prices || prices.length < 50) continue;
    const sma20 = calculateSMA(prices, 20);
    const sma50 = calculateSMA(prices, 50);
    const rsi14 = calculateRSI(prices, 14);

    const dataWithInd = prices.map((p, i) => ({
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

    const trendMatch = JSON.stringify(origTrend) === JSON.stringify(genericTrend);
    const rsiMatch = JSON.stringify(origRSI) === JSON.stringify(genericRSI);

    console.log(`Symbol: ${sym}`);
    console.log(`  Trend Cross: orig count=${origTrend.length}, generic count=${genericTrend.length}, IDENTICAL=${trendMatch}`);
    console.log(`  Trend indices: ${JSON.stringify(genericTrend)}`);
    console.log(`  RSI Recovery: orig count=${origRSI.length}, generic count=${genericRSI.length}, IDENTICAL=${rsiMatch}`);
    console.log(`  RSI indices: ${JSON.stringify(genericRSI)}`);
  }
}
verify().catch(console.error);
