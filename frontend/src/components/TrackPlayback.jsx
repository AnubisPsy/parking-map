import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Polyline, CircleMarker, Marker, Tooltip, Pane, useMap } from 'react-leaflet';
import L from 'leaflet';
import {
  Play, Pause, SkipBack, SkipForward, StepBack, StepForward,
  ChevronsLeft, ChevronsRight, Crosshair, Minimize2, Route,
} from 'lucide-react';

const SPEEDS = [1, 10, 30, 60, 120, 300, 600];

// ── Utilidades de recorrido ─────────────────────────────────────────

// Convierte tracks del backend al formato que usa el reproductor.
// `stops` son los estacionamientos (parkings) que se importaron con el recorrido.
export function prepareTracks(tracks, unitColors, parkings) {
  return tracks.map(t => {
    const pts = t.points.map(p => ({ lat: p.lat, lng: p.lng, ms: new Date(p.t).getTime() }));
    const stops = parkings
      .filter(p => p.track_id === t.id && p.parking_start)
      .map(p => {
        const ms = new Date(p.parking_start).getTime();
        return { ms, endMs: ms + (p.parking_duration || 0) * 60000, duration: p.parking_duration || 0 };
      })
      .sort((a, b) => a.ms - b.ms);
    return {
      id: t.id,
      unit_id: t.unit_id,
      label: t.unit_name ? `${t.unit_id} · ${t.unit_name}` : t.unit_id,
      color: unitColors[t.unit_id] || '#64748b',
      pts,
      stops,
      startMs: pts[0].ms,
      endMs: pts[pts.length - 1].ms,
    };
  });
}

function distanceM(a, b) {
  const R = 6371000, rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function bearingDeg(a, b) {
  const rad = Math.PI / 180;
  const y = Math.sin((b.lng - a.lng) * rad) * Math.cos(b.lat * rad);
  const x = Math.cos(a.lat * rad) * Math.sin(b.lat * rad) -
    Math.sin(a.lat * rad) * Math.cos(b.lat * rad) * Math.cos((b.lng - a.lng) * rad);
  return (Math.atan2(y, x) / rad + 360) % 360;
}

// Posición interpolada de un recorrido en el instante `ms`.
// `idx` es el último punto GPS alcanzado.
function positionAt(track, ms) {
  const { pts } = track;
  if (ms <= pts[0].ms) return { lat: pts[0].lat, lng: pts[0].lng, idx: 0 };
  const last = pts.length - 1;
  if (ms >= pts[last].ms) return { lat: pts[last].lat, lng: pts[last].lng, idx: last };
  let lo = 0, hi = last;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (pts[mid].ms <= ms) lo = mid; else hi = mid;
  }
  const a = pts[lo], b = pts[hi];
  const f = b.ms === a.ms ? 0 : (ms - a.ms) / (b.ms - a.ms);
  return { lat: a.lat + (b.lat - a.lat) * f, lng: a.lng + (b.lng - a.lng) * f, idx: lo };
}

function fmtDur(minutes) {
  const h = Math.floor(minutes / 60), m = Math.round(minutes % 60);
  if (h === 0) return `${m}min`;
  return m === 0 ? `${h}h` : `${h}h ${m}min`;
}

function fmtClock(ms) {
  return new Date(ms).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
}

function fmtDay(ms) {
  return new Date(ms).toLocaleDateString('es-MX', { weekday: 'short', day: '2-digit', month: 'short' });
}

function trackStatus(track, ms) {
  if (ms < track.startMs) return { text: 'Sin iniciar', moving: false };
  if (ms > track.endMs) return { text: 'Fin del recorrido', moving: false };
  const stop = track.stops.find(s => ms >= s.ms && ms <= s.endMs);
  if (stop) return { text: `Estacionado · ${fmtDur(stop.duration)}`, moving: false };
  const { idx } = positionAt(track, ms);
  const a = track.pts[idx], b = track.pts[Math.min(idx + 1, track.pts.length - 1)];
  const hours = (b.ms - a.ms) / 3600000;
  const kmh = hours > 0 ? distanceM(a, b) / 1000 / hours : 0;
  if (kmh < 2) return { text: 'Detenido', moving: false };
  return { text: `${Math.round(kmh)} km/h`, moving: true };
}

// ── Estado de reproducción ─────────────────────────────────────────

