import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import Icon from './Icon.jsx';

// Small toast stack: toast.success('Đã lưu'), toast.error('Không lưu được').
const ToastContext = createContext(null);

// Long enough to read: a base time plus ~70 ms per character, longer for errors, capped
const durationOf = (tone, message) => {
  const [base, max] = tone === 'error' ? [9000, 16000] : [6000, 12000];
  return Math.min(max, Math.max(base, 2500 + String(message ?? '').length * 70));
};

export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);

  const dismiss = useCallback((id) => setItems((xs) => xs.filter((x) => x.id !== id)), []);
  const push = useCallback((tone, message) => {
    const id = Math.random().toString(36).slice(2);
    setItems((xs) => [...xs.slice(-2), { id, tone, message, duration: durationOf(tone, message) }]);
  }, []);

  const api = useMemo(
    () => ({ success: (m) => push('success', m), error: (m) => push('error', m), info: (m) => push('info', m) }),
    [push],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toasts" aria-live="polite">
        {items.map((t) => <ToastItem key={t.id} toast={t} onDismiss={dismiss} />)}
      </div>
    </ToastContext.Provider>
  );
}

// The countdown stops while the pointer is over the toast or it has focus, so it never vanishes mid-read
function ToastItem({ toast, onDismiss }) {
  const [paused, setPaused] = useState(false);
  const left = useRef(toast.duration);

  useEffect(() => {
    if (paused) return undefined;
    const started = Date.now();
    const timer = setTimeout(() => onDismiss(toast.id), left.current);
    return () => {
      clearTimeout(timer);
      left.current -= Date.now() - started;
    };
  }, [paused, toast.id, onDismiss]);

  return (
    <div
      className={`toast toast--${toast.tone}`}
      role={toast.tone === 'error' ? 'alert' : 'status'}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <Icon name={toast.tone === 'error' ? 'close' : 'check'} size={18} strokeWidth={2} />
      <span>{toast.message}</span>
      <button type="button" className="toast__close" onClick={() => onDismiss(toast.id)} aria-label="Đóng">
        <Icon name="close" size={16} />
      </button>
    </div>
  );
}

export const useToast = () => useContext(ToastContext);
