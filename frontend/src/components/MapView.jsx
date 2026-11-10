import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import MapTypePicker, { MAP_TYPES } from './MapTypePicker';
import ParkingLayer from './ParkingLayer';
import MapUnmountGuard from './MapUnmountGuard';
import { usePlayback, TrackStaticLayers, TrackDynamicLayers, PlaybackPanel, parkedStopIds } from './TrackPlayback';

const NO_TRACKS = [];
const BACKDROP_ZOOM = 15;

// Respaldo con menos detalle: cada mosaico cubre 64 veces más terreno, así que
// carga aunque el mapa avance rápido (al seguir una unidad con mucho zoom) y se
// ve borroso en vez de en blanco mientras llegan los nítidos de encima. Se monta
// solo con zoom cercano: con minZoom, Leaflet falla al animar el zoom por debajo.
function BackdropLayer({ type }) {
  const map = useMap();
  const [zoom, setZoom] = useState(() => map.getZoom());
  useMapEvents({ zoomend: () => setZoom(map.getZoom()) });
  if (zoom <= BACKDROP_ZOOM) return null;
  return <TileLayer url={type.url} subdomains={type.subdomains} maxNativeZoom={BACKDROP_ZOOM} zIndex={0} />;
}

function FitBounds({ parkings, tracks }) {
  const map = useMap();
  useEffect(() => {
    const bounds = [
      ...parkings.map(p => [p.latitude, p.longitude]),
      ...tracks.flatMap(t => t.pts.map(p => [p.lat, p.lng])),
    ];
    if (!bounds.length) return;
    map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
  }, [parkings, tracks, map]);
  return null;
}

// `tracks` llega ya preparado con prepareTracks() (puntos en ms, color y paradas)
// `viewKey`: cambia cuando cambia lo que se está viendo y reinicia la reproducción
export default function MapView({ parkings: latestParkings, unitColors: latestColors, highlightId, onMarkerClick, tracks: latestTracks = NO_TRACKS, viewKey: latestViewKey = '' }) {
  // Con muchos marcadores Leaflet tarda en actualizarse: la lista responde primero y el mapa después
  const parkings = useDeferredValue(latestParkings);
  const unitColors = useDeferredValue(latestColors);
  const tracks = useDeferredValue(latestTracks);
  // Diferido junto con los recorridos, para reiniciar ya con el rango nuevo
  const viewKey = useDeferredValue(latestViewKey);
  const [mapType, setMapType] = useState('hybrid');
  const playback = usePlayback(tracks, viewKey);
  const [followId, setFollowId] = useState(null);
  const [showRoute, setShowRoute] = useState(true);
  // Texto estable: la capa de pines solo se actualiza al llegar o salir de una parada,
  // no en cada cuadro de la animación
  const parkedKey = parkedStopIds(tracks, playback.time).sort().join('|');
  const parkedIds = useMemo(() => new Set(parkedKey ? parkedKey.split('|') : []), [parkedKey]);
  const followTrack = tracks.find(t => t.id === followId) || null;
  const current = MAP_TYPES.find(t => t.id === mapType);

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
        <MapUnmountGuard />
        <BackdropLayer key={`${mapType}-fondo`} type={current} />
        <TileLayer
          key={mapType}
          zIndex={1}
          keepBuffer={4}
          attribution={current.attr}
          url={current.url}
          subdomains={current.subdomains}
        />
        {(parkings.length > 0 || tracks.length > 0) && <FitBounds parkings={parkings} tracks={tracks} />}
        <TrackStaticLayers tracks={tracks} onSeek={playback.seek} showRoute={showRoute} />
        <ParkingLayer
          parkings={parkings}
          unitColors={unitColors}
          highlightId={highlightId}
          onMarkerClick={onMarkerClick}
          parkedIds={parkedIds}
          following={followTrack != null}
        />
        <TrackDynamicLayers tracks={tracks} time={playback.time} followTrack={followTrack} showRoute={showRoute} />
      </MapContainer>

      {tracks.length > 0 && (
        <PlaybackPanel tracks={tracks} playback={playback} followId={followId} setFollowId={setFollowId} showRoute={showRoute} setShowRoute={setShowRoute} />
      )}

      <MapTypePicker value={mapType} onChange={setMapType} />
    </div>
  );
}
