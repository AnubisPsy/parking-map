import { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { createParkingsBulk } from '../api';
import { Upload, FileSpreadsheet, CheckCircle2, AlertTriangle, X } from 'lucide-react';

const MONTHS_ES = {
  enero: 0, febrero: 1, marzo: 2, abril: 3, mayo: 4, junio: 5,
  julio: 6, agosto: 7, septiembre: 8, octubre: 9, noviembre: 10, diciembre: 11,
};

function parseDate(val) {
  if (!val) return null;
  const str = String(val).trim();
  const m = str.match(/^(\d{1,2})\s+(\w+)\s+(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})$/);
  if (!m) return null;
  const month = MONTHS_ES[m[2].toLowerCase()];
  if (month === undefined) return null;
  return new Date(Number(m[3]), month, Number(m[1]), Number(m[4]), Number(m[5]), Number(m[6])).toISOString();
}

function parseDuration(val) {
  if (val === null || val === undefined || val === '') return 0;
  const str = String(val).trim();
  if (!isNaN(str) && str !== '') {
    return Math.round(Number(str) * 24 * 60);
  }
  const parts = str.split(':').map(Number);
  return (parts[0] || 0) * 60 + (parts[1] || 0);
}

function parseCoords(val) {
  if (!val) return null;
  const parts = String(val).split(',').map(s => parseFloat(s.trim()));
  if (parts.length !== 2 || parts.some(isNaN)) return null;
  return { lat: parts[0], lng: parts[1] };
}

function findKey(row, prefix) {
  return Object.keys(row).find(k => k.toLowerCase().startsWith(prefix.toLowerCase()));
}

function parseRow(row) {
  const coordKey = findKey(row, 'Coordenadas');
  const durKey = findKey(row, 'Duraci');
  const dateKey = findKey(row, 'Fecha');
  const coords = parseCoords(row[coordKey]);
  return {
    unit_id: String(row['No.'] || row['No'] || '').trim(),
    unit_name: String(row['Placa'] || '').trim(),
    address: String(row['Sucursal'] || '').trim(),
    parking_start: parseDate(String(row[dateKey] || '')),
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
      const json = XLSX.utils.sheet_to_json(ws, { defval: '', raw: false });
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
