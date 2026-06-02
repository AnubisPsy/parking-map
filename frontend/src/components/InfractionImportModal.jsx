import { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { AlertOctagon, Upload, X, Check, AlertTriangle, Loader2 } from 'lucide-react';
import { createReport } from '../api';

const BRANCH_MAP = {
  CAR: 'CARACAS', DXN: 'DIXON', MLL: 'MUELLE',
  TOC: 'TOCOA', SAT: 'SATUYE', STY: 'SATUYE',
  GIB: 'GIBSON', CEN: 'CENTRO', CTR: 'CENTRO',
};

function parseAgrupacion(raw) {
  const match = String(raw).match(/^([A-Z]+)\s+\(([^)]+)\)\s+([A-Z0-9\-]+)/);
  if (!match) return { plate: '', vehicle_num: raw };
  return {
    branch_code: match[1],
    plate: match[2],
    vehicle_num: match[3],
  };
}

async function parseInfractionFile(file) {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(new Uint8Array(buffer), { type: 'array' });

  // Find the infractions sheet (first one, or one named "Infracciones")
  const sheetName = wb.SheetNames.find(n =>
    n.toLowerCase().includes('infrac')
  ) || wb.SheetNames[0];

  if (!sheetName) throw new Error('No se encontró hoja de datos en el archivo.');

  const ws = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });

  if (rows.length === 0) throw new Error('El archivo no contiene datos.');

  // Detect column names (handle accents and case variations)
  const firstRow = rows[0];
  const colMap = {};
  Object.keys(firstRow).forEach(k => {
    const normalized = k.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    colMap[normalized] = k;
  });

  const col = (name) => colMap[name] || name;

  const infractions = rows.map(row => {
    const agrupacion = String(row[col('agrupacion')] || '').trim();
    const { plate, vehicle_num, branch_code } = parseAgrupacion(agrupacion);
    const fechaStr = String(row[col('fecha')] || '').trim();
    const date = fechaStr.split(' ')[0] || null;
    const velocidadRaw = String(row[col('velocidad')] || '0');
    const velocidad = parseInt(velocidadRaw) || 0;

    return {
      agrupacion,
      fecha: fechaStr,
      date,
      tipo: String(row[col('tipo')] || '').trim(),
      sucursal: String(row[col('sucursal')] || BRANCH_MAP[branch_code] || '').trim(),
      infraccion: String(row[col('infraccion')] || '').trim(),
      duracion: String(row[col('duracion')] || '').trim(),
      velocidad,
      plate,
      vehicle_num,
    };
  }).filter(r => r.agrupacion && r.infraccion);

  if (infractions.length === 0) throw new Error('No se encontraron registros de infracciones.');

  const dates = infractions.map(r => r.date).filter(Boolean).sort();
  return {
    infractions,
    date_from: dates[0] || null,
    date_to: dates[dates.length - 1] || null,
  };
}

function suggestLabel(filename, dateFrom, dateTo) {
  const fmt = (iso) => {
    if (!iso) return '';
    const [, m, d] = iso.split('-');
    const months = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
    return `${parseInt(d)} ${months[parseInt(m)-1]}`;
  };
  if (dateFrom) {
    const year = dateFrom.split('-')[0];
    if (dateFrom === dateTo) return `Infracciones ${fmt(dateFrom)} ${year}`;
    return `Infracciones ${fmt(dateFrom)} – ${fmt(dateTo)} ${year}`;
  }
  return filename.replace(/\.(xlsx?|xlsm)$/i, '');
}

