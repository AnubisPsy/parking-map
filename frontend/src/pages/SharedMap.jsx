import { lazy, Suspense, useMemo } from 'react';
import { Navigate, useParams, useSearchParams } from 'react-router-dom';
import { Clock, MapPin, Search } from 'lucide-react';
import { useShareData } from '../api/queries';
import { buildUnitColors } from '../lib/colors';
import { formatDateTime, plural } from '../lib/format';
import { tracksInRange } from '../lib/parkingGroups';
import { prepareTracks } from '../lib/tracks';
import { useParkingFilters } from '../hooks/useParkingFilters';
import GroupedParkingList from '../components/parking/GroupedParkingList';
import { DateRangeFilter, GroupPicker } from '../components/parking/SidebarControls';
import { SharedHeader } from '../components/ui/AppHeader';
import { ListSkeleton, MapSkeleton } from '../components/ui/Skeleton';
import { EmptyState, ErrorState, FullPageMessage } from '../components/ui/States';

// El mapa es el contenido principal: se descarga a la vez que los datos, no después
const mapViewModule = import('../components/MapView');
const MapView = lazy(() => mapViewModule);

export default function SharedMap() {
  const { token } = useParams();
  const { data, error, isPending, refetch } = useShareData(token);

  if (isPending) return <SharedMapSkeleton />;

  if (error) {
    if (error.status === 410) {
      return <LinkMessage Icon={Clock} title="Enlace expirado" desc="Este enlace ya no es válido. Solicita uno nuevo." />;
    }
    if (error.status === 404) {
      return <LinkMessage Icon={Search} title="Enlace no encontrado" desc="El enlace no existe o fue eliminado." />;
    }
    return (
      <FullPageMessage>
        <h1 className="page-title">Mapa compartido</h1>
        <ErrorState title="Error al cargar el mapa" message={error.message} onRetry={refetch} />
      </FullPageMessage>
    );
  }

  if (data.type === 'report') return <Navigate to={`/report/${token}`} replace />;
  if (data.type === 'tracks') return <Navigate to={`/recorrido/${token}`} replace />;
  return <SharedMapView data={data} />;
}

function SharedMapView({ data }) {
  const [searchParams] = useSearchParams();
  const { parkings, tracks } = data;

  const unitColors = useMemo(() => buildUnitColors([...parkings, ...tracks]), [parkings, tracks]);
  const filters = useParkingFilters(parkings, unitColors, {
    groupBy: searchParams.get('groupBy'),
    from: searchParams.get('from'),
    to: searchParams.get('to'),
  });
  const { visibleParkings, filterKey, appliedFrom, appliedTo } = filters;

  // Recorridos dentro del rango de fechas y, si hay un grupo seleccionado, solo de sus unidades
  const mapTracks = useMemo(() => {
    const units = new Set(visibleParkings.map((p) => p.unit_id));
    const shown = tracksInRange(tracks, appliedFrom, appliedTo)
      .filter((t) => filterKey === 'all' || units.has(t.unit_id));
    return prepareTracks(shown, unitColors, parkings);
  }, [tracks, parkings, visibleParkings, filterKey, appliedFrom, appliedTo, unitColors]);

  return (
    <div className="page">
      <SharedHeader>
        <p className="header-note">Solo lectura · Expira {formatDateTime(data.expires_at)}</p>
      </SharedHeader>

      <div className="split">
        <aside className="sidebar" aria-label="Filtros y registros">
          <div className="sidebar-head">
            <div>
              <h1 className="sidebar-title">Mapa compartido</h1>
              <p className="small muted">{parkings.length} {plural(parkings.length, 'registro')}</p>
            </div>
            {parkings.length > 0 && (
              <>
                <GroupPicker groupBy={filters.groupBy} onChange={filters.changeGroupBy} />
                <DateRangeFilter
                  from={filters.dateFrom}
                  to={filters.dateTo}
                  onFromChange={filters.setDateFrom}
                  onToChange={filters.setDateTo}
                  resultCount={visibleParkings.length}
                />
              </>
            )}
          </div>
          {parkings.length === 0 ? (
            <EmptyState icon={MapPin} title="Sin registros" description="Este enlace no incluye estacionamientos." />
          ) : (
            <GroupedParkingList
              filters={filters}
              unitColors={unitColors}
              totalCount={parkings.length}
              visibleCount={visibleParkings.length}
            />
          )}
        </aside>

        <main className="map-area">
          <Suspense fallback={<MapSkeleton />}>
            <MapView
              parkings={visibleParkings}
              unitColors={unitColors}
              highlightId={filters.highlightId}
              onMarkerClick={filters.toggleHighlight}
              tracks={mapTracks}
            />
          </Suspense>
        </main>
      </div>
    </div>
  );
}

function SharedMapSkeleton() {
  return (
    <div className="page">
      <div className="app-header" />
      <div className="split">
        <div className="sidebar" style={{ padding: 12 }}><ListSkeleton /></div>
        <div className="map-area"><MapSkeleton /></div>
      </div>
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
