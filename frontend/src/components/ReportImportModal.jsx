import { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { Check, AlertTriangle, Loader2 } from 'lucide-react';
import DropZone from './ui/DropZone';
import { useCreateReport } from '../api/queries';
import Modal from './ui/Modal';

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

export default function ReportImportModal({ onClose }) {
  const [step, setStep] = useState('pick'); // pick | preview | saving
  const [file, setFile] = useState(null);
  const [parsed, setParsed] = useState(null);
  const [weekLabel, setWeekLabel] = useState('');
  const [parseError, setParseError] = useState('');
  const [parsing, setParsing] = useState(false);
  const createReport = useCreateReport();
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
    } finally {
      setParsing(false);
    }
  }

  async function handleSave() {
    setStep('saving');
    try {
      await createReport.mutateAsync({
        week_label: weekLabel,
        date_from: parsed.date_from,
        date_to: parsed.date_to,
        source_file: file.name,
        observations: parsed.observations,
        voltage_drops: parsed.voltage_drops,
        non_deployed: parsed.non_deployed,
        late_departures: parsed.late_departures,
      });
      onClose();
    } catch (err) {
      setParseError('Error al guardar el reporte: ' + err.message);
      setStep('preview');
    }
  }

  return (
    <Modal
      title="Importar reporte semanal"
      description="Desde el archivo Excel semanal."
      onClose={step === 'saving' ? () => {} : onClose}
      footer={step === 'preview' && parsed ? (
        <>
          <button onClick={() => { setStep('pick'); setParsed(null); }} className="btn btn-secondary">
            Cambiar archivo
          </button>
          <button onClick={handleSave} disabled={!weekLabel.trim()} className="btn btn-primary">
            <Check size={15} /> Guardar reporte
          </button>
        </>
      ) : null}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".xlsm,.xlsx"
        className="sr-only"
        tabIndex={-1}
        aria-label="Archivo Excel"
        onChange={e => handleFile(e.target.files[0])}
      />

      {step === 'pick' && (
        <div className="stack" style={{ gap: 12 }}>
          <DropZone
            hint="Formatos: .xlsm, .xlsx"
            busy={parsing}
            onPick={() => inputRef.current.click()}
            onDropFiles={(files) => handleFile(files[0])}
          />
          {parseError && <div role="alert" className="notice notice-error"><AlertTriangle size={15} /> {parseError}</div>}
        </div>
      )}

      {step === 'preview' && parsed && (
        <div className="stack">
          <label className="field">
            <span className="field-label">Nombre del reporte</span>
            <input className="input" value={weekLabel} onChange={e => setWeekLabel(e.target.value)} placeholder="Semana 22 · 25–30 may 2026" data-autofocus />
          </label>

          <div className="grid-auto" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <SummaryCard label="Ralentís (+30 min)" count={parsed.observations.length} />
            <SummaryCard label="Caídas de voltaje" count={parsed.voltage_drops.length} />
            <SummaryCard label="Sin salida de yarda" count={parsed.non_deployed.length} />
            <SummaryCard label="Salidas tardías" count={parsed.late_departures.length} />
          </div>

          <dl className="definition-list">
            <dt>Archivo</dt><dd>{file.name}</dd>
            <dt>Período</dt><dd>{parsed.date_from} → {parsed.date_to}</dd>
            <dt>Días</dt><dd>{[...new Set([...parsed.voltage_drops, ...parsed.non_deployed].map(r => r.day))].join(', ') || '—'}</dd>
          </dl>

          {parseError && <div role="alert" className="notice notice-error"><AlertTriangle size={15} /> {parseError}</div>}
        </div>
      )}

      {step === 'saving' && (
        <div role="status" style={{ textAlign: 'center', padding: '30px 0' }}>
          <Loader2 size={28} color="var(--accent)" className="spin" style={{ marginBottom: 10 }} />
          <p className="muted">Guardando reporte…</p>
        </div>
      )}
    </Modal>
  );
}

function SummaryCard({ label, count }) {
  return (
    <div className="card stat" style={{ padding: '10px 12px' }}>
      <p className="stat-label">{label}</p>
      <p className="stat-value" style={{ fontSize: 20 }}>{count}</p>
    </div>
  );
}
