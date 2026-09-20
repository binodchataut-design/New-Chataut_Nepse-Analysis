import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
  LineChart,
  ReferenceLine,
} from 'recharts';
import {
  PriceRecordWithIndicators,
  SignalFilterConfig,
  DEFAULT_SIGNAL_FILTER_CONFIG,
  CANDLESTICK_PATTERN_LABELS,
} from '../types';
import { calculateSMA, calculateEMA, calculateRSI } from '../lib/indicators';
import { computeSignalsFromConfig } from '../lib/probabilityScoring';
import { SignalFilterPanel } from './SignalFilterPanel';
import { CandlestickHonestyNote } from './CandlestickHonestyNote';
import { TrendingUp, TrendingDown, AlertCircle, Calendar, CandlestickChart } from 'lucide-react';

interface PriceChartProps {
  symbol: string;
  data: PriceRecordWithIndicators[];
  isLoading: boolean;
  error?: string | null;
}

interface ChartRecordWithDynamicIndicators extends PriceRecordWithIndicators {
  fastMA: number | null;
  slowMA: number | null;
  chartRsi: number | null;
  patternMarkerPrice: number | null;
  patternName: string | null;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    payload: ChartRecordWithDynamicIndicators;
  }>;
  showFastMA?: boolean;
  showSlowMA?: boolean;
  fastLabel?: string;
  slowLabel?: string;
  rsiLabel?: string;
}

const CustomPatternMarker: React.FC<{
  cx?: number;
  cy?: number;
  payload?: ChartRecordWithDynamicIndicators;
}> = ({ cx, cy, payload }) => {
  if (cx == null || cy == null || payload?.patternMarkerPrice == null) return null;
  return (
    <g transform={`translate(${cx}, ${cy})`}>
      <circle r={6} fill="#f59e0b" fillOpacity={0.25} stroke="#d97706" strokeWidth={1.5} />
      <circle r={2.5} fill="#d97706" />
    </g>
  );
};

