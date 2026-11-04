import { useState } from 'react';
import { X } from 'lucide-react';
import { useCreateParking } from '../api/queries';
import Modal from './ui/Modal';

const FIELD = {
  unit_id: '', unit_name: '', latitude: '', longitude: '',
  address: '', hours: '', minutes: '', parking_start: '', notes: ''
};

export default function ParkingForm({ onCreated, onClose }) {
  const [form, setForm] = useState(FIELD);
  const [error, setError] = useState('');
  const createParking = useCreateParking();

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

    try {
      const created = await createParking.mutateAsync({
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
    }
  }

  return (
    <Modal label="Nuevo registro de estacionamiento" onClose={onClose} style={{ maxWidth: 560 }}>
      <div style={header}>
        <h2 style={{ fontSize: 18, fontWeight: 700 }}>Nuevo Registro de Estacionamiento</h2>
        <button onClick={onClose} style={closeBtn} aria-label="Cerrar"><X size={18} /></button>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: 24 }}>
        <div style={grid2}>
          <Field label="ID Unidad" required>
            <input style={input} value={form.unit_id} onChange={set('unit_id')}
              placeholder="Ej: VEH-001" required data-autofocus />
          </Field>
          <Field label="Nombre Unidad">
            <input style={input} value={form.unit_name} onChange={set('unit_name')}
              placeholder="Ej: Camioneta Azul" />
          </Field>
        </div>

        <div style={grid2}>
          <Field label="Latitud" required>
            <input style={input} type="number" step="any" value={form.latitude}
              onChange={set('latitude')} placeholder="Ej: 19.432608" required />
          </Field>
          <Field label="Longitud" required>
            <input style={input} type="number" step="any" value={form.longitude}
              onChange={set('longitude')} placeholder="Ej: -99.133209" required />
          </Field>
        </div>

        <Field label="Dirección">
          <input style={input} value={form.address} onChange={set('address')}
            placeholder="Ej: Av. Reforma 123, CDMX" />
        </Field>

        <fieldset style={{ border: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <legend style={{ ...label, marginBottom: 6 }}>Tiempo de estacionamiento</legend>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <input style={{ ...input, paddingRight: 48 }} type="number" min="0" aria-label="Horas"
                value={form.hours} onChange={set('hours')} placeholder="0" />
              <span aria-hidden="true" style={unit}>horas</span>
            </div>
            <div style={{ flex: 1, position: 'relative' }}>
              <input style={{ ...input, paddingRight: 48 }} type="number" min="0" max="59" aria-label="Minutos"
                value={form.minutes} onChange={set('minutes')} placeholder="0" />
              <span aria-hidden="true" style={unit}>min</span>
            </div>
          </div>
        </fieldset>

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
          <div role="alert" style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c',
            borderRadius: 8, padding: '10px 14px', fontSize: 13 }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 4 }}>
          <button type="button" onClick={onClose} style={btnSecondary}>Cancelar</button>
          <button type="submit" disabled={createParking.isPending} style={btnPrimary}>
            {createParking.isPending ? 'Guardando...' : 'Guardar Registro'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function Field({ label: labelText, children, required }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={label}>
        {labelText}{required && <span aria-hidden="true" style={{ color: '#b91c1c' }}> *</span>}
      </span>
      {children}
    </label>
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
const grid2 = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))', gap: 12 };
const label = { fontSize: 13, fontWeight: 600, color: '#374151' };
const input = {
  padding: '9px 12px', border: '1px solid #94a3b8', borderRadius: 8,
  fontSize: 14, width: '100%',
  transition: 'border-color 0.15s',
};
const unit = {
  position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
  fontSize: 12, color: '#475569', pointerEvents: 'none'
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
