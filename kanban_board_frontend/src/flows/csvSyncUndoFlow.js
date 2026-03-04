import { getSupabaseClient } from '../kanbanSupabase';

/**
 * Flow name: CardsCsvSyncUndoFlow
 *
 * Purpose:
 * - Provide a durable Undo mechanism for the CSV Re-import/Sync (upsert-by-id) flow.
 * - Before sync, snapshot the database state for all card IDs present in the CSV.
 * - After sync, compute newly created rows (ids that didn't exist pre-sync) and store them too.
 * - On Undo, restore the snapshot via Supabase updates and delete any newly-created rows.
 *
 * Storage:
 * - Best-effort persistence to localStorage (so user can undo after refresh).
 * - Also cached in-memory for speed.
 *
 * Security / Access control:
 * - This flow is intended to be gated by role at the UI boundary (Editor-only).
 * - Server-side RLS should still enforce permissions if enabled.
 *
 * Failure modes (top):
 * 1) Snapshot cannot be created because Supabase read fails -> sync should be blocked and user notified.
 * 2) Undo fails because some cards were deleted/changed by others -> surfaced as error with context; partial restore attempted.
 * 3) localStorage unavailable/quota -> flow still works in-memory for the current session.
 */

const FLOW = 'CardsCsvSyncUndoFlow';
const STORAGE_KEY = 'kanban.csvSyncUndo.snapshot.v1';

// In-memory cache of the latest snapshot for fast access.
let _latestSnapshot = null;

/**
 * Best-effort structured logging helper.
 */
function log(level, message, ctx = {}) {
  // eslint-disable-next-line no-console
  const fn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
  fn(`[${FLOW}] ${message}`, ctx);
}

/**
 * Minimal safe JSON parse. Never throws.
 */
