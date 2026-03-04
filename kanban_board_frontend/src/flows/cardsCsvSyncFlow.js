import { getSupabaseClient } from '../kanbanSupabase';

/**
 * Flow name: CardsCsvRoundTripSyncFlow
 *
 * This module provides a round-trip safe CSV export/import format for kanban cards.
 *
 * Round-trip invariants:
 * - Every exported row contains `id` (card id) and `column_id` (the canonical column mapping).
 * - Re-import uses "upsert by id" (primary key) so rows update existing cards deterministically.
 * - Import preserves IDs and column mapping unless the CSV explicitly changes them.
 * - Unknown columns in CSV are ignored (forward-compatibility).
 *
 * Failure modes (top):
 * 1) Invalid CSV (missing required fields like `feature` or invalid UUID for `id`): surfaced as user-facing error.
 * 2) Supabase API error (RLS, schema mismatch, invalid foreign key `column_id`): surfaced with context.
 * 3) File read errors: surfaced as user-facing error.
 */

// Keep this list aligned with Supabase schema + app usage.
// We intentionally include `id` and `column_id` for round-trip safety.
const CSV_FIELDS_IN_ORDER = [
  'id',
  'column_id',
  'position',
  'feature',
  'description',
  'assignee',
  'notes',
  'priority',
  'status',
  'due_date',
];

/**
 * Best-effort structured logging helper. Keeps logs searchable and consistent.
 */
function log(flow, level, message, ctx = {}) {
  // eslint-disable-next-line no-console
  const fn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
  fn(`[${flow}] ${message}`, ctx);
}

/**
 * Parse a CSV line with basic RFC4180 support for quoted fields and escaped quotes.
 * Contract:
 * - Input: string line
 * - Output: array of strings (unescaped)
 * - Errors: never throws; returns best-effort parse
 */
