import { useState } from 'react';
import { useCreateShareLink } from '../api/queries';
import { CheckCircle2, Copy, Check, ExternalLink } from 'lucide-react';
import { copyToClipboard } from '../lib/clipboard';
import { formatDateTime, plural } from '../lib/format';
import { GROUP_OPTIONS } from '../lib/parkingGroups';
import Modal from './ui/Modal';

const DURATIONS = [
  { label: '15 minutos', value: '15' },
  { label: '30 minutos', value: '30' },
  { label: '1 hora', value: '60' },
  { label: '2 horas', value: '120' },
  { label: '6 horas', value: '360' },
  { label: '12 horas', value: '720' },
  { label: '24 horas', value: '1440' },
  { label: '7 días', value: '10080' },
  { label: 'Personalizado…', value: 'custom' },
];

const shortDate = (day) => new Date(`${day}T12:00:00`).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });

function datesText(from, to) {
  if (from && to) return from === to ? shortDate(from) : `Del ${shortDate(from)} al ${shortDate(to)}`;
  if (from) return `Desde el ${shortDate(from)}`;
  if (to) return `Hasta el ${shortDate(to)}`;
  return 'Todas';
}

// El enlace comparte exactamente lo que se ve en el mapa: agrupación, grupo abierto,
// fechas y recorridos marcados. `view` lo describe (lo arma la página del mapa).
export default function ShareLinkModal({ view, onClose }) {
  const [duration, setDuration] = useState('60');
  const [customMin, setCustomMin] = useState('');
  const [result, setResult] = useState(null);
  const createLink = useCreateShareLink();
  const loading = createLink.isPending;
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const groupLabel = GROUP_OPTIONS.find((g) => g.id === view.groupBy)?.label ?? 'Unidad';
  const hidden = view.hiddenTracks;
  const summary = [
    ['Agrupado por', groupLabel],
    view.openLabel && ['Grupo abierto', view.openLabel],
    ['Fechas', datesText(view.from, view.to)],
    ['Registros', `${view.recordCount} ${plural(view.recordCount, 'registro')}`],
    hidden.length > 0 && ['Sin incluir', `${hidden.length} ${plural(hidden.length, 'recorrido')} desmarcado${hidden.length === 1 ? '' : 's'} (${[...new Set(hidden.map((t) => t.unit_id))].join(', ')})`],
  ].filter(Boolean);

  async function generate() {
    setError('');
    const mins = parseInt(duration === 'custom' ? customMin : duration);
    if (!mins || isNaN(mins) || mins < 1) return setError('Duración inválida');
    try {
      const data = await createLink.mutateAsync({
        // Con una unidad abierta solo se comparte esa; si no, todas
        unit_ids: view.unitId ? [view.unitId] : null,
        exclude_track_ids: hidden.map((t) => t.id),
        expires_in_minutes: mins,
      });
      const params = new URLSearchParams();
      if (view.groupBy !== 'unit') params.set('groupBy', view.groupBy);
      if (view.from) params.set('from', view.from);
      if (view.to) params.set('to', view.to);
      if (view.openKey !== 'all') params.set('open', view.openKey);
      const qs = params.toString();
      const base = `${window.location.origin}/map/${data.token}`;
      setResult({ url: qs ? `${base}?${qs}` : base, expires_at: data.expires_at });
    } catch (err) {
      setError(err.message);
    }
  }

  function copy() {
    copyToClipboard(result.url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (result) {
    return (
      <Modal
        title="Enlace listo"
        onClose={onClose}
        footer={(
          <>
            <button onClick={() => window.open(result.url, '_blank')} className="btn btn-secondary">
              <ExternalLink size={14} /> Abrir mapa
            </button>
            <button onClick={copy} className="btn btn-primary" data-autofocus>
              {copied ? <><Check size={14} /> Copiado</> : <><Copy size={14} /> Copiar enlace</>}
            </button>
          </>
        )}
      >
        <div className="stack" style={{ gap: 10 }}>
          <p className="status status-active"><CheckCircle2 size={15} /> Expira el {formatDateTime(result.expires_at)}</p>
          <p className="url-box" style={{ overflowWrap: 'anywhere' }}>{result.url}</p>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      title="Compartir mapa"
      description="Crea un enlace de solo lectura con lo que ves ahora en el mapa. Para compartir otra cosa, cambia la agrupación, las fechas o los recorridos antes de abrir esta ventana."
      onClose={onClose}
      footer={(
        <>
          <button onClick={onClose} className="btn btn-secondary">Cancelar</button>
          <button onClick={generate} disabled={loading || view.recordCount === 0} className="btn btn-primary">
            {loading ? 'Generando…' : 'Generar enlace'}
          </button>
        </>
      )}
    >
      <div className="stack">
        <div className="field">
          <span className="field-label">Se compartirá</span>
          <dl className="share-summary">
            {summary.map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
          {view.recordCount === 0 && <p className="field-hint">No hay registros visibles para compartir.</p>}
        </div>

        <label className="field">
          <span className="field-label">Vigencia</span>
          <select className="input" value={duration} onChange={e => setDuration(e.target.value)} data-autofocus>
            {DURATIONS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
          </select>
        </label>
        {duration === 'custom' && (
          <label className="field">
            <span className="field-label">Minutos</span>
            <input className="input" type="number" min="1" max="10080" value={customMin} onChange={e => setCustomMin(e.target.value)} placeholder="90" />
            <span className="field-hint">Máximo 10080 (7 días).</span>
          </label>
        )}

        {error && <div role="alert" className="notice notice-error">{error}</div>}
      </div>
    </Modal>
  );
}
