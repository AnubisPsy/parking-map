import { useCallback, useMemo, useState } from 'react';
import { dateKey, buildGroups, filterByDateRange } from '../lib/parkingGroups';
import { useDebouncedValue } from './useDebouncedValue';

// Estado de la barra lateral: agrupación, rango de fechas, grupos abiertos y registro resaltado.
export function useParkingFilters(parkings, unitColors, initial = {}) {
  const [groupBy, setGroupBy] = useState(initial.groupBy || 'unit');
  // `initial.open`: grupo abierto al llegar (un enlace compartido abre el mismo que se veía).
  // En Fecha + Unidad puede ser "día||unidad": se abren el día y la unidad.
  const [filterKey, setFilterKey] = useState(initial.open || 'all');
  const [dateFrom, setDateFrom] = useState(initial.from || '');
  const [dateTo, setDateTo] = useState(initial.to || '');
  const [expandedGroups, setExpandedGroups] = useState(
    () => new Set(initial.open ? [initial.open.split('||')[0]] : []),
  );
  const [expandedSubgroups, setExpandedSubgroups] = useState(
    () => new Set(initial.open?.includes('||') ? [initial.open] : []),
  );
  const [highlightId, setHighlightId] = useState(null);

  // Al teclear el año, un input de fecha emite un cambio por dígito y el mapa
  // se reencuadraría con cada uno.
  const appliedFrom = useDebouncedValue(dateFrom);
  const appliedTo = useDebouncedValue(dateTo);

  const groups = useMemo(
    () => buildGroups(parkings, groupBy, unitColors),
    [parkings, groupBy, unitColors],
  );

  const groupFiltered = useMemo(() => {
    if (filterKey === 'all') return parkings;
    if (groupBy === 'date_unit') {
      const [day, unitId] = filterKey.split('||');
      return parkings.filter(
        (p) => (dateKey(p) || 'sin-fecha') === day && (!unitId || p.unit_id === unitId),
      );
    }
    return groups.find((g) => g.key === filterKey)?.items ?? parkings;
  }, [parkings, groups, filterKey, groupBy]);

  const visibleParkings = useMemo(
    () => filterByDateRange(groupFiltered, appliedFrom, appliedTo),
    [groupFiltered, appliedFrom, appliedTo],
  );

  function resetSelection() {
    setFilterKey('all');
    setExpandedGroups(new Set());
    setExpandedSubgroups(new Set());
    setHighlightId(null);
  }

  function changeGroupBy(next) {
    setGroupBy(next);
    resetSelection();
    setDateFrom('');
    setDateTo('');
  }

  function toggleGroup(key) {
    const next = new Set(expandedGroups);
    const opening = !next.has(key);
    if (opening) next.add(key);
    else next.delete(key);
    setExpandedGroups(next);
    setFilterKey(opening ? key : 'all');
    setHighlightId(null);
  }

  function toggleDateGroup(key) {
    const next = new Set(expandedGroups);
    if (next.has(key)) {
      next.delete(key);
      setExpandedSubgroups(
        new Set([...expandedSubgroups].filter((k) => !k.startsWith(`${key}||`))),
      );
      if (filterKey === key || filterKey.startsWith(`${key}||`)) setFilterKey('all');
    } else {
      next.add(key);
      setFilterKey(key);
    }
    setExpandedGroups(next);
    setHighlightId(null);
  }

  function toggleSubgroup(subKey, parentKey) {
    const next = new Set(expandedSubgroups);
    const opening = !next.has(subKey);
    if (opening) next.add(subKey);
    else next.delete(subKey);
    setExpandedSubgroups(next);
    setFilterKey(opening ? subKey : parentKey);
    setHighlightId(null);
  }

  // Estable para no invalidar los marcadores memorizados del mapa
  const toggleHighlight = useCallback(
    (id) => setHighlightId((prev) => (prev === id ? null : id)),
    [],
  );

  return {
    groupBy, changeGroupBy,
    groups,
    filterKey,
    dateFrom, setDateFrom,
    dateTo, setDateTo,
    appliedFrom, appliedTo,
    expandedGroups, expandedSubgroups,
    groupFiltered, visibleParkings,
    highlightId, setHighlightId, toggleHighlight,
    resetSelection, toggleGroup, toggleDateGroup, toggleSubgroup,
  };
}
