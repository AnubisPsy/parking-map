import { AlertCircle, RefreshCw } from 'lucide-react';

export function ErrorState({ message, onRetry, title = 'No se pudieron cargar los datos', style }) {
  return (
    <div role="alert" style={{ textAlign: 'center', padding: '28px 20px', ...style }}>
      <AlertCircle size={28} color="var(--danger)" style={{ marginBottom: 8 }} />
      <p style={{ fontWeight: 600, marginBottom: 2 }}>{title}</p>
      {message && <p className="small muted" style={{ marginBottom: 14 }}>{message}</p>}
      {onRetry && (
        <button onClick={onRetry} className="btn btn-secondary">
          <RefreshCw size={14} /> Reintentar
        </button>
      )}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, description, action, style }) {
  return (
    <div style={{ textAlign: 'center', padding: '40px 24px', ...style }}>
      {Icon && (
        <span style={{ display: 'inline-flex', padding: 12, marginBottom: 12, background: 'var(--surface-2)', borderRadius: '50%', color: 'var(--ink-2)' }}>
          <Icon size={22} />
        </span>
      )}
      <p style={{ fontWeight: 600, fontSize: 15, marginBottom: 2 }}>{title}</p>
      {description && <p className="muted" style={{ fontSize: 13 }}>{description}</p>}
      {action && <div style={{ marginTop: 16, display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>{action}</div>}
    </div>
  );
}

// Mensaje a pantalla completa para rutas que no tienen nada más que mostrar
export function FullPageMessage({ children }) {
  return (
    <main style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100dvh', gap: 10, padding: 20, textAlign: 'center' }}>
      {children}
    </main>
  );
}
