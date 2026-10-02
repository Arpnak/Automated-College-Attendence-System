import { createContext, useCallback, useState } from 'react';
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react';

export const ToastContext = createContext(null);

const ICONS = {
  success: { icon: CheckCircle2, classes: 'border-status-present/40 text-status-present' },
  error: { icon: XCircle, classes: 'border-status-absent/40 text-status-absent' },
  warning: { icon: AlertTriangle, classes: 'border-status-review/40 text-status-review' },
  info: { icon: Info, classes: 'border-scan-500/40 text-scan-500' },
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (message, type = 'info', duration = 4000) => {
      const id = crypto.randomUUID();
      setToasts((prev) => [...prev, { id, message, type }]);
      if (duration) setTimeout(() => dismiss(id), duration);
      return id;
    },
    [dismiss]
  );

  const toast = {
    success: (msg, d) => push(msg, 'success', d),
    error: (msg, d) => push(msg, 'error', d),
    warning: (msg, d) => push(msg, 'warning', d),
    info: (msg, d) => push(msg, 'info', d),
  };

  return (
    <ToastContext.Provider value={{ toast, dismiss }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex w-full max-w-sm flex-col gap-2">
        {toasts.map((t) => {
          const cfg = ICONS[t.type] || ICONS.info;
          const Icon = cfg.icon;
          return (
            <div
              key={t.id}
              role="status"
              className={`flex items-start gap-2 rounded-lg border bg-white dark:bg-ink-900 px-4 py-3 shadow-lg ${cfg.classes}`}
            >
              <Icon size={16} className="mt-0.5 shrink-0" />
              <p className="flex-1 text-sm text-ink-950 dark:text-mist">{t.message}</p>
              <button onClick={() => dismiss(t.id)} aria-label="Dismiss" className="text-fog hover:text-mist">
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
