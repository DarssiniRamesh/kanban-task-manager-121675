import React, { useState } from 'react';
import KanbanCard from './KanbanCard';
import { useKanban } from '../KanbanContext';
import { useDrop, useDrag } from 'react-dnd';
import { CARD_TYPE } from './dndTypes';
import { useFeedback } from '../KanbanBoard';
import AssigneeAutocomplete from './AssigneeAutocomplete';
import { addKnownAssignee } from '../utils/assignees';
import { useAuth } from '../auth/AuthContext';

/**
 * CardList supports dropping cards for intra-column reordering (vertical movement)
 * and renders cards with drag/hover context.
 */
function CardList({ column, cards: colCardsProp, isCompact = false }) {
  // colCards: sorted - passed in or computed
  const { cards, addCard, updateCard } = useKanban();
  const { canEdit } = useAuth();
  const [adding, setAdding] = useState(false);

  // Prefer passed colCards (sorted), but fallback for tests:
  const colCards = colCardsProp ||
    cards.filter(c => c.column_id === column.id).sort((a, b) => a.position - b.position);

  // For dropping a card into an empty column (or below/above all)
  const [{ isOver, canDrop }, drop] = useDrop({
    accept: CARD_TYPE,
    canDrop: (item) => !!canEdit && !!item,
    drop: async (item) => {
      if (!canEdit) return;
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
    const description = e.target.description.value;
    const assignee = e.target.assignee.value;
    const notes = e.target.notes.value;
    const priority = e.target.priority.value;
    const status = e.target.status.value;
    const due_date = e.target.due_date.value;
    await addCard(column.id, { feature, description, assignee, notes, priority, status, due_date });
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
      {canEdit ? (
        <>
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
              <input
                name="feature"
                placeholder="Feature/Title"
                required
                autoComplete="off"
                defaultValue="Sample Task"
              />
              <div className="kanban-form-grid">
                {/* Assignee with autocomplete suggestions */}
                <AssigneeAutocomplete
                  name="assignee"
                  placeholder="Assignee"
                  className="styled-input"
                  style={{ minWidth: 0 }}
                  inputProps={{ 'aria-label': 'Assignee' }}
                  defaultValue="Alice"
                />
                <select name="priority" defaultValue="High" className="styled-select">
                  <option value="">Priority</option>
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                  <option value="Critical">Critical</option>
                </select>
                <select name="status" defaultValue="To Do" className="styled-select">
                  <option value="">Status</option>
                  <option value="To Do">To Do</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Review">Review</option>
                  <option value="Done">Done</option>
                  <option value="On Hold">On Hold</option>
                </select>
                <input
                  name="due_date"
                  type="date"
                  className="styled-input"
                  defaultValue="2024-01-31"
                />
              </div>
              <textarea
                name="description"
                placeholder="Description"
                className="styled-input"
                defaultValue="Description here"
              />
              <textarea
                name="notes"
                placeholder="Notes"
                className="styled-input"
                defaultValue="Notes here"
              />
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn" type="submit">Add</button>
                <button className="btn" type="button" onClick={() => setAdding(false)}>Cancel</button>
              </div>
            </form>
          )}
        </>
      ) : (
        <div style={{ width: '100%', margin: '6px 0 10px', fontWeight: 800, opacity: 0.75 }}>
          Reader mode: cards are view-only.
        </div>
      )}
      {colCards.map((card, i) => (
        <DnDKanbanCard
          key={card.id}
          card={card}
          index={i}
          column={column}
          colCards={colCards}
          isCompact={isCompact}
          canEdit={canEdit}
        />
      ))}
    </div>
  );
}

// DnDKanbanCard wraps KanbanCard with drag/drop capability

function DnDKanbanCard({ card, index, column, colCards, isCompact = false, canEdit = true }) {
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
    canDrag: () => !!canEdit,
  });

  // Drop logic for reorder in this column or moving card to this column above/below
  const [{ isOver, canDrop }, drop] = useDrop({
    accept: CARD_TYPE,
    canDrop: (item) => !!canEdit && item.id !== card.id,
    drop: async (item) => {
      if (!canEdit) return;
      if (item.id === card.id) return;

      if (item.column_id === column.id) {
        // Move within column (reorder)
        const movingCard = colCards.find(c => c.id === item.id);
        if (!movingCard) return;

        if (movingCard.position !== card.position) {
          let newOrder = [...colCards];
          newOrder = newOrder.filter(c => c.id !== movingCard.id);

          const targetIndex = colCards.findIndex(c => c.id === card.id);
          newOrder.splice(targetIndex, 0, movingCard);

          for (let idx = 0; idx < newOrder.length; ++idx) {
            newOrder[idx] = { ...newOrder[idx], position: idx + 1 };
          }

          try {
            await Promise.all(newOrder.map(c =>
              updateCard(c.id, { position: c.position })
            ));
          } catch (err) {
            showToast && showToast('Failed to reorder cards: ' + (err.message || err), "error");
          }
        }
      } else {
        // Move to new column above dropped card
        try {
          const toColCards = colCards.filter(c => c.id !== item.id);
          let insertIdx = toColCards.findIndex(c => c.id === card.id);
          if (insertIdx === -1) insertIdx = 0;

          const movingCard = { ...item.card, column_id: column.id };
          toColCards.splice(insertIdx, 0, movingCard);

          for (let idx = 0; idx < toColCards.length; ++idx) {
            toColCards[idx] = { ...toColCards[idx], position: idx + 1 };
          }

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

  // Use both refs for drag-n-drop (Editor only)
  const ref = React.useRef(null);
  const attachRef = (node) => {
    ref.current = node;
    if (!node) return;
    if (!canEdit) return;
    drag(drop(node));
  };

  return (
    <div
      ref={attachRef}
      style={{
        opacity: isDragging ? 0.32 : 1,
        border: (isOver && canDrop) ? '2.5px solid #38B2AC' : undefined,
        boxShadow: isDragging ? '0 4px 18px 0 #38B2AC33' : undefined,
        background: (isOver && canDrop) ? '#13204e' : undefined,
        zIndex: isDragging ? 80 : 1,
        transition: 'background .15s, border .15s, opacity .14s, box-shadow .16s'
      }}
    >
      <KanbanCard card={card} isCompact={isCompact} canEdit={canEdit} />
    </div>
  );
}

export default CardList;
