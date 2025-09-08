import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import { useKanban } from '../KanbanContext';
import { useFeedback } from '../contexts/FeedbackContext';
import DeleteOutline from '@mui/icons-material/DeleteOutline';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import AssigneeAutocomplete from './AssigneeAutocomplete';
import { addKnownAssignee } from '../utils/assignees';

// Field badge/pill helpers
function Pill({ value, type }) {
  if (!value) return null;
  let className = "kanban-pill";
  if (type) className += " kanban-pill-" + type.toLowerCase().replace(/\s+/g, "");
  if (type === "priority") {
    const v = String(value).toLowerCase();
    if (v === "high" || v === "critical") className += " pill-high";
    else if (v === "medium") className += " pill-medium";
    else if (v === "low") className += " pill-low";
    else if (v === "none" || v === "no priority" || v === "unprioritized") className += " pill-none";
  }
  if (type === "status") {
    if (value === "To Do") className += " pill-todo";
    if (value === "In Progress") className += " pill-progress";
    if (value === "Done") className += " pill-done";
    if (value === "Review") className += " pill-review";
    if (value === "On Hold") className += " pill-hold";
  }
  return <span className={className}>{value}</span>;
}

// Modal for card detail/expanded view+edit using React Portal
function Modal({ children, onClose }) {
  if (typeof document === "undefined") return null;
  return ReactDOM.createPortal(
    <div className="kanban-modal-overlay" tabIndex={-1} onClick={onClose}>
      <div className="kanban-modal-dialog" onClick={e => e.stopPropagation()}>
        <button className="kanban-modal-close" onClick={onClose} title="Close">×</button>
        {children}
      </div>
    </div>,
    document.body
  );
}



// PUBLIC_INTERFACE
/**
 * KanbanCard
 * Card component representing a Kanban task card.
 * Displays compact inline view and modal/expanded detail view.
 * - In compact mode: shows Title, status color dot, Priority badge, and Assignee.
 * - In expanded mode (modal): shows Title, Description, Status, Priority, Assignee, Due date, editable.
 *
 * Props:
 *  - card: Object representing the card fields
 *  - isCompact: boolean controlling inline compact rendering
 *  - showMarketColumn: when true, show the Market column assignment pill on the card
 *  - showProductColumn: when true, show the Product/Kanban column assignment pill on the card
 */
