import { useCallback, useMemo, useState } from 'react';

// Qué recorridos se ven en el mapa. Empiezan todos desmarcados: se elige qué unidad ver.
// Las paradas de un recorrido desmarcado también se ocultan (ver `visibleParkings`).
export function useTrackSelection(tracks, parkings) {
  const [selected, setSelected] = useState(() => new Set());

  const isSelected = useCallback((id) => selected.has(id), [selected]);

  const toggle = useCallback((id) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  }), []);

  const setMany = useCallback((ids, visible) => setSelected((prev) => {
    const next = new Set(prev);
    ids.forEach((id) => (visible ? next.add(id) : next.delete(id)));
    return next;
  }), []);

  const hiddenTracks = useMemo(() => tracks.filter((t) => !selected.has(t.id)), [tracks, selected]);

  // Los registros que no vienen de un recorrido existente (Excel, manuales) se ven siempre
  const visibleParkings = useMemo(() => {
    const hidden = new Set(hiddenTracks.map((t) => t.id));
    return hidden.size === 0 ? parkings : parkings.filter((p) => !p.track_id || !hidden.has(p.track_id));
  }, [parkings, hiddenTracks]);

  return { isSelected, toggle, setMany, hiddenTracks, visibleParkings };
}
