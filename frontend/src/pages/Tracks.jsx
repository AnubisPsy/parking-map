import { lazy, Suspense, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Download, Route, Share2 } from 'lucide-react';
import { useApplyImportedTracks, useParkings, useTracks } from '../api/queries';
import { buildUnitColors, NEUTRAL } from '../lib/colors';
import { plural } from '../lib/format';
import { localDateKey, tracksInRange } from '../lib/parkingGroups';
import { summarizeTrack } from '../lib/trackSummary';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import AppHeader from '../components/ui/AppHeader';
import { downloadTracks, TrackDetail, TrackList } from '../components/tracks/TrackReport';
import { Skeleton } from '../components/ui/Skeleton';
import { EmptyState, ErrorState } from '../components/ui/States';

const TrackImportModal = lazy(() => import('../components/TrackImportModal'));
const TracksShareModal = lazy(() => import('../components/tracks/TracksShareModal'));

const NO_ITEMS = [];

export default function Tracks() {
  const tracksQuery = useTracks();
  const parkingsQuery = useParkings();
  const applyImportedTracks = useApplyImportedTracks();
  const tracks = tracksQuery.data ?? NO_ITEMS;
  const parkings = parkingsQuery.data ?? NO_ITEMS;
  const loading = tracksQuery.isPending || parkingsQuery.isPending;
  const failed = tracksQuery.error || parkingsQuery.error;

  const [searchParams, setSearchParams] = useSearchParams();
  const [unit, setUnit] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showImport, setShowImport] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const appliedFrom = useDebouncedValue(dateFrom);
  const appliedTo = useDebouncedValue(dateTo);

  const unitColors = useMemo(() => buildUnitColors([...parkings, ...tracks]), [parkings, tracks]);
  const units = useMemo(() => [...new Set(tracks.map((t) => t.unit_id))].sort(), [tracks]);

  const summaries = useMemo(
    () => tracksInRange(tracks, appliedFrom, appliedTo)
      .filter((t) => !unit || t.unit_id === unit)
      .map((t) => summarizeTrack(t, parkings)),
    [tracks, parkings, unit, appliedFrom, appliedTo],
  );

  const selected = summaries.find((s) => s.id === searchParams.get('track')) ?? summaries[0];
  const select = (id) => setSearchParams({ track: id }, { replace: true });

  function retry() {
    if (tracksQuery.isError) tracksQuery.refetch();
    if (parkingsQuery.isError) parkingsQuery.refetch();
  }

  return (
    <div className="page">
      <AppHeader />

      <section className="page-head" aria-label="Encabezado de la página">
        <div>
          <h1 className="page-title">Recorridos</h1>
          <p className="page-subtitle">Paradas de cada recorrido GPS: dónde, a qué hora y cuánto tiempo.</p>
        </div>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <button className="btn btn-secondary" disabled={summaries.length === 0} onClick={() => setShowShare(true)}>
            <Share2 size={15} /> Compartir
          </button>
          <button
            className="btn btn-primary"
            disabled={summaries.length === 0}
            onClick={() => downloadTracks(summaries, `recorridos-${localDateKey(new Date())}.xlsx`)}
          >
            <Download size={15} /> Exportar a Excel
          </button>
        </div>
      </section>

      <main className="scroll-body" tabIndex={0}>
        <div className="content" style={{ maxWidth: 1240 }}>
          {loading && (
            <div role="status" aria-label="Cargando recorridos" className="tracks-layout">
              <Skeleton height={320} radius={12} />
              <Skeleton height={420} radius={12} />
            </div>
          )}

          {!loading && failed && <ErrorState message={failed.message} onRetry={retry} />}

          {!loading && !failed && tracks.length === 0 && (
            <EmptyState
              icon={Route}
              title="Aún no hay recorridos"
              description="Importa un archivo de rastreo GPS para ver sus paradas."
              style={{ padding: '60px 20px' }}
              action={(
                <button onClick={() => setShowImport(true)} className="btn btn-primary">
                  <Route size={15} /> Importar rastreo GPS
                </button>
              )}
            />
          )}

          {!loading && !failed && tracks.length > 0 && (
            <>
              <div className="card filter-bar">
                <select value={unit} onChange={(e) => setUnit(e.target.value)} className="input input-sm" aria-label="Filtrar por unidad">
                  <option value="">Todas las unidades</option>
                  {units.map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
                <label>
                  Desde
                  <input type="date" value={dateFrom} max={dateTo || undefined} onChange={(e) => setDateFrom(e.target.value)} className="input input-sm" />
                </label>
                <label>
                  Hasta
                  <input type="date" value={dateTo} min={dateFrom || undefined} onChange={(e) => setDateTo(e.target.value)} className="input input-sm" />
                </label>
                <span role="status" className="small muted" style={{ marginLeft: 'auto' }}>
                  {summaries.length} {plural(summaries.length, 'recorrido')}
                </span>
              </div>

              {summaries.length === 0 ? (
                <div className="card"><EmptyState title="No hay resultados" description="Prueba con otra unidad o fechas." /></div>
              ) : (
                <div className="tracks-layout">
                  <TrackList summaries={summaries} selectedId={selected.id} unitColors={unitColors} onSelect={select} />
                  <TrackDetail summary={selected} color={unitColors[selected.unitId] || NEUTRAL} />
                </div>
              )}
            </>
          )}
        </div>
      </main>

      {showImport && (
        <Suspense fallback={null}>
          <TrackImportModal onImported={applyImportedTracks} onClose={() => setShowImport(false)} />
        </Suspense>
      )}
      {showShare && selected && (
        <Suspense fallback={null}>
          <TracksShareModal selected={selected} summaries={summaries} onClose={() => setShowShare(false)} />
        </Suspense>
      )}
    </div>
  );
}

