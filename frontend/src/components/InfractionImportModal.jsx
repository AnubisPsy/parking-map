import { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { Check, AlertTriangle, Loader2 } from 'lucide-react';
import DropZone from './ui/DropZone';
import { useCreateReport } from '../api/queries';
import Modal from './ui/Modal';

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

  // Normaliza cualquier formato de fecha a YYYY-MM-DD para ordenamiento correcto
  function normalizeDate(raw) {
    if (!raw) return null;
    // Ya es ISO: "2026-05-30"
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
    // DD/MM/YYYY → YYYY-MM-DD
    const m = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
    // DD/MM/YYYY HH:MM:SS → toma solo la parte de fecha
    const m2 = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s/);
    if (m2) return `${m2[3]}-${m2[2].padStart(2, '0')}-${m2[1].padStart(2, '0')}`;
    return null;
  }

  // Construye fecha+hora legible combinando columnas separadas si es necesario
  function buildFechaStr(row) {
    const fechaCol = col('fecha');
    const horaCol = col('hora');
    const fechaVal = String(row[fechaCol] || '').trim();
    const horaVal = String(row[horaCol] || '').trim();
    if (horaVal && fechaVal && !fechaVal.includes(':') && !fechaVal.includes(horaVal)) {
      return `${fechaVal} ${horaVal}`;
    }
    return fechaVal;
  }

  const infractions = rows.map(row => {
    const agrupacion = String(row[col('agrupacion')] || '').trim();
    const { plate, vehicle_num, branch_code } = parseAgrupacion(agrupacion);
    const fechaStr = buildFechaStr(row);
    // Extrae la parte de fecha pura (primer token sin hora)
    const rawDate = fechaStr.split(/[\sT]/)[0] || null;
    const date = normalizeDate(rawDate);
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

export default function InfractionImportModal({ onClose }) {
  const [step, setStep] = useState('pick');
  const [file, setFile] = useState(null);
  const [parsed, setParsed] = useState(null);
  const [label, setLabel] = useState('');
  const [error, setError] = useState('');
  const [parsing, setParsing] = useState(false);
  const createReport = useCreateReport();
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
      await createReport.mutateAsync({
        type: 'infractions',
        label,
        date_from: parsed.date_from,
        date_to: parsed.date_to,
        source_file: file.name,
        infractions: parsed.infractions,
      });
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
    <Modal
      title="Importar infracciones"
      description="Desde el archivo de infracciones del sistema GPS."
      onClose={step === 'saving' ? () => {} : onClose}
      footer={step === 'preview' && parsed ? (
        <>
          <button onClick={() => { setStep('pick'); setParsed(null); }} className="btn btn-secondary">
            Cambiar archivo
          </button>
          <button onClick={handleSave} disabled={!label.trim()} className="btn btn-primary">
            <Check size={15} /> Guardar reporte
          </button>
        </>
      ) : null}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xlsm,.xls"
        className="sr-only"
        tabIndex={-1}
        aria-label="Archivo Excel"
        onChange={e => handleFile(e.target.files[0])}
      />

      {step === 'pick' && (
        <div className="stack" style={{ gap: 12 }}>
          <DropZone
            hint="Formatos: .xlsx, .xlsm"
            busy={parsing}
            onPick={() => inputRef.current.click()}
            onDropFiles={(files) => handleFile(files[0])}
          />
          {error && <div role="alert" className="notice notice-error"><AlertTriangle size={15} /> {error}</div>}
        </div>
      )}

      {step === 'preview' && parsed && (
        <div className="stack">
          <label className="field">
            <span className="field-label">Nombre del reporte</span>
            <input className="input" value={label} onChange={e => setLabel(e.target.value)} placeholder="Infracciones may 2026" data-autofocus />
          </label>

          <div className="grid-auto" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
            <SCard label="Infracciones" count={parsed.infractions.length} />
            <SCard label="Tipos" count={uniqueTypes} />
            <SCard label="Unidades" count={uniqueVehicles} />
          </div>

          <dl className="definition-list">
            <dt>Archivo</dt><dd>{file.name}</dd>
            <dt>Período</dt><dd>{parsed.date_from} → {parsed.date_to}</dd>
          </dl>

          {error && <div role="alert" className="notice notice-error"><AlertTriangle size={15} /> {error}</div>}
        </div>
      )}

      {step === 'saving' && (
        <div role="status" style={{ textAlign: 'center', padding: '30px 0' }}>
          <Loader2 size={28} color="var(--accent)" className="spin" style={{ marginBottom: 10 }} />
          <p className="muted">Guardando infracciones…</p>
        </div>
      )}
    </Modal>
  );
}

function SCard({ label, count }) {
  return (
    <div className="card stat" style={{ padding: '10px 12px' }}>
      <p className="stat-label">{label}</p>
      <p className="stat-value" style={{ fontSize: 20 }}>{count}</p>
    </div>
  );
}
