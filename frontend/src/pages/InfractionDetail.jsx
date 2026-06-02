import { useMemo, useState } from 'react';
import { createShareLink } from '../api';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell, Legend,
} from 'recharts';
import { ArrowLeft, AlertOctagon, Share2, Loader2, Link2, Copy, Check } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const BRANCH_COLORS = {
  CARACAS: '#2563eb', DIXON: '#16a34a', MUELLE: '#d97706',
  TOCOA: '#7c3aed', SATUYE: '#0891b2', GIBSON: '#be185d', CENTRO: '#dc2626',
};
const TYPE_COLORS = ['#dc2626','#d97706','#7c3aed','#2563eb','#16a34a','#0891b2','#be185d','#f59e0b','#64748b','#334155'];
const branchColor = (b) => BRANCH_COLORS[b] || '#64748b';

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso + 'T12:00:00').toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
}

function copyToClipboard(text) {
  if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
  const el = document.createElement('textarea');
  el.value = text;
  el.style.cssText = 'position:fixed;top:-9999px;left:-9999px;opacity:0';
  document.body.appendChild(el);
  el.focus(); el.select();
  try { document.execCommand('copy'); } catch {}
  document.body.removeChild(el);
  return Promise.resolve();
}

// Main export: used standalone AND embedded from ReportDetail
export default function InfractionDetail({ report, id, onBack, showShare = true }) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('resumen');
  const [showShareModal, setShowShareModal] = useState(false);

  const infractions = report.infractions || [];

  const byType = useMemo(() => {
    const map = {};
    infractions.forEach(i => { map[i.infraccion] = (map[i.infraccion] || 0) + 1; });
    return Object.entries(map).sort((a,b) => b[1]-a[1]).map(([name, count]) => ({ name, count }));
  }, [infractions]);

  const byBranch = useMemo(() => {
    const map = {};
    infractions.forEach(i => { map[i.sucursal] = (map[i.sucursal] || 0) + 1; });
    return Object.entries(map).sort((a,b) => b[1]-a[1]).map(([branch, count]) => ({ branch, count }));
  }, [infractions]);

  const byDay = useMemo(() => {
    const map = {};
    infractions.forEach(i => { if (i.date) map[i.date] = (map[i.date] || 0) + 1; });
    return Object.keys(map).sort().map(d => ({ date: d.slice(5), count: map[d] }));
  }, [infractions]);

  const byVehicle = useMemo(() => {
    const map = {};
    infractions.forEach(i => {
      const k = i.vehicle_num ? `${i.vehicle_num} (${i.plate})` : i.plate;
      map[k] = (map[k] || 0) + 1;
    });
    return Object.entries(map).sort((a,b) => b[1]-a[1]).slice(0, 10).map(([name, count]) => ({ name, count }));
  }, [infractions]);

  const uniqueVehicles = useMemo(() => new Set(infractions.map(i => i.plate).filter(Boolean)).size, [infractions]);
  const maxSpeed = useMemo(() => Math.max(0, ...infractions.map(i => i.velocidad || 0)), [infractions]);
  const topType = byType[0]?.name || '—';

  const tabs = [
    { id: 'resumen', label: 'Resumen' },
    { id: 'tabla', label: `Tabla (${infractions.length})` },
  ];

  const handleBack = onBack || (() => navigate('/reports'));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#eef2f7' }}>
      {/* Header */}
      <header style={headerStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <button onClick={handleBack} style={backBtn}><ArrowLeft size={18} /></button>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <AlertOctagon size={18} color="white" />
          </div>
          <div>
            <p style={{ fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 2 }}>Análisis de Infracciones</p>
            <h1 style={{ fontSize: 17, fontWeight: 700, color: 'white', letterSpacing: '-0.01em' }}>{report.label || report.week_label}</h1>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginTop: 1 }}>{formatDate(report.date_from)} — {formatDate(report.date_to)}</p>
          </div>
        </div>
        {showShare && (
          <button onClick={() => setShowShareModal(true)} style={btnOutline}>
            <Share2 size={14} /> Compartir
          </button>
        )}
      </header>

      {/* Tabs */}
      <div style={{ background: 'white', borderBottom: '1px solid #e8ecf0', display: 'flex', padding: '0 32px', gap: 0, overflowX: 'auto' }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)} style={activeTab === t.id ? tabActive : tabStyle}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '28px 40px' }}>
        {activeTab === 'resumen' && (
          <div style={{ maxWidth: 1000, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>
            {/* Summary cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
              <StatCard label="Total infracciones" value={infractions.length} color="#dc2626" />
              <StatCard label="Unidades involucradas" value={uniqueVehicles} color="#7c3aed" />
              <StatCard label="Velocidad máx." value={`${maxSpeed} km/h`} color="#d97706" isText />
              <StatCard label="Infracción más frecuente" value={topType} color="#2563eb" isText />
            </div>

            {/* Charts row 1 */}
            <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 16 }}>
              <ChartCard title="Top infracciones por tipo" height={220}>
                <BarChart data={byType.slice(0, 8)} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={140} />
                  <Tooltip />
                  <Bar dataKey="count" name="Infracciones" radius={[0, 4, 4, 0]}>
                    {byType.slice(0, 8).map((e, i) => <Cell key={i} fill={TYPE_COLORS[i % TYPE_COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ChartCard>

              <ChartCard title="Por sucursal" height={220}>
                <PieChart>
                  <Pie data={byBranch.map(e => ({ name: e.branch, value: e.count }))} dataKey="value" nameKey="name" cx="50%" cy="45%" outerRadius={70} label={renderPieLabel} labelLine={false}>
                    {byBranch.map((e, i) => <Cell key={i} fill={branchColor(e.branch)} />)}
                  </Pie>
                  <Tooltip formatter={(v, n) => [v, n]} />
                  <Legend iconSize={10} wrapperStyle={{ fontSize: 10 }} />
                </PieChart>
              </ChartCard>
            </div>

            {/* Charts row 2 */}
            <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 16 }}>
              <ChartCard title="Tendencia por día">
                <LineChart data={byDay}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                  <Tooltip />
                  <Line type="monotone" dataKey="count" stroke="#dc2626" strokeWidth={2.5} dot={{ fill: '#dc2626', r: 4 }} activeDot={{ r: 6 }} name="Infracciones" />
                </LineChart>
              </ChartCard>

              <ChartCard title="Top 10 unidades infractoras" height={220}>
                <BarChart data={byVehicle} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 9 }} width={100} />
                  <Tooltip />
                  <Bar dataKey="count" name="Infracciones" fill="#dc2626" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ChartCard>
            </div>
          </div>
        )}

        {activeTab === 'tabla' && (
          <div style={{ maxWidth: 1100, margin: '0 auto' }}>
            <InfractionTable infractions={infractions} />
          </div>
        )}
      </div>

      {showShareModal && id && (
        <InfractionShareModal reportId={id} onClose={() => setShowShareModal(false)} />
      )}
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

