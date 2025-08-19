import * as XLSX from 'xlsx';

/**
 * Normalize a header string to snake_case lower.
 * Converts spaces/dashes to underscores and trims.
 */
function normalizeHeaderKey(header) {
  return String(header ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s\-]+/g, '_');
}

// PUBLIC_INTERFACE
/**
 * Allowed card fields that can be imported/exported.
 * Keep this list consistent with Supabase schema.
 */
export const ALLOWED_CARD_FIELDS = [
  'id',
  'feature',
  'description',
  'assignee',
  'notes',
  'priority',
  'status',
  'due_date',
  'impact',
  'market_need',
  'estimated_effort',
  'category',
];

// PUBLIC_INTERFACE
/**
 * Headers for blank template (no id for new items)
 */
export const TEMPLATE_HEADERS = [
  'feature',
  'description',
  'assignee',
  'notes',
  'priority',
  'status',
  'due_date',
  'impact',
  'market_need',
  'estimated_effort',
  'category',
];

// PUBLIC_INTERFACE
/**
 * Headers for exports (includes id to support updates)
 */
export const EXPORT_HEADERS = [
  'id',
  'feature',
  'description',
  'assignee',
  'notes',
  'priority',
  'status',
  'due_date',
  'impact',
  'market_need',
  'estimated_effort',
  'category',
];

// PUBLIC_INTERFACE
/**
 * Build export rows from cards with a stable header order and value formatting.
 * Ensures:
 *  - due_date formatted as 'YYYY-MM-DD' or blank
 *  - estimated_effort is a number cell when present, otherwise blank
 *  - all string fields trimmed and default to '' when missing
 * Includes:
 *  - id field as the first column for accurate updates
 *
 * @param {Array<Object>} cards
 * @param {Array<Object>} columns used for sorting by product column position
 * @returns {Array<Object>}
 */
export function buildExportRows(cards, columns) {
  if (!Array.isArray(cards)) return [];
  const colPos = new Map((columns || []).map(c => [c.id, c.position || 0]));
  const sorted = [...cards].sort((a, b) => {
    const ac = colPos.get(a.column_id) ?? 0;
    const bc = colPos.get(b.column_id) ?? 0;
    if (ac !== bc) return ac - bc;
    return (a.position || 0) - (b.position || 0);
  });

  return sorted.map(c => {
    const due = c.due_date ? String(c.due_date).slice(0, 10) : '';
    const est = (c.estimated_effort === 0 || !!c.estimated_effort)
      ? Number(c.estimated_effort)
      : '';
    return {
      id: c.id || '',
      feature: (c.feature || '').trim(),
      description: (c.description || '').trim(),
      assignee: (c.assignee || '').trim(),
      notes: (c.notes || '').trim(),
      priority: (c.priority || '').trim(),
      status: (c.status || '').trim(),
      due_date: due,
      impact: (c.impact || '').trim(),
      market_need: (c.market_need || '').trim(),
      estimated_effort: est,
      category: (c.category || '').trim(),
    };
  });
}

// PUBLIC_INTERFACE
/**
 * Download a blank Excel template with headers that match the board schema.
 * @param {string} [fileName='kanban_cards_template.xlsx']
 */
export function downloadExcelTemplate(fileName = 'kanban_cards_template.xlsx') {
  const template = [
    TEMPLATE_HEADERS,
    [
      'Sample Task',
      'Description here',
      'Alice',
      'Any extra notes for the team',
      'High',
      'To Do',
      '2024-01-31',
      'High Impact - Low Effort',
      'Demand',
      3,
      'Feature',
    ],
  ];
  const ws = XLSX.utils.aoa_to_sheet(template);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'KanbanCards');
  XLSX.writeFile(wb, fileName);
}

// PUBLIC_INTERFACE
/**
 * Create and download an XLSX workbook for given rows with EXPORT_HEADERS.
 * @param {Array<Object>} rows
 * @param {string} [fileName='kanban_cards_export.xlsx']
 */
export function exportToExcel(rows, fileName = 'kanban_cards_export.xlsx') {
  const ws = XLSX.utils.json_to_sheet(rows, { header: EXPORT_HEADERS });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'KanbanCards');
  XLSX.writeFile(wb, fileName);
}

// PUBLIC_INTERFACE
/**
 * Create and download a CSV file for given rows with EXPORT_HEADERS.
 * @param {Array<Object>} rows
 * @param {string} [fileName='kanban_cards_export.csv']
 */
export function exportToCSV(rows, fileName = 'kanban_cards_export.csv') {
  const ws = XLSX.utils.json_to_sheet(rows, { header: EXPORT_HEADERS });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'KanbanCards');
  XLSX.writeFile(wb, fileName, { bookType: 'csv' });
}

// PUBLIC_INTERFACE
/**
 * Asynchronously read an Excel (.xlsx/.xls) File or Blob and return header and entries.
 * @param {File|Blob} file
 * @returns {Promise<{header: Array<string>, entries: Array<Array<any>>}>}
 */
export function readExcelFile(file) {
  return new Promise((resolve, reject) => {
    try {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheet = workbook.Sheets[workbook.SheetNames[0]];
          const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
          const [header, ...entries] = rows;
          resolve({ header, entries });
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file.'));
      reader.readAsArrayBuffer(file);
    } catch (err) {
      reject(err);
    }
  });
}

// PUBLIC_INTERFACE
/**
 * Map worksheet header+row arrays to card objects restricted to ALLOWED_CARD_FIELDS.
 * - Normalizes header keys to snake_case
 * - Converts Excel numeric date to 'yyyy-mm-dd'
 * - Parses estimated_effort to integer or null
 * - Trims strings
 * - Filters out rows with no feature
 *
 * @param {Array<string>} header
 * @param {Array<Array<any>>} entries
 * @param {Array<string>} [allowed=ALLOWED_CARD_FIELDS]
 * @returns {Array<Object>}
 */
export function mapEntriesToCards(header, entries, allowed = ALLOWED_CARD_FIELDS) {
  if (!Array.isArray(header)) return [];
  const headerNorm = header.map(normalizeHeaderKey);

  const parsed = (entries || []).map(row => {
    const obj = {};
    headerNorm.forEach((k, i) => {
      if (allowed.includes(k)) obj[k] = row[i];
    });

    // due_date numeric -> yyyy-mm-dd
    if (obj.due_date && typeof obj.due_date === 'number' && XLSX && XLSX.SSF && typeof XLSX.SSF.format === 'function') {
      try {
        obj.due_date = XLSX.SSF.format('yyyy-mm-dd', obj.due_date);
      } catch {
        // leave as-is
      }
    }

    // estimated_effort -> integer or null
    if (obj.estimated_effort !== undefined) {
      const parsedInt = Number.parseInt(obj.estimated_effort, 10);
      obj.estimated_effort = Number.isNaN(parsedInt) ? null : parsedInt;
    }

    // Trim string fields
    Object.keys(obj).forEach(k => {
      if (typeof obj[k] === 'string') obj[k] = obj[k].trim();
    });

    return obj;
  }).filter(card => card && typeof card.feature === 'string' && card.feature.trim().length > 0);

  return parsed;
}
