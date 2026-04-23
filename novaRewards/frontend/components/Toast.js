import { useState, useCallback, createContext, useContext } from 'react';

const ToastContext = createContext(null);

const ICONS = {
  success: '✓',
  error: '✕',
  warning: '⚠',
  info: 'ℹ',
};

const MAX_TOASTS = 3;
const DEFAULT_DURATION = 5000;

function Toast({ toast, onRemove }) {
  return (
    <div
      role="status"
      className={`toast toast-${toast.type}`}
    >
      <span className="toast-icon" aria-hidden="true">{ICONS[toast.type]}</span>
      <span className="toast-message">{toast.message}</span>
      <button
        className="toast-close"
        onClick={() => onRemove(toast.id)}
        aria-label="Dismiss notification"
      >
        ✕
      </button>
    </div>
  );
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((message, type = 'info', duration = DEFAULT_DURATION) => {
    const id = Date.now();

    setToasts((prev) => {
      const next = [...prev, { id, message, type }];
      // drop oldest if over limit
      return next.length > MAX_TOASTS ? next.slice(next.length - MAX_TOASTS) : next;
    });

    if (duration > 0) {
      setTimeout(() => removeToast(id), duration);
    }

    return id;
  }, [removeToast]);

  return (
    <ToastContext.Provider value={{ addToast, removeToast }}>
      {children}
      {/* aria-live region announces toasts to screen readers */}
      <div className="toast-container" aria-live="polite" aria-atomic="false">
        {toasts.map((toast) => (
          <Toast key={toast.id} toast={toast} onRemove={removeToast} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within ToastProvider');
  return context;
}
