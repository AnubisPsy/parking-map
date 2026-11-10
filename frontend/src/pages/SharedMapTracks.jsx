import { useMemo } from 'react';
import { Navigate, useLocation, useParams, useSearchParams } from 'react-router-dom';
import { Clock, Search } from 'lucide-react';
import { useShareData } from '../api/queries';
import { sharedMapNav } from '../components/ui/AppHeader';
import { Skeleton } from '../components/ui/Skeleton';
import { ErrorState, FullPageMessage } from '../components/ui/States';
import { SharedTracksView } from './SharedTracks';

// Sección "Recorridos" de un mapa compartido: la misma tabla de paradas de la vista
// privada, con los recorridos que se guardaron en el enlace.
export default function SharedMapTracks() {
  const { token } = useParams();
  const { search } = useLocation();
  const [searchParams] = useSearchParams();
  const { data, error, isPending, refetch } = useShareData(token);
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  const win = useMemo(() => (from || to ? { from, to } : null), [from, to]);

  if (isPending) {
    return (
      <div className="page">
        <div className="app-header" />
        <div role="status" aria-label="Cargando recorridos" className="content tracks-layout" style={{ maxWidth: 1240, padding: 20 }}>
          <Skeleton height={320} radius={12} />
          <Skeleton height={420} radius={12} />
        </div>
      </div>
    );
  }

  if (error) {
    const message = error.status === 410
      ? { Icon: Clock, title: 'Enlace expirado', desc: 'Este enlace ya no es válido. Solicita uno nuevo.' }
      : error.status === 404
        ? { Icon: Search, title: 'Enlace no encontrado', desc: 'El enlace no existe o fue eliminado.' }
        : null;
    if (!message) {
      return (
        <FullPageMessage>
          <h1 className="page-title">Recorridos compartidos</h1>
          <ErrorState title="Error al cargar los recorridos" message={error.message} onRetry={refetch} />
        </FullPageMessage>
      );
    }
    return (
      <FullPageMessage>
        <message.Icon size={36} color="var(--ink-3)" />
        <h1 className="page-title">{message.title}</h1>
        <p className="muted">{message.desc}</p>
      </FullPageMessage>
    );
  }

  if (data.type === 'tracks') return <Navigate to={`/recorrido/${token}`} replace />;
  if (data.type !== 'parking') return <Navigate to={`/report/${token}`} replace />;
  return <SharedTracksView data={data} nav={sharedMapNav(token, search)} win={win} />;
}