export default function InfractionImportModal({ onImported, onClose }) {
  const [step, setStep] = useState('pick');
  const [file, setFile] = useState(null);
  const [parsed, setParsed] = useState(null);
  const [label, setLabel] = useState('');
  const [error, setError] = useState('');
  const [parsing, setParsing] = useState(false);
  const inputRef = useRef();

  async function handleFile(f) {
    if (!f) return;
    setFile(f);
    setError('');
    setParsing(true);
    try {
      const result = await parseInfractionFile(f);
      setLabel(suggestLabel(f.name, result.date_from, result.date_to));
      setParsed(result);
      setStep('preview');
    } catch (err) {
      setError(err.message || 'No se pudo leer el archivo.');
    } finally {
      setParsing(false);
    }
  }

  async function handleSave() {
    setStep('saving');
    try {
      const report = await createReport({
        type: 'infractions',
        label,
        date_from: parsed.date_from,
        date_to: parsed.date_to,
        source_file: file.name,
        infractions: parsed.infractions,
      });
      onImported(report);
      onClose();
    } catch (err) {
      setError('Error al guardar: ' + err.message);
      setStep('preview');
    }
  }

  // Unique violation types count for preview
  const uniqueTypes = parsed ? new Set(parsed.infractions.map(i => i.infraccion)).size : 0;
  const uniqueVehicles = parsed ? new Set(parsed.infractions.map(i => i.plate)).size : 0;

  return (
    <div style={overlay}>
      <div style={modal}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <AlertOctagon size={22} color="#dc2626" />
            <h2 style={{ fontSize: 17, fontWeight: 700, color: '#1e293b' }}>Importar Infracciones</h2>
          </div>
          <button onClick={onClose} style={closeBtn}><X size={18} /></button>
        </div>

        {step === 'pick' && (
          <div>
            <div
              onClick={() => inputRef.current.click()}
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); handleFile(e.dataTransfer.files[0]); }}
              style={dropZone}
            >
              {parsing
                ? <Loader2 size={36} color="#dc2626" style={{ animation: 'spin 1s linear infinite' }} />
                : <Upload size={36} color="#94a3b8" />}
              <p style={{ fontWeight: 600, color: '#374151', marginTop: 8 }}>
                {parsing ? 'Procesando archivo...' : 'Arrastra el archivo aquí o haz click'}
              </p>
              <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>Formatos: .xlsx, .xlsm</p>
            </div>
            <input ref={inputRef} type="file" accept=".xlsx,.xlsm,.xls" style={{ display: 'none' }}
              onChange={e => handleFile(e.target.files[0])} />
            {error && <div style={errorBox}><AlertTriangle size={14} /> {error}</div>}
          </div>
        )}

        {step === 'preview' && parsed && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={labelStyle}>Nombre del reporte</label>
              <input value={label} onChange={e => setLabel(e.target.value)} style={inputStyle}
                placeholder="Ej: Infracciones May 2026" />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
              <SCard label="Infracciones" count={parsed.infractions.length} color="#dc2626" />
              <SCard label="Tipos únicos" count={uniqueTypes} color="#d97706" />
              <SCard label="Unidades" count={uniqueVehicles} color="#7c3aed" />
            </div>

            <div style={{ background: '#f8fafc', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#64748b' }}>
              <p><strong>Archivo:</strong> {file.name}</p>
              <p style={{ marginTop: 3 }}><strong>Período:</strong> {parsed.date_from} → {parsed.date_to}</p>
            </div>

            {error && <div style={errorBox}><AlertTriangle size={14} /> {error}</div>}

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
              <button onClick={() => { setStep('pick'); setParsed(null); }} style={btnSecondary}>
                Cambiar archivo
              </button>
              <button onClick={handleSave} disabled={!label.trim()} style={btnPrimary}>
                <Check size={15} /> Guardar reporte
              </button>
            </div>
          </div>
        )}

        {step === 'saving' && (
          <div style={{ textAlign: 'center', padding: '30px 0' }}>
            <Loader2 size={36} color="#dc2626" style={{ animation: 'spin 1s linear infinite', marginBottom: 12 }} />
            <p style={{ color: '#64748b' }}>Guardando infracciones...</p>
          </div>
        )}
      </div>
      <style>{`@keyframes spin { from{transform:rotate(0deg)}to{transform:rotate(360deg)} }`}</style>
    </div>
  );
}

function SCard({ label, count, color }) {
  return (
    <div style={{ background: 'white', border: `1px solid ${color}25`, borderRadius: 10, padding: '12px 14px', textAlign: 'center' }}>
      <p style={{ fontSize: 24, fontWeight: 800, color }}>{count}</p>
      <p style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{label}</p>
    </div>
  );
}

const overlay = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 };
const modal = { background: 'white', borderRadius: 14, padding: 28, width: 500, maxWidth: '95vw', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' };
const closeBtn = { background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', display: 'flex', padding: 4, borderRadius: 6 };
const dropZone = { border: '2px dashed #e2e8f0', borderRadius: 12, padding: '36px 20px', textAlign: 'center', cursor: 'pointer', background: '#f8fafc' };
const labelStyle = { fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 };
const inputStyle = { width: '100%', padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14, color: '#1e293b', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' };
const btnPrimary = { display: 'flex', alignItems: 'center', gap: 6, padding: '9px 18px', background: '#dc2626', color: 'white', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' };
const btnSecondary = { padding: '9px 18px', background: 'transparent', color: '#374151', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' };
const errorBox = { display: 'flex', gap: 8, alignItems: 'center', background: '#fef2f2', color: '#dc2626', padding: '10px 14px', borderRadius: 8, fontSize: 13 };
