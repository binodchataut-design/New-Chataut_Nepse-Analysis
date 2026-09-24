#!/usr/bin/env node

/**
 * scripts/backfill-market-index.mjs
 *
 * Historical backfill script for the main NEPSE market index in Supabase `market_index`.
 * Queries https://www.sharesansar.com/datewise-indices day by day for historical trading days.
 *
 * Design & Constraints:
 * - Separate, one-off utility (does not modify daily sync scripts/sync-market-index.mjs).
 * - Forward-only daily sync remains untouched.
 * - Confirmed request format:
 *     GET https://www.sharesansar.com/datewise-indices?date=YYYY-MM-DD
 *     Header: 'X-Requested-With': 'XMLHttpRequest'
 * - Resumable: Preloads existing dates from `market_index` into an in-memory Set; skips
 *   already present dates instantly without making redundant HTTP requests.
 * - Incremental append only: never overwrites existing rows.
 * - Respectful rate limiting: minimum 2000ms delay between network requests; no concurrency.
 * - Handles non-trading days (holidays/weekends) gracefully.
 * - Collects and reports failed dates at the end.
 *
 * Usage:
 *   node scripts/backfill-market-index.mjs --from=2020-01-01 --to=2020-01-31
 *   node scripts/backfill-market-index.mjs --from=2015-01-01 --to=2015-12-31 --dry-run
 *   node scripts/backfill-market-index.mjs --from=2011-01-01 --limit=50
 */

import { createClient } from '@supabase/supabase-js';

const BASE_URL = 'https://www.sharesansar.com/datewise-indices';
const MIN_DELAY_MS = 2000;
const REQUEST_TIMEOUT_MS = 25000;
const MAX_ATTEMPTS = 3;

// Parse command line arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');

const getArgValue = (prefix) => {
  const match = args.find((a) => a.startsWith(prefix));
  return match ? match.split('=')[1] : null;
};

const fromArg = getArgValue('--from=');
const toArg = getArgValue('--to=');
const limitArg = getArgValue('--limit=');
const delayArg = getArgValue('--delay=');

const configuredDelay = delayArg ? parseInt(delayArg, 10) : MIN_DELAY_MS;
const delayMs = Math.max(MIN_DELAY_MS, isNaN(configuredDelay) ? MIN_DELAY_MS : configuredDelay);
const maxLimit = limitArg ? parseInt(limitArg, 10) : Infinity;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Clean and parse numeric strings like "1,284.23", "-1.65%", "893,677,000.00"
 */
function parseNumeric(val) {
  if (val === null || val === undefined) return null;
  const cleaned = String(val)
    .replace(/,/g, '')
    .replace(/%/g, '')
    .trim();
  if (!cleaned) return null;
  const num = parseFloat(cleaned);
  return Number.isFinite(num) ? num : null;
}

/**
 * Parse datewise-indices AJAX HTML response for a given trading day
 */
export function parseDatewiseHtml(html, expectedDate) {
  // 1. Check for explicit "No Record Found" (holiday or market closure)
  if (/No\s+Record\s+Found/i.test(html)) {
    return {
      isTradingDay: false,
      date: expectedDate,
      reason: 'No record found (market closed / holiday)',
    };
  }

  // 2. Parse As of date if present in HTML
  let parsedDate = expectedDate;
  const asOfMatch =
    html.match(/As\s+of\s*:?\s*<span[^>]*>\s*(\d{4}[-/]\d{1,2}[-/]\d{1,2})\s*<\/span>/i) ||
    html.match(/As\s+of\s*:?\s*(\d{4}[-/]\d{1,2}[-/]\d{1,2})/i);

  if (asOfMatch) {
    const parts = asOfMatch[1].split(/[-/]/);
    if (parts.length === 3) {
      const y = parts[0];
      const m = parts[1].padStart(2, '0');
      const d = parts[2].padStart(2, '0');
      parsedDate = `${y}-${m}-${d}`;
    }
  }

  // 3. Find row containing "NEPSE Index"
  // Format: <tr ...> <td>NEPSE Index </td> <td class="text-center">1,284.23</td> ... </tr>
  const rowMatch = html.match(/<tr[^>]*>[\s\S]*?<td>\s*NEPSE\s+Index\s*<\/td>([\s\S]*?)<\/tr>/i);

  if (!rowMatch) {
    if (!html.includes('<table')) {
      throw new Error(`Unexpected response without table structure: ${html.slice(0, 200)}`);
    }
    return {
      isTradingDay: false,
      date: parsedDate,
      reason: 'NEPSE Index row not present in table',
    };
  }

  // Extract all <td> cells
  const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
  let cellMatch;
  const cells = [];
  while ((cellMatch = cellRegex.exec(rowMatch[1])) !== null) {
    cells.push(cellMatch[1].replace(/<[^>]+>/g, '').trim());
  }

  if (cells.length < 3) {
    throw new Error(`Incomplete cells in NEPSE Index row: ${JSON.stringify(cells)}`);
  }

  // Standard datewise-indices table format:
  // [0] Current (Close price), [1] Point Change, [2] % Change, [3] Turnover
  const close = parseNumeric(cells[0]);
  const pointChange = parseNumeric(cells[1]);
  const changePercent = parseNumeric(cells[2]);
  const turnover = cells.length >= 4 ? parseNumeric(cells[3]) : null;

  if (close === null || close <= 0) {
    throw new Error(`Invalid close index value (${close}) in cells: ${JSON.stringify(cells)}`);
  }

  return {
    isTradingDay: true,
    date: parsedDate,
    close,
    pointChange,
    changePercent,
    turnover,
    rawCells: cells,
  };
}

