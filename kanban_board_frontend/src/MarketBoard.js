import React, { useState } from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { useDrop, useDrag } from 'react-dnd';
import { Tooltip, IconButton } from '@mui/material';
import FullscreenExitIcon from '@mui/icons-material/FullscreenExit';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';

import { useKanban } from './KanbanContext';
import { COLUMN_TYPE, CARD_TYPE } from './components/dndTypes';
import FilterPanel from './components/FilterPanel';
import ToastModal from './components/ToastModal';
import KanbanCard from './components/KanbanCard';
import './KanbanBoard.css';
import { FeedbackContext, useFeedback } from './contexts/FeedbackContext';

/* PUBLIC_INTERFACE
 * MarketBoard
 * Displays the same cards as the Product Kanban board, but grouped by Market columns (market_kanban_columns).
 * Supports drag-and-drop of columns (reordering) and assigning/moving cards between Market columns by updating
 * the card.market_kanban_column_id field. The visual order of cards within Market columns remains stable based on
 * their existing (product) position; intra-market reordering is not persisted because there is no separate position.
 */
function MarketBoardInner() {
  const {
    marketColumns,
    isLoading,
    error,
    reorderMarketColumns,
    cards,
    updateCard,
    addMarketColumn,
  } = useKanban();

  const { showToast } = useFeedback();

  // Fullscreen state for Market page (persisted separately)
  const [fullScreen, setFullScreen] = React.useState(() => {
    try {
      return localStorage.getItem('market-fullscreen') === '1';
    } catch {
      return false;
    }
  });

  React.useEffect(() => {
    try {
      localStorage.setItem('market-fullscreen', fullScreen ? '1' : '0');
    } catch {
      // ignore
    }
  }, [fullScreen]);

  React.useEffect(() => {
    if (typeof document !== 'undefined') {
      document.body.classList.toggle('product-fullscreen', fullScreen);
      return () => {
        document.body.classList.remove('product-fullscreen');
      };
    }
  }, [fullScreen]);

  // Keyboard shortcut reserved for future
  React.useEffect(() => {
    return () => {};
  }, []);

  // Filters for Market columns: reuse FilterPanel but its "Columns" picker will target Market columns when prop set
  const [filters, setFilters] = React.useState({
    assignees: [],
    priorities: [],
    statuses: [],
    columns: [], // In Market view, this means market_kanban_columns IDs
    // New extended filters
    impact: [],
    market_need: [],
    category: [],
    estimatedEffortMin: "",
    estimatedEffortMax: "",
    dueFrom: "",
    dueTo: ""
  });

  // Filter helper: same as Product but compare selected "columns" against card.market_kanban_column_id
  function filterCardsAND_Market(cardsAll, filters) {
    return (cardsAll || []).filter(c => {
      // Assignee
      if (filters.assignees && filters.assignees.length > 0 && (!c.assignee || !filters.assignees.includes(c.assignee))) return false;
      // Priority
      if (filters.priorities && filters.priorities.length > 0 && (!c.priority || !filters.priorities.includes(c.priority))) return false;
      // Status
      if (filters.statuses && filters.statuses.length > 0 && (!c.status || !filters.statuses.includes(c.status))) return false;
      // Market Column: filter by market_kanban_column_id
      if (filters.columns && filters.columns.length > 0) {
        const mk = c.market_kanban_column_id;
        if (!mk || !filters.columns.includes(mk)) return false;
      }
      // Impact
      if (filters.impact && filters.impact.length > 0 && (!c.impact || !filters.impact.includes(c.impact))) return false;
      // Market Need
      if (filters.market_need && filters.market_need.length > 0 && (!c.market_need || !filters.market_need.includes(c.market_need))) return false;
      // Category
      if (filters.category && filters.category.length > 0 && (!c.category || !filters.category.includes(c.category))) return false;
      // Estimated Effort range
      const hasMin = filters.estimatedEffortMin !== undefined && filters.estimatedEffortMin !== '' && filters.estimatedEffortMin !== null;
      const hasMax = filters.estimatedEffortMax !== undefined && filters.estimatedEffortMax !== '' && filters.estimatedEffortMax !== null;
      if (hasMin || hasMax) {
        if (c.estimated_effort === undefined || c.estimated_effort === null || c.estimated_effort === '') return false;
        const val = Number(c.estimated_effort);
        if (hasMin && val < Number(filters.estimatedEffortMin)) return false;
        if (hasMax && val > Number(filters.estimatedEffortMax)) return false;
      }
      // Due Date Range
      if (filters.dueFrom || filters.dueTo) {
        if (!c.due_date) return false;
        if (filters.dueFrom && c.due_date < filters.dueFrom) return false;
        if (filters.dueTo && c.due_date > filters.dueTo) return false;
      }
      return true;
    });
  }

  const filteredCards = React.useMemo(
    () => filterCardsAND_Market(cards || [], filters),
    [cards, filters]
  );

  React.useEffect(() => {
    if (error) showToast && showToast(error, "error", 3800);
    // eslint-disable-next-line
  }, [error]);

  // Reorder Market columns
  const moveMarketColumn = (fromIdx, toIdx) => {
    if (fromIdx === toIdx || fromIdx < 0 || toIdx < 0 || fromIdx >= (marketColumns || []).length || toIdx >= (marketColumns || []).length) return;
    const reordered = [...(marketColumns || [])];
    const [removed] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, removed);

    const newOrder = reordered.map((col, i) => ({ id: col.id, position: i + 1 }));
    reorderMarketColumns(newOrder).catch(e => showToast && showToast("Failed to reorder market columns: " + (e.message || e), "error"));
  };

  // Draggable Market Column wrapper (drag/drop for column reorder)
  function DraggableMarketColumn({ column, index, isCompact }) {
    const [{ isDragging }, drag, preview] = useDrag({
      type: COLUMN_TYPE,
      item: { id: column.id, index },
      collect: monitor => ({ isDragging: monitor.isDragging() }),
    });

    const [{ isOver, canDrop }, drop] = useDrop({
      accept: COLUMN_TYPE,
      canDrop: (item) => item.id !== column.id,
      drop: (item) => {
        if (item.index !== index) {
          moveMarketColumn(item.index, index);
          item.index = index;
        }
      },
      collect: monitor => ({
        isOver: monitor.isOver({ shallow: true }),
        canDrop: monitor.canDrop(),
      })
    });

    // Cards for this market column: stable order by product column/position
    const colCards = filteredCards
      .filter(c => c.market_kanban_column_id === column.id)
      .sort((a, b) => {
        // stable sort primarily by product column position then card position
        const ap = a.position || 0;
        const bp = b.position || 0;
        return ap - bp;
      });

    return (
      <div
        ref={(node) => drag(drop(node))}
        role="listitem"
        aria-label={`Market Column: ${column.title}`}
        style={{
          opacity: isDragging ? 0.32 : 1,
          outline: (isOver && canDrop) ? '3.5px solid #38B2AC' : undefined,
          transition: 'outline .18s, opacity .17s, box-shadow .17s',
        }}
      >
        <MarketColumn column={column} cards={colCards} isCompact={isCompact} />
      </div>
    );
  }

  // Compact toggle for card rendering
  const [isCompact, setIsCompact] = React.useState(false);

  // State for Add Market Column modal
  const [addMarketColumnModal, setAddMarketColumnModal] = React.useState(false);
  const [newMarketColTitle, setNewMarketColTitle] = React.useState("");

  const handleAddMarketColumn = () => {
    setAddMarketColumnModal(true);
    setNewMarketColTitle("");
  };

  const handleAddMarketColumnSubmit = async (e) => {
    e.preventDefault();
    const title = (newMarketColTitle || "").trim();
    if (!title) {
      showToast && showToast("Column title cannot be empty.", "error");
      return;
    }
    try {
      const resp = await addMarketColumn(title);
      if (resp && resp.message) throw new Error(resp.message);
      showToast && showToast("Market column added!", "success");
      setAddMarketColumnModal(false);
    } catch (err) {
      showToast && showToast("Failed to add market column: " + (err.message || err), "error");
    }
  };

  return (
    <div className="kanban-app-container">
      {/* Minimal top controls for Market view */}
      <div className="kanban-toolbar">
        <Tooltip title="Add Market Column" arrow>
          <IconButton
            color="primary"
            aria-label="Add Market Column"
            onClick={handleAddMarketColumn}
            size="large"
          >
            <AddCircleOutlineIcon />
          </IconButton>
        </Tooltip>

        <button
          className="btn"
          style={{ marginLeft: 4, background: isCompact ? '#445' : undefined }}
          onClick={() => setIsCompact(v => !v)}
          aria-pressed={isCompact}
          aria-label={isCompact ? 'Expand all cards' : 'Shorten all cards'}
          title={isCompact ? 'Expand all cards' : 'Shorten all cards'}
        >
          {isCompact ? 'Expand' : 'Shorten'}
        </button>

        <button
          className="btn"
          style={{ marginLeft: 8 }}
          onClick={() => setFullScreen(v => !v)}
          aria-label={fullScreen ? 'Exit fullscreen' : 'Enter fullscreen'}
          title={fullScreen ? 'Exit fullscreen' : 'Enter fullscreen'}
        >
          {fullScreen ? 'Exit Fullscreen' : 'Fullscreen'}
        </button>
      </div>

      {/* Add Market Column Modal */}
      {addMarketColumnModal && (
        typeof document === "undefined"
          ? null
          : require('react-dom').createPortal(
              <div className="kanban-modal-overlay" onClick={() => setAddMarketColumnModal(false)}>
                <div className="kanban-modal-dialog" onClick={e => e.stopPropagation()}>
                  <button
                    className="kanban-modal-close"
                    onClick={() => setAddMarketColumnModal(false)}
                    title="Close"
                  >
                    ×
                  </button>
                  <form onSubmit={handleAddMarketColumnSubmit}>
                    <div style={{ fontWeight: 700, fontSize: '1.19em', marginBottom: 12 }}>
                      Add Market Column
                    </div>
                    <input
                      type="text"
                      placeholder="Market Column Title"
                      value={newMarketColTitle}
                      onChange={e => setNewMarketColTitle(e.target.value)}
                      required
                      style={{
                        padding: 6,
                        fontSize: '1.08em',
                        width: '100%',
                        marginBottom: 18,
                        borderRadius: 4,
                        border: '1px solid #334266',
                        background: '#242d46',
                        color: '#fff',
                      }}
                    />
                    <div style={{ display: "flex", gap: 8 }}>
                      <button className="btn" type="submit">Add</button>
                      <button className="btn" type="button" onClick={() => setAddMarketColumnModal(false)}>Cancel</button>
                    </div>
                  </form>
                </div>
              </div>,
              document.body
            )
      )}

      {/* FilterPanel: use Market columns mode */}
      <FilterPanel onFiltersChange={setFilters} useMarketColumns />

      {fullScreen && (
        <Tooltip title="Exit Full Screen" placement="left" arrow>
          <button
            className="fullscreen-exit-btn"
            onClick={() => setFullScreen(false)}
            aria-label="Exit Full Screen"
          >
            <FullscreenExitIcon fontSize="small" />
          </button>
        </Tooltip>
      )}

      <div className="kanban-board" role="list" aria-label="Market Columns">
        {isLoading ? (
          <div className="kanban-loading">Loading...</div>
        ) : error ? (
          <div className="kanban-error">{error}</div>
        ) : (
          (marketColumns || []).map((col, idx) => (
            <DraggableMarketColumn
              key={col.id}
              column={col}
              index={idx}
              isCompact={isCompact}
            />
          ))
        )}
      </div>
    </div>
  );
}

