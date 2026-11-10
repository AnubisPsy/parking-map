import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Con modales anidados, Esc y Tab solo afectan al superior
const stack = [];

// Diálogo accesible: Esc cierra, Tab queda dentro y el foco vuelve al botón que lo abrió.
// Para enfocar un control al abrir, márcalo con data-autofocus.
export default function Modal({
  title, description, size = 'md', footer, footerBetween = false, closeOnBackdrop = false, onClose, children,
}) {
  const dialogRef = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const dialog = dialogRef.current;
    const previous = document.activeElement;
    stack.push(dialog);
    (dialog.querySelector('[data-autofocus]') || dialog).focus();

    function onKeyDown(e) {
      if (stack[stack.length - 1] !== dialog) return;
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCloseRef.current();
      } else if (e.key === 'Tab') {
        const items = [...dialog.querySelectorAll(FOCUSABLE)];
        if (items.length === 0) { e.preventDefault(); return; }
        const first = items[0];
        const last = items[items.length - 1];
        const active = document.activeElement;
        if (!dialog.contains(active) || active === dialog) {
          e.preventDefault();
          (e.shiftKey ? last : first).focus();
        } else if (e.shiftKey && active === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      stack.splice(stack.indexOf(dialog), 1);
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus();
    };
  }, []);

  return (
    <div
      className="modal-overlay"
      onClick={closeOnBackdrop ? (e) => { if (e.target === e.currentTarget) onClose(); } : undefined}
    >
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} className={`modal modal-${size}`}>
        <div className="modal-head">
          <div style={{ minWidth: 0 }}>
            <h2 className="modal-title">{title}</h2>
            {description && <p className="modal-description">{description}</p>}
          </div>
          <button onClick={onClose} className="icon-btn" aria-label="Cerrar"><X size={18} /></button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className={`modal-foot${footerBetween ? ' modal-foot-between' : ''}`}>{footer}</div>}
      </div>
    </div>
  );
}
