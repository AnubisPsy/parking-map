import { useState, useEffect } from 'react';
import { useDeleteShares, useShares } from '../api/queries';
import { X, Copy, ExternalLink, Trash2, Link2, Clock, CheckCircle2, AlertCircle } from 'lucide-react';
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

// Los enlaces de reporte y de mapa viven en rutas distintas
function shareUrl(share) {
  const route = share.type === 'report' ? 'report' : 'map';
  return `${window.location.origin}/${route}/${share.token}`;
}

function shareScope(share) {
  if (share.type === 'report') return 'Reporte';
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

  return (
    <Modal label="Mis enlaces compartidos" onClose={onClose} style={modal}>
      <div style={header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Link2 size={18} />
          <h2 style={{ fontSize: 16, fontWeight: 700 }}>Mis enlaces compartidos</h2>
          {active.length > 0 && (
            <span style={activeBadge}>{active.length} {plural(active.length, 'activo')}</span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {expired.length > 0 && (
            <button onClick={handleDeleteExpired} style={{ ...btnGhost, fontSize: 12, color: 'white' }}>
              <Trash2 size={13} /> Limpiar expirados
            </button>
          )}
          <button onClick={onClose} style={closeBtn} aria-label="Cerrar"><X size={18} /></button>
        </div>
      </div>

      <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 10, flex: 1, minHeight: 0, overflowY: 'auto' }}>
        {isPending && <ListSkeleton rows={3} rowHeight={140} label="Cargando enlaces" />}

        {error && <ErrorState message={error.message} onRetry={refetch} />}

        {!isPending && !error && shares.length === 0 && (
          <EmptyState
            icon={Link2}
            title="Sin enlaces creados"
            description={'Genera un enlace con el botón "Compartir mapa"'}
          />
        )}

        {shares.map(share => {
          const isActive = new Date(share.expires_at) > now;
          const timeLeft = getTimeLeft(share.expires_at, now);
          const progress = getProgress(share.created_at, share.expires_at, now);
          const barColor = progress < 50 ? '#15803d' : progress < 80 ? '#b45309' : '#b91c1c';
          const url = shareUrl(share);

          return (
            <article key={share.id} style={{ ...card, background: isActive ? 'white' : '#f8fafc' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 10 }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, minWidth: 0 }}>
                  {isActive
                    ? <CheckCircle2 size={15} color="#15803d" />
                    : <AlertCircle size={15} color="#64748b" />}
                  <span style={{ fontSize: 13, fontWeight: 700, color: isActive ? '#15803d' : '#475569' }}>
                    {isActive ? 'Activo' : 'Expirado'}
                  </span>
                  <span style={unitsPill}>{shareScope(share)}</span>
                </div>
                <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                  {isActive && (
                    <>
                      <IconBtn onClick={() => copyLink(share)} title="Copiar enlace" active={copiedId === share.id}>
                        <Copy size={13} />
                      </IconBtn>
                      <IconBtn onClick={() => window.open(url, '_blank')} title="Abrir enlace">
                        <ExternalLink size={13} />
                      </IconBtn>
                    </>
                  )}
                  <IconBtn onClick={() => handleDelete(share.id)} title="Revocar enlace" danger>
                    <Trash2 size={13} />
                  </IconBtn>
                </div>
              </div>

              <div
                role="progressbar"
                aria-label="Vigencia consumida"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(isActive ? progress : 100)}
                style={{ height: 5, background: '#e2e8f0', borderRadius: 4, overflow: 'hidden', marginBottom: 10 }}
              >
                <div style={{
                  height: '100%',
                  width: `${isActive ? progress : 100}%`,
                  background: isActive ? barColor : '#94a3b8',
                  borderRadius: 4,
                  transition: 'width 0.5s',
                }} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px', fontSize: 12 }}>
                <InfoRow label="Creado" value={formatDateTime(share.created_at)} />
                <InfoRow label="Vence" value={formatDateTime(share.expires_at)} />
                {isActive && timeLeft && (
                  <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
                    <Clock size={12} color={barColor} />
                    <span style={{ fontWeight: 700, color: barColor, fontSize: 12 }}>
                      Tiempo restante: {timeLeft}
                    </span>
                  </div>
                )}
              </div>

              <div style={{ marginTop: 8, background: '#f1f5f9', borderRadius: 6, padding: '5px 10px', fontSize: 11, color: '#334155', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {url}
              </div>
            </article>
          );
        })}
      </div>

      {shares.length > 0 && (
        <div style={{ padding: '12px 20px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, color: '#475569', flexShrink: 0 }}>
          <span>{shares.length} {plural(shares.length, 'enlace')} en total · {active.length} {plural(active.length, 'activo')}</span>
          <button onClick={onClose} style={{ ...btnGhost, color: '#374151', fontWeight: 600 }}>Cerrar</button>
        </div>
      )}
      {dialog}
    </Modal>
  );
}

function InfoRow({ label, value }) {
  return (
    <div>
      <span style={{ color: '#475569', display: 'block', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</span>
      <span style={{ color: '#374151', fontWeight: 500 }}>{value}</span>
    </div>
  );
}

function IconBtn({ children, onClick, title, active, danger }) {
  return (
    <button
      onClick={onClick}
      title={title}
      aria-label={title}
      style={{
        background: active ? '#dcfce7' : 'transparent',
        border: '1px solid',
        borderColor: active ? '#86efac' : danger ? '#fecaca' : '#64748b',
        borderRadius: 6,
        padding: '4px 7px',
        cursor: 'pointer',
        color: active ? '#15803d' : danger ? '#b91c1c' : '#475569',
        display: 'flex',
        alignItems: 'center',
      }}
    >
      {children}
    </button>
  );
}

const modal = {
  borderRadius: 16, maxWidth: 600, display: 'flex', flexDirection: 'column', overflow: 'hidden',
};
const header = {
  padding: '16px 20px',
  background: 'linear-gradient(135deg, #1d4ed8 0%, #2563eb 100%)',
  color: 'white', display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'space-between',
  alignItems: 'center', flexShrink: 0,
};
const closeBtn = {
  background: 'none', border: 'none', color: 'white',
  cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', borderRadius: 4,
};
const card = {
  border: '1px solid #e2e8f0', borderRadius: 12, padding: '14px 16px',
  boxShadow: '0 1px 4px rgba(0,0,0,0.05)', flexShrink: 0,
};
const unitsPill = {
  background: '#f1f5f9', color: '#334155', fontSize: 11, fontWeight: 600,
  padding: '2px 8px', borderRadius: 20,
};
const activeBadge = {
  background: 'rgba(255,255,255,0.2)', fontSize: 12, fontWeight: 600,
  padding: '2px 8px', borderRadius: 20,
};
const btnGhost = {
  background: 'none', border: 'none', cursor: 'pointer',
  display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px', borderRadius: 6,
};
