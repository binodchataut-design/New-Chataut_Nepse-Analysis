import React, { useState, useMemo } from 'react';
import {
  MarketScanResult,
  MarketScanProgress,
  ScannedSetupMatch,
  SetupType,
} from '../types';
import {
  Sparkles,
  RefreshCw,
  TrendingUp,
  Activity,
  AlertTriangle,
  ArrowRight,
  Filter,
  CheckCircle2,
  Clock,
  Layers,
  Info,
} from 'lucide-react';

interface MarketScannerSectionProps {
  scanResult: MarketScanResult | null;
  isScanning: boolean;
  scanProgress: MarketScanProgress | null;
  onRescan: () => void;
  onSelectSymbolAndNavigate: (symbol: string) => void;
}

export const MarketScannerSection: React.FC<MarketScannerSectionProps> = ({
  scanResult,
  isScanning,
  scanProgress,
  onRescan,
  onSelectSymbolAndNavigate,
}) => {
  // Client-side interactive filters (no re-scan needed)
  const [minHitRate, setMinHitRate] = useState<number>(0);
  const [setupFilter, setSetupFilter] = useState<'ALL' | SetupType>('ALL');

  // Filter already-scanned results
  const filteredMatches = useMemo<ScannedSetupMatch[]>(() => {
    if (!scanResult?.matches) return [];

    return scanResult.matches.filter((m) => {
      // Filter by setup type
      if (setupFilter !== 'ALL' && m.setupName !== setupFilter) {
        return false;
      }

      // Filter by minimum hit rate
      // If minHitRate is 0, include all (including un-scored/too-recent where hitRate is null)
      if (minHitRate > 0) {
        if (m.hitRate === null || m.hitRate < minHitRate) {
          return false;
        }
      }

      return true;
    });
  }, [scanResult, minHitRate, setupFilter]);

  const progressPercent = scanProgress?.totalCompanies
    ? Math.min(100, Math.round((scanProgress.scannedCount / scanProgress.totalCompanies) * 100))
    : 0;

  return (
    <div id="market-scanner-section" className="bg-white border border-neutral-200 rounded-xl p-5 shadow-xs space-y-5">
      {/* Header & Controls Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-neutral-100">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-md bg-neutral-900 text-white">
              <Sparkles className="w-4 h-4" />
            </span>
            <h3 className="text-base font-bold text-neutral-900">
              Market-Wide Setup Scanner
            </h3>
          </div>
          <p className="text-xs text-neutral-500 mt-1 max-w-2xl">
            Detects all NEPSE securities where <strong>SMA20/50 Bullish Cross</strong> or{' '}
            <strong>RSI Oversold Recovery</strong> fired within the last 5 trading sessions, paired with
            each stock's individual historical hit rate (evaluated on forward close vs signal close, N=10d, 2%).
          </p>
        </div>

        {/* Rescan Button & Staleness Timestamp */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 shrink-0">
          {scanResult?.scannedAt && (
            <div className="flex items-center gap-1.5 text-[11px] font-mono text-neutral-500 bg-neutral-50 px-2.5 py-1 rounded-md border border-neutral-200">
              <Clock className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
              <span>
                Last scanned at{' '}
                <strong className="text-neutral-800">
                  {new Date(scanResult.scannedAt).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  })}
                </strong>
              </span>
            </div>
          )}

          <button
            type="button"
            id="rescan-market-btn"
            onClick={onRescan}
            disabled={isScanning}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-neutral-800 bg-white hover:bg-neutral-50 border border-neutral-300 rounded-lg shadow-2xs transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
            <span>{isScanning ? 'Scanning...' : 'Rescan Market'}</span>
          </button>
        </div>
      </div>

      {/* Live Scanning Progress State */}
      {isScanning && (
        <div className="p-4 rounded-xl bg-neutral-50 border border-neutral-200 space-y-3">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 font-medium text-neutral-800">
              <div className="w-3.5 h-3.5 border-2 border-neutral-900 border-t-transparent rounded-full animate-spin"></div>
              <span>
                Scanning{' '}
                <strong className="font-mono">{scanProgress?.scannedCount || 0}</strong> of{' '}
                <strong className="font-mono">{scanProgress?.totalCompanies || 437}</strong> companies...
              </span>
            </div>
            {scanProgress?.currentSymbol && (
              <span className="font-mono text-[11px] bg-neutral-200/80 px-2 py-0.5 rounded text-neutral-700">
                Current: {scanProgress.currentSymbol}
              </span>
            )}
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-neutral-200 h-2 rounded-full overflow-hidden">
            <div
              className="bg-neutral-900 h-2 rounded-full transition-all duration-150"
              style={{ width: `${progressPercent}%` }}
            ></div>
          </div>
          <div className="text-[11px] text-neutral-500 flex items-center justify-between">
            <span>Executing concurrency pool (~8 workers)</span>
            <span className="font-mono">{progressPercent}% complete</span>
          </div>
        </div>
      )}

      {/* Honesty & Coverage Banner (When scan completed) */}
      {scanResult && !isScanning && (
        <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-lg bg-neutral-50 border border-neutral-200 text-xs text-neutral-600">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="font-semibold text-neutral-900">
              Scan Summary:
            </span>
            <span>
              <strong className="font-mono text-neutral-900">{scanResult.totalCompanies}</strong> companies
            </span>
            <span className="text-neutral-300">|</span>
            <span className="text-[var(--success)] font-medium">
              <strong className="font-mono">{scanResult.scannedCount}</strong> scanned successfully
            </span>
            <span className="text-neutral-300">|</span>
            <span className={scanResult.failedCount > 0 ? 'text-[var(--danger)] font-medium' : 'text-neutral-600'}>
              <strong className="font-mono">{scanResult.failedCount}</strong> failed to load
            </span>
            <span className="text-neutral-300">|</span>
            <span className="text-neutral-500">
              <strong className="font-mono">{scanResult.insufficientHistoryCount}</strong> skipped (insufficient history &lt; 50 sessions)
            </span>
          </div>

          <div className="text-[11px] font-mono text-neutral-500">
            Duration: {(scanResult.durationMs / 1000).toFixed(1)}s
          </div>
        </div>
      )}

      {/* Filter Toolbar & Results */}
      {scanResult && !isScanning && (
        <div className="space-y-4">
          {/* Interactive Filters Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 p-3 rounded-lg bg-neutral-50/70 border border-neutral-200 text-xs">
            <div className="flex flex-wrap items-center gap-4">
              {/* Minimum Hit Rate Input */}
              <div className="flex items-center gap-2">
                <label htmlFor="min-hit-rate-input" className="font-semibold text-neutral-700 whitespace-nowrap">
                  Minimum Hit Rate:
                </label>
                <div className="relative inline-flex items-center">
                  <input
                    id="min-hit-rate-input"
                    type="number"
                    min="0"
                    max="100"
                    step="5"
                    value={minHitRate}
                    onChange={(e) => {
                      const val = Math.max(0, Math.min(100, Number(e.target.value) || 0));
                      setMinHitRate(val);
                    }}
                    className="w-20 px-2 py-1 text-xs font-mono font-bold text-neutral-900 bg-white border border-neutral-300 rounded-md focus:outline-hidden focus:ring-1 focus:ring-neutral-900"
                  />
                  <span className="ml-1 font-mono text-neutral-500">%</span>
                </div>
              </div>

              {/* Setup Type Filter */}
              <div className="flex items-center gap-2">
                <span className="font-semibold text-neutral-700">Setup:</span>
                <div className="inline-flex rounded-md border border-neutral-300 p-0.5 bg-white text-xs">
                  <button
                    type="button"
                    onClick={() => setSetupFilter('ALL')}
                    className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                      setupFilter === 'ALL'
                        ? 'bg-neutral-900 text-white font-bold'
                        : 'text-neutral-600 hover:text-neutral-900'
                    }`}
                  >
                    All Setups
                  </button>
                  <button
                    type="button"
                    onClick={() => setSetupFilter('SMA20/50 Bullish Cross')}
                    className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                      setupFilter === 'SMA20/50 Bullish Cross'
                        ? 'bg-neutral-900 text-white font-bold'
                        : 'text-neutral-600 hover:text-neutral-900'
                    }`}
                  >
                    SMA Bullish Cross
                  </button>
                  <button
                    type="button"
                    onClick={() => setSetupFilter('RSI Oversold Recovery')}
                    className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                      setupFilter === 'RSI Oversold Recovery'
                        ? 'bg-neutral-900 text-white font-bold'
                        : 'text-neutral-600 hover:text-neutral-900'
                    }`}
                  >
                    RSI Recovery
                  </button>
                </div>
              </div>
            </div>

            {/* Match Counter */}
            <div className="text-xs text-neutral-500">
              Showing <strong className="font-mono text-neutral-900">{filteredMatches.length}</strong> of{' '}
              <strong className="font-mono text-neutral-900">{scanResult.matches.length}</strong> recent occurrences
              {minHitRate > 0 && <span className="ml-1 text-[11px] text-neutral-400">(&ge;{minHitRate}% hit rate)</span>}
            </div>
          </div>

          {/* Results Table */}
          {filteredMatches.length > 0 ? (
            <div className="overflow-x-auto border border-neutral-200 rounded-lg shadow-2xs">
              <table className="w-full text-left text-xs font-sans">
                <thead className="bg-neutral-100/80 text-neutral-600 text-[10px] uppercase font-bold tracking-wider border-b border-neutral-200">
                  <tr>
                    <th className="py-2.5 px-3">Symbol</th>
                    <th className="py-2.5 px-3">Setup Name</th>
                    <th className="py-2.5 px-3">Signal Date</th>
                    <th className="py-2.5 px-3">Sessions Ago</th>
                    <th className="py-2.5 px-3">Historical Hit Rate (X of Y)</th>
                    <th className="py-2.5 px-3 text-right">Avg Forward Return</th>
                    <th className="py-2.5 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {filteredMatches.map((match, idx) => {
                    const isLowSample = match.totalOccurrences > 0 && match.totalOccurrences < 10;
                    const isZeroSample = match.totalOccurrences === 0;

                    return (
                      <tr
                        key={`${match.symbol}-${match.setupName}-${idx}`}
                        onClick={() => onSelectSymbolAndNavigate(match.symbol)}
                        className="hover:bg-neutral-50 transition-colors cursor-pointer group"
                      >
                        {/* Symbol */}
                        <td className="py-2.5 px-3 font-mono font-bold text-neutral-900 group-hover:text-blue-600 transition-colors">
                          {match.symbol}
                        </td>

                        {/* Setup Name */}
                        <td className="py-2.5 px-3">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium ${
                              match.setupName === 'SMA20/50 Bullish Cross'
                                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                : 'bg-purple-50 text-purple-700 border border-purple-200'
                            }`}
                          >
                            {match.setupName === 'SMA20/50 Bullish Cross' ? (
                              <TrendingUp className="w-3 h-3 text-blue-600 shrink-0" />
                            ) : (
                              <Activity className="w-3 h-3 text-purple-600 shrink-0" />
                            )}
                            <span>{match.setupName}</span>
                          </span>
                        </td>

                        {/* Signal Date */}
                        <td className="py-2.5 px-3 font-mono text-neutral-800">
                          {match.signalDate}
                        </td>

                        {/* Sessions Ago */}
                        <td className="py-2.5 px-3">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded font-mono text-[11px] font-medium ${
                              match.sessionsAgo === 0
                                ? 'bg-[var(--success)]/10 text-[var(--success)] border border-[var(--success)]/20'
                                : match.sessionsAgo <= 2
                                ? 'bg-neutral-100 text-neutral-800'
                                : 'bg-neutral-50 text-neutral-600'
                            }`}
                          >
                            {match.sessionsAgo === 0 ? '0 sessions ago (Latest)' : `${match.sessionsAgo} sessions ago`}
                          </span>
                        </td>

                        {/* Historical Hit Rate (Never bare percentage) */}
                        <td className="py-2.5 px-3">
                          {isZeroSample ? (
                            <span
                              className="inline-flex items-center gap-1 text-[11px] text-neutral-400 font-mono"
                              title="Occurred within the last 10 sessions, so forward outcome cannot yet be evaluated"
                            >
                              <span>— (0 of 0)</span>
                              <span className="text-[10px] italic text-neutral-400">(too recent)</span>
                            </span>
                          ) : isLowSample ? (
                            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-amber-50 border border-amber-200 text-amber-900 text-[11px] font-mono">
                              <AlertTriangle className="w-3 h-3 text-amber-600 shrink-0" />
                              <span className="font-bold">{match.hitRate?.toFixed(1)}%</span>
                              <span className="text-amber-700">
                                ({match.successCount} of {match.totalOccurrences})
                              </span>
                              <span className="text-[9px] uppercase font-bold tracking-wider bg-amber-200/70 text-amber-800 px-1 py-0.2 rounded">
                                Low N
                              </span>
                            </div>
                          ) : (
                            <div className="inline-flex items-center gap-1.5 font-mono text-[11px]">
                              <span className="font-bold text-neutral-900">
                                {match.hitRate?.toFixed(1)}%
                              </span>
                              <span className="text-neutral-500">
                                ({match.successCount} of {match.totalOccurrences})
                              </span>
                            </div>
                          )}
                        </td>

                        {/* Avg Forward Return */}
                        <td className="py-2.5 px-3 text-right font-mono font-semibold">
                          {match.avgForwardReturn !== null ? (
                            <span
                              className={
                                match.avgForwardReturn >= 0
                                  ? 'text-[var(--success)]'
                                  : 'text-[var(--danger)]'
                              }
                            >
                              {match.avgForwardReturn >= 0 ? '+' : ''}
                              {match.avgForwardReturn.toFixed(2)}%
                            </span>
                          ) : (
                            <span className="text-neutral-400">—</span>
                          )}
                        </td>

                        {/* Action: Link to Chart */}
                        <td className="py-2.5 px-3 text-right">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectSymbolAndNavigate(match.symbol);
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-neutral-700 hover:text-neutral-900 bg-neutral-100 hover:bg-neutral-200 rounded transition-colors"
                          >
                            <span>Inspect</span>
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-10 text-center rounded-lg border border-neutral-200 bg-neutral-50/60 p-6 space-y-2">
              <Info className="w-6 h-6 text-neutral-400 mx-auto" />
              {scanResult.matches.length === 0 ? (
                <div>
                  <h4 className="text-sm font-semibold text-neutral-800">
                    No setups detected in the last 5 sessions
                  </h4>
                  <p className="text-xs text-neutral-500 max-w-md mx-auto mt-1">
                    Zero companies had an SMA20/50 Bullish Cross or RSI Oversold Recovery fire in their last 5 sessions.
                    This is a legitimate and informative market outcome indicating low crossover momentum across current prices.
                  </p>
                </div>
              ) : (
                <div>
                  <h4 className="text-sm font-semibold text-neutral-800">
                    No results match your active filters
                  </h4>
                  <p className="text-xs text-neutral-500 max-w-md mx-auto mt-1">
                    No symbols met the minimum hit rate of <strong>{minHitRate}%</strong>. Lower the threshold or select All Setups to see available matches.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setMinHitRate(0);
                      setSetupFilter('ALL');
                    }}
                    className="mt-3 inline-flex items-center gap-1 px-3 py-1 text-xs font-medium text-neutral-800 bg-white border border-neutral-300 rounded shadow-2xs hover:bg-neutral-50"
                  >
                    Reset Filters
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Initial state before first scan */}
      {!scanResult && !isScanning && (
        <div className="py-8 text-center text-xs text-neutral-400">
          <div className="w-5 h-5 border-2 border-neutral-900 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
          Preparing market-wide setup scanner...
        </div>
      )}
    </div>
  );
};
