// Incremental daily sync: Aabishkar2/nepse-data (GitHub, auto-updated) -> Supabase daily_prices
//
// Design notes (why it's built this way):
// - Only APPENDS rows newer than what's already in Supabase per symbol. It never backfills
//   a symbol that has zero existing rows -- that's a deliberate choice, not an oversight,
//   so a daily job can never silently mass-import history. Symbols with no baseline are
//   reported, not guessed at.
// - Reuses the exact daily_prices columns confirmed via introspection in Phase 13:
//   id, symbol, date, open, high, low, close, volume, per_change, possible_corporate_action,
//   created_at. traded_amount (turnover) from the source is intentionally dropped -- Phase 5
//   already confirmed daily_prices has no turnover column, so this stays consistent with that.
// - Every number in the final summary is a real count, not a guess: symbols processed,
//   symbols with no match in the source, symbols with no existing Supabase baseline,
//   rows actually inserted, and hard failures. Same honesty standard as the rest of this app.

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SOURCE_BASE = 'https://raw.githubusercontent.com/Aabishkar2/nepse-data/main/data/company-wise';
const CONCURRENCY = 8;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variable.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function parseCsv(text) {
  const lines = text.trim().split('\n');
  const header = lines[0].split(',');
  return lines.slice(1).map((line) => {
    const cols = line.split(',');
    const row = {};
    header.forEach((h, i) => { row[h.trim()] = cols[i]; });
    return row;
  });
}

async function getAllCompanySymbols() {
  const symbols = [];
  let from = 0;
  const pageSize = 1000;
  while (true) {
    const { data, error } = await supabase
      .from('companies')
      .select('symbol')
      .range(from, from + pageSize - 1);
    if (error) throw new Error(`Failed to fetch companies: ${error.message}`);
    if (!data || data.length === 0) break;
    symbols.push(...data.map((r) => r.symbol));
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return symbols;
}

const REQUEST_TIMEOUT_MS = 15000;

function withTimeout(promise, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${REQUEST_TIMEOUT_MS / 1000}s`)), REQUEST_TIMEOUT_MS)
    ),
  ]);
}

async function getLastDateForSymbol(symbol) {
  const { data, error } = await withTimeout(
    supabase
      .from('daily_prices')
      .select('date')
      .eq('symbol', symbol)
      .order('date', { ascending: false })
      .limit(1),
    `Lookup for ${symbol}`
  );
  if (error) throw new Error(`Lookup failed for ${symbol}: ${error.message}`);
  return data && data.length > 0 ? data[0].date : null;
}

async function fetchSourceCsv(symbol) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(`${SOURCE_BASE}/${encodeURIComponent(symbol)}.csv`, { signal: controller.signal });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Source fetch failed for ${symbol}: HTTP ${res.status}`);
    return parseCsv(await res.text());
  } finally {
    clearTimeout(timer);
  }
}

async function syncSymbol(symbol, stats) {
  try {
    const lastDate = await getLastDateForSymbol(symbol);
    if (lastDate === null) {
      stats.noBaseline.push(symbol);
      return;
    }

    const sourceRows = await fetchSourceCsv(symbol);
    if (sourceRows === null) {
      stats.noSourceMatch.push(symbol);
      return;
    }

    const newRows = sourceRows
      .filter((r) => r.published_date && r.published_date > lastDate)
      .map((r) => ({
        symbol,
        date: r.published_date,
        open: r.open === '' || r.open === undefined ? null : Number(r.open),
        high: r.high === '' || r.high === undefined ? null : Number(r.high),
        low: r.low === '' || r.low === undefined ? null : Number(r.low),
        close: r.close === '' || r.close === undefined ? null : Number(r.close),
        volume: r.traded_quantity === '' || r.traded_quantity === undefined ? null : Number(r.traded_quantity),
        per_change: r.per_change === 'nan' || r.per_change === '' || r.per_change === undefined ? null : Number(r.per_change),
      }));

    if (newRows.length === 0) {
      stats.upToDate.push(symbol);
      return;
    }

    const { error } = await withTimeout(
      supabase.from('daily_prices').upsert(newRows, { onConflict: 'symbol,date' }),
      `Upsert for ${symbol}`
    );
    if (error) throw new Error(`Upsert failed for ${symbol}: ${error.message}`);

    stats.updated.push({ symbol, rowsAdded: newRows.length, latestDate: newRows[newRows.length - 1].date });
  } catch (err) {
    stats.errors.push({ symbol, message: err.message });
  }
}

async function runWithConcurrency(items, limit, worker) {
  let index = 0;
  async function next() {
    while (index < items.length) {
      const i = index++;
      await worker(items[i]);
    }
  }
  await Promise.all(Array.from({ length: limit }, next));
}

async function main() {
  console.log(`Starting NEPSE daily_prices sync at ${new Date().toISOString()}`);
  const symbols = await getAllCompanySymbols();
  console.log(`Loaded ${symbols.length} symbols from companies table.`);

  const stats = { updated: [], upToDate: [], noSourceMatch: [], noBaseline: [], errors: [] };
  await runWithConcurrency(symbols, CONCURRENCY, (symbol) => syncSymbol(symbol, stats));

  const totalRowsAdded = stats.updated.reduce((sum, u) => sum + u.rowsAdded, 0);

  console.log('\n=== Sync Summary (real counts, not estimates) ===');
  console.log(`Symbols processed: ${symbols.length}`);
  console.log(`Symbols updated: ${stats.updated.length} (${totalRowsAdded} total rows added)`);
  console.log(`Symbols already up to date: ${stats.upToDate.length}`);
  console.log(`Symbols with no match in source repo: ${stats.noSourceMatch.length}`);
  console.log(`Symbols with no existing Supabase baseline (skipped, not backfilled): ${stats.noBaseline.length}`);
  console.log(`Hard errors: ${stats.errors.length}`);

  if (stats.updated.length > 0) {
    console.log('\nUpdated symbols:');
    stats.updated.forEach((u) => console.log(`  ${u.symbol}: +${u.rowsAdded} rows, latest ${u.latestDate}`));
  }
  if (stats.noSourceMatch.length > 0) {
    console.log('\nNo match in source (symbol naming mismatch or not covered by source):');
    console.log(`  ${stats.noSourceMatch.join(', ')}`);
  }
  if (stats.noBaseline.length > 0) {
    console.log('\nNo existing baseline in Supabase (not touched -- needs manual backfill if desired):');
    console.log(`  ${stats.noBaseline.join(', ')}`);
  }
  if (stats.errors.length > 0) {
    console.log('\nErrors:');
    stats.errors.forEach((e) => console.log(`  ${e.symbol}: ${e.message}`));
    process.exitCode = 1; // mark the Action run as failed so you notice
  }
}

main().catch((err) => {
  console.error('Sync script crashed:', err);
  process.exit(1);
});
