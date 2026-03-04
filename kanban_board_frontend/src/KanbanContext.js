import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { getSupabaseClient } from './kanbanSupabase';
import { syncCardsFromCsvText } from './flows/cardsCsvSyncFlow';
import {
  createPreSyncSnapshotForCsv,
  finalizePostSyncSnapshot,
  getLatestCsvSyncSnapshot,
  undoLastCsvSync,
} from './flows/csvSyncUndoFlow';

// Supabase tables: kanban_columns, kanban_cards
// NOTE: Column archiving is UI-only (client-side state). No Supabase schema/persistence is used.

const KanbanContext = createContext();

export function useKanban() {
  return useContext(KanbanContext);
}

const UI_ARCHIVED_COLUMNS_STORAGE_KEY = 'kanban.ui.archivedColumnIds.v1';

/**
 * Parse archived column IDs from localStorage.
 * Contract:
 * - Input: window.localStorage entry value (string|null)
 * - Output: Set<string> of column IDs
 * - Errors: never throws (returns empty Set on parse/validation failure)
 */
function safeLoadArchivedColumnIds() {
  try {
    const raw = localStorage.getItem(UI_ARCHIVED_COLUMNS_STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    const ids = parsed
      .map(v => (v == null ? null : String(v)))
      .filter(Boolean);
    return new Set(ids);
  } catch {
    return new Set();
  }
}

/**
 * Persist archived column IDs to localStorage.
 * Contract:
 * - Input: Set<string> of column IDs
 * - Side effect: writes localStorage; never throws
 */
function safeSaveArchivedColumnIds(idSet) {
  try {
    localStorage.setItem(UI_ARCHIVED_COLUMNS_STORAGE_KEY, JSON.stringify(Array.from(idSet)));
  } catch {
    // ignore (e.g., private browsing / quota / disabled storage)
  }
}

// PUBLIC_INTERFACE
export function KanbanProvider({ children }) {
  const supabase = getSupabaseClient();

  const [columns, setColumns] = useState([]);
  const [cards, setCards] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // UI-only archived state (Set of string IDs)
  const [archivedColumnIds, setArchivedColumnIds] = useState(() => {
    if (typeof window === 'undefined') return new Set();
    return safeLoadArchivedColumnIds();
  });

  // Persist archived state changes
  useEffect(() => {
    if (typeof window === 'undefined') return;
    safeSaveArchivedColumnIds(archivedColumnIds);
  }, [archivedColumnIds]);

  /**
   * Flow name: ColumnArchiveUiStateFlow
   * Entrypoints: archiveColumn(id), unarchiveColumn(id), toggleColumnArchived(id, desired)
   *
   * Contract:
   * - Inputs: column id (string|number); desired (boolean)
   * - Output: null (always) to keep UI code simple; errors are surfaced via console for debug.
   * - Side effects: updates local React state + localStorage (best-effort).
   */
  const toggleColumnArchived = useCallback((id, desired) => {
    const colId = id == null ? null : String(id);
    if (!colId) {
      // eslint-disable-next-line no-console
      console.warn('[ColumnArchiveUiStateFlow] Ignored toggle: missing column id', { id, desired });
      return;
    }

    setArchivedColumnIds(prev => {
      const next = new Set(prev);
      if (desired) next.add(colId);
      else next.delete(colId);
      return next;
    });
  }, []);

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

  // Column CRUD
  const addColumn = async (title) => {
    const newPos = columns.length ? Math.max(...columns.map(c => c.position)) + 1 : 1;
    // UI-only archiving: do not write is_archived (no schema dependency).
    let { error } = await supabase
      .from('kanban_columns')
      .insert({ title, position: newPos });
    await fetchAll();
    return error;
  };

  const updateColumn = async (id, updates) => {
    // UI-only archiving: never persist is_archived even if a caller accidentally sends it.
    const { is_archived, ...safeUpdates } = (updates || {});
    let { error } = await supabase.from('kanban_columns').update(safeUpdates).eq('id', id);
    await fetchAll();
    return error;
  };

  // PUBLIC_INTERFACE
  const archiveColumn = async (id) => {
    /** UI-only: archives a column locally (no Supabase write). */
    toggleColumnArchived(id, true);
    return null;
  };

  // PUBLIC_INTERFACE
  const unarchiveColumn = async (id) => {
    /** UI-only: restores an archived column locally (no Supabase write). */
    toggleColumnArchived(id, false);
    return null;
  };

  const deleteColumn = async (id) => {
    let { error } = await supabase.from('kanban_columns').delete().eq('id', id);

    // Keep UI-only archived state consistent if the column is deleted.
    toggleColumnArchived(id, false);

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
  const syncCardsFromCsv = useCallback(async (csvText) => {
    /**
     * Flow name: CardsCsvRoundTripSyncFlow (KanbanContext boundary)
     *
     * Contract:
     * - Input: csvText string (must contain id + column_id headers)
     * - Output: { result, error }
     *   - result: { totalRows, upserted, warnings }
     *   - error: string|null
     * - Errors: caught and mapped into { error } for UI code; context `error` state is also set.
     * - Side effects: upserts to Supabase via shared flow + refreshes local state via fetchAll().
     */
    setError(null);
    try {
      const result = await syncCardsFromCsvText(csvText);
      await fetchAll();
      return { result, error: null };
    } catch (e) {
      const msg = e?.message || String(e);
      // eslint-disable-next-line no-console
      console.error('[KanbanContext.syncCardsFromCsv] Failed', { msg, e });
      setError(msg);
      return { result: null, error: msg };
    }
  }, [fetchAll]);

  // PUBLIC_INTERFACE
  const syncCardsFromCsvWithUndo = useCallback(async (csvText) => {
    /**
     * Flow name: CardsCsvSyncWithUndoFlow (KanbanContext boundary)
     *
     * Contract:
     * - Input:
     *   - csvText: string (must include id header)
     * - Output:
     *   - { result, snapshot, error }
     *     - result: { totalRows, upserted, warnings } (from import flow)
     *     - snapshot: { createdAt, affectedIds, createdIds, ... } (undo metadata) or null
     *     - error: string|null
     * - Errors:
     *   - all exceptions are caught and mapped to { error } for UI
     * - Side effects:
     *   - reads Supabase cards (snapshot)
     *   - upserts Supabase cards (sync)
     *   - reads Supabase cards again (finalize createdIds)
     *   - refreshes local state via fetchAll()
     */
    setError(null);
    try {
      const snapshot = await createPreSyncSnapshotForCsv({ csvText, label: 'CSV Re-import/Sync' });
      const result = await syncCardsFromCsvText(csvText);
      const finalized = await finalizePostSyncSnapshot(snapshot);

      await fetchAll();
      return { result, snapshot: finalized, error: null };
    } catch (e) {
      const msg = e?.message || String(e);
      // eslint-disable-next-line no-console
      console.error('[KanbanContext.syncCardsFromCsvWithUndo] Failed', { msg, e });
      setError(msg);
      return { result: null, snapshot: null, error: msg };
    }
  }, [fetchAll]);

  // PUBLIC_INTERFACE
  const undoLastCsvSyncRestore = useCallback(async () => {
    /**
     * Flow name: CardsCsvSyncUndoBoundary (KanbanContext boundary)
     *
     * Contract:
     * - Input: none (uses latest snapshot from storage)
     * - Output: { result, error }
     *   - result: { restored: number, deleted: number, snapshotCreatedAt: string|null }
     * - Side effects:
     *   - updates/deletes cards in Supabase
     *   - refreshes local state via fetchAll()
     */
    setError(null);
    try {
      const snap = getLatestCsvSyncSnapshot();
      const { restored, deleted } = await undoLastCsvSync();
      await fetchAll();
      return {
        result: { restored, deleted, snapshotCreatedAt: snap?.createdAt || null },
        error: null,
      };
    } catch (e) {
      const msg = e?.message || String(e);
      // eslint-disable-next-line no-console
      console.error('[KanbanContext.undoLastCsvSyncRestore] Failed', { msg, e });
      setError(msg);
      return { result: null, error: msg };
    }
  }, [fetchAll]);

  // Derive active vs archived columns purely from UI state (no backend field).
  const activeColumns = useMemo(() => {
    const archived = archivedColumnIds || new Set();
    return (columns || []).filter(c => !archived.has(String(c.id)));
  }, [columns, archivedColumnIds]);

  const archivedColumns = useMemo(() => {
    const archived = archivedColumnIds || new Set();
    return (columns || []).filter(c => archived.has(String(c.id)));
  }, [columns, archivedColumnIds]);

  // PUBLIC_INTERFACE
  return (
    <KanbanContext.Provider
      value={{
        // Keep the original `columns` for compatibility, but add helpers for UI.
        columns,
        activeColumns,
        archivedColumns,
        cards,
        isLoading,
        error,
        fetchAll,
        addColumn,
        updateColumn,
        archiveColumn,
        unarchiveColumn,
        deleteColumn,
        reorderColumns,
        addCard,
        updateCard,
        deleteCard,
        reorderCardsInColumn,
        bulkInsertCards,
        syncCardsFromCsv,
        syncCardsFromCsvWithUndo,
        undoLastCsvSyncRestore,
      }}
    >
      {children}
    </KanbanContext.Provider>
  );
}
