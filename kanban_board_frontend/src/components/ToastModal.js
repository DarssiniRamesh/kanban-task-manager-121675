import React, { useEffect, useRef } from "react";
import ReactDOM from "react-dom";

/**
 * PUBLIC_INTERFACE
 * ToastModal - rendered via React Portal to ensure it floats over all board/filter UI.
 */
export default function ToastModal({ message, type = "success", onClose, duration = 3000 }) {
  // Track mount state for animation-out
  const [leaving, setLeaving] = React.useState(false);
  const timeoutRef = useRef();

  useEffect(() => {
    if (!duration) return;
    timeoutRef.current = setTimeout(() => {
      setLeaving(true);
      setTimeout(() => onClose && onClose(), 260);
    }, duration);
    return () => timeoutRef.current && clearTimeout(timeoutRef.current);
    // eslint-disable-next-line
  }, [onClose, duration, message]);

  const getIndicatorColor = (tp) => {
    if (tp === "error") return "#e74c3c";
    if (tp === "success") return "#31cb81";
    if (tp === "info") return "#44A0E3";
    return "#adb5bd"; // neutral
  };

  const typeIcons = {
    success: "✅",
    error: "⚠️",
    info:  "ℹ️",
  };

  // Only render if browser (for SSR/hydration safety)
  if (typeof document === "undefined") return null;

  // Portals always rendered into document.body
  return ReactDOM.createPortal(
    <>
      <div
        className="kanban-toast-modal-overlay"
        style={{
          position: "fixed",
          left: "50%",
          bottom: 42,
          transform: "translateX(-50%)",
          zIndex: 10000, // Highest; always above modal overlays
          pointerEvents: "none",
          minWidth: 280,
          maxWidth: 420,
        }}
        aria-live="polite"
      >
        <div
          className={
            "kanban-toast-modal" +
            (leaving ? " kanban-toast-modal-leave" : " kanban-toast-modal-enter")
          }
          style={{
            pointerEvents: "auto",
            background: "#1e2043",
            boxShadow: "0 6px 36px 0 rgba(0,0,0,0.20), 0 2.5px 10px 0 #38B2AC29",
            borderRadius: 14,
            minHeight: 62,
            display: "flex",
            alignItems: "flex-start",
            fontSize: "1.11em",
            fontWeight: 500,
            padding: "0",
            transition: "box-shadow .24s, background .16s",
            overflow: "hidden",
            position: "relative",
          }}
          role="alert"
        >
          <div
            style={{
              width: 8,
              minHeight: "100%",
              background: getIndicatorColor(type),
              boxShadow: "1px 0 8px 0 " + getIndicatorColor(type) + "66",
              borderTopLeftRadius: 13,
              borderBottomLeftRadius: 13,
              flexShrink: 0,
              transition: "background .18s",
              marginRight: 0,
            }}
            aria-hidden="true"
          />
          <div
            style={{
              display: "flex",
              flexDirection: "row",
              alignItems: "flex-start",
              gap: 13,
              width: "100%",
              padding: "18px 18px 18px 23px",
              minHeight: 46,
              flex: 1,
              fontSize: "1.12em",
              fontWeight: 600,
              color: "#fff",
              lineHeight: 1.56,
              letterSpacing: ".011em",
              background: "none",
              border: "none",
            }}
          >
            <span role="img" aria-label={type + " icon"} style={{
              fontSize: "1.37em",
              margin: "2px 0 0 1px"
            }}>
              {typeIcons[type] || typeIcons.info}
            </span>
            <span style={{ flex: 1, alignSelf: "center", wordBreak: "break-word" }}>{message}</span>
            <button
              className="kanban-toast-close"
              title="Close"
              onClick={() => { setLeaving(true); setTimeout(() => onClose && onClose(), 200); }}
              tabIndex={0}
              aria-label="Close"
            >
              ×
            </button>
          </div>
        </div>
        <style>
          {`
.kanban-toast-modal-enter {
  animation: toastSlideFadeIn .3s cubic-bezier(0.27,0.92,0.31,1.12);
  opacity: 1;
}
.kanban-toast-modal-leave {
  animation: toastSlideFadeOut .32s cubic-bezier(0.22, 1, 0.34, 1.2) forwards;
}
@keyframes toastSlideFadeIn {
  from { opacity: 0; transform: translateY(46px) scale(0.96);}
  to   { opacity: 1; transform: translateY(0) scale(1);}
}
@keyframes toastSlideFadeOut {
  from { opacity: 1; transform: translateY(0) scale(1);}
  to   { opacity: 0; transform: translateY(42px) scale(0.97);}
}
.kanban-toast-close {
  background: none;
  border: none;
  color: #fff;
  font-size: 1.61em;
  font-weight: 900;
  line-height: 1;
  opacity: 0.84;
  cursor: pointer;
  padding: 1px 8px 1px 8px;
  margin-left: 9px;
  border-radius: 99px;
  transition: background .15s, color .12s, opacity .16s;
  box-shadow: none;
  pointer-events: all;
}
.kanban-toast-close:hover, .kanban-toast-close:focus {
  background: #22326930;
  color: #92fee8;
  opacity: 1;
  outline: none;
}
          `}
        </style>
      </div>
    </>,
    document.body
  );
}