function safeJsonParse(raw) {
  try {
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Best-effort localStorage read.
 */
function safeLoadFromStorage() {
  try {
    if (typeof window === 'undefined') return null;
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return safeJsonParse(raw);
  } catch {
    return null;
  }
}

/**
 * Best-effort localStorage write.
 */
function safeSaveToStorage(snapshot) {
  try {
    if (typeof window === 'undefined') return;
    if (!snapshot) window.localStorage.removeItem(STORAGE_KEY);
    else window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // ignore (quota/private mode)
  }
}

/**
 * Best-effort localStorage clear.
 */
function safeClearStorage() {
  safeSaveToStorage(null);
}

/**
 * Normalize a value into a trimmed string id (or null).
 */
function normalizeId(v) {
  const s = v == null ? '' : String(v).trim();
  return s ? s : null;
}

/**
 * Parse the CSV header and extract all ids from the `id` column.
 *
 * Contract:
 * - Input: csvText string
 * - Output: { ids: string[], totalRows: number }
 * - Errors: throws if missing `id` header or no data rows
 *
 * Notes:
 * - This intentionally uses a simple CSV split (consistent with Toolbar preview behavior).
 * - For correctness, the actual import flow is authoritative; this is just to determine affected IDs.
 */
// PUBLIC_INTERFACE
export function extractCardIdsFromCsvText(csvText) {
  /** Extracts card IDs referenced by a CSV to determine snapshot scope for undo. */
  const normalized = String(csvText || '');
  const lines = normalized.split(/\r?\n/).filter(Boolean);
  if (lines.length === 0) throw new Error('CSV file is empty.');

  const header = (lines[0] || '')
    .split(',')
    .map((h) => String(h || '').trim().replace(/^"|"$/g, ''));

  const idIdx = header.indexOf('id');
  if (idIdx < 0) {
    throw new Error('CSV is missing required column "id".');
  }

  const idsSet = new Set();
  for (let i = 1; i < lines.length; i += 1) {
    const parts = (lines[i] || '').split(',');
    const id = normalizeId(parts[idIdx]);
    if (id) idsSet.add(id);
  }

  const ids = Array.from(idsSet);
  if (ids.length === 0) {
    throw new Error('CSV contains no data rows with an "id" value.');
  }

  return { ids, totalRows: Math.max(0, lines.length - 1) };
}

/**
 * Fetch existing cards by id from Supabase.
 *
 * Contract:
 * - Input: ids: string[]
 * - Output: Array<cardRecord> (only existing rows)
 * - Errors: throws Error if Supabase read fails
 */
async function fetchExistingCardsByIds(ids) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('kanban_cards')
    .select('*')
    .in('id', ids);

  if (error) {
    throw new Error(`Supabase read failed (kanban_cards snapshot): ${error.message || 'unknown error'}`);
  }
  return Array.isArray(data) ? data : [];
}

/**
 * Snapshot object schema (stored in localStorage):
 * {
 *   version: 1,
 *   createdAt: string (ISO),
 *   label: string,
 *   csv: { totalRows: number, idsCount: number },
 *   affectedIds: string[],
 *   // Only those that existed pre-sync (full row snapshots)
 *   previousById: Record<string, object>,
 *   // Filled after sync: ids that were newly created by the upsert
 *   createdIds: string[],
 * }
 */

/**
 * PUBLIC_INTERFACE
 * createPreSyncSnapshotForCsv
 *
 * Contract:
 * - Inputs:
 *   - csvText: string (must include `id` header)
 *   - label?: string (for UI display)
 * - Output:
 *   - snapshot object (see schema above)
 * - Errors:
 *   - throws Error on validation failures or Supabase read failure
 * - Side effects:
 *   - saves snapshot to in-memory cache + localStorage (best-effort)
 */
// PUBLIC_INTERFACE
export async function createPreSyncSnapshotForCsv({ csvText, label = 'CSV Sync' }) {
  /** Creates and persists a pre-sync snapshot for all cards referenced by the CSV (by id). */
  log('info', 'snapshot.create.begin', { label });

  const { ids, totalRows } = extractCardIdsFromCsvText(csvText);

  const existing = await fetchExistingCardsByIds(ids);
  const previousById = {};
  existing.forEach((row) => {
    const id = normalizeId(row?.id);
    if (id) previousById[id] = row;
  });

  const snapshot = {
    version: 1,
    createdAt: new Date().toISOString(),
    label,
    csv: { totalRows, idsCount: ids.length },
    affectedIds: ids,
    previousById,
    createdIds: [],
  };

  _latestSnapshot = snapshot;
  safeSaveToStorage(snapshot);

  log('info', 'snapshot.create.success', {
    affectedIds: ids.length,
    preExisting: Object.keys(previousById).length,
  });

  return snapshot;
}

/**
 * PUBLIC_INTERFACE
 * finalizePostSyncSnapshot
 *
 * Purpose:
 * - After the sync completes, compute createdIds by comparing current DB to previousById.
 *
 * Contract:
 * - Inputs:
 *   - snapshot: snapshot object returned by createPreSyncSnapshotForCsv
 * - Output:
 *   - updated snapshot (same object shape)
 * - Errors:
 *   - throws Error if Supabase read fails
 * - Side effects:
 *   - updates snapshot in-memory + localStorage
 */
// PUBLIC_INTERFACE
export async function finalizePostSyncSnapshot(snapshot) {
  /** Finalizes a snapshot after sync by detecting created rows (for correct undo delete). */
  const snap = snapshot || _latestSnapshot || safeLoadFromStorage();
  if (!snap) throw new Error('No CSV sync snapshot exists to finalize.');

  const affectedIds = Array.isArray(snap.affectedIds) ? snap.affectedIds : [];
  if (affectedIds.length === 0) throw new Error('Snapshot is invalid: missing affectedIds.');

  log('info', 'snapshot.finalize.begin', { affectedIds: affectedIds.length });

  const after = await fetchExistingCardsByIds(affectedIds);
  const afterIds = new Set(after.map((r) => normalizeId(r?.id)).filter(Boolean));
  const preExistingIds = new Set(Object.keys(snap.previousById || {}));

  const createdIds = [];
  afterIds.forEach((id) => {
    if (!preExistingIds.has(id)) createdIds.push(id);
  });

  const updated = { ...snap, createdIds };
  _latestSnapshot = updated;
  safeSaveToStorage(updated);

  log('info', 'snapshot.finalize.success', { createdIds: createdIds.length });

  return updated;
}

/**
 * PUBLIC_INTERFACE
 * getLatestCsvSyncSnapshot
 *
 * Contract:
 * - Output: snapshot|null
 * - Side effects: none
 */
// PUBLIC_INTERFACE
export function getLatestCsvSyncSnapshot() {
  /** Returns the latest available CSV sync snapshot (in-memory preferred, else localStorage). */
  if (_latestSnapshot) return _latestSnapshot;
  const stored = safeLoadFromStorage();
  if (stored) _latestSnapshot = stored;
  return stored || null;
}

/**
 * PUBLIC_INTERFACE
 * clearLatestCsvSyncSnapshot
 *
 * Contract:
 * - Side effects: clears in-memory + localStorage snapshot
 */
// PUBLIC_INTERFACE
export function clearLatestCsvSyncSnapshot() {
  /** Clears the latest snapshot so Undo is no longer offered. */
  _latestSnapshot = null;
  safeClearStorage();
}

/**
 * Restore previous rows (updates) and delete newly created rows.
 *
 * Implementation notes:
 * - We do best-effort batching (chunk size) to avoid payload limits.
 * - We update each row by id using a bulk upsert of the previous snapshots (authoritative pre-sync state).
 * - We delete created rows by id.
 */

// Reasonable chunk size for REST payload; keeps requests smaller.
const CHUNK_SIZE = 100;

function chunkArray(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function bulkUpsertRows(rows) {
  if (!rows.length) return;
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('kanban_cards')
    .upsert(rows, { onConflict: 'id', ignoreDuplicates: false });

  if (error) throw new Error(`Supabase restore upsert failed: ${error.message || 'unknown error'}`);
}

async function bulkDeleteByIds(ids) {
  if (!ids.length) return;
  const supabase = getSupabaseClient();
  const { error } = await supabase.from('kanban_cards').delete().in('id', ids);
  if (error) throw new Error(`Supabase restore delete failed: ${error.message || 'unknown error'}`);
}

/**
 * PUBLIC_INTERFACE
 * undoLastCsvSync
 *
 * Contract:
 * - Inputs:
 *   - snapshot?: snapshot object (optional; defaults to latest cached)
 * - Output:
 *   - { restored: number, deleted: number }
 * - Errors:
 *   - throws Error with user-facing message when restore fails
 * - Side effects:
 *   - writes to Supabase:
 *      - updates (upserts) the pre-sync rows back to their old state
 *      - deletes any rows created by the sync
 *   - clears snapshot from cache/storage on success
 */
// PUBLIC_INTERFACE
export async function undoLastCsvSync({ snapshot } = {}) {
  /** Restores the DB state to exactly what it was before the last CSV sync (for affected ids). */
  const snap = snapshot || getLatestCsvSyncSnapshot();
  if (!snap) throw new Error('Nothing to undo (no CSV sync snapshot found).');

  const previousById = snap.previousById || {};
  const previousRows = Object.values(previousById);
  const createdIds = Array.isArray(snap.createdIds) ? snap.createdIds : [];

  log('info', 'undo.begin', {
    preExisting: previousRows.length,
    createdIds: createdIds.length,
    createdAt: snap.createdAt,
    label: snap.label,
  });

  try {
    // 1) Restore previous rows
    const restoreChunks = chunkArray(previousRows, CHUNK_SIZE);
    for (let i = 0; i < restoreChunks.length; i += 1) {
      log('info', 'undo.restoreChunk.begin', { chunk: i + 1, chunks: restoreChunks.length });
      // eslint-disable-next-line no-await-in-loop
      await bulkUpsertRows(restoreChunks[i]);
    }

    // 2) Delete rows created by the sync
    const deleteChunks = chunkArray(createdIds, CHUNK_SIZE);
    for (let i = 0; i < deleteChunks.length; i += 1) {
      log('info', 'undo.deleteChunk.begin', { chunk: i + 1, chunks: deleteChunks.length });
      // eslint-disable-next-line no-await-in-loop
      await bulkDeleteByIds(deleteChunks[i]);
    }

    clearLatestCsvSyncSnapshot();

    log('info', 'undo.success', { restored: previousRows.length, deleted: createdIds.length });
    return { restored: previousRows.length, deleted: createdIds.length };
  } catch (e) {
    const msg = e?.message || String(e);
    log('error', 'undo.failed', { msg });
    throw new Error(`Undo failed: ${msg}`);
  }
}
