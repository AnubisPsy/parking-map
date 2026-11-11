import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { ResponsiveContainer } from 'recharts';
import { useInView } from '../../hooks/useInView';
import { branchColor } from '../../lib/colors';
import { formatDateTime } from '../../lib/format';
import AppHeader, { SharedHeader } from '../ui/AppHeader';

// Sin `backTo` es una vista compartida: no enlaza a la parte privada de la app
export function ReportHeader({ title, subtitle, backTo, expiresAt, children }) {
  return (
    <>
      {backTo ? <AppHeader /> : (
        <SharedHeader>
          <p className="header-note">{expiresAt ? <><span className="note-optional">Solo lectura · </span>Válido hasta {formatDateTime(expiresAt)}</> : 'Solo lectura'}</p>
        </SharedHeader>
      )}
      <section className="page-head" aria-label="Encabezado de la página">
        <div className="row" style={{ gap: 12, minWidth: 0 }}>
          {backTo && (
            <Link to={backTo} className="back-link" aria-label="Volver a reportes"><ArrowLeft size={16} /></Link>
          )}
          <div style={{ minWidth: 0 }}>
            <h1 className="page-title">{title}</h1>
            {subtitle && <p className="page-subtitle">{subtitle}</p>}
          </div>
        </div>
        {children}
      </section>
    </>
  );
}

export function ReportTabs({ tabs, active, onChange }) {
  return (
    <nav className="tabs" aria-label="Secciones del reporte">
      {tabs.map((t) => (
        <button key={t.id} onClick={() => onChange(t.id)} aria-current={active === t.id ? 'page' : undefined}>
          {t.label}
        </button>
      ))}
    </nav>
  );
}

// La altura queda reservada desde el inicio: la gráfica se monta al acercarse a la
// pantalla, sin que la página salte.
export function ChartCard({ title, children, height = 260 }) {
  const [ref, inView] = useInView();
  return (
    <section ref={ref} className="card card-pad">
      <h2 className="card-title">{title}</h2>
      <div style={{ height }}>
        {inView && (
          <ResponsiveContainer width="100%" height={height}>
            {children}
          </ResponsiveContainer>
        )}
      </div>
    </section>
  );
}

// Categorías clasificadas de mayor a menor con su valor siempre visible. Cuando hay
// demasiadas se muestran las primeras y el resto queda indicado.
export function RankCard({ title, rows, limit = 8 }) {
  const shown = rows.slice(0, limit);
  const hidden = rows.length - shown.length;
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <section className="card card-pad">
      <h2 className="card-title">{title}</h2>
      {rows.length === 0 ? <p className="small muted">Sin datos</p> : (
        <ul className="bar-list">
          {shown.map((row) => (
            <li key={row.name}>
              <div className="bar-row-head">
                <span className="truncate" title={row.name}>{row.name}</span>
                <span className="bar-row-value">{row.count}</span>
              </div>
              <div className="bar-track" aria-hidden="true">
                <div className="bar-fill" style={{ width: `${(row.count / max) * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
      {hidden > 0 && <p className="small muted" style={{ marginTop: 10 }}>y {hidden} más</p>}
    </section>
  );
}

export function StatTile({ icon: Icon, label, value, text = false }) {
  return (
    <div className="card stat">
      <p className="stat-label">{Icon && <Icon size={14} />} {label}</p>
      <p className={text ? 'stat-value-text' : 'stat-value'} style={text ? { fontWeight: 600 } : undefined}>{value}</p>
    </div>
  );
}

export function BranchBadge({ branch }) {
  if (!branch) return <span className="muted">—</span>;
  return (
    <span className="branch">
      <span className="dot dot-sm" style={{ background: branchColor(branch) }} />
      {branch}
    </span>
  );
}
