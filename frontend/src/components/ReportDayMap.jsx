import { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { plural } from '../lib/format';
import MapTypePicker, { MAP_TYPES } from './MapTypePicker';

const RALENTIES_COLOR = '#7c3aed';

function createPinIcon(color) {
  const svg = `<svg width="28" height="36" viewBox="0 0 28 36" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
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
  const [mapType, setMapType] = useState('hybrid');
  const current = MAP_TYPES.find(t => t.id === mapType);
  const icon = useMemo(() => createPinIcon(RALENTIES_COLOR), []);
  const withCoords = useMemo(
    () => observations.filter(o => o.latitude != null && o.longitude != null),
    [observations],
  );

  if (!withCoords.length) return null;

  const center = [
    withCoords.reduce((s, p) => s + p.latitude, 0) / withCoords.length,
    withCoords.reduce((s, p) => s + p.longitude, 0) / withCoords.length,
  ];

  return (
    <div style={{ position: 'relative', height: '100%', borderRadius: 12, overflow: 'hidden', border: '1px solid #e2e8f0' }}>
      <MapContainer center={center} zoom={12} style={{ height: '100%', width: '100%' }}>
        <TileLayer key={mapType} attribution={current.attr} url={current.url} subdomains={current.subdomains} />
        <FitBounds points={withCoords} />
        {withCoords.map((obs, i) => (
          <Marker key={i} position={[obs.latitude, obs.longitude]} icon={icon} title={`Ralentí de ${obs.vehicle_num}`}>
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

      <MapTypePicker value={mapType} onChange={setMapType} accent={RALENTIES_COLOR} tint="#f5f3ff" />

      <div style={{ position: 'absolute', bottom: 10, left: 10, zIndex: 1000, background: 'white', borderRadius: 8, padding: '4px 10px', boxShadow: '0 2px 8px rgba(0,0,0,0.2)', fontSize: 12, fontWeight: 600, color: RALENTIES_COLOR, display: 'flex', alignItems: 'center', gap: 5 }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: RALENTIES_COLOR, display: 'inline-block' }} />
        {withCoords.length} {plural(withCoords.length, 'ralentí', 'ralentís')} en mapa
      </div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 12 }}>
      <span style={{ color: '#475569', flexShrink: 0 }}>{label}</span>
      <span style={{ fontWeight: 500, textAlign: 'right' }}>{value}</span>
    </div>
  );
}
