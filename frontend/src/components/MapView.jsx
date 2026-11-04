import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import MapTypePicker, { MAP_TYPES } from './MapTypePicker';
import ParkingLayer from './ParkingLayer';
import { usePlayback, TrackStaticLayers, TrackDynamicLayers, PlaybackPanel } from './TrackPlayback';

const NO_TRACKS = [];

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
export default function MapView({ parkings: latestParkings, unitColors: latestColors, highlightId, onMarkerClick, tracks: latestTracks = NO_TRACKS }) {
  // Con muchos marcadores Leaflet tarda en actualizarse: la lista responde primero y el mapa después
  const parkings = useDeferredValue(latestParkings);
  const unitColors = useDeferredValue(latestColors);
  const tracks = useDeferredValue(latestTracks);
  const [mapType, setMapType] = useState('hybrid');
  const playback = usePlayback(tracks);
  const [followId, setFollowId] = useState(null);
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
        <TileLayer
          key={mapType}
          attribution={current.attr}
          url={current.url}
          subdomains={current.subdomains}
        />
        {(parkings.length > 0 || tracks.length > 0) && <FitBounds parkings={parkings} tracks={tracks} />}
        <TrackStaticLayers tracks={tracks} onSeek={playback.seek} />
        <ParkingLayer
          parkings={parkings}
          unitColors={unitColors}
          highlightId={highlightId}
          onMarkerClick={onMarkerClick}
        />
        <TrackDynamicLayers tracks={tracks} time={playback.time} followTrack={followTrack} />
      </MapContainer>

      {tracks.length > 0 && (
        <PlaybackPanel tracks={tracks} playback={playback} followId={followId} setFollowId={setFollowId} />
      )}

      <MapTypePicker value={mapType} onChange={setMapType} />
    </div>
  );
}
