import { useMemo } from 'react';
import { Navigate, useParams, useSearchParams } from 'react-router-dom';
import { Clock, Download, Route, Search } from 'lucide-react';
import { useShareData } from '../api/queries';
import { buildUnitColors, NEUTRAL } from '../lib/colors';
import { formatDateTime, plural } from '../lib/format';
import { localDateKey } from '../lib/parkingGroups';
import { summarizeTrack } from '../lib/trackSummary';
import { downloadTracks, TrackDetail, TrackList } from '../components/tracks/TrackReport';
import { SharedHeader } from '../components/ui/AppHeader';
import { Skeleton } from '../components/ui/Skeleton';
import { EmptyState, ErrorState, FullPageMessage } from '../components/ui/States';

const ROUTES = { report: 'report', parking: 'map' };

export default function SharedTracks() {
  const { token } = useParams();
  const { data, error, isPending, refetch } = useShareData(token);

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
    if (error.status === 410) {
      return <LinkMessage Icon={Clock} title="Enlace expirado" desc="Este enlace ya no es válido. Solicita uno nuevo." />;
    }
    if (error.status === 404) {
      return <LinkMessage Icon={Search} title="Enlace no encontrado" desc="El enlace no existe o fue eliminado." />;
    }
    return (
      <FullPageMessage>
        <h1 className="page-title">Recorridos compartidos</h1>
        <ErrorState title="Error al cargar los recorridos" message={error.message} onRetry={refetch} />
      </FullPageMessage>
    );
  }

  if (data.type !== 'tracks') return <Navigate to={`/${ROUTES[data.type]}/${token}`} replace />;
  return <SharedTracksView data={data} />;
}

function SharedTracksView({ data }) {
  const { tracks, parkings } = data;
  const [searchParams, setSearchParams] = useSearchParams();
  const unitColors = useMemo(() => buildUnitColors([...parkings, ...tracks]), [parkings, tracks]);
  const summaries = useMemo(
    () => tracks.map((t) => summarizeTrack(t, parkings)).sort((a, b) => b.start - a.start),
    [tracks, parkings],
  );
  const selected = summaries.find((s) => s.id === searchParams.get('track')) ?? summaries[0];
  const select = (id) => setSearchParams({ track: id }, { replace: true });
  const single = summaries.length === 1;

  return (
    <div className="page">
      <SharedHeader>
        <p className="header-note">Solo lectura · Expira {formatDateTime(data.expires_at)}</p>
      </SharedHeader>

      <section className="page-head" aria-label="Encabezado de la página">
        <div>
          <h1 className="page-title">Reporte de recorridos</h1>
          <p className="page-subtitle">
            {summaries.length} {plural(summaries.length, 'recorrido')}: dónde se detuvo cada unidad, a qué hora y cuánto tiempo.
          </p>
        </div>
        {!single && summaries.length > 0 && (
          <button className="btn btn-primary" onClick={() => downloadTracks(summaries, `recorridos-${localDateKey(new Date())}.xlsx`)}>
            <Download size={15} /> Exportar a Excel
          </button>
        )}
      </section>

      <main className="scroll-body" tabIndex={0}>
        <div className="content" style={{ maxWidth: 1240 }}>
          {!selected ? (
            <EmptyState icon={Route} title="Sin recorridos" description="Este enlace no incluye recorridos." style={{ padding: '60px 20px' }} />
          ) : single ? (
            <TrackDetail summary={selected} color={unitColors[selected.unitId] || NEUTRAL} />
          ) : (
            <div className="tracks-layout">
              <TrackList summaries={summaries} selectedId={selected.id} unitColors={unitColors} onSelect={select} />
              <TrackDetail summary={selected} color={unitColors[selected.unitId] || NEUTRAL} />
            </div>
          )}
        </div>
      </main>
    </div>
  );
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
