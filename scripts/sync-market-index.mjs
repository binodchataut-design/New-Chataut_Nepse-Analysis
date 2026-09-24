#!/usr/bin/env node

/**
 * scripts/sync-market-index.mjs
 *
 * Daily automated sync for the main NEPSE market index into Supabase `market_index`.
 * Scrapes https://www.sharesansar.com/index.php/market for the day's NEPSE index
 * (date, close, change_percent, turnover) and inserts a new row forward-only.
 *
 * Requirements:
 * - Incremental append only: never overwrites existing rows.
 * - Robust error handling, request timeout, and HTML structure logging.
 * - Isolated execution: does not touch daily_prices or other tables.
 *
 * Environment variables:
 * - SUPABASE_URL (or VITE_SUPABASE_URL)
 * - SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SERVICE_KEY / SUPABASE_KEY / VITE_SUPABASE_ANON_KEY)
 *
 * Usage:
 *   node scripts/sync-market-index.mjs
 *   node scripts/sync-market-index.mjs --dry-run
 *   node scripts/sync-market-index.mjs --html-file=/tmp/market.html
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';

const MARKET_URL = 'https://www.sharesansar.com/index.php/market';
const REQUEST_TIMEOUT_MS = 25000;
const MAX_FETCH_ATTEMPTS = 3;

// Parse command line arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const htmlFileArg = args.find((a) => a.startsWith('--html-file='));
const localHtmlPath = htmlFileArg ? htmlFileArg.split('=')[1] : null;

/**
 * Sleep helper for exponential backoff
 */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Fetch market HTML from sharesansar with timeout and retry
 */
