import { useMemo, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ChevronDown, Trash2 } from 'lucide-react';
import { ALL_LABEL, filterByDateRange } from '../../lib/parkingGroups';
import { NEUTRAL } from '../../lib/colors';
import { formatDateTime, formatDuration } from '../../lib/format';

const ROW_ESTIMATE = { item: 54, default: 38 };

// Aplana el acordeón en filas para poder virtualizarlo
function buildRows({ groups, groupBy, filters, unitColors, visibleCount, hasDateFilter }) {
  const { filterKey, expandedGroups, expandedSubgroups, appliedFrom, appliedTo } = filters;
  const rows = [{ kind: 'all', key: 'all' }];

  if (hasDateFilter && visibleCount === 0) {
    rows.push({ kind: 'note', key: 'no-results', text: 'No hay resultados para este rango de fechas' });
  }

  groups.forEach((group) => {
    const expanded = expandedGroups.has(group.key);

    if (groupBy !== 'date_unit') {
      rows.push({ kind: 'group', key: group.key, group, expanded, active: filterKey === group.key });
      if (!expanded) return;
      const items = filterByDateRange(group.items, appliedFrom, appliedTo);
      if (items.length === 0) {
        rows.push({ kind: 'note', key: `${group.key}-empty`, text: 'Sin registros en el rango', level: 1 });
      }
      items.forEach((parking, index) => {
        rows.push({
          kind: 'item', key: parking.id, parking, index, level: 1,
          color: unitColors[parking.unit_id] || NEUTRAL,
          showUnit: groupBy !== 'unit',
          showDate: groupBy !== 'date',
          showAddress: groupBy !== 'address',
        });
      });
      return;
    }

    const active = filterKey === group.key || filterKey.startsWith(`${group.key}||`);
    rows.push({ kind: 'group', key: group.key, group, expanded, active });
    if (!expanded) return;

    const inRange = (!appliedFrom && !appliedTo)
      || (group.key >= (appliedFrom || '') && group.key <= (appliedTo || 'zzzz'));
    if (!inRange) {
      rows.push({ kind: 'note', key: `${group.key}-empty`, text: 'Sin registros en el rango', level: 1 });
      return;
    }

    group.subgroups.forEach((sub) => {
      const subExpanded = expandedSubgroups.has(sub.key);
      rows.push({
        kind: 'group', key: sub.key, group: sub, parentKey: group.key, level: 1,
        expanded: subExpanded, active: filterKey === sub.key,
      });
      if (!subExpanded) return;
      sub.items.forEach((parking, index) => {
        rows.push({
          kind: 'item', key: `${sub.key}-${parking.id}`, parking, index, level: 2,
          color: sub.color, showUnit: false, showDate: true, showAddress: true,
        });
      });
    });
  });

  return rows;
}

