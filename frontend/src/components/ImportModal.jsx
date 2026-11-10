import { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { useImportParkings } from '../api/queries';
import { CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';
import { readSheetRows, parseParkingRow } from '../utils/excelParse';
import { formatDateTime, formatDuration, plural } from '../lib/format';
import DataTable from './ui/DataTable';
import DropZone from './ui/DropZone';
import Modal from './ui/Modal';

const PREVIEW_COLUMNS = [
  { key: 'unit_id', label: 'No.', width: 80 },
  { key: 'unit_name', label: 'Placa', width: 100 },
  { key: 'address', label: 'Sucursal', width: 110 },
  { key: 'parking_start', label: 'Fecha y hora', width: 150, render: (v) => formatDateTime(v) },
  { key: 'latitude', label: 'Coordenadas', width: 170, render: (_, r) => `${r.latitude?.toFixed(5)}, ${r.longitude?.toFixed(5)}` },
  { key: 'parking_duration', label: 'Duración', flex: 1, render: (v) => formatDuration(v) ?? '—' },
];

export default function ImportModal({ onImported, onClose }) {
  const importParkings = useImportParkings();
  const [rows, setRows] = useState([]);
  const [fileName, setFileName] = useState('');
  const [phase, setPhase] = useState('pick');
  const [failCount, setFailCount] = useState(0);
  const [createdCount, setCreatedCount] = useState(0);
  const inputRef = useRef();

  function loadFile(file) {
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = ev => {
      const wb = XLSX.read(new Uint8Array(ev.target.result), { type: 'array' });
      // En archivos de rastreo (Rastro + Estacionamientos) usar solo la hoja de estacionamientos
      const sheetName = wb.SheetNames.find(n => /estacion/i.test(n)) || wb.SheetNames[0];
      const ws = wb.Sheets[sheetName];
      const parsed = readSheetRows(ws)
        .map(parseParkingRow)
        .filter(r => r.unit_id && r.latitude != null && r.longitude != null);
      setRows(parsed);
      setPhase('preview');
    };
    reader.readAsArrayBuffer(file);
  }

  async function handleImport() {
    setPhase('importing');
    try {
      const { created, failed } = await importParkings.mutateAsync(rows);
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

  const footer = {
    preview: (
      <>
        <button onClick={reset} className="btn btn-secondary">Elegir otro archivo</button>
        <button onClick={handleImport} className="btn btn-primary" disabled={rows.length === 0}>
          Importar {rows.length} {plural(rows.length, 'registro')}
        </button>
      </>
    ),
    done: (
      <>
        {failCount > 0 && <button onClick={reset} className="btn btn-secondary">Importar otro</button>}
        <button onClick={onClose} className="btn btn-primary">Cerrar</button>
      </>
    ),
  }[phase];

  return (
    <Modal
      title="Importar estacionamientos"
      description="Desde un archivo Excel del sistema GPS."
      size={phase === 'preview' ? 'lg' : 'md'}
      onClose={onClose}
      footer={footer}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls"
        className="sr-only"
        tabIndex={-1}
        aria-label="Archivo Excel"
        onChange={(e) => loadFile(e.target.files[0])}
      />

      {phase === 'pick' && (
        <DropZone
          hint="Columnas: No. · Placa · Sucursal · Fecha y Hora · Coordenadas · Duración"
          onPick={() => inputRef.current.click()}
          onDropFiles={(files) => loadFile(files[0])}
        />
      )}

      {phase === 'preview' && (
        <div className="stack" style={{ gap: 10 }}>
          <p className="small muted">
            <strong style={{ color: 'var(--ink)' }}>{fileName}</strong> · {rows.length} registros válidos
          </p>
          <DataTable label="Vista previa de la importación" data={rows} columns={PREVIEW_COLUMNS} maxHeight={320} />
        </div>
      )}

      {phase === 'importing' && (
        <div role="status" style={{ padding: '32px 16px', textAlign: 'center' }}>
          <Loader2 size={28} className="spin" color="var(--accent)" style={{ marginBottom: 10 }} />
          <p className="muted">Importando {rows.length} registros…</p>
        </div>
      )}

      {phase === 'done' && (
        <div style={{ textAlign: 'center', padding: '20px 16px' }}>
          {failCount === 0
            ? <CheckCircle2 size={32} color="var(--success)" style={{ marginBottom: 10 }} />
            : <AlertTriangle size={32} color="var(--warning)" style={{ marginBottom: 10 }} />}
          <p style={{ fontSize: 15, fontWeight: 600 }}>
            {createdCount} {plural(createdCount, 'registro')} {plural(createdCount, 'importado')} correctamente
          </p>
          {failCount > 0 && (
            <p style={{ fontSize: 13, color: 'var(--danger)', marginTop: 4 }}>
              {failCount} {plural(failCount, 'fila')} no se {failCount === 1 ? 'pudo' : 'pudieron'} importar
            </p>
          )}
        </div>
      )}
    </Modal>
  );
}
