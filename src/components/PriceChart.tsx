import React, { useMemo } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
} from 'recharts';
import { PriceRecord } from '../types';
import { TrendingUp, TrendingDown, AlertCircle, Calendar } from 'lucide-react';

interface PriceChartProps {
  symbol: string;
  data: PriceRecord[];
  isLoading: boolean;
  error?: string | null;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    payload: PriceRecord;
  }>;
}

const CustomPriceTooltip: React.FC<CustomTooltipProps> = ({ active, payload }) => {
  if (!active || !payload || !payload.length) return null;

  const item = payload[0].payload;
  const isUp = item.close >= item.open;

  return (
    <div className="bg-neutral-900 text-white p-3 rounded-lg shadow-xl text-xs font-mono border border-neutral-700 min-w-[190px]">
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
        {item.turnover !== undefined && item.turnover > 0 && (
          <div className="flex justify-between text-neutral-400">
            <span>Turnover:</span>
            <span className="text-neutral-300">NPR {(item.turnover / 100000).toFixed(2)} Lakhs</span>
          </div>
        )}
      </div>
    </div>
  );
};

export const PriceChart: React.FC<PriceChartProps> = ({
  symbol,
  data,
  isLoading,
  error,
}) => {
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
      totalVolume += d.volume;
    }

    return {
      firstDate: first.date,
      latestDate: latest.date,
      latestClose: latest.close,
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
  }, [data]);

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
            <span>Historical Price Series ({data.length} trading sessions)</span>
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

      {/* Main Price Area Chart */}
      <div className="p-3 sm:p-5">
        <div className="h-72 sm:h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
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
              <Tooltip content={<CustomPriceTooltip />} />
              <Area
                type="monotone"
                dataKey="close"
                stroke={strokeColor}
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorPrice)"
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Synchronized Volume Sub-chart */}
        <div className="mt-3 pt-3 border-t border-neutral-100">
          <div className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider mb-1 flex items-center justify-between">
            <span>Volume (Shares)</span>
            <span className="font-mono text-neutral-400">
              Total: {metrics?.totalVolume.toLocaleString()}
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
                  tickFormatter={(v) => (v >= 1000000 ? `${(v / 1000000).toFixed(1)}M` : v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`)}
                />
                <Tooltip content={<CustomPriceTooltip />} />
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
