import { lazy, Suspense, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertOctagon, AlertTriangle, ArrowLeft, BarChart2, Calendar, Clock, Plus, Trash2, Zap,
} from 'lucide-react';
import { useDeleteReport, useReports } from '../api/queries';
import { formatDay, plural } from '../lib/format';
import { useConfirm } from '../components/ConfirmModal';
import { Skeleton } from '../components/ui/Skeleton';
import { EmptyState, ErrorState } from '../components/ui/States';

const ReportImportModal = lazy(() => import('../components/ReportImportModal'));
const InfractionImportModal = lazy(() => import('../components/InfractionImportModal'));

export default function Reports() {
  const { data: reports = [], error, isPending, refetch } = useReports();
  const deleteReport = useDeleteReport();
  const [activeTab, setActiveTab] = useState('weekly');
  const [showImport, setShowImport] = useState(false);
  const { confirm, dialog } = useConfirm();

  const weekly = reports.filter((r) => !r.type || r.type === 'weekly');
  const infractions = reports.filter((r) => r.type === 'infractions');
  const visible = activeTab === 'weekly' ? weekly : infractions;
  const isWeekly = activeTab === 'weekly';

  async function handleDelete(report) {
    const label = report.label || report.week_label;
    const ok = await confirm({
      title: `¿Eliminar "${label}"?`,
      message: 'Se eliminará el reporte y todos sus datos. Esta acción no se puede deshacer.',
    });
    if (ok) deleteReport.mutate(report.id);
  }

  return (
    <div className="page page-report">
      <header className="app-header app-header-dark">
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <Link to="/" style={backBtn} aria-label="Volver al mapa"><ArrowLeft size={18} /></Link>
          <div style={titleIcon}><BarChart2 size={18} color="white" /></div>
          <div>
            <p style={{ fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,0.75)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 2 }}>
              Módulo de Reportes
            </p>
            <h1 style={{ fontSize: 17, fontWeight: 700, color: 'white', letterSpacing: '-0.01em' }}>Reportes</h1>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)', marginTop: 1 }}>
              {weekly.length} {plural(weekly.length, 'semanal', 'semanales')} · {infractions.length} de infracciones
            </p>
          </div>
        </div>
        <button onClick={() => setShowImport(true)} style={btnWhite}>
          <Plus size={14} />
          {isWeekly ? 'Importar semanal' : 'Importar infracciones'}
        </button>
      </header>

      <nav className="tabs" aria-label="Tipos de reporte">
        <TabButton active={isWeekly} onClick={() => setActiveTab('weekly')} Icon={BarChart2} label="Semanales" count={weekly.length} color="#2563eb" />
        <TabButton active={!isWeekly} onClick={() => setActiveTab('infractions')} Icon={AlertOctagon} label="Infracciones" count={infractions.length} color="#b91c1c" />
      </nav>

      <main className="scroll-body" tabIndex={0}>
        <div style={{ maxWidth: 960, margin: '0 auto' }}>
          {isPending && (
            <div role="status" aria-label="Cargando reportes" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[0, 1, 2].map((i) => <Skeleton key={i} height={94} radius={14} />)}
            </div>
          )}

          {error && <ErrorState message={error.message} onRetry={refetch} />}

          {!isPending && !error && visible.length === 0 && (
            <EmptyState
              icon={isWeekly ? BarChart2 : AlertOctagon}
              title={isWeekly ? 'Sin reportes semanales' : 'Sin reportes de infracciones'}
              description={isWeekly ? 'Importa tu archivo Excel semanal' : 'Importa el archivo de infracciones del sistema GPS'}
              style={{ padding: '60px 20px' }}
              action={(
                <button onClick={() => setShowImport(true)} style={{ ...btnPrimary, background: isWeekly ? '#2563eb' : '#b91c1c' }}>
                  <Plus size={14} /> Importar
                </button>
              )}
            />
          )}

          <ul style={{ display: 'flex', flexDirection: 'column', gap: 12, listStyle: 'none' }}>
            {visible.map((r) => (
              <li key={r.id}><ReportCard report={r} onDelete={() => handleDelete(r)} /></li>
            ))}
          </ul>
        </div>
      </main>

      {showImport && (
        <Suspense fallback={null}>
          {isWeekly
            ? <ReportImportModal onClose={() => setShowImport(false)} />
            : <InfractionImportModal onClose={() => setShowImport(false)} />}
        </Suspense>
      )}
      {dialog}
    </div>
  );
}