export function usePlayback(tracks) {
  const range = useMemo(() => {
    if (!tracks.length) return null;
    return {
      min: Math.min(...tracks.map(t => t.startMs)),
      max: Math.max(...tracks.map(t => t.endMs)),
    };
  }, [tracks]);

  const [time, setTime] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(60);
  const timeRef = useRef(null);

  // Al cambiar los recorridos visibles: conservar el instante si sigue en rango,
  // si no, ir al final para que la ruta completa se vea trazada.
  useEffect(() => {
    if (!range) { setPlaying(false); timeRef.current = null; setTime(null); return; }
    const t = timeRef.current;
    const next = t == null || t < range.min || t > range.max ? range.max : t;
    timeRef.current = next;
    setTime(next);
  }, [range]);

  const seek = useCallback(ms => {
    if (!range) return;
    const t = Math.min(range.max, Math.max(range.min, ms));
    timeRef.current = t;
    setTime(t);
  }, [range]);

  useEffect(() => {
    if (!playing || !range) return;
    let raf, last = performance.now();
    const tick = now => {
      const next = timeRef.current + (now - last) * speed;
      last = now;
      if (next >= range.max) {
        timeRef.current = range.max;
        setTime(range.max);
        setPlaying(false);
        return;
      }
      timeRef.current = next;
      setTime(next);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, speed, range]);

  const togglePlay = useCallback(() => {
    if (!range) return;
    if (!playing && timeRef.current >= range.max) seek(range.min);
    setPlaying(p => !p);
  }, [playing, range, seek]);

  return { range, time, playing, setPlaying, speed, setSpeed, seek, togglePlay };
}

// ── Capas del mapa ─────────────────────────────────────────────────

// Rutas completas (tenues) + puntos GPS con su hora. No dependen del tiempo,
// por eso van memorizadas y no se redibujan en cada cuadro de la animación.
export const TrackStaticLayers = memo(function TrackStaticLayers({ tracks, onSeek }) {
  return (
    <>
      {tracks.map(t => (
        <Polyline
          key={`route-${t.id}`}
          positions={t.pts.map(p => [p.lat, p.lng])}
          pathOptions={{ color: t.color, weight: 4, opacity: 0.35 }}
        />
      ))}
      <Pane name="track-points" style={{ zIndex: 450 }}>
        {tracks.map(t => t.pts.map((p, i) => {
          const isStart = i === 0, isEnd = i === t.pts.length - 1;
          return (
            <CircleMarker
              key={`${t.id}-${i}`}
              center={[p.lat, p.lng]}
              radius={isStart || isEnd ? 6 : 3}
              pathOptions={{
                color: isStart ? '#16a34a' : isEnd ? '#dc2626' : t.color,
                fillColor: isStart ? '#16a34a' : isEnd ? '#dc2626' : 'white',
                fillOpacity: 1,
                weight: isStart || isEnd ? 2 : 1.5,
              }}
              eventHandlers={{ click: () => onSeek(p.ms) }}
            >
              <Tooltip direction="top" offset={[0, -4]}>
                <div style={{ fontSize: 12 }}>
                  <strong>{t.unit_id}</strong>
                  {isStart && ' · Inicio'}{isEnd && ' · Fin'}
                  <br />
                  {fmtDay(p.ms)} · {fmtClock(p.ms)}
                </div>
              </Tooltip>
            </CircleMarker>
          );
        }))}
      </Pane>
    </>
  );
});

function vehicleIcon(color, label) {
  return L.divIcon({
    className: '',
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    html: `<div style="position:relative;width:28px;height:28px">
      <div style="position:absolute;bottom:32px;left:50%;transform:translateX(-50%);background:${color};color:white;
        font-size:11px;font-weight:700;padding:1px 7px;border-radius:10px;white-space:nowrap;
        box-shadow:0 1px 4px rgba(0,0,0,.35)">${label}</div>
      <div style="width:28px;height:28px;border-radius:50%;background:${color};border:3px solid white;
        box-shadow:0 2px 8px rgba(0,0,0,.45);box-sizing:border-box;display:flex;align-items:center;justify-content:center">
        <svg class="vehicle-arrow" width="14" height="14" viewBox="0 0 24 24" style="transition:transform .2s">
          <path d="M12 2 L20 21 L12 16 L4 21 Z" fill="white"/>
        </svg>
      </div>
    </div>`,
  });
}

function Vehicle({ track, time }) {
  const markerRef = useRef(null);
  const headingRef = useRef(0);
  const icon = useMemo(() => vehicleIcon(track.color, track.unit_id), [track.color, track.unit_id]);
  const pos = positionAt(track, time);

  // Orientación: dirección del segmento actual; si está quieto se conserva la última
  const a = track.pts[pos.idx], b = track.pts[Math.min(pos.idx + 1, track.pts.length - 1)];
  if (distanceM(a, b) > 5) headingRef.current = bearingDeg(a, b);

  useEffect(() => {
    const el = markerRef.current?.getElement()?.querySelector('.vehicle-arrow');
    if (el) el.style.transform = `rotate(${headingRef.current}deg)`;
  });

  const traveled = time > track.startMs
    ? [...track.pts.slice(0, pos.idx + 1).map(p => [p.lat, p.lng]), [pos.lat, pos.lng]]
    : null;

  return (
    <>
      {traveled && (
        <Polyline positions={traveled} pathOptions={{ color: track.color, weight: 5, opacity: 0.95 }} />
      )}
      <Marker ref={markerRef} position={[pos.lat, pos.lng]} icon={icon} zIndexOffset={1000} />
    </>
  );
}

function FollowVehicle({ track, time }) {
  const map = useMap();
  useEffect(() => {
    if (!track || time == null) return;
    const { lat, lng } = positionAt(track, time);
    map.panTo([lat, lng], { animate: false });
  }, [map, track, time]);
  return null;
}

export function TrackDynamicLayers({ tracks, time, followTrack }) {
  if (time == null) return null;
  return (
    <>
      {tracks.map(t => <Vehicle key={t.id} track={t} time={time} />)}
      {followTrack && <FollowVehicle track={followTrack} time={time} />}
    </>
  );
}

// ── Panel flotante de reproducción ─────────────────────────────────

export function PlaybackPanel({ tracks, playback, followId, setFollowId }) {
  const { range, time, playing, setPlaying, speed, setSpeed, seek, togglePlay } = playback;
  const [minimized, setMinimized] = useState(false);

  // Todos los instantes con punto GPS, para avanzar/retroceder punto a punto
  const pointTimes = useMemo(
    () => [...new Set(tracks.flatMap(t => t.pts.map(p => p.ms)))].sort((a, b) => a - b),
    [tracks],
  );
  const stopTimes = useMemo(
    () => [...new Set(tracks.flatMap(t => t.stops.map(s => s.ms)))].sort((a, b) => a - b),
    [tracks],
  );

  if (!range || time == null) return null;
  const span = Math.max(1, range.max - range.min);

  function jump(list, dir) {
    setPlaying(false);
    const target = dir > 0
      ? list.find(ms => ms > time + 500)
      : [...list].reverse().find(ms => ms < time - 500);
    seek(target ?? (dir > 0 ? range.max : range.min));
  }

  if (minimized) {
    return (
      <button onClick={() => setMinimized(false)} style={{ ...panelBase, ...minimizedBtn }}>
        <Route size={15} color="#2563eb" />
        <span style={{ fontWeight: 700 }}>{fmtClock(time)}</span>
        {playing ? <Pause size={14} /> : <Play size={14} />}
      </button>
    );
  }

  return (
    <div style={{ ...panelBase, ...panelStyle }}>
      {/* Hora actual + cerrar */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 20, fontWeight: 800, color: '#1e293b', fontVariantNumeric: 'tabular-nums' }}>
          {fmtClock(time)}
        </span>
        <span style={{ fontSize: 12, color: '#64748b', textTransform: 'capitalize' }}>{fmtDay(time)}</span>
        <button onClick={() => setMinimized(true)} style={{ ...iconBtn, marginLeft: 'auto' }} title="Minimizar">
          <Minimize2 size={14} />
        </button>
      </div>

      {/* Estado por unidad */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, maxHeight: 96, overflowY: 'auto', marginBottom: 8 }}>
        {tracks.map(t => {
          const st = trackStatus(t, time);
          const following = followId === t.id;
          return (
            <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
              <span style={{ width: 9, height: 9, borderRadius: '50%', background: t.color, flexShrink: 0 }} />
              <span style={{ fontWeight: 600, color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {t.label}
              </span>
              <span style={{ marginLeft: 'auto', color: st.moving ? '#16a34a' : '#64748b', fontWeight: st.moving ? 700 : 500, flexShrink: 0 }}>
                {st.text}
              </span>
              <button
                onClick={() => setFollowId(following ? null : t.id)}
                style={{ ...iconBtn, color: following ? '#2563eb' : '#cbd5e1' }}
                title={following ? 'Dejar de seguir' : 'Seguir esta unidad'}
              >
                <Crosshair size={14} />
              </button>
            </div>
          );
        })}
      </div>

      {/* Línea de tiempo con las paradas marcadas */}
      <div style={{ position: 'relative', height: 10, marginBottom: 2 }}>
        {tracks.flatMap(t => t.stops.map((s, i) => (
          <div
            key={`${t.id}-${i}`}
            onClick={() => { setPlaying(false); seek(s.ms); }}
            title={`${t.unit_id} · Estacionado ${fmtDur(s.duration)} desde ${fmtClock(s.ms)}`}
            style={{
              position: 'absolute', top: 2, height: 6, borderRadius: 3, cursor: 'pointer',
              left: `${((s.ms - range.min) / span) * 100}%`,
              width: `max(4px, ${((Math.min(s.endMs, range.max) - s.ms) / span) * 100}%)`,
              background: t.color, opacity: 0.55,
            }}
          />
        )))}
      </div>
      <input
        type="range"
        min={range.min}
        max={range.max}
        step={1000}
        value={time}
        onChange={e => seek(Number(e.target.value))}
        style={{ width: '100%', accentColor: '#2563eb', cursor: 'pointer', margin: 0 }}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#94a3b8', marginBottom: 8 }}>
        <span>{fmtDay(range.min)} {fmtClock(range.min)}</span>
        <span>{fmtDay(range.max)} {fmtClock(range.max)}</span>
      </div>

      {/* Controles */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <button onClick={() => { setPlaying(false); seek(range.min); }} style={ctrlBtn} title="Ir al inicio"><SkipBack size={15} /></button>
        <button onClick={() => jump(stopTimes, -1)} style={ctrlBtn} title="Parada anterior" disabled={!stopTimes.length}><ChevronsLeft size={16} /></button>
        <button onClick={() => jump(pointTimes, -1)} style={ctrlBtn} title="Punto anterior"><StepBack size={15} /></button>
        <button onClick={togglePlay} style={playBtn} title={playing ? 'Pausar' : 'Reproducir'}>
          {playing ? <Pause size={18} /> : <Play size={18} />}
        </button>
        <button onClick={() => jump(pointTimes, 1)} style={ctrlBtn} title="Punto siguiente"><StepForward size={15} /></button>
        <button onClick={() => jump(stopTimes, 1)} style={ctrlBtn} title="Parada siguiente" disabled={!stopTimes.length}><ChevronsRight size={16} /></button>
        <button onClick={() => { setPlaying(false); seek(range.max); }} style={ctrlBtn} title="Ir al final"><SkipForward size={15} /></button>
        <select
          value={speed}
          onChange={e => setSpeed(Number(e.target.value))}
          style={speedSelect}
          title="Velocidad de reproducción"
        >
          {SPEEDS.map(s => <option key={s} value={s}>{s}x</option>)}
        </select>
      </div>
    </div>
  );
}

const panelBase = {
  position: 'absolute', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 1000,
  background: 'white', borderRadius: 12, boxShadow: '0 6px 24px rgba(0,0,0,0.25)',
  fontFamily: 'inherit',
};
const panelStyle = { width: 'min(460px, calc(100% - 24px))', padding: '12px 14px', boxSizing: 'border-box' };
const minimizedBtn = {
  display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', border: 'none',
  cursor: 'pointer', fontSize: 13, color: '#1e293b',
};
const iconBtn = {
  background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8',
  display: 'flex', padding: 2, borderRadius: 4,
};
const ctrlBtn = {
  background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 8, cursor: 'pointer',
  color: '#374151', display: 'flex', alignItems: 'center', justifyContent: 'center',
  width: 32, height: 32, padding: 0,
};
const playBtn = {
  ...ctrlBtn, width: 40, height: 40, borderRadius: '50%',
  background: '#2563eb', border: 'none', color: 'white',
};
const speedSelect = {
  marginLeft: 'auto', padding: '6px 8px', border: '1px solid #e2e8f0', borderRadius: 8,
  fontSize: 12, fontFamily: 'inherit', color: '#374151', cursor: 'pointer', background: 'white',
};
