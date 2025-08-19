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
  const [marketColumns, setMarketColumns] = useState([]);
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

    const marketColumnsSub = supabase
      .channel('market-columns-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'market_kanban_columns' }, fetchAll)
      .subscribe();

    return () => {
      supabase.removeChannel(columnsSub);
      supabase.removeChannel(cardsSub);
      supabase.removeChannel(marketColumnsSub);
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

      const { data: marketColumnData, error: mkErr } = await supabase
        .from('market_kanban_columns')
        .select('*')
        .order('position', { ascending: true });

      if (mkErr) throw mkErr;

      setColumns(columnData || []);
      setMarketColumns(marketColumnData || []);
      setCards(cardData || []);
    } catch (e) {
      setError(e.message || 'Supabase error');
    } finally {
      setIsLoading(false);
    }
  }, [supabase]);

  // Column CRUD
  const addColumn = async (title) => {
    // Compute next position safely, ignoring null/undefined/non-numeric values
    const positions = (columns || [])
      .map(c => Number(c.position))
      .filter(n => Number.isFinite(n));
    const newPos = positions.length > 0 ? Math.max(...positions) + 1 : 1;

    const { error } = await supabase.from('kanban_columns').insert({ title, position: newPos });
    if (error) {
      setError(error.message || 'Failed to add column');
    }
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

  // Market Column CRUD
  const addMarketColumn = async (title) => {
    // Compute next market-column position safely
    const positions = (marketColumns || [])
      .map(c => Number(c.position))
      .filter(n => Number.isFinite(n));
    const newPos = positions.length > 0 ? Math.max(...positions) + 1 : 1;

    const { error } = await supabase.from('market_kanban_columns').insert({ title, position: newPos });
    if (error) {
      setError(error.message || 'Failed to add market column');
    }
    await fetchAll();
    return error;
  };
  const updateMarketColumn = async (id, updates) => {
    let { error } = await supabase.from('market_kanban_columns').update(updates).eq('id', id);
    await fetchAll();
    return error;
  };
  const deleteMarketColumn = async (id) => {
    let { error } = await supabase.from('market_kanban_columns').delete().eq('id', id);
    await fetchAll();
    return error;
  };
  const reorderMarketColumns = async (orderedList) => {
    const deduped = [];
    const seen = {};
    (orderedList || []).forEach((item, i) => {
      if (item.id && !seen[item.id]) {
        deduped.push({ id: item.id, position: i + 1 });
        seen[item.id] = true;
      }
    });
    const updates = deduped.map(({ id, position }) =>
      supabase.from('market_kanban_columns').update({ position }).eq('id', id)
    );
    await Promise.all(updates);
    await fetchAll();
  };

  // Card CRUD
  const addCard = async (column_id, cardFields) => {
    // cardFields: {feature, description...}
    const filtered = { ...cardFields, column_id };

    // Find safe max position in the target column
    const positions = (cards || [])
      .filter(c => c.column_id === column_id)
      .map(c => Number(c.position))
      .filter(n => Number.isFinite(n));
    const maxPos = positions.length > 0 ? Math.max(...positions) : 0;

    filtered.position = maxPos + 1;
    const { error } = await supabase.from('kanban_cards').insert(filtered);
    if (error) {
      setError(error.message || 'Failed to add card');
    }
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
  /**
   * Import mixed set of rows: updates existing cards by ID (only changed fields) and
   * appends new cards to the specified Product (Kanban) column. Prevents duplicates
   * both within the uploaded file and against existing cards in the target column
   * (using a signature of feature|assignee|description).
   *
   * @param {number|string} column_id - Product/Kanban column to append new cards into.
   * @param {Array<Object>} rows - Parsed rows from Excel/CSV with optional 'id' and card fields.
   * @param {number|string} [market_column_id] - Market column to assign to newly inserted cards.
   * @returns {{updatedCount?:number, insertedCount?:number, skippedDuplicates?:number, error?:string}}
   */
  // PUBLIC_INTERFACE
  const importCards = async (column_id, rows, market_column_id) => {
    try {
      const allowedFields = [
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

      // Build lookups for efficient operations
      const existingById = new Map(cards.map(c => [String(c.id), c]));
      const existingSig = new Set(
        cards
          .filter(c => c.column_id === column_id)
          .map(c => `${(c.feature || '').trim().toLowerCase()}|${(c.assignee || '').trim().toLowerCase()}|${(c.description || '').trim().toLowerCase()}`)
      );

      const seenSig = new Set();
      const updates = [];
      const inserts = [];
      let skippedDuplicates = 0;

      const normalizeRow = (r) => {
        const o = {};
        allowedFields.forEach(k => {
          if (r[k] !== undefined) o[k] = r[k];
        });
        // Normalize estimated_effort
        if (o.estimated_effort !== undefined) {
          const parsed = parseInt(o.estimated_effort, 10);
          o.estimated_effort = Number.isNaN(parsed) ? null : parsed;
        }
        // Trim strings
        Object.keys(o).forEach(k => {
          if (typeof o[k] === 'string') o[k] = o[k].trim();
        });
        return o;
      };

      for (const r of rows || []) {
        const row = normalizeRow(r);
        const hasId = r.id !== undefined && r.id !== null && String(r.id).trim() !== '';
        if (hasId) {
          const idKey = String(r.id);
          const existing = existingById.get(idKey);
          if (!existing) {
            // No existing with this ID; treat as potential new insert
            const sig = `${(row.feature || '').trim().toLowerCase()}|${(row.assignee || '').trim().toLowerCase()}|${(row.description || '').trim().toLowerCase()}`;
            if (!row.feature || seenSig.has(sig) || existingSig.has(sig)) {
              skippedDuplicates++;
              continue;
            }
            seenSig.add(sig);
            const toInsert = { ...row };
            delete toInsert.id;
            inserts.push(toInsert);
          } else {
            // Compute field-by-field diff
            const diff = {};
            for (const k of allowedFields) {
              if (k in row) {
                if (k === 'estimated_effort') {
                  const cnum = existing[k] === null || existing[k] === undefined ? null : Number(existing[k]);
                  const nnum = row[k] === null || row[k] === '' || row[k] === undefined ? null : Number(row[k]);
                  if (cnum !== nnum) diff[k] = nnum;
                } else {
                  const curr = existing[k] === undefined || existing[k] === null ? '' : String(existing[k]);
                  const next = row[k] === undefined || row[k] === null ? '' : String(row[k]);
                  if (curr !== next) diff[k] = row[k];
                }
              }
            }
            if (Object.keys(diff).length > 0) {
              updates.push({ id: existing.id, updates: diff });
            }
          }
        } else {
          // New card candidate
          const sig = `${(row.feature || '').trim().toLowerCase()}|${(row.assignee || '').trim().toLowerCase()}|${(row.description || '').trim().toLowerCase()}`;
          if (!row.feature || seenSig.has(sig) || existingSig.has(sig)) {
            skippedDuplicates++;
            continue;
          }
          seenSig.add(sig);
          inserts.push(row);
        }
      }

      // Perform updates (only when there is something to change)
      if (updates.length > 0) {
        await Promise.all(
          updates.map(u => supabase.from('kanban_cards').update(u.updates).eq('id', u.id))
        );
      }

      // Perform inserts in one batch with sequential positions
      let insertedCount = 0;
      if (inserts.length > 0) {
        const existingCardsForColumn = cards.filter(c => c.column_id === column_id);
        const maxPos = existingCardsForColumn.length > 0
          ? Math.max(...existingCardsForColumn.map(c => c.position || 0))
          : 0;
        const payload = inserts.map((card, idx) => ({
          ...card,
          column_id,
          position: maxPos + idx + 1,
          ...(market_column_id ? { market_kanban_column_id: market_column_id } : {}),
        }));
        const { error: insertError } = await supabase.from('kanban_cards').insert(payload);
        if (insertError) {
          setError(insertError.message || 'Import insert error');
        } else {
          insertedCount = payload.length;
        }
      }

      await fetchAll();

      return {
        updatedCount: updates.length,
        insertedCount,
        skippedDuplicates,
      };
    } catch (e) {
      setError(e.message || 'Import error');
      return { error: e.message || String(e) };
    }
  };

  // PUBLIC_INTERFACE
  return (
    <KanbanContext.Provider
      value={{
        columns,
        marketColumns,
        cards,
        isLoading,
        error,
        fetchAll,
        addColumn,
        updateColumn,
        deleteColumn,
        reorderColumns,
        addMarketColumn,
        updateMarketColumn,
        deleteMarketColumn,
        reorderMarketColumns,
        addCard,
        updateCard,
        deleteCard,
        reorderCardsInColumn,
        bulkInsertCards,
        importCards,
      }}
    >
      {children}
    </KanbanContext.Provider>
  );
}
