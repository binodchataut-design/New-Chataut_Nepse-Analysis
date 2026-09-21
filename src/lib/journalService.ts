import { getSupabaseClient } from './supabaseClient';
import {
  TradeJournalEntry,
  CreateJournalEntryInput,
  UpdateJournalEntryInput,
} from '../types';

/**
 * Normalizes a raw Supabase record into a typed TradeJournalEntry.
 */
function normalizeJournalRow(row: Record<string, unknown>): TradeJournalEntry {
  return {
    id: String(row.id),
    symbol: String(row.symbol || '').toUpperCase().trim(),
    entry_date: String(row.entry_date),
    entry_price: Number(row.entry_price ?? 0),
    exit_date: row.exit_date ? String(row.exit_date) : null,
    exit_price: row.exit_price !== null && row.exit_price !== undefined ? Number(row.exit_price) : null,
    stop_loss: row.stop_loss !== null && row.stop_loss !== undefined ? Number(row.stop_loss) : null,
    target_price: row.target_price !== null && row.target_price !== undefined ? Number(row.target_price) : null,
    position_size: row.position_size !== null && row.position_size !== undefined ? Number(row.position_size) : null,
    setup_type: row.setup_type ? String(row.setup_type) : null,
    entry_reason: String(row.entry_reason || ''),
    lesson_learned: row.lesson_learned ? String(row.lesson_learned) : null,
    status: row.status === 'closed' ? 'closed' : 'open',
    created_at: String(row.created_at || new Date().toISOString()),
    updated_at: String(row.updated_at || new Date().toISOString()),
  };
}

/**
 * Fetches all journal entries ordered by entry_date descending, then created_at descending.
 * Throws on Supabase error.
 */
