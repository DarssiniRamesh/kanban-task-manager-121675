import React from 'react';
import ReactDOM from 'react-dom';
import { useKanban } from '../KanbanContext';
import CardList from './CardList';
import { CARD_TYPE } from './dndTypes';

/**
 * Column represents a Kanban column (no drag logic here; handled by board parent for DnD).
 * Props for drag visuals: isDragging, isOver (optional).
 * If filteredCards prop is provided, use those cards for render.
 */
function Column({ column, index, isDragging, isOver, filteredCards, isCompact }) {
  const { updateColumn, deleteColumn, cards } = useKanban();
  // Use filteredCards if provided, otherwise filter all cards for this column
  const colCards = (filteredCards !== undefined)
    ? filteredCards
    : cards.filter(c => c.column_id === column.id).sort((a, b) => a.position - b.position);

  // Modal state: delete/rename
  const [modal, setModal] = React.useState({ type: null });

  const { showToast } = require("../KanbanBoard"); // Import here to avoid circular deps for Feedback

  // Inline editing state for column title
  const [editing, setEditing] = React.useState(false);
  const [titleInput, setTitleInput] = React.useState(column.title);
  const [saving, setSaving] = React.useState(false);

  // Focus input for accessibility
  const inputRef = React.useRef();

  React.useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
    // Reset the title on open in case updated externally (real-time)
    if (editing) setTitleInput(column.title);
    // eslint-disable-next-line
  }, [editing]);

  // Validation: title must not be empty or whitespace, should differ from current
  function validateNewTitle(str) {
    if (!str.trim()) return "Column name cannot be empty.";
    if (str.trim() === column.title) return "Column name unchanged.";
    // Optional: add more checks (length, duplicates)
    return null;
  }

  // Start inline editing (via double-click or edit icon)
  const triggerTitleEdit = (e) => {
    e.stopPropagation();
    setEditing(true);
    setTitleInput(column.title);
  };

  // Handle saving (blur, Enter, or Save)
  const saveEditTitle = async () => {
    const error = validateNewTitle(titleInput);
    if (error) {
      showToast && showToast(error, error.includes("empty") ? "error" : "info");
      setEditing(false);
      setTitleInput(column.title);
      return;
    }
    setSaving(true);
    try {
      const resp = await updateColumn(column.id, { title: titleInput.trim() });
      if (resp && resp.message) throw new Error(resp.message);
      showToast && showToast("Column renamed!", "success");
    } catch (e) {
      showToast && showToast("Failed to rename column: " + (e.message || e), "error");
    } finally {
      setSaving(false);
      setEditing(false);
    }
  };

  const handleTitleInputKey = (e) => {
    if (e.key === "Enter") saveEditTitle();
    if (e.key === "Escape") {
      setEditing(false);
      setTitleInput(column.title);
    }
  };

  // Modal delete (unchanged)
  const handleDelete = () => setModal({ type: "delete" });

  const doDelete = async () => {
    await deleteColumn(column.id);
    showToast && showToast("Column deleted.", "success");
    setModal({ type: null });
  };

  return (
    <>
      <div
        className="kanban-column"
        aria-label={`Kanban Column: ${column.title}`}
        aria-roledescription="Column"
        style={{
          outline: isOver ? '3.5px solid #38B2AC' : undefined,
          transition: 'outline .18s',
          boxShadow: isDragging ? "0 4px 32px #38B2AC55" : undefined,
          cursor: 'grab'
        }}
        data-column-id={column.id}
        tabIndex={-1}
      >
        <div className="kanban-column-header" style={{ color: "var(--color-accent, #ffb300)" }}>
          {/* Column Title + Edit */}
          {!editing ? (
            <span
              className="kanban-column-title"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 7,
                cursor: "pointer",
                color: "var(--color-accent, #ffb300)",
                fontWeight: 800,
                fontSize: "1.14rem",
                letterSpacing: "0.02em"
              }}
              onDoubleClick={triggerTitleEdit}
              tabIndex={0}
              onKeyDown={e => {
                if (e.key === "Enter") triggerTitleEdit(e);
              }}
              title="Double-click to edit column name"
            >
              {column.title}
              <button
                type="button"
                aria-label="Edit column name"
                onClick={triggerTitleEdit}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--color-accent, #ffb300)",
                  fontSize: "1.11em",
                  marginLeft: 4,
                  cursor: "pointer",
                  opacity: 0.85,
                  padding: "1px 6px",
                  borderRadius: "4px",
                  transition: "background .12s, color .15s"
                }}
                className="kanban-column-editbtn"
                title="Edit column"
                tabIndex={0}
              >
                ✎
              </button>
            </span>
          ) : (
            <span style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
              <input
                ref={inputRef}
                type="text"
                value={titleInput}
                disabled={saving}
                onChange={e => setTitleInput(e.target.value)}
                onKeyDown={handleTitleInputKey}
                onBlur={() => !saving && saveEditTitle()}
                style={{
                  padding: 6,
                  fontSize: '1.09em',
                  borderRadius: 4,
                  border: '1.2px solid #38B2AC',
                  width: "98%",
                  marginRight: 4,
                  background: "#242d46",
                  color: "#fff"
                }}
                maxLength={64}
                placeholder="Column name"
                aria-label="Edit column title"
              />
              <button
                type="button"
                className="btn"
                style={{ marginLeft: 2, minWidth: 48, fontSize: "0.94em" }}
                onClick={saveEditTitle}
                disabled={saving}
              >
                Save
              </button>
              <button
                type="button"
                className="btn"
                style={{
                  marginLeft: 6,
                  background: "#445",
                  color: "#bbe",
                  minWidth: 44,
                  fontSize: "0.94em"
                }}
                onClick={() => { setEditing(false); setTitleInput(column.title); }}
                disabled={saving}
              >
                Cancel
              </button>
            </span>
          )}
          <button className="kanban-column-delbtn" onClick={handleDelete} title="Delete column">
            ×
          </button>
        </div>
        <CardList column={column} cards={colCards} isCompact={isCompact} />
        <span className="sr-only">{isDragging ? 'Dragging column' : ''}</span>
      </div>
      {/* Delete Confirm Modal */}


      {modal.type === "delete" && (
        typeof document === "undefined"
          ? null
          : ReactDOM.createPortal(
              <div className="kanban-modal-overlay" onClick={() => setModal({ type: null })}>
                <div className="kanban-modal-dialog" onClick={e => e.stopPropagation()}>
                  <button className="kanban-modal-close" onClick={() => setModal({ type: null })} title="Close">×</button>
                  <div style={{ color: '#ff9e9e', fontWeight: 700, fontSize: '1.15em', marginBottom: 15 }}>
                    Delete this column?
                  </div>
                  <div style={{ marginBottom: 17 }}>
                    This will permanently delete <strong>all cards in this column</strong>.<br />Are you sure?
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button className="btn" style={{ background: "#c13a2b" }} onClick={doDelete}>Yes, Delete</button>
                    <button className="btn" style={{ marginLeft: 10 }} onClick={() => setModal({ type: null })}>Cancel</button>
                  </div>
                </div>
              </div>,
              document.body
            )
      )}
    </>
  );
}

export default Column;
