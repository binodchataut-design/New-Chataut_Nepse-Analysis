import { getCompanies, getPriceHistory } from './dataService';
import { calculateSMA, calculateRSI } from './indicators';
import {
  detectTrendCrossSignals,
  detectRSIRecoverySignals,
  scoreSetup,
} from './probabilityScoring';
import {
  MarketScanProgress,
  MarketScanResult,
  PriceRecordWithIndicators,
  ScannedSetupMatch,
} from '../types';

export interface MarketScannerOptions {
  concurrency?: number;
  onProgress?: (progress: MarketScanProgress) => void;
}

/**
 * Scans all listed companies from `companies` table for recent occurrences
 * of SMA20/50 Bullish Cross and RSI Oversold Recovery within their last 5 sessions.
 *
 * Runs strictly with a controlled concurrency limit (default 8) to avoid hammering
 * Supabase or dropping frames in the UI thread.
 */
export async function scanMarketSetups(
  options: MarketScannerOptions = {}
): Promise<MarketScanResult> {
  const { concurrency = 8, onProgress } = options;
  const startTime = Date.now();

  const companies = await getCompanies();
  const totalCompanies = companies.length;

  const matches: ScannedSetupMatch[] = [];
  let processedCount = 0;
  let scannedCount = 0;
  let failedCount = 0;
  let insufficientHistoryCount = 0;

  let nextCompanyIndex = 0;

  async function worker() {
    while (nextCompanyIndex < totalCompanies) {
      const currentIndex = nextCompanyIndex++;
      const company = companies[currentIndex];
      const symbol = company.symbol;

      onProgress?.({
        scannedCount: processedCount,
        totalCompanies,
        currentSymbol: symbol,
      });

      try {
        const prices = await getPriceHistory(symbol);

        // If symbol has too little history to compute indicators (under 50 sessions),
        // skip it silently from results but count it in insufficientHistoryCount
        if (!prices || prices.length < 50) {
          insufficientHistoryCount++;
        } else {
          scannedCount++;

          // 2. Compute SMA20, SMA50, RSI14 via existing indicator functions
          const sma20 = calculateSMA(prices, 20);
          const sma50 = calculateSMA(prices, 50);
          const rsi14 = calculateRSI(prices, 14);

          const dataWithInd: PriceRecordWithIndicators[] = prices.map((p, i) => ({
            ...p,
            sma20: sma20[i] ?? null,
            sma50: sma50[i] ?? null,
            ema20: null,
            rsi14: rsi14[i] ?? null,
            relativeVolume: null,
          }));

          const lastFiveThreshold = dataWithInd.length - 5;

          // 3 & 4. Trend Cross Setup: Recent = signal index >= data.length - 5
          const trendSignals = detectTrendCrossSignals(dataWithInd);
          const recentTrend = trendSignals.filter((idx) => idx >= lastFiveThreshold);
          if (recentTrend.length > 0) {
            const lastSigIdx = recentTrend[recentTrend.length - 1];
            // 5. Score using ALL of that symbol's historical signals (N=10 sessions, 2% threshold)
            const trendScore = scoreSetup(dataWithInd, trendSignals, 10, 2);
            matches.push({
              symbol,
              setupName: 'SMA20/50 Bullish Cross',
              signalDate: dataWithInd[lastSigIdx].date,
              sessionsAgo: dataWithInd.length - 1 - lastSigIdx,
              hitRate: trendScore.hitRate,
              successCount: trendScore.successCount,
              totalOccurrences: trendScore.totalOccurrences,
              allOccurrencesCount: trendSignals.length,
              avgForwardReturn: trendScore.avgForwardReturn,
            });
          }

          // 3 & 4. RSI Recovery Setup: Recent = signal index >= data.length - 5
          const rsiSignals = detectRSIRecoverySignals(dataWithInd);
          const recentRsi = rsiSignals.filter((idx) => idx >= lastFiveThreshold);
          if (recentRsi.length > 0) {
            const lastSigIdx = recentRsi[recentRsi.length - 1];
            // 5. Score using ALL of that symbol's historical signals (N=10 sessions, 2% threshold)
            const rsiScore = scoreSetup(dataWithInd, rsiSignals, 10, 2);
            matches.push({
              symbol,
              setupName: 'RSI Oversold Recovery',
              signalDate: dataWithInd[lastSigIdx].date,
              sessionsAgo: dataWithInd.length - 1 - lastSigIdx,
              hitRate: rsiScore.hitRate,
              successCount: rsiScore.successCount,
              totalOccurrences: rsiScore.totalOccurrences,
              allOccurrencesCount: rsiSignals.length,
              avgForwardReturn: rsiScore.avgForwardReturn,
            });
          }
        }
      } catch (err) {
        failedCount++;
        console.warn(`[marketScanner] Error fetching history for ${symbol}:`, err);
      } finally {
        processedCount++;
        onProgress?.({
          scannedCount: processedCount,
          totalCompanies,
          currentSymbol: symbol,
        });
      }
    }
  }

  // Run worker pool
  const workerPromises = Array.from(
    { length: Math.min(concurrency, totalCompanies) },
    () => worker()
  );
  await Promise.all(workerPromises);

  // Sort matches by signalDate descending (freshest first), then sessionsAgo ascending
  matches.sort((a, b) => {
    if (b.signalDate !== a.signalDate) {
      return b.signalDate.localeCompare(a.signalDate);
    }
    if (a.sessionsAgo !== b.sessionsAgo) {
      return a.sessionsAgo - b.sessionsAgo;
    }
    return a.symbol.localeCompare(b.symbol);
  });

  return {
    matches,
    totalCompanies,
    scannedCount,
    failedCount,
    insufficientHistoryCount,
    durationMs: Date.now() - startTime,
    scannedAt: new Date().toISOString(),
  };
}
