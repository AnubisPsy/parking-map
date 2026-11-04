import { lazy, Suspense, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Search, Share2 } from 'lucide-react';
import { useReport } from '../api/queries';
import { outlineBtn } from '../components/report/parts';
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
            <Search size={48} color="#64748b" />
            <h1 style={{ fontSize: 22, fontWeight: 700 }}>Reporte no encontrado</h1>
            <p style={{ color: '#475569', fontSize: 14 }}>Es posible que haya sido eliminado.</p>
          </>
        ) : (
          <>
            <h1 style={{ fontSize: 22, fontWeight: 700 }}>Reporte</h1>
            <ErrorState message={error.message} onRetry={refetch} style={{ maxWidth: 420 }} />
          </>
        )}
        <Link to="/reports" style={{ color: '#1d4ed8', fontSize: 14, fontWeight: 600 }}>Volver a reportes</Link>
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
          <button onClick={() => setShowShare(true)} style={outlineBtn}>
            <Share2 size={14} /> Compartir
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
