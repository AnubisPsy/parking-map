import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, Trash2 } from 'lucide-react';
import { NEUTRAL } from '../../lib/colors';
import { formatDateTimeShort, formatTime } from '../../lib/format';
import { dayLabel, localDateKey } from '../../lib/parkingGroups';

const shortDay = (day) =>
  new Date(day + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });

// Qué parte de la ruta se está viendo, en palabras
function viewLabel(view) {
  if (!view) return null;
  if (view.day) return `Ruta del ${dayLabel(view.day).toLowerCase()}`;
  if (view.from && view.to) return view.from === view.to ? `Ruta del ${dayLabel(view.from).toLowerCase()}` : `Ruta del ${shortDay(view.from)} al ${shortDay(view.to)}`;
  if (view.from) return `Ruta desde el ${shortDay(view.from)}`;
  if (view.to) return `Ruta hasta el ${shortDay(view.to)}`;
  return null;
}

// Selector de qué recorridos GPS se trazan en el mapa
// `onDelete` es opcional (el mapa compartido es de solo lectura); `stopsTo`: a dónde lleva "Paradas"
export default function TracksPanel({ tracks, view, onGroupByDate, selectedCount, isSelected, unitColors, onToggle, onSetAll, onDelete, stopsTo = '/recorridos' }) {
  // En móvil arranca cerrado para dejar espacio a la lista de registros
  const [open, setOpen] = useState(() => !window.matchMedia('(max-width: 820px)').matches);
  const label = viewLabel(view);
  const multiDay = !label && tracks.some((t) => localDateKey(t.start) !== localDateKey(t.end));

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
          <Link to={stopsTo} className="link-btn" style={{ display: 'inline-flex', alignItems: 'center' }}>Paradas</Link>
        </div>
      </div>

      {open && (
        <div className="track-list">
          {label && <p className="track-view" role="status">{label}</p>}
          {multiDay && (
            <p className="small muted">
              Para ver un solo día, ábrelo en la lista
              {onGroupByDate ? <> (<button onClick={onGroupByDate} className="link-btn link-inline">agrupar por fecha</button>)</> : null}
              {' '}o elige fechas arriba.
            </p>
          )}
          {tracks.length === 0 && <p className="small muted">Sin recorridos en {label ? 'esos días' : 'el rango de fechas'}</p>}
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
              {onDelete && (
              <button
                onClick={() => onDelete(t)}
                className="icon-btn icon-btn-danger"
                aria-label={`Eliminar recorrido de ${t.unit_id}`}
                title="Eliminar recorrido"
              >
                <Trash2 size={14} />
              </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
