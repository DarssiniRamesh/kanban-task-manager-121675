import React, { useRef } from 'react';
import ReactDOM from 'react-dom';
import { useKanban } from '../KanbanContext';
import * as XLSX from 'xlsx';
import { useFeedback, useExpandMode } from '../KanbanBoard';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import FullscreenExitIcon from '@mui/icons-material/FullscreenExit';

function downloadExcelTemplate() {
  // Columns per Supabase schema
  const template = [
    ['feature', 'description', 'assignee', 'notes', 'priority', 'status', 'due_date'],
    ['Sample Task', 'Description here', 'Alice', 'Notes here', 'High', 'To Do', '2024-01-31'],
  ];
  const ws = XLSX.utils.aoa_to_sheet(template);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'KanbanCards');
  XLSX.writeFile(wb, 'kanban_cards_template.xlsx');
}

/**
 * PUBLIC_INTERFACE
 * Toolbar
 * A compact control bar for Kanban board actions.
 * Props:
 *  - onToggleFullscreen?: function to toggle fullscreen mode for Product page
 *  - isFullscreen?: boolean to indicate current fullscreen state
 */
function Toolbar({ onToggleFullscreen, isFullscreen, crOnly, onToggleCrOnly, canEdit = true }) {
  const { addColumn, bulkInsertCards, columns } = useKanban();
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

      // Fields required in DB (as per Supabase schema)
      const allowedFields = ['feature', 'description', 'assignee', 'notes', 'priority', 'status', 'due_date'];
      const cards = entries
        .map(row => {
          const obj = {};
          header.forEach((k, i) => {
            if (allowedFields.includes(k)) {
              obj[k] = row[i];
            }
          });
          // Parse due_date to yyyy-mm-dd format if present and is numeric (Excel)
          if (obj.due_date && typeof obj.due_date === 'number') {
            obj.due_date = require('xlsx').SSF.format('yyyy-mm-dd', obj.due_date);
          }
          Object.keys(obj).forEach(k => {
            if (typeof obj[k] === 'string') obj[k] = obj[k].trim();
          });
          return obj;
        })
        .filter(card => card && typeof card.feature === 'string' && card.feature.trim().length > 0);

      if (cards.length === 0) {
        showToast('No valid cards found in the file. Make sure "feature" column is filled.', "error");
        return;
      }
      try {
        if (!cards.every(c => c.feature)) {
          // eslint-disable-next-line no-console
          console.log("[Excel Bulk Upload] One or more mapped cards missing 'feature'");
        }
        const error = await bulkInsertCards(col.id, cards);
        if (error) {
          showToast(`Bulk upload failed: ${error.message || error}`, "error");
        } else {
          showToast(`Bulk upload succeeded (${cards.length} cards added)`, "success");
        }
      } catch (e) {
        showToast('Bulk upload encountered an error: ' + (e.message || e), "error");
      }
    };
/* ---------- UI rendering section below ---------- */
  return (
    <>
      <div className="kanban-toolbar">
        {canEdit ? (
          <button className="btn" onClick={handleAddColumn}>
            + Add Column
          </button>
        ) : (
          <div
            style={{
              padding: '8px 10px',
              borderRadius: 10,
              background: 'rgba(0,0,0,0.12)',
              border: '1px solid rgba(0,0,0,0.10)',
              fontWeight: 800,
              color: '#1A1A1A',
            }}
            aria-label="View-only mode"
            title="Reader role is view-only"
          >
            View-only (Reader)
          </div>
        )}

        <button className="btn" onClick={downloadExcelTemplate}>
          Download Excel Template
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

        {typeof onToggleCrOnly === 'function' && (
          <button
            type="button"
            className="btn"
            onClick={onToggleCrOnly}
            aria-pressed={!!crOnly}
            aria-label={crOnly ? 'Disable CR-only filter' : 'Enable CR-only filter'}
            title={crOnly ? 'CR-only filter is ON (click to turn off)' : 'CR-only filter is OFF (click to turn on)'}
            style={{
              marginLeft: 8,
              background: crOnly ? 'rgba(56, 178, 172, 0.22)' : undefined,
              outline: crOnly ? '2px solid rgba(56, 178, 172, 0.65)' : undefined,
              color: crOnly ? '#bffbf6' : undefined,
              fontWeight: 900,
              letterSpacing: '0.06em',
            }}
          >
            CR
          </button>
        )}

        {canEdit && (
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
        )}
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
    </>
  );
}

export default Toolbar;
