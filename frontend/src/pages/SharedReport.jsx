import { Navigate, useParams } from 'react-router-dom';
import { Search, Timer } from 'lucide-react';
import { useShareData } from '../api/queries';
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
        <h1 className="page-title">Reporte compartido</h1>
        <ErrorState title="Error al cargar el reporte" message={error.message} onRetry={refetch} />
      </FullPageMessage>
    );
  }

  if (data.type !== 'report') return <Navigate to={`/${data.type === 'tracks' ? 'recorrido' : 'map'}/${token}`} replace />;

  if (data.report.type === 'infractions') {
    return <InfractionDetail report={data.report} expiresAt={data.expires_at} shared />;
  }

  return <WeeklyReportView report={data.report} expiresAt={data.expires_at} />;
}

function LinkMessage({ Icon, title, desc }) {
  return (
    <FullPageMessage>
      <Icon size={36} color="var(--ink-3)" />
      <h1 className="page-title">{title}</h1>
      <p className="muted">{desc}</p>
    </FullPageMessage>
  );
}
