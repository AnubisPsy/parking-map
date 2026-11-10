// Condensado de un recorrido GPS: cuánto duró, cuánto recorrió y dónde se detuvo.
// Lo usan la página de recorridos y la exportación a Excel, para que digan lo mismo.

function distanceKm(a, b) {
  const R = 6371;
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

const minutesBetween = (from, to) => Math.max(0, Math.round((to - from) / 60000));

export const googleMapsUrl = (lat, lng) => `https://www.google.com/maps?q=${lat},${lng}`;

// `parkings` son todos los estacionamientos: las paradas del recorrido son las que se
// importaron con él (`track_id`).
export function summarizeTrack(track, parkings) {
  const start = new Date(track.start);
  const end = new Date(track.end);

  let distance = 0;
  for (let i = 1; i < track.points.length; i++) distance += distanceKm(track.points[i - 1], track.points[i]);

  const stops = parkings
    .filter((p) => p.track_id === track.id && p.parking_start)
    .sort((a, b) => new Date(a.parking_start) - new Date(b.parking_start))
    .map((p) => {
      const arrival = new Date(p.parking_start);
      const minutes = p.parking_duration || 0;
      return {
        id: p.id,
        arrival,
        departure: new Date(arrival.getTime() + minutes * 60000),
        minutes,
        address: p.address,
        latitude: p.latitude,
        longitude: p.longitude,
      };
    });

  // Tiempo de traslado desde que salió de la parada anterior, o desde el inicio del recorrido
  stops.forEach((stop, i) => {
    stop.index = i + 1;
    stop.travelMinutes = minutesBetween(i === 0 ? start : stops[i - 1].departure, stop.arrival);
  });

  const totalMinutes = minutesBetween(start, end);
  const parkedMinutes = stops.reduce((sum, s) => sum + s.minutes, 0);

  return {
    id: track.id,
    unitId: track.unit_id,
    unitName: track.unit_name,
    address: track.address,
    start,
    end,
    totalMinutes,
    parkedMinutes,
    movingMinutes: Math.max(0, totalMinutes - parkedMinutes),
    distanceKm: distance,
    stops,
    longestStop: stops.reduce((best, s) => (!best || s.minutes > best.minutes ? s : best), null),
  };
}

export function formatClock(date) {
  return date.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false });
}

export function formatDate(date) {
  return date.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function formatMinutes(minutes) {
  if (!minutes) return '0 min';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

export const formatKm = (km) => `${km.toLocaleString('es-MX', { maximumFractionDigits: 1, minimumFractionDigits: 1 })} km`;
