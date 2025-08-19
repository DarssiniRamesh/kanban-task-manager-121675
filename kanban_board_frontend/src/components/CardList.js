import React, { useState } from 'react';
import KanbanCard from './KanbanCard';
import { useKanban } from '../KanbanContext';
import { useDrop, useDrag } from 'react-dnd';
import { CARD_TYPE } from './dndTypes';
import { useFeedback } from '../contexts/FeedbackContext';
import AssigneeAutocomplete from './AssigneeAutocomplete';
import { addKnownAssignee } from '../utils/assignees';

/**
 * CardList supports dropping cards for intra-column reordering (vertical movement)
 * and renders cards with drag/hover context.
 */
function CardList({ column, cards: colCardsProp, isCompact = false }) {
  // colCards: sorted - passed in or computed
  const { cards, addCard, updateCard, columns, marketColumns } = useKanban();
  const [adding, setAdding] = useState(false);

  // Prefer passed colCards (sorted), but fallback for tests:
  const colCards = colCardsProp ||
    cards.filter(c => c.column_id === column.id).sort((a, b) => a.position - b.position);

  // For dropping a card into an empty column (or below/above all)
  const [{ isOver, canDrop }, drop] = useDrop({
    accept: CARD_TYPE,
    canDrop: (item) => !!item,
    drop: async (item) => {
      // If dropping into a column with no cards
      if (colCards.length === 0) {
        // Place card at pos 1, update column_id
        await updateCard(item.id, { column_id: column.id, position: 1 });
      }
    },
    collect: (monitor) => ({
      isOver: !!monitor.isOver(),
      canDrop: monitor.canDrop(),
    }),
  });

  const handleAddCard = async (e) => {
    e.preventDefault();
    const feature = e.target.feature.value.trim();
    if (!feature) return;

    // Enforce selection of both Kanban and Market columns
    const selectedKanbanId = e.target.kanban_column_id.value;
    const selectedMarketId = e.target.market_kanban_column_id.value;
    if (!selectedKanbanId || !selectedMarketId) {
      // Basic guard; HTML required attributes should already prevent this
      return;
    }

    const description = e.target.description.value;
    const assignee = e.target.assignee.value;
    const notes = e.target.notes.value;
    const priority = e.target.priority.value;
    const status = e.target.status.value;
    const due_date = e.target.due_date.value;

    // New fields
    const impact = e.target.impact.value;
    const market_need = e.target.market_need.value;
    const estimated_effort_raw = e.target.estimated_effort.value;
    const category = e.target.category.value;

    const estimated_effort =
      estimated_effort_raw === '' ? null : Number.isNaN(parseInt(estimated_effort_raw, 10)) ? null : parseInt(estimated_effort_raw, 10);

    // Pass market_kanban_column_id and selected kanban column id explicitly
    await addCard(Number(selectedKanbanId), {
      feature,
      description,
      assignee,
      notes,
      priority,
      status,
      due_date,
      impact,
      market_need,
      estimated_effort,
      category,
      market_kanban_column_id: Number(selectedMarketId),
    });
    setAdding(false);
    e.target.reset();
  };

  return (
    <div
      className="kanban-card-list"
      ref={colCards.length === 0 ? drop : undefined}
      style={{
        minHeight: 34,
        background: isOver && canDrop && colCards.length === 0 ? '#22326944' : undefined,
        border: isOver && canDrop && colCards.length === 0 ? '2px dashed #38B2AC' : undefined,
        borderRadius: isOver && canDrop && colCards.length === 0 ? 7 : undefined,
        transition: 'background 0.16s, border 0.16s'
      }}
    >
      <button className="btn" style={{ width: '100%', margin: '4px 0' }} onClick={() => setAdding(a => !a)}>
        + Add Card
      </button>

      {adding && (
        <form className="kanban-add-card-form" onSubmit={async (e) => {
          // Capture assignee BEFORE form reset inside handleAddCard
          const assigneeValue = (e.target?.assignee?.value || '').trim();
          await handleAddCard(e);
          try {
            if (assigneeValue) addKnownAssignee(assigneeValue);
          } catch { /* ignore storage issues */ }
        }}>
          <input name="feature" placeholder="Feature/Title" required autoComplete="off"/>
          <div className="kanban-form-grid">
            {/* Required: Select Kanban and Market columns for the new card */}
            <select
              name="kanban_column_id"
              defaultValue={String(column.id)}
              required
              className="styled-select"
              aria-label="Kanban Column"
              title="Select Kanban column"
            >
              <option value="" disabled>Select Kanban Column</option>
              {(columns || []).map(c => (
                <option key={c.id} value={String(c.id)}>{c.title}</option>
              ))}
            </select>
            <select
              name="market_kanban_column_id"
              defaultValue=""
              required
              className="styled-select"
              aria-label="Market Column"
              title="Select Market column"
            >
              <option value="" disabled>Select Market Column</option>
              {(marketColumns || []).map(mc => (
                <option key={mc.id} value={String(mc.id)}>{mc.title}</option>
              ))}
            </select>

            {/* Assignee with autocomplete suggestions */}
            <AssigneeAutocomplete
              name="assignee"
              placeholder="Assignee"
              className="styled-input"
              style={{ minWidth: 0 }}
              inputProps={{ 'aria-label': 'Assignee' }}
            />
            <select name="priority" defaultValue="" className="styled-select">
              <option value="">Priority</option>
              <option value="Low">Low</option>
              <option value="Medium">Medium</option>
              <option value="High">High</option>
              <option value="Critical">Critical</option>
            </select>
            <select name="status" defaultValue="" className="styled-select">
              <option value="">Status</option>
              <option value="To Do">To Do</option>
              <option value="In Progress">In Progress</option>
              <option value="Review">Review</option>
              <option value="Done">Done</option>
              <option value="On Hold">On Hold</option>
            </select>
            <input name="due_date" type="date" className="styled-input"/>

            {/* New fields */}
            <select name="impact" defaultValue="" className="styled-select" aria-label="Impact">
              <option value="">Impact</option>
              <option value="High Impact - Low Effort">High Impact - Low Effort</option>
              <option value="High Effort - Low Impact">High Effort - Low Impact</option>
              <option value="High Effort - High Impact">High Effort - High Impact</option>
              <option value="Low Effort - Low Impact">Low Effort - Low Impact</option>
            </select>
            <select name="market_need" defaultValue="" className="styled-select" aria-label="Market Need">
              <option value="">Market Need</option>
              <option value="Demand">Demand</option>
              <option value="USP">USP</option>
              <option value="Usability">Usability</option>
              <option value="Nice to Have">Nice to Have</option>
            </select>
            <input
              name="estimated_effort"
              type="number"
              min="0"
              step="1"
              placeholder="Est. Effort"
              className="styled-input"
              aria-label="Estimated Effort"
            />
            <select name="category" defaultValue="" className="styled-select" aria-label="Category">
              <option value="">Category</option>
              <option value="Feature">Feature</option>
              <option value="Enhancement">Enhancement</option>
              <option value="Feedback">Feedback</option>
            </select>
          </div>
          <textarea name="description" placeholder="Description" className="styled-input"/>
          <textarea name="notes" placeholder="Notes" className="styled-input"/>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn" type="submit">Add</button>
            <button className="btn" type="button" onClick={() => setAdding(false)}>Cancel</button>
          </div>
        </form>
      )}
      {colCards.map((card, i) => (
        <DnDKanbanCard
          key={card.id}
          card={card}
          index={i}
          column={column}
          colCards={colCards}
          isCompact={isCompact}
        />
      ))}
    </div>
  );
}

