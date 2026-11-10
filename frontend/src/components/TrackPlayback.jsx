import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Polyline, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import {
  Play, Pause, SkipBack, SkipForward, StepBack, StepForward,
  ChevronsLeft, ChevronsRight, Crosshair, Minimize2, Route, LocateFixed,
} from 'lucide-react';

const SPEEDS = [1, 10, 30, 60, 120, 300, 600];

// ── Utilidades de recorrido ─────────────────────────────────────────

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
  if (stop) return { text: `Estacionado · ${fmtDur(stop.duration)}`, moving: false, parked: true };
  const { idx } = positionAt(track, ms);
  const a = track.pts[idx], b = track.pts[Math.min(idx + 1, track.pts.length - 1)];
  const hours = (b.ms - a.ms) / 3600000;
  const kmh = hours > 0 ? distanceM(a, b) / 1000 / hours : 0;
  if (kmh < 2) return { text: 'Detenido', moving: false };
  return { text: `${Math.round(kmh)} km/h`, moving: true };
}

// ── Estado de reproducción ─────────────────────────────────────────

// `viewKey` identifica lo que se está viendo (agrupación, día o unidad abiertos,
// fechas): al cambiar, la reproducción se detiene y vuelve al estado inicial.
export function usePlayback(tracks, viewKey) {
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

  const lastViewKey = useRef(viewKey);
  useEffect(() => {
    if (lastViewKey.current === viewKey) return;
    lastViewKey.current = viewKey;
    setPlaying(false);
    // Al final: la ruta queda trazada completa y "Reproducir" empieza desde el inicio
    const next = range ? range.max : null;
    timeRef.current = next;
    setTime(next);
  }, [viewKey, range]);

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

function pointTooltip(track, point, suffix) {
  const box = document.createElement('div');
  box.style.fontSize = '12px';
  const unit = document.createElement('strong');
  unit.textContent = track.unit_id;
  box.append(unit, suffix, document.createElement('br'), `${fmtDay(point.ms)} · ${fmtClock(point.ms)}`);
  return box;
}

// Puntos GPS con su hora, dibujados en canvas: un recorrido trae miles y como
// elementos SVG con un componente React cada uno volverían lento todo el mapa.
function TrackPoints({ tracks, onSeek }) {
  const map = useMap();

  useEffect(() => {
    if (!map.getPane('track-points')) map.createPane('track-points').style.zIndex = 450;
    const renderer = L.canvas({ pane: 'track-points' });
    const group = L.featureGroup();

    tracks.forEach((t) => {
      t.pts.forEach((p, i) => {
        const isStart = i === 0;
        const isEnd = i === t.pts.length - 1;
        const accent = isStart ? '#15803d' : isEnd ? '#b91c1c' : null;
        const suffix = isStart ? ' · Inicio' : isEnd ? ' · Fin' : '';
        L.circleMarker([p.lat, p.lng], {
          renderer,
          radius: accent ? 6 : 3,
          color: accent || t.color,
          fillColor: accent || 'white',
          fillOpacity: 1,
          weight: accent ? 2 : 1.5,
        })
          .on('click', () => onSeek(p.ms))
          .bindTooltip(() => pointTooltip(t, p, suffix), { direction: 'top', offset: [0, -4] })
          .addTo(group);
      });
    });

    group.addTo(map);
    return () => {
      map.removeLayer(group);
      map.removeLayer(renderer);
    };
  }, [map, tracks, onSeek]);

  return null;
}

// Rutas completas (tenues) + puntos GPS. No dependen del tiempo, por eso van
// memorizadas y no se redibujan en cada cuadro de la animación.
export const TrackStaticLayers = memo(function TrackStaticLayers({ tracks, onSeek, showRoute = true }) {
  if (!showRoute) return null;
  return (
    <>
      {tracks.map(t => (
        <Polyline
          key={`route-${t.id}`}
          positions={t.pts.map(p => [p.lat, p.lng])}
          pathOptions={{ color: t.color, weight: 4, opacity: 0.35 }}
        />
      ))}
      <TrackPoints tracks={tracks} onSeek={onSeek} />
    </>
  );
});

// El identificador viene de un Excel importado y este HTML no pasa por React
function escapeHtml(text) {
  const box = document.createElement('div');
  box.textContent = text;
  return box.innerHTML;
}

function vehicleIcon(color, label) {
  return L.divIcon({
    className: '',
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    html: `<div style="position:relative;width:28px;height:28px">
      <div style="position:absolute;bottom:32px;left:50%;transform:translateX(-50%);background:white;color:#1a1a18;font-size:11px;font-weight:600;padding:1px 7px;border-radius:10px;white-space:nowrap;box-shadow:0 1px 4px rgba(0,0,0,.35)">${escapeHtml(label)}</div>
      <div style="width:28px;height:28px;border-radius:50%;background:${color};border:3px solid white;
        box-shadow:0 2px 8px rgba(0,0,0,.45);box-sizing:border-box;display:flex;align-items:center;justify-content:center">
        <svg class="vehicle-arrow" width="14" height="14" viewBox="0 0 24 24" style="transition:transform .2s">
          <path d="M12 2 L20 21 L12 16 L4 21 Z" fill="white"/>
        </svg>
      </div>
    </div>`,
  });
}

function Vehicle({ track, time, showRoute }) {
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

  const traveled = showRoute && time > track.startMs
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
    // Cada desplazamiento hace que Leaflet recalcule mosaicos, puntos y rutas: con la
    // unidad quieta no hay nada que mover y se evita repetir ese trabajo en cada cuadro
    const offset = map.latLngToContainerPoint([lat, lng]).subtract(map.getSize().divideBy(2));
    if (Math.abs(offset.x) < 1 && Math.abs(offset.y) < 1) return;
    map.panBy(offset, { animate: false });
  }, [map, track, time]);
  return null;
}

