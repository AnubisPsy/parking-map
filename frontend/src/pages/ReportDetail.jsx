import { lazy, Suspense, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Search, Share2 } from 'lucide-react';
import { useReport } from '../api/queries';
import WeeklyReportView from '../components/report/WeeklyReportView';
import { ReportSkeleton } from '../components/ui/Skeleton';
import { ErrorState, FullPageMessage } from '../components/ui/States';
import InfractionDetail from './InfractionDetail';

const ReportShareModal = lazy(() => import('../components/report/ReportShareModal'));

export default function ReportDetail() {
  const { id } = useParams();
  const { data: report, error, isPending, refetch } = useReport(id);
  const [showShare, setShowShare] = useState(false);

  if (isPending) return <ReportSkeleton />;

  if (error) {
    return (
      <FullPageMessage>
        {error.status === 404 ? (
          <>
            <Search size={36} color="var(--ink-3)" />
            <h1 className="page-title">Reporte no encontrado</h1>
            <p className="muted">Es posible que haya sido eliminado.</p>
          </>
        ) : (
          <>
            <h1 className="page-title">Reporte</h1>
            <ErrorState message={error.message} onRetry={refetch} />
          </>
        )}
        <Link to="/reports" className="btn btn-secondary">Volver a reportes</Link>
      </FullPageMessage>
    );
  }

  if (report.type === 'infractions') return <InfractionDetail report={report} id={id} />;

  return (
    <>
      <WeeklyReportView
        report={report}
        backTo="/reports"
        actions={(
          <button onClick={() => setShowShare(true)} className="btn btn-secondary">
            <Share2 size={15} /> Compartir
          </button>
        )}
      />
      {showShare && (
        <Suspense fallback={null}>
          <ReportShareModal reportId={id} title="Compartir reporte" onClose={() => setShowShare(false)} />
        </Suspense>
      )}
    </>
  );
}
