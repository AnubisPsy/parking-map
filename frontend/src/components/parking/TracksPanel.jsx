import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, Trash2 } from 'lucide-react';
import { NEUTRAL } from '../../lib/colors';
import { formatDateTimeShort, formatTime } from '../../lib/format';

// Selector de qué recorridos GPS se trazan en el mapa
export default function TracksPanel({ tracks, selectedCount, isSelected, unitColors, onToggle, onSetAll, onDelete }) {
  // En móvil arranca cerrado para dejar espacio a la lista de registros
  const [open, setOpen] = useState(() => !window.matchMedia('(max-width: 820px)').matches);

  return (
    <div className="sidebar-section">
      <div className="row-between">
        <button onClick={() => setOpen((o) => !o)} aria-expanded={open} className="row" style={{ flex: 1, minHeight: 24, borderRadius: 4 }}>
          <span className="section-label">Recorridos</span>
          <span className="badge">{selectedCount}/{tracks.length}</span>
          <ChevronDown size={14} color="var(--ink-3)" style={{ transform: open ? 'rotate(180deg)' : undefined, transition: 'transform 0.15s' }} />
        </button>
        <div className="row" style={{ gap: 2 }}>
          {open && tracks.length > 0 && (
            <>
              <button onClick={() => onSetAll(true)} className="link-btn">Todos</button>
              <button onClick={() => onSetAll(false)} className="link-btn">Ninguno</button>
            </>
          )}
          <Link to="/recorridos" className="link-btn" style={{ display: 'inline-flex', alignItems: 'center' }}>Paradas</Link>
        </div>
      </div>

      {open && (
        <div className="track-list">
          {tracks.length === 0 && <p className="small muted">Sin recorridos en el rango de fechas</p>}
          {tracks.map((t) => (
            <div key={t.id} className="track-row">
              <label>
                <input type="checkbox" checked={isSelected(t.id)} onChange={() => onToggle(t.id)} />
                <span className="dot dot-sm" style={{ background: unitColors[t.unit_id] || NEUTRAL }} />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontWeight: 600 }}>{t.unit_id}</span>
                  {t.unit_name && <span className="muted"> · {t.unit_name}</span>}
                  <span className="muted truncate" style={{ display: 'block' }}>
                    {formatDateTimeShort(t.start)} → {formatTime(t.end)} · {t.points.length} puntos
                  </span>
                </span>
              </label>
              <button
                onClick={() => onDelete(t)}
                className="icon-btn icon-btn-danger"
                aria-label={`Eliminar recorrido de ${t.unit_id}`}
                title="Eliminar recorrido"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
