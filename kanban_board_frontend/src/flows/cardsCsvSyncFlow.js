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
 * Compatibility note (important):
 * - Some spreadsheet editors (Excel, Google Sheets) may blank out cells in a column like `column_id`
 *   when users re-order/remove columns or do partial edits.
 * - To keep the flow durable, import treats per-row `column_id` as *optional* and will resolve it from:
 *    1) `column_name` or `column` (if present), else
 *    2) status-like hints (e.g., "To Do", "Doing", "Done"), else
 *    3) safe default: "Backlog" column (or the first column by position).
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
  // Optional compatibility fields that may appear in exports from other tooling.
  // We do not export them, but we will consume them on import if present.
  // 'column_name', 'column'
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
 * Normalize a human-entered label for matching (columns, statuses).
 * Contract:
 * - Input: any (string-ish)
 * - Output: lowercase, trimmed, whitespace-collapsed string ('' if empty)
 */
function normalizeLabel(value) {
  return String(value == null ? '' : value)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

/**
 * Flow name: ColumnIdResolutionFlow (core helper)
 *
 * Resolve a column_id for an imported CSV row.
 *
 * Contract:
 * - Inputs:
 *   - row: object of raw CSV fields (string values)
 *   - columns: Array<{ id: string|number, title?: string, position?: number }>
 * - Output:
 *   - { columnId: string|null, resolution: { method: string, detail?: string } }
 * - Errors:
 *   - never throws; returns best-effort result
 *
 * Invariants:
 * - If returns a non-null columnId, it is an existing column's id (stringified).
 * - If cannot resolve, returns null and caller should apply a safe default.
 */
function resolveColumnIdForRow({ row, columns }) {
  const cols = Array.isArray(columns) ? columns : [];
  const byTitle = new Map(
    cols
      .map((c) => [normalizeLabel(c?.title), c])
      .filter(([k, c]) => k && c && c.id != null)
  );

  const pick = (k) => (row?.[k] == null ? '' : String(row[k]).trim());

  // 1) Direct column_id if present
  const direct = pick('column_id');
  if (direct) {
    return { columnId: direct, resolution: { method: 'column_id' } };
  }

  // 2) Some exports may include a friendly column name field
  const explicitName = pick('column_name') || pick('column');
  const explicitNameKey = normalizeLabel(explicitName);
  if (explicitNameKey && byTitle.has(explicitNameKey)) {
    return {
      columnId: String(byTitle.get(explicitNameKey).id),
      resolution: { method: 'column_name', detail: explicitName },
    };
  }

  // 3) Use status-like hints -> map to canonical column titles if present
  // This is intentionally conservative; if it doesn't match, we fall back safely.
  const status = normalizeLabel(pick('status'));

  // Common patterns seen in task exports.
  const statusToCanonicalTitle = new Map([
    ['to do', 'backlog'],
    ['todo', 'backlog'],
    ['backlog', 'backlog'],
    ['planned', 'backlog'],

    ['in progress', 'in progress'],
    ['doing', 'in progress'],
    ['wip', 'in progress'],

    ['done', 'done'],
    ['completed', 'done'],
    ['complete', 'done'],
    ['shipped', 'done'],
  ]);

  const canonical = statusToCanonicalTitle.get(status);
  if (canonical) {
    // Try exact match first; then allow matching any column that contains the canonical token.
    const exact = byTitle.get(canonical);
    if (exact) {
      return {
        columnId: String(exact.id),
        resolution: { method: 'status->column', detail: `${status} -> ${canonical}` },
      };
    }

    const contains = cols.find((c) => normalizeLabel(c?.title).includes(canonical));
    if (contains && contains.id != null) {
      return {
        columnId: String(contains.id),
        resolution: { method: 'status->column.contains', detail: `${status} -> *${canonical}*` },
      };
    }
  }

  return { columnId: null, resolution: { method: 'unresolved' } };
}

/**
 * Find a safe default column id.
 * Contract:
 * - Input: columns array
 * - Output: string|null (prefers "Backlog" title, else first by position, else first element)
 */
function getSafeDefaultColumnId(columns) {
  const cols = Array.isArray(columns) ? columns : [];
  if (cols.length === 0) return null;

  const backlog = cols.find((c) => normalizeLabel(c?.title) === 'backlog');
  if (backlog?.id != null) return String(backlog.id);

  const sorted = [...cols].sort((a, b) => (Number(a?.position) || 0) - (Number(b?.position) || 0));
  const first = sorted[0] || cols[0];
  return first?.id == null ? null : String(first.id);
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
  const lines = (rows || []).map((row) => fieldsInOrder.map((k) => csvEscape(row?.[k])).join(','));
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
 * Accepted input formats for due_date in CSV import.
 * Invariant: normalization output is always `yyyy-mm-dd`.
 */
const DUE_DATE_ACCEPTED_FORMATS = [
  'yyyy-mm-dd (e.g. 2024-01-31)',
  'dd-mm-yyyy (e.g. 31-01-2024)',
  'dd/mm/yyyy (e.g. 31/01/2024)',
  'mm/dd/yyyy (e.g. 01/31/2024)',
];

/**
 * Convert numeric Y/M/D to an ISO date string (yyyy-mm-dd) and validate it represents a real calendar date.
 *
 * Contract:
 * - Input: { yyyy: number, mm: number, dd: number, original: string }
 * - Output: string `yyyy-mm-dd`
 * - Errors: throws Error if the date is out of range or not a real date.
 */
function toIsoDateOrThrow({ yyyy, mm, dd, original }) {
  const baseMsg = `Invalid "due_date" value: ${original}. Accepted formats: ${DUE_DATE_ACCEPTED_FORMATS.join(
    ', '
  )}, or blank.`;

  if (!Number.isInteger(yyyy) || !Number.isInteger(mm) || !Number.isInteger(dd)) {
    throw new Error(baseMsg);
  }
  if (yyyy < 1000 || yyyy > 9999 || mm < 1 || mm > 12 || dd < 1 || dd > 31) {
    throw new Error(baseMsg);
  }

  // Validate it's a real date (e.g., reject 31-02-2024).
  const dt = new Date(Date.UTC(yyyy, mm - 1, dd));
  const valid =
    dt.getUTCFullYear() === yyyy && dt.getUTCMonth() === mm - 1 && dt.getUTCDate() === dd;

  if (!valid) {
    throw new Error(
      `Invalid "due_date" value: ${original}. Not a real calendar date. Accepted formats: ${DUE_DATE_ACCEPTED_FORMATS.join(
        ', '
      )}, or blank.`
    );
  }

  const pad2 = (n) => String(n).padStart(2, '0');
  return `${String(yyyy).padStart(4, '0')}-${pad2(mm)}-${pad2(dd)}`;
}

/**
 * Try to parse and normalize a human-entered date string to `yyyy-mm-dd`.
 *
 * Contract:
 * - Input: string (already trimmed); may be '' for blank
 * - Output:
 *   - { iso: string | null } where iso is `yyyy-mm-dd` and null means blank input
 * - Errors:
 *   - throws Error with a user-facing message if the value is non-blank but not parseable
 * - Notes:
 *   - This does not accept locale-specific month names; it targets common numeric CSV formats.
 */
function normalizeDueDate(value) {
  const raw = value == null ? '' : String(value).trim();
  if (!raw) return { iso: null };

  // Already in canonical form.
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return { iso: raw };
  }

  // dd-mm-yyyy
  let m = raw.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (m) {
    const dd = Number(m[1]);
    const mm = Number(m[2]);
    const yyyy = Number(m[3]);
    return { iso: toIsoDateOrThrow({ yyyy, mm, dd, original: raw }) };
  }

  // dd/mm/yyyy or mm/dd/yyyy (ambiguous when both <= 12)
  m = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    const yyyy = Number(m[3]);

    // Disambiguation rule:
    // - If a > 12 => a is day (dd/mm/yyyy)
    // - Else if b > 12 => b is day (mm/dd/yyyy)
    // - Else ambiguous: reject with actionable guidance
    if (a > 12 && b <= 12) {
      return { iso: toIsoDateOrThrow({ yyyy, mm: b, dd: a, original: raw }) };
    }
    if (b > 12 && a <= 12) {
      return { iso: toIsoDateOrThrow({ yyyy, mm: a, dd: b, original: raw }) };
    }

    throw new Error(
      `Invalid "due_date" value: ${raw}. Ambiguous format. Please use yyyy-mm-dd or an unambiguous format like dd-mm-yyyy. Accepted formats: ${DUE_DATE_ACCEPTED_FORMATS.join(
        ', '
      )}, or blank.`
    );
  }

  throw new Error(
    `Invalid "due_date" value: ${raw}. Accepted formats: ${DUE_DATE_ACCEPTED_FORMATS.join(', ')}, or blank.`
  );
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

  // due_date: allow blank; otherwise normalize common human-entered formats to yyyy-mm-dd (Supabase date).
  const due_date_raw = pick('due_date');
  const { iso: due_date } = normalizeDueDate(due_date_raw);

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
 *   - csvText: string (must include `id` column in header; `column_id` is recommended but may be blank per-row)
 * - Output:
 *   - result: {
 *        totalRows: number,
 *        upserted: number,
 *        warnings: string[],
 *      }
 * - Errors:
 *   - throws Error with user-friendly message for validation or Supabase failures.
 * - Side effects:
 *   - reads Supabase `kanban_columns` to resolve missing column IDs
 *   - writes to Supabase `kanban_cards` via bulk upsert (onConflict: 'id')
 */
export async function syncCardsFromCsvText(csvText) {
  const flow = 'CardsCsvRoundTripSyncFlow.import';
  log(flow, 'info', 'start');

  const { header, rows } = csvToObjects(csvText);

  const headerSet = new Set(header.map((h) => String(h || '').trim()));
  if (!headerSet.has('id')) {
    throw new Error(
      'CSV is missing required column "id". Export a CSV from this app to ensure round-trip compatibility.'
    );
  }

  const supabase = getSupabaseClient();

  // Fetch columns once for deterministic per-row resolution.
  log(flow, 'info', 'columns.fetch.begin');
  const { data: columns, error: colErr } = await supabase
    .from('kanban_columns')
    .select('id,title,position')
    .order('position', { ascending: true });

  if (colErr) {
    log(flow, 'error', 'columns.fetch.failed', {
      message: colErr.message,
      details: colErr.details,
      hint: colErr.hint,
    });
    throw new Error(`Supabase read failed (kanban_columns): ${colErr.message || 'unknown error'}`);
  }

  const defaultColumnId = getSafeDefaultColumnId(columns || []);
  if (!defaultColumnId) {
    throw new Error(
      'CSV import cannot proceed because no columns exist (or could be resolved). Please create a column (e.g., "Backlog") and retry.'
    );
  }
  log(flow, 'info', 'columns.fetch.success', { columnCount: (columns || []).length, defaultColumnId });

  const warnings = [];
  const payloads = [];

  rows.forEach((raw, idx) => {
    const rowNum = idx + 2; // header is line 1
    const id = raw?.id == null ? '' : String(raw.id).trim();
    if (!id) {
      throw new Error(`Row ${rowNum}: missing required "id".`);
    }

    // If column_id is blank/missing, resolve it using other fields or default.
    const { columnId: resolved, resolution } = resolveColumnIdForRow({ row: raw, columns });
    const finalColumnId = resolved || defaultColumnId;

    if (!resolved) {
      warnings.push(
        `Row ${rowNum}: missing/blank "column_id"; defaulted to column_id=${finalColumnId} (${resolution.method}).`
      );
    } else if (resolution.method !== 'column_id') {
      warnings.push(`Row ${rowNum}: resolved "column_id" via ${resolution.method} (${resolution.detail || ''}).`);
    }

    try {
      // Ensure normalization sees a concrete column_id.
      const mergedRaw = { ...raw, column_id: finalColumnId };
      const { payload, warnings: rowWarns } = normalizeCardRow(mergedRaw);
      payloads.push(payload);
      rowWarns.forEach((w) => warnings.push(`Row ${rowNum}: ${w}`));
    } catch (e) {
      throw new Error(`Row ${rowNum}: ${e.message || e}`);
    }
  });

  if (payloads.length === 0) {
    throw new Error('No data rows found in CSV.');
  }

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
    log(flow, 'error', 'upsert.failed', {
      message: error.message,
      details: error.details,
      hint: error.hint,
    });
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
