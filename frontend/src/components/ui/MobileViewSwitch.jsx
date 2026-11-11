import { useEffect, useRef, useState } from 'react';
import { List, Map as MapIcon } from 'lucide-react';

/**
 * En el teléfono el mapa y la lista no caben juntos: se muestra uno a la vez.
 * Mientras no se elija, abre el mapa si tiene algo que mostrar y si no la lista,
 * donde están los recorridos por marcar. Tocar un registro de la lista lo muestra en el mapa.
 */
export function useMobileView({ hasMapContent, highlightId }) {
  const [chosen, setChosen] = useState(null);
  const lastHighlight = useRef(highlightId);
  useEffect(() => {
    if (highlightId && highlightId !== lastHighlight.current) setChosen('map');
    lastHighlight.current = highlightId;
  }, [highlightId]);
  return [chosen ?? (hasMapContent ? 'map' : 'list'), setChosen];
}

export default function MobileViewSwitch({ view, onChange, listCount }) {
  return (
    <nav className="view-switch" aria-label="Vista">
      <button type="button" aria-pressed={view === 'map'} onClick={() => onChange('map')}>
        <MapIcon size={16} aria-hidden="true" /> Mapa
      </button>
      <button type="button" aria-pressed={view === 'list'} onClick={() => onChange('list')}>
        <List size={16} aria-hidden="true" /> Lista
        {listCount != null && <span className="view-switch-count">{listCount}</span>}
      </button>
    </nav>
  );
}
