import { getCompanies, getPriceHistory } from './dataService';
import { calculateSMA, calculateRSI } from './indicators';
import {
  detectTrendCrossSignals,
  detectRSIRecoverySignals,
  scoreSetup,
  computeSignalsFromConfig,
} from './probabilityScoring';
import { combineSignalsAND } from './signalCombination';
import {
  Company,
  MarketScanProgress,
  MarketScanResult,
  PriceRecord,
  PriceRecordWithIndicators,
  ScannedSetupMatch,
  ConfiguredSetupMatch,
  ConfiguredMarketScanResult,
  SignalFilterConfig,
} from '../types';

export interface MarketScannerOptions {
  concurrency?: number;
  onProgress?: (progress: MarketScanProgress) => void;
}

export interface ConfiguredMarketScannerOptions {
  concurrency?: number;
  onProgress?: (progress: MarketScanProgress) => void;
  conditionAConfig: SignalFilterConfig;
  conditionBConfig?: SignalFilterConfig;
  isCombined?: boolean;
  setupDescription: string;
  forwardSessions?: number;
  thresholdPercent?: number;
}

// In-memory price history cache for session (fast re-scans)
const priceHistoryCache = new Map<string, PriceRecord[]>();

export function clearScannerPriceCache(): void {
  priceHistoryCache.clear();
}

async function getCachedPriceHistory(symbol: string): Promise<PriceRecord[]> {
  if (priceHistoryCache.has(symbol)) {
    return priceHistoryCache.get(symbol)!;
  }
  const history = await getPriceHistory(symbol);
  priceHistoryCache.set(symbol, history);
  return history;
}

interface WorkerPoolResult {
  totalCompanies: number;
  scannedCount: number;
  failedCount: number;
  insufficientHistoryCount: number;
  durationMs: number;
  scannedAt: string;
}

/**
 * Shared worker-pool runner to prevent duplicating concurrency, progress reporting,
 * and error handling logic across scanners.
 */