const CustomPriceTooltip: React.FC<CustomTooltipProps> = ({
  active,
  payload,
  showFastMA = true,
  showSlowMA = true,
  fastLabel = 'Fast MA',
  slowLabel = 'Slow MA',
  rsiLabel = 'RSI(14)',
}) => {
  if (!active || !payload || !payload.length) return null;

  const item = payload[0].payload;
  const isUp = item.close >= item.open;

  return (
    <div className="bg-neutral-900 text-white p-3 rounded-lg shadow-xl text-xs font-mono border border-neutral-700 min-w-[210px]">
      <div className="text-neutral-400 font-sans text-[11px] pb-1.5 mb-1.5 border-b border-neutral-800 flex items-center justify-between">
        <span className="flex items-center gap-1">
          <Calendar className="w-3 h-3 text-neutral-400" />
          {item.date}
        </span>
        <span className={`font-semibold ${isUp ? 'text-emerald-400' : 'text-rose-400'}`}>
          {isUp ? '▲' : '▼'} {item.open > 0 ? (((item.close - item.open) / item.open) * 100).toFixed(2) : 0}%
        </span>
      </div>

      <div className="space-y-1">
        <div className="flex justify-between">
          <span className="text-neutral-400">Close:</span>
          <span className="font-bold text-white">NPR {item.close.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-neutral-400">Open:</span>
          <span className="text-neutral-200">NPR {item.open.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-neutral-400">High:</span>
          <span className="text-emerald-300">NPR {item.high.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-neutral-400">Low:</span>
          <span className="text-rose-300">NPR {item.low.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        </div>
        <div className="flex justify-between pt-1 border-t border-neutral-800 text-neutral-400">
          <span>Volume:</span>
          <span className="text-neutral-300">{item.volume.toLocaleString()} shares</span>
        </div>
        {item.relativeVolume !== null && (
          <div className="flex justify-between text-neutral-400">
            <span>Rel Vol:</span>
            <span className="text-neutral-200 font-bold">{item.relativeVolume.toFixed(2)}x</span>
          </div>
        )}

        {/* Indicators Section (If enabled or active) */}
        {(showFastMA || showSlowMA || item.chartRsi !== null) && (
          <div className="pt-1.5 mt-1.5 border-t border-neutral-800 space-y-0.5">
            {showFastMA && (
              <div className="flex justify-between items-center text-blue-300">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-0.5 bg-blue-400 rounded-xs"></span>
                  {fastLabel}:
                </span>
                <span className="font-semibold">
                  {item.fastMA !== null ? `NPR ${item.fastMA.toFixed(2)}` : 'insufficient data'}
                </span>
              </div>
            )}
            {showSlowMA && (
              <div className="flex justify-between items-center text-amber-300">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-0.5 bg-amber-400 rounded-xs"></span>
                  {slowLabel}:
                </span>
                <span className="font-semibold">
                  {item.slowMA !== null ? `NPR ${item.slowMA.toFixed(2)}` : 'insufficient data'}
                </span>
              </div>
            )}
            {item.chartRsi !== null && (
              <div className="flex justify-between items-center text-indigo-300">
                <span>{rsiLabel}:</span>
                <span className="font-semibold">{item.chartRsi.toFixed(2)}</span>
              </div>
            )}
          </div>
        )}

        {item.patternName && (
          <div className="pt-1.5 mt-1.5 border-t border-neutral-800 flex justify-between items-center text-amber-300">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-amber-400"></span>
              Pattern:
            </span>
            <span className="font-bold text-amber-200">{item.patternName}</span>
          </div>
        )}
      </div>
    </div>
  );
};

interface CustomRsiTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: ChartRecordWithDynamicIndicators }>;
  rsiLabel?: string;
  threshold?: number;
  direction?: string;
}

const CustomRsiTooltip: React.FC<CustomRsiTooltipProps> = ({
  active,
  payload,
  rsiLabel = 'RSI(14)',
  threshold = 30,
  direction = 'recovery',
}) => {
  if (!active || !payload || !payload.length) return null;
  const item = payload[0].payload;
  const rsi = item.chartRsi;

  return (
    <div className="bg-neutral-900 text-white p-2.5 rounded-lg shadow-xl text-xs font-mono border border-neutral-700 min-w-[150px]">
      <div className="text-neutral-400 text-[10px] pb-1 border-b border-neutral-800">{item.date}</div>
      <div className="flex items-center justify-between gap-3 mt-1.5">
        <span className="text-neutral-400">{rsiLabel}:</span>
        <span
          className={`font-bold ${
            rsi === null
              ? 'text-neutral-500'
              : rsi >= 70
              ? 'text-rose-400'
              : rsi <= threshold
              ? 'text-emerald-400'
              : 'text-indigo-300'
          }`}
        >
          {rsi !== null ? rsi.toFixed(2) : 'insufficient history'}
        </span>
      </div>
      {rsi !== null && (
        <div className="text-[10px] text-neutral-400 mt-0.5">
          {rsi >= 70
            ? 'Overbought (≥70)'
            : rsi <= threshold
            ? `Oversold (≤${threshold})`
            : 'Neutral'}
        </div>
      )}
    </div>
  );
};

export const PriceChart: React.FC<PriceChartProps> = ({
  symbol,
  data,
  isLoading,
  error,
}) => {
  // Configurable indicator filter state (defaults to SMA 20/50, RSI 14/30)
  const [filterConfig, setFilterConfig] = useState<SignalFilterConfig>(DEFAULT_SIGNAL_FILTER_CONFIG);

  // Overlay visibility toggles
  const [showFastMA, setShowFastMA] = useState<boolean>(true);
  const [showSlowMA, setShowSlowMA] = useState<boolean>(true);
  const [showRSI, setShowRSI] = useState<boolean>(true);
  const [showCandlePattern, setShowCandlePattern] = useState<boolean>(true);

  // Set of session indices where pattern fired (if in candlestick mode)
  const patternSignalSet = useMemo(() => {
    if (filterConfig.mode !== 'candlestick' || !data || data.length === 0) {
      return new Set<number>();
    }
    const { signals } = computeSignalsFromConfig(data, filterConfig);
    return new Set<number>(signals);
  }, [data, filterConfig]);

  // Dynamically compute indicator series based on user filter parameters
  const chartData = useMemo<ChartRecordWithDynamicIndicators[]>(() => {
    if (!data || data.length === 0) return [];

    const fastPeriod = Math.max(1, Math.round(filterConfig.maCross.fastPeriod || 20));
    const slowPeriod = Math.max(1, Math.round(filterConfig.maCross.slowPeriod || 50));
    const rsiPeriod = Math.max(2, Math.round(filterConfig.rsiThreshold.period || 14));

    const fast =
      filterConfig.maCross.fastType === 'EMA'
        ? calculateEMA(data, fastPeriod)
        : calculateSMA(data, fastPeriod);

    const slow =
      filterConfig.maCross.slowType === 'EMA'
        ? calculateEMA(data, slowPeriod)
        : calculateSMA(data, slowPeriod);

    const rsi = calculateRSI(data, rsiPeriod);

    return data.map((d, i) => ({
      ...d,
      fastMA: fast[i] ?? null,
      slowMA: slow[i] ?? null,
      chartRsi: rsi[i] ?? null,
      patternMarkerPrice:
        filterConfig.mode === 'candlestick' && showCandlePattern && patternSignalSet.has(i)
          ? d.close
          : null,
      patternName:
        filterConfig.mode === 'candlestick' && patternSignalSet.has(i)
          ? CANDLESTICK_PATTERN_LABELS[filterConfig.candlestickPattern] || 'Pattern'
          : null,
    }));
  }, [data, filterConfig, showCandlePattern, patternSignalSet]);

  // Compute price change and metrics from real data
  const metrics = useMemo(() => {
    if (!chartData || chartData.length === 0) return null;
    const first = chartData[0];
    const latest = chartData[chartData.length - 1];
    const prev = chartData.length > 1 ? chartData[chartData.length - 2] : first;

    const sessionChange = latest.close - prev.close;
    const sessionChangePct = prev.close > 0 ? (sessionChange / prev.close) * 100 : 0;
    const totalChange = latest.close - first.close;
    const totalChangePct = first.close > 0 ? (totalChange / first.close) * 100 : 0;

    let minPrice = Infinity;
    let maxPrice = -Infinity;
    let totalVolume = 0;

    for (const d of chartData) {
      if (d.low < minPrice && d.low > 0) minPrice = d.low;
      if (d.close < minPrice && d.close > 0) minPrice = d.close;
      if (d.high > maxPrice) maxPrice = d.high;
      if (d.close > maxPrice) maxPrice = d.close;
      totalVolume += (d.volume || 0);

      // Account for indicator values in domain so overlay lines don't get clipped
      if (showFastMA && d.fastMA !== null) {
        if (d.fastMA < minPrice) minPrice = d.fastMA;
        if (d.fastMA > maxPrice) maxPrice = d.fastMA;
      }
      if (showSlowMA && d.slowMA !== null) {
        if (d.slowMA < minPrice) minPrice = d.slowMA;
        if (d.slowMA > maxPrice) maxPrice = d.slowMA;
      }
    }

    return {
      firstDate: first.date,
      latestDate: latest.date,
      latestClose: latest.close,
      latestFastMA: latest.fastMA,
      latestSlowMA: latest.slowMA,
      latestRSI: latest.chartRsi,
      sessionChange,
      sessionChangePct,
      totalChange,
      totalChangePct,
      minPrice: minPrice === Infinity ? 0 : minPrice,
      maxPrice: maxPrice === -Infinity ? 0 : maxPrice,
      totalVolume,
      sessionCount: chartData.length,
      isPositive: sessionChange >= 0,
    };
  }, [chartData, showFastMA, showSlowMA]);

  // Handle loading state
  if (isLoading) {
    return (
      <div className="w-full h-96 bg-white border border-neutral-200 rounded-xl flex flex-col items-center justify-center p-8 text-neutral-500">
        <div className="w-8 h-8 border-2 border-neutral-900 border-t-transparent rounded-full animate-spin mb-3"></div>
        <div className="text-sm font-medium text-neutral-700">Fetching daily prices from Supabase...</div>
        <div className="text-xs text-neutral-400 mt-1">Executing query on `daily_prices` for {symbol}</div>
      </div>
    );
  }

  // Handle error state honestly
  if (error) {
    return (
      <div className="w-full p-8 bg-rose-50 border border-rose-200 rounded-xl text-rose-900 flex flex-col items-center justify-center text-center">
        <AlertCircle className="w-10 h-10 text-rose-600 mb-3" />
        <h3 className="font-semibold text-base">Unable to Load Price Data</h3>
        <p className="text-sm text-rose-700 mt-1 max-w-md font-mono">{error}</p>
        <div className="text-xs text-rose-500 mt-3">
          Check Supabase network connection or ensure the `daily_prices` table has read permissions.
        </div>
      </div>
    );
  }

  // Handle empty state honestly
  if (!symbol) {
    return (
      <div className="w-full h-96 bg-neutral-50 border border-neutral-200 rounded-xl flex flex-col items-center justify-center p-8 text-neutral-500 text-center">
        <p className="text-sm font-medium text-neutral-700">No symbol selected</p>
        <p className="text-xs text-neutral-500 mt-1">Choose a company from the picker above to load its price history.</p>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="w-full p-8 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 flex flex-col items-center justify-center text-center">
        <AlertCircle className="w-9 h-9 text-amber-600 mb-2" />
        <h3 className="font-semibold text-base">No Data Available for {symbol}</h3>
        <p className="text-sm text-amber-800 mt-1 max-w-md">
          The `daily_prices` table returned 0 records matching symbol <span className="font-mono font-bold">&quot;{symbol}&quot;</span>.
        </p>
        <p className="text-xs text-amber-600 mt-2">
          This symbol may be newly listed or price data has not yet been loaded into Supabase.
        </p>
      </div>
    );
  }

  const isNetUp = metrics ? metrics.totalChange >= 0 : true;
  const strokeColor = isNetUp ? '#059669' : '#dc2626';
  const fillColor = isNetUp ? '#10b981' : '#ef4444';

  // Domain padding for Y-Axis
  const yDomainMin = metrics ? Math.floor(metrics.minPrice * 0.96) : 'auto';
  const yDomainMax = metrics ? Math.ceil(metrics.maxPrice * 1.04) : 'auto';

  return (
    <div className="w-full bg-white border border-neutral-200 rounded-xl shadow-xs overflow-hidden">
      {/* Chart Header Bar */}
      <div className="p-4 sm:p-5 border-b border-neutral-100 flex flex-wrap items-baseline justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-xl sm:text-2xl font-bold font-mono text-neutral-900">
              {symbol}
            </h2>
            {metrics && (
              <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold font-mono bg-neutral-100">
                {metrics.isPositive ? (
                  <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
                ) : (
                  <TrendingDown className="w-3.5 h-3.5 text-rose-600" />
                )}
                <span className={metrics.isPositive ? 'text-emerald-700' : 'text-rose-700'}>
                  {metrics.sessionChange >= 0 ? '+' : ''}
                  {metrics.sessionChange.toFixed(2)} ({metrics.sessionChangePct >= 0 ? '+' : ''}
                  {metrics.sessionChangePct.toFixed(2)}%)
                </span>
              </div>
            )}
          </div>
          <div className="text-xs text-neutral-500 mt-1 flex flex-wrap items-center gap-2">
            <span>Historical Price Series ({data.length} trading sessions displayed)</span>
            {filterConfig.mode === 'candlestick' && (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                <CandlestickChart className="w-3 h-3 text-amber-600" />
                <span>
                  {patternSignalSet.size} {CANDLESTICK_PATTERN_LABELS[filterConfig.candlestickPattern]}
                  {patternSignalSet.size < 10 && ' (caution: <10 occurrences)'}
                </span>
              </span>
            )}
          </div>
        </div>

        {/* Current Price & High/Low Stat badges */}
        {metrics && (
          <div className="flex items-center gap-4 text-right font-mono">
            <div>
              <div className="text-[11px] text-neutral-400 uppercase tracking-wider">Latest Close</div>
              <div className="text-lg sm:text-xl font-bold text-neutral-900">
                NPR {metrics.latestClose.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
            <div className="hidden sm:block pl-4 border-l border-neutral-200 text-left">
              <div className="text-[11px] text-neutral-400 uppercase tracking-wider">Range (Low - High)</div>
              <div className="text-sm font-semibold text-neutral-700">
                {metrics.minPrice.toFixed(1)} - {metrics.maxPrice.toFixed(1)}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Indicator Filter & Overlay Control Panel */}
      <div className="p-4 sm:p-5 border-b border-neutral-200 bg-neutral-50/60">
        <SignalFilterPanel
          config={filterConfig}
          onChange={setFilterConfig}
          showOverlayToggles={true}
          fastVisible={showFastMA}
          onToggleFastVisible={setShowFastMA}
          slowVisible={showSlowMA}
          onToggleSlowVisible={setShowSlowMA}
          rsiVisible={showRSI}
          onToggleRsiVisible={setShowRSI}
          candlePatternVisible={showCandlePattern}
          onToggleCandlePatternVisible={setShowCandlePattern}
          title="Chart Indicator Overlays & Parameters"
          description="Adjust indicator types, periods, and thresholds to update overlay lines and subcharts in real time."
        />
      </div>

      {/* Main Price & Indicators Chart */}
      <div className="p-3 sm:p-5 space-y-4">
        <div className="h-72 sm:h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={fillColor} stopOpacity={0.15} />
                  <stop offset="95%" stopColor={fillColor} stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={{ stroke: '#e2e8f0' }}
                tick={{ fontSize: 11, fill: '#64748b' }}
                minTickGap={45}
              />
              <YAxis
                domain={[yDomainMin, yDomainMax]}
                tickLine={false}
                axisLine={{ stroke: '#e2e8f0' }}
                tick={{ fontSize: 11, fill: '#64748b' }}
                tickFormatter={(v) => `${v}`}
                orientation="right"
              />
              <Tooltip
                content={
                  <CustomPriceTooltip
                    showFastMA={showFastMA}
                    showSlowMA={showSlowMA}
                    fastLabel={`${filterConfig.maCross.fastType}(${filterConfig.maCross.fastPeriod})`}
                    slowLabel={`${filterConfig.maCross.slowType}(${filterConfig.maCross.slowPeriod})`}
                    rsiLabel={`RSI(${filterConfig.rsiThreshold.period})`}
                  />
                }
              />
              {/* Close Price Area */}
              <Area
                type="monotone"
                dataKey="close"
                name="Close"
                stroke={strokeColor}
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorPrice)"
                isAnimationActive={false}
              />

              {/* Fast MA Line */}
              {showFastMA && (
                <Line
                  type="monotone"
                  dataKey="fastMA"
                  name={`${filterConfig.maCross.fastType}(${filterConfig.maCross.fastPeriod})`}
                  stroke="#2563eb"
                  strokeWidth={1.75}
                  dot={false}
                  connectNulls={false}
                  isAnimationActive={false}
                />
              )}

              {/* Slow MA Line */}
              {showSlowMA && (
                <Line
                  type="monotone"
                  dataKey="slowMA"
                  name={`${filterConfig.maCross.slowType}(${filterConfig.maCross.slowPeriod})`}
                  stroke="#d97706"
                  strokeWidth={1.75}
                  dot={false}
                  connectNulls={false}
                  isAnimationActive={false}
                />
              )}

              {/* Candlestick Pattern Overlay Markers */}
              {filterConfig.mode === 'candlestick' && showCandlePattern && (
                <Line
                  type="monotone"
                  dataKey="patternMarkerPrice"
                  name={`Pattern: ${CANDLESTICK_PATTERN_LABELS[filterConfig.candlestickPattern]}`}
                  stroke="transparent"
                  dot={<CustomPatternMarker />}
                  activeDot={{ r: 6, fill: '#f59e0b', stroke: '#78350f', strokeWidth: 2 }}
                  connectNulls={false}
                  isAnimationActive={false}
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* RSI Subplot (Adjustable Period & Threshold) */}
        {showRSI && (
          <div className="pt-3 border-t border-neutral-100">
            <div className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider mb-1 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-neutral-700">RSI ({filterConfig.rsiThreshold.period})</span>
                <span className="text-neutral-400 font-normal">Wilder&apos;s Smoothing</span>
                {metrics?.latestRSI !== null && metrics?.latestRSI !== undefined ? (
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                      metrics.latestRSI >= 70
                        ? 'bg-rose-100 text-rose-800'
                        : metrics.latestRSI <= filterConfig.rsiThreshold.threshold
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-neutral-100 text-neutral-700'
                    }`}
                  >
                    {metrics.latestRSI.toFixed(2)}
                    {metrics.latestRSI >= 70
                      ? ' • Overbought (≥70)'
                      : metrics.latestRSI <= filterConfig.rsiThreshold.threshold
                      ? ` • Oversold (≤${filterConfig.rsiThreshold.threshold})`
                      : ''}
                  </span>
                ) : (
                  <span className="font-mono text-neutral-400 text-[10px] italic">
                    insufficient history (&lt; {filterConfig.rsiThreshold.period + 1} sessions)
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 font-mono text-[10px] text-neutral-400">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-0.5 bg-rose-500"></span> 70 OB
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-0.5 bg-emerald-500"></span> {filterConfig.rsiThreshold.threshold} {filterConfig.rsiThreshold.direction === 'recovery' ? 'OS' : 'Thresh'}
                </span>
              </div>
            </div>
            <div className="h-20 sm:h-22 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 4, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="date" hide />
                  <YAxis
                    domain={[0, 100]}
                    ticks={[Math.min(30, filterConfig.rsiThreshold.threshold), 70]}
                    orientation="right"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 10, fill: '#94a3b8' }}
                  />
                  <ReferenceLine y={70} stroke="#f43f5e" strokeDasharray="3 3" strokeWidth={1} />
                  <ReferenceLine y={50} stroke="#e2e8f0" strokeDasharray="2 2" strokeWidth={1} />
                  <ReferenceLine
                    y={filterConfig.rsiThreshold.threshold}
                    stroke="#10b981"
                    strokeDasharray="3 3"
                    strokeWidth={1}
                  />
                  <Tooltip
                    content={
                      <CustomRsiTooltip
                        rsiLabel={`RSI(${filterConfig.rsiThreshold.period})`}
                        threshold={filterConfig.rsiThreshold.threshold}
                        direction={filterConfig.rsiThreshold.direction}
                      />
                    }
                  />
                  <Line
                    type="monotone"
                    dataKey="chartRsi"
                    name={`RSI(${filterConfig.rsiThreshold.period})`}
                    stroke="#6366f1"
                    strokeWidth={1.75}
                    dot={false}
                    connectNulls={false}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Synchronized Volume Sub-chart */}
        <div className="pt-3 border-t border-neutral-100">
          <div className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider mb-1 flex items-center justify-between">
            <span>Volume (Shares)</span>
            <span className="font-mono text-neutral-400">
              Total displayed: {metrics?.totalVolume.toLocaleString()}
            </span>
          </div>
          <div className="h-20 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 2, right: 10, left: 0, bottom: 0 }}>
                <XAxis dataKey="date" hide />
                <YAxis
                  orientation="right"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 10, fill: '#94a3b8' }}
                  tickFormatter={(v) =>
                    v >= 1000000
                      ? `${(v / 1000000).toFixed(1)}M`
                      : v >= 1000
                      ? `${(v / 1000).toFixed(0)}k`
                      : `${v}`
                  }
                />
                <Tooltip
                  content={
                    <CustomPriceTooltip
                      showFastMA={false}
                      showSlowMA={false}
                    />
                  }
                />
                <Bar
                  dataKey="volume"
                  fill="#94a3b8"
                  opacity={0.65}
                  isAnimationActive={false}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};
