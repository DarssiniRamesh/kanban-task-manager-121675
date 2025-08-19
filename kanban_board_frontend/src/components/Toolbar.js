import React, { useRef } from 'react';
import ReactDOM from 'react-dom';
import { useKanban } from '../KanbanContext';
import { useExpandMode } from '../KanbanBoard';
import { useFeedback } from '../contexts/FeedbackContext';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import FullscreenExitIcon from '@mui/icons-material/FullscreenExit';
import { Tooltip, IconButton } from '@mui/material';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import GridOnIcon from '@mui/icons-material/GridOn';
import IosShareIcon from '@mui/icons-material/IosShare';
import TableViewIcon from '@mui/icons-material/TableView';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import FileUploadIcon from '@mui/icons-material/FileUpload';
import {
  ALLOWED_CARD_FIELDS,
  EXPORT_HEADERS, // exported for reference if needed
  TEMPLATE_HEADERS, // exported for reference if needed
  buildExportRows,
  downloadExcelTemplate,
  exportToExcel,
  exportToCSV,
  readExcelFile,
  mapEntriesToCards
} from '../utils/importExport';

/**
 * PUBLIC_INTERFACE
 * Toolbar
 * A compact control bar for Kanban board actions.
 * Props:
 *  - onToggleFullscreen?: function to toggle fullscreen mode for Product page
 *  - isFullscreen?: boolean to indicate current fullscreen state
 */
