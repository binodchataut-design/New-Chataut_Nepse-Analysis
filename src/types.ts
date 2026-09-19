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

export type TabType = 'dashboard' | 'chart' | 'lab' | 'backtest' | 'data';

export interface MarketIndexStatus {
  latestDate: string;
  latestClose: number;
  previousDate: string | null;
  previousClose: number | null;
  pointsChange: number | null;
  percentChangeStored: number | null;
  percentChangeCalculated: number | null;
  rawRows: Array<{
    date: string;
    close: number;
    change_percent: number | null;
    turnover: number | null;
  }>;
}

export interface MarketVolumeTurnover {
  date: string;
  totalVolume: number;
  totalTurnover: number | null;
  turnoverColumnExists: boolean;
  symbolCount: number;
}

export interface SectorStat {
  sector: string;
  advancers: number;
  decliners: number;
  unchanged: number;
  total: number;
}

export interface MarketOverviewData {
  indexStatus: MarketIndexStatus | null;
  indexError?: string;
  volumeTurnover: MarketVolumeTurnover | null;
  volumeError?: string;
  sectorStats: SectorStat[];
  sectorError?: string;
  sectorDate: string | null;
  asOfTimestamp: string;
}

export type SetupType = 'SMA20/50 Bullish Cross' | 'RSI Oversold Recovery';

export interface ScannedSetupMatch {
  symbol: string;
  setupName: SetupType;
  signalDate: string;
  sessionsAgo: number;
  hitRate: number | null;
  successCount: number;
  totalOccurrences: number;
  allOccurrencesCount: number;
  avgForwardReturn: number | null;
}

export interface MarketScanProgress {
  scannedCount: number;
  totalCompanies: number;
  currentSymbol: string;
}

export interface MarketScanResult {
  matches: ScannedSetupMatch[];
  totalCompanies: number;
  scannedCount: number;
  failedCount: number;
  insufficientHistoryCount: number;
  durationMs: number;
  scannedAt: string;
}

export type ExitReason = 'target' | 'stop' | 'expired';

export interface BacktestTrade {
  signalDate: string;
  entryDate: string;
  entryPrice: number;
  exitDate: string;
  exitPrice: number;
  exitReason: ExitReason;
  returnPct: number;
  holdingSessions: number;
}

export interface BacktestResult {
  totalTrades: number;
  excludedTrades: number;
  wins: number;
  losses: number;
  expired: number;
  winRate: number | null;
  avgWinReturn: number | null;
  avgLossReturn: number | null;
  expectancy: number | null;
  trades: BacktestTrade[];
}
