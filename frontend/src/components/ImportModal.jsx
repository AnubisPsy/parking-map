import { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { createParkingsBulk } from '../api';
import { Upload, FileSpreadsheet, CheckCircle2, AlertTriangle, X } from 'lucide-react';

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
function parseDatetime(dateVal, timeVal) {
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

function parseDuration(val) {
  if (val === null || val === undefined || val === '') return 0;
  const str = String(val).trim();
  if (!isNaN(str) && str !== '') return Math.round(Number(str) * 24 * 60);
  const parts = str.split(':').map(Number);
  return (parts[0] || 0) * 60 + (parts[1] || 0);
}

function parseCoords(val) {
  if (!val) return null;
  const parts = String(val).split(',').map(s => parseFloat(s.trim()));
  if (parts.length !== 2 || parts.some(isNaN)) return null;
  return { lat: parts[0], lng: parts[1] };
}

// Busca la primera clave de la fila que contenga alguno de los términos
function findKey(row, ...terms) {
  for (const term of terms) {
    const key = Object.keys(row).find(k => k.toLowerCase().includes(term.toLowerCase()));
    if (key !== undefined) return key;
  }
  return undefined;
}

// Detecta en qué fila están los encabezados buscando la que contenga "Placa"
function findHeaderRow(ws) {
  const all = XLSX.utils.sheet_to_json(ws, { defval: '', raw: false, header: 1 });
  const idx = all.findIndex(row => row.some(cell => /^placa$/i.test(String(cell).trim())));
  return idx >= 0 ? idx : 0;
}

function parseRow(row) {
  // Coordenadas: "Coordenadas" (viejo) o "Coords" (nuevo)
  const coordKey = findKey(row, 'Coordenadas', 'Coords');
  // Duración: "Duración" (viejo) o "Cant. Tiempo" / "Cant" (nuevo)
  const durKey = findKey(row, 'Duraci', 'Cant');
  // Fecha: puede ser "Fecha y Hora" (combinada) o solo "Fecha" (separada)
  const dateKey = findKey(row, 'Fecha');
  // Hora: columna separada solo en el nuevo formato
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

function fmtDuration(min) {
  if (!min) return '—';
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h}h ${m}min` : `${m}min`;
}

export default function ImportModal({ onImported, onClose }) {
  const [rows, setRows] = useState([]);
  const [fileName, setFileName] = useState('');
  const [phase, setPhase] = useState('pick');
  const [failCount, setFailCount] = useState(0);
  const [createdCount, setCreatedCount] = useState(0);
  const inputRef = useRef();

  function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = ev => {
      const wb = XLSX.read(new Uint8Array(ev.target.result), { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const headerIdx = findHeaderRow(ws);
      const json = XLSX.utils.sheet_to_json(ws, { defval: '', raw: false, range: headerIdx });
      const parsed = json
        .map(parseRow)
        .filter(r => r.unit_id && r.latitude != null && r.longitude != null);
      setRows(parsed);
      setPhase('preview');
    };
    reader.readAsArrayBuffer(file);
  }

  async function handleImport() {
    setPhase('importing');
    try {
      const { created, failed } = await createParkingsBulk(rows);
      setFailCount(failed.length);
      setCreatedCount(created.length);
      setPhase('done');
      if (created.length > 0) onImported(created);
    } catch {
      setFailCount(rows.length);
      setCreatedCount(0);
      setPhase('done');
    }
  }

  function reset() {
    setRows([]);
    setFileName('');
    setFailCount(0);
    setCreatedCount(0);
    setPhase('pick');
    if (inputRef.current) inputRef.current.value = '';
  }

  return (
    <div style={overlay}>
      <div style={modal}>
        <div style={modalHeader}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Upload size={18} /> Importar desde Excel
          </div>
          <button onClick={onClose} style={closeBtn}><X size={18} /></button>
        </div>

        <div style={modalBody}>
          {phase === 'pick' && (
            <div style={{ textAlign: 'center', padding: '32px 16px' }}>
              <FileSpreadsheet size={48} color="#94a3b8" style={{ marginBottom: 16 }} />
              <p style={{ color: '#64748b', marginBottom: 8, fontSize: 14, lineHeight: 1.6 }}>
                Selecciona un archivo <strong>.xlsx</strong> con las columnas:
              </p>
              <p style={{ color: '#94a3b8', fontSize: 12, marginBottom: 24, fontFamily: 'monospace' }}>
                No. · Placa · Sucursal · Fecha y Hora · Coordenadas · Duración
              </p>
              <input
                ref={inputRef}
                type="file"
                accept=".xlsx,.xls"
                style={{ display: 'none' }}
                onChange={handleFile}
              />
              <button onClick={() => inputRef.current.click()} style={btnPrimary}>
                Seleccionar archivo
              </button>
            </div>
          )}

          {phase === 'preview' && (
            <>
              <div style={{ marginBottom: 12, fontSize: 13, color: '#64748b' }}>
                <strong style={{ color: '#1e293b' }}>{fileName}</strong>
                {' — '}
                <span style={{ color: '#16a34a', fontWeight: 600 }}>{rows.length} registros válidos</span>
              </div>
              <div style={{ overflowX: 'auto', maxHeight: 340, overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: 8 }}>
                <table style={tableStyle}>
                  <thead>
                    <tr>
                      {['No.', 'Placa', 'Sucursal', 'Fecha y Hora', 'Coordenadas', 'Duración'].map(h => (
                        <th key={h} style={thStyle}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr key={i} style={{ background: i % 2 === 0 ? 'white' : '#f8fafc' }}>
                        <td style={tdStyle}>{r.unit_id}</td>
                        <td style={tdStyle}>{r.unit_name}</td>
                        <td style={tdStyle}>{r.address}</td>
                        <td style={tdStyle}>
                          {r.parking_start
                            ? new Date(r.parking_start).toLocaleString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                            : '—'}
                        </td>
                        <td style={tdStyle}>{r.latitude?.toFixed(5)}, {r.longitude?.toFixed(5)}</td>
                        <td style={tdStyle}>{fmtDuration(r.parking_duration)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ marginTop: 16, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button onClick={reset} style={btnOutline}>Cancelar</button>
                <button onClick={handleImport} style={btnPrimary} disabled={rows.length === 0}>
                  Importar {rows.length} registro{rows.length !== 1 ? 's' : ''}
                </button>
              </div>
            </>
          )}

          {phase === 'importing' && (
            <div style={{ padding: '32px 16px', textAlign: 'center' }}>
              <p style={{ fontSize: 14, color: '#64748b', marginBottom: 16 }}>
                Importando <strong>{rows.length}</strong> registros…
              </p>
              <div style={{ height: 6, background: '#e2e8f0', borderRadius: 6, overflow: 'hidden' }}>
                <div style={{
                  height: '100%', width: '100%',
                  background: 'linear-gradient(90deg, #1d4ed8, #2563eb)',
                  borderRadius: 6,
                  animation: 'pulse 1s ease-in-out infinite',
                }} />
              </div>
            </div>
          )}

          {phase === 'done' && (
            <div style={{ textAlign: 'center', padding: '32px 16px' }}>
              {failCount === 0
                ? <CheckCircle2 size={48} color="#16a34a" style={{ marginBottom: 16 }} />
                : <AlertTriangle size={48} color="#d97706" style={{ marginBottom: 16 }} />
              }
              <p style={{ fontSize: 16, fontWeight: 700, marginBottom: 8, color: '#1e293b' }}>
                {createdCount} registro{createdCount !== 1 ? 's' : ''} importado{createdCount !== 1 ? 's' : ''} correctamente
              </p>
              {failCount > 0 && (
                <p style={{ fontSize: 13, color: '#dc2626', marginBottom: 8 }}>
                  {failCount} fila{failCount !== 1 ? 's' : ''} no se pudo importar
                </p>
              )}
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 20 }}>
                {failCount > 0 && (
                  <button onClick={reset} style={btnOutline}>Importar otro</button>
                )}
                <button onClick={onClose} style={btnPrimary}>Cerrar</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const overlay = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000,
};
const modal = {
  background: 'white', borderRadius: 16, width: '92%', maxWidth: 740,
  boxShadow: '0 20px 60px rgba(0,0,0,0.3)', overflow: 'hidden',
};
const modalHeader = {
  padding: '16px 20px',
  background: 'linear-gradient(135deg, #1d4ed8 0%, #2563eb 100%)',
  color: 'white', display: 'flex', justifyContent: 'space-between',
  alignItems: 'center', fontSize: 16, fontWeight: 700,
};
const modalBody = { padding: '20px 24px' };
const closeBtn = {
  background: 'none', border: 'none', color: 'white',
  fontSize: 18, cursor: 'pointer', lineHeight: 1, padding: 0,
};
const btnPrimary = {
  padding: '10px 20px', background: '#2563eb', color: 'white',
  border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer',
};
const btnOutline = {
  padding: '10px 20px', background: 'transparent', color: '#374151',
  border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13,
  fontWeight: 600, cursor: 'pointer',
};
const tableStyle = { width: '100%', borderCollapse: 'collapse', fontSize: 12 };
const thStyle = {
  padding: '8px 10px', background: '#f1f5f9', fontWeight: 700,
  color: '#374151', borderBottom: '1px solid #e2e8f0',
  textAlign: 'left', whiteSpace: 'nowrap', position: 'sticky', top: 0,
};
const tdStyle = { padding: '6px 10px', color: '#374151', whiteSpace: 'nowrap' };
