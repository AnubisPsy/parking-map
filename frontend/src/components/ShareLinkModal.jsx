import { useState } from 'react';
import { useCreateShareLink } from '../api/queries';
import { Link2, CheckCircle2, Copy, Check, ExternalLink, X } from 'lucide-react';
import { copyToClipboard } from '../lib/clipboard';
import { formatDateTime } from '../lib/format';
import Modal from './ui/Modal';

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

const GROUP_LABELS = { unit: 'Unidad', date: 'Fecha', address: 'Sucursal', date_unit: 'Fecha + Unidad' };

export default function ShareLinkModal({ units, dateFrom, dateTo, groupBy, onClose }) {
  const [mode, setMode] = useState('all'); // 'all' | 'select'
  const [selected, setSelected] = useState([]);
  const [duration, setDuration] = useState(60);
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

  function getMinutes() {
    return duration === 'custom' ? parseInt(customMin) : duration;
  }

  async function generate() {
    setError('');
    const mins = getMinutes();
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

  const expiry = result ? formatDateTime(result.expires_at) : '';

  return (
    <Modal label="Generar enlace compartido" onClose={onClose} style={{ maxWidth: 500 }}>
        <div style={header}>
          <h2 style={{ fontSize: 18, fontWeight: 700 }}>Generar Enlace Compartido</h2>
          <button onClick={onClose} style={closeBtn} aria-label="Cerrar"><X size={18} /></button>
        </div>

        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
          {!result ? (
            <>
              {/* Unidades */}
              <div>
                <p style={sectionLabel}>Unidades a incluir</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                  <button style={mode === 'all' ? chipActive : chip} aria-pressed={mode === 'all'} onClick={() => setMode('all')}>
                    Todas las unidades
                  </button>
                  <button style={mode === 'select' ? chipActive : chip} aria-pressed={mode === 'select'} onClick={() => setMode('select')}>
                    Seleccionar unidades
                  </button>
                </div>

                {mode === 'select' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 180, overflowY: 'auto' }}>
                    {units.length === 0 && (
                      <p style={{ color: '#64748b', fontSize: 13 }}>No hay unidades registradas</p>
                    )}
                    {units.map(u => (
                      <label key={u.id} style={checkRow}>
                        <input type="checkbox" checked={selected.includes(u.id)}
                          onChange={() => toggleUnit(u.id)}
                          style={{ accentColor: '#2563eb', width: 16, height: 16 }} />
                        <span style={{ fontWeight: 600 }}>{u.id}</span>
                        {u.name && <span style={{ color: '#64748b', fontSize: 13 }}>— {u.name}</span>}
                        <span style={{ marginLeft: 'auto', fontSize: 12, color: '#64748b' }}>
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
                      aria-pressed={duration === d.value}
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
                      aria-label="Vigencia en minutos"
                      style={{ ...inputSt, width: 100 }}
                    />
                    <span style={{ fontSize: 13, color: '#64748b' }}>minutos</span>
                  </div>
                )}
              </div>

              {(hasGroupByFilter || hasDatesFilter) && (
                <div>
                  <p style={sectionLabel}>Filtros del enlace</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {hasGroupByFilter && (
                      <label style={toggleRow(includeGroupBy)}>
                        <input type="checkbox" checked={includeGroupBy} onChange={e => setIncludeGroupBy(e.target.checked)}
                          style={{ accentColor: '#2563eb', width: 15, height: 15, flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <span style={{ fontWeight: 600, fontSize: 13 }}>Agrupación</span>
                          <span style={{ fontSize: 12, color: includeGroupBy ? '#2563eb' : '#64748b', marginLeft: 8 }}>
                            {GROUP_LABELS[groupBy]}
                          </span>
                        </div>
                        <span style={{ fontSize: 11, color: includeGroupBy ? '#15803d' : '#64748b', fontWeight: 600, flexShrink: 0 }}>
                          {includeGroupBy ? 'Incluido' : 'Manual'}
                        </span>
                      </label>
                    )}
                    {hasDatesFilter && (
                      <label style={toggleRow(includeDates)}>
                        <input type="checkbox" checked={includeDates} onChange={e => setIncludeDates(e.target.checked)}
                          style={{ accentColor: '#2563eb', width: 15, height: 15, flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <span style={{ fontWeight: 600, fontSize: 13 }}>Fechas</span>
                          <span style={{ fontSize: 12, color: includeDates ? '#2563eb' : '#64748b', marginLeft: 8 }}>
                            {dateFrom && dateTo ? `${dateFrom} → ${dateTo}` : dateFrom ? `desde ${dateFrom}` : `hasta ${dateTo}`}
                          </span>
                        </div>
                        <span style={{ fontSize: 11, color: includeDates ? '#15803d' : '#64748b', fontWeight: 600, flexShrink: 0 }}>
                          {includeDates ? 'Incluido' : 'Manual'}
                        </span>
                      </label>
                    )}
                  </div>
                </div>
              )}

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
                <CheckCircle2 size={44} color="#15803d" style={{ marginBottom: 8 }} />
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
    </Modal>
  );
}

const header = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  padding: '20px 24px', borderBottom: '1px solid #e2e8f0'
};
const closeBtn = {
  background: 'none', border: 'none', cursor: 'pointer',
  color: '#64748b', padding: 4, borderRadius: 6, display: 'flex'
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
  background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c',
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
const toggleRow = (active) => ({
  display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px',
  background: active ? '#eff6ff' : '#f8fafc',
  border: `1px solid ${active ? '#bfdbfe' : '#e2e8f0'}`,
  borderRadius: 8, cursor: 'pointer',
});
