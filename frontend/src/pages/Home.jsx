import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchParkings, deleteParkingsByUnit, deleteAllParkings, deleteParking } from '../api';
import MapView from '../components/MapView';
import ParkingForm from '../components/ParkingForm';
import { buildUnitColors } from '../components/ParkingList';
import ShareLinkModal from '../components/ShareLinkModal';
import ImportModal from '../components/ImportModal';
import SharesListModal from '../components/SharesListModal';
import { Link2, Upload, Plus, ParkingSquare, Trash2, List, CalendarDays, X, ChevronDown, MapPin, BarChart2, Info } from 'lucide-react';
import { useConfirm } from '../components/ConfirmModal';

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

export default function Home() {
  const navigate = useNavigate();
  const [parkings, setParkings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showSharesList, setShowSharesList] = useState(false);
  const { confirm, dialog } = useConfirm();
  const [highlightId, setHighlightId] = useState(null);
  const [filterUnit, setFilterUnit] = useState('all');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [expandedUnits, setExpandedUnits] = useState(new Set());
  const [tooltipParking, setTooltipParking] = useState(null);
  const [tooltipPos, setTooltipPos] = useState(0);

  useEffect(() => {
    fetchParkings()
      .then(setParkings)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const unitColors = useMemo(() => buildUnitColors(parkings), [parkings]);

  const units = useMemo(() => {
    const map = {};
    parkings.forEach(p => {
      if (!map[p.unit_id]) map[p.unit_id] = { id: p.unit_id, name: p.unit_name, count: 0 };
      map[p.unit_id].count++;
    });
    return Object.values(map);
  }, [parkings]);

  useEffect(() => { setFilterDateFrom(''); setFilterDateTo(''); }, [filterUnit]);

  const unitFilteredParkings = useMemo(() =>
    filterUnit === 'all' ? parkings : parkings.filter(p => p.unit_id === filterUnit),
    [parkings, filterUnit]
  );

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

  const parkingsForUnit = (unitId) => {
    const base = parkings.filter(p => p.unit_id === unitId);
    if (!filterDateFrom && !filterDateTo) return base;
    return base.filter(p => {
      const key = dateKey(p);
      if (!key) return true;
      if (filterDateFrom && key < filterDateFrom) return false;
      if (filterDateTo && key > filterDateTo) return false;
      return true;
    });
  };

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

  function handleCreated(parking) {
    setParkings(prev => [parking, ...prev]);
    setHighlightId(parking.id);
  }

  function handleImported(newParkings) {
    setParkings(prev => [...newParkings, ...prev]);
    if (newParkings.length > 0) setHighlightId(newParkings[0].id);
  }

  async function handleDeleteUnit(unitId, unitCount) {
    const ok = await confirm({
      title: `¿Eliminar la unidad "${unitId}"?`,
      message: `Se eliminarán los ${unitCount} registro${unitCount !== 1 ? 's' : ''} de esta unidad. Esta acción no se puede deshacer.`,
    });
    if (!ok) return;
    try {
      await deleteParkingsByUnit(unitId);
      setParkings(prev => prev.filter(p => p.unit_id !== unitId));
      setExpandedUnits(prev => { const next = new Set(prev); next.delete(unitId); return next; });
      if (filterUnit === unitId) setFilterUnit('all');
      if (highlightId) setHighlightId(null);
    } catch (err) {
      console.error(err);
    }
  }

  async function handleDeleteAll() {
    const ok = await confirm({
      title: '¿Eliminar todos los registros?',
      message: `Se eliminarán los ${parkings.length} registro${parkings.length !== 1 ? 's' : ''} de todas las unidades. Esta acción no se puede deshacer.`,
    });
    if (!ok) return;
    try {
      await deleteAllParkings();
      setParkings([]);
      setFilterUnit('all');
      setExpandedUnits(new Set());
      setHighlightId(null);
    } catch (err) {
      console.error(err);
    }
  }

  async function handleDeleteOne(e, id) {
    e.stopPropagation();
    const ok = await confirm({
      title: '¿Eliminar este registro?',
      message: 'Esta acción no se puede deshacer.',
    });
    if (!ok) return;
    try {
      await deleteParking(id);
      setParkings(prev => prev.filter(p => p.id !== id));
      if (highlightId === id) setHighlightId(null);
    } catch (err) {
      console.error(err);
    }
  }

  function handleSelect(id) {
    setHighlightId(prev => prev === id ? null : id);
  }

  function handleInfoEnter(e, p, color) {
    const rect = e.currentTarget.getBoundingClientRect();
    const top = Math.max(8, Math.min(rect.top, window.innerHeight - 280));
    setTooltipParking({ ...p, _color: color });
    setTooltipPos(top);
  }

  function handleInfoLeave() {
    setTooltipParking(null);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      {/* Header */}
      <header style={headerStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <ParkingSquare size={26} color="white" />
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 800, color: 'white' }}>Parking Map</h1>
            <p style={{ fontSize: 12, color: '#93c5fd' }}>
              {parkings.length} registro{parkings.length !== 1 ? 's' : ''}
              {' · '}
              {units.length} unidad{units.length !== 1 ? 'es' : ''}
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setShowShare(true)} style={{ ...btnOutline, display: 'flex', alignItems: 'center', gap: 6 }} disabled={parkings.length === 0}>
            <Link2 size={14} /> Compartir mapa
          </button>
          <button onClick={() => setShowSharesList(true)} style={{ ...btnOutline, display: 'flex', alignItems: 'center', gap: 6 }}>
            <List size={14} /> Mis enlaces
          </button>
          <button onClick={() => navigate('/reports')} style={{ ...btnOutline, display: 'flex', alignItems: 'center', gap: 6 }}>
            <BarChart2 size={14} /> Reportes
          </button>
          <button onClick={() => setShowImport(true)} style={{ ...btnOutline, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Upload size={14} /> Importar
          </button>
          <button onClick={() => setShowForm(true)} style={{ ...btnWhite, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Plus size={14} /> Nuevo registro
          </button>
        </div>
      </header>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Sidebar */}
        <aside style={sidebar}>
          {/* Sidebar header */}
          <div style={{ padding: '12px 16px 8px', borderBottom: '1px solid #e2e8f0', flexShrink: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Unidades
            </p>
            {parkings.length > 0 && (
              <button
                onClick={handleDeleteAll}
                style={{ background: 'transparent', border: '1px solid #e2e8f0', borderRadius: 6, cursor: 'pointer', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, padding: '3px 8px', fontFamily: 'inherit' }}
                title="Borrar todos los registros"
              >
                <Trash2 size={11} /> Borrar todo
              </button>
            )}
          </div>

          {/* Date range filter */}
          {unitFilteredParkings.length > 0 && (
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
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {loading && (
              <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8', fontSize: 13 }}>
                Cargando registros...
              </div>
            )}
            {error && (
              <div style={{ background: '#fef2f2', color: '#dc2626', padding: 16, borderRadius: 8, fontSize: 13 }}>
                Error: {error}
              </div>
            )}
            {!loading && !error && parkings.length === 0 && (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: '#94a3b8' }}>
                <MapPin size={38} style={{ marginBottom: 12 }} />
                <p style={{ fontWeight: 600, marginBottom: 4 }}>Sin registros aún</p>
                <p style={{ fontSize: 13 }}>Agrega el primer registro con el botón de arriba</p>
              </div>
            )}
            {!loading && !error && parkings.length > 0 && (
              <>
                {/* All units button */}
                <button
                  style={filterUnit === 'all' ? unitBtnActive('#2563eb') : unitBtn}
                  onClick={handleAllUnits}
                >
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#2563eb', flexShrink: 0 }} />
                  <span style={{ flex: 1, textAlign: 'left' }}>Todas las unidades</span>
                  <span style={badge}>{parkings.length}</span>
                </button>

                {/* Unit accordion items */}
                {units.map(u => {
                  const color = unitColors[u.id];
                  const isExpanded = expandedUnits.has(u.id);
                  const isActive = filterUnit === u.id;
                  const unitParkings = parkingsForUnit(u.id);

                  return (
                    <div key={u.id} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {/* Unit header row */}
                      <div style={{ display: 'flex', gap: 4, alignItems: 'stretch' }}>
                        <button
                          style={{ ...(isActive ? unitBtnActive(color) : unitBtn), flex: 1 }}
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
                        <button
                          onClick={() => handleDeleteUnit(u.id, u.count)}
                          style={{
                            padding: '0 10px',
                            background: '#fef2f2',
                            border: '1px solid #fee2e2',
                            borderRadius: 8,
                            cursor: 'pointer',
                            color: '#dc2626',
                            display: 'flex',
                            alignItems: 'center',
                            flexShrink: 0
                          }}
                          title={`Eliminar todos los registros de ${u.id}`}
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>

                      {/* Expanded parkings */}
                      {isExpanded && (
                        <div style={{ paddingLeft: 14, display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {unitParkings.length === 0 && (
                            <p style={{ fontSize: 11, color: '#94a3b8', padding: '6px 10px' }}>Sin registros en el rango</p>
                          )}
                          {unitParkings.map((p, idx) => {
                            const isHighlighted = highlightId === p.id;
                            const duration = formatDuration(p.parking_duration);
                            const start = formatDate(p.parking_start);
                            return (
                              <div
                                key={p.id}
                                onClick={() => handleSelect(p.id)}
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
                                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 4 }}>
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                                      <span style={{ fontSize: 11, fontWeight: 700, color: isHighlighted ? '#2563eb' : '#1e293b' }}>
                                        #{idx + 1}
                                      </span>
                                      {duration && (
                                        <span style={{ fontSize: 11, fontWeight: 600, color: isHighlighted ? '#2563eb' : '#374151' }}>
                                          {duration}
                                        </span>
                                      )}
                                      {isHighlighted && (
                                        <span style={{ marginLeft: 'auto', fontSize: 10, color: '#2563eb', fontWeight: 700 }}>● en mapa</span>
                                      )}
                                    </div>
                                    {start && (
                                      <p style={{ fontSize: 11, color: '#64748b', marginBottom: 2 }}>{start}</p>
                                    )}
                                    {p.address && (
                                      <p style={{ fontSize: 10, color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 2 }}>
                                        <MapPin size={9} /> {p.address}
                                      </p>
                                    )}
                                  </div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
                                    <span
                                      onMouseEnter={(e) => handleInfoEnter(e, p, color)}
                                      onMouseLeave={handleInfoLeave}
                                      style={{ color: '#cbd5e1', display: 'flex', alignItems: 'center', padding: '2px 4px', borderRadius: 4, cursor: 'default' }}
                                    >
                                      <Info size={12} />
                                    </span>
                                    <button
                                      onClick={(e) => handleDeleteOne(e, p.id)}
                                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '2px 4px', borderRadius: 4, flexShrink: 0, display: 'flex', alignItems: 'center' }}
                                      title="Eliminar"
                                    >
                                      <Trash2 size={12} />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </>
            )}
          </div>
        </aside>

        {/* Map */}
        <main style={{ flex: 1, position: 'relative' }}>
          {!loading && (
            <MapView
              parkings={visibleParkings}
              unitColors={unitColors}
              highlightId={highlightId}
              onMarkerClick={handleSelect}
            />
          )}
          {loading && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#94a3b8' }}>
              Cargando mapa...
            </div>
          )}
        </main>
      </div>

      {showForm && (
        <ParkingForm onCreated={handleCreated} onClose={() => setShowForm(false)} />
      )}
      {showShare && (
        <ShareLinkModal units={units} onClose={() => setShowShare(false)} />
      )}
      {showImport && (
        <ImportModal onImported={handleImported} onClose={() => setShowImport(false)} />
      )}
      {showSharesList && (
        <SharesListModal onClose={() => setShowSharesList(false)} />
      )}
      {dialog}

      {/* Tooltip de hover para el ícono de info del sidebar */}
      {tooltipParking && (
        <div style={{
          position: 'fixed',
          left: 368,
          top: tooltipPos,
          width: 262,
          zIndex: 3000,
          pointerEvents: 'none',
          borderRadius: 12,
          overflow: 'hidden',
          boxShadow: '0 8px 32px rgba(0,0,0,0.22)',
          border: '1px solid rgba(0,0,0,0.07)',
        }}>
          <div style={{ background: tooltipParking._color, color: 'white', padding: '10px 14px', fontWeight: 700, fontSize: 14 }}>
            {tooltipParking.unit_name || tooltipParking.unit_id}
          </div>
          <div style={{ background: 'white', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <TooltipRow label="ID Unidad" value={tooltipParking.unit_id} />
            <TooltipRow label="Tiempo estacionado" value={fmtDur(tooltipParking.parking_duration)} />
            <TooltipRow label="Inicio" value={fmtDt(tooltipParking.parking_start)} />
            <TooltipRow label="Coordenadas" value={`${tooltipParking.latitude.toFixed(6)}, ${tooltipParking.longitude.toFixed(6)}`} />
            {tooltipParking.address && <TooltipRow label="Dirección" value={tooltipParking.address} />}
            {tooltipParking.notes && <TooltipRow label="Notas" value={tooltipParking.notes} />}
            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
              Registrado: {fmtDt(tooltipParking.created_at)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TooltipRow({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 12 }}>
      <span style={{ color: '#64748b', flexShrink: 0 }}>{label}</span>
      <span style={{ fontWeight: 500, textAlign: 'right', wordBreak: 'break-all' }}>{value}</span>
    </div>
  );
}

function fmtDur(minutes) {
  if (!minutes) return '—';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}min`;
}

function fmtDt(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-MX', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
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
  width: 360,
  background: 'white',
  borderRight: '1px solid #e2e8f0',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  flexShrink: 0
};
const btnWhite = {
  padding: '8px 16px', background: 'white', color: '#1d4ed8',
  border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700,
  cursor: 'pointer'
};
const btnOutline = {
  padding: '8px 16px', background: 'transparent', color: 'white',
  border: '1px solid rgba(255,255,255,0.4)', borderRadius: 8, fontSize: 13,
  fontWeight: 600, cursor: 'pointer'
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
