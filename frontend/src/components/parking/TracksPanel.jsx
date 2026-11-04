import { useState } from 'react';
import { ChevronDown, Route, Trash2 } from 'lucide-react';
import { NEUTRAL } from '../../lib/colors';
import { formatDateTimeShort, formatTime } from '../../lib/format';
import { sectionTitle } from './SidebarControls';

// Selector de qué recorridos GPS se trazan en el mapa
export default function TracksPanel({ tracks, selectedCount, isSelected, unitColors, onToggle, onSetAll, onDelete }) {
  const [open, setOpen] = useState(true);

  return (
    <div style={{ padding: '8px 12px 10px', borderBottom: '1px solid #e2e8f0', flexShrink: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <button onClick={() => setOpen((o) => !o)} aria-expanded={open} style={headerBtn}>
          <Route size={13} color="#64748b" />
          <span style={sectionTitle}>Recorridos</span>
          <span style={badge}>{selectedCount}/{tracks.length}</span>
          <ChevronDown
            size={13}
            color="#64748b"
            style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}
          />
        </button>
        {open && tracks.length > 0 && (
          <>
            <button onClick={() => onSetAll(true)} style={linkBtn}>Todos</button>
            <button onClick={() => onSetAll(false)} style={linkBtn}>Ninguno</button>
          </>
        )}
      </div>

      {open && (
        <div style={{ marginTop: 6, maxHeight: 180, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 3 }}>
          {tracks.length === 0 && (
            <p style={{ fontSize: 11, color: '#475569', padding: '4px 2px' }}>
              Sin recorridos en el rango de fechas
            </p>
          )}
          {tracks.map((t) => {
            const checked = isSelected(t.id);
            const color = unitColors[t.unit_id] || NEUTRAL;
            return (
              <div
                key={t.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 4, padding: '5px 8px', borderRadius: 6,
                  background: checked ? `${color}12` : '#f8fafc',
                  border: `1px solid ${checked ? `${color}60` : '#e2e8f0'}`,
                }}
              >
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0, cursor: 'pointer', fontSize: 12 }}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => onToggle(t.id)}
                    style={{ accentColor: color, cursor: 'pointer', margin: 0 }}
                  />
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ fontWeight: 700, color: '#1e293b' }}>{t.unit_id}</span>
                    {t.unit_name && <span style={{ color: '#475569' }}> · {t.unit_name}</span>}
                    <span style={{ display: 'block', fontSize: 10, color: '#475569' }}>
                      {formatDateTimeShort(t.start)} → {formatTime(t.end)} · {t.points.length} pts
                    </span>
                  </span>
                </label>
                <button
                  onClick={() => onDelete(t)}
                  style={deleteBtn}
                  aria-label={`Eliminar recorrido de ${t.unit_id}`}
                  title="Eliminar recorrido"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const headerBtn = {
  display: 'flex', alignItems: 'center', gap: 6, flex: 1,
  background: 'none', border: 'none', cursor: 'pointer', padding: '2px 0',
};
const badge = {
  background: '#e2e8f0', color: '#334155', fontSize: 11, fontWeight: 700,
  padding: '1px 7px', borderRadius: 20, flexShrink: 0,
};
const linkBtn = {
  background: 'none', border: 'none', cursor: 'pointer', color: '#1d4ed8',
  fontSize: 11, fontWeight: 600, padding: '2px 4px', minHeight: 24, minWidth: 24,
};
const deleteBtn = {
  background: 'none', border: 'none', cursor: 'pointer', color: '#64748b',
  width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center',
  flexShrink: 0, borderRadius: 4,
};
