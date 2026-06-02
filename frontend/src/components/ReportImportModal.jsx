import { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { Upload, FileSpreadsheet, X, Check, AlertTriangle, Loader2 } from 'lucide-react';
import { createReport } from '../api';

const DAY_SHEETS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

const BRANCH_MAP = {
  CAR: 'CARACAS', DXN: 'DIXON', MLL: 'MUELLE',
  TOC: 'TOCOA', SAT: 'SATUYE', GIB: 'GIBSON', CEN: 'CENTRO', CTR: 'CENTRO',
};

function cellVal(ws, r, c) {
  const cell = ws[XLSX.utils.encode_cell({ r, c })];
  return cell ? cell.v : null;
}

function cellText(ws, r, c) {
  const v = cellVal(ws, r, c);
  if (v === null || v === undefined) return '';
  return String(v).trim();
}

function excelDateToISO(serial) {
  if (!serial || typeof serial !== 'number') return null;
  const d = XLSX.SSF.parse_date_code(serial);
  if (!d || !d.y) return null;
  return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
}

function excelTimeToStr(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string') return v.trim();
  if (typeof v === 'number') {
    if (v >= 0 && v < 1) {
      const total = Math.round(v * 86400);
      const h = Math.floor(total / 3600);
      const m = Math.floor((total % 3600) / 60);
      const s = total % 60;
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }
  }
  return String(v).trim();
}

function parseUnitRaw(raw) {
  const match = raw.match(/^([A-Z]+)\s+\(([^)]+)\)\s+([A-Z0-9\-]+)/);
  if (!match) return { branch: '', plate: '', vehicle_num: raw };
  return {
    branch: BRANCH_MAP[match[1]] || match[1],
    plate: match[2],
    vehicle_num: match[3],
  };
}

function parseSpanishDate(text) {
  if (!text || typeof text !== 'string') return null;
  const MONTHS = { enero:1, febrero:2, marzo:3, abril:4, mayo:5, junio:6, julio:7, agosto:8, septiembre:9, octubre:10, noviembre:11, diciembre:12 };
  const m = text.toLowerCase().match(/(\d{1,2})\s+de\s+(\w+)\s+de\s+(\d{4})/);
  if (!m) return null;
  const month = MONTHS[m[2]];
  if (!month) return null;
  return `${m[3]}-${String(month).padStart(2,'0')}-${String(parseInt(m[1])).padStart(2,'0')}`;
}

function resolveDate(v, fallback) {
  if (!v) return fallback;
  if (typeof v === 'number' && v > 40000) return excelDateToISO(v) || fallback;
  if (typeof v === 'string' && v.includes(' de ')) return parseSpanishDate(v) || fallback;
  return fallback;
}

