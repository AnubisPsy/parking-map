import { NEUTRAL, PALETTE } from './colors';

export const GROUP_OPTIONS = [
  { id: 'unit', label: 'Unidad' },
  { id: 'date', label: 'Fecha' },
  { id: 'address', label: 'Sucursal' },
  { id: 'date_unit', label: 'Fecha + Unidad' },
];

export const ALL_LABEL = {
  unit: 'Todas las unidades',
  date: 'Todas las fechas',
  address: 'Todas las sucursales',
  date_unit: 'Todos los registros',
};

export function localDateKey(value) {
  if (!value) return null;
  const dt = new Date(value);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

export const dateKey = (parking) => localDateKey(parking.parking_start || parking.created_at);

const dayLabel = (day) =>
  new Date(day + 'T12:00:00').toLocaleDateString('es-MX', {
    weekday: 'long', day: '2-digit', month: 'short', year: 'numeric',
  });

const unitLabel = (p) => (p.unit_name ? `${p.unit_name} (${p.unit_id})` : p.unit_id);

const byStartTime = (a, b) =>
  new Date(a.parking_start || a.created_at || 0) - new Date(b.parking_start || b.created_at || 0);

// Grupos de un nivel: unidad, fecha o sucursal
function buildFlatGroups(parkings, groupBy, unitColors) {
  const map = new Map();
  parkings.forEach((p) => {
    let key, label, color;
    if (groupBy === 'unit') {
      key = p.unit_id;
      label = unitLabel(p);
      color = unitColors[p.unit_id] || NEUTRAL;
    } else if (groupBy === 'date') {
      const day = dateKey(p);
      key = day || 'sin-fecha';
      label = day ? dayLabel(day) : 'Sin fecha';
    } else {
      key = p.address || 'sin-sucursal';
      label = p.address || 'Sin sucursal';
    }
    if (!map.has(key)) map.set(key, { key, label, color, items: [], count: 0, unitId: p.unit_id });
    const group = map.get(key);
    group.items.push(p);
    group.count++;
  });

  const groups = [...map.values()];
  if (groupBy !== 'unit') {
    groups.forEach((g, i) => { g.color = PALETTE[i % PALETTE.length]; });
  }
  if (groupBy === 'date') groups.sort((a, b) => b.key.localeCompare(a.key));
  else groups.sort((a, b) => a.label.localeCompare(b.label));
  groups.forEach((g) => g.items.sort(byStartTime));
  return groups;
}

// Dos niveles: Fecha → Unidad → registros
function buildDateUnitGroups(parkings, unitColors) {
  const dates = new Map();
  parkings.forEach((p) => {
    const day = dateKey(p);
    const dayId = day || 'sin-fecha';
    if (!dates.has(dayId)) {
      dates.set(dayId, { key: dayId, label: day ? dayLabel(day) : 'Sin fecha', count: 0, subgroups: new Map() });
    }
    const dateGroup = dates.get(dayId);
    dateGroup.count++;
    const subKey = `${dayId}||${p.unit_id}`;
    if (!dateGroup.subgroups.has(subKey)) {
      dateGroup.subgroups.set(subKey, {
        key: subKey,
        unitId: p.unit_id,
        label: unitLabel(p),
        color: unitColors[p.unit_id] || NEUTRAL,
        items: [],
        count: 0,
      });
    }
    const subgroup = dateGroup.subgroups.get(subKey);
    subgroup.items.push(p);
    subgroup.count++;
  });

  return [...dates.values()]
    .map((g, i) => ({
      ...g,
      color: PALETTE[i % PALETTE.length],
      subgroups: [...g.subgroups.values()]
        .sort((a, b) => a.label.localeCompare(b.label))
        .map((sg) => ({ ...sg, items: [...sg.items].sort(byStartTime) })),
    }))
    .sort((a, b) => b.key.localeCompare(a.key));
}

export function buildGroups(parkings, groupBy, unitColors) {
  return groupBy === 'date_unit'
    ? buildDateUnitGroups(parkings, unitColors)
    : buildFlatGroups(parkings, groupBy, unitColors);
}

export function filterByDateRange(parkings, from, to) {
  if (!from && !to) return parkings;
  return parkings.filter((p) => {
    const day = dateKey(p);
    if (!day) return true;
    if (from && day < from) return false;
    if (to && day > to) return false;
    return true;
  });
}

// Recorridos que se traslapan con el rango de fechas
export function tracksInRange(tracks, from, to) {
  if (!from && !to) return tracks;
  return tracks.filter((t) => {
    if (from && localDateKey(t.end) < from) return false;
    if (to && localDateKey(t.start) > to) return false;
    return true;
  });
}
