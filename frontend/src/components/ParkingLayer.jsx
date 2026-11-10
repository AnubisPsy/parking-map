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

const NO_IDS = new Set();
const PARKED = '#d92d20';

// Un icono compartido por color y estado: Leaflet no tiene que reconstruir nada al reutilizarlo
function getPinIcon(color, highlighted, parked = false) {
  const key = `${color}|${highlighted}|${parked}`;
  if (!pinIcons.has(key)) pinIcons.set(key, createPinIcon(color, highlighted, parked));
  return pinIcons.get(key);
}

// Pin blanco con borde del color de la unidad, para distinguirlo de las líneas de
// ruta (que usan el mismo color en sólido). Seleccionado: relleno ámbar.
// Con la unidad estacionada ahí durante la reproducción: rojo con la P en blanco.
function createPinIcon(color, highlighted, parked) {
  const fill = highlighted ? '#f59e0b' : parked ? PARKED : 'white';
  const stroke = highlighted ? '#8a5300' : parked ? '#8f1a12' : color;
  const svg = `<svg width="28" height="36" viewBox="-1.5 -1.5 31 39" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M14 0C6.268 0 0 6.268 0 14c0 9.9 12.43 21.49 12.96 22.01a1.4 1.4 0 002.08 0C15.57 35.49 28 23.9 28 14 28 6.268 21.732 0 14 0z"
      fill="${fill}" stroke="${stroke}" stroke-width="3"/>
    <text x="14" y="19.5" text-anchor="middle" font-family="Arial, sans-serif" font-size="15" font-weight="700" fill="${parked && !highlighted ? 'white' : '#1a1a18'}">P</text>
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
export default function ParkingLayer({ parkings, unitColors, highlightId, onMarkerClick, parkedIds = NO_IDS }) {
  const map = useMap();
  const [popupId, setPopupId] = useState(null);
  const markersRef = useRef(new Map());
  const groupRef = useRef(null);
  // Pines rojos fuera de los grupos: deben verse aunque el mapa esté alejado
  const parkedLayerRef = useRef(null);
  const highlightRef = useRef(highlightId);
  const parkedRef = useRef(parkedIds);
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
        icon: getPinIcon(color, highlightRef.current === p.id, parkedRef.current.has(p.id)),
        title: `Estacionamiento de ${p.unit_name || p.unit_id}`,
      });
      marker.parkingColor = color;
      marker.on('click', () => onClickRef.current?.(p.id));
      byId.set(p.id, marker);
      return marker;
    });

    const parkedLayer = L.layerGroup();
    const free = clustered ? markers.filter((m, i) => !parkedRef.current.has(parkings[i].id)) : markers;
    if (clustered) {
      group.addLayers(free);
      markers.forEach((m, i) => { if (parkedRef.current.has(parkings[i].id)) parkedLayer.addLayer(m); });
    } else {
      markers.forEach((marker) => group.addLayer(marker));
    }
    group.addTo(map);
    parkedLayer.addTo(map);

    markersRef.current = byId;
    groupRef.current = group;
    parkedLayerRef.current = parkedLayer;
    return () => {
      map.removeLayer(group);
      map.removeLayer(parkedLayer);
    };
  }, [map, parkings, unitColors, clustered]);

  // Durante la reproducción, el pin donde está parada la unidad se pinta de rojo
  useEffect(() => {
    const previous = parkedRef.current;
    parkedRef.current = parkedIds;
    for (const id of new Set([...previous, ...parkedIds])) {
      const marker = markersRef.current.get(id);
      if (!marker || previous.has(id) === parkedIds.has(id)) continue;
      marker.setIcon(getPinIcon(marker.parkingColor, highlightRef.current === id, parkedIds.has(id)));
      marker.setZIndexOffset(parkedIds.has(id) ? 500 : 0);
      const group = groupRef.current;
      if (!group?.zoomToShowLayer) continue;
      if (parkedIds.has(id)) {
        group.removeLayer(marker);
        parkedLayerRef.current.addLayer(marker);
      } else {
        parkedLayerRef.current.removeLayer(marker);
        group.addLayer(marker);
      }
    }
  }, [parkedIds]);

  // Seleccionar un registro, desde la lista o el mapa, lo centra y muestra sus detalles
  useEffect(() => {
    const previous = markersRef.current.get(highlightRef.current);
    if (previous) previous.setIcon(getPinIcon(previous.parkingColor, false, parkedRef.current.has(highlightRef.current)));
    highlightRef.current = highlightId;

    const marker = markersRef.current.get(highlightId);
    if (!marker) {
      setPopupId(null);
      return undefined;
    }
    marker.setIcon(getPinIcon(marker.parkingColor, true, parkedRef.current.has(highlightId)));

    const showPopup = () => setPopupId(highlightId);
    // Dentro de un grupo el pin no existe en el mapa hasta acercarse lo suficiente
    if (groupRef.current?.zoomToShowLayer && groupRef.current.hasLayer(marker)) {
      groupRef.current.zoomToShowLayer(marker, showPopup);
      return undefined;
    }
    // El popup espera a que termine el vuelo: su ajuste automático lo interrumpiría
    map.once('moveend', showPopup);
    map.flyTo(marker.getLatLng(), Math.max(map.getZoom(), 15), { duration: 0.7 });
    return () => { map.off('moveend', showPopup); };
  }, [highlightId, map]);

  const popupParking = popupId ? parkings.find((p) => p.id === popupId) : null;
  if (!popupParking) return null;

  return (
    <ParkingPopup
      key={popupParking.id}
      parking={popupParking}
      color={unitColors[popupParking.unit_id] || NEUTRAL}
      onClose={() => {
        // Cerrar el popup también quita la selección, para poder volver a abrirlo con un clic
        if (highlightRef.current === popupParking.id) onClickRef.current?.(popupParking.id);
      }}
    />
  );
}

function ParkingPopup({ parking: p, color, onClose }) {
  return (
    <Popup position={[p.latitude, p.longitude]} offset={[0, -31]} eventHandlers={{ remove: onClose }}>
      <div className="popup-head">
        <span className="dot" style={{ background: color }} />
        <span>{p.unit_name || p.unit_id}</span>
      </div>
      <div className="popup-body">
        <Row label="Unidad" value={p.unit_id} />
        <Row label="Tiempo estacionado" value={formatDuration(p.parking_duration) ?? '—'} />
        <Row label="Inicio" value={formatDateTime(p.parking_start)} />
        {p.address && <Row label="Sucursal" value={p.address} />}
        <Row label="Coordenadas" value={`${p.latitude.toFixed(5)}, ${p.longitude.toFixed(5)}`} />
        {p.notes && <Row label="Notas" value={p.notes} />}
      </div>
    </Popup>
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
