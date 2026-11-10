import { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { createTrack } from '../api';
import { CheckCircle2, AlertTriangle, Loader2, Plus, Trash2 } from 'lucide-react';
import { plural } from '../lib/format';
import DropZone from './ui/DropZone';
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

  async function addFiles(list) {
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

  const footer = {
    preview: (
      <>
        <button onClick={() => inputRef.current?.click()} className="btn btn-ghost">
          <Plus size={14} /> Agregar más archivos
        </button>
        <div className="row">
          <button onClick={onClose} className="btn btn-secondary">Cancelar</button>
          <button onClick={handleImport} className="btn btn-primary" disabled={!valid.length}>
            Importar {valid.length} {plural(valid.length, 'recorrido')}
          </button>
        </div>
      </>
    ),
    done: <button onClick={onClose} className="btn btn-primary" style={{ marginLeft: 'auto' }}>Cerrar</button>,
  }[phase];

  return (
    <Modal
      title="Importar rastreo GPS"
      description="Recorridos con sus paradas, desde uno o varios archivos Excel."
      size={phase === 'pick' ? 'md' : 'lg'}
      onClose={onClose}
      footer={footer}
      footerBetween
    >
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls"
        multiple
        className="sr-only"
        tabIndex={-1}
        aria-label="Archivos Excel"
        onChange={e => addFiles([...e.target.files])}
      />

      {phase === 'pick' && (
        <DropZone
          title="Arrastra los archivos aquí o haz clic para elegirlos"
          hint="Hojas requeridas: Rastro y Estacionamientos"
          onPick={() => inputRef.current?.click()}
          onDropFiles={addFiles}
        />
      )}

      {phase === 'preview' && (
        <div className="stack" style={{ gap: 10 }}>
          <div className="table-frame" style={{ maxHeight: 320, overflow: 'auto' }}>
            <table className="simple-table">
              <thead>
                <tr>
                  {['Archivo', 'Unidad', 'Recorrido', 'Puntos', 'Paradas'].map(h => <th key={h}>{h}</th>)}
                  <th><span className="sr-only">Acciones</span></th>
                </tr>
              </thead>
              <tbody>
                {files.map((f, i) => (
                  <tr key={i}>
                    <td className="truncate" style={{ maxWidth: 180 }} title={f.fileName}>{f.fileName}</td>
                    {f.data ? (
                      <>
                        <td><strong>{f.data.unit_id}</strong> · {f.data.unit_name}</td>
                        <td>{fmtTime(f.data.points[0].t)} → {fmtTime(f.data.points[f.data.points.length - 1].t)}</td>
                        <td>{f.data.points.length}</td>
                        <td>{f.data.stops.length}</td>
                      </>
                    ) : (
                      <td colSpan={4} style={{ color: 'var(--danger)' }}>
                        <AlertTriangle size={12} style={{ verticalAlign: -2, marginRight: 4 }} />
                        {f.error}
                      </td>
                    )}
                    <td>
                      <button onClick={() => removeFile(i)} className="icon-btn icon-btn-danger" title="Quitar" aria-label={`Quitar ${f.fileName}`}>
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="small muted">
            Un recorrido ya importado (misma unidad y horas) se reemplaza junto con sus estacionamientos.
          </p>
        </div>
      )}

      {phase === 'importing' && (
        <div role="status" style={{ textAlign: 'center', padding: '30px 16px' }}>
          <Loader2 size={28} color="var(--accent)" className="spin" style={{ marginBottom: 10 }} />
          <p className="muted">Guardando recorridos…</p>
        </div>
      )}

      {phase === 'done' && (
        <div className="stack" style={{ gap: 6 }}>
          {results.map((r, i) => (
            <div key={i} className="row" style={{ fontSize: 13 }}>
              {r.ok
                ? <CheckCircle2 size={16} color="var(--success)" />
                : <AlertTriangle size={16} color="var(--danger)" />}
              <span className="truncate" style={{ flex: 1 }}>{r.fileName}</span>
              <span style={{ color: r.ok ? 'var(--ink-3)' : 'var(--danger)', flexShrink: 0 }}>
                {r.ok
                  ? `${r.res.track.points.length} puntos · ${r.res.parkings.length} paradas${r.replaced ? ' (reemplazado)' : ''}`
                  : r.error}
              </span>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
