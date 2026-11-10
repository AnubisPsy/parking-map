import { useState, useEffect } from 'react';
import { useDeleteShares, useShares } from '../api/queries';
import { Copy, Check, ExternalLink, Trash2, Link2, Clock, CheckCircle2, MinusCircle } from 'lucide-react';
import { copyToClipboard } from '../lib/clipboard';
import { formatDateTime, plural } from '../lib/format';
import { useConfirm } from './ConfirmModal';
import Modal from './ui/Modal';
import { ListSkeleton } from './ui/Skeleton';
import { EmptyState, ErrorState } from './ui/States';

function useNow(intervalMs = 30_000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

function getTimeLeft(expiresAt, now) {
  const diff = new Date(expiresAt) - now;
  if (diff <= 0) return null;
  const totalMin = Math.floor(diff / 60000);
  const days = Math.floor(totalMin / 1440);
  const hours = Math.floor((totalMin % 1440) / 60);
  const mins = totalMin % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}min`;
  return `${mins}min`;
}

function getProgress(createdAt, expiresAt, now) {
  const total = new Date(expiresAt) - new Date(createdAt);
  const elapsed = now - new Date(createdAt);
  return Math.min(100, Math.max(0, (elapsed / total) * 100));
}

// Cada tipo de enlace vive en su propia ruta
const ROUTES = { report: 'report', tracks: 'recorrido' };
function shareUrl(share) {
  const route = ROUTES[share.type] || 'map';
  return `${window.location.origin}/${route}/${share.token}`;
}

function shareScope(share) {
  if (share.type === 'report') return 'Reporte';
  if (share.type === 'tracks') {
    const count = share.track_count ?? 0;
    return `${count} ${plural(count, 'recorrido')} · ${(share.unit_ids || []).join(', ')}`;
  }
  return share.unit_ids ? share.unit_ids.join(', ') : 'Todas las unidades';
}

export default function SharesListModal({ onClose }) {
  const { data: shares = [], error, isPending, refetch } = useShares();
  const deleteShares = useDeleteShares();
  const [copiedId, setCopiedId] = useState(null);
  const now = useNow(30_000);
  const { confirm, dialog } = useConfirm();

  const active = shares.filter(s => new Date(s.expires_at) > now);
  const expired = shares.filter(s => new Date(s.expires_at) <= now);

  async function handleDelete(id) {
    const ok = await confirm({
      title: '¿Revocar este enlace?',
      message: 'Dejará de ser accesible de inmediato.',
      confirmLabel: 'Revocar',
    });
    if (ok) deleteShares.mutate([id]);
  }

  async function handleDeleteExpired() {
    const count = expired.length;
    const ok = await confirm({
      title: `¿Eliminar ${count} ${plural(count, 'enlace')} ${plural(count, 'expirado')}?`,
      message: 'Se eliminará el historial de los enlaces vencidos.',
    });
    if (ok) deleteShares.mutate(expired.map(s => s.id));
  }

  function copyLink(share) {
    copyToClipboard(shareUrl(share));
    setCopiedId(share.id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  const footer = shares.length > 0 ? (
    <>
      <span className="small muted" style={{ alignSelf: 'center' }}>
        {active.length} {plural(active.length, 'activo')} de {shares.length}
      </span>
      {expired.length > 0 && (
        <button onClick={handleDeleteExpired} className="btn btn-ghost">
          <Trash2 size={14} /> Limpiar expirados
        </button>
      )}
    </>
  ) : null;

  return (
    <>
      <Modal title="Mis enlaces" description="Enlaces compartidos y su vigencia." size="lg" onClose={onClose} footer={footer} footerBetween>
        <div className="stack" style={{ gap: 8 }}>
          {isPending && <ListSkeleton rows={3} rowHeight={120} label="Cargando enlaces" />}

          {error && <ErrorState message={error.message} onRetry={refetch} />}

          {!isPending && !error && shares.length === 0 && (
            <EmptyState icon={Link2} title="Sin enlaces" description="Los enlaces que compartas aparecerán aquí." />
          )}

          {shares.map(share => {
            const isActive = new Date(share.expires_at) > now;
            const timeLeft = getTimeLeft(share.expires_at, now);
            const progress = getProgress(share.created_at, share.expires_at, now);
            const url = shareUrl(share);
            const copied = copiedId === share.id;

            return (
              <article key={share.id} className="card share-card">
                <div className="row-between" style={{ marginBottom: 8 }}>
                  <div className="row" style={{ flexWrap: 'wrap', minWidth: 0 }}>
                    <span className={`status ${isActive ? 'status-active' : 'status-expired'}`}>
                      {isActive ? <CheckCircle2 size={14} /> : <MinusCircle size={14} />}
                      {isActive ? 'Activo' : 'Expirado'}
                    </span>
                    <span className="small muted truncate">{shareScope(share)}</span>
                  </div>
                  <div className="row" style={{ gap: 2 }}>
                    {isActive && (
                      <>
                        <button onClick={() => copyLink(share)} className="icon-btn" title="Copiar enlace" aria-label="Copiar enlace">
                          {copied ? <Check size={15} /> : <Copy size={15} />}
                        </button>
                        <button onClick={() => window.open(url, '_blank')} className="icon-btn" title="Abrir enlace" aria-label="Abrir enlace">
                          <ExternalLink size={15} />
                        </button>
                      </>
                    )}
                    <button onClick={() => handleDelete(share.id)} className="icon-btn icon-btn-danger" title="Revocar enlace" aria-label="Revocar enlace">
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>

                <div
                  className="progress"
                  role="progressbar"
                  aria-label="Vigencia consumida"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(isActive ? progress : 100)}
                >
                  <div style={{ width: `${isActive ? progress : 100}%`, background: isActive ? 'var(--accent)' : 'var(--border-strong)' }} />
                </div>

                <div className="row-between small muted" style={{ flexWrap: 'wrap', margin: '8px 0' }}>
                  <span>Creado {formatDateTime(share.created_at)}</span>
                  {isActive && timeLeft
                    ? <span className="row" style={{ gap: 4 }}><Clock size={12} /> Quedan {timeLeft}</span>
                    : <span>Venció {formatDateTime(share.expires_at)}</span>}
                </div>

                <p className="url-box truncate">{url}</p>
              </article>
            );
          })}
        </div>
      </Modal>
      {dialog}
    </>
  );
}