async function fetchMarketPage() {
  if (localHtmlPath) {
    console.log(`[market_index] Reading local HTML file: ${localHtmlPath}`);
    return fs.readFileSync(localHtmlPath, 'utf8');
  }

  const headers = {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    Accept:
      'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Cache-Control': 'no-cache',
    Pragma: 'no-cache',
  };

  let lastError = null;

  for (let attempt = 1; attempt <= MAX_FETCH_ATTEMPTS; attempt++) {
    console.log(
      `[market_index] Fetching ${MARKET_URL} (attempt ${attempt}/${MAX_FETCH_ATTEMPTS})...`
    );

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(MARKET_URL, {
        headers,
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (!response.ok) {
        throw new Error(
          `HTTP status ${response.status} (${response.statusText}) received from ${MARKET_URL}`
        );
      }

      const html = await response.text();
      if (!html || html.length < 500) {
        throw new Error(
          `Received unexpectedly short response (${html ? html.length : 0} bytes) from ${MARKET_URL}`
        );
      }

      console.log(`[market_index] Page fetched successfully (${html.length} bytes).`);
      return html;
    } catch (err) {
      clearTimeout(timer);
      const isAbort = err.name === 'AbortError';
      const msg = isAbort
        ? `Request timed out after ${REQUEST_TIMEOUT_MS}ms`
        : err.message || String(err);
      console.warn(`[market_index] Attempt ${attempt} failed: ${msg}`);
      lastError = err;

      if (attempt < MAX_FETCH_ATTEMPTS) {
        const delay = attempt * 3000;
        console.log(`[market_index] Retrying in ${delay}ms...`);
        await sleep(delay);
      }
    }
  }

  throw new Error(
    `Failed to fetch sharesansar market page after ${MAX_FETCH_ATTEMPTS} attempts. Last error: ${lastError?.message}`
  );
}

/**
 * Clean and parse numeric strings like "2,618.03", "-1.36%", "6,356,611,395.73"
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
 * Parse trading date and NEPSE Index row from the raw HTML.
 */
function parseNepseIndex(html) {
  // 1. Extract Date
  // Pattern 1: <p>As of <span class="text-org">2026-09-23</span></p>
  // Pattern 2: As of ... YYYY-MM-DD
  let date = null;
  const asOfRegex1 = /As\s+of[^\d<]*<span[^>]*>\s*(\d{4}[-/]\d{1,2}[-/]\d{1,2})\s*<\/span>/i;
  const asOfRegex2 = /As\s+of\s*:?\s*(\d{4}[-/]\d{1,2}[-/]\d{1,2})/i;
  const m1 = html.match(asOfRegex1) || html.match(asOfRegex2);

  if (m1) {
    const parts = m1[1].split(/[-/]/);
    if (parts.length === 3) {
      const y = parts[0];
      const m = parts[1].padStart(2, '0');
      const d = parts[2].padStart(2, '0');
      date = `${y}-${m}-${d}`;
    }
  }

  if (!date) {
    // Log snippet around "As of" if present for diagnosis
    const asOfIdx = html.indexOf('As of');
    const diagnostic =
      asOfIdx !== -1
        ? html.slice(Math.max(0, asOfIdx - 50), Math.min(html.length, asOfIdx + 150))
        : 'Keyword "As of" not found anywhere in document.';
    throw new Error(
      `Could not parse market trading date from sharesansar HTML. Context snippet: [${diagnostic}]`
    );
  }

  // 2. Find the Indices table containing "NEPSE Index"
  const tableMatch = html.match(/<table[^>]*>([\s\S]*?NEPSE\s+Index[\s\S]*?)<\/table>/i);
  if (!tableMatch) {
    throw new Error(
      `Could not find table containing "NEPSE Index" in HTML. The site layout may have changed.`
    );
  }
  const tableHtml = tableMatch[0];

  // Extract <th> headers from <thead> if present
  const headers = [];
  const thRegex = /<th[^>]*>([\s\S]*?)<\/th>/gi;
  let thMatch;
  while ((thMatch = thRegex.exec(tableHtml)) !== null) {
    headers.push(thMatch[1].replace(/<[^>]+>/g, '').trim().toLowerCase());
  }

  // Find the table row containing "NEPSE Index"
  const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let trMatch;
  let nepseRowHtml = null;

  while ((trMatch = trRegex.exec(tableHtml)) !== null) {
    const rowContent = trMatch[1];
    // Check that row has "NEPSE Index" and is not a header row
    if (/NEPSE\s+Index/i.test(rowContent) && !/<th/i.test(rowContent)) {
      nepseRowHtml = rowContent;
      break;
    }
  }

  if (!nepseRowHtml) {
    throw new Error(
      `Found Indices table, but could not locate data row for "NEPSE Index".`
    );
  }

  // Extract all <td> cells from the row
  const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
  let tdMatch;
  const cells = [];
  while ((tdMatch = tdRegex.exec(nepseRowHtml)) !== null) {
    cells.push(tdMatch[1].replace(/<[^>]+>/g, '').trim());
  }

  if (cells.length < 5) {
    throw new Error(
      `Expected at least 5 columns in NEPSE Index row, but found ${cells.length}: [${cells.join(
        ', '
      )}]`
    );
  }

  // Header-based mapping if header count matches cell count
  let close = null;
  let changePercent = null;
  let turnover = null;
  let open = null;
  let high = null;
  let low = null;
  let pointChange = null;

  if (headers.length === cells.length) {
    for (let i = 0; i < headers.length; i++) {
      const h = headers[i];
      const val = parseNumeric(cells[i]);
      if (h.includes('close')) close = val;
      else if (h.includes('%') || h.includes('percent')) changePercent = val;
      else if (h.includes('turnover')) turnover = val;
      else if (h.includes('open')) open = val;
      else if (h.includes('high')) high = val;
      else if (h.includes('low')) low = val;
      else if (h.includes('point')) pointChange = val;
    }
  }

  // Positional fallback if any key value was not resolved by headers
  // Standard Sharesansar order:
  // [0] Index, [1] Open, [2] High, [3] Low, [4] Close, [5] Point Change, [6] % Change, [7] Turnover
  if (close === null && cells.length >= 5) {
    open = open ?? parseNumeric(cells[1]);
    high = high ?? parseNumeric(cells[2]);
    low = low ?? parseNumeric(cells[3]);
    close = parseNumeric(cells[4]);
    pointChange = pointChange ?? parseNumeric(cells[5]);
    changePercent = changePercent ?? parseNumeric(cells[6]);
    turnover = turnover ?? (cells.length >= 8 ? parseNumeric(cells[7]) : null);
  }

  // Validation
  if (close === null || close <= 0) {
    throw new Error(
      `Invalid or missing NEPSE Index close value (parsed: ${close}). Raw cells: [${cells.join(
        ', '
      )}]`
    );
  }

  return {
    date,
    close,
    changePercent,
    turnover,
    open,
    high,
    low,
    pointChange,
    rawHeaders: headers,
    rawCells: cells,
  };
}

/**
 * Main execution
 */
async function main() {
  console.log('====================================================');
  console.log('   NEPSE Market Index Daily Sync (Forward-Only)   ');
  console.log('====================================================');
  console.log(`Execution time: ${new Date().toISOString()}`);
  console.log(`Dry run mode:   ${isDryRun ? 'ENABLED' : 'DISABLED'}`);

  // 1. Fetch & Parse
  const html = await fetchMarketPage();
  const parsed = parseNepseIndex(html);

  console.log('\n[market_index] Successfully parsed NEPSE Index:');
  console.log(`  Trading Date:   ${parsed.date}`);
  console.log(`  Close:          ${parsed.close.toFixed(2)}`);
  console.log(
    `  Change %:       ${
      parsed.changePercent !== null ? `${parsed.changePercent.toFixed(2)}%` : 'N/A'
    }`
  );
  console.log(
    `  Turnover (NPR): ${
      parsed.turnover !== null ? parsed.turnover.toLocaleString() : 'N/A'
    }`
  );
  if (parsed.open !== null) console.log(`  Open:           ${parsed.open.toFixed(2)}`);
  if (parsed.high !== null) console.log(`  High:           ${parsed.high.toFixed(2)}`);
  if (parsed.low !== null)  console.log(`  Low:            ${parsed.low.toFixed(2)}`);
  if (parsed.pointChange !== null)
    console.log(`  Point Change:   ${parsed.pointChange.toFixed(2)}`);

  // 2. Initialize Supabase client
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.SUPABASE_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      'Missing Supabase credentials. Ensure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables are set.'
    );
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  // 3. Incremental-append check: Check if date already exists
  console.log(
    `\n[market_index] Checking if row for date ${parsed.date} already exists in database...`
  );
  const { data: existingRows, error: checkError } = await supabase
    .from('market_index')
    .select('date, close, change_percent, turnover')
    .eq('date', parsed.date)
    .limit(1);

  if (checkError) {
    throw new Error(
      `Failed to check existing market_index row for ${parsed.date}: ${checkError.message}`
    );
  }

  if (existingRows && existingRows.length > 0) {
    const existing = existingRows[0];
    console.log(
      `[market_index] Row for date ${parsed.date} ALREADY EXISTS in market_index table.`
    );
    console.log(
      `  Existing: close=${existing.close}, change_percent=${existing.change_percent}%, turnover=${existing.turnover}`
    );
    console.log(
      '[market_index] Incremental-append policy: Skipping insert to never overwrite existing rows.'
    );
    console.log('\n[market_index] Sync finished successfully (up to date).');
    process.exit(0);
  }

  // 4. Prepare row payload
  // market_index table schema: date (string), close (numeric), change_percent (numeric), turnover (numeric)
  const rowPayload = {
    date: parsed.date,
    close: parsed.close,
    change_percent: parsed.changePercent,
    turnover: parsed.turnover,
  };

  if (isDryRun) {
    console.log(
      '\n[market_index] [DRY RUN] Would insert row into market_index table:'
    );
    console.log(JSON.stringify(rowPayload, null, 2));
    console.log('[market_index] [DRY RUN] Finished without modifying database.');
    process.exit(0);
  }

  // 5. Insert row
  console.log(
    `\n[market_index] Inserting new row for ${parsed.date} into market_index...`
  );
  const { data: inserted, error: insertError } = await supabase
    .from('market_index')
    .insert([rowPayload])
    .select();

  if (insertError) {
    throw new Error(
      `Supabase insert failed for date ${parsed.date}: ${insertError.message} (Code: ${insertError.code})`
    );
  }

  console.log(`[market_index] SUCCESS! Row inserted into market_index:`);
  console.log(JSON.stringify(inserted, null, 2));
  console.log('\n[market_index] Sync completed successfully.');
}

main().catch((err) => {
  console.error('\n[market_index] ERROR: Sync process failed.');
  console.error(err.message || err);
  if (err.stack) {
    console.error(err.stack);
  }
  process.exit(1);
});
