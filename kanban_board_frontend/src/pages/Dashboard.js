import React from 'react';
import { useKanban } from '../KanbanContext';

/** PUBLIC_INTERFACE
 * Dashboard
 * A high-level overview of the Kanban data:
 * - Status counts (To do, In Progress, Review, Done, On Hold)
 * - Assignee summary with per-status counts (To do, In Progress, Done)
 * - Column summary (column -> number of cards)
 * All powered by live data from KanbanContext (Supabase).
 */
export default function Dashboard() {
  const { cards, columns, isLoading, error } = useKanban();

  // Canonical, user-facing status labels (ensure exact casing for "To do").
  const statusOrder = ['To do', 'In Progress', 'Review', 'Done', 'On Hold'];

  // Normalize any input status value to one of the canonical labels above.
  const normalizeStatus = React.useCallback((value) => {
    const raw = (value || '').toString().trim().toLowerCase();
    if (!raw) return null;
    if (raw.includes('progress')) return 'In Progress';
    if (raw.includes('review')) return 'Review';
    if (raw.includes('hold')) return 'On Hold';
    if (raw.includes('done')) return 'Done';
    if (raw.includes('to do') || raw.includes('todo') || raw.includes('backlog')) return 'To do';
    return null; // Unknown/untracked statuses not counted
  }, []);

  // Global status counts (chips)
  const statusCounts = React.useMemo(() => {
    const counts = Object.create(null);
    statusOrder.forEach((s) => { counts[s] = 0; });
    (cards || []).forEach((c) => {
      const s = normalizeStatus(c.status);
      if (s && counts[s] != null) counts[s] += 1;
    });
    return counts;
  }, [cards, normalizeStatus]);

  // Assignee -> per-status breakdown (To do, In Progress, Done)
  const assigneeBreakdown = React.useMemo(() => {
    const map = Object.create(null);
    (cards || []).forEach((c) => {
      const assignee = (c.assignee && String(c.assignee).trim()) || 'Unassigned';
      const st = normalizeStatus(c.status);
      if (!map[assignee]) {
        map[assignee] = { 'To do': 0, 'In Progress': 0, 'Done': 0 };
      }
      if (st === 'To do') map[assignee]['To do'] += 1;
      else if (st === 'In Progress') map[assignee]['In Progress'] += 1;
      else if (st === 'Done') map[assignee]['Done'] += 1;
      // Other statuses (Review, On Hold) are not shown per spec; excluded from this table intentionally
    });

    // Convert to array with totals for sorting
    const rows = Object.entries(map).map(([name, counts]) => {
      const total = counts['To do'] + counts['In Progress'] + counts['Done'];
      return { assignee: name, ...counts, total };
    });
    // Sort by total desc, then by name asc for stable ordering
    rows.sort((a, b) => (b.total - a.total) || a.assignee.localeCompare(b.assignee));
    return rows;
  }, [cards, normalizeStatus]);

  // Column counts (column title -> number of cards)
  const colCounts = React.useMemo(() => {
    const map = new Map();
    (columns || []).forEach((col) => map.set(col.id, { title: col.title, count: 0 }));
    (cards || []).forEach((c) => {
      if (map.has(c.column_id)) {
        const item = map.get(c.column_id);
        item.count += 1;
      }
    });
    return Array.from(map.values());
  }, [cards, columns]);

  const totalCards = cards?.length || 0;
  const uniqueAssignees = assigneeBreakdown.length;

  if (isLoading) {
    return <div className="kanban-loading">Loading...</div>;
  }
  if (error) {
    return <div className="kanban-error">{error}</div>;
  }

  return (
    <div
      className="container dashboard-container"
      style={{
        paddingTop: 96,
        paddingBottom: 32,
        maxWidth: '100vw',         // allow full-width layout for widgets
        paddingLeft: '2vw',        // responsive side padding to prevent edge collisions
        paddingRight: '2vw'
      }}
    >
      <h1 className="page-title">Dashboard</h1>
      <p className="page-subtitle">Live summary of your product board</p>

      {/* KPI cards (keep existing) */}
      <section className="dashboard-grid" aria-label="Key metrics">
        <div className="stat-card">
          <div className="stat-label">Total Features</div>
          <div className="stat-value">{totalCards}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Assignees</div>
          <div className="stat-value">{uniqueAssignees}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Columns</div>
          <div className="stat-value">{columns.length}</div>
        </div>
      </section>

      {/* Widgets row: Status | Assignees | Columns */}
      <section className="dashboard-widgets" aria-label="Overview widgets">
        {/* Status widget */}
        <div className="widget" aria-labelledby="widget-status-title">
          <div className="widget-title" id="widget-status-title">Status</div>
          <div className="status-row">
            {statusOrder.map((s) => (
              <div className="status-chip" key={s} title={s}>
                <span className={"dot " + s.toLowerCase().replace(/\s+/g, '-')}></span>
                <span className="status-label">{s}</span>
                <span className="status-count">{statusCounts[s] || 0}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Assignees widget */}
        <div className="widget" aria-labelledby="widget-assignees-title">
          <div className="widget-title" id="widget-assignees-title">Assignees</div>
          <div className="simple-table assignee-grid" role="table" aria-label="Assignee per-status counts">
            <div className="table-row header" role="row">
              <div role="columnheader">Assignee</div>
              <div role="columnheader">To do</div>
              <div role="columnheader">In Progress</div>
              <div role="columnheader">Done</div>
            </div>
            {assigneeBreakdown.map((row) => (
              <div className="table-row" role="row" key={row.assignee}>
                <div role="cell">{row.assignee}</div>
                <div role="cell" className="count-cell">{row['To do']}</div>
                <div role="cell" className="count-cell">{row['In Progress']}</div>
                <div role="cell" className="count-cell">{row['Done']}</div>
              </div>
            ))}
            {assigneeBreakdown.length === 0 && (
              <div className="table-row" role="row">
                <div role="cell" style={{ gridColumn: '1 / -1', opacity: 0.7 }}>No data</div>
              </div>
            )}
          </div>
        </div>

        {/* Columns widget */}
        <div className="widget" aria-labelledby="widget-columns-title">
          <div className="widget-title" id="widget-columns-title">Columns</div>
          <div className="simple-table" role="table" aria-label="Column counts">
            <div className="table-row header" role="row">
              <div role="columnheader">Column</div>
              <div role="columnheader" style={{ textAlign: 'right' }}>Features</div>
            </div>
            {colCounts.map((c) => (
              <div className="table-row" role="row" key={c.title}>
                <div role="cell">{c.title}</div>
                <div role="cell" style={{ textAlign: 'right', fontWeight: 700 }}>{c.count}</div>
              </div>
            ))}
            {colCounts.length === 0 && (
              <div className="table-row" role="row">
                <div role="cell" style={{ gridColumn: '1 / -1', opacity: 0.7 }}>No data</div>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
