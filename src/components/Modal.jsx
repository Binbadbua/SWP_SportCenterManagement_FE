import { useEffect, useRef } from 'react';
import Icon from './Icon.jsx';

export default function Modal({ open, title, onClose, children, footer, wide = false }) {
  const ref = useRef(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={`modal ${wide ? 'modal--wide' : ''}`}
      onCancel={(e) => {

        if (e.target !== e.currentTarget) return;
        e.preventDefault();
        onClose?.();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose?.();
      }}
      aria-labelledby="modal-title"
    >
      {open && (
        <div className="modal__inner">
          <header className="modal__head">
            <h2 id="modal-title" className="modal__title">{title}</h2>
            <button type="button" className="icon-btn" onClick={onClose} aria-label="Đóng">
              <Icon name="close" />
            </button>
          </header>
          <div className="modal__body">{children}</div>
          {footer && <footer className="modal__foot">{footer}</footer>}
        </div>
      )}
    </dialog>
  );
}
