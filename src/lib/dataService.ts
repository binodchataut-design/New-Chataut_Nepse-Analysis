import { getSupabaseClient, supabaseUrl, supabaseAnonKey } from './supabaseClient';

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
