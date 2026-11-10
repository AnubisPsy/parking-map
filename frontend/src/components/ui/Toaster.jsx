import { useSyncExternalStore } from 'react';
import { AlertCircle, X } from 'lucide-react';
import { dismissToast, getToasts, subscribeToasts } from '../../lib/toast';

export default function Toaster() {
  const toasts = useSyncExternalStore(subscribeToasts, getToasts);

  return (
    <div role="alert" className="toaster">
      {toasts.map((t) => (
        <div key={t.id} className="toast">
          <AlertCircle size={16} style={{ flexShrink: 0 }} />
          <span style={{ flex: 1 }}>{t.message}</span>
          <button onClick={() => dismissToast(t.id)} className="icon-btn" aria-label="Cerrar aviso">
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
