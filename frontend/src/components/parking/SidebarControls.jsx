import { X } from 'lucide-react';
import { GROUP_OPTIONS } from '../../lib/parkingGroups';
import { plural } from '../../lib/format';

// `locked`: solo muestra la agrupación (el mapa compartido conserva la del enlace)
export function GroupPicker({ groupBy, onChange, locked = false }) {
  if (locked) {
    return (
      <p className="group-locked">
        <span className="muted">Agrupado por</span> {GROUP_OPTIONS.find((opt) => opt.id === groupBy)?.label ?? 'Unidad'}
      </p>
    );
  }
  return (
    <div className="field" style={{ gap: 4 }}>
      <span id="group-picker-label" className="section-label">Agrupar por</span>
      <div className="segmented" role="group" aria-labelledby="group-picker-label">
        {GROUP_OPTIONS.map((opt) => (
          <button key={opt.id} onClick={() => onChange(opt.id)} aria-pressed={groupBy === opt.id}>
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function DateRangeFilter({ from, to, onFromChange, onToChange, resultCount }) {
  const active = from || to;
  return (
    <div className="field" style={{ gap: 4 }}>
      <span className="section-label">Fechas</span>
      <div className="date-range">
        <input
          type="date"
          className="input input-sm"
          value={from}
          max={to || undefined}
          onChange={(e) => onFromChange(e.target.value)}
          aria-label="Fecha desde"
        />
        <span aria-hidden="true" className="muted">–</span>
        <input
          type="date"
          className="input input-sm"
          value={to}
          min={from || undefined}
          onChange={(e) => onToChange(e.target.value)}
          aria-label="Fecha hasta"
        />
        {active && (
          <button
            onClick={() => { onFromChange(''); onToChange(''); }}
            className="icon-btn"
            aria-label="Quitar filtro de fechas"
            title="Quitar filtro de fechas"
          >
            <X size={15} />
          </button>
        )}
      </div>
      {active && (
        <p role="status" className="small muted">
          {resultCount} {plural(resultCount, 'registro')} en el rango
        </p>
      )}
    </div>
  );
}
