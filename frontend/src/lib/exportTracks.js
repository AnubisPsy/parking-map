import { formatClock, formatDate, formatMinutes, googleMapsUrl } from './trackSummary';

const SUMMARY_COLUMNS = [
  ['Unidad', 10], ['Placa', 12], ['Fecha', 12], ['Inicio', 8], ['Fin', 8],
  ['Duración', 14], ['Distancia (km)', 14], ['Paradas', 9],
  ['Tiempo detenido', 16], ['Tiempo en movimiento', 20], ['Parada más larga', 26],
];

const STOP_COLUMNS = [
  ['Unidad', 10], ['Placa', 12], ['Fecha', 12], ['Parada', 8], ['Llegada', 9], ['Salida', 9],
  ['Tiempo detenido', 16], ['Minutos detenido', 16], ['Traslado previo', 15],
  ['Sucursal', 14], ['Latitud', 11], ['Longitud', 11], ['Ubicación', 22],
];

const MAP_LINK_TEXT = 'Ver en Google Maps';

function summaryRow(s) {
  const longest = s.longestStop;
  return {
    Unidad: s.unitId,
    Placa: s.unitName || '',
    Fecha: formatDate(s.start),
    Inicio: formatClock(s.start),
    Fin: formatClock(s.end),
    Duración: formatMinutes(s.totalMinutes),
    'Distancia (km)': Math.round(s.distanceKm * 10) / 10,
    Paradas: s.stops.length,
    'Tiempo detenido': formatMinutes(s.parkedMinutes),
    'Tiempo en movimiento': formatMinutes(s.movingMinutes),
    'Parada más larga': longest ? `#${longest.index} · ${formatMinutes(longest.minutes)} (${formatClock(longest.arrival)})` : '—',
  };
}

function stopRows(s) {
  return s.stops.map((stop) => ({
    Unidad: s.unitId,
    Placa: s.unitName || '',
    Fecha: formatDate(stop.arrival),
    Parada: stop.index,
    Llegada: formatClock(stop.arrival),
    Salida: formatClock(stop.departure),
    'Tiempo detenido': formatMinutes(stop.minutes),
    'Minutos detenido': stop.minutes,
    'Traslado previo': formatMinutes(stop.travelMinutes),
    Sucursal: stop.address || '',
    Latitud: stop.latitude,
    Longitud: stop.longitude,
    Ubicación: MAP_LINK_TEXT,
  }));
}

function buildSheet(XLSX, rows, columns) {
  const header = columns.map(([name]) => name);
  const sheet = XLSX.utils.json_to_sheet(rows, { header });
  sheet['!cols'] = columns.map(([, width]) => ({ wch: width }));
  if (rows.length > 0) {
    sheet['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: rows.length, c: header.length - 1 } }) };
  }
  return sheet;
}

// Un libro con dos hojas: "Resumen" (una fila por recorrido) y "Paradas" (una fila por parada)
export async function exportTracksToExcel(summaries, fileName) {
  const XLSX = await import('xlsx');
  const book = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(book, buildSheet(XLSX, summaries.map(summaryRow), SUMMARY_COLUMNS), 'Resumen');

  const stops = summaries.flatMap((s) => s.stops.map((stop) => ({ stop, summary: s })));
  const stopSheet = buildSheet(XLSX, summaries.flatMap(stopRows), STOP_COLUMNS);
  const linkColumn = STOP_COLUMNS.findIndex(([name]) => name === 'Ubicación');
  stops.forEach(({ stop }, i) => {
    const cell = stopSheet[XLSX.utils.encode_cell({ r: i + 1, c: linkColumn })];
    cell.l = { Target: googleMapsUrl(stop.latitude, stop.longitude), Tooltip: 'Abrir la ubicación' };
  });
  XLSX.utils.book_append_sheet(book, stopSheet, 'Paradas');

  XLSX.writeFile(book, fileName, { compression: true });
}
