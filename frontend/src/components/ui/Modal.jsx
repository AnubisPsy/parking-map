import { useEffect, useRef } from 'react';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Con modales anidados, Esc y Tab solo afectan al superior
const stack = [];

// Diálogo accesible: Esc cierra, Tab queda dentro y el foco vuelve al botón que lo abrió.
// Para enfocar un control al abrir, márcalo con data-autofocus.
export default function Modal({ label, onClose, closeOnBackdrop = false, style, overlayStyle, children }) {
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
      style={{ ...overlayBase, ...overlayStyle }}
      onClick={closeOnBackdrop ? (e) => { if (e.target === e.currentTarget) onClose(); } : undefined}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        style={{ ...dialogBase, ...style }}
      >
        {children}
      </div>
    </div>
  );
}

const overlayBase = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  zIndex: 3000, padding: 16,
};
const dialogBase = {
  background: 'white', borderRadius: 14, width: '100%',
  maxHeight: 'calc(100dvh - 32px)', overflow: 'auto',
  boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
};