// DnDKanbanCard wraps KanbanCard with drag/drop capability

function DnDKanbanCard({ card, index, column, colCards, isCompact = false }) {
  const { updateCard } = useKanban();
  const { showToast } = useFeedback();

  // Drag setup
  const [{ isDragging }, drag] = useDrag({
    type: CARD_TYPE,
    item: () => ({
      type: CARD_TYPE,
      id: card.id,
      column_id: card.column_id,
      origIndex: index,
      card,
    }),
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  // Drop logic for reorder in this column or moving card to this column above/below
  const [{ isOver, canDrop }, drop] = useDrop({
    accept: CARD_TYPE,
    canDrop: (item) => item.id !== card.id,
    drop: async (item) => {
      if (item.id === card.id) return;
      if (item.column_id === column.id) {
        // Move within column (reorder)
        // To reorder: swap positions
        const movingCard = colCards.find(c => c.id === item.id);
        if (!movingCard) return;

        // Only adjust if not same position (no op)
        if (movingCard.position !== card.position) {
          // Compute new ordering: remove moving card, insert at drop index
          let newOrder = [...colCards];
          newOrder = newOrder.filter(c => c.id !== movingCard.id);

          // Find insert index
          const targetIndex = colCards.findIndex(c => c.id === card.id);
          newOrder.splice(targetIndex, 0, movingCard);

          // Renumber positions (1-based)
          for (let idx = 0; idx < newOrder.length; ++idx) {
            newOrder[idx] = { ...newOrder[idx], position: idx + 1 };
          }

          // Batch update
          try {
            await Promise.all(newOrder.map(c =>
              updateCard(c.id, { position: c.position })
            ));
          } catch (err) {
            showToast && showToast('Failed to reorder cards: ' + (err.message || err), "error");
          }
        }
      } else {
        // Move to new column at drop index (or append if not on a card)
        try {
          // Place above dropped card
          const toColCards = colCards.filter(c => c.id !== item.id);
          let insertIdx = toColCards.findIndex(c => c.id === card.id);
          if (insertIdx === -1) insertIdx = 0;
          // Insert and renumber
          const movingCard = { ...item.card, column_id: column.id };
          toColCards.splice(insertIdx, 0, movingCard);

          for (let idx = 0; idx < toColCards.length; ++idx) {
            toColCards[idx] = { ...toColCards[idx], position: idx + 1 };
          }
          // Update card being moved
          await updateCard(item.id, { column_id: column.id, position: insertIdx + 1 });
        } catch (err) {
          showToast && showToast('Failed to move card across columns: ' + (err.message || err), "error");
        }
      }
    },
    collect: (monitor) => ({
      isOver: monitor.isOver({ shallow: true }),
      canDrop: monitor.canDrop(),
    }),
  });

  // Use both refs for drag-n-drop
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
      <KanbanCard card={card} isCompact={isCompact} showMarketColumn />
    </div>
  );
}

export default CardList;
