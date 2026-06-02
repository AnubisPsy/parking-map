import { useState, useCallback, useEffect } from 'react';
import { AlertTriangle, X } from 'lucide-react';

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
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onCancel();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  return (
    <div style={overlay} onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div style={modal}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 4 }}>
          <button onClick={onCancel} style={closeBtn}><X size={16} /></button>
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 20 }}>
          {danger && (
            <div style={{ background: '#fef2f2', borderRadius: 10, padding: '10px 11px', flexShrink: 0 }}>
              <AlertTriangle size={22} color="#dc2626" />
            </div>
          )}
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: '#1e293b', marginBottom: message ? 6 : 0 }}>
              {title}
            </h3>
            {message && (
              <p style={{ fontSize: 13, color: '#64748b', lineHeight: 1.55 }}>{message}</p>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onCancel} style={btnCancel}>Cancelar</button>
          <button onClick={onConfirm} style={danger ? btnDanger : btnPrimary} autoFocus>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

const overlay = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  zIndex: 3000, padding: 20,
};
const modal = {
  background: 'white', borderRadius: 14, width: '100%', maxWidth: 420,
  padding: '20px 24px', boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
};
const closeBtn = {
  background: 'none', border: 'none', color: '#94a3b8',
  cursor: 'pointer', padding: 2, display: 'flex', alignItems: 'center', borderRadius: 4,
};
const btnCancel = {
  padding: '9px 20px', background: 'white', color: '#374151',
  border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14,
  fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
};
const btnDanger = {
  padding: '9px 20px', background: '#dc2626', color: 'white',
  border: 'none', borderRadius: 8, fontSize: 14,
  fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
};
const btnPrimary = {
  padding: '9px 20px', background: '#2563eb', color: 'white',
  border: 'none', borderRadius: 8, fontSize: 14,
  fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
};
