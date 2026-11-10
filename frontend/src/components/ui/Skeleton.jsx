export function Skeleton({ width = '100%', height = 16, radius, style }) {
  return <span className="skeleton" style={{ width, height, borderRadius: radius, ...style }} />;
}

// Contenedor anunciado a los lectores de pantalla; las barras internas son decorativas
function Loading({ label, style, className, children }) {
  return (
    <div role="status" aria-label={label} className={className} style={style}>
      <div aria-hidden="true" style={{ display: 'contents' }}>{children}</div>
    </div>
  );
}

export function ListSkeleton({ rows = 7, rowHeight = 34, label = 'Cargando registros' }) {
  return (
    <Loading label={label} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {Array.from({ length: rows }, (_, i) => <Skeleton key={i} height={rowHeight} />)}
    </Loading>
  );
}

export function MapSkeleton({ label = 'Cargando mapa' }) {
  return (
    <Loading label={label} style={{ height: '100%', width: '100%' }}>
      <Skeleton height="100%" radius={0} />
    </Loading>
  );
}

// Reporte completo: encabezado, pestañas, tarjetas y gráficas
export function ReportSkeleton() {
  return (
    <Loading label="Cargando reporte" className="page">
      <div style={{ background: 'var(--surface)', minHeight: 'var(--header-height)', borderBottom: '1px solid var(--border)', flexShrink: 0 }} />
      <div style={{ background: 'var(--surface)', height: 116, borderBottom: '1px solid var(--border)', flexShrink: 0 }} />
      <div className="scroll-body" style={{ overflow: 'hidden' }}>
        <div className="content">
          <div className="grid-auto" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))' }}>
            {[0, 1, 2].map((i) => <Skeleton key={i} height={82} radius={12} />)}
          </div>
          <div className="grid-auto" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))' }}>
            {[0, 1, 2, 3].map((i) => <Skeleton key={i} height={240} radius={12} />)}
          </div>
        </div>
      </div>
    </Loading>
  );
}

// Respaldo de Suspense mientras llega el código de una página
export function PageSkeleton() {
  return (
    <Loading label="Cargando página" className="page">
      <div style={{ background: 'var(--surface)', minHeight: 'var(--header-height)', borderBottom: '1px solid var(--border)', flexShrink: 0 }} />
      <div style={{ flex: 1, minHeight: 0, padding: 16 }}>
        <Skeleton height="100%" radius={12} />
      </div>
    </Loading>
  );
}
