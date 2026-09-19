import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { getSupabaseConfigStatus } from './lib/supabaseClient';
import {
  getCompanies,
  getPriceHistory,
  introspectSchema,
  getMarketOverview,
} from './lib/dataService';
import {
  calculateSMA,
  calculateEMA,
  calculateRSI,
  calculateRelativeVolume,
} from './lib/indicators';
import {
  Company,
  PriceRecord,
  PriceRecordWithIndicators,
  IntrospectionReport,
  TimeRange,
  TabType,
  MarketOverviewData,
} from './types';
import { Dashboard } from './components/Dashboard';
import { SymbolPicker } from './components/SymbolPicker';
import { PriceChart } from './components/PriceChart';
import { ProbabilityScoring } from './components/ProbabilityScoring';
import { BacktestPlaceholder } from './components/BacktestPlaceholder';
import { SchemaInspector } from './components/SchemaInspector';
import {
  LayoutDashboard,
  TrendingUp,
  Layers,
  Sliders,
  Database,
  AlertTriangle,
  RefreshCw,
  Clock,
} from 'lucide-react';

export default function App() {
  const configStatus = useMemo(() => getSupabaseConfigStatus(), []);

  // Plain Tab Navigation State (default is 'dashboard')
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');

  // Application State
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedSymbol, setSelectedSymbol] = useState<string>('');
  const [priceHistory, setPriceHistory] = useState<PriceRecord[]>([]);
  const [schemaReport, setSchemaReport] = useState<IntrospectionReport | null>(null);
  const [marketOverview, setMarketOverview] = useState<MarketOverviewData | null>(null);
  const [timeRange, setTimeRange] = useState<TimeRange>('ALL');

  // Loading & Error States
  const [isLoadingCompanies, setIsLoadingCompanies] = useState<boolean>(false);
  const [companiesError, setCompaniesError] = useState<string | null>(null);

  const [isLoadingPrices, setIsLoadingPrices] = useState<boolean>(false);
  const [pricesError, setPricesError] = useState<string | null>(null);

  const [isInspectingSchema, setIsInspectingSchema] = useState<boolean>(false);
  const [isLoadingMarketOverview, setIsLoadingMarketOverview] = useState<boolean>(false);

  // 1. Initial Load: Schema introspection & Companies list
  const initializeData = useCallback(async () => {
    if (!configStatus.isConfigured) return;

    // Introspect live schema
    setIsInspectingSchema(true);
    try {
      const report = await introspectSchema();
      setSchemaReport(report);
    } catch (err: unknown) {
      console.error('Schema introspection failed:', err);
    } finally {
      setIsInspectingSchema(false);
    }

    // Fetch companies
    setIsLoadingCompanies(true);
    setCompaniesError(null);
    try {
      const data = await getCompanies();
      setCompanies(data);
      if (data.length > 0) {
        // Default to first company if none selected yet
        setSelectedSymbol((prev) => (prev ? prev : data[0].symbol));
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setCompaniesError(msg);
    } finally {
      setIsLoadingCompanies(false);
    }
  }, [configStatus.isConfigured]);

  // 2. Fetch Market Overview (cached in state, not re-fetched on tab switches)
  const loadMarketOverviewData = useCallback(async () => {
    if (!configStatus.isConfigured) return;
    setIsLoadingMarketOverview(true);
    try {
      const overview = await getMarketOverview();
      setMarketOverview(overview);
    } catch (err) {
      console.error('Failed to load market overview:', err);
    } finally {
      setIsLoadingMarketOverview(false);
    }
  }, [configStatus.isConfigured]);

  useEffect(() => {
    if (configStatus.isConfigured) {
      initializeData();
      loadMarketOverviewData();
    }
  }, [configStatus.isConfigured, initializeData, loadMarketOverviewData]);

  // 3. Load Price History whenever selectedSymbol changes
  const loadPrices = useCallback(async (symbol: string) => {
    if (!symbol || !configStatus.isConfigured) {
      setPriceHistory([]);
      return;
    }

    setIsLoadingPrices(true);
    setPricesError(null);
    try {
      const history = await getPriceHistory(symbol);
      setPriceHistory(history);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setPricesError(msg);
      setPriceHistory([]);
    } finally {
      setIsLoadingPrices(false);
    }
  }, [configStatus.isConfigured]);

  useEffect(() => {
    if (selectedSymbol) {
      loadPrices(selectedSymbol);
    }
  }, [selectedSymbol, loadPrices]);

  // 4. Calculate technical indicators on the full chronological series first
  const priceHistoryWithIndicators = useMemo<PriceRecordWithIndicators[]>(() => {
    if (!priceHistory || priceHistory.length === 0) return [];

    const sma20 = calculateSMA(priceHistory, 20);
    const sma50 = calculateSMA(priceHistory, 50);
    const ema20 = calculateEMA(priceHistory, 20);
    const rsi14 = calculateRSI(priceHistory, 14);
    const rvol = calculateRelativeVolume(priceHistory, 20);

    return priceHistory.map((item, idx) => ({
      ...item,
      sma20: sma20[idx] ?? null,
      sma50: sma50[idx] ?? null,
      ema20: ema20[idx] ?? null,
      rsi14: rsi14[idx] ?? null,
      relativeVolume: rvol[idx] ?? null,
    }));
  }, [priceHistory]);

  // 5. Filter Price History by selected Time Range while preserving pre-computed indicators
  const filteredPrices = useMemo<PriceRecordWithIndicators[]>(() => {
    if (!priceHistoryWithIndicators.length || timeRange === 'ALL') {
      return priceHistoryWithIndicators;
    }

    const latestDateStr = priceHistoryWithIndicators[priceHistoryWithIndicators.length - 1].date;
    const latestDate = new Date(latestDateStr);

    let monthsBack = 12;
    if (timeRange === '1M') monthsBack = 1;
    else if (timeRange === '3M') monthsBack = 3;
    else if (timeRange === '6M') monthsBack = 6;
    else if (timeRange === '1Y') monthsBack = 12;

    const cutoffDate = new Date(latestDate);
    cutoffDate.setMonth(cutoffDate.getMonth() - monthsBack);
    const cutoffStr = cutoffDate.toISOString().split('T')[0];

    return priceHistoryWithIndicators.filter((item) => item.date >= cutoffStr);
  }, [priceHistoryWithIndicators, timeRange]);

  // Status Line Metrics (Calculated from actual data)
  const statusDetails = useMemo(() => {
    if (!priceHistoryWithIndicators || priceHistoryWithIndicators.length === 0) return null;
    const firstItem = priceHistoryWithIndicators[0];
    const latestItem = priceHistoryWithIndicators[priceHistoryWithIndicators.length - 1];

    let relativeVolumeText = 'insufficient history';
    const hasEnoughRvolHistory = priceHistoryWithIndicators.length >= 20 && latestItem.relativeVolume !== null;
    if (hasEnoughRvolHistory) {
      relativeVolumeText = `${latestItem.relativeVolume!.toFixed(1)}x`;
    }

    return {
      latestDate: latestItem.date,
      firstDate: firstItem.date,
      latestClose: latestItem.close,
      totalSessions: priceHistoryWithIndicators.length,
      filteredSessions: filteredPrices.length,
      relativeVolumeText,
      hasEnoughRvolHistory,
    };
  }, [priceHistoryWithIndicators, filteredPrices]);

  const navTabs = [
    { id: 'dashboard' as TabType, label: 'Dashboard', icon: LayoutDashboard },
    { id: 'chart' as TabType, label: 'Chart', icon: TrendingUp },
    { id: 'lab' as TabType, label: 'Probability Lab', icon: Layers },
    { id: 'backtest' as TabType, label: 'Backtest', icon: Sliders },
    { id: 'data' as TabType, label: 'Data Status', icon: Database },
  ];

  return (
    <div className="min-h-screen bg-neutral-100 text-neutral-900 font-sans antialiased">
      {/* Top Application Bar */}
      <header className="bg-white border-b border-neutral-200 sticky top-0 z-30 shadow-xs">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-neutral-900 text-white flex items-center justify-center font-mono font-bold text-sm shadow-xs">
              NP
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-bold tracking-tight text-neutral-900 leading-tight">
                NEPSE Research
              </h1>
              <p className="text-[11px] text-neutral-500 font-medium">
                Decision-Support &amp; Historical Price Analysis
              </p>
            </div>
          </div>

          {/* Connection State Badge */}
          <div className="flex items-center gap-2">
            {configStatus.isConfigured ? (
              <div
                id="supabase-connection-badge"
                className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-full text-xs font-mono font-medium"
                title={`Connected to ${configStatus.url}`}
              >
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>Supabase Live</span>
              </div>
            ) : (
              <div
                id="supabase-connection-badge"
                className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 border border-amber-300 text-amber-800 rounded-full text-xs font-mono font-medium"
              >
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                <span>Not Connected</span>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-5">
        {/* Unconfigured Honest State */}
        {!configStatus.isConfigured && (
          <section
            id="not-connected-banner"
            className="p-6 bg-white border border-amber-200 rounded-xl shadow-xs space-y-4"
          >
            <div className="flex items-start gap-3">
              <div className="p-2 bg-amber-100 rounded-lg text-amber-800 shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div className="space-y-1.5">
                <h2 className="text-base font-bold text-neutral-900">
                  Supabase Credentials Required
                </h2>
                <p className="text-sm text-neutral-600 leading-relaxed">
                  This application requires direct connection to your existing Supabase project containing NEPSE historical data.
                  No fake mock data is provided.
                </p>
                <p className="text-xs font-mono text-rose-700 bg-rose-50 p-2.5 rounded-md border border-rose-200">
                  {configStatus.error}
                </p>
              </div>
            </div>

            <div className="p-4 bg-neutral-50 rounded-lg border border-neutral-200 text-xs text-neutral-700 space-y-2">
              <div className="font-semibold text-neutral-900">How to connect:</div>
              <ol className="list-decimal list-inside space-y-1 text-neutral-600">
                <li>Open Settings &gt; Secrets in Google AI Studio.</li>
                <li>Add <code className="bg-neutral-200 px-1 py-0.5 rounded font-mono text-neutral-900">VITE_SUPABASE_URL</code> with your project URL (e.g. <code className="text-neutral-500">https://xyz.supabase.co</code>).</li>
                <li>Add <code className="bg-neutral-200 px-1 py-0.5 rounded font-mono text-neutral-900">VITE_SUPABASE_ANON_KEY</code> with your project anon public key.</li>
              </ol>
            </div>
          </section>
        )}

        {/* Live App Controls (When Configured) */}
        {configStatus.isConfigured && (
          <>
            {/* Plain 5-Tab Navigation Bar */}
            <nav id="app-tabs-nav" className="flex items-center gap-1.5 border-b border-neutral-200 pb-0 overflow-x-auto">
              {navTabs.map((tab) => {
                const isActive = activeTab === tab.id;
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    id={`tab-${tab.id}`}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-semibold rounded-t-lg transition-all border-b-2 whitespace-nowrap ${
                      isActive
                        ? 'border-neutral-900 text-neutral-900 bg-white shadow-2xs'
                        : 'border-transparent text-neutral-500 hover:text-neutral-800 hover:bg-neutral-100/70'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${isActive ? 'text-neutral-900' : 'text-neutral-400'}`} />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </nav>

            {/* TAB 1: DASHBOARD (Market Overview) */}
            {activeTab === 'dashboard' && (
              <section id="dashboard-tab-content">
                <Dashboard
                  data={marketOverview}
                  isLoading={isLoadingMarketOverview}
                  onRefresh={loadMarketOverviewData}
                  onNavigateToChart={() => setActiveTab('chart')}
                />
              </section>
            )}

            {/* TAB 2: CHART (Symbol Picker, Chart, Indicators, Status Line) */}
            {activeTab === 'chart' && (
              <section id="chart-tab-content" className="space-y-5">
                {/* Top Toolbar: Symbol Picker & Range Filter */}
                <div className="bg-white p-4 sm:p-5 border border-neutral-200 rounded-xl shadow-xs flex flex-col md:flex-row md:items-end justify-between gap-4">
                  <SymbolPicker
                    companies={companies}
                    selectedSymbol={selectedSymbol}
                    onSelectSymbol={setSelectedSymbol}
                    isLoading={isLoadingCompanies}
                    error={companiesError}
                  />

                  {/* Time Range Selector */}
                  <div className="flex flex-col gap-1.5">
                    <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                      Time Horizon
                    </span>
                    <div className="inline-flex rounded-lg border border-neutral-300 p-0.5 bg-neutral-100 text-xs font-mono font-medium">
                      {(['1M', '3M', '6M', '1Y', 'ALL'] as TimeRange[]).map((r) => {
                        const isSelected = timeRange === r;
                        return (
                          <button
                            key={r}
                            type="button"
                            onClick={() => setTimeRange(r)}
                            className={`px-3 py-1.5 rounded-md transition-colors ${
                              isSelected
                                ? 'bg-white text-neutral-900 font-bold shadow-xs'
                                : 'text-neutral-600 hover:text-neutral-900'
                            }`}
                          >
                            {r}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Status Line (Mandatory Specification) */}
                <div
                  id="data-status-line"
                  className="px-4 py-3 bg-white border border-neutral-200 rounded-xl text-xs flex flex-wrap items-center justify-between gap-3 shadow-xs"
                >
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-neutral-500 shrink-0" />
                    {statusDetails ? (
                      <div className="text-neutral-700 flex flex-wrap items-center gap-y-1">
                        <span className="text-neutral-500">Most recent data for </span>
                        <span className="font-mono font-bold text-neutral-900">{selectedSymbol}</span>:
                        <span className="font-mono font-semibold text-neutral-900 ml-1.5 px-2 py-0.5 rounded-sm bg-neutral-100">
                          {statusDetails.latestDate}
                        </span>
                        <span className="text-neutral-400 mx-1.5">|</span>
                        <span className="text-neutral-600">
                          {statusDetails.totalSessions} total trading sessions recorded ({statusDetails.firstDate} to {statusDetails.latestDate})
                        </span>
                        <span className="text-neutral-400 mx-1.5">|</span>
                        <span className="text-neutral-700">
                          Relative Volume:{' '}
                          <span
                            className={`font-mono font-semibold px-1.5 py-0.5 rounded-sm ${
                              statusDetails.hasEnoughRvolHistory
                                ? 'bg-neutral-100 text-neutral-900'
                                : 'bg-neutral-100 text-neutral-500 italic'
                            }`}
                          >
                            {statusDetails.relativeVolumeText}
                          </span>
                        </span>
                      </div>
                    ) : isLoadingPrices ? (
                      <span className="text-neutral-500 italic">Querying `daily_prices` table...</span>
                    ) : pricesError ? (
                      <span className="text-rose-600 font-medium">Data fetch failed for {selectedSymbol}</span>
                    ) : (
                      <span className="text-neutral-500 italic">No price records available for {selectedSymbol || 'selected symbol'}</span>
                    )}
                  </div>

                  {/* Refresh Price Button */}
                  {selectedSymbol && (
                    <button
                      type="button"
                      id="refresh-prices-button"
                      onClick={() => loadPrices(selectedSymbol)}
                      disabled={isLoadingPrices}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 text-neutral-700 hover:text-neutral-900 bg-neutral-50 hover:bg-neutral-100 border border-neutral-200 rounded-md font-medium transition-colors disabled:opacity-50"
                    >
                      <RefreshCw className={`w-3 h-3 ${isLoadingPrices ? 'animate-spin' : ''}`} />
                      <span>Refresh Data</span>
                    </button>
                  )}
                </div>

                {/* Price Chart */}
                <div id="chart-section">
                  <PriceChart
                    symbol={selectedSymbol}
                    data={filteredPrices}
                    isLoading={isLoadingPrices}
                    error={pricesError}
                  />
                </div>
              </section>
            )}

            {/* TAB 3: PROBABILITY LAB (Setup Cards & Occurrence Tables) */}
            {activeTab === 'lab' && (
              <section id="lab-tab-content" className="space-y-5">
                {/* Symbol Selector Bar for Lab */}
                <div className="bg-white p-4 sm:p-5 border border-neutral-200 rounded-xl shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <SymbolPicker
                    companies={companies}
                    selectedSymbol={selectedSymbol}
                    onSelectSymbol={setSelectedSymbol}
                    isLoading={isLoadingCompanies}
                    error={companiesError}
                  />

                  <div className="text-xs text-neutral-500 flex items-center gap-2">
                    <span className="font-mono bg-neutral-100 px-2.5 py-1 rounded text-neutral-700 font-medium">
                      {priceHistoryWithIndicators.length} sessions loaded for {selectedSymbol}
                    </span>
                  </div>
                </div>

                <div id="probability-scoring-section">
                  <ProbabilityScoring
                    symbol={selectedSymbol}
                    data={priceHistoryWithIndicators}
                    isLoading={isLoadingPrices}
                  />
                </div>
              </section>
            )}

            {/* TAB 4: BACKTEST (Honest Placeholder for Phase 4) */}
            {activeTab === 'backtest' && (
              <section id="backtest-tab-content">
                <BacktestPlaceholder />
              </section>
            )}

            {/* TAB 5: DATA STATUS (Live Schema Inspector) */}
            {activeTab === 'data' && (
              <section id="data-tab-content">
                <SchemaInspector
                  report={schemaReport}
                  isLoading={isInspectingSchema}
                  onRefresh={initializeData}
                />
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}
