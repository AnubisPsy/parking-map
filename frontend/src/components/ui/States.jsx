import { AlertTriangle, RefreshCw } from 'lucide-react';

export function ErrorState({ message, onRetry, title = 'No se pudieron cargar los datos', style }) {
  return (
    <div
      role="alert"
      style={{
        background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10,
        padding: 16, textAlign: 'center', ...style,
      }}
    >
      <AlertTriangle size={26} color="#b91c1c" style={{ marginBottom: 8 }} />
      <p style={{ fontWeight: 700, fontSize: 14, color: '#7f1d1d', marginBottom: 4 }}>{title}</p>
      {message && <p style={{ fontSize: 13, color: '#7f1d1d', marginBottom: 12 }}>{message}</p>}
      {onRetry && (
        <button onClick={onRetry} style={retryBtn}>
          <RefreshCw size={14} /> Reintentar
        </button>
      )}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, description, action, style }) {
  return (
    <div style={{ textAlign: 'center', padding: '40px 20px', ...style }}>
      {Icon && <Icon size={40} color="#64748b" style={{ marginBottom: 12 }} />}
      <p style={{ fontWeight: 700, fontSize: 15, color: '#334155', marginBottom: 4 }}>{title}</p>
      {description && <p style={{ fontSize: 13, color: '#475569' }}>{description}</p>}
      {action && <div style={{ marginTop: 16 }}>{action}</div>}
    </div>
  );
}

// Mensaje a pantalla completa para rutas que no tienen nada más que mostrar
export function FullPageMessage({ children }) {
  return (
    <main
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        height: '100dvh', gap: 12, padding: 20, textAlign: 'center', background: '#eef2f7',
      }}
    >
      {children}
    </main>
  );
}

const retryBtn = {
  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px',
  background: '#b91c1c', color: 'white', border: 'none', borderRadius: 8,
  fontSize: 13, fontWeight: 600, cursor: 'pointer',
};
