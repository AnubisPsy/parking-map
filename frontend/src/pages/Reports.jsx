import { lazy, Suspense, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertOctagon, BarChart2, Plus, Trash2 } from 'lucide-react';
import { useDeleteReport, useReports } from '../api/queries';
import { formatDay } from '../lib/format';
import { useConfirm } from '../components/ConfirmModal';
import AppHeader from '../components/ui/AppHeader';
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
  const importLabel = isWeekly ? 'Importar semanal' : 'Importar infracciones';

  async function handleDelete(report) {
    const label = report.label || report.week_label;
    const ok = await confirm({
      title: `¿Eliminar "${label}"?`,
      message: 'Se eliminará el reporte y todos sus datos. Esta acción no se puede deshacer.',
    });
    if (ok) deleteReport.mutate(report.id);
  }

  return (
    <div className="page">
      <AppHeader />

      <section className="page-head" aria-label="Encabezado de la página">
        <div>
          <h1 className="page-title">Reportes</h1>
          <p className="page-subtitle">Resúmenes semanales e infracciones de la flota.</p>
        </div>
        <button onClick={() => setShowImport(true)} className="btn btn-primary">
          <Plus size={15} /> {importLabel}
        </button>
      </section>

      <nav className="tabs" aria-label="Tipos de reporte">
        <button onClick={() => setActiveTab('weekly')} aria-current={isWeekly ? 'page' : undefined}>
          Semanales <span className="badge">{weekly.length}</span>
        </button>
        <button onClick={() => setActiveTab('infractions')} aria-current={!isWeekly ? 'page' : undefined}>
          Infracciones <span className="badge">{infractions.length}</span>
        </button>
      </nav>

      <main className="scroll-body" tabIndex={0}>
        <div className="content" style={{ maxWidth: 860, gap: 8 }}>
          {isPending && (
            <div role="status" aria-label="Cargando reportes" className="stack" style={{ gap: 8 }}>
              {[0, 1, 2].map((i) => <Skeleton key={i} height={68} radius={12} />)}
            </div>
          )}

          {error && <ErrorState message={error.message} onRetry={refetch} />}

          {!isPending && !error && visible.length === 0 && (
            <EmptyState
              icon={isWeekly ? BarChart2 : AlertOctagon}
              title={isWeekly ? 'Sin reportes semanales' : 'Sin reportes de infracciones'}
              description={isWeekly ? 'Importa tu archivo Excel semanal para verlo aquí.' : 'Importa el archivo de infracciones del sistema GPS.'}
              style={{ padding: '60px 20px' }}
              action={(
                <button onClick={() => setShowImport(true)} className="btn btn-primary">
                  <Plus size={15} /> Importar
                </button>
              )}
            />
          )}

          <ul className="stack" style={{ gap: 8 }}>
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

function ReportCard({ report: r, onDelete }) {
  const isInfraction = r.type === 'infractions';
  const label = r.label || r.week_label;

  return (
    <article className="card report-card">
      <Link to={`/reports/${r.id}`} className="report-link">
        <span className="report-icon">
          {isInfraction ? <AlertOctagon size={18} /> : <BarChart2 size={18} />}
        </span>
        <span style={{ minWidth: 0 }}>
          <span className="report-name" style={{ display: 'block' }}>{label}</span>
          <span className="report-meta">{formatDay(r.date_from)} — {formatDay(r.date_to)}</span>
        </span>
      </Link>

      <div className="report-stats">
        {isInfraction ? (
          <span><strong>{r.summary.infractions}</strong> infracciones</span>
        ) : (
          <>
            <span><strong>{r.summary.voltage_drops}</strong> caídas</span>
            <span><strong>{r.summary.non_deployed}</strong> sin salir</span>
            <span><strong>{r.summary.late_departures}</strong> tardías</span>
          </>
        )}
      </div>
      <button onClick={onDelete} className="icon-btn icon-btn-danger" aria-label={`Eliminar reporte ${label}`} title="Eliminar reporte">
        <Trash2 size={15} />
      </button>
    </article>
  );
}
