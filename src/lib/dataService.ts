import { getSupabaseClient, supabaseUrl, supabaseAnonKey } from './supabaseClient';
import { MarketOverviewData, SectorStat } from '../types';

export interface Company {
  symbol: string;
  name: string;
  sector?: string;
  raw: Record<string, unknown>;
}

export interface PriceRecord {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  turnover?: number;
  raw: Record<string, unknown>;
}

export interface TableSchemaInfo {
  tableName: string;
  columns: string[];
  columnTypes: Record<string, string>;
  sampleRow?: Record<string, unknown>;
  error?: string;
}

export interface IntrospectionReport {
  companies: TableSchemaInfo;
  daily_prices: TableSchemaInfo;
  market_index: TableSchemaInfo;
  timestamp: string;
}

// Cached introspection metadata
let cachedIntrospection: IntrospectionReport | null = null;
let cachedDailyPriceColumns: string[] = [];
let cachedCompanyColumns: string[] = [];

/**
 * Inspects live Supabase tables (companies, daily_prices, market_index)
 * via PostgREST OpenAPI spec and sample rows to discover real column names.
 */
export async function introspectSchema(): Promise<IntrospectionReport> {
  const client = getSupabaseClient();

  const report: IntrospectionReport = {
    companies: { tableName: 'companies', columns: [], columnTypes: {} },
    daily_prices: { tableName: 'daily_prices', columns: [], columnTypes: {} },
    market_index: { tableName: 'market_index', columns: [], columnTypes: {} },
    timestamp: new Date().toISOString(),
  };

  // 1. Try fetching PostgREST OpenAPI definitions
  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/?apikey=${supabaseAnonKey}`, {
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${supabaseAnonKey}`,
      },
    });

    if (res.ok) {
      const openApiSpec = await res.json();
      const definitions = openApiSpec.definitions || {};

      for (const table of ['companies', 'daily_prices', 'market_index'] as const) {
        const tableDef = definitions[table];
        if (tableDef && tableDef.properties) {
          report[table].columns = Object.keys(tableDef.properties);
          for (const [col, def] of Object.entries<Record<string, unknown>>(tableDef.properties)) {
            report[table].columnTypes[col] = String(def.type || def.format || 'unknown');
          }
        }
      }
    }
  } catch (err) {
    // Non-blocking: will fallback to sample row inspection
    console.warn('OpenAPI introspection skipped/failed:', err);
  }

  // 2. Query 1 sample row from each table to confirm columns and live read access
  const inspectTable = async (table: 'companies' | 'daily_prices' | 'market_index') => {
    try {
      const { data, error } = await client.from(table).select('*').limit(1);
      if (error) {
        report[table].error = error.message;
      } else if (data && data.length > 0) {
        report[table].sampleRow = data[0] as Record<string, unknown>;
        const rowCols = Object.keys(data[0]);
        // Merge discovered columns
        const combined = Array.from(new Set([...report[table].columns, ...rowCols]));
        report[table].columns = combined;

        // Incur types from sample row if not already populated
        for (const [k, v] of Object.entries(data[0])) {
          if (!report[table].columnTypes[k]) {
            report[table].columnTypes[k] = v === null ? 'nullable' : typeof v;
          }
        }
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      report[table].error = message;
    }
  };

  await Promise.all([
    inspectTable('companies'),
    inspectTable('daily_prices'),
    inspectTable('market_index'),
  ]);

  cachedIntrospection = report;
  cachedCompanyColumns = report.companies.columns;
  cachedDailyPriceColumns = report.daily_prices.columns;

  console.log('Live NEPSE Supabase Schema Introspection:', report);
  return report;
}

/**
 * Reads real company list from the `companies` table in Supabase.
 */
export async function getCompanies(): Promise<Company[]> {
  const client = getSupabaseClient();

  // If we haven't introspected yet, inspect schema first
  if (!cachedIntrospection) {
    try {
      await introspectSchema();
    } catch (err) {
      console.warn('Initial introspection error:', err);
    }
  }

  // Query companies table
  const { data, error } = await client
    .from('companies')
    .select('*');

  if (error) {
    throw new Error(`Failed to fetch companies from Supabase: ${error.message} (code: ${error.code})`);
  }

  if (!data || data.length === 0) {
    return [];
  }

  // Map columns based on real discovered keys
  const companies: Company[] = data
    .map((row: Record<string, unknown>) => {
      const symbol = String(
        row.symbol ??
        row.company_symbol ??
        row.ticker ??
        row.scrip ??
        row.code ??
        row.id ??
        ''
      ).trim().toUpperCase();

      const name = String(
        row.name ??
        row.company_name ??
        row.security_name ??
        row.instrument_name ??
        symbol
      ).trim();

      const sector = row.sector
        ? String(row.sector)
        : row.sector_name
        ? String(row.sector_name)
        : undefined;

      return {
        symbol,
        name: name || symbol,
        sector,
        raw: row,
      };
    })
    .filter((c) => Boolean(c.symbol));

  // Sort alphabetically by symbol
  companies.sort((a, b) => a.symbol.localeCompare(b.symbol));

  return companies;
}

