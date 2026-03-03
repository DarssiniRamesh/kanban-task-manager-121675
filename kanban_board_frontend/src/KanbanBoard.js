import React, { useState, createContext, useContext } from 'react';
import Toolbar from './components/Toolbar';
import StatusSummary from './components/StatusSummary';
import Column from './components/Column';
import FilterPanel from './components/FilterPanel';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import ToastModal from './components/ToastModal';
import { COLUMN_TYPE } from './components/dndTypes';
import { useKanban } from './KanbanContext';
import { useDrop, useDrag } from 'react-dnd';
import FullscreenExitIcon from '@mui/icons-material/FullscreenExit';

import './KanbanBoard.css';

// Feedback/toast context for global error/success UI
const FeedbackContext = createContext();
export function useFeedback() {
  return useContext(FeedbackContext);
}

// Global expand/shorten context for cards
const ExpandModeContext = createContext({ isCompact: false, setIsCompact: () => {} });
export function useExpandMode() {
  return useContext(ExpandModeContext);
}

/**
 * Filters the provided cards array by combining all filters with AND logic.
 * For each selected filter (any of assignees, priorities, statuses, columns, due date range), a card must match all applied filters.
 * Accepts:
 *   cards: Array of card objects
 *   filters: { assignees:[], priorities:[], statuses:[], columns:[], dueFrom:"", dueTo:"" }
 *   columns: Array of columns (for mapping)
 * Returns:
 *   Filtered array of cards.
 */
function filterCardsAND(cards, filters, columns) {
  return cards.filter(c => {
    // CR-only (Customer Requested)
    // If enabled, only show cards explicitly marked customer_requested === true.
    // Treat missing/false as not customer requested.
    if (filters.crOnly && c.customer_requested !== true) return false;

    // Assignee multi-filter (intersection)
    if (
      filters.assignees &&
      filters.assignees.length > 0 &&
      (!c.assignee || !filters.assignees.includes(c.assignee))
    ) return false;
    // Priority
    if (
      filters.priorities &&
      filters.priorities.length > 0 &&
      (!c.priority || !filters.priorities.includes(c.priority))
    ) return false;
    // Status
    if (
      filters.statuses &&
      filters.statuses.length > 0 &&
      (!c.status || !filters.statuses.includes(c.status))
    ) return false;
    // Column (by id)
    if (
      filters.columns &&
      filters.columns.length > 0 &&
      (!c.column_id || !filters.columns.includes(c.column_id))
    ) return false;
    // Due Date Range
    if (filters.dueFrom || filters.dueTo) {
      if (!c.due_date) return false;
      if (filters.dueFrom && c.due_date < filters.dueFrom) return false;
      if (filters.dueTo && c.due_date > filters.dueTo) return false;
    }
    return true;
  });
}

