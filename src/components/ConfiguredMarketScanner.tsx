import React, { useState, useMemo, useCallback } from 'react';
import {
  ConfiguredMarketScanResult,
  ConfiguredSetupMatch,
  MarketScanProgress,
  SignalFilterConfig,
} from '../types';
import { scanConfiguredMarketSetup } from '../lib/marketScanner';
import {
  Play,
  RefreshCw,
  AlertTriangle,
  Info,
  Clock,
  ArrowRight,
  TrendingUp,
  Layers,
  GitMerge,
  Filter,
  CheckCircle2,
} from 'lucide-react';

interface ConfiguredMarketScannerProps {
  conditionAConfig: SignalFilterConfig;
  conditionBConfig?: SignalFilterConfig;
  isCombined: boolean;
  setupDescription: string;
  forwardSessions: number;
  thresholdPercent: number;
  onSelectSymbolAndNavigate?: (symbol: string) => void;
}

export const ConfiguredMarketScanner: React.FC<ConfiguredMarketScannerProps> = ({
  conditionAConfig,
  conditionBConfig,
  isCombined,
  setupDescription,
  forwardSessions,
  thresholdPercent,
  onSelectSymbolAndNavigate,
}) => {
  const [scanResult, setScanResult] = useState<ConfiguredMarketScanResult | null>(null);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [scanProgress, setScanProgress] = useState<MarketScanProgress | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);

  // Minimum occurrence threshold for trusted ranking section (default 10)
  const [minOccurrences, setMinOccurrences] = useState<number>(10);
  const [symbolFilter, setSymbolFilter] = useState<string>('');

  // Track the configuration at the time the scan was run
  const [scannedConfigSnapshot, setScannedConfigSnapshot] = useState<{
    setupDescription: string;
    isCombined: boolean;
    forwardSessions: number;
    thresholdPercent: number;
  } | null>(null);

  const isConfigStale = useMemo(() => {
    if (!scannedConfigSnapshot) return false;
    return (
      scannedConfigSnapshot.setupDescription !== setupDescription ||
      scannedConfigSnapshot.isCombined !== isCombined ||
      scannedConfigSnapshot.forwardSessions !== forwardSessions ||
      scannedConfigSnapshot.thresholdPercent !== thresholdPercent
    );
  }, [scannedConfigSnapshot, setupDescription, isCombined, forwardSessions, thresholdPercent]);

  const handleRunScan = useCallback(async () => {
    if (isScanning) return;
    setIsScanning(true);
    setScanError(null);
    setScanProgress(null);

    try {
      const result = await scanConfiguredMarketSetup({
        concurrency: 8,
        conditionAConfig,
        conditionBConfig,
        isCombined,
        setupDescription,
        forwardSessions,
        thresholdPercent,
        onProgress: (p) => setScanProgress(p),
      });
      setScanResult(result);
      setScannedConfigSnapshot({
        setupDescription,
        isCombined,
        forwardSessions,
        thresholdPercent,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setScanError(msg);
    } finally {
      setIsScanning(false);
      setScanProgress(null);
    }
  }, [
    isScanning,
    conditionAConfig,
    conditionBConfig,
    isCombined,
    setupDescription,
    forwardSessions,
    thresholdPercent,
  ]);

  // Filter and split matches into trusted (>= minOccurrences) and low-sample (< minOccurrences)
  const { trustedMatches, lowSampleMatches, totalFilteredCount } = useMemo(() => {
    if (!scanResult) {
      return { trustedMatches: [], lowSampleMatches: [], totalFilteredCount: 0 };
    }

    let list = scanResult.matches;
    if (symbolFilter.trim()) {
      const q = symbolFilter.trim().toUpperCase();
      list = list.filter((m) => m.symbol.includes(q));
    }

    const trusted = list.filter((m) => m.totalOccurrences >= minOccurrences);
    const lowSample = list.filter((m) => m.totalOccurrences < minOccurrences);

    return {
      trustedMatches: trusted,
      lowSampleMatches: lowSample,
      totalFilteredCount: list.length,
    };
  }, [scanResult, symbolFilter, minOccurrences]);

  const progressPercent = scanProgress && scanProgress.totalCompanies > 0
    ? Math.min(100, Math.round((scanProgress.scannedCount / scanProgress.totalCompanies) * 100))
    : 0;

  return (
    <div
      id="configured-market-scanner-panel"
      className="bg-white border border-neutral-200 rounded-xl overflow-hidden shadow-xs mt-6"
    >
      {/* Header Section */}
      <div className="p-4 sm:p-5 border-b border-neutral-200 bg-neutral-50/60 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-md bg-neutral-900 text-white">
              <Layers className="w-4 h-4" />
            </span>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-neutral-900 flex items-center gap-2">
                <span>Market-Wide Setup Ranking</span>
                <span
                  className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
                    isCombined
                      ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                      : 'bg-blue-50 border-blue-200 text-blue-700'
                  }`}
                >
                  {isCombined ? 'Combined Setup (A AND B)' : 'Single Setup'}
                </span>
              </h3>
              <p className="text-xs text-neutral-500 mt-0.5">
                Scans every symbol with historical data for recent triggers (last 5 sessions) and ranks by real historical win rate.
              </p>
            </div>
          </div>

          {/* Active Target Setup Details */}
          <div className="mt-2.5 flex flex-wrap items-center gap-2 text-xs">
            <span className="font-semibold text-neutral-700">Target Setup:</span>
            <span className="font-mono px-2 py-0.5 rounded bg-white border border-neutral-300 text-neutral-800 text-[11px] font-medium max-w-md truncate">
              {setupDescription}
            </span>
            <span className="text-neutral-400">·</span>
            <span className="text-neutral-500 font-mono text-[11px]">
              Forward: {forwardSessions} sessions / {thresholdPercent >= 0 ? '+' : ''}{thresholdPercent}%
            </span>
          </div>
        </div>

        {/* Action Button */}
        <div className="flex items-center gap-2 self-start md:self-auto shrink-0">
          <button
            id="scan-market-setup-btn"
            type="button"
            onClick={handleRunScan}
            disabled={isScanning}
            className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg shadow-xs transition-all cursor-pointer ${
              isScanning
                ? 'bg-neutral-200 text-neutral-500 cursor-not-allowed'
                : 'bg-neutral-900 hover:bg-neutral-800 text-white active:scale-98'
            }`}
          >
            {isScanning ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Scanning Market...</span>
              </>
            ) : scanResult ? (
              <>
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Re-scan Market</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Scan Market</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Progress Bar (Visible while scanning) */}
      {isScanning && scanProgress && (
        <div id="scanner-progress-bar-container" className="p-4 bg-neutral-900 text-white border-b border-neutral-800 animate-in fade-in duration-150">
          <div className="flex items-center justify-between text-xs mb-2">
            <div className="flex items-center gap-2 font-mono">
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-400" />
              <span>
                Evaluating <strong className="text-emerald-400">{scanProgress.currentSymbol}</strong> ({scanProgress.scannedCount} of {scanProgress.totalCompanies})
              </span>
            </div>
            <span className="font-mono font-bold text-neutral-300">{progressPercent}%</span>
          </div>
          <div className="w-full bg-neutral-800 rounded-full h-2 overflow-hidden">
            <div
              className="bg-emerald-500 h-2 rounded-full transition-all duration-150"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      )}

      {/* Error Message */}
      {scanError && (
        <div className="p-4 bg-rose-50 border-b border-rose-200 text-rose-800 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>Market scan failed: {scanError}</span>
        </div>
      )}

      {/* Scan Summary & Controls Bar */}
      {scanResult && (
        <div className="p-4 sm:p-5 border-b border-neutral-200 bg-white space-y-3">
          {/* Stale Config Warning */}
          {isConfigStale && (
            <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                <span>
                  Setup parameters were modified since the last scan ({scannedConfigSnapshot?.setupDescription}). Click <strong>Re-scan Market</strong> to re-rank with updated parameters.
                </span>
              </div>
            </div>
          )}

          {/* Summary Line: Plain statement of accounting */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-neutral-600">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-bold text-neutral-900">
                {scanResult.scannedCount} scanned
              </span>
              <span>·</span>
              <span className="font-medium text-neutral-800">
                {scanResult.symbolsWithAnyOccurrenceCount} have ever shown this setup
              </span>
              <span>·</span>
              <span className="font-bold text-neutral-900">
                {scanResult.matches.length} fired in the last 5 sessions
              </span>
              {(scanResult.insufficientHistoryCount > 0 || scanResult.failedCount > 0) && (
                <span className="text-neutral-400 font-mono text-[11px]">
                  ({scanResult.insufficientHistoryCount} skipped &lt;50s
                  {scanResult.failedCount > 0 ? `, ${scanResult.failedCount} errors` : ''})
                </span>
              )}
            </div>

            <div className="flex items-center gap-3 text-neutral-400 text-[11px] font-mono shrink-0">
              <span>Duration: {(scanResult.durationMs / 1000).toFixed(1)}s</span>
              <span>·</span>
              <span>
                As of {new Date(scanResult.scannedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            </div>
          </div>

          {/* Combined Sparsity Neutral Note */}
          {scanResult.isCombined && (
            <div className="p-2.5 rounded-lg bg-neutral-50 border border-neutral-200 text-neutral-600 text-xs flex items-start gap-2">
              <Info className="w-3.5 h-3.5 text-neutral-500 shrink-0 mt-0.5" />
              <span>
                Combined conditions narrow results sharply — this is expected, not an error. Both Condition A and Condition B must align on the exact same session.
              </span>
            </div>
          )}

          {/* Controls: Search & Min Occurrences Filter */}
          <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-neutral-100">
            <div className="flex items-center gap-2">
              <label htmlFor="min-occurrences-input" className="text-xs font-medium text-neutral-700 flex items-center gap-1">
                <Filter className="w-3.5 h-3.5 text-neutral-400" />
                <span>Min Occurrences Filter:</span>
              </label>
              <input
                id="min-occurrences-input"
                type="number"
                min={1}
                max={100}
                value={minOccurrences}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  setMinOccurrences(isNaN(val) || val < 1 ? 1 : val);
                }}
                className="w-16 px-2 py-1 text-xs font-mono font-bold text-neutral-900 border border-neutral-300 rounded focus:ring-1 focus:ring-neutral-900 focus:outline-none"
              />
              <span className="text-[11px] text-neutral-400">
                (symbols below this threshold are placed below the divider)
              </span>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Filter symbols..."
                value={symbolFilter}
                onChange={(e) => setSymbolFilter(e.target.value)}
                className="px-2.5 py-1 text-xs font-mono text-neutral-900 border border-neutral-300 rounded focus:ring-1 focus:ring-neutral-900 focus:outline-none placeholder:text-neutral-400 w-36"
              />
            </div>
          </div>
        </div>
      )}

      {/* Scan Results Table / Empty State */}
      {scanResult ? (
        scanResult.matches.length === 0 ? (
          <div className="p-8 text-center bg-white space-y-2">
            <div className="inline-flex p-3 rounded-full bg-neutral-100 text-neutral-500 mb-1">
              <Clock className="w-5 h-5" />
            </div>
            <h4 className="text-sm font-semibold text-neutral-900">
              No recent triggers found in the last 5 sessions
            </h4>
            <p className="text-xs text-neutral-500 max-w-md mx-auto">
              {scanResult.symbolsWithAnyOccurrenceCount > 0
                ? `${scanResult.symbolsWithAnyOccurrenceCount} symbol(s) have satisfied this setup in older history, but none fired in the last 5 sessions.`
                : scanResult.isCombined
                ? 'No symbols in NEPSE have ever triggered both conditions simultaneously on the same session.'
                : 'No symbols in NEPSE met the criteria for this setup in recent data.'}
            </p>
            {scanResult.isCombined && (
              <p className="text-[11px] text-neutral-400 font-mono">
                Combined conditions narrow results sharply — this is expected, not an error.
              </p>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-neutral-100/70 border-b border-neutral-200 text-[11px] uppercase tracking-wider font-semibold text-neutral-600">
                  <th className="py-2.5 px-4">Symbol</th>
                  <th className="py-2.5 px-3">Signal Date</th>
                  <th className="py-2.5 px-3">Recency</th>
                  <th className="py-2.5 px-3">
                    Hit Rate <span className="font-normal text-neutral-400">(Success of Total)</span>
                  </th>
                  <th className="py-2.5 px-3">Avg Forward Return</th>
                  <th className="py-2.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 font-mono">
                {/* Trusted Matches (Occurrences >= minOccurrences) */}
                {trustedMatches.map((m) => {
                  const isLowSample = m.totalOccurrences < 10;
                  return (
                    <tr
                      key={m.symbol}
                      onClick={() => onSelectSymbolAndNavigate?.(m.symbol)}
                      className="hover:bg-neutral-50/80 cursor-pointer transition-colors group"
                    >
                      <td className="py-2.5 px-4 font-bold text-neutral-900">
                        <div className="flex items-center gap-1.5">
                          <span>{m.symbol}</span>
                          {isLowSample && (
                            <span
                              className="text-[10px] px-1.5 py-0.2 bg-amber-50 text-amber-700 border border-amber-200 rounded font-sans font-medium"
                              title="Low sample count (<10 evaluated occurrences)"
                            >
                              &lt;10 samples
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-neutral-600">{m.signalDate}</td>
                      <td className="py-2.5 px-3 text-neutral-500 font-sans">
                        {m.sessionsAgo === 0 ? (
                          <span className="font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded text-[11px]">
                            Latest session
                          </span>
                        ) : (
                          `${m.sessionsAgo} session${m.sessionsAgo === 1 ? '' : 's'} ago`
                        )}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-neutral-900">
                            {m.successCount} of {m.totalOccurrences}
                          </span>
                          <span className="text-neutral-500">
                            ({m.hitRate !== null ? `${m.hitRate.toFixed(1)}%` : '—'})
                          </span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3">
                        {m.avgForwardReturn !== null ? (
                          <span
                            className={`font-bold ${
                              m.avgForwardReturn >= 0 ? 'text-emerald-700' : 'text-rose-700'
                            }`}
                          >
                            {m.avgForwardReturn >= 0 ? '+' : ''}
                            {m.avgForwardReturn.toFixed(1)}%
                          </span>
                        ) : (
                          <span className="text-neutral-400">—</span>
                        )}
                      </td>
                      <td className="py-2.5 px-4 text-right font-sans">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectSymbolAndNavigate?.(m.symbol);
                          }}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-neutral-700 hover:text-neutral-900 group-hover:underline"
                        >
                          <span>Chart</span>
                          <ArrowRight className="w-3 h-3 transition-transform group-hover:translate-x-0.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}

                {/* Visible Divider for Low Sample Occurrences (< minOccurrences) */}
                {lowSampleMatches.length > 0 && (
                  <>
                    <tr className="bg-amber-50/60 border-y border-amber-200 text-amber-900">
                      <td colSpan={6} className="py-2 px-4 font-sans text-xs">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 font-semibold text-amber-800">
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                            <span>
                              Low Historical Sample Size (&lt; {minOccurrences} occurrences) — Caution: Win rate has low statistical confidence
                            </span>
                          </div>
                          <span className="font-mono text-[11px] text-amber-700">
                            {lowSampleMatches.length} symbol{lowSampleMatches.length === 1 ? '' : 's'}
                          </span>
                        </div>
                      </td>
                    </tr>

                    {/* Low Sample Rows */}
                    {lowSampleMatches.map((m) => (
                      <tr
                        key={m.symbol}
                        onClick={() => onSelectSymbolAndNavigate?.(m.symbol)}
                        className="hover:bg-amber-50/40 cursor-pointer transition-colors group text-neutral-600 bg-neutral-50/30"
                      >
                        <td className="py-2.5 px-4 font-bold text-neutral-800">
                          <div className="flex items-center gap-1.5">
                            <span>{m.symbol}</span>
                            <span
                              className="text-[10px] px-1.5 py-0.2 bg-amber-50 text-amber-700 border border-amber-200 rounded font-sans font-medium"
                              title="Low sample count"
                            >
                              &lt;{minOccurrences} samples
                            </span>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-neutral-600">{m.signalDate}</td>
                        <td className="py-2.5 px-3 text-neutral-500 font-sans">
                          {m.sessionsAgo === 0 ? (
                            <span className="font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded text-[11px]">
                              Latest session
                            </span>
                          ) : (
                            `${m.sessionsAgo} session${m.sessionsAgo === 1 ? '' : 's'} ago`
                          )}
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-neutral-800">
                              {m.successCount} of {m.totalOccurrences}
                            </span>
                            <span className="text-neutral-500">
                              ({m.hitRate !== null ? `${m.hitRate.toFixed(1)}%` : '—'})
                            </span>
                          </div>
                        </td>
                        <td className="py-2.5 px-3">
                          {m.avgForwardReturn !== null ? (
                            <span
                              className={`font-medium ${
                                m.avgForwardReturn >= 0 ? 'text-emerald-700' : 'text-rose-700'
                              }`}
                            >
                              {m.avgForwardReturn >= 0 ? '+' : ''}
                              {m.avgForwardReturn.toFixed(1)}%
                            </span>
                          ) : (
                            <span className="text-neutral-400">—</span>
                          )}
                        </td>
                        <td className="py-2.5 px-4 text-right font-sans">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectSymbolAndNavigate?.(m.symbol);
                            }}
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-neutral-700 hover:text-neutral-900 group-hover:underline"
                          >
                            <span>Chart</span>
                            <ArrowRight className="w-3 h-3 transition-transform group-hover:translate-x-0.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </>
                )}
              </tbody>
            </table>
          </div>
        )
      ) : (
        /* Pre-scan Empty State */
        <div className="p-8 text-center bg-white">
          <div className="inline-flex p-3 rounded-full bg-neutral-100 text-neutral-500 mb-2">
            <Layers className="w-5 h-5" />
          </div>
          <h4 className="text-sm font-semibold text-neutral-900">
            Market scan not yet run for this setup
          </h4>
          <p className="text-xs text-neutral-500 max-w-md mx-auto mt-1">
            Click <strong>Scan Market</strong> above to evaluate every company listed on NEPSE against the {isCombined ? 'combined' : 'configured'} setup and rank symbols with recent triggers by their verified historical hit rate.
          </p>
        </div>
      )}
    </div>
  );
};
