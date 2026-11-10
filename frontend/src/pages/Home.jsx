import { lazy, Suspense, useMemo, useState } from 'react';
import {
  FileSpreadsheet, Link2, List, MapPin, MoreHorizontal, PencilLine, Plus, Route, Share2, Trash2,
} from 'lucide-react';
import {
  useApplyImportedTracks,
  useDeleteAllParkings,
  useDeleteParking,
  useDeleteParkingsByUnit,
  useDeleteTrack,
  useParkings,
  useTracks,
} from '../api/queries';
import { buildUnitColors } from '../lib/colors';
import { plural } from '../lib/format';
import { buildGroups, clipTracks, trackWindow } from '../lib/parkingGroups';
import { prepareTracks } from '../lib/tracks';
import { useParkingFilters } from '../hooks/useParkingFilters';
import { useConfirm } from '../components/ConfirmModal';
import GroupedParkingList from '../components/parking/GroupedParkingList';
import { DateRangeFilter, GroupPicker } from '../components/parking/SidebarControls';
import TracksPanel from '../components/parking/TracksPanel';
import AppHeader from '../components/ui/AppHeader';
import Menu from '../components/ui/Menu';
import { ListSkeleton, MapSkeleton } from '../components/ui/Skeleton';
import { EmptyState, ErrorState } from '../components/ui/States';

// El mapa es el contenido principal: se descarga a la vez que los datos, no después
const mapViewModule = import('../components/MapView');
const MapView = lazy(() => mapViewModule);
const ParkingForm = lazy(() => import('../components/ParkingForm'));
const ShareLinkModal = lazy(() => import('../components/ShareLinkModal'));
const ImportModal = lazy(() => import('../components/ImportModal'));
const TrackImportModal = lazy(() => import('../components/TrackImportModal'));
const SharesListModal = lazy(() => import('../components/SharesListModal'));

const NO_PARKINGS = [];
const NO_TRACKS = [];

