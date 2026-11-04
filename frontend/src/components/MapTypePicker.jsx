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
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attr: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    subdomains: ['a', 'b', 'c'],
  },
];

export default function MapTypePicker({ value, onChange, accent = '#2563eb', tint = '#eff6ff' }) {
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
        style={{ ...toggle, background: open ? accent : 'white' }}
      >
        <Layers size={18} color={open ? 'white' : '#374151'} />
      </button>

      {open && (
        <div role="group" aria-label="Tipo de mapa" style={menu}>
          {MAP_TYPES.map((t, i) => {
            const selected = value === t.id;
            return (
              <button
                key={t.id}
                onClick={() => { onChange(t.id); setOpen(false); toggleRef.current?.focus(); }}
                aria-pressed={selected}
                style={{
                  ...option,
                  background: selected ? tint : 'white',
                  color: selected ? accent : '#374151',
                  borderTop: i > 0 ? '1px solid #f1f5f9' : 'none',
                  fontWeight: selected ? 700 : 400,
                }}
              >
                <span style={{ width: 14, display: 'flex', alignItems: 'center' }}>
                  {selected && <Check size={13} />}
                </span>
                {t.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

const toggle = {
  border: 'none', borderRadius: 8, padding: '7px 9px', cursor: 'pointer',
  boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};
const menu = {
  position: 'absolute', top: 'calc(100% + 6px)', right: 0, background: 'white',
  borderRadius: 10, boxShadow: '0 4px 20px rgba(0,0,0,0.18)', overflow: 'hidden', minWidth: 130,
};
const option = {
  display: 'flex', alignItems: 'center', gap: 8, padding: '9px 14px', width: '100%',
  border: 'none', cursor: 'pointer', fontSize: 13, textAlign: 'left', whiteSpace: 'nowrap',
};
