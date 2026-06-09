import { useEffect, useState, useMemo } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { fetchShareData } from '../api';
import MapView from '../components/MapView';
import { buildUnitColors } from '../components/ParkingList';
import { Map as MapIcon, MapPin, Loader2, Clock, Search, AlertTriangle, CalendarDays, X, ChevronDown, LayoutGrid } from 'lucide-react';

const GROUP_OPTIONS = [
  { id: 'unit',      label: 'Unidad'         },
  { id: 'date',      label: 'Fecha'          },
  { id: 'address',   label: 'Sucursal'       },
  { id: 'date_unit', label: 'Fecha + Unidad' },
];

const ALL_LABEL = {
  unit:      'Todas las unidades',
  date:      'Todas las fechas',
  address:   'Todas las sucursales',
  date_unit: 'Todos los registros',
};

const GROUP_COLORS = [
  '#2563eb','#dc2626','#16a34a','#d97706','#7c3aed',
  '#0891b2','#be185d','#15803d','#b45309','#4338ca',
];

function buildGroups(parkings, groupBy, unitColors) {
  const map = new Map();
  parkings.forEach(p => {
    let key, label, color;
    const d = dateKey(p);
    switch (groupBy) {
      case 'unit':
        key = p.unit_id;
        label = p.unit_name ? `${p.unit_name} (${p.unit_id})` : p.unit_id;
        color = unitColors[p.unit_id] || '#64748b';
        break;
      case 'date':
        key = d || 'sin-fecha';
        label = d ? new Date(d + 'T12:00:00').toLocaleDateString('es-MX', { weekday: 'long', day: '2-digit', month: 'short', year: 'numeric' }) : 'Sin fecha';
        color = '#2563eb';
        break;
      case 'address':
        key = p.address || 'sin-sucursal';
        label = p.address || 'Sin sucursal';
        color = '#2563eb';
        break;
      default: return;
    }
    if (!map.has(key)) map.set(key, { key, label, color, items: [], count: 0, unitId: p.unit_id });
    map.get(key).items.push(p);
    map.get(key).count++;
  });
  const groups = [...map.values()];
  if (groupBy === 'date' || groupBy === 'address')
    groups.forEach((g, i) => { g.color = GROUP_COLORS[i % GROUP_COLORS.length]; });
  if (groupBy === 'date') groups.sort((a, b) => b.key.localeCompare(a.key));
  else groups.sort((a, b) => a.label.localeCompare(b.label));
  groups.forEach(g => g.items.sort((a, b) => new Date(a.parking_start || a.created_at || 0) - new Date(b.parking_start || b.created_at || 0)));
  return groups;
}

function buildDateUnitGroups(parkings, unitColors) {
  const dateMap = new Map();
  parkings.forEach(p => {
    const d = dateKey(p);
    const dk = d || 'sin-fecha';
    const dlabel = d ? new Date(d + 'T12:00:00').toLocaleDateString('es-MX', { weekday: 'long', day: '2-digit', month: 'short', year: 'numeric' }) : 'Sin fecha';
    if (!dateMap.has(dk)) dateMap.set(dk, { key: dk, label: dlabel, color: '#2563eb', count: 0, subgroups: new Map() });
    const dg = dateMap.get(dk);
    dg.count++;
    const uk = `${dk}||${p.unit_id}`;
    if (!dg.subgroups.has(uk))
      dg.subgroups.set(uk, { key: uk, unitId: p.unit_id, label: p.unit_name ? `${p.unit_name} (${p.unit_id})` : p.unit_id, color: unitColors[p.unit_id] || '#64748b', items: [], count: 0 });
    const ug = dg.subgroups.get(uk);
    ug.items.push(p);
    ug.count++;
  });
  const groups = [...dateMap.values()].map((g, i) => ({
    ...g,
    color: GROUP_COLORS[i % GROUP_COLORS.length],
    subgroups: [...g.subgroups.values()].sort((a, b) => a.label.localeCompare(b.label)).map(sg => ({
      ...sg,
      items: [...sg.items].sort((a, b) => new Date(a.parking_start || a.created_at || 0) - new Date(b.parking_start || b.created_at || 0)),
    })),
  }));
  groups.sort((a, b) => b.key.localeCompare(a.key));
  return groups;
}

