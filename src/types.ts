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

export type TimeRange = '1M' | '3M' | '6M' | '1Y' | 'ALL';

export interface PriceRecordWithIndicators extends PriceRecord {
  sma20: number | null;
  sma50: number | null;
  ema20: number | null;
  rsi14: number | null;
  relativeVolume: number | null;
}

export interface SetupOccurrence {
  signalDate: string;
  signalClose: number;
  outcomeDate: string | null;
  outcomeClose: number | null;
  forwardReturn: number | null;
  worked: boolean;
  isExcluded?: boolean;
  sessionsAvailable?: number;
}

export interface SetupScoreResult {
  totalOccurrences: number;
  excludedOccurrences: number;
  successCount: number;
  hitRate: number | null;
  avgForwardReturn: number | null;
  occurrences: SetupOccurrence[];
}
