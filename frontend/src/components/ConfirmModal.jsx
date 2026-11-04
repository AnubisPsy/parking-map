import { useState, useCallback } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import Modal from './ui/Modal';

export function useConfirm() {
  const [state, setState] = useState(null);

  const confirm = useCallback(({ title, message, confirmLabel = 'Eliminar', danger = true }) => {
    return new Promise((resolve) => {
      setState({ title, message, confirmLabel, danger, resolve });
    });
  }, []);

  function accept() {
    state?.resolve(true);
    setState(null);
  }

  function cancel() {
    state?.resolve(false);
    setState(null);
  }

  const dialog = state ? (
    <ConfirmModal
      title={state.title}
      message={state.message}
      confirmLabel={state.confirmLabel}
      danger={state.danger}
      onConfirm={accept}
      onCancel={cancel}
    />
  ) : null;

  return { confirm, dialog };
}

export default function ConfirmModal({ title, message, confirmLabel = 'Eliminar', danger = true, onConfirm, onCancel }) {
  return (
    <Modal label={title} onClose={onCancel} closeOnBackdrop style={modal} overlayStyle={{ background: 'rgba(0,0,0,0.45)' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 4 }}>
        <button onClick={onCancel} style={closeBtn} aria-label="Cerrar"><X size={16} /></button>
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 20 }}>
        {danger && (
          <div style={{ background: '#fef2f2', borderRadius: 10, padding: '10px 11px', flexShrink: 0 }}>
            <AlertTriangle size={22} color="#b91c1c" />
          </div>
        )}
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: '#1e293b', marginBottom: message ? 6 : 0 }}>
            {title}
          </h2>
          {message && (
            <p style={{ fontSize: 13, color: '#475569', lineHeight: 1.55 }}>{message}</p>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button onClick={onCancel} style={btnCancel}>Cancelar</button>
        <button onClick={onConfirm} style={danger ? btnDanger : btnPrimary} data-autofocus>
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}

const modal = {
  maxWidth: 420, padding: '20px 24px', boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
};
const closeBtn = {
  background: 'none', border: 'none', color: '#64748b',
  cursor: 'pointer', padding: 2, display: 'flex', alignItems: 'center', borderRadius: 4,
};
const btnCancel = {
  padding: '9px 20px', background: 'white', color: '#374151',
  border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14,
  fontWeight: 600, cursor: 'pointer',
};
const btnDanger = {
  padding: '9px 20px', background: '#b91c1c', color: 'white',
  border: 'none', borderRadius: 8, fontSize: 14,
  fontWeight: 600, cursor: 'pointer',
};
const btnPrimary = {
  padding: '9px 20px', background: '#2563eb', color: 'white',
  border: 'none', borderRadius: 8, fontSize: 14,
  fontWeight: 600, cursor: 'pointer',
};
