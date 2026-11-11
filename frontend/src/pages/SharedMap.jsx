import { lazy, Suspense, useMemo } from 'react';
import { Navigate, useLocation, useParams, useSearchParams } from 'react-router-dom';
import { Clock, MapPin, Search } from 'lucide-react';
import { useShareData } from '../api/queries';
import { buildUnitColors } from '../lib/colors';
import { formatDateTime, plural } from '../lib/format';
import { clipTracks, trackWindow } from '../lib/parkingGroups';
import { prepareTracks } from '../lib/tracks';
import { useParkingFilters } from '../hooks/useParkingFilters';
import { useTrackSelection } from '../hooks/useTrackSelection';
import TracksPanel from '../components/parking/TracksPanel';
import GroupedParkingList from '../components/parking/GroupedParkingList';
import { DateRangeFilter, GroupPicker } from '../components/parking/SidebarControls';
import { SharedHeader, sharedMapNav } from '../components/ui/AppHeader';
import { ListSkeleton, MapSkeleton } from '../components/ui/Skeleton';
import MobileViewSwitch, { useMobileView } from '../components/ui/MobileViewSwitch';
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
  return <SharedMapView data={data} token={token} />;
}

function SharedMapView({ data, token }) {
  const [searchParams] = useSearchParams();
  const { search } = useLocation();
  const { parkings, tracks } = data;

  const unitColors = useMemo(() => buildUnitColors([...parkings, ...tracks]), [parkings, tracks]);
  // Igual que en el mapa privado: los recorridos empiezan desmarcados y sus paradas ocultas
  const trackSelection = useTrackSelection(tracks, parkings);
  const shownParkings = trackSelection.visibleParkings;
  const filters = useParkingFilters(shownParkings, unitColors, {
    groupBy: searchParams.get('groupBy'),
    from: searchParams.get('from'),
    to: searchParams.get('to'),
    open: searchParams.get('open'),
  });
  const { visibleParkings, filterKey, appliedFrom, appliedTo } = filters;

  // Igual que en el mapa privado: el día, la unidad o las fechas elegidas recortan la
  // ruta; con una sucursal abierta, solo las unidades que pasaron por ella.
  const mapTracks = useMemo(() => {
    const win = trackWindow({ groupBy: filters.groupBy, filterKey, appliedFrom, appliedTo });
    const units = new Set(visibleParkings.map((p) => p.unit_id));
    const shown = clipTracks(tracks, win)
      .filter((t) => trackSelection.isSelected(t.id))
      .filter((t) => filters.groupBy !== 'address' || filterKey === 'all' || units.has(t.unit_id));
    return prepareTracks(shown, unitColors, parkings, win);
  }, [tracks, parkings, visibleParkings, filters.groupBy, filterKey, appliedFrom, appliedTo, unitColors, trackSelection.isSelected]);
  // Recorridos del panel: los que caen en el día, la unidad o las fechas que se ven
  const panelTracks = useMemo(
    () => clipTracks(tracks, trackWindow({ groupBy: filters.groupBy, filterKey, appliedFrom, appliedTo })),
    [tracks, filters.groupBy, filterKey, appliedFrom, appliedTo],
  );
  const hiddenCount = parkings.length - shownParkings.length;
  const [mobileView, setMobileView] = useMobileView({
    hasMapContent: visibleParkings.length > 0 || mapTracks.length > 0,
    highlightId: filters.highlightId,
  });

  return (
    <div className="page">
      <SharedHeader nav={tracks.length > 0 ? sharedMapNav(token, search) : undefined}>
        <p className="header-note"><span className="note-optional">Solo lectura · </span>Expira {formatDateTime(data.expires_at)}</p>
      </SharedHeader>

      <div className="split" data-view={mobileView}>
        <aside className="sidebar" aria-label="Filtros y registros">
          <div className="sidebar-head">
            <div>
              <h1 className="sidebar-title">Mapa compartido</h1>
              <p className="small muted">
                {shownParkings.length} {plural(shownParkings.length, 'registro')}
                {hiddenCount > 0 && ` · ${hiddenCount} ${plural(hiddenCount, 'oculto')}`}
              </p>
            </div>
            {parkings.length > 0 && (
              <>
                <GroupPicker groupBy={filters.groupBy} locked />
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
          {tracks.length > 0 && (
            <TracksPanel
              tracks={panelTracks}
              view={trackWindow({ groupBy: filters.groupBy, filterKey, appliedFrom, appliedTo })}
              selectedCount={mapTracks.length}
              isSelected={trackSelection.isSelected}
              unitColors={unitColors}
              onToggle={trackSelection.toggle}
              onSetAll={(visible) => trackSelection.setMany(panelTracks.map((t) => t.id), visible)}
              stopsTo={sharedMapNav(token, search)[1].to}
            />
          )}
          {parkings.length === 0 ? (
            <EmptyState icon={MapPin} title="Sin registros" description="Este enlace no incluye estacionamientos." />
          ) : shownParkings.length === 0 ? (
            <EmptyState
              icon={MapPin}
              title="Elige un recorrido"
              description="Marca un recorrido arriba para ver sus paradas en el mapa y en la lista."
            />
          ) : (
            <GroupedParkingList
              filters={filters}
              unitColors={unitColors}
              totalCount={shownParkings.length}
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
              viewKey={`${filters.groupBy}|${filterKey}|${appliedFrom}|${appliedTo}`}
            />
          </Suspense>
        </main>
        <MobileViewSwitch view={mobileView} onChange={setMobileView} listCount={shownParkings.length} />
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
