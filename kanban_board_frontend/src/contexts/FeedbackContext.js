import React, { createContext, useContext } from 'react';

// PUBLIC_INTERFACE
/**
 * FeedbackContext provides global feedback/toast functions for the app.
 * Components can call useFeedback() to retrieve { showToast } if a provider is mounted above them.
 * If no provider exists, useFeedback() returns a default no-op implementation to avoid runtime errors.
 */
export const FeedbackContext = createContext({ showToast: () => {} });

// PUBLIC_INTERFACE
export function useFeedback() {
  /** Returns the feedback API object, guaranteed to have a showToast function (no-op fallback). */
  const ctx = useContext(FeedbackContext);
  if (!ctx || typeof ctx.showToast !== 'function') {
    // Fallback to safe no-op to prevent crashes when provider is absent
    return { showToast: () => {} };
  }
  return ctx;
}
