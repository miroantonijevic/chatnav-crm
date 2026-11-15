/**
 * App-wide feedback: toasts (with optional action such as Undo) and a promise-based
 * confirm dialog that replaces window.confirm / window.alert.
 */
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Modal } from '../components/Modal';

type ToastTone = 'success' | 'error' | 'info';

interface ToastItem {
  id: number;
  message: string;
  tone: ToastTone;
  action?: { label: string; run: () => void };
}

export interface ConfirmOptions {
  title: string;
  message?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'danger' | 'warn' | 'default';
}

type ToastFn = (message: string, tone?: ToastTone, action?: ToastItem['action']) => void;
type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

interface UiContextValue {
  toast: ToastFn;
  confirm: ConfirmFn;
}

const UiContext = createContext<UiContextValue | undefined>(undefined);

let nextId = 1;

export const UiProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());
  const [dialog, setDialog] = useState<{ options: ConfirmOptions; resolve: (v: boolean) => void } | null>(null);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) clearTimeout(timer);
    timers.current.delete(id);
  }, []);

  const toast = useCallback<ToastFn>(
    (message, tone = 'success', action) => {
      const id = nextId++;
      setToasts((prev) => [...prev.slice(-2), { id, message, tone, action }]);
      timers.current.set(id, setTimeout(() => dismiss(id), action ? 7000 : tone === 'error' ? 6000 : 3500));
    },
    [dismiss]
  );

  const confirm = useCallback<ConfirmFn>(
    (options) => new Promise<boolean>((resolve) => setDialog({ options, resolve })),
    []
  );

  const answer = (value: boolean) => {
    dialog?.resolve(value);
    setDialog(null);
  };

  useEffect(() => {
    const current = timers.current;
    return () => current.forEach((t) => clearTimeout(t));
  }, []);

  const tone = dialog?.options.tone ?? 'default';

  return (
    <UiContext.Provider value={{ toast, confirm }}>
      {children}

      <div className="toast-stack" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.tone}`} role="status">
            <span>{t.message}</span>
            {t.action && (
              <button
                type="button"
                onClick={() => {
                  t.action?.run();
                  dismiss(t.id);
                }}
              >
                {t.action.label}
              </button>
            )}
          </div>
        ))}
      </div>

      {dialog && (
        <Modal title={dialog.options.title} size="sm" onClose={() => answer(false)}>
          <div className="modal-body">
            {tone !== 'default' && (
              <div className={`confirm-icon${tone === 'warn' ? ' warn' : ''}`}>{tone === 'danger' ? '🗑️' : '⚠️'}</div>
            )}
            {dialog.options.message && <div className="confirm-text">{dialog.options.message}</div>}
          </div>
          <div className="modal-foot">
            <button type="button" className="btn" onClick={() => answer(false)}>
              {dialog.options.cancelLabel ?? 'Cancel'}
            </button>
            <button
              type="button"
              autoFocus
              className={`btn ${tone === 'danger' ? 'btn-danger' : 'btn-primary'}`}
              onClick={() => answer(true)}
            >
              {dialog.options.confirmLabel ?? 'Confirm'}
            </button>
          </div>
        </Modal>
      )}
    </UiContext.Provider>
  );
};

function useUi(): UiContextValue {
  const ctx = useContext(UiContext);
  if (!ctx) throw new Error('useToast/useConfirm must be used within a UiProvider');
  return ctx;
}

export const useToast = (): ToastFn => useUi().toast;
export const useConfirm = (): ConfirmFn => useUi().confirm;
