import React from 'react';
import {
  MarketOverviewData,
  MarketScanProgress,
  MarketScanResult,
} from '../types';
import { MarketScannerSection } from './MarketScannerSection';
import {
  TrendingUp,
  TrendingDown,
  Activity,
  BarChart3,
  Calendar,
  AlertTriangle,
  RefreshCw,
  Clock,
  Layers,
  PieChart,
  Info,
} from 'lucide-react';

interface DashboardProps {
  data: MarketOverviewData | null;
  isLoading: boolean;
  onRefresh: () => void;
  onNavigateToChart: () => void;
  scanResult: MarketScanResult | null;
  isScanning: boolean;
  scanProgress: MarketScanProgress | null;
  onRescan: () => void;
  onSelectSymbolAndNavigate: (symbol: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  data,
  isLoading,
  onRefresh,
  onNavigateToChart,
  scanResult,
  isScanning,
  scanProgress,
  onRescan,
  onSelectSymbolAndNavigate,
}) => {
  const indexStatus = data?.indexStatus;
  const volumeTurnover = data?.volumeTurnover;
  const sectorStats = data?.sectorStats || [];
  const sectorDate = data?.sectorDate;

  return (
    <div className="space-y-6">
      {/* Top Section / Header with Refresh */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-1 border-b border-neutral-200">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-neutral-900 flex items-center gap-2">
            <span>NEPSE Market Overview</span>
          </h2>
          <p className="text-xs text-neutral-500 mt-0.5">
            Aggregated market indicators, session volume, and sector breadth from live Supabase tables.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {data?.asOfTimestamp && (
            <span className="text-[11px] font-mono text-neutral-400">
              Fetched: {new Date(data.asOfTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          )}
          <button
            type="button"
            onClick={onRefresh}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-neutral-700 bg-white hover:bg-neutral-50 border border-neutral-300 rounded-lg shadow-2xs transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh Overview</span>
          </button>
        </div>
      </div>

      {/* Grid of 3 Core Real Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Section 1: NEPSE Index Status */}
        <div className="bg-white border border-neutral-200 rounded-xl p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-md bg-neutral-900 text-white">
                  <Activity className="w-4 h-4" />
                </span>
                <div>
                  <h3 className="text-sm font-bold text-neutral-900">NEPSE Index Status</h3>
                  <div className="text-[10px] text-neutral-500 font-mono">Source: `market_index` table</div>
                </div>
              </div>
              {indexStatus?.latestDate && (
                <span className="text-[10px] font-mono bg-neutral-100 text-neutral-700 px-2 py-0.5 rounded">
                  {indexStatus.latestDate}
                </span>
              )}
            </div>

            {isLoading && !indexStatus ? (
              <div className="py-8 text-center text-xs text-neutral-400">
                <div className="w-5 h-5 border-2 border-neutral-900 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                Loading market index records...
              </div>
            ) : data?.indexError ? (
              <div className="mt-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs">
                <div className="font-semibold flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                  Failed to load market index
                </div>
                <div className="mt-1 font-mono text-[11px]">{data.indexError}</div>
              </div>
            ) : indexStatus ? (
              <div className="mt-4 space-y-3">
                <div>
                  <div className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider">
                    Closing Value
                  </div>
                  <div className="text-3xl font-bold font-mono text-neutral-900 mt-0.5">
                    {indexStatus.latestClose.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>

                {/* Change Metrics */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div className="p-2.5 rounded-lg bg-neutral-50 border border-neutral-100">
                    <div className="text-[10px] uppercase font-bold text-neutral-400">
                      Points Change
                    </div>
                    <div
                      className={`text-base font-bold font-mono mt-0.5 flex items-center gap-1 ${
                        indexStatus.pointsChange !== null && indexStatus.pointsChange >= 0
                          ? 'text-emerald-700'
                          : 'text-rose-700'
                      }`}
                    >
                      {indexStatus.pointsChange !== null && indexStatus.pointsChange >= 0 ? (
                        <TrendingUp className="w-3.5 h-3.5 shrink-0" />
                      ) : (
                        <TrendingDown className="w-3.5 h-3.5 shrink-0" />
                      )}
                      <span>
                        {indexStatus.pointsChange !== null
                          ? `${indexStatus.pointsChange >= 0 ? '+' : ''}${indexStatus.pointsChange.toFixed(2)}`
                          : '—'}
                      </span>
                    </div>
                    <div className="text-[10px] text-neutral-400 mt-0.5">
                      vs {indexStatus.previousClose?.toFixed(2)} ({indexStatus.previousDate})
                    </div>
                  </div>

                  <div className="p-2.5 rounded-lg bg-neutral-50 border border-neutral-100">
                    <div className="text-[10px] uppercase font-bold text-neutral-400">
                      Percent Change
                    </div>
                    <div
                      className={`text-base font-bold font-mono mt-0.5 ${
                        indexStatus.percentChangeStored !== null && indexStatus.percentChangeStored >= 0
                          ? 'text-emerald-700'
                          : 'text-rose-700'
                      }`}
                    >
                      {indexStatus.percentChangeStored !== null
                        ? `${indexStatus.percentChangeStored >= 0 ? '+' : ''}${indexStatus.percentChangeStored.toFixed(2)}%`
                        : indexStatus.percentChangeCalculated !== null
                        ? `${indexStatus.percentChangeCalculated >= 0 ? '+' : ''}${indexStatus.percentChangeCalculated.toFixed(2)}%`
                        : '—'}
                    </div>
                    <div className="text-[10px] text-neutral-400 mt-0.5">
                      from `change_percent` column
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-6 text-center text-xs text-neutral-500 italic">
                No index records found in database.
              </div>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-neutral-100 text-[11px] text-neutral-500 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
            <span>
              Reflects session date: <strong className="font-mono text-neutral-800">{indexStatus?.latestDate || '—'}</strong>
            </span>
          </div>
        </div>

        {/* Section 2: Market-Wide Turnover & Volume */}
        <div className="bg-white border border-neutral-200 rounded-xl p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-md bg-neutral-900 text-white">
                  <BarChart3 className="w-4 h-4" />
                </span>
                <div>
                  <h3 className="text-sm font-bold text-neutral-900">Turnover &amp; Volume</h3>
                  <div className="text-[10px] text-neutral-500 font-mono">Source: `daily_prices` sum</div>
                </div>
              </div>
              {volumeTurnover?.date && (
                <span className="text-[10px] font-mono bg-neutral-100 text-neutral-700 px-2 py-0.5 rounded">
                  {volumeTurnover.date}
                </span>
              )}
            </div>

            {isLoading && !volumeTurnover ? (
              <div className="py-8 text-center text-xs text-neutral-400">
                <div className="w-5 h-5 border-2 border-neutral-900 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                Summing market volume...
              </div>
            ) : data?.volumeError ? (
              <div className="mt-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs">
                <div className="font-semibold flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                  Failed to load market volume
                </div>
                <div className="mt-1 font-mono text-[11px]">{data.volumeError}</div>
              </div>
            ) : volumeTurnover ? (
              <div className="mt-4 space-y-3">
                {/* Total Traded Volume */}
                <div className="p-3 rounded-lg bg-neutral-50 border border-neutral-100">
                  <div className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider">
                    Total Traded Volume (Latest Recorded Session)
                  </div>
                  <div className="text-2xl font-bold font-mono text-neutral-900 mt-0.5">
                    {volumeTurnover.totalVolume.toLocaleString('en-US')}
                  </div>
                  <div className="text-[11px] text-neutral-500 mt-0.5">
                    shares traded across <strong className="font-semibold text-neutral-800">{volumeTurnover.symbolCount}</strong> active securities
                  </div>
                </div>

                {/* Turnover Honest Metric */}
                <div className="p-3 rounded-lg bg-neutral-50 border border-neutral-100">
                  <div className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider flex items-center justify-between">
                    <span>Total Traded Turnover</span>
                    <span className="text-[10px] font-mono text-neutral-400 font-normal">Schema status</span>
                  </div>
                  <div className="text-sm font-bold font-mono text-neutral-600 mt-1">
                    Not Available in Database
                  </div>
                  <div className="text-[11px] text-neutral-500 mt-1 leading-snug">
                    The <code className="font-mono text-[10px] bg-neutral-200 px-1 py-0.5 rounded text-neutral-800">daily_prices</code> table contains no turnover column, and <code className="font-mono text-[10px] bg-neutral-200 px-1 py-0.5 rounded text-neutral-800">market_index.turnover</code> is NULL across all rows.
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-6 text-center text-xs text-neutral-500 italic">
                No volume records available.
              </div>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-neutral-100 text-[11px] text-neutral-500 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
            <span>
              Session Date: <strong className="font-mono text-neutral-800">{volumeTurnover?.date || '—'}</strong> (historical data)
            </span>
          </div>
        </div>

        {/* Section 3: Sector Overview & Breadth */}
        <div className="bg-white border border-neutral-200 rounded-xl p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-md bg-neutral-900 text-white">
                  <PieChart className="w-4 h-4" />
                </span>
                <div>
                  <h3 className="text-sm font-bold text-neutral-900">Sector Breadth</h3>
                  <div className="text-[10px] text-neutral-500 font-mono">Advancers vs. Decliners</div>
                </div>
              </div>
              {sectorDate && (
                <span className="text-[10px] font-mono bg-neutral-100 text-neutral-700 px-2 py-0.5 rounded">
                  {sectorDate}
                </span>
              )}
            </div>

            {isLoading && sectorStats.length === 0 ? (
              <div className="py-8 text-center text-xs text-neutral-400">
                <div className="w-5 h-5 border-2 border-neutral-900 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                Categorizing sector performance...
              </div>
            ) : data?.sectorError ? (
              <div className="mt-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs">
                <div className="font-semibold flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                  Failed to load sector data
                </div>
                <div className="mt-1 font-mono text-[11px]">{data.sectorError}</div>
              </div>
            ) : sectorStats.length > 0 ? (
              <div className="mt-4 space-y-3">
                <div className="overflow-x-auto border border-neutral-200 rounded-lg">
                  <table className="w-full text-left text-xs font-mono">
                    <thead className="bg-neutral-100 text-neutral-600 text-[10px] uppercase border-b border-neutral-200">
                      <tr>
                        <th className="py-2 px-2.5">Sector</th>
                        <th className="py-2 px-2 text-emerald-700 font-bold">Adv</th>
                        <th className="py-2 px-2 text-rose-700 font-bold">Dec</th>
                        <th className="py-2 px-2 text-neutral-500">Unch</th>
                        <th className="py-2 px-2.5 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {sectorStats.map((sec) => (
                        <tr key={sec.sector} className="hover:bg-neutral-50">
                          <td className="py-2 px-2.5 font-sans font-medium text-neutral-900">{sec.sector}</td>
                          <td className="py-2 px-2 font-bold text-emerald-700">+{sec.advancers}</td>
                          <td className="py-2 px-2 font-bold text-rose-700">-{sec.decliners}</td>
                          <td className="py-2 px-2 text-neutral-500">{sec.unchanged}</td>
                          <td className="py-2 px-2.5 text-right font-bold text-neutral-800">{sec.total}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="p-2.5 rounded-lg bg-neutral-50 border border-neutral-200 text-[11px] text-neutral-600 flex items-start gap-2">
                  <Info className="w-3.5 h-3.5 text-neutral-400 shrink-0 mt-0.5" />
                  <p>
                    <strong>Database Note:</strong> In the current Supabase <code className="font-mono text-[10px]">companies</code> table, all listed companies are tagged under the <code className="font-mono text-[10px]">Others</code> sector. Advancers/decliners reflect <code className="font-mono text-[10px]">per_change</code> on {sectorDate}.
                  </p>
                </div>
              </div>
            ) : (
              <div className="py-6 text-center text-xs text-neutral-500 italic">
                No sector breakdown available.
              </div>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-neutral-100 text-[11px] text-neutral-500 flex items-center justify-between">
            <span>Market Breadth:</span>
            {sectorStats.length > 0 && (
              <span className="font-mono font-bold text-emerald-700">
                {sectorStats.reduce((acc, s) => acc + s.advancers, 0)} Adv / {sectorStats.reduce((acc, s) => acc + s.decliners, 0)} Dec
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Section 4: Market-Wide Setup Scanner */}
      <MarketScannerSection
        scanResult={scanResult}
        isScanning={isScanning}
        scanProgress={scanProgress}
        onRescan={onRescan}
        onSelectSymbolAndNavigate={onSelectSymbolAndNavigate}
      />
    </div>
  );
};
