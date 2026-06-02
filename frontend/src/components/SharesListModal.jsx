import { useState, useEffect } from 'react';
import { fetchShares, deleteShare } from '../api';
import { X, Copy, ExternalLink, Trash2, Link2, Clock, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import { useConfirm } from './ConfirmModal';

function copyToClipboard(text) {
  if (navigator.clipboard && window.isSecureContext) {
    return navigator.clipboard.writeText(text);
  }
  const el = document.createElement('textarea');
  el.value = text;
  el.style.cssText = 'position:fixed;top:-9999px;left:-9999px;opacity:0';
  document.body.appendChild(el);
  el.focus();
  el.select();
  try { document.execCommand('copy'); } catch {}
  document.body.removeChild(el);
  return Promise.resolve();
}

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

function fmtDate(iso) {
  return new Date(iso).toLocaleString('es-MX', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function SharesListModal({ onClose, onNewLink }) {
  const [shares, setShares] = useState([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState(null);
  const now = useNow(30_000);
  const { confirm, dialog } = useConfirm();

  useEffect(() => {
    fetchShares()
      .then(data => { setShares(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  async function handleDelete(id) {
    const ok = await confirm({
      title: '¿Revocar este enlace?',
      message: 'Dejará de ser accesible de inmediato.',
      confirmLabel: 'Revocar',
    });
    if (!ok) return;
    try {
      await deleteShare(id);
      setShares(prev => prev.filter(s => s.id !== id));
    } catch (err) {
      console.error(err);
    }
  }

  async function handleDeleteExpired() {
    const expired = shares.filter(s => new Date(s.expires_at) <= now);
    if (!expired.length) return;
    const ok = await confirm({
      title: `¿Eliminar ${expired.length} enlace${expired.length !== 1 ? 's' : ''} expirado${expired.length !== 1 ? 's' : ''}?`,
      message: 'Se eliminará el historial de los enlaces vencidos.',
    });
    if (!ok) return;
    await Promise.all(expired.map(s => deleteShare(s.id).catch(() => {})));
    setShares(prev => prev.filter(s => new Date(s.expires_at) > now));
  }

  function copyLink(token, id) {
    copyToClipboard(`${window.location.origin}/map/${token}`);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  const active = shares.filter(s => new Date(s.expires_at) > now);
  const expired = shares.filter(s => new Date(s.expires_at) <= now);

  return (
    <div style={overlay}>
      <div style={modal}>
        {/* Header */}
        <div style={header}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Link2 size={18} />
            <span>Mis enlaces compartidos</span>
            {active.length > 0 && (
              <span style={activeBadge}>{active.length} activo{active.length !== 1 ? 's' : ''}</span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {expired.length > 0 && (
              <button
                onClick={handleDeleteExpired}
                style={{ ...btnGhost, fontSize: 12, gap: 4, color: '#94a3b8' }}
                title="Eliminar todos los expirados"
              >
                <Trash2 size={13} /> Limpiar expirados
              </button>
            )}
            <button onClick={onClose} style={closeBtn}><X size={18} /></button>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 10, maxHeight: '70vh', overflowY: 'auto' }}>
          {loading && (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#94a3b8' }}>
              <RefreshCw size={28} style={{ marginBottom: 10 }} />
              <p>Cargando enlaces…</p>
            </div>
          )}

          {!loading && shares.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#94a3b8' }}>
              <Link2 size={36} style={{ marginBottom: 12 }} />
              <p style={{ fontWeight: 600, marginBottom: 6, color: '#475569' }}>Sin enlaces creados</p>
              <p style={{ fontSize: 13 }}>Genera un enlace con el botón "Compartir mapa"</p>
            </div>
          )}

          {!loading && shares.map(share => {
            const isActive = new Date(share.expires_at) > now;
            const timeLeft = getTimeLeft(share.expires_at, now);
            const progress = getProgress(share.created_at, share.expires_at, now);
            const barColor = progress < 50 ? '#16a34a' : progress < 80 ? '#d97706' : '#dc2626';
            const url = `${window.location.origin}/map/${share.token}`;

            return (
              <div key={share.id} style={{ ...card, opacity: isActive ? 1 : 0.7 }}>
                {/* Top row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {isActive
                      ? <CheckCircle2 size={15} color="#16a34a" />
                      : <AlertCircle size={15} color="#94a3b8" />
                    }
                    <span style={{ fontSize: 13, fontWeight: 700, color: isActive ? '#15803d' : '#94a3b8' }}>
                      {isActive ? 'Activo' : 'Expirado'}
                    </span>
                    <span style={unitsPill}>
                      {share.unit_ids ? share.unit_ids.join(', ') : 'Todas las unidades'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {isActive && (
                      <>
                        <IconBtn
                          onClick={() => copyLink(share.token, share.id)}
                          title="Copiar enlace"
                          active={copiedId === share.id}
                        >
                          <Copy size={13} />
                        </IconBtn>
                        <IconBtn
                          onClick={() => window.open(url, '_blank')}
                          title="Abrir enlace"
                        >
                          <ExternalLink size={13} />
                        </IconBtn>
                      </>
                    )}
                    <IconBtn
                      onClick={() => handleDelete(share.id)}
                      title="Revocar enlace"
                      danger
                    >
                      <Trash2 size={13} />
                    </IconBtn>
                  </div>
                </div>

                {/* Progress bar */}
                <div style={{ height: 5, background: '#e2e8f0', borderRadius: 4, overflow: 'hidden', marginBottom: 10 }}>
                  <div style={{
                    height: '100%',
                    width: `${isActive ? progress : 100}%`,
                    background: isActive ? barColor : '#cbd5e1',
                    borderRadius: 4,
                    transition: 'width 0.5s',
                  }} />
                </div>

                {/* Info grid */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px', fontSize: 12 }}>
                  <InfoRow label="Creado" value={fmtDate(share.created_at)} />
                  <InfoRow label="Vence" value={fmtDate(share.expires_at)} />
                  {isActive && timeLeft && (
                    <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
                      <Clock size={12} color={barColor} />
                      <span style={{ fontWeight: 700, color: barColor, fontSize: 12 }}>
                        Tiempo restante: {timeLeft}
                      </span>
                    </div>
                  )}
                </div>

                {/* Token */}
                <div style={{ marginTop: 8, background: '#f8fafc', borderRadius: 6, padding: '5px 10px', fontSize: 11, color: '#64748b', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {url}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        {!loading && shares.length > 0 && (
          <div style={{ padding: '12px 20px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, color: '#94a3b8' }}>
            <span>{shares.length} enlace{shares.length !== 1 ? 's' : ''} en total · {active.length} activo{active.length !== 1 ? 's' : ''}</span>
            <button onClick={onClose} style={{ ...btnGhost, color: '#374151', fontWeight: 600 }}>Cerrar</button>
          </div>
        )}
      </div>
      {dialog}
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div>
      <span style={{ color: '#94a3b8', display: 'block', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</span>
      <span style={{ color: '#374151', fontWeight: 500 }}>{value}</span>
    </div>
  );
}

function IconBtn({ children, onClick, title, active, danger }) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        background: active ? '#dcfce7' : danger ? 'transparent' : 'transparent',
        border: '1px solid',
        borderColor: active ? '#86efac' : danger ? '#fecaca' : '#e2e8f0',
        borderRadius: 6,
        padding: '4px 7px',
        cursor: 'pointer',
        color: active ? '#16a34a' : danger ? '#dc2626' : '#64748b',
        display: 'flex',
        alignItems: 'center',
      }}
    >
      {children}
    </button>
  );
}

const overlay = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  zIndex: 2000, padding: 20,
};
const modal = {
  background: 'white', borderRadius: 16, width: '100%', maxWidth: 600,
  maxHeight: '90vh', boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
  display: 'flex', flexDirection: 'column', overflow: 'hidden',
};
const header = {
  padding: '16px 20px',
  background: 'linear-gradient(135deg, #1d4ed8 0%, #2563eb 100%)',
  color: 'white', display: 'flex', justifyContent: 'space-between',
  alignItems: 'center', fontSize: 16, fontWeight: 700, flexShrink: 0,
};
const closeBtn = {
  background: 'none', border: 'none', color: 'white',
  cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center',
};
const card = {
  background: 'white', border: '1px solid #e2e8f0', borderRadius: 12,
  padding: '14px 16px',
  boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
};
const unitsPill = {
  background: '#f1f5f9', color: '#475569',
  fontSize: 11, fontWeight: 600,
  padding: '2px 8px', borderRadius: 20,
};
const activeBadge = {
  background: 'rgba(255,255,255,0.2)',
  fontSize: 12, fontWeight: 600,
  padding: '2px 8px', borderRadius: 20,
};
const btnGhost = {
  background: 'none', border: 'none', cursor: 'pointer',
  fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 4,
  padding: '4px 8px', borderRadius: 6,
};
