import { useMemo, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ChevronDown, Info, MapPin, Trash2 } from 'lucide-react';
import { ALL_LABEL, filterByDateRange } from '../../lib/parkingGroups';
import { NEUTRAL } from '../../lib/colors';
import { formatDateTimeShort, formatDuration } from '../../lib/format';

const ROW_ESTIMATE = { item: 76, default: 42 };

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
// `onDeleteGroup`, `onDeleteItem` y `onInfoOpen` son opcionales: sin ellos la vista es de solo lectura.
export default function GroupedParkingList({
  filters, unitColors, totalCount, visibleCount, onDeleteGroup, onDeleteItem, onInfoOpen, onInfoClose,
}) {
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
      case 'all':
        return (
          <button
            style={filters.filterKey === 'all' ? groupBtnActive('#1d4ed8') : groupBtn}
            onClick={filters.resetSelection}
            aria-pressed={filters.filterKey === 'all'}
          >
            <Dot color="#2563eb" />
            <span style={{ flex: 1, textAlign: 'left' }}>{ALL_LABEL[groupBy]}</span>
            <span style={badge}>{totalCount}</span>
          </button>
        );
      case 'note':
        return <p style={noteStyle}>{row.text}</p>;
      case 'group':
        return (
          <GroupRow
            row={row}
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
            onInfoOpen={onInfoOpen}
            onInfoClose={onInfoClose}
          />
        );
    }
  }

  return (
    <div ref={scrollRef} style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 12 }}>
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
                paddingBottom: 5,
                paddingLeft: (row.level || 0) * 13,
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

function Dot({ color, size = 10 }) {
  return <span style={{ width: size, height: size, borderRadius: '50%', background: color, flexShrink: 0 }} />;
}

function GroupRow({ row, onToggle, onDelete }) {
  const { group, expanded, active, level } = row;
  return (
    <div style={{ display: 'flex', gap: 4, alignItems: 'stretch' }}>
      <button
        style={{ ...(active ? groupBtnActive(group.color) : groupBtn), flex: 1, minWidth: 0, fontSize: level ? 12 : 13 }}
        onClick={onToggle}
        aria-expanded={expanded}
      >
        <Dot color={group.color} size={level ? 8 : 10} />
        <span style={truncate}>{group.label}</span>
        <span style={badge}>{group.count}</span>
        <ChevronDown
          size={level ? 12 : 14}
          style={{
            flexShrink: 0, marginLeft: 4, transition: 'transform 0.2s',
            transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
            color: active ? group.color : '#64748b',
          }}
        />
      </button>
      {onDelete && !level && (
        <button
          onClick={() => onDelete(group)}
          style={deleteGroupBtn}
          aria-label={`Eliminar registros de ${group.label}`}
          title={`Eliminar registros de ${group.label}`}
        >
          <Trash2 size={12} />
        </button>
      )}
    </div>
  );
}

function ParkingItem({ row, highlighted, onSelect, onDelete, onInfoOpen, onInfoClose }) {
  const { parking: p, index, color, showUnit, showDate, showAddress } = row;
  const duration = formatDuration(p.parking_duration);
  const start = formatDateTimeShort(p.parking_start);

  return (
    <div
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 4,
        background: highlighted ? '#eff6ff' : '#f8fafc',
        border: `1px solid ${highlighted ? '#2563eb' : '#e2e8f0'}`,
        borderLeft: `3px solid ${color}`,
        borderRadius: 8,
      }}
    >
      <button onClick={() => onSelect(p.id)} aria-pressed={highlighted} style={itemBtn}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: highlighted ? '#1d4ed8' : '#1e293b' }}>#{index + 1}</span>
          {showUnit && (
            <span style={{ fontSize: 10, fontWeight: 700, color: 'white', background: color, padding: '1px 6px', borderRadius: 20 }}>
              {p.unit_name || p.unit_id}
            </span>
          )}
          {duration && (
            <span style={{ fontSize: 11, fontWeight: 600, color: highlighted ? '#1d4ed8' : '#374151' }}>{duration}</span>
          )}
          {highlighted && (
            <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 2, fontSize: 10, color: '#1d4ed8', fontWeight: 700 }}>
              <MapPin size={10} /> en mapa
            </span>
          )}
        </span>
        {showDate && start && (
          <span style={{ display: 'block', fontSize: 11, color: '#475569', marginBottom: 2 }}>{start}</span>
        )}
        {showAddress && p.address && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 2, fontSize: 10, color: '#475569', minWidth: 0 }}>
            <MapPin size={9} style={{ flexShrink: 0 }} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.address}</span>
          </span>
        )}
      </button>
      {(onInfoOpen || onDelete) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0, padding: '6px 6px 0 0' }}>
          {onInfoOpen && (
            <button
              onMouseEnter={(e) => onInfoOpen(e, p, color)}
              onMouseLeave={onInfoClose}
              onFocus={(e) => onInfoOpen(e, p, color)}
              onBlur={onInfoClose}
              onClick={(e) => onInfoOpen(e, p, color)}
              style={iconBtn}
              aria-label={`Ver detalles del registro ${index + 1}`}
            >
              <Info size={12} />
            </button>
          )}
          {onDelete && (
            <button
              onClick={() => onDelete(p.id)}
              style={iconBtn}
              aria-label={`Eliminar registro ${index + 1}`}
              title="Eliminar"
            >
              <Trash2 size={12} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

const truncate = { flex: 1, minWidth: 0, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' };
const groupBtn = {
  display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
  background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8,
  cursor: 'pointer', fontSize: 13, width: '100%', color: '#374151',
};
const groupBtnActive = (color) => ({
  ...groupBtn, background: `${color}18`, border: `1px solid ${color}`, color: '#0f172a', fontWeight: 700,
});
const badge = {
  background: '#e2e8f0', color: '#334155', fontSize: 11, fontWeight: 700,
  padding: '1px 7px', borderRadius: 20, flexShrink: 0,
};
const noteStyle = { fontSize: 12, color: '#475569', padding: '6px 10px' };
const deleteGroupBtn = {
  padding: '0 10px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8,
  cursor: 'pointer', color: '#b91c1c', display: 'flex', alignItems: 'center', flexShrink: 0,
};
const itemBtn = {
  flex: 1, minWidth: 0, display: 'block', textAlign: 'left', background: 'none', border: 'none',
  padding: '8px 4px 8px 10px', cursor: 'pointer', color: 'inherit', borderRadius: 6,
};
const iconBtn = {
  background: 'none', border: 'none', cursor: 'pointer', color: '#64748b',
  width: 24, height: 24, borderRadius: 4,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};