function parseSheet(ws, sheetName) {
  const ref = ws['!ref'];
  if (!ref) return { observations: [], voltage_drops: [], non_deployed: [], late_departures: [], date: null };

  const range = XLSX.utils.decode_range(ref);
  const maxRow = range.e.r;

  // --- Scan header row (row index 3 = Excel row 4) for column positions ---
  let coordsCol = -1, nonDepDateCol = -1;
  for (let c = 0; c <= 25; c++) {
    const h = cellText(ws, 3, c).toLowerCase().trim();
    if (h === 'coords' || h === 'coordenadas' || h === 'coord' || h === 'coordinates') coordsCol = c;
    else if (h === 'fecha') nonDepDateCol = c;
  }
  // Non-deployed vehicle/plate/branch follow immediately after Fecha header
  const nonDepVehicleCol = nonDepDateCol >= 0 ? nonDepDateCol + 1 : -1;
  const nonDepPlateCol   = nonDepDateCol >= 0 ? nonDepDateCol + 2 : -1;
  const nonDepBranchCol  = nonDepDateCol >= 0 ? nonDepDateCol + 3 : -1;

  // --- Sheet date: read from the first data row of the non-deployed date column ---
  let sheetDate = null;
  const dateColSearch = nonDepDateCol >= 0 ? nonDepDateCol : 9;
  for (let r = 4; r <= Math.min(maxRow, 60); r++) {
    const d = resolveDate(cellVal(ws, r, dateColSearch), null);
    if (d) { sheetDate = d; break; }
  }

  // --- Find voltage drop marker (bounds observations from below) ---
  let voltageMarkerRow = maxRow;
  let voltageDataStart = -1;
  for (let r = 3; r <= maxRow; r++) {
    const v = cellText(ws, r, 3).toUpperCase();
    if (v.includes('CAIDA DE VOLTAJE') || v.includes('CAÍDA DE VOLTAJE')) {
      voltageMarkerRow = r;
      for (let r2 = r + 1; r2 <= Math.min(r + 6, maxRow); r2++) {
        if (cellText(ws, r2, 3).toUpperCase() === 'UNIDAD') { voltageDataStart = r2 + 1; break; }
      }
      break;
    }
  }

  // --- Observations (cols B/C/D/E/F/G + optional Coords, rows 4→voltageMarker) ---
  const observations = [];
  for (let r = 4; r < voltageMarkerRow; r++) {
    const vehicleNum = cellText(ws, r, 1);
    const observation = cellText(ws, r, 4);
    if (!vehicleNum || !observation) continue;

    let latitude = null, longitude = null;
    if (coordsCol >= 0) {
      const raw = cellText(ws, r, coordsCol);
      if (raw) {
        const parts = raw.split(',').map(s => parseFloat(s.trim()));
        if (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
          latitude = parts[0]; longitude = parts[1];
        }
      }
    }

    observations.push({
      date: sheetDate, day: sheetName,
      vehicle_num: vehicleNum, plate: cellText(ws, r, 2), branch: cellText(ws, r, 3),
      observation,
      time: excelTimeToStr(cellVal(ws, r, 5)),
      duration: excelTimeToStr(cellVal(ws, r, 6)),
      latitude, longitude,
    });
  }

  // --- Voltage drops ---
  const voltage_drops = [];
  if (voltageDataStart >= 0) {
    for (let r = voltageDataStart; r <= maxRow; r++) {
      const unitRaw = cellText(ws, r, 3);
      if (!unitRaw) continue;
      voltage_drops.push({
        date: sheetDate, day: sheetName,
        unit_raw: unitRaw, ...parseUnitRaw(unitRaw),
        location: cellText(ws, r, 4),
        time: excelTimeToStr(cellVal(ws, r, 5)),
      });
    }
  }

  // --- Non-deployed (dynamic columns from header scan) ---
  const non_deployed = [];
  if (nonDepVehicleCol >= 0) {
    for (let r = 4; r <= maxRow; r++) {
      const vehicleNum = cellText(ws, r, nonDepVehicleCol);
      const plate      = cellText(ws, r, nonDepPlateCol);
      const branch     = cellText(ws, r, nonDepBranchCol);
      if (!vehicleNum || !plate || !branch) continue;
      if (vehicleNum.includes('Vehículo') || branch.includes('general') || branch.includes('Etiqueta') || branch.includes('Cuenta')) continue;
      const rowDate = resolveDate(cellVal(ws, r, nonDepDateCol), sheetDate);
      non_deployed.push({ date: rowDate, day: sheetName, vehicle_num: vehicleNum, plate, branch });
    }
  }

  // --- Late departures: find "SALIERON TARDE" marker dynamically ---
  const late_departures = [];
  let lateVehicleCol = -1, latePlateCol = -1, lateBranchCol = -1, lateDataStart = -1;
  outer: for (let r = 3; r <= Math.min(maxRow, 60); r++) {
    for (let c = 10; c <= 20; c++) {
      if (cellText(ws, r, c).toUpperCase().includes('SALIERON TARDE')) {
        for (let r2 = r + 1; r2 <= Math.min(r + 5, maxRow); r2++) {
          if (cellText(ws, r2, c).includes('Vehículo')) {
            lateDataStart = r2 + 1; lateVehicleCol = c; latePlateCol = c + 1; lateBranchCol = c + 2;
            break outer;
          }
        }
      }
    }
  }

  if (lateDataStart >= 0) {
    let empties = 0;
    for (let r = lateDataStart; r <= Math.min(lateDataStart + 60, maxRow); r++) {
      const vehicleNum = cellText(ws, r, lateVehicleCol);
      const plate      = cellText(ws, r, latePlateCol);
      if (!vehicleNum || !plate) { if (++empties >= 2) break; continue; }
      empties = 0;
      if (vehicleNum === 'No. Vehículo') continue;
      const branch = cellText(ws, r, lateBranchCol) || non_deployed.find(n => n.plate === plate)?.branch || '';
      late_departures.push({ date: sheetDate, day: sheetName, vehicle_num: vehicleNum, plate, branch });
    }
  }

  return { observations, voltage_drops, non_deployed, late_departures, date: sheetDate };
}

