import { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Layers, Check } from 'lucide-react';

const MAP_TYPES = [
  { id: 'hybrid', label: 'Híbrido', url: 'https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', attr: '© Google', subdomains: ['0','1','2','3'] },
  { id: 'satellite', label: 'Satélite', url: 'https://mt{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', attr: '© Google', subdomains: ['0','1','2','3'] },
  { id: 'osm', label: 'Estándar', url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', attr: '© OpenStreetMap', subdomains: ['a','b','c'] },
];

const RALENTIES_COLOR = '#7c3aed';

function createPinIcon(color) {
  const svg = `<svg width="28" height="36" viewBox="0 0 28 36" xmlns="http://www.w3.org/2000/svg">
    <path d="M14 0C6.268 0 0 6.268 0 14c0 9.9 12.43 21.49 12.96 22.01a1.4 1.4 0 002.08 0C15.57 35.49 28 23.9 28 14 28 6.268 21.732 0 14 0z" fill="${color}"/>
    <circle cx="14" cy="14" r="6" fill="white"/>
  </svg>`;
  return L.divIcon({ html: svg, className: '', iconSize: [28, 36], iconAnchor: [14, 36], popupAnchor: [0, -38] });
}

function FitBounds({ points }) {
  const map = useMap();
  useEffect(() => {
    if (!points.length) return;
    map.fitBounds(points.map(p => [p.latitude, p.longitude]), { padding: [50, 50], maxZoom: 15 });
  }, [points, map]);
  return null;
}

export default function ReportDayMap({ observations }) {
  const withCoords = observations.filter(o => o.latitude != null && o.longitude != null);
  const [mapType, setMapType] = useState('hybrid');
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerRef = useRef(null);
  const current = MAP_TYPES.find(t => t.id === mapType);
  const icon = createPinIcon(RALENTIES_COLOR);

  useEffect(() => {
    if (!pickerOpen) return;
    const close = (e) => { if (pickerRef.current && !pickerRef.current.contains(e.target)) setPickerOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [pickerOpen]);

  if (!withCoords.length) return null;

  const center = (() => {
    const lat = withCoords.reduce((s, p) => s + p.latitude, 0) / withCoords.length;
    const lng = withCoords.reduce((s, p) => s + p.longitude, 0) / withCoords.length;
    return [lat, lng];
  })();

  return (
    <div style={{ position: 'relative', height: 360, borderRadius: 12, overflow: 'hidden', border: '1px solid #e2e8f0' }}>
      <MapContainer center={center} zoom={12} style={{ height: '100%', width: '100%' }}>
        <TileLayer key={mapType} attribution={current.attr} url={current.url} subdomains={current.subdomains} />
        <FitBounds points={withCoords} />
        {withCoords.map((obs, i) => (
          <Marker key={i} position={[obs.latitude, obs.longitude]} icon={icon}>
            <Popup>
              <div style={{ fontFamily: 'inherit', minWidth: 220 }}>
                <div style={{ background: RALENTIES_COLOR, color: 'white', padding: '10px 14px', borderRadius: '10px 10px 0 0', fontWeight: 700, fontSize: 14 }}>
                  {obs.vehicle_num} · {obs.plate}
                </div>
                <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <Row label="Sucursal" value={obs.branch || '—'} />
                  <Row label="Hora" value={obs.time || '—'} />
                  <Row label="Tiempo parado" value={obs.duration || '—'} />
                  {obs.observation && (
                    <div style={{ marginTop: 4, fontSize: 12, color: '#374151', borderTop: '1px solid #f1f5f9', paddingTop: 6 }}>
                      {obs.observation}
                    </div>
                  )}
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      {/* Map type switcher */}
      <div ref={pickerRef} style={{ position: 'absolute', top: 10, right: 10, zIndex: 1000 }}>
        <button onClick={() => setPickerOpen(o => !o)} style={{ background: pickerOpen ? '#7c3aed' : 'white', border: 'none', borderRadius: 8, padding: '7px 9px', cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.25)', display: 'flex', alignItems: 'center' }}>
          <Layers size={18} color={pickerOpen ? 'white' : '#374151'} />
        </button>
        {pickerOpen && (
          <div style={{ position: 'absolute', top: 'calc(100% + 6px)', right: 0, background: 'white', borderRadius: 10, boxShadow: '0 4px 20px rgba(0,0,0,0.18)', overflow: 'hidden', minWidth: 130 }}>
            {MAP_TYPES.map((t, i) => (
              <button key={t.id} onClick={() => { setMapType(t.id); setPickerOpen(false); }} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 14px', width: '100%', background: mapType === t.id ? '#f5f3ff' : 'white', color: mapType === t.id ? '#7c3aed' : '#374151', border: 'none', borderTop: i > 0 ? '1px solid #f1f5f9' : 'none', cursor: 'pointer', fontSize: 13, fontWeight: mapType === t.id ? 700 : 400, textAlign: 'left', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
                <span style={{ width: 14, display: 'flex', alignItems: 'center' }}>{mapType === t.id && <Check size={13} />}</span>
                {t.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Marker count badge */}
      <div style={{ position: 'absolute', bottom: 10, left: 10, zIndex: 1000, background: 'white', borderRadius: 8, padding: '4px 10px', boxShadow: '0 2px 8px rgba(0,0,0,0.2)', fontSize: 12, fontWeight: 600, color: RALENTIES_COLOR, display: 'flex', alignItems: 'center', gap: 5 }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: RALENTIES_COLOR, display: 'inline-block' }} />
        {withCoords.length} ralentí{withCoords.length !== 1 ? 's' : ''} en mapa
      </div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 12 }}>
      <span style={{ color: '#64748b', flexShrink: 0 }}>{label}</span>
      <span style={{ fontWeight: 500, textAlign: 'right' }}>{value}</span>
    </div>
  );
}
