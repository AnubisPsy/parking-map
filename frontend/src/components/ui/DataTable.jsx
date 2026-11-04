import { useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';

const FLEX_MIN_WIDTH = 180;

const cellLayout = (col) =>
  col.flex
    ? { flex: `${col.flex} 1 0`, minWidth: FLEX_MIN_WIDTH }
    : { flex: `0 0 ${col.width}px` };

// Tabla virtualizada: solo existen en el DOM las filas visibles. En pantallas
// angostas se desplaza en horizontal en lugar de comprimir las columnas.
export default function DataTable({ data, columns, label, maxHeight = 'calc(100dvh - 260px)' }) {
  const scrollRef = useRef(null);
  const virtualizer = useVirtualizer({
    count: data.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 41,
    overscan: 10,
  });
  const minWidth = columns.reduce((sum, col) => sum + (col.width || FLEX_MIN_WIDTH), 40);

  return (
    <div style={frame}>
      <div
        ref={scrollRef}
        role="region"
        aria-label={label}
        tabIndex={0}
        style={{ overflow: 'auto', maxHeight }}
      >
        <div role="table" aria-label={label} aria-rowcount={data.length + 1} style={{ minWidth }}>
          <div role="rowgroup" style={headerGroup}>
            <div role="row" aria-rowindex={1} style={{ display: 'flex', padding: '11px 20px' }}>
              {columns.map((col) => (
                <div key={col.key} role="columnheader" style={{ ...headerCell, ...cellLayout(col) }}>
                  {col.label}
                </div>
              ))}
            </div>
          </div>
          <div role="rowgroup" style={{ position: 'relative', height: virtualizer.getTotalSize() }}>
            {virtualizer.getVirtualItems().map((item) => {
              const row = data[item.index];
              return (
                <div
                  key={item.key}
                  ref={virtualizer.measureElement}
                  data-index={item.index}
                  role="row"
                  aria-rowindex={item.index + 2}
                  style={{
                    position: 'absolute', top: 0, left: 0, width: '100%',
                    transform: `translateY(${item.start}px)`,
                    display: 'flex', alignItems: 'center', padding: '11px 20px',
                    borderBottom: '1px solid #f1f5f9',
                    background: item.index % 2 === 0 ? 'white' : '#fafbfc',
                  }}
                >
                  {columns.map((col) => {
                    const value = row[col.key];
                    const content = col.render ? col.render(value, row) : (value || '—');
                    return (
                      <div
                        key={col.key}
                        role="cell"
                        title={typeof content === 'string' ? content : undefined}
                        style={{ ...bodyCell, ...cellLayout(col), whiteSpace: col.flex ? 'nowrap' : 'normal' }}
                      >
                        {content}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

const frame = {
  background: 'white', borderRadius: 14, overflow: 'hidden',
  boxShadow: '0 1px 3px rgba(15,23,42,0.06), 0 4px 16px rgba(15,23,42,0.04)',
  border: '1px solid rgba(15,23,42,0.05)',
};
const headerGroup = {
  position: 'sticky', top: 0, zIndex: 1,
  background: '#f8fafc', borderBottom: '1px solid #e2e8f0',
};
const headerCell = {
  fontSize: 10, fontWeight: 700, color: '#475569',
  textTransform: 'uppercase', letterSpacing: '0.09em', paddingRight: 8,
};
const bodyCell = {
  fontSize: 12, color: '#334155', overflow: 'hidden', textOverflow: 'ellipsis', paddingRight: 8,
};
