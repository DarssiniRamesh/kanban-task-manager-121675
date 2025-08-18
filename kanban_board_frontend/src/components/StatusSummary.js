import React from 'react';
import { useKanban } from '../KanbanContext';

/**
 * PUBLIC_INTERFACE
 * StatusSummary
 * A compact, live status summary row that displays counts for:
 * - To Do
 * - In Progress
 * - Done
 * - On Hold
 * This is intended to be shown at the top of the Product page for quick status visibility.
 */
export default function StatusSummary() {
  const { cards, isLoading, error } = useKanban();

  // Normalize card.status to our four buckets
  const normalize = (status) => {
    const s = (status || '').toString().trim().toLowerCase();
    if (!s) return null;
    if (s.includes('progress')) return 'inprogress';
    if (s.includes('hold')) return 'hold';
    if (s.includes('done')) return 'done';
    if (s.includes('to do') || s.includes('todo') || s.includes('backlog')) return 'todo';
    return null;
  };

  const counts = React.useMemo(() => {
    const acc = { todo: 0, inprogress: 0, done: 0, hold: 0 };
    (cards || []).forEach((c) => {
      const k = normalize(c.status);
      if (k && acc[k] != null) acc[k] += 1;
    });
    return acc;
  }, [cards]);

  // Even when loading/errored, show the bar (with zeros) to keep layout stable
  return (
    <div className="product-summary" role="region" aria-label="Live status summary">
      <div className="container">
        <div className="status-row">
          <div className="status-chip" title="To Do">
            <span className="dot to-do" />
            <span className="status-label">To Do</span>
            <span className="status-count">{counts.todo || 0}</span>
          </div>
          <div className="status-chip" title="In Progress">
            <span className="dot in-progress" />
            <span className="status-label">In Progress</span>
            <span className="status-count">{counts.inprogress || 0}</span>
          </div>
          <div className="status-chip" title="Done">
            <span className="dot done" />
            <span className="status-label">Done</span>
            <span className="status-count">{counts.done || 0}</span>
          </div>
          <div className="status-chip" title="On Hold">
            <span className="dot on-hold" />
            <span className="status-label">On Hold</span>
            <span className="status-count">{counts.hold || 0}</span>
          </div>
        </div>
        {(isLoading || error) && (
          <span style={{ display: 'inline-block', marginTop: 6, color: '#8b6b60', fontSize: '0.9rem' }}>
            {isLoading ? 'Updating…' : error ? 'Live data may be delayed.' : null}
          </span>
        )}
      </div>
    </div>
  );
}
