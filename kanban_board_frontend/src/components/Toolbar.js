import React, { useRef } from 'react';
import ReactDOM from 'react-dom';
import { useKanban } from '../KanbanContext';
import * as XLSX from 'xlsx';
import { useFeedback, useExpandMode } from '../KanbanBoard';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import FullscreenExitIcon from '@mui/icons-material/FullscreenExit';

/**
 * Build export rows from cards with a stable header order and value formatting.
 * Ensures:
 *  - due_date formatted as 'YYYY-MM-DD' or blank
 *  - estimated_effort is a number cell when present, otherwise blank
 *  - all string fields trimmed and default to '' when missing
 * Includes:
 *  - id field as the first column for accurate updates
 */
function buildExportRows(cards, columns) {
  if (!Array.isArray(cards)) return [];
  // Sort by column position then by card position for a stable output
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

// Headers for blank template (no id for new entries)
const TEMPLATE_HEADERS = [
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

// Public export header order including id for update workflows
const EXPORT_HEADERS = [
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

/**
 * Download a blank Excel template with headers that match the board schema,
 * including the new fields.
 * Note: Template does not include 'id' since it's meant for new records.
 */
function downloadExcelTemplate() {
  const template = [
    // Header row
    TEMPLATE_HEADERS,
    // Sample row (as guidance)
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
  XLSX.writeFile(wb, 'kanban_cards_template.xlsx');
}

/**
 * Create and download an XLSX workbook for the current board cards.
 */
function downloadBoardExcel(rows) {
  const ws = XLSX.utils.json_to_sheet(rows, { header: EXPORT_HEADERS });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'KanbanCards');
  XLSX.writeFile(wb, 'kanban_cards_export.xlsx');
}

/**
 * Create and download a CSV for the current board cards.
 */
function downloadBoardCSV(rows) {
  const ws = XLSX.utils.json_to_sheet(rows, { header: EXPORT_HEADERS });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'KanbanCards');
  // Write the first sheet as CSV
  XLSX.writeFile(wb, 'kanban_cards_export.csv', { bookType: 'csv' });
}

/**
 * PUBLIC_INTERFACE
 * Toolbar
 * A compact control bar for Kanban board actions.
 * Props:
 *  - onToggleFullscreen?: function to toggle fullscreen mode for Product page
 *  - isFullscreen?: boolean to indicate current fullscreen state
 */
function Toolbar({ onToggleFullscreen, isFullscreen }) {
  const { addColumn, importCards, columns, cards } = useKanban();
  const inputRef = useRef();
  const { showToast } = useFeedback();
  const { isCompact, setIsCompact } = useExpandMode();

  // Modal state for Add Column
  const [addColumnModal, setAddColumnModal] = React.useState(false);
  const [newColTitle, setNewColTitle] = React.useState("");

  // Modal state for Bulk Upload: which column?
  const [bulkUploadState, setBulkUploadState] = React.useState({
    showModal: false,
    file: null,
    excelRows: [],
    header: [],
    entries: [],
  });

  // Modal state for Export by Column
  const [exportByColumnState, setExportByColumnState] = React.useState({
    showModal: false,
  });

  // Show ToastModal for Add Column
  const handleAddColumn = () => {
    setAddColumnModal(true);
    setNewColTitle("");
  };

  const handleAddColumnSubmit = async (e) => {
    e.preventDefault();
    if (!newColTitle.trim()) {
      showToast("Column title cannot be empty.", "error");
      return;
    }
    await addColumn(newColTitle.trim());
    setAddColumnModal(false);
    showToast("Column added!", "success");
  };

  // Modified upload handler pattern: Read, then show modal for column select.
  const handleExcelUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

      // Expecting [header, ...rows]
      const [header, ...entries] = rows;
      if (!header) {
        showToast("No header row found in Excel file.", "error");
        return;
      }

      // Show modal for column selection, let user pick (use number select for now for minimal UI)
      setBulkUploadState({
        showModal: true,
        file,
        excelRows: rows,
        header,
        entries,
      });
    };
    reader.readAsArrayBuffer(file);
  };

  // Bulk upload confirmation
  const handleConfirmBulkUpload = async (colIdx) => {
    setBulkUploadState(b => ({ ...b, showModal: false }));
    inputRef.current.value = '';
    const { header, entries } = bulkUploadState;
    const idx = Number(colIdx);
    const col = columns[idx];
    if (!col) {
      showToast("Invalid column selection.", "error");
      return;
    }

    // Fields allowed for import (Supabase schema). Updated to include new fields.
    const allowedFields = [
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
    const parsedRows = entries
      .map(row => {
        const obj = {};
        header.forEach((k, i) => {
          if (allowedFields.includes(k)) {
            obj[k] = row[i];
          }
        });
        // Parse due_date to yyyy-mm-dd format if present and is numeric (Excel date)
        if (obj.due_date && typeof obj.due_date === 'number') {
          obj.due_date = require('xlsx').SSF.format('yyyy-mm-dd', obj.due_date);
        }
        // estimated_effort to integer or null/empty if blank/non-numeric
        if (obj.estimated_effort !== undefined) {
          const raw = obj.estimated_effort;
          const parsed = Number.parseInt(raw, 10);
          obj.estimated_effort = Number.isNaN(parsed) ? null : parsed;
        }
        Object.keys(obj).forEach(k => {
          if (typeof obj[k] === 'string') obj[k] = obj[k].trim();
        });
        return obj;
      })
      .filter(card => card && typeof card.feature === 'string' && card.feature.trim().length > 0);

    if (parsedRows.length === 0) {
      showToast('No valid cards found in the file. Make sure "feature" column is filled.', "error");
      return;
    }
    try {
      if (!parsedRows.every(c => c.feature)) {
        // eslint-disable-next-line no-console
        console.log("[Excel Bulk Upload] One or more mapped rows missing 'feature'");
      }
      const result = await importCards(col.id, parsedRows);
      if (result && result.error) {
        showToast(`Import failed: ${result.error}`, "error");
      } else {
        const { updatedCount = 0, insertedCount = 0, skippedDuplicates = 0 } = result || {};
        showToast(`Import complete: ${updatedCount} updated, ${insertedCount} added, ${skippedDuplicates} skipped`, "success");
      }
    } catch (e) {
      showToast('Import encountered an error: ' + (e.message || e), "error");
    }
  };

  // Export handlers (all-cards)
  const handleExportExcel = () => {
    const rows = buildExportRows(cards || [], columns || []);
    downloadBoardExcel(rows);
  };
  const handleExportCSV = () => {
    const rows = buildExportRows(cards || [], columns || []);
    downloadBoardCSV(rows);
  };

  // Export by column - open modal
  const handleExportByColumn = () => {
    if (!columns || columns.length === 0) {
      showToast("No columns available to export.", "info");
      return;
    }
    setExportByColumnState({ showModal: true });
  };

  // Export by column confirm
  const handleConfirmExportByColumn = (colIdx) => {
    const idx = Number(colIdx);
    const col = columns[idx];
    setExportByColumnState({ showModal: false });
    if (!col) {
      showToast("Invalid column selection.", "error");
      return;
    }
    const subset = (cards || []).filter(c => c.column_id === col.id);
    const rows = buildExportRows(subset, columns || []);
    downloadBoardExcel(rows);
    showToast(`Exported ${rows.length} card(s) from "${col.title}"`, "success");
  };

/* ---------- UI rendering section below ---------- */
  return (
    <>
      <div className="kanban-toolbar">
        <button className="btn" onClick={handleAddColumn}>
          + Add Column
        </button>
        <button className="btn" onClick={downloadExcelTemplate}>
          Download Excel Template
        </button>
        <button className="btn" onClick={handleExportExcel} style={{ marginLeft: 8 }}>
          Export Excel (All)
        </button>
        <button className="btn" onClick={handleExportByColumn} style={{ marginLeft: 6 }}>
          Export Excel (Column)
        </button>
        <button className="btn" onClick={handleExportCSV} style={{ marginLeft: 6 }}>
          Export CSV
        </button>
        <button
          className="btn"
          style={{ marginLeft: 8, background: isCompact ? '#445' : undefined }}
          onClick={() => setIsCompact(v => !v)}
          aria-pressed={isCompact}
          aria-label={isCompact ? 'Expand all cards' : 'Shorten all cards'}
          title={isCompact ? 'Expand all cards' : 'Shorten all cards'}
        >
          {isCompact ? 'Expand' : 'Shorten'}
        </button>
        <label className="btn" style={{ marginLeft: 8 }}>
          Bulk Upload Excel
          <input
            type="file"
            accept=".xlsx,.xls"
            style={{ display: 'none' }}
            ref={inputRef}
            onChange={handleExcelUpload}
          />
        </label>
        {typeof onToggleFullscreen === 'function' && (
          <button
            className="btn"
            style={{ marginLeft: 8, display: 'inline-flex', alignItems: 'center', gap: 6 }}
            onClick={onToggleFullscreen}
            aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
            title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
          >
            {isFullscreen ? <FullscreenExitIcon fontSize="small" /> : <FullscreenIcon fontSize="small" />}
            <span style={{ fontWeight: 700 }}>{isFullscreen ? 'Exit' : 'Fullscreen'}</span>
          </button>
        )}
      </div>
      {/* Add Column Modal */}
      {addColumnModal && (
        typeof document === "undefined"
          ? null
          : ReactDOM.createPortal(
              <div className="kanban-modal-overlay" onClick={() => setAddColumnModal(false)}>
                <div className="kanban-modal-dialog" onClick={e => e.stopPropagation()}>
                  <button className="kanban-modal-close" onClick={() => setAddColumnModal(false)} title="Close">×</button>
                  <form onSubmit={handleAddColumnSubmit}>
                    <div style={{ fontWeight: 700, fontSize: '1.19em', marginBottom: 12 }}>Add New Column</div>
                    <input
                      type="text"
                      placeholder="Column Title"
                      value={newColTitle}
                      onChange={e => setNewColTitle(e.target.value)}
                      required
                      style={{ padding: 6, fontSize: '1.08em', width: '100%', marginBottom: 18, borderRadius: 4, border: '1px solid #334266' }}
                    />
                    <div style={{ display: "flex", gap: 8 }}>
                      <button className="btn" type="submit">Add Column</button>
                      <button className="btn" type="button" onClick={() => setAddColumnModal(false)}>Cancel</button>
                    </div>
                  </form>
                </div>
              </div>,
              document.body
            )
      )}
      {/* Bulk Upload Select Column Modal */}
      {bulkUploadState.showModal && (
        typeof document === "undefined"
          ? null
          : ReactDOM.createPortal(
              <div className="kanban-modal-overlay" onClick={() => setBulkUploadState(s => ({ ...s, showModal: false }))}>
                <div
                  className="kanban-modal-dialog"
                  onClick={e => e.stopPropagation()}
                  style={{
                    color: "#222",
                    background: "var(--modal-bg, #fff6e0)",
                    borderRadius: "17px",
                  }}
                >
                  <button
                    className="kanban-modal-close"
                    onClick={() => setBulkUploadState(s => ({ ...s, showModal: false }))}
                    title="Close"
                    style={{ color: "#222", background: "none", border: "none" }}
                  >
                    ×
                  </button>
                  <div style={{ fontWeight: 700, fontSize: '1.19em', marginBottom: 14, color: "#222" }}>
                    Bulk Upload: Pick a column for these cards
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ color: "#555" }}>Select a column:</div>
                    <div style={{ margin: "9px 0"}}>
                      <select
                        style={{
                          width: "100%",
                          padding: 6,
                          fontSize: "1em",
                          background: "var(--input-bg, #fff9e7)",
                          color: "#292010",
                          border: "1.5px solid var(--color-input-border, #ffb300)"
                        }}
                        onChange={e => handleConfirmBulkUpload(e.target.value)}
                        defaultValue=""
                      >
                        <option value="" disabled>Choose column...</option>
                        {columns.map((c, i) => (
                          <option value={i} key={c.id}>{c.title}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div style={{ color: "#a06700", fontSize: "0.96em", margin: "7px 0 0 1px" }}>
                    Cards parsed from file: <strong>{bulkUploadState.entries.length}</strong>
                  </div>
                </div>
              </div>,
              document.body
            )
      )}
      {/* Export by Column Modal */}
      {exportByColumnState.showModal && (
        typeof document === "undefined"
          ? null
          : ReactDOM.createPortal(
              <div className="kanban-modal-overlay" onClick={() => setExportByColumnState({ showModal: false })}>
                <div
                  className="kanban-modal-dialog"
                  onClick={e => e.stopPropagation()}
                  style={{
                    color: "#222",
                    background: "var(--modal-bg, #fff6e0)",
                    borderRadius: "17px",
                  }}
                >
                  <button
                    className="kanban-modal-close"
                    onClick={() => setExportByColumnState({ showModal: false })}
                    title="Close"
                    style={{ color: "#222", background: "none", border: "none" }}
                  >
                    ×
                  </button>
                  <div style={{ fontWeight: 700, fontSize: '1.19em', marginBottom: 14, color: "#222" }}>
                    Export Excel: Pick a column to export
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ color: "#555" }}>Select a column:</div>
                    <div style={{ margin: "9px 0"}}>
                      <select
                        style={{
                          width: "100%",
                          padding: 6,
                          fontSize: "1em",
                          background: "var(--input-bg, #fff9e7)",
                          color: "#292010",
                          border: "1.5px solid var(--color-input-border, #ffb300)"
                        }}
                        onChange={e => handleConfirmExportByColumn(e.target.value)}
                        defaultValue=""
                      >
                        <option value="" disabled>Choose column...</option>
                        {columns.map((c, i) => (
                          <option value={i} key={c.id}>{c.title}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              </div>,
              document.body
            )
      )}
    </>
  );
}

export default Toolbar;
