import { useState } from 'react';
import { createShareLink } from '../api';
import { Link2, CheckCircle2, Copy, Check, ExternalLink } from 'lucide-react';

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

const DURATIONS = [
  { label: '15 minutos', value: 15 },
  { label: '30 minutos', value: 30 },
  { label: '1 hora', value: 60 },
  { label: '2 horas', value: 120 },
  { label: '6 horas', value: 360 },
  { label: '12 horas', value: 720 },
  { label: '24 horas', value: 1440 },
  { label: '7 días', value: 10080 },
  { label: 'Personalizado', value: 'custom' },
];

export default function ShareLinkModal({ units, onClose }) {
  const [mode, setMode] = useState('all'); // 'all' | 'select'
  const [selected, setSelected] = useState([]);
  const [duration, setDuration] = useState(60);
  const [customMin, setCustomMin] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  function toggleUnit(uid) {
    setSelected(s => s.includes(uid) ? s.filter(x => x !== uid) : [...s, uid]);
  }

  function getMinutes() {
    return duration === 'custom' ? parseInt(customMin) : duration;
  }

  async function generate() {
    setError('');
    const mins = getMinutes();
    if (!mins || isNaN(mins) || mins < 1) return setError('Duración inválida');
    if (mode === 'select' && selected.length === 0) return setError('Selecciona al menos una unidad');
    setLoading(true);
    try {
      const data = await createShareLink({
        unit_ids: mode === 'all' ? null : selected,
        expires_in_minutes: mins,
      });
      const url = `${window.location.origin}/map/${data.token}`;
      setResult({ url, expires_at: data.expires_at });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function copy() {
    copyToClipboard(result.url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const expiry = result
    ? new Date(result.expires_at).toLocaleString('es-MX', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
      })
    : '';

  return (
    <div style={overlay}>
      <div style={modal}>
        <div style={header}>
          <h2 style={{ fontSize: 18, fontWeight: 700 }}>Generar Enlace Compartido</h2>
          <button onClick={onClose} style={closeBtn}>✕</button>
        </div>

        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
          {!result ? (
            <>
              {/* Unidades */}
              <div>
                <p style={sectionLabel}>Unidades a incluir</p>
                <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                  <button style={mode === 'all' ? chipActive : chip} onClick={() => setMode('all')}>
                    Todas las unidades
                  </button>
                  <button style={mode === 'select' ? chipActive : chip} onClick={() => setMode('select')}>
                    Seleccionar unidades
                  </button>
                </div>

                {mode === 'select' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 180, overflowY: 'auto' }}>
                    {units.length === 0 && (
                      <p style={{ color: '#94a3b8', fontSize: 13 }}>No hay unidades registradas</p>
                    )}
                    {units.map(u => (
                      <label key={u.id} style={checkRow}>
                        <input type="checkbox" checked={selected.includes(u.id)}
                          onChange={() => toggleUnit(u.id)}
                          style={{ accentColor: '#2563eb', width: 16, height: 16 }} />
                        <span style={{ fontWeight: 600 }}>{u.id}</span>
                        {u.name && <span style={{ color: '#64748b', fontSize: 13 }}>— {u.name}</span>}
                        <span style={{ marginLeft: 'auto', fontSize: 12, color: '#94a3b8' }}>
                          {u.count} registro{u.count !== 1 ? 's' : ''}
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {/* Duración */}
              <div>
                <p style={sectionLabel}>Vigencia del enlace</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {DURATIONS.map(d => (
                    <button
                      key={d.value}
                      style={duration === d.value ? chipActive : chip}
                      onClick={() => setDuration(d.value)}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
                {duration === 'custom' && (
                  <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input
                      type="number" min="1" max="10080"
                      value={customMin} onChange={e => setCustomMin(e.target.value)}
                      placeholder="ej: 90"
                      style={{ ...inputSt, width: 100 }}
                    />
                    <span style={{ fontSize: 13, color: '#64748b' }}>minutos</span>
                  </div>
                )}
              </div>

              {error && (
                <div style={errorBox}>{error}</div>
              )}

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button onClick={onClose} style={btnSec}>Cancelar</button>
                <button onClick={generate} disabled={loading} style={{ ...btnPri, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Link2 size={14} /> {loading ? 'Generando...' : 'Generar enlace'}
                </button>
              </div>
            </>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ textAlign: 'center', paddingBottom: 8 }}>
                <CheckCircle2 size={44} color="#16a34a" style={{ marginBottom: 8 }} />
                <p style={{ fontWeight: 700, fontSize: 16 }}>Enlace generado correctamente</p>
                <p style={{ color: '#64748b', fontSize: 13, marginTop: 4 }}>
                  Expira el {expiry}
                </p>
              </div>

              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '12px 14px' }}>
                <p style={{ fontSize: 12, color: '#64748b', marginBottom: 6 }}>URL del mapa:</p>
                <p style={{ fontSize: 13, wordBreak: 'break-all', color: '#2563eb', fontWeight: 500 }}>
                  {result.url}
                </p>
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={copy} style={{ ...btnPri, flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  {copied ? <><Check size={14} /> Copiado!</> : <><Copy size={14} /> Copiar enlace</>}
                </button>
                <button
                  onClick={() => window.open(result.url, '_blank')}
                  style={{ ...btnSec, flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                >
                  <ExternalLink size={14} /> Abrir mapa
                </button>
              </div>

              <button onClick={onClose} style={{ ...btnSec, width: '100%' }}>Cerrar</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const overlay = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  zIndex: 9999, padding: 20
};
const modal = {
  background: 'white', borderRadius: 14, width: '100%', maxWidth: 500,
  maxHeight: '90vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
};
const header = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  padding: '20px 24px', borderBottom: '1px solid #e2e8f0'
};
const closeBtn = {
  background: 'none', border: 'none', fontSize: 18, cursor: 'pointer',
  color: '#64748b', padding: 4, borderRadius: 6
};
const sectionLabel = { fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 10 };
const chip = {
  padding: '6px 14px', background: '#f1f5f9', border: '1px solid #e2e8f0',
  borderRadius: 20, fontSize: 13, cursor: 'pointer', color: '#374151', fontFamily: 'inherit'
};
const chipActive = {
  ...chip, background: '#eff6ff', border: '1px solid #2563eb',
  color: '#2563eb', fontWeight: 600
};
const checkRow = {
  display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
  background: '#f8fafc', borderRadius: 8, cursor: 'pointer', fontSize: 14
};
const inputSt = {
  padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 8,
  fontSize: 14, fontFamily: 'inherit', outline: 'none'
};
const errorBox = {
  background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626',
  borderRadius: 8, padding: '10px 14px', fontSize: 13
};
const btnPri = {
  padding: '10px 20px', background: '#2563eb', color: 'white',
  border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600,
  cursor: 'pointer', fontFamily: 'inherit'
};
const btnSec = {
  padding: '10px 20px', background: 'white', color: '#374151',
  border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14,
  fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit'
};
