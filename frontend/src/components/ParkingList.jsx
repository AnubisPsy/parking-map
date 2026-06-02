import { deleteParking } from '../api';
import { MapPin, Clock, Calendar, Trash2 } from 'lucide-react';
import { useConfirm } from './ConfirmModal';

const COLORS = [
  '#2563eb', '#dc2626', '#16a34a', '#d97706', '#7c3aed',
  '#0891b2', '#be185d', '#15803d', '#b45309', '#4338ca',
];

export function getUnitColor(unitId, unitColors) {
  return unitColors[unitId] || '#64748b';
}

export function buildUnitColors(parkings) {
  const ids = [...new Set(parkings.map(p => p.unit_id))];
  const map = {};
  ids.forEach((id, i) => { map[id] = COLORS[i % COLORS.length]; });
  return map;
}

function formatDuration(minutes) {
  if (!minutes) return null;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}min`;
}

function formatDate(iso) {
  if (!iso) return null;
  return new Date(iso).toLocaleString('es-MX', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

export default function ParkingList({ parkings, unitColors, highlightId, onSelect, onDeleted }) {
  const { confirm, dialog } = useConfirm();

  async function handleDelete(e, id) {
    e.stopPropagation();
    const ok = await confirm({
      title: '¿Eliminar este registro?',
      message: 'Esta acción no se puede deshacer.',
    });
    if (!ok) return;
    try {
      await deleteParking(id);
      onDeleted(id);
    } catch (err) {
      console.error(err);
    }
  }

  if (parkings.length === 0) {
    return (
      <>
        <div style={{ textAlign: 'center', padding: '40px 20px', color: '#94a3b8' }}>
          <MapPin size={38} style={{ marginBottom: 12 }} />
          <p style={{ fontWeight: 600, marginBottom: 4 }}>Sin registros aún</p>
          <p style={{ fontSize: 13 }}>Agrega el primer registro con el botón de arriba</p>
        </div>
        {dialog}
      </>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {parkings.map(p => {
        const color = unitColors[p.unit_id] || '#64748b';
        const isActive = highlightId === p.id;
        const duration = formatDuration(p.parking_duration);
        const start = formatDate(p.parking_start);

        return (
          <div
            key={p.id}
            onClick={() => onSelect(p.id)}
            style={{
              background: isActive ? '#eff6ff' : 'white',
              border: `1px solid ${isActive ? '#2563eb' : '#e2e8f0'}`,
              borderLeft: `4px solid ${color}`,
              borderRadius: 10,
              padding: '12px 14px',
              cursor: 'pointer',
              transition: 'all 0.15s',
              boxShadow: isActive ? '0 2px 12px rgba(37,99,235,0.12)' : '0 1px 3px rgba(0,0,0,0.05)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{
                    background: color, color: 'white', fontSize: 11, fontWeight: 700,
                    padding: '2px 8px', borderRadius: 20
                  }}>
                    {p.unit_id}
                  </span>
                  {p.unit_name && (
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {p.unit_name}
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px' }}>
                  {duration && (
                    <span style={metaTag}>
                      <Clock size={12} style={{ opacity: 0.6 }} /> {duration}
                    </span>
                  )}
                  {start && (
                    <span style={metaTag}>
                      <Calendar size={12} style={{ opacity: 0.6 }} /> {start}
                    </span>
                  )}
                  <span style={metaTag}>
                    <MapPin size={12} style={{ opacity: 0.6 }} /> {p.latitude.toFixed(4)}, {p.longitude.toFixed(4)}
                  </span>
                </div>

                {p.address && (
                  <p style={{ fontSize: 12, color: '#64748b', marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {p.address}
                  </p>
                )}
              </div>

              <button
                onClick={(e) => handleDelete(e, p.id)}
                style={{
                  background: 'none', border: 'none', color: '#94a3b8',
                  cursor: 'pointer', padding: '2px 4px',
                  borderRadius: 4, flexShrink: 0, display: 'flex', alignItems: 'center'
                }}
                title="Eliminar"
              >
                <Trash2 size={15} />
              </button>
            </div>
          </div>
        );
      })}
      {dialog}
    </div>
  );
}

const metaTag = { fontSize: 12, color: '#475569', display: 'flex', alignItems: 'center', gap: 3 };
