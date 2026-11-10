import { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { plural } from '../lib/format';
import MapTypePicker, { MAP_TYPES } from './MapTypePicker';
import MapUnmountGuard from './MapUnmountGuard';

const PIN_COLOR = '#256abf';

function createPinIcon(color) {
  const svg = `<svg width="28" height="36" viewBox="0 0 28 36" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M14 0C6.268 0 0 6.268 0 14c0 9.9 12.43 21.49 12.96 22.01a1.4 1.4 0 002.08 0C15.57 35.49 28 23.9 28 14 28 6.268 21.732 0 14 0z" fill="${color}" stroke="white" stroke-width="1.5"/>
    <circle cx="14" cy="14" r="5" fill="white"/>
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
  const icon = useMemo(() => createPinIcon(PIN_COLOR), []);
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
    <div className="day-map">
      <MapContainer center={center} zoom={12} style={{ height: '100%', width: '100%' }}>
        <TileLayer key={mapType} attribution={current.attr} url={current.url} subdomains={current.subdomains} />
        <FitBounds points={withCoords} />
        <MapUnmountGuard />
        {withCoords.map((obs, i) => (
          <Marker key={i} position={[obs.latitude, obs.longitude]} icon={icon} title={`Ralentí de ${obs.vehicle_num}`}>
            <Popup>
              <div className="popup-head">{obs.vehicle_num} · {obs.plate}</div>
              <div className="popup-body">
                <Row label="Sucursal" value={obs.branch || '—'} />
                <Row label="Hora" value={obs.time || '—'} />
                <Row label="Tiempo parado" value={obs.duration || '—'} />
                {obs.observation && <p style={{ margin: '4px 0 0', color: 'var(--ink-2)' }}>{obs.observation}</p>}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      <MapTypePicker value={mapType} onChange={setMapType} />

      <div className="map-control map-note">
        {withCoords.length} {plural(withCoords.length, 'ralentí', 'ralentís')} en el mapa
      </div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="popup-row">
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