async function parseExcelFile(file) {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(new Uint8Array(buffer), { type: 'array' });

  const allObservations = [];
  const allVoltage = [];
  const allNonDeployed = [];
  const allLate = [];
  const dates = [];

  for (const sheetName of DAY_SHEETS) {
    if (!wb.SheetNames.includes(sheetName)) continue;
    const { observations, voltage_drops, non_deployed, late_departures, date } = parseSheet(wb.Sheets[sheetName], sheetName);
    allObservations.push(...observations);
    allVoltage.push(...voltage_drops);
    allNonDeployed.push(...non_deployed);
    allLate.push(...late_departures);
    if (date) dates.push(date);
  }

  dates.sort();
  return {
    observations: allObservations,
    voltage_drops: allVoltage,
    non_deployed: allNonDeployed,
    late_departures: allLate,
    date_from: dates[0] || null,
    date_to: dates[dates.length - 1] || null,
  };
}

function suggestLabel(filename, dateFrom, dateTo) {
  if (!dateFrom) return filename.replace(/\.(xlsm|xlsx)$/i, '');
  const fmt = (iso) => {
    const [, m, d] = iso.split('-');
    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    return `${parseInt(d)} ${months[parseInt(m) - 1]}`;
  };
  const year = dateFrom.split('-')[0];
  return `${fmt(dateFrom)} – ${fmt(dateTo)} ${year}`;
}