// MarketColumn renders header and MarketCardList
function MarketColumn({ column, cards, isCompact }) {
  const { updateMarketColumn, deleteMarketColumn } = useKanban();
  const { showToast } = useFeedback();

  const [editing, setEditing] = React.useState(false);
  const [titleInput, setTitleInput] = React.useState(column.title);
  const [saving, setSaving] = React.useState(false);

  const inputRef = React.useRef(null);
  React.useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
    if (editing) setTitleInput(column.title);
    // eslint-disable-next-line
  }, [editing]);

  function validateNewTitle(str) {
    if (!str.trim()) return "Column name cannot be empty.";
    if (str.trim() === column.title) return "Column name unchanged.";
    return null;
  }

  const triggerTitleEdit = (e) => {
    e.stopPropagation();
    setEditing(true);
    setTitleInput(column.title);
  };

  const saveEditTitle = async () => {
    const err = validateNewTitle(titleInput);
    if (err) {
      showToast && showToast(err, err.includes("empty") ? "error" : "info");
      setEditing(false);
      setTitleInput(column.title);
      return;
    }
    setSaving(true);
    try {
      const resp = await updateMarketColumn(column.id, { title: titleInput.trim() });
      if (resp && resp.message) throw new Error(resp.message);
      showToast && showToast("Market column renamed!", "success");
    } catch (e) {
      showToast && showToast("Failed to rename market column: " + (e.message || e), "error");
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

  const [modal, setModal] = React.useState({ type: null });
  const doDelete = async () => {
    await deleteMarketColumn(column.id);
    showToast && showToast("Market column deleted.", "success");
    setModal({ type: null });
  };

  return (
    <>
      <div className="kanban-column" data-column-id={column.id} tabIndex={-1}>
        <div className="kanban-column-header" style={{ color: "var(--color-accent, #ffb300)" }}>
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
              onKeyDown={e => { if (e.key === "Enter") triggerTitleEdit(e); }}
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
              <button type="button" className="btn" style={{ marginLeft: 2, minWidth: 48, fontSize: "0.94em" }} onClick={saveEditTitle} disabled={saving}>Save</button>
              <button
                type="button"
                className="btn"
                style={{ marginLeft: 6, background: "#445", color: "#bbe", minWidth: 44, fontSize: "0.94em" }}
                onClick={() => { setEditing(false); setTitleInput(column.title); }}
                disabled={saving}
              >
                Cancel
              </button>
            </span>
          )}
          <button className="kanban-column-delbtn" onClick={() => setModal({ type: "delete" })} title="Delete column">×</button>
        </div>

        <MarketCardList column={column} cards={cards} isCompact={isCompact} />
      </div>

      {modal.type === "delete" && (
        typeof document === "undefined"
          ? null
          : require('react-dom').createPortal(
            <div className="kanban-modal-overlay" onClick={() => setModal({ type: null })}>
              <div className="kanban-modal-dialog" onClick={e => e.stopPropagation()}>
                <button className="kanban-modal-close" onClick={() => setModal({ type: null })} title="Close">×</button>
                <div style={{ color: '#ff9e9e', fontWeight: 700, fontSize: '1.15em', marginBottom: 15 }}>
                  Delete this market column?
                </div>
                <div style={{ marginBottom: 17 }}>
                  This will permanently delete <strong>all cards that reference this column via market_kanban_column_id</strong> relationship (due to FK CASCADE). Are you sure?
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

// PUBLIC_INTERFACE
/**
 * MarketCardList
 * Renders cards for a market column and enables drag-and-drop assignment/movement between market columns.
 * Does not support adding new cards from the Market view, to avoid ambiguity with Product columns.
 */
function MarketCardList({ column, cards, isCompact = false }) {
  const { updateCard } = useKanban();
  const { showToast } = useFeedback();

  // Drop into an empty market column
  const [{ isOver, canDrop }, drop] = useDrop({
    accept: CARD_TYPE,
    canDrop: (item) => !!item,
    drop: async (item) => {
      if ((cards || []).length === 0) {
        try {
          await updateCard(item.id, { market_kanban_column_id: column.id });
          showToast && showToast('Card assigned to market column.', 'success');
        } catch (err) {
          showToast && showToast('Failed to assign card: ' + (err.message || err), 'error');
        }
      }
    },
    collect: (monitor) => ({
      isOver: !!monitor.isOver(),
      canDrop: monitor.canDrop(),
    }),
  });

  return (
    <div
      className="kanban-card-list"
      ref={(cards || []).length === 0 ? drop : undefined}
      style={{
        minHeight: 34,
        background: isOver && canDrop && (cards || []).length === 0 ? '#22326944' : undefined,
        border: isOver && canDrop && (cards || []).length === 0 ? '2px dashed #38B2AC' : undefined,
        borderRadius: isOver && canDrop && (cards || []).length === 0 ? 7 : undefined,
        transition: 'background 0.16s, border 0.16s'
      }}
    >
      {(cards || []).map((card, i) => (
        <DnDMarketCard
          key={card.id}
          card={card}
          index={i}
          column={column}
          colCards={cards}
          isCompact={isCompact}
        />
      ))}
    </div>
  );
}

// DnD wrapper for Market cards. Drag item carries market_kanban_column_id for comparison.
function DnDMarketCard({ card, index, column, colCards, isCompact = false }) {
  const { updateCard } = useKanban();
  const { showToast } = useFeedback();

  const [{ isDragging }, drag] = useDrag({
    type: CARD_TYPE,
    item: () => ({
      type: CARD_TYPE,
      id: card.id,
      market_kanban_column_id: card.market_kanban_column_id || null,
      origIndex: index,
      card,
    }),
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  const [{ isOver, canDrop }, drop] = useDrop({
    accept: CARD_TYPE,
    canDrop: (item) => item.id !== card.id,
    drop: async (item) => {
      if (item.id === card.id) return;
      // Cross-market move: assign to this card's market column
      try {
        if (item.market_kanban_column_id !== column.id) {
          await updateCard(item.id, { market_kanban_column_id: column.id });
          showToast && showToast('Card assigned to market column.', 'success');
        } else {
          // Same market column: no persistent ordering update (no separate market position)
        }
      } catch (err) {
        showToast && showToast('Failed to move card: ' + (err.message || err), 'error');
      }
    },
    collect: (monitor) => ({
      isOver: monitor.isOver({ shallow: true }),
      canDrop: monitor.canDrop(),
    }),
  });

  const ref = React.useRef(null);
  drag(drop(ref));

  return (
    <div
      ref={ref}
      style={{
        opacity: isDragging ? 0.32 : 1,
        border: (isOver && canDrop) ? '2.5px solid #38B2AC' : undefined,
        boxShadow: isDragging ? '0 4px 18px 0 #38B2AC33' : undefined,
        background: (isOver && canDrop) ? '#13204e' : undefined,
        zIndex: isDragging ? 80 : 1,
        transition: 'background .15s, border .15s, opacity .14s, box-shadow .16s'
      }}
    >
      <KanbanCard card={card} isCompact={isCompact} />
    </div>
  );
}

// PUBLIC_INTERFACE
export default function MarketBoard() {
  const [toast, setToast] = useState(null);

  // PUBLIC_INTERFACE
  const showToast = (message, type = "success", duration = 3000) => {
    setToast({ id: Date.now(), message, type, duration });
  };
  const closeToast = () => setToast(null);

  return (
    <FeedbackContext.Provider value={{ showToast }}>
      <DndProvider backend={HTML5Backend}>
        <MarketBoardInner />
        {toast && (
          <ToastModal
            key={toast.id}
            message={toast.message}
            type={toast.type}
            duration={toast.duration}
            onClose={closeToast}
          />
        )}
      </DndProvider>
    </FeedbackContext.Provider>
  );
}