function TabButton({ active, onClick, Icon, label, count, color }) {
  return (
    <button
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      style={{ ...tabStyle, ...(active && { color: '#0f172a', borderBottom: `3px solid ${color}`, fontWeight: 700 }) }}
    >
      <Icon size={14} />
      {label}
      <span style={{ background: active ? `${color}18` : '#f1f5f9', color: active ? color : '#475569', borderRadius: 20, padding: '1px 7px', fontSize: 11, fontWeight: 700 }}>
        {count}
      </span>
    </button>
  );
}

function ReportCard({ report: r, onDelete }) {
  const isInfraction = r.type === 'infractions';
  const accent = isInfraction ? '#b91c1c' : '#2563eb';
  const label = r.label || r.week_label;

  return (
    <article className="report-card" style={card}>
      <Link to={`/reports/${r.id}`} style={cardLink}>
        <div style={{ ...iconBox, background: `${accent}12` }}>
          {isInfraction ? <AlertOctagon size={20} color={accent} /> : <BarChart2 size={20} color={accent} />}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'inline-block', marginBottom: 3, fontSize: 10, fontWeight: 700, color: accent, textTransform: 'uppercase', letterSpacing: '0.08em', background: `${accent}12`, padding: '1px 7px', borderRadius: 20 }}>
            {isInfraction ? 'Infracciones' : 'Semanal'}
          </span>
          <p style={{ fontWeight: 700, fontSize: 15, color: '#0f172a', marginBottom: 3 }}>{label}</p>
          <span style={metaItem}>
            <Calendar size={12} />
            {formatDay(r.date_from)} → {formatDay(r.date_to)}
          </span>
        </div>
      </Link>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        {isInfraction ? (
          <StatBadge Icon={AlertOctagon} value={r.summary.infractions} label="infracciones" color="#b91c1c" />
        ) : (
          <>
            <StatBadge Icon={Zap} value={r.summary.voltage_drops} label="caídas" color="#b91c1c" />
            <StatBadge Icon={AlertTriangle} value={r.summary.non_deployed} label="sin salir" color="#b45309" />
            <StatBadge Icon={Clock} value={r.summary.late_departures} label="tardías" color="#2563eb" />
          </>
        )}
        <button onClick={onDelete} style={deleteBtn} aria-label={`Eliminar reporte ${label}`} title="Eliminar reporte">
          <Trash2 size={14} />
        </button>
      </div>
    </article>
  );
}

function StatBadge({ Icon, value, label, color }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: `${color}12`, border: `1px solid ${color}30`, borderRadius: 20, padding: '3px 10px' }}>
      <Icon size={11} color={color} />
      <span style={{ fontSize: 12, fontWeight: 700, color }}>{value}</span>
      <span style={{ fontSize: 11, color: '#334155' }}>{label}</span>
    </div>
  );
}

const backBtn = { background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8, color: 'white', display: 'flex', padding: '7px 9px' };
const titleIcon = { width: 38, height: 38, borderRadius: 10, background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 };
const btnWhite = { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '8px 16px', background: 'white', color: '#0f172a', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' };
const btnPrimary = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 20px', color: 'white', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' };
const tabStyle = { display: 'flex', alignItems: 'center', gap: 6, padding: '14px 20px', background: 'none', border: 'none', borderBottom: '3px solid transparent', cursor: 'pointer', fontSize: 13, color: '#475569', fontWeight: 500, whiteSpace: 'nowrap' };
const card = { background: 'white', border: '1px solid rgba(15,23,42,0.06)', borderRadius: 14, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16, boxShadow: '0 1px 3px rgba(15,23,42,0.06), 0 4px 12px rgba(15,23,42,0.04)' };
const cardLink = { display: 'flex', alignItems: 'center', gap: 14, flex: '1 1 260px', minWidth: 0, textDecoration: 'none', color: 'inherit', borderRadius: 8 };
const iconBox = { width: 42, height: 42, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 };
const metaItem = { display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#475569' };
const deleteBtn = { background: 'none', border: '1px solid #fecaca', borderRadius: 6, cursor: 'pointer', color: '#b91c1c', padding: '5px 8px', display: 'flex' };
