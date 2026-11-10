import { useId, useMemo, useState } from 'react';
import { Download, ExternalLink, MapPin } from 'lucide-react';
import { exportTracksToExcel } from '../../lib/exportTracks';
import { plural } from '../../lib/format';
import { localDateKey } from '../../lib/parkingGroups';
import {
  formatClock, formatDate, formatKm, formatMinutes, googleMapsUrl,
} from '../../lib/trackSummary';
import { showToast } from '../../lib/toast';
import { StatTile } from '../report/parts';
import LocationPreview from '../LocationPreview';
import { EmptyState } from '../ui/States';

// Lista, resumen y tabla de paradas: los usa la página privada y la compartida

export async function downloadTracks(summaries, fileName) {
  try {
    await exportTracksToExcel(summaries, fileName);
  } catch (err) {
    showToast(`No se pudo generar el Excel: ${err.message}`);
  }
}

export function TrackList({ summaries, selectedId, unitColors, onSelect }) {
  return (
    <nav className="card track-picker" aria-label="Recorridos">
      <ul>
        {summaries.map((s) => {
          const current = s.id === selectedId;
          return (
            <li key={s.id}>
              <button className={`track-option${current ? ' track-option-selected' : ''}`} aria-current={current ? 'true' : undefined} onClick={() => onSelect(s.id)}>
                <span className="row" style={{ gap: 8 }}>
                  <span className="dot dot-sm" style={{ background: unitColors[s.unitId] || NEUTRAL }} />
                  <span style={{ fontWeight: 600 }}>{s.unitId}</span>
                  {s.unitName && <span className="muted truncate">· {s.unitName}</span>}
                </span>
                <span className="small muted" style={{ display: 'block', paddingLeft: 16 }}>
                  {formatDate(s.start)} · {formatClock(s.start)} → {formatClock(s.end)}
                </span>
                <span className="small muted" style={{ display: 'block', paddingLeft: 16 }}>
                  {s.stops.length} {plural(s.stops.length, 'parada')} · {formatKm(s.distanceKm)}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function TrackDetail({ summary: s, color }) {
  const fileName = `recorrido-${s.unitId}-${localDateKey(s.start)}.xlsx`;
  return (
    <section className="stack" style={{ gap: 12, minWidth: 0 }} aria-label={`Recorrido de ${s.unitId}`}>
      <div className="row-between" style={{ flexWrap: 'wrap' }}>
        <div className="row" style={{ gap: 10 }}>
          <span className="dot" style={{ background: color }} />
          <div>
            <h2 style={{ fontSize: 16 }}>{s.unitId}{s.unitName && <span className="muted" style={{ fontWeight: 400 }}> · {s.unitName}</span>}</h2>
            <p className="small muted">{formatDate(s.start)} · de {formatClock(s.start)} a {formatClock(s.end)}{s.address && ` · ${s.address}`}</p>
          </div>
        </div>
        <button className="btn btn-secondary" onClick={() => downloadTracks([s], fileName)}>
          <Download size={15} /> Exportar este recorrido
        </button>
      </div>

      <div className="grid-auto" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 140px), 1fr))' }}>
        <StatTile label="Duración" value={formatMinutes(s.totalMinutes)} />
        <StatTile label="Distancia" value={formatKm(s.distanceKm)} />
        <StatTile label="Paradas" value={s.stops.length} />
        <StatTile label="Tiempo detenido" value={formatMinutes(s.parkedMinutes)} />
        <StatTile label="En movimiento" value={formatMinutes(s.movingMinutes)} />
      </div>

      {s.stops.length === 0
        ? <div className="card"><EmptyState icon={MapPin} title="Sin paradas" description="Este recorrido no trae la hoja de estacionamientos." /></div>
        : <StopsTable summary={s} />}
    </section>
  );
}

const DAY_MS = 86400000;

// Días entre dos fechas del calendario local (la salida puede ser días después de la llegada)
const daysBetween = (a, b) =>
  Math.round((new Date(localDateKey(b) + 'T12:00:00') - new Date(localDateKey(a) + 'T12:00:00')) / DAY_MS);

// Franja de cada parada: cambia con cada fecha y alterna azul / blanco, empezando en azul
function dayBands(stops) {
  let band = -1;
  let lastDay = null;
  return stops.map((stop) => {
    const day = localDateKey(stop.arrival);
    if (day !== lastDay) { band++; lastDay = day; }
    return band % 2 === 0;
  });
}

function StopsTable({ summary: s }) {
  const [preview, setPreview] = useState(null);
  const tooltipId = useId();
  const tinted = useMemo(() => dayBands(s.stops), [s.stops]);

  function open(stop, element) {
    const rect = element.getBoundingClientRect();
    const width = 296;
    const height = 222;
    const left = Math.min(Math.max(8, rect.left + rect.width / 2 - width / 2), window.innerWidth - width - 8);
    const above = rect.top - height - 8;
    setPreview({ stop, left, top: above >= 8 ? above : rect.bottom + 8 });
  }
  const close = () => setPreview(null);

  return (
    <div className="table-frame" style={{ overflowX: 'auto' }}>
      <table className="simple-table stops-table">
        <caption className="sr-only">Paradas del recorrido de {s.unitId}</caption>
        <thead>
          <tr>
            <th scope="col">#</th>
            <th scope="col">Fecha</th>
            <th scope="col">Llegada</th>
            <th scope="col">Salida</th>
            <th scope="col">Tiempo detenido</th>
            <th scope="col">Traslado previo</th>
            <th scope="col">Sucursal</th>
            <th scope="col">Ubicación</th>
          </tr>
        </thead>
        <tbody>
          {s.stops.map((stop, i) => {
            const laterDays = daysBetween(stop.arrival, stop.departure);
            return (
            <tr key={stop.id} className={tinted[i] ? 'stop-day-tinted' : undefined}>
              <td className="muted" data-label="Parada">{stop.index}</td>
              <td data-label="Fecha">{formatDate(stop.arrival)}</td>
              <td data-label="Llegada">{formatClock(stop.arrival)}</td>
              <td data-label="Salida">
                {formatClock(stop.departure)}
                {laterDays > 0 && (
                  <span className="next-day" title={`Sale el ${formatDate(stop.departure)}`}>
                    {' '}+{laterDays} d<span className="sr-only"> (el {formatDate(stop.departure)})</span>
                  </span>
                )}
              </td>
              <td data-label="Tiempo detenido"><strong>{formatMinutes(stop.minutes)}</strong></td>
              <td className="muted" data-label="Traslado previo">{formatMinutes(stop.travelMinutes)}</td>
              <td data-label="Sucursal">{stop.address || '—'}</td>
              <td data-label="Ubicación">
                <span className="row" style={{ gap: 2 }}>
                  <button
                    className="location-btn"
                    aria-describedby={preview?.stop.id === stop.id ? tooltipId : undefined}
                    onMouseEnter={(e) => open(stop, e.currentTarget)}
                    onMouseLeave={close}
                    onFocus={(e) => open(stop, e.currentTarget)}
                    onBlur={close}
                    // Un toque en pantalla táctil dispara hover, foco y clic juntos: el clic solo abre
                    onClick={(e) => open(stop, e.currentTarget)}
                    onKeyDown={(e) => { if (e.key === 'Escape') close(); }}
                  >
                    <MapPin size={13} />
                    {stop.latitude.toFixed(5)}, {stop.longitude.toFixed(5)}
                  </button>
                  <a
                    href={googleMapsUrl(stop.latitude, stop.longitude)}
                    target="_blank"
                    rel="noreferrer"
                    className="icon-btn"
                    aria-label={`Abrir la parada ${stop.index} en Google Maps`}
                    title="Abrir en Google Maps"
                  >
                    <ExternalLink size={14} />
                  </a>
                </span>
              </td>
            </tr>
            );
          })}
        </tbody>
      </table>

      {preview && (
        <div id={tooltipId} role="tooltip" className="map-control preview-card" style={{ left: preview.left, top: preview.top }}>
          <LocationPreview
            latitude={preview.stop.latitude}
            longitude={preview.stop.longitude}
            label={`Vista satelital de la parada ${preview.stop.index}`}
          />
          <p className="small" style={{ padding: '8px 10px' }}>
            <strong>Parada {preview.stop.index}</strong>
            <span className="muted"> · {formatClock(preview.stop.arrival)}–{formatClock(preview.stop.departure)} · {formatMinutes(preview.stop.minutes)}</span>
            {preview.stop.address && <span className="muted"> · {preview.stop.address}</span>}
          </p>
        </div>
      )}
    </div>
  );
}
