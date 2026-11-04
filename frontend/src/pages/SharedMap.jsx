import { lazy, Suspense, useMemo } from 'react';
import { Navigate, useParams, useSearchParams } from 'react-router-dom';
import { Clock, Map as MapIcon, MapPin, Search } from 'lucide-react';
import { useShareData } from '../api/queries';
import { buildUnitColors } from '../lib/colors';
import { formatDateTime, plural } from '../lib/format';
import { tracksInRange } from '../lib/parkingGroups';
import { prepareTracks } from '../lib/tracks';
import { useParkingFilters } from '../hooks/useParkingFilters';
import GroupedParkingList from '../components/parking/GroupedParkingList';
import { DateRangeFilter, GroupPicker } from '../components/parking/SidebarControls';
import { ListSkeleton, MapSkeleton, Skeleton } from '../components/ui/Skeleton';
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
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>Mapa compartido</h1>
        <ErrorState title="Error al cargar el mapa" message={error.message} onRetry={refetch} style={{ maxWidth: 420 }} />
      </FullPageMessage>
    );
  }

  if (data.type === 'report') return <Navigate to={`/report/${token}`} replace />;
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
      <header className="app-header app-header-blue">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <MapIcon size={24} color="white" />
          <div>
            <h1 style={{ fontSize: 17, fontWeight: 800, color: 'white' }}>Mapa Compartido</h1>
            <p style={{ fontSize: 12, color: '#eff6ff' }}>
              {parkings.length} {plural(parkings.length, 'registro')} · Expira: {formatDateTime(data.expires_at)}
            </p>
          </div>
        </div>
        <p style={{ fontSize: 12, color: 'white', background: 'rgba(255,255,255,0.1)', padding: '6px 12px', borderRadius: 8 }}>
          Vista de solo lectura
        </p>
      </header>

      <div className="split">
        <aside className="sidebar" style={{ width: 320 }} aria-label="Filtros y registros">
          <GroupPicker groupBy={filters.groupBy} onChange={filters.changeGroupBy} />
          {parkings.length === 0 ? (
            <EmptyState icon={MapPin} title="Sin registros" description="Este enlace no incluye estacionamientos." />
          ) : (
            <>
              <DateRangeFilter
                from={filters.dateFrom}
                to={filters.dateTo}
                onFromChange={filters.setDateFrom}
                onToChange={filters.setDateTo}
                resultCount={visibleParkings.length}
              />
              <GroupedParkingList
                filters={filters}
                unitColors={unitColors}
                totalCount={parkings.length}
                visibleCount={visibleParkings.length}
              />
            </>
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
      <div className="app-header app-header-blue" style={{ height: 60 }}>
        <Skeleton width={180} height={20} style={{ opacity: 0.4 }} />
      </div>
      <div className="split">
        <div className="sidebar" style={{ width: 320, padding: 12 }}><ListSkeleton /></div>
        <div className="map-area"><MapSkeleton /></div>
      </div>
    </div>
  );
}

function LinkMessage({ Icon, title, desc }) {
  return (
    <FullPageMessage>
      <Icon size={56} color="#64748b" />
      <h1 style={{ fontSize: 22, fontWeight: 700 }}>{title}</h1>
      <p style={{ color: '#475569', fontSize: 15 }}>{desc}</p>
    </FullPageMessage>
  );
}