/**
 * Fetch datewise indices with timeout and retry
 */
async function fetchDatewise(dateStr) {
  const url = `${BASE_URL}?date=${dateStr}`;
  const headers = {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'X-Requested-With': 'XMLHttpRequest',
    Accept: 'text/html, */*; q=0.01',
    'Accept-Language': 'en-US,en;q=0.9',
    Referer: BASE_URL,
  };

  let lastError = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const res = await fetch(url, {
        headers,
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (!res.ok) {
        throw new Error(`HTTP status ${res.status} (${res.statusText})`);
      }

      const html = await res.text();
      return html;
    } catch (err) {
      clearTimeout(timer);
      const isAbort = err.name === 'AbortError';
      const msg = isAbort ? `Request timed out after ${REQUEST_TIMEOUT_MS}ms` : err.message;
      lastError = err;

      if (attempt < MAX_ATTEMPTS) {
        const backoff = attempt * 2000;
        console.warn(`    [Attempt ${attempt}/${MAX_ATTEMPTS} failed for ${dateStr}: ${msg}. Retrying in ${backoff}ms...]`);
        await sleep(backoff);
      }
    }
  }

  throw new Error(`Failed after ${MAX_ATTEMPTS} attempts: ${lastError?.message}`);
}

/**
 * Fetch all existing dates from Supabase `market_index` into an in-memory Set
 */
async function loadExistingDates(supabase) {
  console.log('[backfill] Pre-loading existing market_index dates from database...');
  const existing = new Set();
  let from = 0;
  const pageSize = 1000;

  while (true) {
    const { data, error } = await supabase
      .from('market_index')
      .select('date')
      .order('date', { ascending: true })
      .range(from, from + pageSize - 1);

    if (error) {
      throw new Error(`Failed to load existing dates: ${error.message}`);
    }

    if (!data || data.length === 0) break;

    for (const r of data) {
      if (r.date) existing.add(String(r.date));
    }

    if (data.length < pageSize) break;
    from += pageSize;
  }

  console.log(`[backfill] Loaded ${existing.size} existing dates from market_index.`);
  return existing;
}

/**
 * Generate candidate dates between start and end (inclusive),
 * filtering out Friday (5) and Saturday (6) since NEPSE trades Sunday through Thursday.
 */
function generateTradingDays(startDateStr, endDateStr) {
  const dates = [];
  const curr = new Date(`${startDateStr}T00:00:00Z`);
  const end = new Date(`${endDateStr}T00:00:00Z`);

  while (curr <= end) {
    const dayOfWeek = curr.getUTCDay(); // 0 = Sun, 1 = Mon, ..., 4 = Thu, 5 = Fri, 6 = Sat
    if (dayOfWeek !== 5 && dayOfWeek !== 6) {
      dates.push(curr.toISOString().split('T')[0]);
    }
    curr.setUTCDate(curr.getUTCDate() + 1);
  }

  return dates;
}

