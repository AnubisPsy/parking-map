import { CalendarDays, LayoutGrid, X } from 'lucide-react';
import { GROUP_OPTIONS } from '../../lib/parkingGroups';
import { plural } from '../../lib/format';

export function GroupPicker({ groupBy, onChange, action }) {
  return (
    <div style={{ padding: '10px 14px 8px', borderBottom: '1px solid #e2e8f0', flexShrink: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <LayoutGrid size={13} color="#64748b" />
          <span id="group-picker-label" style={sectionTitle}>Agrupar por</span>
        </div>
        {action}
      </div>
      <div role="group" aria-labelledby="group-picker-label" style={{ display: 'flex', gap: 4 }}>
        {GROUP_OPTIONS.map((opt) => (
          <button
            key={opt.id}
            onClick={() => onChange(opt.id)}
            aria-pressed={groupBy === opt.id}
            style={groupBy === opt.id ? pillActive : pill}
          >
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
    <div style={{ padding: '8px 16px 10px', borderBottom: '1px solid #e2e8f0', flexShrink: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <CalendarDays size={14} color="#64748b" style={{ flexShrink: 0 }} />
        <input
          type="date"
          value={from}
          max={to || undefined}
          onChange={(e) => onFromChange(e.target.value)}
          style={dateInput}
          aria-label="Fecha desde"
        />
        <span aria-hidden="true" style={{ fontSize: 12, color: '#64748b', flexShrink: 0 }}>—</span>
        <input
          type="date"
          value={to}
          min={from || undefined}
          onChange={(e) => onToChange(e.target.value)}
          style={dateInput}
          aria-label="Fecha hasta"
        />
        {active && (
          <button
            onClick={() => { onFromChange(''); onToChange(''); }}
            style={clearBtn}
            aria-label="Quitar filtro de fechas"
            title="Quitar filtro de fechas"
          >
            <X size={14} />
          </button>
        )}
      </div>
      {active && (
        <p role="status" style={{ fontSize: 11, color: '#1d4ed8', marginTop: 5, fontWeight: 600 }}>
          {resultCount} {plural(resultCount, 'registro')} en el rango
        </p>
      )}
    </div>
  );
}

export const sectionTitle = {
  fontSize: 11, fontWeight: 700, color: '#374151',
  textTransform: 'uppercase', letterSpacing: '0.05em',
};
const pill = {
  flex: 1, padding: '5px 4px', background: '#f1f5f9', border: '1px solid #e2e8f0',
  borderRadius: 6, cursor: 'pointer', fontSize: 11, color: '#475569',
  fontWeight: 500, whiteSpace: 'nowrap',
};
const pillActive = {
  ...pill, background: '#eff6ff', border: '1px solid #2563eb', color: '#1d4ed8', fontWeight: 700,
};
const dateInput = {
  flex: 1, minWidth: 0, padding: '4px 7px', border: '1px solid #cbd5e1', borderRadius: 6,
  fontSize: 12, color: '#374151', cursor: 'pointer',
};
const clearBtn = {
  background: 'none', border: 'none', cursor: 'pointer', color: '#64748b',
  display: 'flex', padding: 2, flexShrink: 0, borderRadius: 4,
};
