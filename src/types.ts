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

export type TabType = 'dashboard' | 'chart' | 'lab' | 'backtest' | 'journal' | 'data';

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

export type MAType = 'SMA' | 'EMA';
export type RSIDirection = 'recovery' | 'breakdown';
export type FilterMode = 'ma_cross' | 'rsi_threshold' | 'candlestick' | 'relative_volume';

export type CandlestickPatternType =
  | 'doji'
  | 'bullish_marubozu'
  | 'bearish_marubozu'
  | 'hammer'
  | 'hanging_man'
  | 'inverted_hammer'
  | 'shooting_star'
  | 'spinning_top'
  | 'bullish_engulfing'
  | 'bearish_engulfing'
  | 'bullish_harami'
  | 'bearish_harami'
  | 'piercing_line'
  | 'dark_cloud_cover'
  | 'tweezer_top'
  | 'tweezer_bottom'
  | 'morning_star'
  | 'evening_star'
  | 'three_white_soldiers'
  | 'three_black_crows'
  | 'three_inside_up'
  | 'three_inside_down';

export const CANDLESTICK_PATTERN_LABELS: Record<CandlestickPatternType, string> = {
  doji: 'Doji',
  bullish_marubozu: 'Bullish Marubozu',
  bearish_marubozu: 'Bearish Marubozu',
  hammer: 'Hammer',
  hanging_man: 'Hanging Man',
  inverted_hammer: 'Inverted Hammer',
  shooting_star: 'Shooting Star',
  spinning_top: 'Spinning Top',
  bullish_engulfing: 'Bullish Engulfing',
  bearish_engulfing: 'Bearish Engulfing',
  bullish_harami: 'Bullish Harami',
  bearish_harami: 'Bearish Harami',
  piercing_line: 'Piercing Line',
  dark_cloud_cover: 'Dark Cloud Cover',
  tweezer_top: 'Tweezer Top',
  tweezer_bottom: 'Tweezer Bottom',
  morning_star: 'Morning Star',
  evening_star: 'Evening Star',
  three_white_soldiers: 'Three White Soldiers',
  three_black_crows: 'Three Black Crows',
  three_inside_up: 'Three Inside Up',
  three_inside_down: 'Three Inside Down',
};

export interface MACrossConfig {
  fastType: MAType;
  fastPeriod: number;
  slowType: MAType;
  slowPeriod: number;
}

export interface RSIThresholdConfig {
  period: number;
  threshold: number;
  direction: RSIDirection;
}

export interface RelativeVolumeConfig {
  threshold: number;
}

export interface SignalFilterConfig {
  mode: FilterMode;
  maCross: MACrossConfig;
  rsiThreshold: RSIThresholdConfig;
  candlestickPattern: CandlestickPatternType;
  relativeVolume: RelativeVolumeConfig;
}

export const DEFAULT_SIGNAL_FILTER_CONFIG: SignalFilterConfig = {
  mode: 'ma_cross',
  maCross: {
    fastType: 'SMA',
    fastPeriod: 20,
    slowType: 'SMA',
    slowPeriod: 50,
  },
  rsiThreshold: {
    period: 14,
    threshold: 30,
    direction: 'recovery',
  },
  candlestickPattern: 'hammer',
  relativeVolume: {
    threshold: 1.5,
  },
};

export type JournalStatus = 'open' | 'closed';

export interface TradeJournalEntry {
  id: string;
  symbol: string;
  entry_date: string;
  entry_price: number;
  exit_date: string | null;
  exit_price: number | null;
  stop_loss: number | null;
  target_price: number | null;
  position_size: number | null;
  setup_type: string | null;
  entry_reason: string;
  lesson_learned: string | null;
  status: JournalStatus;
  created_at: string;
  updated_at: string;
}

export interface CreateJournalEntryInput {
  symbol: string;
  entry_date: string;
  entry_price: number;
  stop_loss?: number | null;
  target_price?: number | null;
  position_size?: number | null;
  setup_type?: string | null;
  entry_reason: string;
  status?: JournalStatus;
}

export interface UpdateJournalEntryInput {
  symbol?: string;
  entry_date?: string;
  entry_price?: number;
  exit_date?: string | null;
  exit_price?: number | null;
  stop_loss?: number | null;
  target_price?: number | null;
  position_size?: number | null;
  setup_type?: string | null;
  entry_reason?: string;
  lesson_learned?: string | null;
  status?: JournalStatus;
}

export interface LiquidityMetrics {
  symbol: string;
  totalSessions: number;
  latestSessionDate: string | null;
  marketLatestDate: string | null;
  daysSinceLastTrade: number | null;
  isStale: boolean; // daysSinceLastTrade !== null && daysSinceLastTrade > 5
  has20SessionHistory: boolean;
  avgVolume20: number | null;
  has60SessionHistory: boolean;
  avgVolume60: number | null;
  liquidityTrendRatio: number | null;
  liquidityTrendDescription: string;
  liquidityTrendDirection: 'rising' | 'fading' | 'neutral' | 'insufficient';
  hasTradeCountColumn: boolean;
  tradeCount20: number | null;
  tradeCount60: number | null;
  tradeCountNote: string;
}

