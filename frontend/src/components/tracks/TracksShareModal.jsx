import { useState } from 'react';
import { Check, CheckCircle2, Copy, ExternalLink, Loader2 } from 'lucide-react';
import { useCreateShareLink } from '../../api/queries';
import { copyToClipboard } from '../../lib/clipboard';
import { formatDateTime, plural } from '../../lib/format';
import { formatClock, formatDate } from '../../lib/trackSummary';
import Modal from '../ui/Modal';

const OPTIONS = [
  { label: '1 hora', value: 60 },
  { label: '24 horas', value: 1440 },
  { label: '3 días', value: 4320 },
  { label: '7 días', value: 10080 },
];

// Enlace de solo lectura al reporte de recorridos: resumen, paradas y exportación a Excel
export default function TracksShareModal({ selected, summaries, onClose }) {
  const [scope, setScope] = useState('one'); // 'one' | 'all'
  const [mins, setMins] = useState(1440);
  const [result, setResult] = useState(null);
  const [copied, setCopied] = useState(false);
  const createLink = useCreateShareLink();

  function handleCreate() {
    const trackIds = scope === 'one' ? [selected.id] : summaries.map((s) => s.id);
    createLink.mutate(
      { track_ids: trackIds, expires_in_minutes: mins },
      { onSuccess: (res) => setResult({ url: `${window.location.origin}/recorrido/${res.token}`, expires_at: res.expires_at }) },
    );
  }

  function handleCopy() {
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
              <ExternalLink size={14} /> Abrir reporte
            </button>
            <button onClick={handleCopy} className="btn btn-primary" data-autofocus>
              {copied ? <><Check size={14} /> Copiado</> : <><Copy size={14} /> Copiar enlace</>}
            </button>
          </>
        )}
      >
        <div className="stack" style={{ gap: 10 }}>
          <p role="status" className="status status-active"><CheckCircle2 size={15} /> Expira el {formatDateTime(result.expires_at)}</p>
          <input readOnly value={result.url} aria-label="Enlace generado" className="input" />
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      title="Compartir reporte de recorridos"
      description="Crea un enlace de solo lectura con las paradas, horarios y tiempos. Quien lo abra también podrá descargarlo en Excel."
      onClose={onClose}
      footer={(
        <>
          <button onClick={onClose} className="btn btn-secondary">Cancelar</button>
          <button onClick={handleCreate} disabled={createLink.isPending} className="btn btn-primary">
            {createLink.isPending && <Loader2 size={14} className="spin" />}
            Generar enlace
          </button>
        </>
      )}
    >
      <div className="stack">
        <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }}>
          <legend className="field-label" style={{ marginBottom: 4 }}>Qué compartir</legend>
          <label className="check-row">
            <input type="radio" name="share-scope" checked={scope === 'one'} onChange={() => setScope('one')} />
            <span>
              Este recorrido
              <span className="small muted" style={{ display: 'block' }}>
                {selected.unitId} · {formatDate(selected.start)} · {formatClock(selected.start)} → {formatClock(selected.end)}
              </span>
            </span>
          </label>
          {summaries.length > 1 && (
            <label className="check-row">
              <input type="radio" name="share-scope" checked={scope === 'all'} onChange={() => setScope('all')} />
              <span>
                Los {summaries.length} {plural(summaries.length, 'recorrido')} mostrados
                <span className="small muted" style={{ display: 'block' }}>Con los filtros de unidad y fechas actuales</span>
              </span>
            </label>
          )}
        </fieldset>

        <div className="field">
          <span id="tracks-share-duration" className="field-label">Vigencia</span>
          <div className="segmented" role="group" aria-labelledby="tracks-share-duration">
            {OPTIONS.map((o) => (
              <button key={o.value} onClick={() => setMins(o.value)} aria-pressed={mins === o.value}>
                {o.label}
              </button>
            ))}
          </div>
        </div>
        {createLink.error && <div role="alert" className="notice notice-error">{createLink.error.message}</div>}
      </div>
    </Modal>
  );
}