export function TrackDynamicLayers({ tracks, time, followTrack, showRoute = true }) {
  if (time == null) return null;
  return (
    <>
      {tracks.map(t => <Vehicle key={t.id} track={t} time={time} showRoute={showRoute} />)}
      {followTrack && <FollowVehicle track={followTrack} time={time} />}
    </>
  );
}

// Estacionamientos en los que alguna unidad está parada en el instante `ms`
export function parkedStopIds(tracks, ms) {
  if (ms == null) return [];
  return tracks.flatMap(t => t.stops.filter(s => s.id && ms >= s.ms && ms <= s.endMs).map(s => s.id));
}

// ── Panel flotante de reproducción ─────────────────────────────────

export function PlaybackPanel({ tracks, playback, followId, setFollowId, showRoute, setShowRoute }) {
  const { range, time, playing, setPlaying, speed, setSpeed, seek, togglePlay } = playback;
  // En móvil el panel taparía casi todo el mapa: arranca minimizado
  const [minimized, setMinimized] = useState(() => window.matchMedia('(max-width: 820px)').matches);

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
      <button onClick={() => setMinimized(false)} className="map-control player player-mini" aria-label={`Abrir reproductor, ${fmtClock(time)}`}>
        <Route size={15} color="var(--accent)" />
        <span style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{fmtClock(time)}</span>
        {playing ? <Pause size={14} /> : <Play size={14} />}
      </button>
    );
  }

  return (
    <div className="map-control player">
      <div className="row">
        <span className="player-clock">{fmtClock(time)}</span>
        <span className="small muted cap-first">{fmtDay(time)}</span>
        <button
          onClick={() => setShowRoute(v => !v)}
          className="player-toggle"
          style={{ marginLeft: 'auto' }}
          aria-pressed={showRoute}
          title={showRoute ? 'Ocultar la ruta y dejar solo los estacionamientos' : 'Mostrar la ruta recorrida'}
        >
          <Route size={14} /> Ruta
        </button>
        <button onClick={() => setMinimized(true)} className="icon-btn" title="Minimizar" aria-label="Minimizar reproductor">
          <Minimize2 size={14} />
        </button>
      </div>

      <div className="player-units">
        {tracks.map(t => {
          const st = trackStatus(t, time);
          const following = followId === t.id;
          return (
            <div key={t.id} className="player-unit">
              <span className="dot dot-sm" style={{ background: t.color }} />
              <span className="truncate" style={{ fontWeight: 500 }}>{t.label}</span>
              <span className={`player-status${st.parked ? ' player-status-parked' : ''}`} style={{ color: st.moving ? 'var(--ink)' : undefined, fontWeight: st.moving ? 600 : undefined }}>
                {st.text}
              </span>
              <button
                onClick={() => setFollowId(following ? null : t.id)}
                className="follow-btn"
                title={following ? 'Dejar de seguir: el mapa ya no se moverá con la unidad' : 'Centrar el mapa en la unidad mientras avanza'}
                aria-pressed={following}
              >
                {following ? <LocateFixed size={14} /> : <Crosshair size={14} />}
                Seguir<span className="sr-only"> a {t.unit_id}</span>
              </button>
            </div>
          );
        })}
      </div>

      {/* Línea de tiempo con las paradas marcadas. Atajo solo para ratón:
          con teclado se llega con "Parada anterior" y "Parada siguiente". */}
      <div className="player-timeline">
        {tracks.flatMap(t => t.stops.map((s, i) => (
          <button
            key={`${t.id}-${i}`}
            onClick={() => { setPlaying(false); seek(s.ms); }}
            title={`${t.unit_id} · Estacionado ${fmtDur(s.duration)} desde ${fmtClock(s.ms)}`}
            tabIndex={-1}
            aria-hidden="true"
            className="player-stop"
            style={{
              left: `${((s.ms - range.min) / span) * 100}%`,
              width: `max(4px, ${((Math.min(s.endMs, range.max) - s.ms) / span) * 100}%)`,
              background: t.color,
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
        aria-label="Línea de tiempo"
        aria-valuetext={`${fmtDay(time)} ${fmtClock(time)}`}
        className="player-range"
      />
      <div className="row-between muted" style={{ fontSize: 11, marginBottom: 6 }}>
        <span>{fmtDay(range.min)} {fmtClock(range.min)}</span>
        <span>{fmtDay(range.max)} {fmtClock(range.max)}</span>
      </div>

      <div className="player-controls">
        <button onClick={() => { setPlaying(false); seek(range.min); }} className="icon-btn" title="Ir al inicio" aria-label="Ir al inicio"><SkipBack size={15} /></button>
        <button onClick={() => jump(stopTimes, -1)} className="icon-btn" title="Parada anterior" aria-label="Parada anterior" disabled={!stopTimes.length}><ChevronsLeft size={16} /></button>
        <button onClick={() => jump(pointTimes, -1)} className="icon-btn" title="Punto anterior" aria-label="Punto anterior"><StepBack size={15} /></button>
        <button onClick={togglePlay} className="player-play" title={playing ? 'Pausar' : 'Reproducir'} aria-label={playing ? 'Pausar' : 'Reproducir'}>
          {playing ? <Pause size={17} /> : <Play size={17} />}
        </button>
        <button onClick={() => jump(pointTimes, 1)} className="icon-btn" title="Punto siguiente" aria-label="Punto siguiente"><StepForward size={15} /></button>
        <button onClick={() => jump(stopTimes, 1)} className="icon-btn" title="Parada siguiente" aria-label="Parada siguiente" disabled={!stopTimes.length}><ChevronsRight size={16} /></button>
        <button onClick={() => { setPlaying(false); seek(range.max); }} className="icon-btn" title="Ir al final" aria-label="Ir al final"><SkipForward size={15} /></button>
        <select
          value={speed}
          onChange={e => setSpeed(Number(e.target.value))}
          className="input input-sm player-speed"
          title="Velocidad de reproducción"
          aria-label="Velocidad de reproducción"
        >
          {SPEEDS.map(s => <option key={s} value={s}>{s}x</option>)}
        </select>
      </div>
    </div>
  );
}
