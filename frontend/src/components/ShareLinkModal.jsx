import { useState } from 'react';
import { useCreateShareLink } from '../api/queries';
import { CheckCircle2, Copy, Check, ExternalLink } from 'lucide-react';
import { copyToClipboard } from '../lib/clipboard';
import { formatDateTime, plural } from '../lib/format';
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

const GROUP_LABELS = { unit: 'Unidad', date: 'Fecha', address: 'Sucursal', date_unit: 'Fecha + Unidad' };

export default function ShareLinkModal({ units, dateFrom, dateTo, groupBy, onClose }) {
  const [mode, setMode] = useState('all'); // 'all' | 'select'
  const [selected, setSelected] = useState([]);
  const [duration, setDuration] = useState('60');
  const [customMin, setCustomMin] = useState('');
  const [result, setResult] = useState(null);
  const createLink = useCreateShareLink();
  const loading = createLink.isPending;
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [includeGroupBy, setIncludeGroupBy] = useState(!!groupBy && groupBy !== 'unit');
  const [includeDates, setIncludeDates] = useState(!!(dateFrom || dateTo));

  const hasGroupByFilter = groupBy && groupBy !== 'unit';
  const hasDatesFilter = !!(dateFrom || dateTo);

  function toggleUnit(uid) {
    setSelected(s => s.includes(uid) ? s.filter(x => x !== uid) : [...s, uid]);
  }

  async function generate() {
    setError('');
    const mins = parseInt(duration === 'custom' ? customMin : duration);
    if (!mins || isNaN(mins) || mins < 1) return setError('Duración inválida');
    if (mode === 'select' && selected.length === 0) return setError('Selecciona al menos una unidad');
    try {
      const data = await createLink.mutateAsync({
        unit_ids: mode === 'all' ? null : selected,
        expires_in_minutes: mins,
      });
      const base = `${window.location.origin}/map/${data.token}`;
      const params = new URLSearchParams();
      if (includeDates && dateFrom) params.set('from', dateFrom);
      if (includeDates && dateTo) params.set('to', dateTo);
      if (includeGroupBy && groupBy && groupBy !== 'unit') params.set('groupBy', groupBy);
      const qs = params.toString();
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
      description="Crea un enlace de solo lectura con una copia de los datos actuales."
      onClose={onClose}
      footer={(
        <>
          <button onClick={onClose} className="btn btn-secondary">Cancelar</button>
          <button onClick={generate} disabled={loading} className="btn btn-primary">
            {loading ? 'Generando…' : 'Generar enlace'}
          </button>
        </>
      )}
    >
      <div className="stack">
        <div className="field">
          <span id="share-units" className="field-label">Unidades</span>
          <div className="segmented" role="group" aria-labelledby="share-units">
            <button aria-pressed={mode === 'all'} onClick={() => setMode('all')}>Todas</button>
            <button aria-pressed={mode === 'select'} onClick={() => setMode('select')}>Elegir unidades</button>
          </div>
          {mode === 'select' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 180, overflowY: 'auto', marginTop: 4 }}>
              {units.length === 0 && <p className="small muted">No hay unidades registradas</p>}
              {units.map(u => (
                <label key={u.id} className="check-row">
                  <input type="checkbox" checked={selected.includes(u.id)} onChange={() => toggleUnit(u.id)} />
                  <span className="truncate" style={{ flex: 1 }}>{u.name || u.id}</span>
                  <span className="small muted">{u.count} {plural(u.count, 'registro')}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        <label className="field">
          <span className="field-label">Vigencia</span>
          <select className="input" value={duration} onChange={e => setDuration(e.target.value)}>
            {DURATIONS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
          </select>
        </label>
        {duration === 'custom' && (
          <label className="field">
            <span className="field-label">Minutos</span>
            <input className="input" type="number" min="1" max="10080" value={customMin} onChange={e => setCustomMin(e.target.value)} placeholder="90" data-autofocus />
            <span className="field-hint">Máximo 10080 (7 días).</span>
          </label>
        )}

        {(hasGroupByFilter || hasDatesFilter) && (
          <div className="field">
            <span className="field-label">Conservar la vista actual</span>
            {hasGroupByFilter && (
              <label className="check-row">
                <input type="checkbox" checked={includeGroupBy} onChange={e => setIncludeGroupBy(e.target.checked)} />
                <span>Agrupar por {GROUP_LABELS[groupBy]}</span>
              </label>
            )}
            {hasDatesFilter && (
              <label className="check-row">
                <input type="checkbox" checked={includeDates} onChange={e => setIncludeDates(e.target.checked)} />
                <span>{dateFrom && dateTo ? `Del ${dateFrom} al ${dateTo}` : dateFrom ? `Desde ${dateFrom}` : `Hasta ${dateTo}`}</span>
              </label>
            )}
          </div>
        )}

        {error && <div role="alert" className="notice notice-error">{error}</div>}
      </div>
    </Modal>
  );
}
