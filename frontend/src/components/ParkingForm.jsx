import { useState } from 'react';
import { createParking } from '../api';

const FIELD = {
  unit_id: '', unit_name: '', latitude: '', longitude: '',
  address: '', hours: '', minutes: '', parking_start: '', notes: ''
};

export default function ParkingForm({ onCreated, onClose }) {
  const [form, setForm] = useState(FIELD);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function set(k) {
    return (e) => setForm(f => ({ ...f, [k]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    const lat = parseFloat(form.latitude);
    const lng = parseFloat(form.longitude);
    if (isNaN(lat) || lat < -90 || lat > 90) return setError('Latitud inválida (-90 a 90)');
    if (isNaN(lng) || lng < -180 || lng > 180) return setError('Longitud inválida (-180 a 180)');

    const parking_duration =
      (parseInt(form.hours || 0) * 60) + parseInt(form.minutes || 0) || null;

    setLoading(true);
    try {
      const created = await createParking({
        unit_id: form.unit_id,
        unit_name: form.unit_name || undefined,
        latitude: lat,
        longitude: lng,
        address: form.address || undefined,
        parking_duration,
        parking_start: form.parking_start || undefined,
        notes: form.notes || undefined,
      });
      onCreated(created);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={overlay}>
      <div style={modal}>
        <div style={header}>
          <h2 style={{ fontSize: 18, fontWeight: 700 }}>Nuevo Registro de Estacionamiento</h2>
          <button onClick={onClose} style={closeBtn}>✕</button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={grid2}>
            <Field label="ID Unidad *" required>
              <input style={input} value={form.unit_id} onChange={set('unit_id')}
                placeholder="Ej: VEH-001" required />
            </Field>
            <Field label="Nombre Unidad">
              <input style={input} value={form.unit_name} onChange={set('unit_name')}
                placeholder="Ej: Camioneta Azul" />
            </Field>
          </div>

          <div style={grid2}>
            <Field label="Latitud *" required>
              <input style={input} type="number" step="any" value={form.latitude}
                onChange={set('latitude')} placeholder="Ej: 19.432608" required />
            </Field>
            <Field label="Longitud *" required>
              <input style={input} type="number" step="any" value={form.longitude}
                onChange={set('longitude')} placeholder="Ej: -99.133209" required />
            </Field>
          </div>

          <Field label="Dirección">
            <input style={input} value={form.address} onChange={set('address')}
              placeholder="Ej: Av. Reforma 123, CDMX" />
          </Field>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={label}>Tiempo de estacionamiento</label>
            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{ flex: 1, position: 'relative' }}>
                <input style={{ ...input, paddingRight: 40 }} type="number" min="0"
                  value={form.hours} onChange={set('hours')} placeholder="0" />
                <span style={unit}>horas</span>
              </div>
              <div style={{ flex: 1, position: 'relative' }}>
                <input style={{ ...input, paddingRight: 40 }} type="number" min="0" max="59"
                  value={form.minutes} onChange={set('minutes')} placeholder="0" />
                <span style={unit}>min</span>
              </div>
            </div>
          </div>

          <Field label="Inicio del estacionamiento">
            <input style={input} type="datetime-local" value={form.parking_start}
              onChange={set('parking_start')} />
          </Field>

          <Field label="Notas">
            <textarea style={{ ...input, resize: 'vertical', minHeight: 70 }}
              value={form.notes} onChange={set('notes')}
              placeholder="Observaciones adicionales..." />
          </Field>

          {error && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626',
              borderRadius: 8, padding: '10px 14px', fontSize: 13 }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 4 }}>
            <button type="button" onClick={onClose} style={btnSecondary}>Cancelar</button>
            <button type="submit" disabled={loading} style={btnPrimary}>
              {loading ? 'Guardando...' : 'Guardar Registro'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label: labelText, children, required }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={label}>{labelText}{required && <span style={{ color: '#ef4444' }}> *</span>}</label>
      {children}
    </div>
  );
}

const overlay = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  zIndex: 9999, padding: 20
};
const modal = {
  background: 'white', borderRadius: 14, width: '100%', maxWidth: 560,
  maxHeight: '90vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
};
const header = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  padding: '20px 24px', borderBottom: '1px solid #e2e8f0'
};
const closeBtn = {
  background: 'none', border: 'none', fontSize: 18, cursor: 'pointer',
  color: '#64748b', padding: 4, borderRadius: 6, lineHeight: 1
};
const grid2 = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 };
const label = { fontSize: 13, fontWeight: 600, color: '#374151' };
const input = {
  padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8,
  fontSize: 14, width: '100%', outline: 'none',
  transition: 'border-color 0.15s',
  fontFamily: 'inherit'
};
const unit = {
  position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
  fontSize: 12, color: '#94a3b8', pointerEvents: 'none'
};
const btnPrimary = {
  padding: '10px 22px', background: '#2563eb', color: 'white',
  border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600,
  cursor: 'pointer'
};
const btnSecondary = {
  padding: '10px 22px', background: 'white', color: '#374151',
  border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14,
  fontWeight: 600, cursor: 'pointer'
};

// Add styles in module
const style = document.createElement('style');
style.textContent = `
  input:focus, textarea:focus { border-color: #2563eb !important; box-shadow: 0 0 0 3px rgba(37,99,235,0.1); }
  form { padding: 24px; }
`;
if (typeof document !== 'undefined') document.head.appendChild(style);