function parseCsvLine(line) {
  const out = [];
  let cur = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];

    if (inQuotes) {
      if (ch === '"') {
        const next = line[i + 1];
        if (next === '"') {
          cur += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else {
      if (ch === ',') {
        out.push(cur);
        cur = '';
      } else if (ch === '"') {
        inQuotes = true;
      } else {
        cur += ch;
      }
    }
  }
  out.push(cur);
  return out;
}

/**
 * Escape a value for CSV. Always returns a string.
 */
function csvEscape(value) {
  if (value == null) return '';
  const s = String(value);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/**
 * Convert array of objects to CSV text with explicit header ordering.
 * Contract:
 * - Inputs:
 *   - rows: Array<object>
 *   - fieldsInOrder: Array<string> header order
 * - Output: CSV string with \r\n line endings for compatibility
 */
function objectsToCsv(rows, fieldsInOrder) {
  const header = fieldsInOrder.join(',');
  const lines = (rows || []).map((row) =>
    fieldsInOrder.map((k) => csvEscape(row?.[k])).join(',')
  );
  return [header, ...lines].join('\r\n') + '\r\n';
}

/**
 * Parse CSV text into rows keyed by header.
 * Contract:
 * - Input: csvText string
 * - Output: { header: string[], rows: object[] }
 * - Errors: throws with actionable message if missing header
 */
function csvToObjects(csvText) {
  const normalized = String(csvText || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = normalized.split('\n').filter((l) => l.length > 0);

  if (lines.length === 0) {
    throw new Error('CSV file is empty.');
  }

  const header = parseCsvLine(lines[0]).map((h) => String(h || '').trim());
  if (!header.length || header.every((h) => !h)) {
    throw new Error('CSV header row is missing or empty.');
  }

  const rows = [];
  for (let i = 1; i < lines.length; i += 1) {
    const values = parseCsvLine(lines[i]);
    const obj = {};
    for (let c = 0; c < header.length; c += 1) {
      const key = header[c];
      if (!key) continue;
      obj[key] = values[c] ?? '';
    }
    rows.push(obj);
  }

  return { header, rows };
}

/**
 * Normalize a CSV row into a kanban_cards upsert payload.
 * Contract:
 * - Input: raw row object (string values)
 * - Output: { payload, warnings[] }
 * - Errors: throws for invalid required fields.
 */
function normalizeCardRow(raw) {
  const warnings = [];
  const pick = (k) => (raw?.[k] == null ? '' : String(raw[k]).trim());

  const id = pick('id') || null;
  const column_id = pick('column_id') || null;

  // Required by DB
  const feature = pick('feature');
  if (!feature) {
    throw new Error('Row is missing required field "feature".');
  }

  // Required by DB (NOT NULL). If missing, we default to 1 and warn.
  // Import will then allow user to reorder later.
  let position = pick('position');
  if (!position) {
    warnings.push('Missing "position"; defaulted to 1.');
    position = '1';
  }
  const positionNum = Number(position);
  if (!Number.isFinite(positionNum) || positionNum < 1) {
    throw new Error(`Invalid "position" value: ${position}. Expected a positive number.`);
  }

  // Optional fields
  const description = pick('description') || null;
  const assignee = pick('assignee') || null;
  const notes = pick('notes') || null;
  const priority = pick('priority') || null;
  const status = pick('status') || null;

  // due_date: allow blank; otherwise expect yyyy-mm-dd (Supabase date).
  const due_date_raw = pick('due_date');
  let due_date = null;
  if (due_date_raw) {
    // Very lightweight validation; backend will enforce date coercion.
    if (!/^\d{4}-\d{2}-\d{2}$/.test(due_date_raw)) {
      throw new Error(`Invalid "due_date" value: ${due_date_raw}. Expected yyyy-mm-dd or blank.`);
    }
    due_date = due_date_raw;
  }

  const payload = {
    // id may be null: if omitted, upsert-by-id would not be safe.
    // For round-trip sync we REQUIRE id; we validate this in the flow boundary.
    id,
    column_id,
    position: positionNum,
    feature,
    description,
    assignee,
    notes,
    priority,
    status,
    due_date,
  };

  return { payload, warnings };
}

/**
 * PUBLIC_INTERFACE
 * exportCardsToCsv
 *
 * Contract:
 * - Inputs:
 *   - cards: Array of kanban_cards records
 * - Output:
 *   - { filename: string, csvText: string }
 * - Side effects:
 *   - none (caller triggers download)
 */
export function exportCardsToCsv(cards) {
  const flow = 'CardsCsvRoundTripSyncFlow.export';
  log(flow, 'info', 'start', { cardCount: (cards || []).length });

  const rows = (cards || []).map((c) => {
    const row = {};
    CSV_FIELDS_IN_ORDER.forEach((k) => {
      row[k] = c?.[k] ?? '';
    });
    return row;
  });

  // Stable filename helps debugging artifacts and sharing.
  const datePart = new Date().toISOString().slice(0, 10);
  const filename = `kanban_cards_export_${datePart}.csv`;
  const csvText = objectsToCsv(rows, CSV_FIELDS_IN_ORDER);

  log(flow, 'info', 'success', { filename, bytes: csvText.length });
  return { filename, csvText };
}

/**
 * PUBLIC_INTERFACE
 * syncCardsFromCsvText
 *
 * Contract:
 * - Inputs:
 *   - csvText: string (must include `id` and `column_id` columns in header)
 * - Output:
 *   - result: {
 *        totalRows: number,
 *        upserted: number,
 *        warnings: string[],
 *      }
 * - Errors:
 *   - throws Error with user-friendly message for validation or Supabase failures.
 * - Side effects:
 *   - writes to Supabase `kanban_cards` via bulk upsert (onConflict: 'id')
 */
export async function syncCardsFromCsvText(csvText) {
  const flow = 'CardsCsvRoundTripSyncFlow.import';
  log(flow, 'info', 'start');

  const { header, rows } = csvToObjects(csvText);

  const headerSet = new Set(header.map((h) => String(h || '').trim()));
  if (!headerSet.has('id')) {
    throw new Error('CSV is missing required column "id". Export a CSV from this app to ensure round-trip compatibility.');
  }
  if (!headerSet.has('column_id')) {
    throw new Error(
      'CSV is missing required column "column_id". Export a CSV from this app to preserve column mapping.'
    );
  }

  const warnings = [];
  const payloads = [];
  rows.forEach((raw, idx) => {
    const rowNum = idx + 2; // header is line 1
    const id = raw?.id == null ? '' : String(raw.id).trim();
    if (!id) {
      throw new Error(`Row ${rowNum}: missing required "id".`);
    }
    const colId = raw?.column_id == null ? '' : String(raw.column_id).trim();
    if (!colId) {
      throw new Error(`Row ${rowNum}: missing required "column_id".`);
    }

    try {
      const { payload, warnings: rowWarns } = normalizeCardRow(raw);
      payloads.push(payload);
      rowWarns.forEach((w) => warnings.push(`Row ${rowNum}: ${w}`));
    } catch (e) {
      throw new Error(`Row ${rowNum}: ${e.message || e}`);
    }
  });

  if (payloads.length === 0) {
    throw new Error('No data rows found in CSV.');
  }

  const supabase = getSupabaseClient();

  log(flow, 'info', 'upsert.begin', { rows: payloads.length });
  const { data, error } = await supabase
    .from('kanban_cards')
    .upsert(payloads, {
      onConflict: 'id',
      ignoreDuplicates: false,
      // defaultCount is not consistently returned; rely on `data` length if present.
    })
    .select('id');

  if (error) {
    log(flow, 'error', 'upsert.failed', { message: error.message, details: error.details, hint: error.hint });
    throw new Error(`Supabase upsert failed: ${error.message || 'unknown error'}`);
  }

  const upserted = Array.isArray(data) ? data.length : payloads.length;
  log(flow, 'info', 'success', { totalRows: payloads.length, upserted, warnings: warnings.length });

  return {
    totalRows: payloads.length,
    upserted,
    warnings,
  };
}

/**
 * PUBLIC_INTERFACE
 * readFileAsText
 *
 * Contract:
 * - Inputs: File
 * - Output: Promise<string>
 * - Errors: rejects with Error on read failure
 */
export function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read file.'));
    reader.onload = () => resolve(String(reader.result || ''));
    reader.readAsText(file);
  });
}

/**
 * PUBLIC_INTERFACE
 * triggerBrowserDownload
 *
 * Contract:
 * - Inputs: { filename: string, content: string, mimeType?: string }
 * - Side effects: triggers browser download via temporary anchor
 * - Errors: never throws (best-effort)
 */
export function triggerBrowserDownload({ filename, content, mimeType = 'text/csv;charset=utf-8' }) {
  try {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = filename || 'download.csv';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();

    setTimeout(() => {
      try {
        URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } catch {
        // ignore
      }
    }, 0);
  } catch {
    // ignore
  }
}
