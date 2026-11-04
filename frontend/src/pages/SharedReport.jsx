import { Navigate, useParams } from 'react-router-dom';
import { Search, Timer } from 'lucide-react';
import { useShareData } from '../api/queries';
import { formatDateTime } from '../lib/format';
import WeeklyReportView from '../components/report/WeeklyReportView';
import { ReportSkeleton } from '../components/ui/Skeleton';
import { ErrorState, FullPageMessage } from '../components/ui/States';
import InfractionDetail from './InfractionDetail';

export default function SharedReport() {
  const { token } = useParams();
  const { data, error, isPending, refetch } = useShareData(token);

  if (isPending) return <ReportSkeleton />;

  if (error) {
    if (error.status === 410) {
      return <LinkMessage Icon={Timer} title="Enlace expirado" desc="Este enlace ya no es válido." />;
    }
    if (error.status === 404) {
      return <LinkMessage Icon={Search} title="Enlace no encontrado" desc="El enlace no existe o fue eliminado." />;
    }
    return (
      <FullPageMessage>
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>Reporte compartido</h1>
        <ErrorState title="Error al cargar el reporte" message={error.message} onRetry={refetch} style={{ maxWidth: 420 }} />
      </FullPageMessage>
    );
  }

  if (data.type !== 'report') return <Navigate to={`/map/${token}`} replace />;

  if (data.report.type === 'infractions') return <InfractionDetail report={data.report} shared />;

  return (
    <WeeklyReportView
      report={data.report}
      actions={(
        <div style={{ textAlign: 'right' }}>
          <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.75)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 3 }}>
            Válido hasta
          </p>
          <p style={{ fontSize: 12, color: 'white', fontWeight: 500 }}>{formatDateTime(data.expires_at)}</p>
        </div>
      )}
    />
  );
}

function LinkMessage({ Icon, title, desc }) {
  return (
    <FullPageMessage>
      <Icon size={48} color="#64748b" />
      <h1 style={{ fontSize: 22, fontWeight: 700, color: '#0f172a' }}>{title}</h1>
      <p style={{ color: '#475569', fontSize: 14 }}>{desc}</p>
    </FullPageMessage>
  );
}
