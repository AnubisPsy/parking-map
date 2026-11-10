import { useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';

const FLEX_MIN_WIDTH = 180;

const cellLayout = (col) =>
  col.flex
    ? { flex: `${col.flex} 1 0`, minWidth: FLEX_MIN_WIDTH }
    : { flex: `0 0 ${col.width}px` };

// Tabla virtualizada: solo existen en el DOM las filas visibles. En pantallas
// angostas se desplaza en horizontal en lugar de comprimir las columnas.
export default function DataTable({ data, columns, label, maxHeight = 'calc(100dvh - 300px)' }) {
  const scrollRef = useRef(null);
  const virtualizer = useVirtualizer({
    count: data.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 39,
    overscan: 10,
  });
  const minWidth = columns.reduce((sum, col) => sum + (col.width || FLEX_MIN_WIDTH), 32);

  return (
    <div className="table-frame">
      <div ref={scrollRef} role="region" aria-label={label} tabIndex={0} style={{ overflow: 'auto', maxHeight }}>
        <div role="table" aria-label={label} aria-rowcount={data.length + 1} style={{ minWidth }}>
          <div role="rowgroup" className="table-head">
            <div role="row" aria-rowindex={1} style={{ display: 'flex', padding: '9px 16px' }}>
              {columns.map((col) => (
                <div key={col.key} role="columnheader" className="table-th" style={cellLayout(col)}>
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
                  className="table-row"
                  style={{
                    position: 'absolute', top: 0, left: 0, width: '100%',
                    transform: `translateY(${item.start}px)`,
                    display: 'flex', alignItems: 'center', padding: '9px 16px',
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
                        className="table-td"
                        style={{ ...cellLayout(col), whiteSpace: col.flex ? 'nowrap' : 'normal' }}
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
