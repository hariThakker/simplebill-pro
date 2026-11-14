import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2Icon, AlertTriangleIcon, InfoIcon, XIcon } from './Icons';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((message, type = 'info', duration = 4000) => {
    const id = Date.now() + Math.random().toString(36).substring(2, 6);
    setToasts((prev) => [...prev, { id, message, type }]);

    if (duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }
  }, [removeToast]);

  const toast = {
    success: (msg, dur) => addToast(msg, 'success', dur),
    error: (msg, dur) => addToast(msg, 'error', dur),
    warning: (msg, dur) => addToast(msg, 'warning', dur),
    info: (msg, dur) => addToast(msg, 'info', dur)
  };

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="toast-container" aria-live="polite" aria-atomic="true">
        {toasts.map((t) => (
          <div key={t.id} className={`toast-item toast-${t.type}`} role="status">
            <div className="toast-icon">
              {t.type === 'success' && <CheckCircle2Icon size={18} />}
              {t.type === 'error' && <AlertTriangleIcon size={18} />}
              {t.type === 'warning' && <AlertTriangleIcon size={18} />}
              {t.type === 'info' && <InfoIcon size={18} />}
            </div>
            <div className="toast-text">{t.message}</div>
            <button
              type="button"
              className="toast-close"
              onClick={() => removeToast(t.id)}
              aria-label="Close notification"
            >
              <XIcon size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    return {
      success: (msg) => console.log('Toast [success]:', msg),
      error: (msg) => console.error('Toast [error]:', msg),
      warning: (msg) => console.warn('Toast [warning]:', msg),
      info: (msg) => console.info('Toast [info]:', msg)
    };
  }
  return context;
}
