import { useState } from 'react';
import { Check, CheckCircle2, Copy, Loader2 } from 'lucide-react';
import { useCreateShareLink } from '../../api/queries';
import { copyToClipboard } from '../../lib/clipboard';
import Modal from '../ui/Modal';

const OPTIONS = [
  { label: '1 hora', value: 60 },
  { label: '24 horas', value: 1440 },
  { label: '3 días', value: 4320 },
  { label: '7 días', value: 10080 },
];

export default function ReportShareModal({ reportId, title, onClose }) {
  const [mins, setMins] = useState(1440);
  const [link, setLink] = useState('');
  const [copied, setCopied] = useState(false);
  const createLink = useCreateShareLink();

  function handleCreate() {
    createLink.mutate(
      { report_id: reportId, expires_in_minutes: mins },
      { onSuccess: (res) => setLink(`${window.location.origin}/report/${res.token}`) },
    );
  }

  function handleCopy() {
    copyToClipboard(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (link) {
    return (
      <Modal
        title="Enlace listo"
        onClose={onClose}
        footer={(
          <button onClick={handleCopy} className="btn btn-primary" data-autofocus>
            {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Copiado' : 'Copiar'}
          </button>
        )}
      >
        <div className="stack" style={{ gap: 10 }}>
          <p role="status" className="status status-active"><CheckCircle2 size={15} /> Enlace generado</p>
          <input readOnly value={link} aria-label="Enlace generado" className="input" />
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      title={title}
      description="Crea un enlace de solo lectura con una copia de este reporte."
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
        <div className="field">
          <span id="share-duration" className="field-label">Vigencia</span>
          <div className="segmented" role="group" aria-labelledby="share-duration">
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
