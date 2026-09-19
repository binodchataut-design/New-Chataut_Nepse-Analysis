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
import { PriceRecordWithIndicators } from '../types';
import { TrendingUp, TrendingDown, AlertCircle, Calendar } from 'lucide-react';

interface PriceChartProps {
  symbol: string;
  data: PriceRecordWithIndicators[];
  isLoading: boolean;
  error?: string | null;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    payload: PriceRecordWithIndicators;
  }>;
  showSMA20?: boolean;
  showSMA50?: boolean;
  showEMA20?: boolean;
}

const CustomPriceTooltip: React.FC<CustomTooltipProps> = ({
  active,
  payload,
  showSMA20 = true,
  showSMA50 = true,
  showEMA20 = false,
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
        {(showSMA20 || showSMA50 || showEMA20 || item.rsi14 !== null) && (
          <div className="pt-1.5 mt-1.5 border-t border-neutral-800 space-y-0.5">
            {showSMA20 && (
              <div className="flex justify-between items-center text-blue-300">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-0.5 bg-blue-400 rounded-xs"></span>
                  SMA(20):
                </span>
                <span className="font-semibold">
                  {item.sma20 !== null ? `NPR ${item.sma20.toFixed(2)}` : 'insufficient data'}
                </span>
              </div>
            )}
            {showSMA50 && (
              <div className="flex justify-between items-center text-amber-300">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-0.5 bg-amber-400 rounded-xs"></span>
                  SMA(50):
                </span>
                <span className="font-semibold">
                  {item.sma50 !== null ? `NPR ${item.sma50.toFixed(2)}` : 'insufficient data'}
                </span>
              </div>
            )}
            {showEMA20 && (
              <div className="flex justify-between items-center text-purple-300">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-0.5 bg-purple-400 rounded-xs"></span>
                  EMA(20):
                </span>
                <span className="font-semibold">
                  {item.ema20 !== null ? `NPR ${item.ema20.toFixed(2)}` : 'insufficient data'}
                </span>
              </div>
            )}
            {item.rsi14 !== null && (
              <div className="flex justify-between items-center text-indigo-300">
                <span>RSI(14):</span>
                <span className="font-semibold">{item.rsi14.toFixed(2)}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const CustomRsiTooltip: React.FC<{
  active?: boolean;
  payload?: Array<{ payload: PriceRecordWithIndicators }>;
}> = ({ active, payload }) => {
  if (!active || !payload || !payload.length) return null;
  const item = payload[0].payload;
  const rsi = item.rsi14;

  return (
    <div className="bg-neutral-900 text-white p-2.5 rounded-lg shadow-xl text-xs font-mono border border-neutral-700 min-w-[150px]">
      <div className="text-neutral-400 text-[10px] pb-1 border-b border-neutral-800">{item.date}</div>
      <div className="flex items-center justify-between gap-3 mt-1.5">
        <span className="text-neutral-400">RSI(14):</span>
        <span
          className={`font-bold ${
            rsi === null
              ? 'text-neutral-500'
              : rsi >= 70
              ? 'text-rose-400'
              : rsi <= 30
              ? 'text-emerald-400'
              : 'text-indigo-300'
          }`}
        >
          {rsi !== null ? rsi.toFixed(2) : 'insufficient history'}
        </span>
      </div>
      {rsi !== null && (
        <div className="text-[10px] text-neutral-400 mt-0.5">
          {rsi >= 70 ? 'Overbought (≥70)' : rsi <= 30 ? 'Oversold (≤30)' : 'Neutral'}
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
  // Toggle states for technical indicator overlays
  // Default: SMA(20) and SMA(50) ON, EMA(20) OFF
  const [showSMA20, setShowSMA20] = useState<boolean>(true);
  const [showSMA50, setShowSMA50] = useState<boolean>(true);
  const [showEMA20, setShowEMA20] = useState<boolean>(false);

  // Compute price change and metrics from real data
  const metrics = useMemo(() => {
    if (!data || data.length === 0) return null;
    const first = data[0];
    const latest = data[data.length - 1];
    const prev = data.length > 1 ? data[data.length - 2] : first;

    const sessionChange = latest.close - prev.close;
    const sessionChangePct = prev.close > 0 ? (sessionChange / prev.close) * 100 : 0;
    const totalChange = latest.close - first.close;
    const totalChangePct = first.close > 0 ? (totalChange / first.close) * 100 : 0;

    let minPrice = Infinity;
    let maxPrice = -Infinity;
    let totalVolume = 0;

    for (const d of data) {
      if (d.low < minPrice && d.low > 0) minPrice = d.low;
      if (d.close < minPrice && d.close > 0) minPrice = d.close;
      if (d.high > maxPrice) maxPrice = d.high;
      if (d.close > maxPrice) maxPrice = d.close;
      totalVolume += (d.volume || 0);

      // Account for indicator values in domain so overlay lines don't get clipped
      if (showSMA20 && d.sma20 !== null) {
        if (d.sma20 < minPrice) minPrice = d.sma20;
        if (d.sma20 > maxPrice) maxPrice = d.sma20;
      }
      if (showSMA50 && d.sma50 !== null) {
        if (d.sma50 < minPrice) minPrice = d.sma50;
        if (d.sma50 > maxPrice) maxPrice = d.sma50;
      }
      if (showEMA20 && d.ema20 !== null) {
        if (d.ema20 < minPrice) minPrice = d.ema20;
        if (d.ema20 > maxPrice) maxPrice = d.ema20;
      }
    }

    return {
      firstDate: first.date,
      latestDate: latest.date,
      latestClose: latest.close,
      latestSMA20: latest.sma20,
      latestSMA50: latest.sma50,
      latestEMA20: latest.ema20,
      latestRSI: latest.rsi14,
      sessionChange,
      sessionChangePct,
      totalChange,
      totalChangePct,
      minPrice: minPrice === Infinity ? 0 : minPrice,
      maxPrice: maxPrice === -Infinity ? 0 : maxPrice,
      totalVolume,
      sessionCount: data.length,
      isPositive: sessionChange >= 0,
    };
  }, [data, showSMA20, showSMA50, showEMA20]);

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
          <div className="text-xs text-neutral-500 mt-1 flex items-center gap-2">
            <span>Historical Price Series ({data.length} trading sessions displayed)</span>
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

      {/* Indicator Overlay Control Bar */}
      <div className="px-4 sm:px-5 py-2.5 bg-neutral-50 border-b border-neutral-200 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-2.5 sm:gap-4">
          <span className="font-semibold text-neutral-600 uppercase tracking-wider text-[10px]">
            Indicator Overlays:
          </span>

          {/* SMA(20) Toggle */}
          <label
            id="toggle-sma20-container"
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs font-mono cursor-pointer transition-colors select-none ${
              showSMA20
                ? 'bg-blue-50 border-blue-300 text-blue-900 font-semibold'
                : 'bg-white border-neutral-200 text-neutral-600 hover:bg-neutral-100'
            }`}
          >
            <input
              type="checkbox"
              id="toggle-sma-20"
              checked={showSMA20}
              onChange={(e) => setShowSMA20(e.target.checked)}
              className="rounded text-blue-600 focus:ring-blue-500 border-neutral-300 w-3.5 h-3.5"
            />
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-1 bg-blue-600 rounded-sm"></span>
              SMA(20)
            </span>
            {metrics?.latestSMA20 !== null && metrics?.latestSMA20 !== undefined && (
              <span className="text-[10px] text-neutral-500 font-normal">
                {metrics.latestSMA20.toFixed(1)}
              </span>
            )}
          </label>

          {/* SMA(50) Toggle */}
          <label
            id="toggle-sma50-container"
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs font-mono cursor-pointer transition-colors select-none ${
              showSMA50
                ? 'bg-amber-50 border-amber-300 text-amber-900 font-semibold'
                : 'bg-white border-neutral-200 text-neutral-600 hover:bg-neutral-100'
            }`}
          >
            <input
              type="checkbox"
              id="toggle-sma-50"
              checked={showSMA50}
              onChange={(e) => setShowSMA50(e.target.checked)}
              className="rounded text-amber-600 focus:ring-amber-500 border-neutral-300 w-3.5 h-3.5"
            />
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-1 bg-amber-600 rounded-sm"></span>
              SMA(50)
            </span>
            {metrics?.latestSMA50 !== null && metrics?.latestSMA50 !== undefined && (
              <span className="text-[10px] text-neutral-500 font-normal">
                {metrics.latestSMA50.toFixed(1)}
              </span>
            )}
          </label>

          {/* EMA(20) Toggle */}
          <label
            id="toggle-ema20-container"
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs font-mono cursor-pointer transition-colors select-none ${
              showEMA20
                ? 'bg-purple-50 border-purple-300 text-purple-900 font-semibold'
                : 'bg-white border-neutral-200 text-neutral-600 hover:bg-neutral-100'
            }`}
          >
            <input
              type="checkbox"
              id="toggle-ema-20"
              checked={showEMA20}
              onChange={(e) => setShowEMA20(e.target.checked)}
              className="rounded text-purple-600 focus:ring-purple-500 border-neutral-300 w-3.5 h-3.5"
            />
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-1 bg-purple-600 rounded-sm"></span>
              EMA(20)
            </span>
            {metrics?.latestEMA20 !== null && metrics?.latestEMA20 !== undefined && (
              <span className="text-[10px] text-neutral-500 font-normal">
                {metrics.latestEMA20.toFixed(1)}
              </span>
            )}
          </label>
        </div>

        <div className="hidden sm:block text-[11px] text-neutral-400 font-mono">
          Pure math • Gaps skipped (no 0 fabrication)
        </div>
      </div>

      {/* Main Price & Indicators Chart */}
      <div className="p-3 sm:p-5 space-y-4">
        <div className="h-72 sm:h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
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
                    showSMA20={showSMA20}
                    showSMA50={showSMA50}
                    showEMA20={showEMA20}
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

              {/* SMA(20) Line - Blue */}
              {showSMA20 && (
                <Line
                  type="monotone"
                  dataKey="sma20"
                  name="SMA(20)"
                  stroke="#2563eb"
                  strokeWidth={1.75}
                  dot={false}
                  connectNulls={false}
                  isAnimationActive={false}
                />
              )}

              {/* SMA(50) Line - Amber */}
              {showSMA50 && (
                <Line
                  type="monotone"
                  dataKey="sma50"
                  name="SMA(50)"
                  stroke="#d97706"
                  strokeWidth={1.75}
                  dot={false}
                  connectNulls={false}
                  isAnimationActive={false}
                />
              )}

              {/* EMA(20) Line - Purple */}
              {showEMA20 && (
                <Line
                  type="monotone"
                  dataKey="ema20"
                  name="EMA(20)"
                  stroke="#9333ea"
                  strokeWidth={1.75}
                  strokeDasharray="4 3"
                  dot={false}
                  connectNulls={false}
                  isAnimationActive={false}
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* RSI(14) Subplot (Standard Wilder's Smoothing) */}
        <div className="pt-3 border-t border-neutral-100">
          <div className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider mb-1 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-neutral-700">RSI (14)</span>
              <span className="text-neutral-400 font-normal">Wilder&apos;s Smoothing</span>
              {metrics?.latestRSI !== null && metrics?.latestRSI !== undefined ? (
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                    metrics.latestRSI >= 70
                      ? 'bg-rose-100 text-rose-800'
                      : metrics.latestRSI <= 30
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-neutral-100 text-neutral-700'
                  }`}
                >
                  {metrics.latestRSI.toFixed(2)}
                  {metrics.latestRSI >= 70
                    ? ' • Overbought (≥70)'
                    : metrics.latestRSI <= 30
                    ? ' • Oversold (≤30)'
                    : ''}
                </span>
              ) : (
                <span className="font-mono text-neutral-400 text-[10px] italic">
                  insufficient history (&lt; 15 sessions)
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 font-mono text-[10px] text-neutral-400">
              <span className="flex items-center gap-1">
                <span className="w-2 h-0.5 bg-rose-500"></span> 70 OB
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-0.5 bg-emerald-500"></span> 30 OS
              </span>
            </div>
          </div>
          <div className="h-20 sm:h-22 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 4, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="date" hide />
                <YAxis
                  domain={[0, 100]}
                  ticks={[30, 70]}
                  orientation="right"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 10, fill: '#94a3b8' }}
                />
                <ReferenceLine y={70} stroke="#f43f5e" strokeDasharray="3 3" strokeWidth={1} />
                <ReferenceLine y={50} stroke="#e2e8f0" strokeDasharray="2 2" strokeWidth={1} />
                <ReferenceLine y={30} stroke="#10b981" strokeDasharray="3 3" strokeWidth={1} />
                <Tooltip content={<CustomRsiTooltip />} />
                <Line
                  type="monotone"
                  dataKey="rsi14"
                  name="RSI(14)"
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
              <BarChart data={data} margin={{ top: 2, right: 10, left: 0, bottom: 0 }}>
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
                      showSMA20={false}
                      showSMA50={false}
                      showEMA20={false}
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
