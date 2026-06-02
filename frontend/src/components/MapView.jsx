import { useEffect, useMemo, useState, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Layers, Check } from 'lucide-react';

const MAP_TYPES = [
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

const COLORS = [
  '#2563eb', '#dc2626', '#16a34a', '#d97706', '#7c3aed',
  '#0891b2', '#be185d', '#15803d', '#b45309', '#4338ca',
  '#0284c7', '#c2410c', '#166534', '#a16207', '#6d28d9',
];

function createPinIcon(color) {
  const svg = `<svg width="28" height="36" viewBox="0 0 28 36" xmlns="http://www.w3.org/2000/svg">
    <path d="M14 0C6.268 0 0 6.268 0 14c0 9.9 12.43 21.49 12.96 22.01a1.4 1.4 0 002.08 0C15.57 35.49 28 23.9 28 14 28 6.268 21.732 0 14 0z" fill="${color}"/>
    <circle cx="14" cy="14" r="6" fill="white"/>
  </svg>`;
  return L.divIcon({
    html: svg,
    className: '',
    iconSize: [28, 36],
    iconAnchor: [14, 36],
    popupAnchor: [0, -38],
  });
}

function formatDuration(minutes) {
  if (!minutes) return '—';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}min`;
}

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-MX', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

function FitBounds({ parkings }) {
  const map = useMap();
  useEffect(() => {
    if (!parkings.length) return;
    const bounds = parkings.map(p => [p.latitude, p.longitude]);
    map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
  }, [parkings, map]);
  return null;
}

function FlyToMarker({ parkings, highlightId }) {
  const map = useMap();
  const parkingsRef = useRef(parkings);
  parkingsRef.current = parkings;
  useEffect(() => {
    if (!highlightId) return;
    const p = parkingsRef.current.find(item => item.id === highlightId);
    if (!p) return;
    map.flyTo([p.latitude, p.longitude], Math.max(map.getZoom(), 15), { duration: 0.7 });
  }, [highlightId, map]);
  return null;
}

export default function MapView({ parkings, unitColors, highlightId, onMarkerClick }) {
  const [mapType, setMapType] = useState('hybrid');
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerRef = useRef(null);
  const current = MAP_TYPES.find(t => t.id === mapType);

  useEffect(() => {
    if (!pickerOpen) return;
    function handleOutside(e) {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) {
        setPickerOpen(false);
      }
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [pickerOpen]);

  const center = useMemo(() => {
    if (!parkings.length) return [15.7764, -86.7920]; // La Ceiba, Honduras
    const lat = parkings.reduce((s, p) => s + p.latitude, 0) / parkings.length;
    const lng = parkings.reduce((s, p) => s + p.longitude, 0) / parkings.length;
    return [lat, lng];
  }, [parkings]);

  return (
    <div style={{ position: 'relative', height: '100%', width: '100%' }}>
      <MapContainer
        center={center}
        zoom={12}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          key={mapType}
          attribution={current.attr}
          url={current.url}
          subdomains={current.subdomains}
        />
        {parkings.length > 0 && <FitBounds parkings={parkings} />}
      <FlyToMarker parkings={parkings} highlightId={highlightId} />
        {parkings.map((p) => {
          const color = unitColors[p.unit_id] || '#64748b';
          const icon = createPinIcon(highlightId === p.id ? '#f59e0b' : color);
          return (
            <Marker
              key={p.id}
              position={[p.latitude, p.longitude]}
              icon={icon}
              eventHandlers={{ click: () => onMarkerClick?.(p.id) }}
            >
              <Popup>
                <div style={{ fontFamily: 'inherit', minWidth: 220 }}>
                  <div style={{
                    background: color,
                    color: 'white',
                    padding: '10px 14px',
                    borderRadius: '10px 10px 0 0',
                    fontWeight: 700,
                    fontSize: 15
                  }}>
                    {p.unit_name || p.unit_id}
                  </div>
                  <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <Row label="ID Unidad" value={p.unit_id} />
                    <Row label="Tiempo estacionado" value={formatDuration(p.parking_duration)} />
                    <Row label="Inicio" value={formatDate(p.parking_start)} />
                    <Row label="Coordenadas" value={`${p.latitude.toFixed(6)}, ${p.longitude.toFixed(6)}`} />
                    {p.address && <Row label="Dirección" value={p.address} />}
                    {p.notes && <Row label="Notas" value={p.notes} />}
                    <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>
                      Registrado: {formatDate(p.created_at)}
                    </div>
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>

      {/* Map type switcher */}
      <div ref={pickerRef} style={{ position: 'absolute', top: 10, right: 10, zIndex: 1000 }}>
        <button
          onClick={() => setPickerOpen(o => !o)}
          title="Tipo de mapa"
          style={{
            background: pickerOpen ? '#2563eb' : 'white',
            border: 'none',
            borderRadius: 8,
            padding: '7px 9px',
            cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Layers size={18} color={pickerOpen ? 'white' : '#374151'} />
        </button>

        {pickerOpen && (
          <div style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            right: 0,
            background: 'white',
            borderRadius: 10,
            boxShadow: '0 4px 20px rgba(0,0,0,0.18)',
            overflow: 'hidden',
            minWidth: 130,
          }}>
            {MAP_TYPES.map((t, i) => (
              <button
                key={t.id}
                onClick={() => { setMapType(t.id); setPickerOpen(false); }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '9px 14px',
                  width: '100%',
                  background: mapType === t.id ? '#eff6ff' : 'white',
                  color: mapType === t.id ? '#2563eb' : '#374151',
                  border: 'none',
                  borderTop: i > 0 ? '1px solid #f1f5f9' : 'none',
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: mapType === t.id ? 700 : 400,
                  textAlign: 'left',
                  fontFamily: 'inherit',
                  whiteSpace: 'nowrap',
                }}
              >
                <span style={{ width: 14, display: 'flex', alignItems: 'center' }}>
                  {mapType === t.id && <Check size={13} />}
                </span>
                {t.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 13 }}>
      <span style={{ color: '#64748b', flexShrink: 0 }}>{label}</span>
      <span style={{ fontWeight: 500, textAlign: 'right', wordBreak: 'break-all' }}>{value}</span>
    </div>
  );
}
