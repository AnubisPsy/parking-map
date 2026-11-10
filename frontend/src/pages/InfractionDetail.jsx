import { lazy, Suspense, useMemo, useState } from 'react';
import { AlertOctagon, Gauge, Share2, Truck, TriangleAlert, X } from 'lucide-react';
import { formatDay } from '../lib/format';
import { countBy } from '../lib/reportStats';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { ColumnChart } from '../components/report/charts';
import { BranchBadge, ChartCard, RankCard, ReportHeader, ReportTabs, StatTile } from '../components/report/parts';
import DataTable from '../components/ui/DataTable';
import { EmptyState } from '../components/ui/States';

const ReportShareModal = lazy(() => import('../components/report/ReportShareModal'));

// Se usa desde la vista privada (`id`) y desde el enlace compartido (`shared`, sin navegación ni botón de compartir)
export default function InfractionDetail({ report, id, expiresAt, shared = false }) {
  const [activeTab, setActiveTab] = useState('resumen');
  const [showShareModal, setShowShareModal] = useState(false);

  const infractions = report.infractions;

  const byType = useMemo(() => countBy(infractions, 'infraccion', 'name'), [infractions]);
  const byBranch = useMemo(() => countBy(infractions, 'sucursal', 'name'), [infractions]);
  const byDay = useMemo(() => {
    const dated = infractions.filter((i) => i.date);
    return countBy(dated, 'date', 'date')
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((d) => ({ date: d.date.slice(5).replace('-', '/'), count: d.count }));
  }, [infractions]);
  const byVehicle = useMemo(() => {
    const labelled = infractions.map((i) => ({
      name: i.vehicle_num ? `${i.vehicle_num} (${i.plate})` : i.plate,
    }));
    return countBy(labelled, 'name', 'name');
  }, [infractions]);
  const uniqueVehicles = useMemo(() => new Set(infractions.map((i) => i.plate).filter(Boolean)).size, [infractions]);
  const maxSpeed = useMemo(() => infractions.reduce((max, i) => Math.max(max, i.velocidad || 0), 0), [infractions]);

  const tabs = [
    { id: 'resumen', label: 'Resumen' },
    { id: 'tabla', label: `Tabla (${infractions.length})` },
  ];

  return (
    <div className="page">
      <ReportHeader
        title={report.label || report.week_label}
        subtitle={`Infracciones · ${formatDay(report.date_from)} — ${formatDay(report.date_to)}`}
        backTo={shared ? undefined : '/reports'}
        expiresAt={expiresAt}
      >
        {!shared && (
          <button onClick={() => setShowShareModal(true)} className="btn btn-secondary">
            <Share2 size={15} /> Compartir
          </button>
        )}
      </ReportHeader>

      <ReportTabs tabs={tabs} active={activeTab} onChange={setActiveTab} />

      <main className="scroll-body" tabIndex={0}>
        {activeTab === 'resumen' && (
          <div className="content">
            <div className="grid-auto" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 150px), 1fr))' }}>
              <StatTile icon={AlertOctagon} label="Total de infracciones" value={infractions.length} />
              <StatTile icon={Truck} label="Unidades involucradas" value={uniqueVehicles} />
              <StatTile icon={Gauge} label="Velocidad máxima" value={`${maxSpeed} km/h`} />
              <StatTile icon={TriangleAlert} label="Más frecuente" value={byType[0]?.name || '—'} text />
            </div>

            <ChartCard title="Infracciones por día" height={220}>
              <ColumnChart data={byDay} xKey="date" name="Infracciones" />
            </ChartCard>

            <div className="grid-auto" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))' }}>
              <RankCard title="Por tipo" rows={byType} />
              <RankCard title="Por sucursal" rows={byBranch} />
              <RankCard title="Unidades con más infracciones" rows={byVehicle} limit={10} />
            </div>
          </div>
        )}

        {activeTab === 'tabla' && (
          <div className="content" style={{ maxWidth: 1180 }}>
            <InfractionTable infractions={infractions} />
          </div>
        )}
      </main>

      {showShareModal && id && (
        <Suspense fallback={null}>
          <ReportShareModal reportId={id} title="Compartir infracciones" onClose={() => setShowShareModal(false)} />
        </Suspense>
      )}
    </div>
  );
}

const TABLE_COLUMNS = [
  { key: 'vehicle_num', label: 'Unidad', width: 90 },
  { key: 'plate', label: 'Placa', width: 110 },
  { key: 'sucursal', label: 'Sucursal', width: 120, render: (v) => <BranchBadge branch={v} /> },
  { key: 'infraccion', label: 'Infracción', flex: 1 },
  { key: 'velocidad', label: 'Velocidad', width: 90, render: (v) => (v ? `${v} km/h` : '—') },
  { key: 'duracion', label: 'Duración', width: 90 },
  { key: 'fecha', label: 'Fecha', width: 170 },
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
    <>
      <div className="card filter-bar">
        <select value={sucursal} onChange={(e) => setSucursal(e.target.value)} className="input input-sm" aria-label="Filtrar por sucursal">
          <option value="">Todas las sucursales</option>
          {branches.map((b) => <option key={b} value={b}>{b}</option>)}
        </select>
        <select value={type} onChange={(e) => setType(e.target.value)} className="input input-sm" aria-label="Filtrar por infracción">
          <option value="">Todas las infracciones</option>
          {types.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <label>
          Desde
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="input input-sm" />
        </label>
        <label>
          Hasta
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="input input-sm" />
        </label>
        {hasFilters && (
          <button onClick={clearFilters} className="btn btn-ghost" style={{ minHeight: 32 }}>
            <X size={14} /> Limpiar
          </button>
        )}
        <span role="status" className="small muted" style={{ marginLeft: 'auto' }}>
          {filtered.length !== infractions.length
            ? <><strong style={{ color: 'var(--ink)' }}>{filtered.length}</strong> de {infractions.length}</>
            : <>{infractions.length} registros</>}
        </span>
      </div>

      {filtered.length === 0 ? (
        <div className="card">
          <EmptyState title="No hay resultados" description="Prueba con otros filtros." />
        </div>
      ) : (
        <DataTable label="Infracciones" data={filtered} columns={TABLE_COLUMNS} maxHeight="calc(100dvh - 330px)" />
      )}
    </>
  );
}