export default function Home() {
  const parkingsQuery = useParkings();
  const tracksQuery = useTracks();
  const parkings = parkingsQuery.data ?? NO_PARKINGS;
  const tracks = tracksQuery.data ?? NO_TRACKS;
  const loading = parkingsQuery.isPending || tracksQuery.isPending;
  const failed = parkingsQuery.error || tracksQuery.error;

  const deleteParking = useDeleteParking();
  const deleteByUnit = useDeleteParkingsByUnit();
  const deleteAll = useDeleteAllParkings();
  const deleteTrack = useDeleteTrack();
  const applyImportedTracks = useApplyImportedTracks();
  const { confirm, dialog } = useConfirm();

  const [modal, setModal] = useState(null);
  const closeModal = () => setModal(null);

  // Se guardan los desmarcados: un recorrido recién importado aparece seleccionado
  const [hiddenTrackIds, setHiddenTrackIds] = useState(() => new Set());

  // Las unidades que solo tienen recorrido (sin estacionamientos) también reciben color
  const unitColors = useMemo(() => buildUnitColors([...parkings, ...tracks]), [parkings, tracks]);
  const filters = useParkingFilters(parkings, unitColors);
  const { groupBy, groups, visibleParkings, groupFiltered, highlightId, setHighlightId } = filters;

  // Abrir un día o una unidad en la lista, o elegir fechas, recorta la ruta y el reproductor
  const trackWin = useMemo(
    () => trackWindow({ groupBy, filterKey: filters.filterKey, appliedFrom: filters.appliedFrom, appliedTo: filters.appliedTo }),
    [groupBy, filters.filterKey, filters.appliedFrom, filters.appliedTo],
  );
  const rangeTracks = useMemo(() => clipTracks(tracks, trackWin), [tracks, trackWin]);
  const mapTracks = useMemo(
    () => prepareTracks(rangeTracks.filter((t) => !hiddenTrackIds.has(t.id)), unitColors, parkings, trackWin),
    [rangeTracks, hiddenTrackIds, unitColors, parkings, trackWin],
  );

  function toggleTrack(id) {
    setHiddenTrackIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function setAllTracks(visible) {
    setHiddenTrackIds((prev) => {
      const next = new Set(prev);
      rangeTracks.forEach((t) => (visible ? next.delete(t.id) : next.add(t.id)));
      return next;
    });
  }

  async function handleDeleteTrack(track) {
    const ok = await confirm({
      title: `¿Eliminar el recorrido de ${track.unit_id}?`,
      message: 'Se eliminará el recorrido y los estacionamientos que se importaron con él. Esta acción no se puede deshacer.',
    });
    if (!ok) return;
    const highlighted = parkings.find((p) => p.id === highlightId);
    if (highlighted?.track_id === track.id) setHighlightId(null);
    deleteTrack.mutate(track.id);
  }

  async function handleDeleteGroup(group) {
    const ok = await confirm({
      title: `¿Eliminar "${group.label}"?`,
      message: `Se eliminarán los ${group.count} ${plural(group.count, 'registro')}. Esta acción no se puede deshacer.`,
    });
    if (!ok) return;
    filters.resetSelection();
    deleteByUnit.mutate(group.unitId);
  }

  async function handleDeleteAll() {
    const ok = await confirm({
      title: '¿Eliminar todos los registros?',
      message: `Se eliminarán los ${parkings.length} ${plural(parkings.length, 'registro')} de todas las unidades. Esta acción no se puede deshacer.`,
    });
    if (!ok) return;
    filters.resetSelection();
    deleteAll.mutate();
  }

  async function handleDeleteOne(id) {
    const ok = await confirm({
      title: '¿Eliminar este registro?',
      message: 'Esta acción no se puede deshacer.',
    });
    if (!ok) return;
    if (highlightId === id) setHighlightId(null);
    deleteParking.mutate(id);
  }

  function retry() {
    if (parkingsQuery.isError) parkingsQuery.refetch();
    if (tracksQuery.isError) tracksQuery.refetch();
  }

  const showControls = !loading && !failed && parkings.length > 0;

  return (
    <div className="page">
      <AppHeader>
        <Menu
          label="Compartir"
          icon={Share2}
          hideLabelOnSmall
          items={[
            {
              label: 'Crear enlace del mapa',
              description: 'Vista de solo lectura para otras personas',
              icon: Link2,
              disabled: parkings.length === 0,
              onSelect: () => setModal('share'),
            },
            { label: 'Mis enlaces', description: 'Ver, copiar o revocar', icon: List, onSelect: () => setModal('shares') },
          ]}
        />
        <Menu
          label="Agregar"
          icon={Plus}
          hideLabelOnSmall
          buttonClass="btn btn-primary"
          items={[
            { label: 'Importar estacionamientos', description: 'Desde un Excel del GPS', icon: FileSpreadsheet, onSelect: () => setModal('import') },
            { label: 'Importar rastreo GPS', description: 'Recorridos con sus paradas', icon: Route, onSelect: () => setModal('tracks') },
            { label: 'Nuevo registro', description: 'Agregar uno manualmente', icon: PencilLine, onSelect: () => setModal('form') },
          ]}
        />
      </AppHeader>

      <div className="split">
        <aside className="sidebar" aria-label="Filtros y registros">
          <div className="sidebar-head">
            <div className="row-between">
              <div>
                <h1 className="sidebar-title">Estacionamientos</h1>
                <p className="small muted">
                  {parkings.length} {plural(parkings.length, 'registro')} · {groups.length} {plural(groups.length, 'grupo')}
                </p>
              </div>
              {parkings.length > 0 && (
                <Menu
                  label="Más opciones"
                  icon={MoreHorizontal}
                  iconOnly
                  buttonClass="icon-btn"
                  items={[{ label: 'Borrar todos los registros', icon: Trash2, danger: true, onSelect: handleDeleteAll }]}
                />
              )}
            </div>
            {showControls && (
              <>
                <GroupPicker groupBy={groupBy} onChange={filters.changeGroupBy} />
                {groupFiltered.length > 0 && (
                  <DateRangeFilter
                    from={filters.dateFrom}
                    to={filters.dateTo}
                    onFromChange={filters.setDateFrom}
                    onToChange={filters.setDateTo}
                    resultCount={visibleParkings.length}
                  />
                )}
              </>
            )}
          </div>

          {tracks.length > 0 && (
            <TracksPanel
              tracks={rangeTracks}
              view={trackWin}
              onGroupByDate={groupBy === 'date' || groupBy === 'date_unit' ? null : () => filters.changeGroupBy('date')}
              selectedCount={mapTracks.length}
              isSelected={(id) => !hiddenTrackIds.has(id)}
              unitColors={unitColors}
              onToggle={toggleTrack}
              onSetAll={setAllTracks}
              onDelete={handleDeleteTrack}
            />
          )}

          {loading && <div style={{ padding: 12 }}><ListSkeleton /></div>}
          {!loading && failed && <ErrorState message={failed.message} onRetry={retry} />}
          {!loading && !failed && parkings.length === 0 && (
            <EmptyState
              icon={MapPin}
              title="Aún no hay registros"
              description="Importa un Excel del sistema GPS para verlos en el mapa."
              action={(
                <>
                  <button onClick={() => setModal('import')} className="btn btn-primary">
                    <FileSpreadsheet size={15} /> Importar Excel
                  </button>
                  <button onClick={() => setModal('form')} className="btn btn-secondary">Agregar manualmente</button>
                </>
              )}
            />
          )}
          {!loading && parkings.length > 0 && (
            <GroupedParkingList
              filters={filters}
              unitColors={unitColors}
              totalCount={parkings.length}
              visibleCount={visibleParkings.length}
              onDeleteGroup={handleDeleteGroup}
              onDeleteItem={handleDeleteOne}
            />
          )}
        </aside>

        <main className="map-area">
          {loading ? <MapSkeleton /> : (
            <Suspense fallback={<MapSkeleton />}>
              <MapView
                parkings={visibleParkings}
                unitColors={unitColors}
                highlightId={highlightId}
                onMarkerClick={filters.toggleHighlight}
                tracks={mapTracks}
                viewKey={`${groupBy}|${filters.filterKey}|${filters.appliedFrom}|${filters.appliedTo}`}
              />
            </Suspense>
          )}
        </main>
      </div>

      <Suspense fallback={null}>
        {modal === 'form' && (
          <ParkingForm onCreated={(p) => setHighlightId(p.id)} onClose={closeModal} />
        )}
        {modal === 'share' && (
          <ShareLinkModal
            units={buildGroups(parkings, 'unit', unitColors).map((g) => ({ id: g.unitId, name: g.label, count: g.count }))}
            dateFrom={filters.dateFrom}
            dateTo={filters.dateTo}
            groupBy={groupBy}
            onClose={closeModal}
          />
        )}
        {modal === 'import' && (
          <ImportModal onImported={(created) => setHighlightId(created[0]?.id ?? null)} onClose={closeModal} />
        )}
        {modal === 'tracks' && (
          <TrackImportModal onImported={applyImportedTracks} onClose={closeModal} />
        )}
        {modal === 'shares' && <SharesListModal onClose={closeModal} />}
      </Suspense>
      {dialog}
    </div>
  );
}
