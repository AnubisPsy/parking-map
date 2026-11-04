import { lazy, Suspense, useMemo, useState } from 'react';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie,
  XAxis, YAxis, Tooltip, CartesianGrid, Cell, Legend,
} from 'recharts';
import { AlertOctagon, Share2, X } from 'lucide-react';
import { branchColor } from '../lib/colors';
import { formatDay } from '../lib/format';
import { countBy } from '../lib/reportStats';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import DataTable from '../components/ui/DataTable';
import { EmptyState } from '../components/ui/States';
import {
  BranchBadge, card, ChartCard, outlineBtn, renderPieLabel, ReportHeader, ReportTabs,
} from '../components/report/parts';

const ReportShareModal = lazy(() => import('../components/report/ReportShareModal'));

const TYPE_COLORS = ['#b91c1c', '#b45309', '#7c3aed', '#2563eb', '#15803d', '#0e7490', '#be185d', '#a16207', '#64748b', '#334155'];

// Se usa desde la vista privada (`id`) y desde el enlace compartido (`shared`, sin navegación ni botón de compartir)
export default function InfractionDetail({ report, id, shared = false }) {
  const [activeTab, setActiveTab] = useState('resumen');
  const [showShareModal, setShowShareModal] = useState(false);

  const infractions = report.infractions;

  const byType = useMemo(() => countBy(infractions, 'infraccion', 'name'), [infractions]);
  const byBranch = useMemo(
    () => countBy(infractions, 'sucursal', 'name').map((b) => ({ name: b.name, value: b.count })),
    [infractions],
  );
  const byDay = useMemo(() => {
    const dated = infractions.filter((i) => i.date);
    return countBy(dated, 'date', 'date')
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((d) => ({ date: d.date.slice(5), count: d.count }));
  }, [infractions]);
  const byVehicle = useMemo(() => {
    const labelled = infractions.map((i) => ({
      name: i.vehicle_num ? `${i.vehicle_num} (${i.plate})` : i.plate,
    }));
    return countBy(labelled, 'name', 'name').slice(0, 10);
  }, [infractions]);
  const uniqueVehicles = useMemo(() => new Set(infractions.map((i) => i.plate).filter(Boolean)).size, [infractions]);
  const maxSpeed = useMemo(() => infractions.reduce((max, i) => Math.max(max, i.velocidad || 0), 0), [infractions]);
  const topTypes = byType.slice(0, 8);

  const tabs = [
    { id: 'resumen', label: 'Resumen' },
    { id: 'tabla', label: `Tabla (${infractions.length})` },
  ];

  return (
    <div className="page page-report">
      <ReportHeader
        Icon={AlertOctagon}
        eyebrow="Análisis de Infracciones"
        title={report.label || report.week_label}
        subtitle={`${formatDay(report.date_from)} — ${formatDay(report.date_to)}`}
        backTo={shared ? undefined : '/reports'}
      >
        {!shared && (
          <button onClick={() => setShowShareModal(true)} style={outlineBtn}>
            <Share2 size={14} /> Compartir
          </button>
        )}
      </ReportHeader>

      <ReportTabs tabs={tabs} active={activeTab} onChange={setActiveTab} accent="#b91c1c" />

      <main className="scroll-body" tabIndex={0}>
        {activeTab === 'resumen' && (
          <div style={{ maxWidth: 1000, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div className="grid-auto" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))' }}>
              <StatCard label="Total infracciones" value={infractions.length} color="#b91c1c" />
              <StatCard label="Unidades involucradas" value={uniqueVehicles} color="#7c3aed" />
              <StatCard label="Velocidad máx." value={`${maxSpeed} km/h`} color="#b45309" isText />
              <StatCard label="Infracción más frecuente" value={byType[0]?.name || '—'} color="#2563eb" isText />
            </div>

            <div className="grid-3-2">
              <ChartCard title="Top infracciones por tipo" height={220}>
                <BarChart data={topTypes} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={140} />
                  <Tooltip />
                  <Bar dataKey="count" name="Infracciones" radius={[0, 4, 4, 0]}>
                    {topTypes.map((e, i) => <Cell key={i} fill={TYPE_COLORS[i % TYPE_COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ChartCard>

              <ChartCard title="Por sucursal" height={220}>
                <PieChart>
                  <Pie data={byBranch} dataKey="value" nameKey="name" cx="50%" cy="45%" outerRadius={70} label={renderPieLabel} labelLine={false}>
                    {byBranch.map((e, i) => <Cell key={i} fill={branchColor(e.name)} />)}
                  </Pie>
                  <Tooltip formatter={(v, n) => [v, n]} />
                  <Legend iconSize={10} wrapperStyle={{ fontSize: 10 }} />
                </PieChart>
              </ChartCard>
            </div>

            <div className="grid-3-2">
              <ChartCard title="Tendencia por día">
                <LineChart data={byDay}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                  <Tooltip />
                  <Line type="monotone" dataKey="count" stroke="#b91c1c" strokeWidth={2.5} dot={{ fill: '#b91c1c', r: 4 }} activeDot={{ r: 6 }} name="Infracciones" />
                </LineChart>
              </ChartCard>

              <ChartCard title="Top 10 unidades infractoras" height={220}>
                <BarChart data={byVehicle} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 9 }} width={100} />
                  <Tooltip />
                  <Bar dataKey="count" name="Infracciones" fill="#b91c1c" radius={[0, 4, 4, 0]} />
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
      </main>

      {showShareModal && id && (
        <Suspense fallback={null}>
          <ReportShareModal
            reportId={id}
            title="Compartir infracciones"
            accent="#b91c1c"
            onClose={() => setShowShareModal(false)}
          />
        </Suspense>
      )}
    </div>
  );
}

function StatCard({ label, value, color, isText }) {
  return (
    <div style={{ ...card, borderRadius: 16, padding: '20px 22px' }}>
      {isText
        ? <p style={{ fontSize: 16, fontWeight: 700, color, lineHeight: 1.3, marginBottom: 5, wordBreak: 'break-word' }}>{value}</p>
        : <p style={{ fontSize: 36, fontWeight: 800, color, lineHeight: 1, letterSpacing: '-0.03em', marginBottom: 5 }}>{value}</p>}
      <p style={{ fontSize: 10, fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{label}</p>
    </div>
  );
}

const TABLE_COLUMNS = [
  { key: 'vehicle_num', label: 'Unidad', width: 90 },
  { key: 'plate', label: 'Placa', width: 110 },
  { key: 'sucursal', label: 'Sucursal', width: 110, render: (v) => <BranchBadge branch={v} /> },
  { key: 'infraccion', label: 'Infracción', flex: 1 },
  { key: 'velocidad', label: 'Velocidad', width: 90, render: (v) => (v ? `${v} km/h` : '—') },
  { key: 'duracion', label: 'Duración', width: 90 },
  { key: 'fecha', label: 'Fecha', width: 160 },
];

function InfractionTable({ infractions }) {
  const [sucursal, setSucursal] = useState('');
  const [type, setType] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const appliedFrom = useDebouncedValue(dateFrom);
  const appliedTo = useDebouncedValue(dateTo);

  const branches = useMemo(() => [...new Set(infractions.map((i) => i.sucursal).filter(Boolean))].sort(), [infractions]);
  const types = useMemo(() => [...new Set(infractions.map((i) => i.infraccion).filter(Boolean))].sort(), [infractions]);

  const filtered = useMemo(() => infractions.filter((i) => {
    if (sucursal && i.sucursal !== sucursal) return false;
    if (type && i.infraccion !== type) return false;
    if (appliedFrom && i.date && i.date < appliedFrom) return false;
    if (appliedTo && i.date && i.date > appliedTo) return false;
    return true;
  }), [infractions, sucursal, type, appliedFrom, appliedTo]);

  const hasFilters = sucursal || type || dateFrom || dateTo;

  function clearFilters() {
    setSucursal('');
    setType('');
    setDateFrom('');
    setDateTo('');
  }

  if (!infractions.length) return <EmptyState icon={AlertOctagon} title="Sin infracciones" />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ ...card, borderRadius: 12, padding: '14px 18px', display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
        <select value={sucursal} onChange={(e) => setSucursal(e.target.value)} style={filterSelect} aria-label="Filtrar por sucursal">
          <option value="">Todas las sucursales</option>
          {branches.map((b) => <option key={b} value={b}>{b}</option>)}
        </select>
        <select value={type} onChange={(e) => setType(e.target.value)} style={filterSelect} aria-label="Filtrar por infracción">
          <option value="">Todas las infracciones</option>
          {types.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
          <label style={filterLabel}>
            Desde
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} style={filterInput} />
          </label>
          <label style={filterLabel}>
            Hasta
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} style={filterInput} />
          </label>
        </div>
        {hasFilters && (
          <button onClick={clearFilters} style={clearFilterBtn}>
            <X size={13} /> Limpiar
          </button>
        )}
        <span role="status" style={{ marginLeft: 'auto', fontSize: 12, color: '#475569' }}>
          {filtered.length !== infractions.length
            ? <><strong style={{ color: '#b91c1c' }}>{filtered.length}</strong> de {infractions.length}</>
            : <>{infractions.length} registros</>}
        </span>
      </div>

      {filtered.length === 0 ? (
        <div style={{ ...card, borderRadius: 14 }}>
          <EmptyState title="No hay resultados" description="Prueba con otros filtros." />
        </div>
      ) : (
        <DataTable label="Infracciones" data={filtered} columns={TABLE_COLUMNS} maxHeight="calc(100dvh - 340px)" />
      )}
    </div>
  );
}

const filterSelect = { padding: '7px 10px', border: '1px solid #cbd5e1', borderRadius: 8, fontSize: 12, color: '#334155', background: '#f8fafc', cursor: 'pointer', maxWidth: 200 };
const filterLabel = { display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#475569', fontWeight: 600 };
const filterInput = { padding: '6px 10px', border: '1px solid #cbd5e1', borderRadius: 8, fontSize: 12, color: '#334155', background: '#f8fafc' };
const clearFilterBtn = { display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', border: '1px solid #fecaca', borderRadius: 8, background: '#fef2f2', color: '#b91c1c', fontSize: 12, fontWeight: 600, cursor: 'pointer' };
