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
  MarketScanResult,
  MarketScanProgress,
} from './types';
import { scanMarketSetups } from './lib/marketScanner';
import { computeLiquidityMetrics, getMarketTradingDates } from './lib/liquidityService';
import { Dashboard } from './components/Dashboard';
import { SymbolPicker } from './components/SymbolPicker';
import { PriceChart } from './components/PriceChart';
import { LiquidityPanel } from './components/LiquidityPanel';
import { ProbabilityScoring } from './components/ProbabilityScoring';
import { BacktestLab } from './components/BacktestLab';
import { TradingJournal } from './components/TradingJournal';
import { SchemaInspector } from './components/SchemaInspector';
import { AppSidebar, SIDEBAR_NAV_ITEMS } from './components/AppSidebar';
import { useThemeMode } from './components/useThemeMode';
import {
  Menu,
  AlertTriangle,
  RefreshCw,
  Clock,
} from 'lucide-react';

export default function App() {
  const configStatus = useMemo(() => getSupabaseConfigStatus(), []);

  // Plain Tab Navigation State (default is 'dashboard')
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');

  // Theme & Sidebar Navigation State (Phase 18)
  const { theme, hasOverride, toggleTheme, resetToSystem } = useThemeMode();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState<boolean>(false);

  const currentNav = useMemo(
    () => SIDEBAR_NAV_ITEMS.find((item) => item.id === activeTab) || SIDEBAR_NAV_ITEMS[0],
    [activeTab]
  );

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

  // Market Scanner State (Phase 6)
  const [scanResult, setScanResult] = useState<MarketScanResult | null>(null);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [scanProgress, setScanProgress] = useState<MarketScanProgress | null>(null);

  // Market Trading Dates for Liquidity calculations (Phase 13)
  const [marketTradingDates, setMarketTradingDates] = useState<string[]>([]);

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

    // Fetch market trading dates for liquidity days-since-last-trade computation
    getMarketTradingDates()
      .then((dates) => setMarketTradingDates(dates))
      .catch((err) => console.warn('Failed to load market trading dates:', err));

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

  // Phase 6: Market Scanner execution (concurrency 8-10, progress reporting)
  const runMarketScan = useCallback(async () => {
    if (!configStatus.isConfigured || isScanning) return;
    setIsScanning(true);
    try {
      const result = await scanMarketSetups({
        concurrency: 8,
        onProgress: (progress) => {
          setScanProgress(progress);
        },
      });
      setScanResult(result);
    } catch (err) {
      console.error('Market scan failed:', err);
    } finally {
      setIsScanning(false);
    }
  }, [configStatus.isConfigured, isScanning]);

  useEffect(() => {
    if (configStatus.isConfigured) {
      initializeData();
      loadMarketOverviewData();
    }
  }, [configStatus.isConfigured, initializeData, loadMarketOverviewData]);

  // Automatically run scan on first load when Dashboard tab is open, cached in state
  useEffect(() => {
    if (configStatus.isConfigured && activeTab === 'dashboard' && !scanResult && !isScanning) {
      runMarketScan();
    }
  }, [configStatus.isConfigured, activeTab, scanResult, isScanning, runMarketScan]);

  // Quick navigation handler from scanner row to Chart tab
  const handleSelectSymbolAndNavigate = useCallback((symbol: string) => {
    setSelectedSymbol(symbol);
    setActiveTab('chart');
  }, []);

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

  // Phase 13: Liquidity Metrics computed for the currently selected symbol
  const liquidityMetrics = useMemo(() => {
    if (!selectedSymbol || !priceHistory || priceHistory.length === 0) return null;
    return computeLiquidityMetrics(selectedSymbol, priceHistory, marketTradingDates);
  }, [selectedSymbol, priceHistory, marketTradingDates]);

  return (
    <div className="flex min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] font-sans antialiased">
      {/* Left Sidebar Navigation (Phase 18) */}
      <AppSidebar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed((prev) => !prev)}
        isMobileOpen={isMobileNavOpen}
        onCloseMobile={() => setIsMobileNavOpen(false)}
        theme={theme}
        hasThemeOverride={hasOverride}
        onToggleTheme={toggleTheme}
        onResetThemeToSystem={resetToSystem}
        isLiveConfigured={configStatus.isConfigured}
      />

      {/* Main Workspace Column */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
        {/* Top Header Bar */}
        <header className="bg-[var(--bg-secondary)] border-b border-[var(--border)] sticky top-0 z-20 shadow-2xs">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              {/* Mobile Hamburger Drawer Trigger */}
              <button
                type="button"
                id="mobile-sidebar-toggle"
                onClick={() => setIsMobileNavOpen(true)}
                className="md:hidden p-2 -ml-2 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors cursor-pointer"
                aria-label="Open sidebar navigation"
              >
                <Menu className="w-5 h-5" />
              </button>

              <div>
                <h1 className="text-base sm:text-lg font-bold tracking-tight text-[var(--text-primary)] leading-tight">
                  {currentNav.label}
                </h1>
                <p className="text-[11px] text-[var(--text-muted)] hidden sm:block">
                  {currentNav.description}
                </p>
              </div>
            </div>

            {/* Supabase Connection State Badge */}
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

        {/* Main View Container */}
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 space-y-5">
          {/* Unconfigured Honest State */}
          {!configStatus.isConfigured && (
            <section
              id="not-connected-banner"
              className="p-6 bg-[var(--bg-secondary)] border border-amber-200 rounded-xl shadow-xs space-y-4"
            >
              <div className="flex items-start gap-3">
                <div className="p-2 bg-amber-100 rounded-lg text-amber-800 shrink-0">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div className="space-y-1.5">
                  <h2 className="text-base font-bold text-[var(--text-primary)]">
                    Supabase Credentials Required
                  </h2>
                  <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                    This application requires direct connection to your existing Supabase project containing NEPSE historical data.
                    No fake mock data is provided.
                  </p>
                  <p className="text-xs font-mono text-rose-700 bg-rose-50 p-2.5 rounded-md border border-rose-200">
                    {configStatus.error}
                  </p>
                </div>
              </div>

              <div className="p-4 bg-[var(--bg-tertiary)] rounded-lg border border-[var(--border)] text-xs text-[var(--text-secondary)] space-y-2">
                <div className="font-semibold text-[var(--text-primary)]">How to connect:</div>
                <ol className="list-decimal list-inside space-y-1 text-[var(--text-muted)]">
                  <li>Open Settings &gt; Secrets in Google AI Studio.</li>
                  <li>Add <code className="bg-[var(--border)] px-1 py-0.5 rounded font-mono text-[var(--text-primary)]">VITE_SUPABASE_URL</code> with your project URL (e.g. <code className="text-[var(--text-muted)]">https://xyz.supabase.co</code>).</li>
                  <li>Add <code className="bg-[var(--border)] px-1 py-0.5 rounded font-mono text-[var(--text-primary)]">VITE_SUPABASE_ANON_KEY</code> with your project anon public key.</li>
                </ol>
              </div>
            </section>
          )}

          {/* Live App Controls (When Configured) */}
          {configStatus.isConfigured && (
            <>

            {/* TAB 1: DASHBOARD (Market Overview & Scanner) */}
            {activeTab === 'dashboard' && (
              <section id="dashboard-tab-content">
                <Dashboard
                  data={marketOverview}
                  isLoading={isLoadingMarketOverview}
                  onRefresh={loadMarketOverviewData}
                  onNavigateToChart={() => setActiveTab('chart')}
                  scanResult={scanResult}
                  isScanning={isScanning}
                  scanProgress={scanProgress}
                  onRescan={runMarketScan}
                  onSelectSymbolAndNavigate={handleSelectSymbolAndNavigate}
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

                {/* Liquidity Profile Panel (Phase 13) */}
                <LiquidityPanel
                  metrics={liquidityMetrics}
                  isLoading={isLoadingPrices}
                />

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
                    onSelectSymbolAndNavigate={handleSelectSymbolAndNavigate}
                  />
                </div>
              </section>
            )}

            {/* TAB 4: BACKTEST (Trade Simulation Lab) */}
            {activeTab === 'backtest' && (
              <section id="backtest-tab-content" className="space-y-5">
                {/* Symbol Selector Bar for Backtest */}
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

                <div id="backtest-simulation-container">
                  <BacktestLab
                    symbol={selectedSymbol}
                    data={priceHistoryWithIndicators}
                    isLoading={isLoadingPrices}
                  />
                </div>
              </section>
            )}

            {/* TAB 5: JOURNAL (Trading Journal) */}
            {activeTab === 'journal' && (
              <section id="journal-tab-content">
                <TradingJournal
                  companies={companies}
                  selectedSymbol={selectedSymbol}
                />
              </section>
            )}

            {/* TAB 6: DATA STATUS (Live Schema Inspector) */}
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
    </div>
  );
}
