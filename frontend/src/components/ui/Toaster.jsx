import { useSyncExternalStore } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { dismissToast, getToasts, subscribeToasts } from '../../lib/toast';

export default function Toaster() {
  const toasts = useSyncExternalStore(subscribeToasts, getToasts);

  return (
    <div role="alert" style={container}>
      {toasts.map((t) => (
        <div key={t.id} style={toast}>
          <AlertTriangle size={16} style={{ flexShrink: 0 }} />
          <span style={{ flex: 1 }}>{t.message}</span>
          <button onClick={() => dismissToast(t.id)} style={closeBtn} aria-label="Cerrar aviso">
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}

const container = {
  position: 'fixed', bottom: 16, left: '50%', transform: 'translateX(-50%)',
  width: 'min(420px, calc(100vw - 24px))', zIndex: 4000,
  display: 'flex', flexDirection: 'column', gap: 8,
};
const toast = {
  display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
  background: '#7f1d1d', color: 'white', borderRadius: 10, fontSize: 13,
  boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
};
const closeBtn = {
  background: 'none', border: 'none', color: 'white', cursor: 'pointer',
  display: 'flex', padding: 2, borderRadius: 4,
};
