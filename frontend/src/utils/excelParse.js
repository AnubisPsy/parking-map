import * as XLSX from 'xlsx';

const MONTHS = {
  // Español completo
  enero: 0, febrero: 1, marzo: 2, abril: 3, mayo: 4, junio: 5,
  julio: 6, agosto: 7, septiembre: 8, octubre: 9, noviembre: 10, diciembre: 11,
  // Español abreviado
  ene: 0, feb: 1, mar: 2, abr: 3, may: 4, jun: 5,
  jul: 6, ago: 7, sep: 8, oct: 9, nov: 10, dic: 11,
  // Inglés completo (formato GPS: "Friday, June 05, 2026")
  january: 0, february: 1, march: 2, april: 3, june: 5,
  july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
  // Inglés abreviado
  jan: 0, apr: 3, aug: 7, dec: 11,
};

// Extrae h/min/sec de un string de hora, soporta 24h y 12h AM/PM
function parseTimeStr(val) {
  const mt = String(val || '').trim().match(/^(\d{1,2}):(\d{2}):(\d{2})\s*(AM|PM)?$/i);
  if (!mt) return { h: 0, min: 0, sec: 0 };
  let h = +mt[1], min = +mt[2], sec = +mt[3];
  if (mt[4]) {
    if (mt[4].toUpperCase() === 'PM' && h < 12) h += 12;
    if (mt[4].toUpperCase() === 'AM' && h === 12) h = 0;
  }
  return { h, min, sec };
}

// Combina fecha y hora en ISO string, soporta múltiples formatos del GPS:
//   "04 Jun 2026 12:11:30"
//   "Friday, June 05, 2026"  +  "11:52:25 AM"
//   "20/05/2026"             +  "7:34:06 AM"
//   "2026-05-20"             +  (hora opcional)
export function parseDatetime(dateVal, timeVal) {
  const dateStr = String(dateVal || '').trim();
  if (!dateStr) return null;
  const { h, min, sec } = parseTimeStr(timeVal);

  // "DD Mon YYYY HH:MM:SS"  — fecha y hora en una sola celda
  const m1 = dateStr.match(/^(\d{1,2})\s+(\w+)\s+(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})$/);
  if (m1) {
    const month = MONTHS[m1[2].toLowerCase()];
    if (month !== undefined)
      return new Date(+m1[3], month, +m1[1], +m1[4], +m1[5], +m1[6]).toISOString();
  }

  // "DayName, MonthName DD, YYYY"  — GPS inglés
  const m2 = dateStr.match(/\w+,\s+(\w+)\s+(\d{1,2}),\s+(\d{4})/);
  if (m2) {
    const month = MONTHS[m2[1].toLowerCase()];
    if (month !== undefined)
      return new Date(+m2[3], month, +m2[2], h, min, sec).toISOString();
  }

  // "DD/MM/YYYY"  — formato latino
  const m3 = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m3)
    return new Date(+m3[3], +m3[2] - 1, +m3[1], h, min, sec).toISOString();

  // "YYYY-MM-DD" o "YYYY-MM-DDTHH:MM:SS"  — ISO
  const m4 = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}):(\d{2}))?/);
  if (m4)
    return new Date(+m4[1], +m4[2]-1, +m4[3],
      m4[4] ? +m4[4] : h, m4[5] ? +m4[5] : min, m4[6] ? +m4[6] : sec).toISOString();

  return null;
}

export function parseDuration(val) {
  if (val === null || val === undefined || val === '') return 0;
  const str = String(val).trim();
  if (!isNaN(str) && str !== '') return Math.round(Number(str) * 24 * 60);
  const parts = str.split(':').map(Number);
  return (parts[0] || 0) * 60 + (parts[1] || 0);
}

export function parseCoords(val) {
  if (!val) return null;
  const parts = String(val).split(',').map(s => parseFloat(s.trim()));
  if (parts.length !== 2 || parts.some(isNaN)) return null;
  return { lat: parts[0], lng: parts[1] };
}

// Busca la primera clave de la fila que contenga alguno de los términos
export function findKey(row, ...terms) {
  for (const term of terms) {
    const key = Object.keys(row).find(k => k.toLowerCase().includes(term.toLowerCase()));
    if (key !== undefined) return key;
  }
  return undefined;
}