export default function ReportImportModal({ onImported, onClose }) {
  const [step, setStep] = useState('pick'); // pick | preview | saving
  const [file, setFile] = useState(null);
  const [parsed, setParsed] = useState(null);
  const [weekLabel, setWeekLabel] = useState('');
  const [parseError, setParseError] = useState('');
  const [parsing, setParsing] = useState(false);
  const inputRef = useRef();

  async function handleFile(f) {
    if (!f) return;
    setFile(f);
    setParseError('');
    setParsing(true);
    try {
      const result = await parseExcelFile(f);
      const label = suggestLabel(f.name, result.date_from, result.date_to);
      setWeekLabel(label);
      setParsed(result);
      setStep('preview');
    } catch (err) {
      setParseError('No se pudo leer el archivo. Asegúrate de que sea el formato correcto.');
      console.error(err);
    } finally {
      setParsing(false);
    }
  }

  async function handleSave() {
    setStep('saving');
    try {
      const report = await createReport({
        week_label: weekLabel,
        date_from: parsed.date_from,
        date_to: parsed.date_to,
        source_file: file.name,
        observations: parsed.observations,
        voltage_drops: parsed.voltage_drops,
        non_deployed: parsed.non_deployed,
        late_departures: parsed.late_departures,
      });
      onImported(report);
      onClose();
    } catch (err) {
      setParseError('Error al guardar el reporte: ' + err.message);
      setStep('preview');
    }
  }

  return (
    <div style={overlay}>
      <div style={modal}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <FileSpreadsheet size={22} color="#2563eb" />
            <h2 style={{ fontSize: 17, fontWeight: 700, color: '#1e293b' }}>Importar Reporte Semanal</h2>
          </div>
          <button onClick={onClose} style={closeBtn}><X size={18} /></button>
        </div>

        {/* Step: pick file */}
        {step === 'pick' && (
          <div>
            <div
              onClick={() => inputRef.current.click()}
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); handleFile(e.dataTransfer.files[0]); }}
              style={dropZone}
            >
              {parsing ? <Loader2 size={36} color="#2563eb" style={{ animation: 'spin 1s linear infinite' }} /> : <Upload size={36} color="#94a3b8" />}
              <p style={{ fontWeight: 600, color: '#374151', marginTop: 8 }}>
                {parsing ? 'Procesando archivo...' : 'Arrastra el archivo aquí o haz click'}
              </p>
              <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>Formatos: .xlsm, .xlsx</p>
            </div>
            <input ref={inputRef} type="file" accept=".xlsm,.xlsx" style={{ display: 'none' }} onChange={e => handleFile(e.target.files[0])} />
            {parseError && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', background: '#fef2f2', color: '#dc2626', padding: '10px 14px', borderRadius: 8, marginTop: 12, fontSize: 13 }}>
                <AlertTriangle size={15} /> {parseError}
              </div>
            )}
          </div>
        )}

        {/* Step: preview */}
        {step === 'preview' && parsed && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Label input */}
            <div>
              <label style={labelStyle}>Nombre del reporte</label>
              <input
                value={weekLabel}
                onChange={e => setWeekLabel(e.target.value)}
                style={inputStyle}
                placeholder="Ej: Semana #22 – May 25-30 2026"
              />
            </div>

            {/* Summary cards */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <SummaryCard label="Ralentís (+30 min)" count={parsed.observations.length} color="#7c3aed" />
              <SummaryCard label="Caídas de voltaje" count={parsed.voltage_drops.length} color="#dc2626" />
              <SummaryCard label="Sin salida de yarda" count={parsed.non_deployed.length} color="#d97706" />
              <SummaryCard label="Salidas tardías" count={parsed.late_departures.length} color="#2563eb" />
            </div>

            {/* Days detected */}
            <div style={{ background: '#f8fafc', borderRadius: 8, padding: '10px 14px' }}>
              <p style={{ fontSize: 12, color: '#64748b' }}>
                <strong>Archivo:</strong> {file.name}
              </p>
              <p style={{ fontSize: 12, color: '#64748b', marginTop: 3 }}>
                <strong>Período:</strong> {parsed.date_from} → {parsed.date_to}
              </p>
              <p style={{ fontSize: 12, color: '#64748b', marginTop: 3 }}>
                <strong>Días importados:</strong> {[...new Set([...parsed.voltage_drops, ...parsed.non_deployed].map(r => r.day))].join(', ') || '—'}
              </p>
            </div>

            {parseError && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', background: '#fef2f2', color: '#dc2626', padding: '10px 14px', borderRadius: 8, fontSize: 13 }}>
                <AlertTriangle size={15} /> {parseError}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
              <button onClick={() => { setStep('pick'); setParsed(null); }} style={btnSecondary}>
                Cambiar archivo
              </button>
              <button onClick={handleSave} disabled={!weekLabel.trim()} style={btnPrimary}>
                <Check size={15} /> Guardar reporte
              </button>
            </div>
          </div>
        )}

        {/* Step: saving */}
        {step === 'saving' && (
          <div style={{ textAlign: 'center', padding: '30px 0' }}>
            <Loader2 size={36} color="#2563eb" style={{ animation: 'spin 1s linear infinite', marginBottom: 12 }} />
            <p style={{ color: '#64748b' }}>Guardando reporte...</p>
          </div>
        )}
      </div>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function SummaryCard({ label, count, color }) {
  return (
    <div style={{ background: 'white', border: `1px solid ${color}30`, borderRadius: 10, padding: '12px 14px', textAlign: 'center' }}>
      <p style={{ fontSize: 26, fontWeight: 800, color }}>{count}</p>
      <p style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{label}</p>
    </div>
  );
}

const overlay = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
};
const modal = {
  background: 'white', borderRadius: 14, padding: 28, width: 500,
  maxWidth: '95vw', boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
};
const closeBtn = {
  background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8',
  display: 'flex', padding: 4, borderRadius: 6,
};
const dropZone = {
  border: '2px dashed #e2e8f0', borderRadius: 12, padding: '36px 20px',
  textAlign: 'center', cursor: 'pointer', background: '#f8fafc',
  transition: 'border-color 0.15s',
};
const labelStyle = { fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 };
const inputStyle = {
  width: '100%', padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 8,
  fontSize: 14, color: '#1e293b', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
};
const btnPrimary = {
  display: 'flex', alignItems: 'center', gap: 6,
  padding: '9px 18px', background: '#2563eb', color: 'white',
  border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600,
  cursor: 'pointer', fontFamily: 'inherit',
};
const btnSecondary = {
  padding: '9px 18px', background: 'transparent', color: '#374151',
  border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13,
  cursor: 'pointer', fontFamily: 'inherit',
};
