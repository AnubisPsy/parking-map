import { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { useImportParkings } from '../api/queries';
import { Upload, FileSpreadsheet, CheckCircle2, AlertTriangle, X } from 'lucide-react';
import { readSheetRows, parseParkingRow } from '../utils/excelParse';
import { formatDateTime, formatDuration } from '../lib/format';
import DataTable from './ui/DataTable';
import Modal from './ui/Modal';

const PREVIEW_COLUMNS = [
  { key: 'unit_id', label: 'No.', width: 80 },
  { key: 'unit_name', label: 'Placa', width: 100 },
  { key: 'address', label: 'Sucursal', width: 110 },
  { key: 'parking_start', label: 'Fecha y Hora', width: 150, render: (v) => formatDateTime(v) },
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

  function handleFile(e) {
    const file = e.target.files[0];
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

  return (
    <Modal label="Importar desde Excel" onClose={onClose} style={modal}>
        <div style={modalHeader}>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 16, fontWeight: 700 }}>
            <Upload size={18} /> Importar desde Excel
          </h2>
          <button onClick={onClose} style={closeBtn} aria-label="Cerrar"><X size={18} /></button>
        </div>

        <div style={modalBody}>
          {phase === 'pick' && (
            <div style={{ textAlign: 'center', padding: '32px 16px' }}>
              <FileSpreadsheet size={48} color="#64748b" style={{ marginBottom: 16 }} />
              <p style={{ color: '#475569', marginBottom: 8, fontSize: 14, lineHeight: 1.6 }}>
                Selecciona un archivo <strong>.xlsx</strong> con las columnas:
              </p>
              <p style={{ color: '#475569', fontSize: 12, marginBottom: 24, fontFamily: 'monospace' }}>
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
                <span style={{ color: '#15803d', fontWeight: 600 }}>{rows.length} registros válidos</span>
              </div>
              <DataTable label="Vista previa de la importación" data={rows} columns={PREVIEW_COLUMNS} maxHeight={340} />
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
                ? <CheckCircle2 size={48} color="#15803d" style={{ marginBottom: 16 }} />
                : <AlertTriangle size={48} color="#b45309" style={{ marginBottom: 16 }} />
              }
              <p style={{ fontSize: 16, fontWeight: 700, marginBottom: 8, color: '#1e293b' }}>
                {createdCount} registro{createdCount !== 1 ? 's' : ''} importado{createdCount !== 1 ? 's' : ''} correctamente
              </p>
              {failCount > 0 && (
                <p style={{ fontSize: 13, color: '#b91c1c', marginBottom: 8 }}>
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
    </Modal>
  );
}

const modal = { borderRadius: 16, maxWidth: 740 };
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