/**
 * Reads historical daily prices for a given symbol from `daily_prices`.
 * Real Supabase query with optional from/to date filters.
 */
export async function getPriceHistory(
  symbol: string,
  from?: string,
  to?: string
): Promise<PriceRecord[]> {
  const trimmedSymbol = symbol.trim().toUpperCase();
  if (!trimmedSymbol) {
    return [];
  }

  const client = getSupabaseClient();

  // Find the exact symbol column and date column from cached schema or common candidates
  const cols = cachedDailyPriceColumns;
  const symbolColumn =
    cols.find((c) => ['symbol', 'company_symbol', 'ticker', 'scrip'].includes(c.toLowerCase())) ||
    'symbol';
  const dateColumn =
    cols.find((c) => ['date', 'business_date', 'published_date', 'as_of_date'].includes(c.toLowerCase())) ||
    'date';

  let query = client
    .from('daily_prices')
    .select('*')
    .eq(symbolColumn, trimmedSymbol);

  if (from) {
    query = query.gte(dateColumn, from);
  }
  if (to) {
    query = query.lte(dateColumn, to);
  }

  // Order ascending by date to form a valid chronological chart series
  query = query.order(dateColumn, { ascending: true }).limit(5000);

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch daily prices for ${trimmedSymbol}: ${error.message}`);
  }

  if (!data || data.length === 0) {
    return [];
  }

  const records: PriceRecord[] = data.map((row: Record<string, unknown>) => {
    const rawDate = String(
      row.date ??
      row.business_date ??
      row.published_date ??
      row.as_of_date ??
      ''
    );
    const dateFormatted = rawDate.split('T')[0] || rawDate;

    const closeVal = Number(
      row.close ??
      row.close_price ??
      row.closing_price ??
      row.ltp ??
      row.last_traded_price ??
      0
    );

    const openVal = Number(
      row.open ??
      row.open_price ??
      row.opening_price ??
      closeVal
    );

    const highVal = Number(
      row.high ??
      row.high_price ??
      row.highest_price ??
      Math.max(openVal, closeVal)
    );

    const lowVal = Number(
      row.low ??
      row.low_price ??
      row.lowest_price ??
      Math.min(openVal, closeVal)
    );

    const volVal = Number(
      row.volume ??
      row.total_traded_quantity ??
      row.traded_shares ??
      row.quantity ??
      0
    );

    const turnoverVal = Number(
      row.turnover ??
      row.total_turnover ??
      row.total_traded_value ??
      row.amount ??
      0
    );

    return {
      date: dateFormatted,
      open: isNaN(openVal) ? 0 : openVal,
      high: isNaN(highVal) ? 0 : highVal,
      low: isNaN(lowVal) ? 0 : lowVal,
      close: isNaN(closeVal) ? 0 : closeVal,
      volume: isNaN(volVal) ? 0 : volVal,
      turnover: isNaN(turnoverVal) ? undefined : turnoverVal,
      raw: row,
    };
  });

  // Ensure strict ascending order by date
  records.sort((a, b) => a.date.localeCompare(b.date));

  return records;
}

export function getCachedIntrospection(): IntrospectionReport | null {
  return cachedIntrospection;
}

/**
 * Reads market-wide overview stats:
 * 1. NEPSE Index status from `market_index` (latest row, previous row, point & pct change)
 * 2. Total market volume & turnover from `daily_prices` for the latest available date
 * 3. Sector breakdown (advancers, decliners, unchanged) based on `companies.sector` and `daily_prices.per_change`
 */
export async function getMarketOverview(): Promise<MarketOverviewData> {
  const client = getSupabaseClient();
  const result: MarketOverviewData = {
    indexStatus: null,
    volumeTurnover: null,
    sectorStats: [],
    sectorDate: null,
    asOfTimestamp: new Date().toISOString(),
  };

  // 1. NEPSE Index Status from `market_index`
  try {
    const { data: idxRows, error: idxErr } = await client
      .from('market_index')
      .select('date, close, change_percent, turnover')
      .order('date', { ascending: false })
      .limit(2);

    if (idxErr) {
      result.indexError = `Error querying market_index: ${idxErr.message}`;
    } else if (idxRows && idxRows.length > 0) {
      const latest = idxRows[0];
      const prev = idxRows.length > 1 ? idxRows[1] : null;
      const latestClose = Number(latest.close);
      const prevClose = prev ? Number(prev.close) : null;
      const pointsChange = prevClose !== null ? Number((latestClose - prevClose).toFixed(2)) : null;
      const calculatedPct =
        prevClose !== null && prevClose !== 0
          ? Number((((latestClose - prevClose) / prevClose) * 100).toFixed(2))
          : null;
      const storedPct =
        latest.change_percent !== null && latest.change_percent !== undefined
          ? Number(latest.change_percent)
          : null;

      result.indexStatus = {
        latestDate: String(latest.date),
        latestClose,
        previousDate: prev ? String(prev.date) : null,
        previousClose: prevClose,
        pointsChange,
        percentChangeStored: storedPct,
        percentChangeCalculated: calculatedPct,
        rawRows: idxRows.map((r) => ({
          date: String(r.date),
          close: Number(r.close),
          change_percent: r.change_percent !== null ? Number(r.change_percent) : null,
          turnover: r.turnover !== null ? Number(r.turnover) : null,
        })),
      };
    } else {
      result.indexError = 'No records found in market_index table.';
    }
  } catch (err: unknown) {
    result.indexError = err instanceof Error ? err.message : String(err);
  }

  // 2 & 3. Max date in daily_prices, Volume/Turnover, and Sector Breakdown
  let latestPriceDate: string | null = null;
  try {
    const { data: maxDateRows, error: maxDateErr } = await client
      .from('daily_prices')
      .select('date')
      .order('date', { ascending: false })
      .limit(1);

    if (maxDateErr) {
      result.volumeError = `Failed to find latest date in daily_prices: ${maxDateErr.message}`;
      result.sectorError = `Failed to find latest date in daily_prices: ${maxDateErr.message}`;
    } else if (maxDateRows && maxDateRows.length > 0) {
      latestPriceDate = String(maxDateRows[0].date);
      result.sectorDate = latestPriceDate;
    } else {
      result.volumeError = 'No records found in daily_prices table.';
      result.sectorError = 'No records found in daily_prices table.';
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    result.volumeError = msg;
    result.sectorError = msg;
  }

  if (latestPriceDate) {
    // Fetch company sector mapping
    const companySectorMap = new Map<string, string>();
    try {
      const companies = await getCompanies();
      companies.forEach((c) => {
        companySectorMap.set(c.symbol, c.sector?.trim() || 'Others');
      });
    } catch (cErr) {
      console.warn('Could not fetch companies for sector breakdown:', cErr);
    }

    try {
      // Fetch all rows for the most recent date
      const { data: dayRows, error: dayErr } = await client
        .from('daily_prices')
        .select('symbol, close, volume, per_change')
        .eq('date', latestPriceDate);

      if (dayErr) {
        result.volumeError = `Error fetching prices for date ${latestPriceDate}: ${dayErr.message}`;
        result.sectorError = `Error fetching prices for date ${latestPriceDate}: ${dayErr.message}`;
      } else if (dayRows && dayRows.length > 0) {
        let totalVol = 0;
        const sectorMap = new Map<string, SectorStat>();

        dayRows.forEach((r) => {
          totalVol += Number(r.volume || 0);

          const sec = companySectorMap.get(r.symbol) || 'Others';
          if (!sectorMap.has(sec)) {
            sectorMap.set(sec, {
              sector: sec,
              advancers: 0,
              decliners: 0,
              unchanged: 0,
              total: 0,
            });
          }
          const stat = sectorMap.get(sec)!;
          stat.total++;

          const change = Number(r.per_change ?? 0);
          if (change > 0) {
            stat.advancers++;
          } else if (change < 0) {
            stat.decliners++;
          } else {
            stat.unchanged++;
          }
        });

        // daily_prices table has no 'turnover' column
        result.volumeTurnover = {
          date: latestPriceDate,
          totalVolume: totalVol,
          totalTurnover: null,
          turnoverColumnExists: false,
          symbolCount: dayRows.length,
        };

        result.sectorStats = Array.from(sectorMap.values()).sort((a, b) => b.total - a.total);
      } else {
        result.volumeError = `Zero records found in daily_prices for ${latestPriceDate}.`;
        result.sectorError = `Zero records found in daily_prices for ${latestPriceDate}.`;
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      result.volumeError = msg;
      result.sectorError = msg;
    }
  }

  return result;
}
