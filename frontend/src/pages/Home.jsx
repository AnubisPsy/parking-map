import { lazy, Suspense, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BarChart2, Link2, List, MapPin, ParkingSquare, Plus, Route, Trash2, Upload,
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
import { formatDateTime, formatDuration, plural } from '../lib/format';
import { buildGroups, tracksInRange } from '../lib/parkingGroups';
import { prepareTracks } from '../lib/tracks';
import { useParkingFilters } from '../hooks/useParkingFilters';
import { useConfirm } from '../components/ConfirmModal';
import GroupedParkingList from '../components/parking/GroupedParkingList';
import { DateRangeFilter, GroupPicker } from '../components/parking/SidebarControls';
import TracksPanel from '../components/parking/TracksPanel';
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
  const [tooltip, setTooltip] = useState(null);

  // Las unidades que solo tienen recorrido (sin estacionamientos) también reciben color
  const unitColors = useMemo(() => buildUnitColors([...parkings, ...tracks]), [parkings, tracks]);
  const filters = useParkingFilters(parkings, unitColors);
  const { groupBy, groups, visibleParkings, groupFiltered, highlightId, setHighlightId } = filters;

  const rangeTracks = useMemo(
    () => tracksInRange(tracks, filters.appliedFrom, filters.appliedTo),
    [tracks, filters.appliedFrom, filters.appliedTo],
  );
  const mapTracks = useMemo(
    () => prepareTracks(rangeTracks.filter((t) => !hiddenTrackIds.has(t.id)), unitColors, parkings),
    [rangeTracks, hiddenTrackIds, unitColors, parkings],
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

  function openTooltip(e, parking, color) {
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltip({
      parking,
      color,
      left: Math.max(8, Math.min(rect.right + 12, window.innerWidth - TOOLTIP_WIDTH - 8)),
      top: Math.max(8, Math.min(rect.top, window.innerHeight - 280)),
    });
  }

  function retry() {
    if (parkingsQuery.isError) parkingsQuery.refetch();
    if (tracksQuery.isError) tracksQuery.refetch();
  }

  return (
    <div className="page">
      <header className="app-header app-header-blue">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <ParkingSquare size={26} color="white" />
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 800, color: 'white' }}>Parking Map</h1>
            <p style={{ fontSize: 12, color: '#eff6ff' }}>
              {parkings.length} {plural(parkings.length, 'registro')} · {groups.length} {plural(groups.length, 'grupo')}
            </p>
          </div>
        </div>
        <nav className="header-actions" aria-label="Acciones principales">
          <button onClick={() => setModal('share')} style={btnOutline} disabled={parkings.length === 0}>
            <Link2 size={14} /> Compartir mapa
          </button>
          <button onClick={() => setModal('shares')} style={btnOutline}>
            <List size={14} /> Mis enlaces
          </button>
          <Link to="/reports" style={btnOutline}>
            <BarChart2 size={14} /> Reportes
          </Link>
          <button onClick={() => setModal('import')} style={btnOutline}>
            <Upload size={14} /> Importar
          </button>
          <button onClick={() => setModal('tracks')} style={btnOutline}>
            <Route size={14} /> Importar rastreo
          </button>
          <button onClick={() => setModal('form')} style={btnWhite}>
            <Plus size={14} /> Nuevo registro
          </button>
        </nav>
      </header>

      <div className="split">
        <aside className="sidebar" aria-label="Filtros y registros">
          <GroupPicker
            groupBy={groupBy}
            onChange={filters.changeGroupBy}
            action={parkings.length > 0 && (
              <button onClick={handleDeleteAll} style={deleteAllBtn}>
                <Trash2 size={11} /> Borrar todo
              </button>
            )}
          />

          {groupFiltered.length > 0 && (
            <DateRangeFilter
              from={filters.dateFrom}
              to={filters.dateTo}
              onFromChange={filters.setDateFrom}
              onToChange={filters.setDateTo}
              resultCount={visibleParkings.length}
            />
          )}

          {tracks.length > 0 && (
            <TracksPanel
              tracks={rangeTracks}
              selectedCount={mapTracks.length}
              isSelected={(id) => !hiddenTrackIds.has(id)}
              unitColors={unitColors}
              onToggle={toggleTrack}
              onSetAll={setAllTracks}
              onDelete={handleDeleteTrack}
            />
          )}

          {loading && <div style={{ padding: 12 }}><ListSkeleton /></div>}
          {!loading && failed && (
            <div style={{ padding: 12 }}><ErrorState message={failed.message} onRetry={retry} /></div>
          )}
          {!loading && !failed && parkings.length === 0 && (
            <EmptyState
              icon={MapPin}
              title="Sin registros aún"
              description="Agrega el primer registro con el botón de arriba"
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
              onInfoOpen={openTooltip}
              onInfoClose={() => setTooltip(null)}
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

      {tooltip && <ParkingTooltip {...tooltip} />}
    </div>
  );
}

const TOOLTIP_WIDTH = 262;

function ParkingTooltip({ parking: p, color, left, top }) {
  return (
    <div role="tooltip" style={{ ...tooltipStyle, left, top }}>
      <div style={{ background: color, color: 'white', padding: '10px 14px', fontWeight: 700, fontSize: 14 }}>
        {p.unit_name || p.unit_id}
      </div>
      <div style={{ background: 'white', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        <TooltipRow label="ID Unidad" value={p.unit_id} />
        <TooltipRow label="Tiempo estacionado" value={formatDuration(p.parking_duration) ?? '—'} />
        <TooltipRow label="Inicio" value={formatDateTime(p.parking_start)} />
        <TooltipRow label="Coordenadas" value={`${p.latitude.toFixed(6)}, ${p.longitude.toFixed(6)}`} />
        {p.address && <TooltipRow label="Dirección" value={p.address} />}
        {p.notes && <TooltipRow label="Notas" value={p.notes} />}
        <div style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>
          Registrado: {formatDateTime(p.created_at)}
        </div>
      </div>
    </div>
  );
}

function TooltipRow({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 12 }}>
      <span style={{ color: '#475569', flexShrink: 0 }}>{label}</span>
      <span style={{ fontWeight: 500, textAlign: 'right', wordBreak: 'break-all' }}>{value}</span>
    </div>
  );
}

const tooltipStyle = {
  position: 'fixed', width: TOOLTIP_WIDTH, zIndex: 2500, pointerEvents: 'none',
  borderRadius: 12, overflow: 'hidden',
  boxShadow: '0 8px 32px rgba(0,0,0,0.22)', border: '1px solid rgba(0,0,0,0.07)',
};
const btnBase = {
  display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8,
  fontSize: 13, cursor: 'pointer', textDecoration: 'none', whiteSpace: 'nowrap',
};
const btnWhite = { ...btnBase, background: 'white', color: '#1d4ed8', border: 'none', fontWeight: 700 };
const btnOutline = { ...btnBase, background: 'transparent', color: 'white', border: '1px solid rgba(255,255,255,0.6)', fontWeight: 600 };
const deleteAllBtn = {
  background: 'transparent', border: '1px solid #cbd5e1', borderRadius: 6, cursor: 'pointer',
  color: '#475569', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, padding: '3px 8px',
};
