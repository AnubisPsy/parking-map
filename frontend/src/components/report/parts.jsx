import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { ResponsiveContainer } from 'recharts';
import { useInView } from '../../hooks/useInView';
import { branchColor } from '../../lib/colors';

export const cardShadow = '0 1px 3px rgba(15,23,42,0.06), 0 4px 16px rgba(15,23,42,0.04)';
export const cardBorder = '1px solid rgba(15,23,42,0.05)';

export function ReportHeader({ Icon, eyebrow, title, subtitle, backTo, children }) {
  return (
    <header className="app-header app-header-dark">
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
        {backTo && (
          <Link to={backTo} style={backBtn} aria-label="Volver a reportes">
            <ArrowLeft size={18} />
          </Link>
        )}
        <div style={iconBox}>
          <Icon size={18} color="white" />
        </div>
        <div style={{ minWidth: 0 }}>
          <p style={eyebrowStyle}>{eyebrow}</p>
          <h1 style={{ fontSize: 17, fontWeight: 700, color: 'white', letterSpacing: '-0.01em' }}>{title}</h1>
          {subtitle && <p style={subtitleStyle}>{subtitle}</p>}
        </div>
      </div>
      {children}
    </header>
  );
}

export function ReportTabs({ tabs, active, onChange, accent = '#2563eb' }) {
  return (
    <nav className="tabs" aria-label="Secciones del reporte">
      {tabs.map((t) => {
        const selected = active === t.id;
        return (
          <button
            key={t.id}
            onClick={() => onChange(t.id)}
            aria-current={selected ? 'page' : undefined}
            style={{
              ...tabStyle,
              ...(selected && { color: '#0f172a', borderBottom: `3px solid ${accent}`, fontWeight: 700 }),
            }}
          >
            {t.label}
          </button>
        );
      })}
    </nav>
  );
}

// La altura queda reservada desde el inicio: la gráfica se monta al acercarse a la
// pantalla, sin que la página salte.
export function ChartCard({ title, children, height = 180, compact = false }) {
  const [ref, inView] = useInView();
  return (
    <section ref={ref} style={{ ...card, borderRadius: 16, padding: compact ? '18px 20px' : '20px 22px' }}>
      <h2 style={{ ...cardTitle, marginBottom: compact ? 14 : 16 }}>{title}</h2>
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

export function renderPieLabel({ cx, cy, midAngle, innerRadius, outerRadius, percent }) {
  if (percent < 0.06) return null;
  const RADIAN = Math.PI / 180;
  const r = innerRadius + (outerRadius - innerRadius) * 0.55;
  return (
    <text
      x={cx + r * Math.cos(-midAngle * RADIAN)}
      y={cy + r * Math.sin(-midAngle * RADIAN)}
      fill="white"
      textAnchor="middle"
      dominantBaseline="central"
      fontSize={10}
      fontWeight={700}
    >
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
}

export function BranchBadge({ branch }) {
  if (!branch) return <span style={{ color: '#475569', fontSize: 12 }}>—</span>;
  const color = branchColor(branch);
  return (
    <span style={{ background: `${color}0a`, border: `1px solid ${color}40`, color, borderRadius: 6, padding: '1px 7px', fontSize: 11, fontWeight: 600, letterSpacing: '0.02em' }}>
      {branch}
    </span>
  );
}

export const card = { background: 'white', boxShadow: cardShadow, border: cardBorder };
export const cardTitle = {
  fontSize: 10, fontWeight: 700, color: '#475569',
  textTransform: 'uppercase', letterSpacing: '0.1em',
};
export const outlineBtn = {
  display: 'flex', alignItems: 'center', gap: 6, padding: '8px 18px',
  background: 'rgba(255,255,255,0.08)', color: 'white',
  border: '1px solid rgba(255,255,255,0.3)', borderRadius: 8,
  fontSize: 13, fontWeight: 600, cursor: 'pointer', alignSelf: 'center',
};

const backBtn = {
  background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8,
  color: 'white', display: 'flex', padding: '7px 9px', flexShrink: 0,
};
const iconBox = {
  width: 38, height: 38, borderRadius: 10, background: 'rgba(255,255,255,0.1)', flexShrink: 0,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};
const eyebrowStyle = {
  fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,0.75)',
  textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 2,
};
const subtitleStyle = { fontSize: 11, color: 'rgba(255,255,255,0.75)', marginTop: 1 };
const tabStyle = {
  padding: '14px 20px', background: 'none', border: 'none',
  borderBottom: '3px solid transparent', cursor: 'pointer',
  fontSize: 13, color: '#475569', fontWeight: 500, whiteSpace: 'nowrap', letterSpacing: '0.01em',
};