function KanbanBoardInner() {
  const { columns, activeColumns, archivedColumns, isLoading, error, reorderColumns, cards, unarchiveColumn } = useKanban();
  const { showToast } = useFeedback();
  const { isCompact } = useExpandMode();
  const [draggedCol, setDraggedCol] = React.useState(null);

  const [showArchived, setShowArchived] = React.useState(false);

  // Fullscreen state for Product page (persisted)
  const [fullScreen, setFullScreen] = React.useState(() => {
    try {
      return localStorage.getItem('product-fullscreen') === '1';
    } catch {
      return false;
    }
  });

  // Persist fullscreen preference
  React.useEffect(() => {
    try {
      localStorage.setItem('product-fullscreen', fullScreen ? '1' : '0');
    } catch {
      // ignore
    }
  }, [fullScreen]);

  // Apply/remove fullscreen body class for Product page
  React.useEffect(() => {
    if (typeof document !== 'undefined') {
      document.body.classList.toggle('product-fullscreen', fullScreen);
      return () => {
        document.body.classList.remove('product-fullscreen');
      };
    }
  }, [fullScreen]);

  // Keyboard shortcut removed per requirement: 'f' key should have no effect
  React.useEffect(() => {
    // no-op reserved for future keyboard handlers
    return () => {};
  }, []);

  // Filter state local to board
  const [filters, setFilters] = React.useState({
    assignees: [],
    priorities: [],
    statuses: [],
    columns: [],
    dueFrom: "",
    dueTo: "",
    crOnly: false,
  });

  // Filtered cards, memoized for perf (updates when filters/cards/columns change)
  const filteredCards = React.useMemo(
    () => filterCardsAND(cards || [], filters, columns),
    [cards, filters, columns]
  );

  React.useEffect(() => {
    if (error) showToast(error, "error", 3800);
    // eslint-disable-next-line
  }, [error]);

  // Handles local column reordering, triggers Supabase sync
  const moveColumn = (fromIdx, toIdx) => {
    const list = activeColumns || columns || [];
    // Defensive: do not swap to invalid
    if (fromIdx === toIdx || fromIdx < 0 || toIdx < 0 || fromIdx >= list.length || toIdx >= list.length) return;
    const reordered = [...list];
    const [removed] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, removed);
    // Renumber positions: 1-based sequencing (only for active columns)
    const newOrder = reordered.map((col, i) => ({
      id: col.id,
      position: i + 1
    }));
    reorderColumns(newOrder)
      .catch(e => showToast && showToast("Failed to reorder columns: " + (e.message || e), "error"));
  };

  // Only define DraggableKanbanColumn once!
  function DraggableKanbanColumn({ column, index, moveColumn, draggedCol, setDraggedCol, totalColumns, filteredCards, isCompact }) {
    // Drag source
    const [{ isDragging }, drag, preview] = useDrag({
      type: COLUMN_TYPE,
      item: () => {
        setDraggedCol(index);
        return { id: column.id, index };
      },
      collect: monitor => ({
        isDragging: monitor.isDragging(),
      }),
      end: () => setDraggedCol(null),
    });

    // Drop target
    const [{ isOver, canDrop }, drop] = useDrop({
      accept: COLUMN_TYPE,
      canDrop: (item) => item.id !== column.id,
      hover: (item, monitor) => {
        if (item.index === index) return;
        // No op to prevent multiple updates
      },
      drop: (item, monitor) => {
        if (item.index !== index) {
          moveColumn(item.index, index);
        }
      },
      collect: (monitor) => ({
        isOver: monitor.isOver({ shallow: true }),
        canDrop: monitor.canDrop(),
      }),
    });

    // Accessible markup/ARIA
    const draggableProps = {
      ref: node => drag(drop(node)),
      'role': 'listitem',
      'aria-grabbed': isDragging,
      'aria-label': `Column: ${column.title}`,
      tabIndex: 0,
      style: {
        opacity: isDragging ? 0.3 : 1,
        zIndex: isDragging ? 90 : 1,
        boxShadow: isDragging ? '0 2px 18px #38B2AC66' : undefined,
        border: (isOver && canDrop) ? '3.5px solid #38B2AC' : undefined,
        outline: (isOver && canDrop) ? '2.5px dashed #42fae9' : undefined,
        transition: 'box-shadow .17s, outline .13s, opacity .19s, border .18s'
      }
    };

    // Keyboard reordering removed per requirement: Arrow keys disabled
    const handleKeyDown = () => {};

    // Pass filteredCards to Column if present
    return (
      <div {...draggableProps}>
        <Column column={column} index={index} isDragging={isDragging} isOver={isOver && canDrop} filteredCards={filteredCards} isCompact={isCompact} />
      </div>
    );
  }

  return (
    <div className="kanban-app-container">
      {!fullScreen && (
        <Toolbar
          onToggleFullscreen={() => setFullScreen(v => !v)}
          isFullscreen={fullScreen}
        />
      )}
      {!fullScreen && <StatusSummary />}
      {!fullScreen && <FilterPanel onFiltersChange={setFilters} />}

      {/* Exit Full Screen floating button - only visible in fullscreen mode */}
      {fullScreen && (
        <button
          className="fullscreen-exit-btn"
          onClick={() => setFullScreen(false)}
          title="Exit Full Screen"
          aria-label="Exit Full Screen"
        >
          <FullscreenExitIcon fontSize="small" />
          <span className="fullscreen-exit-label">Exit</span>
        </button>
      )}

      <div className="kanban-board" role="list" aria-label="Kanban Columns">
        {isLoading ? (
          <div className="kanban-loading">Loading...</div>
        ) : error ? (
          <div className="kanban-error">{error}</div>
        ) : (
          (activeColumns || []).map((col, idx) => (
            <DraggableKanbanColumn
              key={col.id}
              column={col}
              index={idx}
              moveColumn={moveColumn}
              draggedCol={draggedCol}
              setDraggedCol={setDraggedCol}
              totalColumns={(activeColumns || []).length}
              filteredCards={filteredCards.filter(c => c.column_id === col.id)}
              isCompact={isCompact}
            />
          ))
        )}
      </div>

      {/* Archived columns section (collapsed by default) */}
      {!isLoading && !error && (archivedColumns || []).length > 0 && (
        <div className="archived-columns-panel" aria-label="Archived columns">
          <button
            type="button"
            className="btn archived-toggle-btn"
            onClick={() => setShowArchived(v => !v)}
            aria-expanded={showArchived}
          >
            {showArchived ? 'Hide' : 'Show'} Archived Columns ({archivedColumns.length})
          </button>

          {showArchived && (
            <div className="archived-columns-list" role="list" aria-label="Archived column list">
              {archivedColumns.map(col => (
                <div className="archived-column-row" role="listitem" key={col.id}>
                  <div className="archived-column-title">{col.title}</div>
                  <button
                    type="button"
                    className="btn archived-restore-btn"
                    onClick={async () => {
                      try {
                        const err = await unarchiveColumn(col.id);
                        if (err) throw err;
                        showToast && showToast(`Unarchived "${col.title}"`, 'success');
                      } catch (e) {
                        showToast && showToast(`Failed to unarchive "${col.title}": ${e.message || e}`, 'error');
                      }
                    }}
                    aria-label={`Unarchive column ${col.title}`}
                    title="Restore column"
                  >
                    Restore
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// PUBLIC_INTERFACE
export default function KanbanBoard() {
  // Toast state: {msg, type, id}
  const [toast, setToast] = useState(null);

  // PUBLIC_INTERFACE
  const showToast = (message, type = "success", duration = 3000) => {
    setToast({ id: Date.now(), message, type, duration });
  };

  const closeToast = () => setToast(null);

  // Global expand/shorten state for cards
  const [isCompact, setIsCompact] = useState(false);

  return (
    <FeedbackContext.Provider value={{ showToast }}>
      <ExpandModeContext.Provider value={{ isCompact, setIsCompact }}>
        <DndProvider backend={HTML5Backend}>
          <KanbanBoardInner />
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
      </ExpandModeContext.Provider>
    </FeedbackContext.Provider>
  );
}