function KanbanCard({ card, isCompact = false, showMarketColumn = false, showProductColumn = false }) {
  const { updateCard, deleteCard, columns = [], marketColumns = [] } = useKanban();
  const [edit, setEdit] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [fields, setFields] = useState({
    feature: card.feature,
    description: card.description,
    assignee: card.assignee,
    notes: card.notes,
    priority: card.priority,
    status: card.status,
    due_date: card.due_date,
    // New fields
    impact: card.impact,
    market_need: card.market_need,
    estimated_effort: card.estimated_effort ?? '',
    category: card.category,
  });

  // Determine card color class (status primary, then priority)
  function getCardColorClass() {
    if (card.status) {
      const st = card.status.toLowerCase();
      if (st.includes("todo")) return "card-todo";
      if (st.includes("progress")) return "card-inprogress";
      if (st.includes("done")) return "card-done";
      if (st.includes("review")) return "card-review";
      if (st.includes("hold")) return "card-hold";
    }
    if (card.priority) {
      const pr = card.priority.toLowerCase();
      if (pr.includes("critical")) return "card-critical";
      if (pr.includes("high")) return "card-high";
      if (pr.includes("medium")) return "card-medium";
      if (pr.includes("low")) return "card-low";
    }
    return "";
  }

  // For modal, reset fields on open to always latest value
  const openModal = () => {
    setFields({
      feature: card.feature,
      description: card.description,
      assignee: card.assignee,
      notes: card.notes,
      priority: card.priority,
      status: card.status,
      due_date: card.due_date,
      // New fields
      impact: card.impact,
      market_need: card.market_need,
      estimated_effort: card.estimated_effort ?? '',
      category: card.category,
      reference_link: card.reference_link || '',
    });
    setModalOpen(true);
    setEdit(false);
  };

  const handleChange = (e) => {
    setFields(f => ({
      ...f,
      [e.target.name]: e.target.value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const estimated =
      fields.estimated_effort === '' ? null
        : Number.isNaN(parseInt(fields.estimated_effort, 10)) ? null
        : parseInt(fields.estimated_effort, 10);
    const payload = { ...fields, estimated_effort: estimated };
    await updateCard(card.id, payload);
    try {
      if (fields.assignee) addKnownAssignee(fields.assignee);
    } catch { /* ignore storage issues */ }
    setEdit(false);
  };

  // PUBLIC_INTERFACE
  const [deleteError, setDeleteError] = useState(null);
  const [deletionConfirm, setDeletionConfirm] = useState(false);
  // Obtain showToast from context (useFeedback returns a no-op when no provider)
  const { showToast } = useFeedback();

  const handleDelete = async () => {
    setDeletionConfirm(true);
  };

  const confirmDeleteCard = async () => {
    setDeletionConfirm(false);
    try {
      // Call deleteCard which already does optimistic update and sets error
      const error = await deleteCard(card.id);
      if (error) {
        setDeleteError(error);
        showToast && showToast(error, "error");
      } else {
        setModalOpen(false);
        setDeleteError(null);
        // Show a toast slightly after closing modal for better UI
        setTimeout(() => { showToast && showToast("Card deleted.", "success"); }, 300);
      }
    } catch (err) {
      setDeleteError(err.message || "Unexpected error occurred while deleting card.");
      showToast && showToast(err.message || "Delete error", "error");
      // eslint-disable-next-line no-console
      console.error('[KanbanCard.handleDelete] Exception during card delete:', err);
    }
  };

  // Small status color indicator
  function getStatusDotColor() {
    const st = (card.status || '').toLowerCase();
    if (st.includes('progress')) return '#F9A825'; // In Progress - deeper yellow
    if (st.includes('done')) return '#2E7D32';     // Done - clearer, deeper green
    if (st.includes('review')) return '#F57C00';   // Review - deeper orange
    if (st.includes('hold')) return '#D7827F';     // On Hold - unchanged base
    if (st.includes('todo')) return '#C62828';     // Pending/To Do - deeper red
    return '#CFCFD4';
  }

  // Inline Card View (respects compact mode) - now as a renderer function to avoid ReferenceError
  function renderInlineCard() {
    return (
      <div
        className="kanban-card-inner"
        onClick={openModal}
        style={{ cursor: "pointer" }}
      >
        {card.reference_link && (
          <button
            className="kanban-card-linkbtn"
            title="Open reference link"
            aria-label="Open reference link in new tab"
            onClick={(e) => {
              e.stopPropagation();
              let url = String(card.reference_link || '').trim();
              if (!url) return;
              if (!/^https?:\/\//i.test(url)) {
                url = 'https://' + url;
              }
              try {
                window.open(url, '_blank', 'noopener,noreferrer');
              } catch {
                window.open(url, '_blank');
              }
            }}
            style={{
              position: 'absolute',
              top: 6,
              right: 6,
              background: '#fff',
              border: '1px solid var(--color-border)',
              color: 'var(--color-accent-strong)',
              borderRadius: 7,
              padding: '3px 6px',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              lineHeight: 0,
              boxShadow: '0 1px 6px rgba(0,0,0,0.06)',
              cursor: 'pointer'
            }}
          >
            <OpenInNewIcon fontSize="small" />
          </button>
        )}
        <div className="kanban-card-prominent-header" style={{ borderBottom: isCompact ? 'none' : undefined, marginBottom: isCompact ? 6 : 11, paddingBottom: isCompact ? 0 : '0.5em' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* Status color indicator dot */}
            <span
              className="kanban-status-dot"
              aria-label={`Status ${card.status || 'Unknown'}`}
              title={card.status || 'Status'}
              style={{ background: getStatusDotColor() }}
            />
            <div className="kanban-card-title-prominent" style={{ marginBottom: 0 }}>
              {card.feature}
            </div>
          </div>
          {!isCompact && card.description && (
            <div className="kanban-card-desc-prominent">
              {card.description}
            </div>
          )}
        </div>
        <div className="kanban-card-pillrow">
          {/* In compact mode, omit status pill and due date; keep priority + assignee; show key fields for visibility */}
          {!isCompact && <Pill value={card.status} type="status" />}
          <Pill value={card.priority} type="priority" />
          <Pill value={card.assignee} type="assignee" />
          {/* Cross-context column info */}
          {showProductColumn && card.column_id && (() => {
            const map = new Map((columns || []).map(c => [c.id, c.title]));
            const name = map.get(card.column_id);
            return name ? <Pill value={`Product: ${name}`} type="productcolumn" /> : null;
          })()}
          {showMarketColumn && card.market_kanban_column_id && (() => {
            const map = new Map((marketColumns || []).map(c => [c.id, c.title]));
            const name = map.get(card.market_kanban_column_id);
            return name ? <Pill value={`Market: ${name}`} type="marketcolumn" /> : null;
          })()}
          {/* New visible fields */}
          <Pill value={card.category} type="category" />
          <Pill value={card.impact} type="impact" />
          <Pill value={card.market_need} type="market_need" />
          {card.estimated_effort != null && card.estimated_effort !== '' && (
            <span className="kanban-pill kanban-pill-estimate" title="Estimated effort (story points)">
              SP {card.estimated_effort}
            </span>
          )}
          {!isCompact && card.due_date && (
            <span className="kanban-pill kanban-pill-due" title="Due">
              <span role="img" aria-label="due">🗓️</span> {card.due_date}
            </span>
          )}
        </div>
      </div>
    );
  }

  // Modal/Expanded/Editable Card - renderer function to avoid ReferenceError
  function renderModalCard() {
    return (
      <>
        <Modal onClose={() => { setModalOpen(false); setDeleteError(null); setDeletionConfirm(false); }}>
          <div className="kanban-detail-modal">
            {!edit ? (
              <>
                <div className="kanban-detail-prominent-header">
                  <div className="kanban-detail-modal-title-row">
                    <span className="kanban-detail-title-prominent">{card.feature}</span>
                    {card.reference_link && (
                      <button
                        className="kanban-card-editbtn"
                        title="Open reference link"
                        aria-label="Open reference link in new tab"
                        onClick={(e) => {
                          e.stopPropagation();
                          let url = String(card.reference_link || '').trim();
                          if (!url) return;
                          if (!/^https?:\/\//i.test(url)) {
                            url = 'https://' + url;
                          }
                          try {
                            window.open(url, '_blank', 'noopener,noreferrer');
                          } catch {
                            window.open(url, '_blank');
                          }
                        }}
                        style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', lineHeight: 0 }}
                      >
                        <OpenInNewIcon fontSize="small" />
                      </button>
                    )}
                    <button className="kanban-card-editbtn" onClick={() => setEdit(true)} title="Edit">✎</button>
                    <button
                      className="kanban-card-delbtn"
                      onClick={handleDelete}
                      aria-label="Delete card"
                      title="Delete"
                      style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', lineHeight: 0 }}
                    >
                      <DeleteOutline fontSize="small" />
                    </button>
                  </div>
                  {card.description && (
                    <div className="kanban-detail-desc-prominent">
                      {card.description}
                    </div>
                  )}
                  <div className="kanban-detail-divider"/>
                </div>
                <div className="kanban-detail-row">
                  <span className="kanban-detail-field-label">Status:</span> <Pill value={card.status} type="status"/>
                  <span className="kanban-detail-field-label">Priority:</span> <Pill value={card.priority} type="priority"/>
                </div>
                <div className="kanban-detail-row">
                  <span className="kanban-detail-field-label">Assignee:</span> <Pill value={card.assignee} type="assignee"/>
                  {card.due_date && (
                    <>
                      <span className="kanban-detail-field-label">Due:</span>
                      <span className="kanban-pill kanban-pill-due">
                        <span role="img" aria-label="due">🗓️</span> {card.due_date}
                      </span>
                    </>
                  )}
                </div>
                <div className="kanban-detail-section">
                  <div className="kanban-detail-label">Notes</div>
                  <div className="kanban-detail-content">{card.notes || <span className="missing-info">None</span>}</div>
                </div>
                <div className="kanban-detail-row" style={{ marginTop: 10 }}>
                  <span className="kanban-detail-field-label">Impact:</span> <Pill value={card.impact} type="impact" />
                  <span className="kanban-detail-field-label">Market Need:</span> <Pill value={card.market_need} type="market_need" />
                </div>
                <div className="kanban-detail-row">
                  <span className="kanban-detail-field-label">Est. Effort:</span> <Pill value={card.estimated_effort != null ? String(card.estimated_effort) : ''} type="estimate" />
                  <span className="kanban-detail-field-label">Category:</span> <Pill value={card.category} type="category" />
                </div>
                <button className="btn" style={{marginTop:18, width:"100%"}} onClick={() => setEdit(true)}>Edit Card</button>
              </>
            ) : (
              <form className="kanban-edit-card-form" onSubmit={handleSubmit}>
                <div className="kanban-form-grid">
                  <input
                    name="feature"
                    value={fields.feature}
                    onChange={handleChange}
                    required
                    placeholder="Feature/Title"
                  />
                  {/* Assignee with autocomplete suggestions */}
                  <AssigneeAutocomplete
                    name="assignee"
                    value={fields.assignee || ""}
                    onChange={handleChange}
                    placeholder="Assignee"
                    className="styled-input"
                    style={{ minWidth: 0 }}
                    inputProps={{ 'aria-label': 'Assignee' }}
                    idSuffix={`edit-${card.id}`}
                  />
                  <select name="priority" value={fields.priority||""} onChange={handleChange}>
                    <option value="">Priority</option>
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                    <option value="Critical">Critical</option>
                  </select>
                  <select name="status" value={fields.status||""} onChange={handleChange}>
                    <option value="">Status</option>
                    <option value="To Do">To Do</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Review">Review</option>
                    <option value="Done">Done</option>
                    <option value="On Hold">On Hold</option>
                  </select>
                  <input name="due_date" type="date" value={fields.due_date||""} onChange={handleChange}/>

                  <input
                    name="reference_link"
                    type="url"
                    value={fields.reference_link || ""}
                    onChange={handleChange}
                    placeholder="Reference link (https://...)"
                    aria-label="Reference link"
                  />

                  {/* New fields */}
                  <select name="impact" value={fields.impact || ""} onChange={handleChange} aria-label="Impact">
                    <option value="">Impact</option>
                    <option value="High Impact - Low Effort">High Impact - Low Effort</option>
                    <option value="High Effort - Low Impact">High Effort - Low Impact</option>
                    <option value="High Effort - High Impact">High Effort - High Impact</option>
                    <option value="Low Effort - Low Impact">Low Effort - Low Impact</option>
                  </select>
                  <select name="market_need" value={fields.market_need || ""} onChange={handleChange} aria-label="Market Need">
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
                    value={fields.estimated_effort ?? ""}
                    onChange={handleChange}
                    placeholder="Est. Effort"
                    aria-label="Estimated Effort"
                  />
                  <select name="category" value={fields.category || ""} onChange={handleChange} aria-label="Category">
                    <option value="">Category</option>
                    <option value="Feature">Feature</option>
                    <option value="Enhancement">Enhancement</option>
                    <option value="Feedback">Feedback</option>
                  </select>
                </div>
                <textarea name="description" value={fields.description||""} onChange={handleChange} placeholder="Description"/>
                <textarea name="notes" value={fields.notes||""} onChange={handleChange} placeholder="Notes"/>
                <div className="kanban-modal-form-buttons">
                  <button className="btn" type="submit">Save</button>
                  <button className="btn" type="button" onClick={()=>setEdit(false)}>Cancel</button>
                  <button
                    className="btn"
                    type="button"
                    onClick={handleDelete}
                    style={{ marginLeft: "auto", display: 'inline-flex', alignItems: 'center' }}
                    aria-label="Delete card"
                    title="Delete"
                  >
                    <DeleteOutline fontSize="small" style={{ marginRight: 6 }} />
                    Delete
                  </button>
                </div>
              </form>
            )}
          </div>
        </Modal>
        {/* Confirmation dialog for deletion */}
        {deletionConfirm && (
          <Modal onClose={() => setDeletionConfirm(false)}>
            <div className="kanban-detail-modal">
              <div style={{ color: '#ff9e9e', fontWeight: 700, fontSize: '1.20em', marginBottom: 9 }}>
                Delete this card?
              </div>
              <div style={{ marginBottom: 18 }}>
                This action is <strong>permanent</strong> and cannot be undone.
              </div>
              <div className="kanban-modal-form-buttons">
                <button className="btn" style={{ background: "#c13a2b" }} onClick={confirmDeleteCard}>Yes, Delete</button>
                <button className="btn" style={{ marginLeft: 10 }} onClick={() => setDeletionConfirm(false)}>Cancel</button>
              </div>
            </div>
          </Modal>
        )}
        {deleteError && (
          <Modal onClose={() => setDeleteError(null)}>
            <div className="kanban-detail-modal">
              <div style={{ color: '#ff9e9e', fontWeight: 600, fontSize: '1.20em', marginBottom: 12 }}>
                Error deleting card
              </div>
              <div style={{ marginBottom: 18 }}>{deleteError}</div>
              <button className="btn" style={{ width: '100%' }} onClick={() => setDeleteError(null)}>Close</button>
            </div>
          </Modal>
        )}
      </>
    );
  }

  return (
    <div className={`kanban-card ${getCardColorClass()} ${isCompact ? 'compact' : ''}`}>
      {/* Show inline or modal card */}
      {modalOpen ? renderModalCard() : renderInlineCard()}
    </div>
  );
}

export default KanbanCard;
