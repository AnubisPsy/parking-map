import { NEUTRAL } from './colors';
import { stopInWindow } from './parkingGroups';

// Convierte tracks del backend al formato que usa el reproductor.
// `stops` son los estacionamientos (parkings) que se importaron con el recorrido.
// Vive fuera de TrackPlayback para no arrastrar Leaflet al paquete inicial.
// `win` (opcional) deja solo las paradas de los días que se están viendo
export function prepareTracks(tracks, unitColors, parkings, win) {
  return tracks
    .filter((t) => t.points.length > 0)
    .map((t) => {
      const pts = t.points.map((p) => ({ lat: p.lat, lng: p.lng, ms: new Date(p.t).getTime() }));
      const stops = parkings
        .filter((p) => p.track_id === t.id && p.parking_start && stopInWindow(p, win))
        .map((p) => {
          const ms = new Date(p.parking_start).getTime();
          return { id: p.id, ms, endMs: ms + (p.parking_duration || 0) * 60000, duration: p.parking_duration || 0 };
        })
        .sort((a, b) => a.ms - b.ms);
      return {
        id: t.id,
        unit_id: t.unit_id,
        label: t.unit_name ? `${t.unit_id} · ${t.unit_name}` : t.unit_id,
        color: unitColors[t.unit_id] || NEUTRAL,
        pts,
        stops,
        startMs: pts[0].ms,
        endMs: pts[pts.length - 1].ms,
      };
    });
}