function formatDuration(minutes) {
  if (!minutes) return '—';
  const h = Math.floor(minutes / 60), m = minutes % 60;
  if (h === 0) return `${m}min`; if (m === 0) return `${h}h`; return `${h}h ${m}min`;
}

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function dateKey(p) {
  const d = p.parking_start || p.created_at;
  if (!d) return null;
  const dt = new Date(d);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

export default function SharedMap() {
  const { token } = useParams();
  const [searchParams] = useSearchParams();
  const [data, setData] = useState(null);
  const [status, setStatus] = useState('loading');
  const [groupBy, setGroupBy] = useState(searchParams.get('groupBy') || 'unit');
  const [filterKey, setFilterKey] = useState('all');
  const [filterDateFrom, setFilterDateFrom] = useState(searchParams.get('from') || '');
  const [filterDateTo, setFilterDateTo] = useState(searchParams.get('to') || '');
  const [expandedGroups, setExpandedGroups] = useState(new Set());
  const [expandedSubgroups, setExpandedSubgroups] = useState(new Set());
  const [highlightId, setHighlightId] = useState(null);

  useEffect(() => {
    setFilterKey('all');
    setExpandedGroups(new Set());
    setExpandedSubgroups(new Set());
    setHighlightId(null);
    setFilterDateFrom('');
    setFilterDateTo('');
  }, [groupBy]);

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

  const groups = useMemo(() =>
    !data ? [] :
    groupBy === 'date_unit'
      ? buildDateUnitGroups(data.parkings, unitColors)
      : buildGroups(data.parkings, groupBy, unitColors),
    [data, groupBy, unitColors]
  );

  function applyDateFilter(items) {
    if (!filterDateFrom && !filterDateTo) return items;
    return items.filter(p => {
      const k = dateKey(p);
      if (!k) return true;
      if (filterDateFrom && k < filterDateFrom) return false;
      if (filterDateTo && k > filterDateTo) return false;
      return true;
    });
  }

  const groupFilteredParkings = useMemo(() => {
    if (!data) return [];
    if (filterKey === 'all') return data.parkings;
    if (groupBy === 'date_unit') {
      if (filterKey.includes('||')) {
        const [dk, uid] = filterKey.split('||');
        return data.parkings.filter(p => dateKey(p) === dk && p.unit_id === uid);
      }
      return data.parkings.filter(p => (dateKey(p) || 'sin-fecha') === filterKey);
    }
    const g = groups.find(g => g.key === filterKey);
    return g ? g.items : data.parkings;
  }, [data, groups, filterKey, groupBy]);

  const visibleParkings = useMemo(() => {
    if (!filterDateFrom && !filterDateTo) return groupFilteredParkings;
    return groupFilteredParkings.filter(p => {
      const k = dateKey(p);
      if (!k) return true;
      if (filterDateFrom && k < filterDateFrom) return false;
      if (filterDateTo && k > filterDateTo) return false;
      return true;
    });
  }, [groupFilteredParkings, filterDateFrom, filterDateTo]);

  function toggleGroup(key) {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(key)) { next.delete(key); setFilterKey('all'); setHighlightId(null); }
      else { next.add(key); setFilterKey(key); setHighlightId(null); }
      return next;
    });
  }

  function toggleDateGroup(key) {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
        setExpandedSubgroups(prev2 => { const n2 = new Set(prev2); [...n2].filter(k => k.startsWith(key + '||')).forEach(k => n2.delete(k)); return n2; });
        setFilterKey(fk => (fk === key || fk.startsWith(key + '||')) ? 'all' : fk);
        setHighlightId(null);
      } else {
        next.add(key);
        setFilterKey(key);
        setHighlightId(null);
      }
      return next;
    });
  }

  function toggleUnitSubgroup(subKey, parentDateKey) {
    setExpandedSubgroups(prev => {
      const next = new Set(prev);
      if (next.has(subKey)) { next.delete(subKey); setFilterKey(parentDateKey); setHighlightId(null); }
      else { next.add(subKey); setFilterKey(subKey); setHighlightId(null); }
      return next;
    });
  }

  function handleAllGroups() {
    setFilterKey('all'); setExpandedGroups(new Set()); setExpandedSubgroups(new Set()); setHighlightId(null);
  }

  function renderItem(p, idx, itemColor) {
    const isHighlighted = highlightId === p.id;
    return (
      <div
        key={p.id}
        onClick={() => setHighlightId(prev => prev === p.id ? null : p.id)}
        style={{ background: isHighlighted ? '#eff6ff' : '#f8fafc', border: `1px solid ${isHighlighted ? '#2563eb' : '#e2e8f0'}`, borderLeft: `3px solid ${itemColor}`, borderRadius: 8, padding: '8px 10px', cursor: 'pointer', transition: 'all 0.15s' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: isHighlighted ? '#2563eb' : '#1e293b' }}>#{idx + 1}</span>
          <span style={{ fontSize: 11, fontWeight: 600, color: isHighlighted ? '#2563eb' : '#374151' }}>{formatDuration(p.parking_duration)}</span>
          {isHighlighted && <span style={{ marginLeft: 'auto', fontSize: 10, color: '#2563eb', fontWeight: 700 }}>● en mapa</span>}
        </div>
        <p style={{ fontSize: 11, color: '#64748b', marginBottom: 2 }}>{formatDate(p.parking_start)}</p>
        {p.address && (
          <p style={{ fontSize: 10, color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 2 }}>
            <MapPin size={9} /> {p.address}
          </p>
        )}
      </div>
    );
  }

  if (status === 'loading') return <FullMessage Icon={Loader2} title="Cargando mapa..." />;
  if (status === 'expired') return <FullMessage Icon={Clock} title="Enlace expirado" desc="Este enlace ya no es válido. Solicita uno nuevo." />;
  if (status === 'notfound') return <FullMessage Icon={Search} title="Enlace no encontrado" desc="El enlace no existe o fue eliminado." />;
  if (status === 'error') return <FullMessage Icon={AlertTriangle} title="Error al cargar" desc="No se pudo conectar al servidor." />;

  const expiry = formatDate(data.expires_at);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <header style={headerStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <MapIcon size={24} color="white" />
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
        <aside style={sidebar}>
          {/* Group picker */}
          <div style={{ padding: '10px 14px 8px', borderBottom: '1px solid #e2e8f0', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <LayoutGrid size={13} color="#94a3b8" />
              <span style={{ fontSize: 11, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Agrupar por</span>
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              {GROUP_OPTIONS.map(opt => (
                <button key={opt.id} onClick={() => setGroupBy(opt.id)} style={groupBy === opt.id ? groupPillActive : groupPill}>{opt.label}</button>
              ))}
            </div>
          </div>

          {/* Date range filter */}
          {data.parkings.length > 0 && (
            <div style={{ padding: '8px 16px 10px', borderBottom: '1px solid #e2e8f0', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <CalendarDays size={14} color="#94a3b8" style={{ flexShrink: 0 }} />
                <input type="date" value={filterDateFrom} max={filterDateTo || undefined} onChange={e => setFilterDateFrom(e.target.value)} style={dateInputStyle} title="Desde" />
                <span style={{ fontSize: 12, color: '#94a3b8', flexShrink: 0 }}>—</span>
                <input type="date" value={filterDateTo} min={filterDateFrom || undefined} onChange={e => setFilterDateTo(e.target.value)} style={dateInputStyle} title="Hasta" />
                {(filterDateFrom || filterDateTo) && (
                  <button onClick={() => { setFilterDateFrom(''); setFilterDateTo(''); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', display: 'flex', padding: 2, flexShrink: 0, borderRadius: 4 }} title="Quitar filtro">
                    <X size={14} />
                  </button>
                )}
              </div>
              {(filterDateFrom || filterDateTo) && (
                <p style={{ fontSize: 11, color: '#2563eb', marginTop: 5, fontWeight: 600 }}>{visibleParkings.length} registro{visibleParkings.length !== 1 ? 's' : ''} en el rango</p>
              )}
            </div>
          )}

          {/* Accordion list */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <button style={filterKey === 'all' ? unitBtnActive('#2563eb') : unitBtn} onClick={handleAllGroups}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#2563eb', flexShrink: 0 }} />
              <span style={{ flex: 1, textAlign: 'left' }}>{ALL_LABEL[groupBy]}</span>
              <span style={badge}>{data.parkings.length}</span>
            </button>

            {/* Flat modes */}
            {groupBy !== 'date_unit' && groups.map(g => {
              const isExpanded = expandedGroups.has(g.key);
              const isActive = filterKey === g.key;
              const items = applyDateFilter(g.items);
              return (
                <div key={g.key} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <button style={{ ...(isActive ? unitBtnActive(g.color) : unitBtn) }} onClick={() => toggleGroup(g.key)}>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: g.color, flexShrink: 0 }} />
                    <span style={{ flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.label}</span>
                    <span style={badge}>{g.count}</span>
                    <ChevronDown size={14} style={{ flexShrink: 0, transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s', color: isActive ? g.color : '#94a3b8', marginLeft: 4 }} />
                  </button>
                  {isExpanded && (
                    <div style={{ paddingLeft: 14, display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {items.length === 0
                        ? <p style={{ fontSize: 11, color: '#94a3b8', padding: '6px 10px' }}>Sin registros en el rango</p>
                        : items.map((p, idx) => renderItem(p, idx, unitColors[p.unit_id] || '#64748b'))
                      }
                    </div>
                  )}
                </div>
              );
            })}

            {/* Two-level mode: date_unit */}
            {groupBy === 'date_unit' && groups.map(dg => {
              const dateExpanded = expandedGroups.has(dg.key);
              const dateActive = filterKey === dg.key || filterKey.startsWith(dg.key + '||');
              const filteredSubgroups = dg.subgroups.filter(() =>
                !filterDateFrom && !filterDateTo ? true : (dg.key >= (filterDateFrom || '') && dg.key <= (filterDateTo || 'zzzz'))
              );
              return (
                <div key={dg.key} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <button style={{ ...(dateActive ? unitBtnActive(dg.color) : unitBtn) }} onClick={() => toggleDateGroup(dg.key)}>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: dg.color, flexShrink: 0 }} />
                    <span style={{ flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{dg.label}</span>
                    <span style={badge}>{dg.count}</span>
                    <ChevronDown size={14} style={{ flexShrink: 0, transform: dateExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s', color: dateActive ? dg.color : '#94a3b8', marginLeft: 4 }} />
                  </button>
                  {dateExpanded && (
                    <div style={{ paddingLeft: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {filteredSubgroups.map(sg => {
                        const sgExpanded = expandedSubgroups.has(sg.key);
                        const sgActive = filterKey === sg.key;
                        return (
                          <div key={sg.key} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                            <button style={{ ...(sgActive ? unitBtnActive(sg.color) : unitBtn), fontSize: 12 }} onClick={() => toggleUnitSubgroup(sg.key, dg.key)}>
                              <span style={{ width: 8, height: 8, borderRadius: '50%', background: sg.color, flexShrink: 0 }} />
                              <span style={{ flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sg.label}</span>
                              <span style={badge}>{sg.count}</span>
                              <ChevronDown size={12} style={{ flexShrink: 0, transform: sgExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s', color: sgActive ? sg.color : '#94a3b8', marginLeft: 4 }} />
                            </button>
                            {sgExpanded && (
                              <div style={{ paddingLeft: 12, display: 'flex', flexDirection: 'column', gap: 3 }}>
                                {sg.items.map((p, idx) => renderItem(p, idx, sg.color))}
                              </div>
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

        <main style={{ flex: 1 }}>
          <MapView parkings={visibleParkings} unitColors={unitColors} highlightId={highlightId} onMarkerClick={(id) => setHighlightId(prev => prev === id ? null : id)} />
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

const headerStyle = { background: 'linear-gradient(135deg, #1d4ed8 0%, #2563eb 100%)', padding: '12px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 2px 12px rgba(37,99,235,0.4)', zIndex: 10, flexShrink: 0 };
const sidebar = { width: 320, background: 'white', borderRight: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', overflow: 'hidden', flexShrink: 0 };
const unitBtn = { display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontFamily: 'inherit', width: '100%', color: '#374151' };
const unitBtnActive = (color) => ({ ...unitBtn, background: color + '18', border: `1px solid ${color}`, color, fontWeight: 700 });
const badge = { background: '#e2e8f0', color: '#475569', fontSize: 11, fontWeight: 700, padding: '1px 7px', borderRadius: 20, flexShrink: 0 };
const dateInputStyle = { flex: 1, minWidth: 0, padding: '4px 7px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 12, color: '#374151', outline: 'none', fontFamily: 'inherit', cursor: 'pointer' };
const groupPill = { flex: 1, padding: '5px 4px', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 6, cursor: 'pointer', fontSize: 11, fontFamily: 'inherit', color: '#475569', fontWeight: 500, whiteSpace: 'nowrap' };
const groupPillActive = { ...groupPill, background: '#eff6ff', border: '1px solid #2563eb', color: '#2563eb', fontWeight: 700 };