async function main() {
  console.log('====================================================');
  console.log('    NEPSE market_index Historical Backfill Tool     ');
  console.log('====================================================');
  console.log(`Execution time: ${new Date().toISOString()}`);
  console.log(`Rate limit delay: ${delayMs}ms per request`);
  console.log(`Dry-run mode:    ${isDryRun ? 'ENABLED' : 'DISABLED'}`);

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.SUPABASE_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variable.');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const existingDates = await loadExistingDates(supabase);

  // Determine date bounds
  // If not provided:
  // - startDate defaults to '2011-01-01'
  // - endDate defaults to earliest date in existingDates or today
  let startDateStr = fromArg;
  let endDateStr = toArg;

  if (!startDateStr) {
    startDateStr = '2011-01-01';
  }

  if (!endDateStr) {
    // If we have existing dates, pick the earliest one as default end date
    const sortedExisting = Array.from(existingDates).sort();
    if (sortedExisting.length > 0) {
      endDateStr = sortedExisting[0];
    } else {
      endDateStr = new Date().toISOString().split('T')[0];
    }
  }

  console.log(`\n[backfill] Date range: ${startDateStr} to ${endDateStr}`);
  const candidateDays = generateTradingDays(startDateStr, endDateStr);
  console.log(`[backfill] Found ${candidateDays.length} potential trading days (Sun-Thu).`);

  const pendingDays = candidateDays.filter((d) => !existingDates.has(d));
  console.log(
    `[backfill] ${candidateDays.length - pendingDays.length} days already exist in database.`
  );
  console.log(`[backfill] ${pendingDays.length} days pending processing.`);

  const daysToProcess = pendingDays.slice(0, maxLimit);
  if (daysToProcess.length < pendingDays.length) {
    console.log(`[backfill] Processing limited to ${daysToProcess.length} days via --limit flag.`);
  }

  const stats = {
    totalEvaluated: 0,
    inserted: 0,
    skippedHolidays: 0,
    alreadyExisted: candidateDays.length - pendingDays.length,
    errors: [],
  };

  for (let i = 0; i < daysToProcess.length; i++) {
    const dateStr = daysToProcess[i];
    stats.totalEvaluated++;
    const progress = `[${i + 1}/${daysToProcess.length}]`;

    try {
      process.stdout.write(`[backfill] ${progress} ${dateStr}: Fetching... `);
      const html = await fetchDatewise(dateStr);
      const parsed = parseDatewiseHtml(html, dateStr);

      if (!parsed.isTradingDay) {
        console.log(`Closed/Holiday (${parsed.reason})`);
        stats.skippedHolidays++;
      } else {
        const changeStr =
          parsed.changePercent !== null ? `${parsed.changePercent.toFixed(2)}%` : 'N/A';
        const turnoverStr =
          parsed.turnover !== null ? parsed.turnover.toLocaleString() : 'N/A';

        if (isDryRun) {
          console.log(
            `[DRY RUN] Parsed: close=${parsed.close}, change=${changeStr}, turnover=${turnoverStr}`
          );
          stats.inserted++;
        } else {
          const payload = {
            date: parsed.date,
            close: parsed.close,
            change_percent: parsed.changePercent,
            turnover: parsed.turnover,
          };

          const { error: insertError } = await supabase.from('market_index').insert([payload]);

          if (insertError) {
            throw new Error(`Database insert failed: ${insertError.message}`);
          }

          existingDates.add(parsed.date);
          stats.inserted++;
          console.log(
            `INSERTED: close=${parsed.close}, change=${changeStr}, turnover=${turnoverStr}`
          );
        }
      }
    } catch (err) {
      console.log(`FAILED: ${err.message}`);
      stats.errors.push({ date: dateStr, error: err.message });
    }

    // Rate-limiting delay before the next request
    if (i < daysToProcess.length - 1) {
      await sleep(delayMs);
    }
  }

  console.log('\n====================================================');
  console.log('             Backfill Run Summary                   ');
  console.log('====================================================');
  console.log(`Evaluated in this run:  ${stats.totalEvaluated}`);
  console.log(`Rows newly inserted:    ${stats.inserted}`);
  console.log(`Non-trading/holidays:   ${stats.skippedHolidays}`);
  console.log(`Already in database:    ${stats.alreadyExisted}`);
  console.log(`Failed dates count:     ${stats.errors.length}`);

  if (stats.errors.length > 0) {
    console.log('\nFailed dates for review:');
    stats.errors.forEach((e) => console.log(`  - ${e.date}: ${e.error}`));
  }

  console.log('\n[backfill] Script execution finished.');
}

// Only run main if executed directly from CLI
if (process.argv[1] && process.argv[1].endsWith('backfill-market-index.mjs')) {
  main().catch((err) => {
    console.error('[backfill] Fatal error:', err);
    process.exit(1);
  });
}
