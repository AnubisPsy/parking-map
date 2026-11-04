import { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { createTrack } from '../api';
import { Route, FileSpreadsheet, CheckCircle2, AlertTriangle, X, Trash2 } from 'lucide-react';
import { parseTrackWorkbook } from '../utils/excelParse';
import Modal from './ui/Modal';

function fmtTime(iso) {
  return new Date(iso).toLocaleString('es-MX', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  });
}

function readWorkbook(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = ev => {
      try { resolve(XLSX.read(new Uint8Array(ev.target.result), { type: 'array' })); }
      catch (e) { reject(e); }
    };
    reader.onerror = () => reject(new Error('No se pudo leer el archivo'));
    reader.readAsArrayBuffer(file);
  });
}

export default function TrackImportModal({ onImported, onClose }) {
  // Cada entrada: { fileName, data?, error? }
  const [files, setFiles] = useState([]);
  const [phase, setPhase] = useState('pick');
  const [results, setResults] = useState([]);
  const inputRef = useRef();

  async function handleFiles(e) {
    const list = [...e.target.files];
    if (list.length === 0) return;
    const parsed = await Promise.all(list.map(async file => {
      try {
        const data = parseTrackWorkbook(await readWorkbook(file));
        return { fileName: file.name, data };
      } catch (err) {
        return { fileName: file.name, error: err.message };
      }
    }));
    setFiles(prev => [...prev, ...parsed]);
    setPhase('preview');
    if (inputRef.current) inputRef.current.value = '';
  }

  function removeFile(idx) {
    setFiles(prev => {
      const next = prev.filter((_, i) => i !== idx);
      if (next.length === 0) setPhase('pick');
      return next;
    });
  }

  const valid = files.filter(f => f.data);

  async function handleImport() {
    setPhase('importing');
    const out = [];
    for (const f of valid) {
      try {
        const res = await createTrack({ ...f.data, source_file: f.fileName });
        out.push({ fileName: f.fileName, ok: true, replaced: !!res.replaced_track_id, res });
      } catch (err) {
        out.push({ fileName: f.fileName, ok: false, error: err.message });
      }
    }
    setResults(out);
    setPhase('done');
    const saved = out.filter(r => r.ok).map(r => r.res);
    if (saved.length > 0) onImported(saved);
  }

  return (
    <Modal label="Importar rastreo GPS" onClose={onClose} style={modal}>
        <div style={modalHeader}>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 16, fontWeight: 700 }}>
            <Route size={18} /> Importar rastreo GPS
          </h2>
          <button onClick={onClose} style={closeBtn} aria-label="Cerrar"><X size={18} /></button>
        </div>

        <div style={modalBody}>
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls"
            multiple
            style={{ display: 'none' }}
            onChange={handleFiles}
          />

          {phase === 'pick' && (
            <div style={{ textAlign: 'center', padding: '32px 16px' }}>
              <FileSpreadsheet size={48} color="#64748b" style={{ marginBottom: 16 }} />
              <p style={{ color: '#475569', marginBottom: 8, fontSize: 14, lineHeight: 1.6 }}>
                Selecciona uno o varios archivos <strong>.xlsx</strong> de rastreo con las hojas:
              </p>
              <p style={{ color: '#475569', fontSize: 12, marginBottom: 4, fontFamily: 'monospace' }}>
                Rastro: No. · Placa · Sucursal · Coordenadas · Hora
              </p>
              <p style={{ color: '#475569', fontSize: 12, marginBottom: 24, fontFamily: 'monospace' }}>
                Estacionamientos: No. · Placa · Sucursal · Duración · Coordenadas · Hora
              </p>
              <button onClick={() => inputRef.current?.click()} style={btnPrimary}>
                Seleccionar archivos
              </button>
            </div>
          )}

          {phase === 'preview' && (
            <>
              <div style={{ maxHeight: 340, overflow: 'auto', border: '1px solid #e2e8f0', borderRadius: 8 }}>
                <table style={tableStyle}>
                  <thead>
                    <tr>
                      {['Archivo', 'Unidad', 'Recorrido', 'Puntos', 'Paradas'].map(h => (
                        <th key={h} style={thStyle}>{h}</th>
                      ))}
                      <th style={thStyle}><span className="sr-only">Acciones</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {files.map((f, i) => (
                      <tr key={i} style={{ background: i % 2 === 0 ? 'white' : '#f8fafc' }}>
                        <td style={{ ...tdStyle, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }} title={f.fileName}>
                          {f.fileName}
                        </td>
                        {f.data ? (
                          <>
                            <td style={tdStyle}><strong>{f.data.unit_id}</strong> · {f.data.unit_name}</td>
                            <td style={tdStyle}>
                              {fmtTime(f.data.points[0].t)} → {fmtTime(f.data.points[f.data.points.length - 1].t)}
                            </td>
                            <td style={tdStyle}>{f.data.points.length}</td>
                            <td style={tdStyle}>{f.data.stops.length}</td>
                          </>
                        ) : (
                          <td colSpan={4} style={{ ...tdStyle, color: '#b91c1c' }}>
                            <AlertTriangle size={12} style={{ verticalAlign: -2, marginRight: 4 }} />
                            {f.error}
                          </td>
                        )}
                        <td style={tdStyle}>
                          <button onClick={() => removeFile(i)} style={iconBtn} title="Quitar" aria-label={`Quitar ${f.fileName}`}>
                            <Trash2 size={13} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p style={{ fontSize: 12, color: '#475569', marginTop: 10 }}>
                Si un recorrido ya fue importado (misma unidad y mismo rango de horas) se reemplaza junto con sus estacionamientos.
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'space-between', marginTop: 16 }}>
                <button onClick={() => inputRef.current?.click()} style={btnOutline}>
                  Agregar más archivos
                </button>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={onClose} style={btnOutline}>Cancelar</button>
                  <button onClick={handleImport} style={{ ...btnPrimary, opacity: valid.length ? 1 : 0.5 }} disabled={!valid.length}>
                    Importar {valid.length} recorrido{valid.length !== 1 ? 's' : ''}
                  </button>
                </div>
              </div>
            </>
          )}

          {phase === 'importing' && (
            <div role="status" style={{ textAlign: 'center', padding: '40px 16px', color: '#475569', fontSize: 14 }}>
              Guardando recorridos...
            </div>
          )}

          {phase === 'done' && (
            <div style={{ padding: '16px 8px' }}>
              {results.map((r, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, padding: '6px 0', color: '#374151' }}>
                  {r.ok
                    ? <CheckCircle2 size={16} color="#15803d" />
                    : <AlertTriangle size={16} color="#b91c1c" />}
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.fileName}</span>
                  <span style={{ color: r.ok ? '#475569' : '#b91c1c', flexShrink: 0 }}>
                    {r.ok
                      ? `${r.res.track.points.length} puntos · ${r.res.parkings.length} paradas${r.replaced ? ' (reemplazado)' : ''}`
                      : r.error}
                  </span>
                </div>
              ))}
              <div style={{ textAlign: 'right', marginTop: 16 }}>
                <button onClick={onClose} style={btnPrimary}>Cerrar</button>
              </div>
            </div>
          )}
        </div>
    </Modal>
  );
}

const modal = { borderRadius: 16, maxWidth: 780 };
const modalHeader = {
  padding: '16px 20px',
  background: 'linear-gradient(135deg, #1d4ed8 0%, #2563eb 100%)',
  color: 'white', display: 'flex', justifyContent: 'space-between',
  alignItems: 'center', fontSize: 16, fontWeight: 700,
};
const modalBody = { padding: '20px 24px' };
const closeBtn = {
  background: 'none', border: 'none', color: 'white',
  cursor: 'pointer', padding: 0, display: 'flex', borderRadius: 4,
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
const iconBtn = {
  background: 'none', border: 'none', cursor: 'pointer', color: '#64748b',
  display: 'flex', padding: 2, borderRadius: 4,
};
const tableStyle = { width: '100%', borderCollapse: 'collapse', fontSize: 12 };
const thStyle = {
  padding: '8px 10px', background: '#f1f5f9', fontWeight: 700,
  color: '#374151', borderBottom: '1px solid #e2e8f0',
  textAlign: 'left', whiteSpace: 'nowrap', position: 'sticky', top: 0,
};
const tdStyle = { padding: '6px 10px', color: '#374151', whiteSpace: 'nowrap' };