export async function getJournalEntries(): Promise<TradeJournalEntry[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('trade_journal')
    .select('*')
    .order('entry_date', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch journal entries from Supabase: ${error.message}`);
  }

  return (data || []).map(normalizeJournalRow);
}

/**
 * Inserts a new journal entry. Status defaults to 'open'.
 * Throws on Supabase error.
 */
export async function createJournalEntry(
  entry: CreateJournalEntryInput
): Promise<TradeJournalEntry> {
  const supabase = getSupabaseClient();

  const payload: Record<string, unknown> = {
    symbol: entry.symbol.toUpperCase().trim(),
    entry_date: entry.entry_date,
    entry_price: entry.entry_price,
    stop_loss: entry.stop_loss ?? null,
    target_price: entry.target_price ?? null,
    position_size: entry.position_size ?? null,
    setup_type: entry.setup_type ? entry.setup_type.trim() : null,
    entry_reason: entry.entry_reason.trim(),
    status: entry.status || 'open',
    exit_date: null,
    exit_price: null,
    lesson_learned: null,
  };

  const { data, error } = await supabase
    .from('trade_journal')
    .insert([payload])
    .select('*')
    .single();

  if (error) {
    throw new Error(`Failed to create journal entry for ${entry.symbol}: ${error.message}`);
  }

  return normalizeJournalRow(data);
}

/**
 * Closes an open trade entry with exit details and marks status as 'closed'.
 * Throws on Supabase error.
 */
export async function closeJournalEntry(
  id: string,
  exitDate: string,
  exitPrice: number,
  lessonLearned?: string | null
): Promise<TradeJournalEntry> {
  const supabase = getSupabaseClient();

  const payload: Record<string, unknown> = {
    exit_date: exitDate,
    exit_price: exitPrice,
    lesson_learned: lessonLearned && lessonLearned.trim() ? lessonLearned.trim() : null,
    status: 'closed',
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('trade_journal')
    .update(payload)
    .eq('id', id)
    .select('*')
    .single();

  if (error) {
    throw new Error(`Failed to close journal entry (${id}): ${error.message}`);
  }

  return normalizeJournalRow(data);
}

/**
 * Updates any field of an existing journal entry.
 * Throws on Supabase error.
 */
export async function updateJournalEntry(
  id: string,
  fields: UpdateJournalEntryInput
): Promise<TradeJournalEntry> {
  const supabase = getSupabaseClient();

  const payload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (fields.symbol !== undefined) payload.symbol = fields.symbol.toUpperCase().trim();
  if (fields.entry_date !== undefined) payload.entry_date = fields.entry_date;
  if (fields.entry_price !== undefined) payload.entry_price = fields.entry_price;
  if (fields.exit_date !== undefined) payload.exit_date = fields.exit_date;
  if (fields.exit_price !== undefined) payload.exit_price = fields.exit_price;
  if (fields.stop_loss !== undefined) payload.stop_loss = fields.stop_loss;
  if (fields.target_price !== undefined) payload.target_price = fields.target_price;
  if (fields.position_size !== undefined) payload.position_size = fields.position_size;
  if (fields.setup_type !== undefined) payload.setup_type = fields.setup_type ? fields.setup_type.trim() : null;
  if (fields.entry_reason !== undefined) payload.entry_reason = fields.entry_reason.trim();
  if (fields.lesson_learned !== undefined) payload.lesson_learned = fields.lesson_learned ? fields.lesson_learned.trim() : null;
  if (fields.status !== undefined) payload.status = fields.status;

  const { data, error } = await supabase
    .from('trade_journal')
    .update(payload)
    .eq('id', id)
    .select('*')
    .single();

  if (error) {
    throw new Error(`Failed to update journal entry (${id}): ${error.message}`);
  }

  return normalizeJournalRow(data);
}

/**
 * Deletes a journal entry by ID.
 * Throws on Supabase error.
 */
export async function deleteJournalEntry(id: string): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from('trade_journal').delete().eq('id', id);

  if (error) {
    throw new Error(`Failed to delete journal entry (${id}): ${error.message}`);
  }
}

/* ==========================================================================
   DERIVED CALCULATIONS — NEVER STORED IN DATABASE
   ========================================================================== */

/**
 * Computes return percentage for a closed trade:
 * Return % = ((exit_price - entry_price) / entry_price) * 100
 * Returns null if trade is not closed or entry price is invalid.
 */
export function calculateTradeReturn(entry: TradeJournalEntry): number | null {
  if (entry.status !== 'closed' || entry.exit_price === null || entry.entry_price <= 0) {
    return null;
  }
  return ((entry.exit_price - entry.entry_price) / entry.entry_price) * 100;
}

/**
 * Returns derived 'Win' | 'Loss' | null for a trade.
 * Win: return > 0
 * Loss: return <= 0
 */
export function getTradeOutcome(entry: TradeJournalEntry): 'Win' | 'Loss' | null {
  const ret = calculateTradeReturn(entry);
  if (ret === null) return null;
  return ret > 0 ? 'Win' : 'Loss';
}

/**
 * Computes calendar holding days between entry_date and exit_date.
 * Returns null if trade has no exit_date.
 */
export function calculateHoldingDays(entry: TradeJournalEntry): number | null {
  if (!entry.exit_date || !entry.entry_date) return null;
  const start = new Date(entry.entry_date).getTime();
  const end = new Date(entry.exit_date).getTime();
  if (isNaN(start) || isNaN(end)) return null;
  const diff = Math.round((end - start) / (1000 * 60 * 60 * 24));
  return Math.max(0, diff);
}

/**
 * Computes summary statistics for closed and open trades.
 */
export interface JournalSummaryStats {
  totalOpen: number;
  totalClosed: number;
  winCount: number;
  lossCount: number;
  winRate: number | null; // e.g. 50.0 (%) or null if no closed trades
}

export function computeJournalSummary(entries: TradeJournalEntry[]): JournalSummaryStats {
  let totalOpen = 0;
  let totalClosed = 0;
  let winCount = 0;
  let lossCount = 0;

  for (const entry of entries) {
    if (entry.status === 'open') {
      totalOpen++;
    } else if (entry.status === 'closed') {
      totalClosed++;
      const outcome = getTradeOutcome(entry);
      if (outcome === 'Win') {
        winCount++;
      } else if (outcome === 'Loss') {
        lossCount++;
      }
    }
  }

  const winRate = totalClosed > 0 ? (winCount / totalClosed) * 100 : null;

  return {
    totalOpen,
    totalClosed,
    winCount,
    lossCount,
    winRate,
  };
}
