import { useEffect, useRef, useState } from 'react';
import { Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet.markercluster';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import { NEUTRAL } from '../lib/colors';
import { formatDateTime, formatDuration } from '../lib/format';

// Por debajo de este número cada parada se ve como su propio pin
const CLUSTER_MIN_MARKERS = 200;

const pinIcons = new Map();

// Un icono compartido por color: Leaflet no tiene que reconstruir nada al reutilizarlo
function getPinIcon(color, highlighted) {
  const key = `${color}|${highlighted}`;
  if (!pinIcons.has(key)) pinIcons.set(key, createPinIcon(color, highlighted));
  return pinIcons.get(key);
}

// Pin blanco con borde y "P" del color de la unidad, para distinguirlo de las
// líneas de ruta (que usan el mismo color en sólido). Seleccionado: relleno ámbar.
function createPinIcon(color, highlighted) {
  const fill = highlighted ? '#f59e0b' : 'white';
  const accent = highlighted ? 'white' : color;
  const svg = `<svg width="28" height="36" viewBox="-1.5 -1.5 31 39" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M14 0C6.268 0 0 6.268 0 14c0 9.9 12.43 21.49 12.96 22.01a1.4 1.4 0 002.08 0C15.57 35.49 28 23.9 28 14 28 6.268 21.732 0 14 0z"
      fill="${fill}" stroke="${highlighted ? '#b45309' : color}" stroke-width="3"/>
    <text x="14" y="19.5" text-anchor="middle" font-family="Arial, sans-serif" font-size="15" font-weight="900" fill="${accent}">P</text>
  </svg>`;
  return L.divIcon({
    html: svg,
    className: '',
    iconSize: [28, 36],
    iconAnchor: [14, 36],
    popupAnchor: [0, -38],
  });
}

// Marcadores creados directamente con Leaflet: miles de componentes React por
// marcador bloquean la página, y solo uno de ellos tiene el popup abierto a la vez.
export default function ParkingLayer({ parkings, unitColors, highlightId, onMarkerClick }) {
  const map = useMap();
  const [popupId, setPopupId] = useState(null);
  const markersRef = useRef(new Map());
  const groupRef = useRef(null);
  const highlightRef = useRef(highlightId);
  const onClickRef = useRef(onMarkerClick);
  onClickRef.current = onMarkerClick;

  const clustered = parkings.length >= CLUSTER_MIN_MARKERS;

  useEffect(() => {
    const group = clustered
      ? L.markerClusterGroup({
          chunkedLoading: true,
          maxClusterRadius: 45,
          disableClusteringAtZoom: 17,
          showCoverageOnHover: false,
        })
      : L.featureGroup();

    const byId = new Map();
    const markers = parkings.map((p) => {
      const color = unitColors[p.unit_id] || NEUTRAL;
      const marker = L.marker([p.latitude, p.longitude], {
        icon: getPinIcon(color, highlightRef.current === p.id),
        title: `Estacionamiento de ${p.unit_name || p.unit_id}`,
      });
      marker.parkingColor = color;
      marker.on('click', () => {
        onClickRef.current?.(p.id);
        setPopupId((prev) => (prev === p.id ? null : p.id));
      });
      byId.set(p.id, marker);
      return marker;
    });

    if (clustered) group.addLayers(markers);
    else markers.forEach((marker) => group.addLayer(marker));
    group.addTo(map);

    markersRef.current = byId;
    groupRef.current = group;
    return () => { map.removeLayer(group); };
  }, [map, parkings, unitColors, clustered]);

  useEffect(() => {
    const previous = markersRef.current.get(highlightRef.current);
    if (previous) previous.setIcon(getPinIcon(previous.parkingColor, false));
    highlightRef.current = highlightId;

    const marker = markersRef.current.get(highlightId);
    if (!marker) return;
    marker.setIcon(getPinIcon(marker.parkingColor, true));
    // Dentro de un grupo el pin no existe en el mapa hasta acercarse lo suficiente
    if (groupRef.current?.zoomToShowLayer) {
      groupRef.current.zoomToShowLayer(marker);
    } else {
      map.flyTo(marker.getLatLng(), Math.max(map.getZoom(), 15), { duration: 0.7 });
    }
  }, [highlightId, map]);

  const popupParking = popupId ? parkings.find((p) => p.id === popupId) : null;
  if (!popupParking) return null;

  return (
    <ParkingPopup
      key={popupParking.id}
      parking={popupParking}
      color={unitColors[popupParking.unit_id] || NEUTRAL}
      onClose={() => setPopupId((prev) => (prev === popupParking.id ? null : prev))}
    />
  );
}

function ParkingPopup({ parking: p, color, onClose }) {
  return (
    <Popup position={[p.latitude, p.longitude]} offset={[0, -31]} eventHandlers={{ remove: onClose }}>
      <div style={{ fontFamily: 'inherit', minWidth: 220 }}>
        <div style={{
          background: color,
          color: 'white',
          padding: '10px 14px',
          borderRadius: '10px 10px 0 0',
          fontWeight: 700,
          fontSize: 15,
        }}>
          {p.unit_name || p.unit_id}
        </div>
        <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <Row label="ID Unidad" value={p.unit_id} />
          <Row label="Tiempo estacionado" value={formatDuration(p.parking_duration) ?? '—'} />
          <Row label="Inicio" value={formatDateTime(p.parking_start)} />
          <Row label="Coordenadas" value={`${p.latitude.toFixed(6)}, ${p.longitude.toFixed(6)}`} />
          {p.address && <Row label="Dirección" value={p.address} />}
          {p.notes && <Row label="Notas" value={p.notes} />}
          <div style={{ fontSize: 11, color: '#475569', marginTop: 4 }}>
            Registrado: {formatDateTime(p.created_at)}
          </div>
        </div>
      </div>
    </Popup>
  );
}

function Row({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 13 }}>
      <span style={{ color: '#475569', flexShrink: 0 }}>{label}</span>
      <span style={{ fontWeight: 500, textAlign: 'right', wordBreak: 'break-all' }}>{value}</span>
    </div>
  );
}
