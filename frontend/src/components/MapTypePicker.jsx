import { useEffect, useRef, useState } from 'react';
import { Check, Layers } from 'lucide-react';

export const MAP_TYPES = [
  {
    id: 'hybrid',
    label: 'Híbrido',
    url: 'https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
    attr: '© Google',
    subdomains: ['0', '1', '2', '3'],
  },
  {
    id: 'satellite',
    label: 'Satélite',
    url: 'https://mt{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
    attr: '© Google',
    subdomains: ['0', '1', '2', '3'],
  },
  {
    id: 'osm',
    label: 'Estándar',
    // Servidor único recomendado por OpenStreetMap; los subdominios a/b/c están en desuso
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attr: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    // Sin {s} en la URL no se usa, pero Leaflet falla si recibe `undefined`
    subdomains: ['a'],
  },
];

export default function MapTypePicker({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const toggleRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    function onMouseDown(e) {
      if (!rootRef.current?.contains(e.target)) setOpen(false);
    }
    function onKeyDown(e) {
      if (e.key === 'Escape') {
        setOpen(false);
        toggleRef.current?.focus();
      }
    }
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} style={{ position: 'absolute', top: 10, right: 10, zIndex: 1000 }}>
      <button
        ref={toggleRef}
        onClick={() => setOpen((o) => !o)}
        aria-label="Tipo de mapa"
        aria-expanded={open}
        title="Tipo de mapa"
        className="map-toggle"
      >
        <Layers size={18} />
      </button>

      {open && (
        <div role="group" aria-label="Tipo de mapa" className="map-control map-menu">
          {MAP_TYPES.map((t) => {
            const selected = value === t.id;
            return (
              <button
                key={t.id}
                onClick={() => { onChange(t.id); setOpen(false); toggleRef.current?.focus(); }}
                aria-pressed={selected}
                className="map-option"
              >
                <span style={{ width: 14, display: 'flex' }}>{selected && <Check size={14} />}</span>
                {t.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
