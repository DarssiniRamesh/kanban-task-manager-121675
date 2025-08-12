import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { getSupabaseClient } from './kanbanSupabase';

// Supabase tables: kanban_columns, kanban_cards

const KanbanContext = createContext();

export function useKanban() {
  return useContext(KanbanContext);
}

// PUBLIC_INTERFACE
export function KanbanProvider({ children }) {
  const supabase = getSupabaseClient();

  const [columns, setColumns] = useState([]);
  const [cards, setCards] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Real-time subscription effect
  useEffect(() => {
    fetchAll();

    // Set up real-time subscriptions for both tables
    const columnsSub = supabase
      .channel('columns-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'kanban_columns' }, fetchAll)
      .subscribe();

    const cardsSub = supabase
      .channel('cards-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'kanban_cards' }, fetchAll)
      .subscribe();

    return () => {
      supabase.removeChannel(columnsSub);
      supabase.removeChannel(cardsSub);
    };
    // eslint-disable-next-line
  }, []); // One subscription per mount

  // Fetch all board data (columns + cards)
  const fetchAll = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { data: columnData, error: colErr } = await supabase
        .from('kanban_columns')
        .select('*')
        .order('position', { ascending: true });

      if (colErr) throw colErr;

      const { data: cardData, error: cardErr } = await supabase
        .from('kanban_cards')
        .select('*')
        .order('position', { ascending: true });

      if (cardErr) throw cardErr;

      setColumns(columnData || []);
      setCards(cardData || []);
    } catch (e) {
      setError(e.message || 'Supabase error');
    } finally {
      setIsLoading(false);
    }
  }, [supabase]);

  // Column CRUD
  const addColumn = async (title) => {
    const newPos = columns.length ? Math.max(...columns.map(c=>c.position)) + 1 : 1;
    let { error } = await supabase.from('kanban_columns').insert({ title, position: newPos });
    await fetchAll();
    return error;
  };
  const updateColumn = async (id, updates) => {
    let { error } = await supabase.from('kanban_columns').update(updates).eq('id', id);
    await fetchAll();
    return error;
  };
  const deleteColumn = async (id) => {
    let { error } = await supabase.from('kanban_columns').delete().eq('id', id);
    await fetchAll();
    return error;
  };
  const reorderColumns = async (orderedList) => {
    // Takes [{id, position}]
    // Guarantee unique/contiguous positions: 1-based index in order of orderedList
    const deduped = [];
    const seen = {};
    orderedList.forEach((item, i) => {
      if (item.id && !seen[item.id]) {
        deduped.push({ id: item.id, position: i + 1 });
        seen[item.id] = true;
      }
    });
    const updates = deduped.map(({ id, position }) =>
      supabase.from('kanban_columns').update({ position }).eq('id', id)
    );
    await Promise.all(updates);
    await fetchAll();
  };

  // Card CRUD
  const addCard = async (column_id, cardFields) => {
    // cardFields: {feature, description...}
    const filtered = { ...cardFields, column_id };
    const maxPos = Math.max(0, ...cards.filter(c=>c.column_id === column_id).map(c=>c.position));
    filtered.position = maxPos + 1;
    let { error } = await supabase.from('kanban_cards').insert(filtered);
    await fetchAll();
    return error;
  };
  const updateCard = async (id, updates) => {
    let { error } = await supabase.from('kanban_cards').update(updates).eq('id', id);
    await fetchAll();
    return error;
  };
  // PUBLIC_INTERFACE
  const deleteCard = async (id) => {
    // Immediate, accurate feedback: Remove from local state on API success, error only on Supabase API error.
    let errorMsg = null;
    let prevCards = [...cards];
    try {
      // Execute Supabase delete first, only update UI if successful
      const { error } = await supabase.from('kanban_cards').delete().eq('id', id);

      if (error) {
        // Do not modify state: show error only if API returns error
        // eslint-disable-next-line no-console
        console.error('[KanbanContext.deleteCard] Supabase delete error:', error);
        errorMsg = error.message || 'Failed to delete card from Supabase.';
        setError(errorMsg);
        return errorMsg;
      }

      // API success: now remove the card immediately from local UI/state
      setCards(cs => cs.filter(card => card.id !== id));

      // Optionally, keep fetchAll for later consistency (do not base error on fetchAll)
      fetchAll();

      setError(null);
      return null;
    } catch (e) {
      // Rollback local state on error
      setCards(prevCards);
      errorMsg = e.message || 'Unexpected error occurred during card delete.';
      // eslint-disable-next-line no-console
      console.error('[KanbanContext.deleteCard] Exception thrown:', e);
      setError(errorMsg);
      return errorMsg;
    }
  };
  const reorderCardsInColumn = async (column_id, orderedList) => {
    // orderedList: [{id, position}]
    const updates = orderedList.map(({ id, position }) =>
      supabase.from('kanban_cards').update({ position, column_id }).eq('id', id)
    );
    await Promise.all(updates);
    await fetchAll();
  };

  // Bulk card insert
  const bulkInsertCards = async (column_id, cardsArray) => {
    // cardsArray: array of card objects
    // eslint-disable-next-line no-console
    console.log("[KanbanContext.bulkInsertCards] Invoked with column_id", column_id, ", cardsArray (up to 3):", cardsArray.slice(0,3));

    // Defensive: check structure before sending
    if (!Array.isArray(cardsArray) || cardsArray.length === 0) {
      // eslint-disable-next-line no-console
      console.log("[KanbanContext.bulkInsertCards] No cards to insert (empty array).");
      setError("No cards to insert.");
      return { message: "No cards to insert" };
    }

    // Find the current max position in this column
    const existingCardsForColumn = cards.filter(c => c.column_id === column_id);
    const maxExistingPos = existingCardsForColumn.length > 0
        ? Math.max(...existingCardsForColumn.map(c => c.position || 0))
        : 0;

    // Assign positions sequentially after the last current card's position
    let payload = cardsArray.map((card, idx) => ({
      ...card,
      column_id,
      position: maxExistingPos + idx + 1,
    }));

    // Print the full payload (if not huge)
    // eslint-disable-next-line no-console
    console.log("[KanbanContext.bulkInsertCards] Final payload (truncated):", payload.slice(0, 5), "(total:", payload.length, ")");
    let result = await supabase.from('kanban_cards').insert(payload);
    let { error, data, status } = result;
    // Log all output for full diagnostics
    // eslint-disable-next-line no-console
    console.log("[KanbanContext.bulkInsertCards] Supabase insert result:", {error, data, status});
    if (error) {
      // Log Supabase error for diagnostic purposes
      // eslint-disable-next-line no-console
      console.error('Supabase bulkInsertCards() error:', error, { column_id, cardsArray, payload, data, status });
      setError(error.message || "Bulk insert error: unable to add cards. Please check your field mapping (due_date format, required fields, etc).");
    } else {
      setError(null);
    }
    await fetchAll();
    return error;
  };

  // PUBLIC_INTERFACE
  return (
    <KanbanContext.Provider
      value={{
        columns,
        cards,
        isLoading,
        error,
        fetchAll,
        addColumn,
        updateColumn,
        deleteColumn,
        reorderColumns,
        addCard,
        updateCard,
        deleteCard,
        reorderCardsInColumn,
        bulkInsertCards,
      }}
    >
      {children}
    </KanbanContext.Provider>
  );
}