// Detecta en qué fila están los encabezados buscando la que contenga "Placa"
export function findHeaderRow(ws) {
  const all = XLSX.utils.sheet_to_json(ws, { defval: '', raw: false, header: 1 });
  const idx = all.findIndex(row => row.some(cell => /^placa$/i.test(String(cell).trim())));
  return idx >= 0 ? idx : 0;
}

// Lee una hoja como objetos usando la fila de encabezados detectada
export function readSheetRows(ws) {
  const headerIdx = findHeaderRow(ws);
  return XLSX.utils.sheet_to_json(ws, { defval: '', raw: false, range: headerIdx });
}

// Lee un archivo de rastreo GPS con dos hojas:
//   "Rastro":           No. · Placa · Sucursal · Coordenadas · Hora   (un punto por fila)
//   "Estacionamientos": No. · Placa · Sucursal · Duración · Coordenadas · Hora
// Devuelve { unit_id, unit_name, address, points, stops } o lanza un Error descriptivo.
export function parseTrackWorkbook(wb) {
  const rastroName = wb.SheetNames.find(n => /rastr/i.test(n));
  if (!rastroName) throw new Error('No se encontró la hoja "Rastro"');
  const stopsName = wb.SheetNames.find(n => /estacion/i.test(n));

  let unit = null;
  const points = [];
  for (const row of readSheetRows(wb.Sheets[rastroName])) {
    const coords = parseCoords(row[findKey(row, 'Coordenadas', 'Coords')]);
    const t = parseDatetime(row[findKey(row, 'Hora', 'Fecha')], null);
    if (!coords || !t) continue;
    if (!unit) {
      unit = {
        unit_id: String(row[findKey(row, 'No.')] || '').trim(),
        unit_name: String(row['Placa'] || '').trim(),
        address: String(row[findKey(row, 'Sucursal')] || '').trim(),
      };
    }
    points.push({ lat: coords.lat, lng: coords.lng, t });
  }
  if (points.length < 2) throw new Error('La hoja "Rastro" no tiene suficientes puntos válidos');
  if (!unit.unit_id) throw new Error('No se pudo identificar la unidad (columna "No.")');
  points.sort((a, b) => new Date(a.t) - new Date(b.t));

  const stops = stopsName
    ? readSheetRows(wb.Sheets[stopsName])
        .map(parseParkingRow)
        .filter(s => s.latitude != null && s.longitude != null)
    : [];

  return { ...unit, points, stops };
}

// Convierte una fila de estacionamiento (formato GPS) a registro de parking.
// La fecha puede venir como "Fecha y Hora", "Fecha" + "Hora" o solo "Hora" (fecha completa).
export function parseParkingRow(row) {
  // Coordenadas: "Coordenadas" (viejo) o "Coords" (nuevo)
  const coordKey = findKey(row, 'Coordenadas', 'Coords');
  // Duración: "Duración" (viejo) o "Cant. Tiempo" / "Cant" (nuevo)
  const durKey = findKey(row, 'Duraci', 'Cant');
  // Fecha: "Fecha y Hora" (combinada), "Fecha" (separada) o solo "Hora" con la fecha completa
  const dateKey = findKey(row, 'Fecha', 'Hora');
  // Hora: columna separada solo en el formato con "Fecha" + "Hora"
  const timeKey = findKey(row, 'Hora');
  // Unidad: "No." (viejo) o "No. Vehículo" (nuevo)
  const numKey = findKey(row, 'No.');
  // Sucursal: "Sucursal" (viejo) o "Sucursal Asignada" (nuevo)
  const sucKey = findKey(row, 'Sucursal');
  const coords = parseCoords(row[coordKey]);

  // Si la columna de fecha ya incluye "Hora" en su nombre, no usar columna separada
  const timeColVal = (dateKey && /hora/i.test(dateKey)) ? null : (timeKey ? row[timeKey] : null);

  return {
    unit_id: String(row[numKey] || '').trim(),
    unit_name: String(row['Placa'] || '').trim(),
    address: String(row[sucKey] || '').trim(),
    parking_start: parseDatetime(row[dateKey], timeColVal),
    parking_duration: parseDuration(row[durKey]),
    latitude: coords?.lat,
    longitude: coords?.lng,
  };
}