function Toolbar({ onToggleFullscreen, isFullscreen }) {
  const { addColumn, importCards, columns, cards, marketColumns } = useKanban();
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
    selectedKanbanIndex: '',
    selectedMarketIndex: '',
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
    const err = await addColumn(newColTitle.trim());
    if (err) {
      showToast("Failed to add column: " + (err.message || String(err)), "error");
      return;
    }
    setAddColumnModal(false);
    showToast("Column added!", "success");
  };

  // Modified upload handler pattern: Read, then show modal for column select.
  const handleExcelUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    try {
      const { header, entries } = await readExcelFile(file);
      if (!header || header.length === 0) {
        showToast("No header row found in Excel file.", "error");
        return;
      }
      setBulkUploadState({
        showModal: true,
        file,
        excelRows: [header, ...entries],
        header,
        entries,
      });
    } catch (err) {
      showToast("Failed to parse Excel file: " + (err.message || String(err)), "error");
    }
  };

  // Bulk upload confirmation
  const handleConfirmBulkUpload = async (colIdx, marketIdx) => {
    setBulkUploadState(b => ({ ...b, showModal: false }));
    if (inputRef.current) inputRef.current.value = '';
    const { header, entries } = bulkUploadState;
    const idx = Number(colIdx);
    const mIdx = Number(marketIdx);
    const col = columns[idx];
    const mCol = (marketColumns || [])[mIdx];
    if (!col || !mCol) {
      showToast("Please select both a Kanban column and a Market column.", "error");
      return;
    }

    const parsedRows = mapEntriesToCards(header, entries, ALLOWED_CARD_FIELDS);
    if (parsedRows.length === 0) {
      showToast('No valid cards found in the file. Make sure "feature" column is filled.', "error");
      return;
    }
    try {
      const result = await importCards(col.id, parsedRows, mCol.id);
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
    exportToExcel(rows);
  };
  const handleExportCSV = () => {
    const rows = buildExportRows(cards || [], columns || []);
    exportToCSV(rows);
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
    exportToExcel(rows);
    showToast(`Exported ${rows.length} card(s) from "${col.title}"`, "success");
  };

/* ---------- UI rendering section below ---------- */
  return (
    <>
      <div className="kanban-toolbar">
        <Tooltip title="Add Column" arrow>
          <IconButton
            color="primary"
            aria-label="Add Column"
            onClick={handleAddColumn}
            size="large"
          >
            <AddCircleOutlineIcon />
          </IconButton>
        </Tooltip>

        <Tooltip title="Download Excel Template" arrow>
          <IconButton
            aria-label="Download Excel Template"
            onClick={() => downloadExcelTemplate()}
            size="large"
          >
            <GridOnIcon />
          </IconButton>
        </Tooltip>

        <Tooltip title="Export Excel (All)" arrow>
          <IconButton
            aria-label="Export Excel (All)"
            onClick={handleExportExcel}
            size="large"
          >
            <IosShareIcon />
          </IconButton>
        </Tooltip>

        <Tooltip title="Export Excel (Column)" arrow>
          <IconButton
            aria-label="Export Excel (Column)"
            onClick={handleExportByColumn}
            size="large"
          >
            <TableViewIcon />
          </IconButton>
        </Tooltip>

        <Tooltip title="Export CSV" arrow>
          <IconButton
            aria-label="Export CSV"
            onClick={handleExportCSV}
            size="large"
          >
            <FileDownloadIcon />
          </IconButton>
        </Tooltip>

        <Tooltip title={isCompact ? 'Expand all cards' : 'Shorten all cards'} arrow>
          <button
            className="btn"
            style={{ marginLeft: 0, background: isCompact ? '#445' : undefined }}
            onClick={() => setIsCompact(v => !v)}
            aria-pressed={isCompact}
            aria-label={isCompact ? 'Expand all cards' : 'Shorten all cards'}
            title={isCompact ? 'Expand all cards' : 'Shorten all cards'}
          >
            {isCompact ? 'Expand' : 'Shorten'}
          </button>
        </Tooltip>

        {/* Hidden file input for bulk upload */}
        <input
          type="file"
          accept=".xlsx,.xls"
          style={{ display: 'none' }}
          ref={inputRef}
          onChange={handleExcelUpload}
        />
        <Tooltip title="Bulk Upload Excel" arrow>
          <IconButton
            aria-label="Bulk Upload Excel"
            onClick={() => inputRef.current && inputRef.current.click()}
            size="large"
          >
            <FileUploadIcon />
          </IconButton>
        </Tooltip>

        {typeof onToggleFullscreen === 'function' && (
          <Tooltip title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'} arrow>
            <IconButton
              aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
              onClick={onToggleFullscreen}
              size="large"
            >
              {isFullscreen ? <FullscreenExitIcon fontSize="small" /> : <FullscreenIcon fontSize="small" />}
            </IconButton>
          </Tooltip>
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
      {/* Bulk Upload Select Columns Modal */}
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
                    Bulk Upload: Choose Kanban and Market columns
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ color: "#555", marginBottom: 6 }}>Select Kanban column:</div>
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
                        value={bulkUploadState.selectedKanbanIndex}
                        onChange={e => setBulkUploadState(s => ({ ...s, selectedKanbanIndex: e.target.value }))}
                      >
                        <option value="" disabled>Choose Kanban column...</option>
                        {(columns || []).map((c, i) => (
                          <option value={String(i)} key={c.id}>{c.title}</option>
                        ))}
                      </select>
                    </div>

                    <div style={{ color: "#555", margin: "14px 0 6px 0" }}>Select Market column:</div>
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
                        value={bulkUploadState.selectedMarketIndex}
                        onChange={e => setBulkUploadState(s => ({ ...s, selectedMarketIndex: e.target.value }))}
                      >
                        <option value="" disabled>Choose Market column...</option>
                        {(marketColumns || []).map((mc, i) => (
                          <option value={String(i)} key={mc.id}>{mc.title}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                    <button
                      className="btn"
                      type="button"
                      onClick={() => handleConfirmBulkUpload(bulkUploadState.selectedKanbanIndex, bulkUploadState.selectedMarketIndex)}
                      disabled={bulkUploadState.selectedKanbanIndex === '' || bulkUploadState.selectedMarketIndex === ''}
                      title="Import cards to the selected columns"
                    >
                      Import
                    </button>
                    <button className="btn" type="button" onClick={() => setBulkUploadState(s => ({ ...s, showModal: false }))}>
                      Cancel
                    </button>
                  </div>

                  <div style={{ color: "#a06700", fontSize: "0.96em", margin: "10px 0 0 1px" }}>
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
