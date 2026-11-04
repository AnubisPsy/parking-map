import { useState } from 'react';
import { Check, Copy, Link2, Loader2, X } from 'lucide-react';
import { useCreateShareLink } from '../../api/queries';
import { copyToClipboard } from '../../lib/clipboard';
import Modal from '../ui/Modal';

const OPTIONS = [
  { label: '1 hora', value: 60 },
  { label: '24 horas', value: 1440 },
  { label: '3 días', value: 4320 },
  { label: '7 días', value: 10080 },
];

export default function ReportShareModal({ reportId, title, accent = '#2563eb', onClose }) {
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

  return (
    <Modal label={title} onClose={onClose} style={{ maxWidth: 440, padding: 28 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <Link2 size={20} color={accent} />
          <h2 style={{ fontSize: 16, fontWeight: 700 }}>{title}</h2>
        </div>
        <button onClick={onClose} aria-label="Cerrar" style={closeBtn}><X size={18} /></button>
      </div>

      {!link ? (
        <>
          <p id="share-duration" style={{ fontSize: 13, color: '#475569', marginBottom: 16 }}>
            Elige cuánto tiempo estará disponible el enlace:
          </p>
          <div role="group" aria-labelledby="share-duration" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
            {OPTIONS.map((o) => {
              const selected = mins === o.value;
              return (
                <button
                  key={o.value}
                  onClick={() => setMins(o.value)}
                  aria-pressed={selected}
                  style={{
                    padding: '7px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 13,
                    border: `1px solid ${selected ? accent : '#64748b'}`,
                    background: selected ? `${accent}12` : '#f8fafc',
                    color: selected ? accent : '#374151',
                    fontWeight: selected ? 700 : 400,
                  }}
                >
                  {o.label}
                </button>
              );
            })}
          </div>
          {createLink.error && (
            <p role="alert" style={{ color: '#b91c1c', fontSize: 13, marginBottom: 12 }}>{createLink.error.message}</p>
          )}
          <button onClick={handleCreate} disabled={createLink.isPending} style={{ ...primaryBtn, background: accent }}>
            {createLink.isPending ? <Loader2 size={16} className="spin" /> : <Link2 size={16} />}
            Generar enlace
          </button>
        </>
      ) : (
        <div>
          <p role="status" style={{ fontSize: 13, color: '#15803d', fontWeight: 600, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Check size={15} /> Enlace generado
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              readOnly
              value={link}
              aria-label="Enlace generado"
              style={{ flex: 1, minWidth: 0, padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: 8, fontSize: 12, color: '#374151' }}
            />
            <button
              onClick={handleCopy}
              style={{ padding: '8px 14px', background: copied ? '#15803d' : accent, color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}
            >
              {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Copiado' : 'Copiar'}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}

const closeBtn = { background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', display: 'flex', padding: 2, borderRadius: 4 };
const primaryBtn = {
  width: '100%', padding: 10, color: 'white', border: 'none', borderRadius: 8,
  fontSize: 14, fontWeight: 600, cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
};
