import { useEffect, useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { fetchShareData } from '../api';
import MapView from '../components/MapView';
import { buildUnitColors } from '../components/ParkingList';
import { Map, MapPin, Loader2, Clock, Search, AlertTriangle, CalendarDays, X, ChevronDown } from 'lucide-react';

function formatDuration(minutes) {
  if (!minutes) return '—';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}min`;
}

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-MX', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

export default function SharedMap() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [status, setStatus] = useState('loading'); // loading | ok | expired | notfound | error
  const [filterUnit, setFilterUnit] = useState('all');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [highlightId, setHighlightId] = useState(null);
  const [expandedUnits, setExpandedUnits] = useState(new Set());

  useEffect(() => { setFilterDateFrom(''); setFilterDateTo(''); }, [filterUnit]);

  const toggleUnit = (unitId) => {
    setExpandedUnits(prev => {
      const next = new Set(prev);
      if (next.has(unitId)) {
        next.delete(unitId);
        setFilterUnit('all');
        setHighlightId(null);
      } else {
        next.add(unitId);
        setFilterUnit(unitId);
        setHighlightId(null);
      }
      return next;
    });
  };

  const handleAllUnits = () => {
    setFilterUnit('all');
    setExpandedUnits(new Set());
    setHighlightId(null);
  };

  useEffect(() => {
    fetchShareData(token)
      .then(d => { setData(d); setStatus('ok'); })
      .catch(err => {
        if (err.message.includes('expirado')) setStatus('expired');
        else if (err.message.includes('encontrado')) setStatus('notfound');
        else setStatus('error');
      });
  }, [token]);

  const unitColors = useMemo(() => data ? buildUnitColors(data.parkings) : {}, [data]);

  const parkingsForUnit = (unitId) => {
    const base = data.parkings.filter(p => p.unit_id === unitId);
    if (!filterDateFrom && !filterDateTo) return base;
    return base.filter(p => {
      const key = dateKey(p);
      if (!key) return true;
      if (filterDateFrom && key < filterDateFrom) return false;
      if (filterDateTo && key > filterDateTo) return false;
      return true;
    });
  };

  const units = useMemo(() => {
    if (!data) return [];
    const map = {};
    data.parkings.forEach(p => {
      if (!map[p.unit_id]) map[p.unit_id] = { id: p.unit_id, name: p.unit_name, count: 0 };
      map[p.unit_id].count++;
    });
    return Object.values(map);
  }, [data]);

  const unitFilteredParkings = useMemo(() => {
    if (!data) return [];
    return filterUnit === 'all' ? data.parkings : data.parkings.filter(p => p.unit_id === filterUnit);
  }, [data, filterUnit]);

  const visibleParkings = useMemo(() => {
    if (!filterDateFrom && !filterDateTo) return unitFilteredParkings;
    return unitFilteredParkings.filter(p => {
      const key = dateKey(p);
      if (!key) return true;
      if (filterDateFrom && key < filterDateFrom) return false;
      if (filterDateTo && key > filterDateTo) return false;
      return true;
    });
  }, [unitFilteredParkings, filterDateFrom, filterDateTo]);

  if (status === 'loading') return <FullMessage Icon={Loader2} title="Cargando mapa..." />;
  if (status === 'expired') return <FullMessage Icon={Clock} title="Enlace expirado" desc="Este enlace ya no es válido. Solicita uno nuevo." />;
  if (status === 'notfound') return <FullMessage Icon={Search} title="Enlace no encontrado" desc="El enlace no existe o fue eliminado." />;
  if (status === 'error') return <FullMessage Icon={AlertTriangle} title="Error al cargar" desc="No se pudo conectar al servidor." />;

  const expiry = formatDate(data.expires_at);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      {/* Header */}
      <header style={headerStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Map size={24} color="white" />
          <div>
            <h1 style={{ fontSize: 17, fontWeight: 800, color: 'white' }}>Mapa Compartido</h1>
            <p style={{ fontSize: 12, color: '#93c5fd' }}>
              {data.parkings.length} registro{data.parkings.length !== 1 ? 's' : ''} · Expira: {expiry}
            </p>
          </div>
        </div>
        <div style={{ fontSize: 12, color: '#bfdbfe', background: 'rgba(255,255,255,0.1)', padding: '6px 12px', borderRadius: 8 }}>
          Vista de solo lectura
        </div>
      </header>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Sidebar */}
        <aside style={sidebar}>
          {/* Header label */}
          <div style={{ padding: '12px 16px 8px', borderBottom: '1px solid #e2e8f0', flexShrink: 0 }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Filtrar por unidad
            </p>
          </div>

          {/* Date range filter */}
          {data.parkings.length > 0 && (
            <div style={{ padding: '8px 16px 10px', borderBottom: '1px solid #e2e8f0', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <CalendarDays size={14} color="#94a3b8" style={{ flexShrink: 0 }} />
                <input
                  type="date"
                  value={filterDateFrom}
                  max={filterDateTo || undefined}
                  onChange={e => setFilterDateFrom(e.target.value)}
                  style={dateInputStyle}
                  title="Desde"
                />
                <span style={{ fontSize: 12, color: '#94a3b8', flexShrink: 0 }}>—</span>
                <input
                  type="date"
                  value={filterDateTo}
                  min={filterDateFrom || undefined}
                  onChange={e => setFilterDateTo(e.target.value)}
                  style={dateInputStyle}
                  title="Hasta"
                />
                {(filterDateFrom || filterDateTo) && (
                  <button
                    onClick={() => { setFilterDateFrom(''); setFilterDateTo(''); }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', display: 'flex', padding: 2, flexShrink: 0, borderRadius: 4 }}
                    title="Quitar filtro"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
              {(filterDateFrom || filterDateTo) && (
                <p style={{ fontSize: 11, color: '#2563eb', marginTop: 5, fontWeight: 600 }}>
                  {visibleParkings.length} registro{visibleParkings.length !== 1 ? 's' : ''} en el rango
                </p>
              )}
            </div>
          )}

          {/* Scrollable accordion list */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {/* All units button */}
            <button
              style={filterUnit === 'all' ? unitBtnActive('#2563eb') : unitBtn}
              onClick={handleAllUnits}
            >
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#2563eb', flexShrink: 0 }} />
              <span style={{ flex: 1, textAlign: 'left' }}>Todas las unidades</span>
              <span style={badge}>{data.parkings.length}</span>
            </button>

            {/* Unit accordion items */}
            {units.map(u => {
              const color = unitColors[u.id];
              const isExpanded = expandedUnits.has(u.id);
              const isActive = filterUnit === u.id;
              const unitParkings = parkingsForUnit(u.id);

              return (
                <div key={u.id} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {/* Unit header button */}
                  <button
                    style={isActive ? unitBtnActive(color) : unitBtn}
                    onClick={() => toggleUnit(u.id)}
                  >
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: color, flexShrink: 0 }} />
                    <span style={{ flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {u.name || u.id}
                      {u.name && <span style={{ color: isActive ? color : '#94a3b8', fontSize: 11, marginLeft: 4 }}>({u.id})</span>}
                    </span>
                    <span style={badge}>{u.count}</span>
                    <ChevronDown
                      size={14}
                      style={{
                        flexShrink: 0,
                        transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                        transition: 'transform 0.2s ease',
                        color: isActive ? color : '#94a3b8',
                        marginLeft: 4
                      }}
                    />
                  </button>

                  {/* Expanded parkings */}
                  {isExpanded && (
                    <div style={{ paddingLeft: 14, display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {unitParkings.length === 0 && (
                        <p style={{ fontSize: 11, color: '#94a3b8', padding: '6px 10px' }}>Sin registros en el rango</p>
                      )}
                      {unitParkings.map((p, idx) => {
                        const isHighlighted = highlightId === p.id;
                        return (
                          <div
                            key={p.id}
                            onClick={() => setHighlightId(prev => prev === p.id ? null : p.id)}
                            style={{
                              background: isHighlighted ? '#eff6ff' : '#f8fafc',
                              border: `1px solid ${isHighlighted ? '#2563eb' : '#e2e8f0'}`,
                              borderLeft: `3px solid ${color}`,
                              borderRadius: 8,
                              padding: '8px 10px',
                              cursor: 'pointer',
                              transition: 'all 0.15s',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                              <span style={{ fontSize: 11, fontWeight: 700, color: isHighlighted ? '#2563eb' : '#1e293b' }}>
                                #{idx + 1}
                              </span>
                              <span style={{ fontSize: 11, fontWeight: 600, color: isHighlighted ? '#2563eb' : '#374151' }}>
                                {formatDuration(p.parking_duration)}
                              </span>
                              {isHighlighted && (
                                <span style={{ marginLeft: 'auto', fontSize: 10, color: '#2563eb', fontWeight: 700 }}>● en mapa</span>
                              )}
                            </div>
                            <p style={{ fontSize: 11, color: '#64748b', marginBottom: 2 }}>
                              {formatDate(p.parking_start)}
                            </p>
                            {p.address && (
                              <p style={{ fontSize: 10, color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 2 }}>
                                <MapPin size={9} /> {p.address}
                              </p>
                            )}
                            {p.notes && (
                              <p style={{ fontSize: 10, color: '#94a3b8', marginTop: 2, fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                "{p.notes}"
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </aside>

        {/* Map */}
        <main style={{ flex: 1 }}>
          <MapView
            parkings={visibleParkings}
            unitColors={unitColors}
            highlightId={highlightId}
            onMarkerClick={(id) => setHighlightId(prev => prev === id ? null : id)}
          />
        </main>
      </div>
    </div>
  );
}

function FullMessage({ Icon, title, desc }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', flexDirection: 'column', gap: 12 }}>
      <Icon size={56} color="#94a3b8" />
      <h2 style={{ fontSize: 22, fontWeight: 700 }}>{title}</h2>
      {desc && <p style={{ color: '#64748b', fontSize: 15 }}>{desc}</p>}
    </div>
  );
}

function dateKey(p) {
  const d = p.parking_start || p.created_at;
  if (!d) return null;
  return new Date(d).toISOString().slice(0, 10);
}

const headerStyle = {
  background: 'linear-gradient(135deg, #1d4ed8 0%, #2563eb 100%)',
  padding: '12px 20px',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  boxShadow: '0 2px 12px rgba(37,99,235,0.4)',
  zIndex: 10,
  flexShrink: 0
};
const sidebar = {
  width: 320,
  background: 'white',
  borderRight: '1px solid #e2e8f0',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  flexShrink: 0
};
const unitBtn = {
  display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
  background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8,
  cursor: 'pointer', fontSize: 13, fontFamily: 'inherit', width: '100%',
  color: '#374151'
};
const unitBtnActive = (color) => ({
  ...unitBtn,
  background: color + '18',
  border: `1px solid ${color}`,
  color,
  fontWeight: 700
});
const badge = {
  background: '#e2e8f0', color: '#475569', fontSize: 11, fontWeight: 700,
  padding: '1px 7px', borderRadius: 20, flexShrink: 0
};
const dateInputStyle = {
  flex: 1, minWidth: 0, padding: '4px 7px', border: '1px solid #e2e8f0',
  borderRadius: 6, fontSize: 12, color: '#374151', outline: 'none',
  fontFamily: 'inherit', cursor: 'pointer',
};