async function runWorkerPool(
  concurrency: number,
  onProgress: ((progress: MarketScanProgress) => void) | undefined,
  processCompany: (company: Company, prices: PriceRecord[]) => void
): Promise<WorkerPoolResult> {
  const startTime = Date.now();
  const companies = await getCompanies();
  const totalCompanies = companies.length;

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
        const prices = await getCachedPriceHistory(symbol);

        // If symbol has too little history (under 50 sessions),
        // skip it silently from results but count it in insufficientHistoryCount
        if (!prices || prices.length < 50) {
          insufficientHistoryCount++;
        } else {
          scannedCount++;
          processCompany(company, prices);
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

  const workerPromises = Array.from(
    { length: Math.min(concurrency, totalCompanies) },
    () => worker()
  );
  await Promise.all(workerPromises);

  return {
    totalCompanies,
    scannedCount,
    failedCount,
    insufficientHistoryCount,
    durationMs: Date.now() - startTime,
    scannedAt: new Date().toISOString(),
  };
}

/**
 * Phase 6 Dashboard Scanner:
 * Scans all listed companies from `companies` table for recent occurrences
 * of SMA20/50 Bullish Cross and RSI Oversold Recovery within their last 5 sessions.
 * Sorted by recency descending.
 */
export async function scanMarketSetups(
  options: MarketScannerOptions = {}
): Promise<MarketScanResult> {
  const { concurrency = 8, onProgress } = options;
  const matches: ScannedSetupMatch[] = [];

  const poolResult = await runWorkerPool(concurrency, onProgress, (company, prices) => {
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

    // Trend Cross Setup: Recent = signal index >= data.length - 5
    const trendSignals = detectTrendCrossSignals(dataWithInd);
    const recentTrend = trendSignals.filter((idx) => idx >= lastFiveThreshold);
    if (recentTrend.length > 0) {
      const lastSigIdx = recentTrend[recentTrend.length - 1];
      const trendScore = scoreSetup(dataWithInd, trendSignals, 10, 2);
      matches.push({
        symbol: company.symbol,
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

    // RSI Recovery Setup: Recent = signal index >= data.length - 5
    const rsiSignals = detectRSIRecoverySignals(dataWithInd);
    const recentRsi = rsiSignals.filter((idx) => idx >= lastFiveThreshold);
    if (recentRsi.length > 0) {
      const lastSigIdx = recentRsi[recentRsi.length - 1];
      const rsiScore = scoreSetup(dataWithInd, rsiSignals, 10, 2);
      matches.push({
        symbol: company.symbol,
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
  });

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
    totalCompanies: poolResult.totalCompanies,
    scannedCount: poolResult.scannedCount,
    failedCount: poolResult.failedCount,
    insufficientHistoryCount: poolResult.insufficientHistoryCount,
    durationMs: poolResult.durationMs,
    scannedAt: poolResult.scannedAt,
  };
}

/**
 * Phase 15 Probability Lab Scanner:
 * Runs the currently configured setup (Condition A alone, or Combined A AND B)
 * across every symbol with available data, filtering for recent signals (last 5 sessions)
 * and ranking results by real historical hit rate descending.
 */
export async function scanConfiguredMarketSetup(
  options: ConfiguredMarketScannerOptions
): Promise<ConfiguredMarketScanResult> {
  const {
    concurrency = 8,
    onProgress,
    conditionAConfig,
    conditionBConfig,
    isCombined = false,
    setupDescription,
    forwardSessions = 10,
    thresholdPercent = 2.0,
  } = options;

  const matches: ConfiguredSetupMatch[] = [];
  let symbolsWithAnyOccurrenceCount = 0;

  const poolResult = await runWorkerPool(concurrency, onProgress, (company, prices) => {
    let signals: number[] = [];

    if (isCombined && conditionBConfig) {
      const { signals: sigA } = computeSignalsFromConfig(prices, conditionAConfig);
      const { signals: sigB } = computeSignalsFromConfig(prices, conditionBConfig);
      signals = combineSignalsAND(sigA, sigB);
    } else {
      const res = computeSignalsFromConfig(prices, conditionAConfig);
      signals = res.signals;
    }

    if (signals.length > 0) {
      symbolsWithAnyOccurrenceCount++;
    }

    const lastFiveThreshold = prices.length - 5;
    const recentSignals = signals.filter((idx) => idx >= lastFiveThreshold);

    if (recentSignals.length > 0) {
      const lastSigIdx = recentSignals[recentSignals.length - 1];
      const score = scoreSetup(prices, signals, forwardSessions, thresholdPercent);

      matches.push({
        symbol: company.symbol,
        setupName: setupDescription,
        signalDate: prices[lastSigIdx].date,
        sessionsAgo: prices.length - 1 - lastSigIdx,
        hitRate: score.hitRate,
        successCount: score.successCount,
        totalOccurrences: score.totalOccurrences,
        allOccurrencesCount: signals.length,
        avgForwardReturn: score.avgForwardReturn,
      });
    }
  });

  // Sort by HIT RATE descending (key difference from Dashboard recency sort)
  matches.sort((a, b) => {
    if (a.hitRate !== null && b.hitRate !== null) {
      if (b.hitRate !== a.hitRate) {
        return b.hitRate - a.hitRate;
      }
    } else if (a.hitRate !== null) {
      return -1;
    } else if (b.hitRate !== null) {
      return 1;
    }
    // Secondary tie-breaker: totalOccurrences descending
    if (b.totalOccurrences !== a.totalOccurrences) {
      return b.totalOccurrences - a.totalOccurrences;
    }
    // Tertiary: freshest signal date descending
    if (b.signalDate !== a.signalDate) {
      return b.signalDate.localeCompare(a.signalDate);
    }
    return a.symbol.localeCompare(b.symbol);
  });

  return {
    matches,
    totalCompanies: poolResult.totalCompanies,
    scannedCount: poolResult.scannedCount,
    failedCount: poolResult.failedCount,
    insufficientHistoryCount: poolResult.insufficientHistoryCount,
    symbolsWithAnyOccurrenceCount,
    isCombined,
    setupDescription,
    forwardSessions,
    thresholdPercent,
    durationMs: poolResult.durationMs,
    scannedAt: poolResult.scannedAt,
  };
}