function StatCard({ label, value, color, isText }) {
  return (
    <div style={{ background: 'white', borderRadius: 16, padding: '20px 22px', boxShadow: '0 1px 3px rgba(15,23,42,0.06), 0 6px 20px rgba(15,23,42,0.04)', border: '1px solid rgba(15,23,42,0.05)' }}>
      {isText
        ? <p style={{ fontSize: 16, fontWeight: 700, color, lineHeight: 1.3, marginBottom: 5, wordBreak: 'break-word' }}>{value}</p>
        : <p style={{ fontSize: 36, fontWeight: 800, color, lineHeight: 1, letterSpacing: '-0.03em', marginBottom: 5 }}>{value}</p>
      }
      <p style={{ fontSize: 10, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{label}</p>
    </div>
  );
}

function ChartCard({ title, children, height = 180 }) {
  return (
    <div style={{ background: 'white', borderRadius: 16, padding: '20px 22px', boxShadow: '0 1px 3px rgba(15,23,42,0.06), 0 4px 16px rgba(15,23,42,0.04)', border: '1px solid rgba(15,23,42,0.05)' }}>
      <p style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{title}</p>
      <ResponsiveContainer width="100%" height={height}>{children}</ResponsiveContainer>
    </div>
  );
}

function renderPieLabel({ cx, cy, midAngle, innerRadius, outerRadius, percent }) {
  if (percent < 0.06) return null;
  const RADIAN = Math.PI / 180;
  const r = innerRadius + (outerRadius - innerRadius) * 0.55;
  return (
    <text x={cx + r * Math.cos(-midAngle * RADIAN)} y={cy + r * Math.sin(-midAngle * RADIAN)}
      fill="white" textAnchor="middle" dominantBaseline="central" fontSize={10} fontWeight={700}>
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
}

function InfractionTable({ infractions }) {
  const [filterSucursal, setFilterSucursal] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');

  const branches = useMemo(() => [...new Set(infractions.map(i => i.sucursal).filter(Boolean))].sort(), [infractions]);
  const types = useMemo(() => [...new Set(infractions.map(i => i.infraccion).filter(Boolean))].sort(), [infractions]);

  const filtered = useMemo(() => infractions.filter(i => {
    if (filterSucursal && i.sucursal !== filterSucursal) return false;
    if (filterType && i.infraccion !== filterType) return false;
    if (filterDateFrom && i.date && i.date < filterDateFrom) return false;
    if (filterDateTo && i.date && i.date > filterDateTo) return false;
    return true;
  }), [infractions, filterSucursal, filterType, filterDateFrom, filterDateTo]);

  const hasFilters = filterSucursal || filterType || filterDateFrom || filterDateTo;

  const columns = [
    { key: 'vehicle_num', label: 'Unidad', width: 90 },
    { key: 'plate', label: 'Placa', width: 110 },
    { key: 'sucursal', label: 'Sucursal', width: 110, render: v => <BranchBadge branch={v} /> },
    { key: 'infraccion', label: 'Infracción', flex: 1 },
    { key: 'velocidad', label: 'Velocidad', width: 90, render: v => v ? `${v} km/h` : '—' },
    { key: 'duracion', label: 'Duración', width: 90 },
    { key: 'fecha', label: 'Fecha', width: 160 },
  ];

  if (!infractions.length) return <p style={{ color: '#94a3b8', textAlign: 'center', padding: 40 }}>Sin infracciones</p>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Barra de filtros */}
      <div style={{ background: 'white', borderRadius: 12, padding: '14px 18px', boxShadow: '0 1px 3px rgba(15,23,42,0.06)', border: '1px solid rgba(15,23,42,0.05)', display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
        <select value={filterSucursal} onChange={e => setFilterSucursal(e.target.value)} style={filterSelect}>
          <option value="">Todas las sucursales</option>
          {branches.map(b => <option key={b} value={b}>{b}</option>)}
        </select>
        <select value={filterType} onChange={e => setFilterType(e.target.value)} style={filterSelect}>
          <option value="">Todas las infracciones</option>
          {types.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>Desde</span>
          <input type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} style={filterInput} />
          <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>Hasta</span>
          <input type="date" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)} style={filterInput} />
        </div>
        {hasFilters && (
          <button onClick={() => { setFilterSucursal(''); setFilterType(''); setFilterDateFrom(''); setFilterDateTo(''); }} style={clearFilterBtn}>
            ✕ Limpiar
          </button>
        )}
        <span style={{ marginLeft: 'auto', fontSize: 12, color: '#94a3b8' }}>
          {filtered.length !== infractions.length
            ? <><strong style={{ color: '#dc2626' }}>{filtered.length}</strong> de {infractions.length}</>
            : <>{infractions.length} registros</>}
        </span>
      </div>

      {/* Tabla */}
      <div style={{ background: 'white', borderRadius: 14, overflow: 'hidden', boxShadow: '0 1px 3px rgba(15,23,42,0.06), 0 4px 16px rgba(15,23,42,0.04)', border: '1px solid rgba(15,23,42,0.05)' }}>
        <div style={{ display: 'flex', background: '#f8fafc', borderBottom: '1px solid #f1f5f9', padding: '11px 20px' }}>
          {columns.map(col => (
            <div key={col.key} style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.09em', width: col.width, flex: col.flex, minWidth: col.width }}>
              {col.label}
            </div>
          ))}
        </div>
        <div style={{ maxHeight: 'calc(100vh - 340px)', overflowY: 'auto' }}>
          {filtered.length === 0
            ? <p style={{ color: '#94a3b8', textAlign: 'center', padding: 32, fontSize: 13 }}>Sin resultados para los filtros seleccionados</p>
            : filtered.map((row, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', padding: '10px 20px', borderBottom: i < filtered.length - 1 ? '1px solid #f8fafc' : 'none', background: i % 2 === 0 ? 'white' : '#fafbfc' }}>
                {columns.map(col => (
                  <div key={col.key} style={{ fontSize: 12, color: '#334155', width: col.width, flex: col.flex, minWidth: col.width, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: col.flex ? 'nowrap' : 'normal' }}>
                    {col.render ? col.render(row[col.key]) : (row[col.key] || '—')}
                  </div>
                ))}
              </div>
            ))
          }
        </div>
      </div>
    </div>
  );
}

function BranchBadge({ branch }) {
  if (!branch) return <span style={{ color: '#cbd5e1' }}>—</span>;
  const color = BRANCH_COLORS[branch] || '#64748b';
  return <span style={{ background: color + '14', color, borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 600 }}>{branch}</span>;
}

function InfractionShareModal({ reportId, onClose }) {
  const [mins, setMins] = useState(1440);
  const [link, setLink] = useState('');
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleCreate() {
    setLoading(true); setError('');
    try {
      const res = await createShareLink({ report_id: reportId, expires_in_minutes: mins });
      setLink(`${window.location.origin}/report/${res.token}`);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }

  const OPTIONS = [{ label: '1 hora', value: 60 }, { label: '24 horas', value: 1440 }, { label: '3 días', value: 4320 }, { label: '7 días', value: 10080 }];

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: 'white', borderRadius: 14, padding: 28, width: 440, maxWidth: '95vw', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <Link2 size={20} color="#dc2626" />
            <h3 style={{ fontSize: 16, fontWeight: 700 }}>Compartir infracciones</h3>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: 18 }}>✕</button>
        </div>
        {!link ? (
          <>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
              {OPTIONS.map(o => (
                <button key={o.value} onClick={() => setMins(o.value)} style={{ padding: '7px 14px', borderRadius: 8, border: `1px solid ${mins === o.value ? '#dc2626' : '#e2e8f0'}`, background: mins === o.value ? '#fef2f2' : '#f8fafc', color: mins === o.value ? '#dc2626' : '#374151', fontWeight: mins === o.value ? 700 : 400, cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}>
                  {o.label}
                </button>
              ))}
            </div>
            {error && <p style={{ color: '#dc2626', fontSize: 13, marginBottom: 12 }}>{error}</p>}
            <button onClick={handleCreate} disabled={loading} style={{ width: '100%', padding: '10px', background: '#dc2626', color: 'white', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              {loading ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Link2 size={16} />}
              Generar enlace
            </button>
          </>
        ) : (
          <div>
            <p style={{ fontSize: 13, color: '#16a34a', fontWeight: 600, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}><Check size={15} /> Enlace generado</p>
            <div style={{ display: 'flex', gap: 8 }}>
              <input readOnly value={link} style={{ flex: 1, padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 12, outline: 'none', fontFamily: 'inherit' }} />
              <button onClick={() => { copyToClipboard(link); setCopied(true); setTimeout(() => setCopied(false), 2000); }} style={{ padding: '8px 14px', background: copied ? '#16a34a' : '#dc2626', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontFamily: 'inherit' }}>
                {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Copiado' : 'Copiar'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const headerStyle = { background: '#0f172a', padding: '16px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 };
const backBtn = { background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, cursor: 'pointer', color: 'white', display: 'flex', padding: '7px 9px' };
const btnOutline = { display: 'flex', alignItems: 'center', gap: 6, padding: '8px 18px', background: 'rgba(255,255,255,0.08)', color: 'white', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' };
const tabStyle = { padding: '14px 20px', background: 'none', border: 'none', borderBottom: '3px solid transparent', cursor: 'pointer', fontSize: 13, color: '#64748b', fontFamily: 'inherit', fontWeight: 500, whiteSpace: 'nowrap' };
const tabActive = { ...tabStyle, color: '#0f172a', borderBottomColor: '#dc2626', fontWeight: 700 };
const filterSelect = { padding: '7px 10px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 12, color: '#334155', background: '#f8fafc', cursor: 'pointer', fontFamily: 'inherit', outline: 'none', maxWidth: 200 };
const filterInput = { padding: '6px 10px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 12, color: '#334155', background: '#f8fafc', fontFamily: 'inherit', outline: 'none' };
const clearFilterBtn = { padding: '6px 12px', border: '1px solid #fecaca', borderRadius: 8, background: '#fef2f2', color: '#dc2626', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' };