// Lista de grupos y registros compartida por el mapa principal y el mapa compartido.
// `onDeleteGroup` y `onDeleteItem` son opcionales: sin ellos la vista es de solo lectura.
export default function GroupedParkingList({ filters, unitColors, totalCount, visibleCount, onDeleteGroup, onDeleteItem }) {
  const { groups, groupBy, appliedFrom, appliedTo } = filters;
  const scrollRef = useRef(null);
  const hasDateFilter = Boolean(appliedFrom || appliedTo);

  const rows = useMemo(
    () => buildRows({ groups, groupBy, filters, unitColors, visibleCount, hasDateFilter }),
    // `filters` es un objeto nuevo en cada render; aquí solo importan estos campos
    [groups, groupBy, filters.filterKey, filters.expandedGroups, filters.expandedSubgroups,
      appliedFrom, appliedTo, unitColors, visibleCount, hasDateFilter],
  );

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: (i) => ROW_ESTIMATE[rows[i].kind] ?? ROW_ESTIMATE.default,
    getItemKey: (i) => rows[i].key,
    overscan: 8,
  });

  function renderRow(row) {
    switch (row.kind) {
      case 'all': {
        const selected = filters.filterKey === 'all';
        return (
          <div className={`list-row${selected ? ' list-row-selected' : ''}`}>
            <button className="list-row-main" onClick={filters.resetSelection} aria-pressed={selected}>
              <span style={{ flex: 1 }}>{ALL_LABEL[groupBy]}</span>
              <span className="badge">{totalCount}</span>
            </button>
          </div>
        );
      }
      case 'note':
        return <p className="small muted" style={{ padding: '6px 8px' }}>{row.text}</p>;
      case 'group':
        return (
          <GroupRow
            row={row}
            showDot={groupBy === 'unit' || Boolean(row.parentKey)}
            onToggle={() => {
              if (row.parentKey) filters.toggleSubgroup(row.key, row.parentKey);
              else if (groupBy === 'date_unit') filters.toggleDateGroup(row.key);
              else filters.toggleGroup(row.key);
            }}
            onDelete={groupBy === 'unit' ? onDeleteGroup : undefined}
          />
        );
      default:
        return (
          <ParkingItem
            row={row}
            highlighted={filters.highlightId === row.parking.id}
            onSelect={filters.toggleHighlight}
            onDelete={onDeleteItem}
          />
        );
    }
  }

  return (
    <div ref={scrollRef} style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '8px' }}>
      <div role="list" aria-label="Registros de estacionamiento" style={{ position: 'relative', height: virtualizer.getTotalSize() }}>
        {virtualizer.getVirtualItems().map((item) => {
          const row = rows[item.index];
          return (
            <div
              key={item.key}
              ref={virtualizer.measureElement}
              data-index={item.index}
              role="listitem"
              style={{
                position: 'absolute', top: 0, left: 0, width: '100%',
                transform: `translateY(${item.start}px)`,
                paddingBottom: 2,
                paddingLeft: (row.level || 0) * 12,
              }}
            >
              {renderRow(row)}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function GroupRow({ row, showDot, onToggle, onDelete }) {
  const { group, expanded, active, level } = row;
  return (
    <div className={`list-row${active ? ' list-row-selected' : ''}`}>
      <button className="list-row-main" onClick={onToggle} aria-expanded={expanded}>
        {showDot && <span className={`dot${level ? ' dot-sm' : ''}`} style={{ background: group.color }} />}
        <span className="truncate cap-first" style={{ flex: 1 }}>{group.label}</span>
        <span className="badge">{group.count}</span>
        <ChevronDown size={15} className="chevron" />
      </button>
      {onDelete && !level && (
        <button
          onClick={() => onDelete(group)}
          className="icon-btn icon-btn-danger hover-reveal"
          style={{ marginRight: 4 }}
          aria-label={`Eliminar registros de ${group.label}`}
          title={`Eliminar registros de ${group.label}`}
        >
          <Trash2 size={14} />
        </button>
      )}
    </div>
  );
}

function ParkingItem({ row, highlighted, onSelect, onDelete }) {
  const { parking: p, index, color, showUnit, showDate, showAddress } = row;
  const duration = formatDuration(p.parking_duration);
  const details = [showDate && p.parking_start ? formatDateTime(p.parking_start) : null, showAddress ? p.address : null]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className={`list-row item-row${highlighted ? ' list-row-selected' : ''}`}>
      <button onClick={() => onSelect(p.id)} aria-pressed={highlighted} className="item-main">
        <span className="item-top">
          <span className="dot dot-sm" style={{ background: color }} />
          <span style={{ fontWeight: 600 }} className="truncate">
            {showUnit ? (p.unit_name || p.unit_id) : `Parada ${index + 1}`}
          </span>
          {duration && <span className="muted" style={{ marginLeft: 'auto', flexShrink: 0 }}>{duration}</span>}
        </span>
        {details && (
          <span className="item-sub">
            <span className="truncate">{details}</span>
          </span>
        )}
      </button>
      {onDelete && (
        <div className="row-actions">
          <button
            onClick={() => onDelete(p.id)}
            className="icon-btn icon-btn-danger hover-reveal"
            aria-label={`Eliminar registro ${index + 1}`}
            title="Eliminar"
          >
            <Trash2 size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
