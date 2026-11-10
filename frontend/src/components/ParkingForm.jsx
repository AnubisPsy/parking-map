import { useState } from 'react';
import { useCreateParking } from '../api/queries';
import Modal from './ui/Modal';

const FIELD = {
  unit_id: '', unit_name: '', latitude: '', longitude: '',
  address: '', hours: '', minutes: '', parking_start: '', notes: ''
};

const FORM_ID = 'parking-form';

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
    <Modal
      title="Nuevo registro"
      description="Agrega un estacionamiento manualmente."
      onClose={onClose}
      footer={(
        <>
          <button type="button" onClick={onClose} className="btn btn-secondary">Cancelar</button>
          <button type="submit" form={FORM_ID} disabled={createParking.isPending} className="btn btn-primary">
            {createParking.isPending ? 'Guardando…' : 'Guardar Registro'}
          </button>
        </>
      )}
    >
      <form id={FORM_ID} onSubmit={handleSubmit} className="stack">
        <div className="form-grid">
          <Field label="ID Unidad" required>
            <input className="input" value={form.unit_id} onChange={set('unit_id')} placeholder="VEH-001" required data-autofocus />
          </Field>
          <Field label="Nombre o placa">
            <input className="input" value={form.unit_name} onChange={set('unit_name')} placeholder="Camioneta azul" />
          </Field>
        </div>

        <div className="form-grid">
          <Field label="Latitud" required>
            <input className="input" type="number" step="any" value={form.latitude} onChange={set('latitude')} placeholder="15.7764" required />
          </Field>
          <Field label="Longitud" required>
            <input className="input" type="number" step="any" value={form.longitude} onChange={set('longitude')} placeholder="-86.7920" required />
          </Field>
        </div>

        <Field label="Dirección o sucursal">
          <input className="input" value={form.address} onChange={set('address')} />
        </Field>

        <div className="form-grid">
          <Field label="Inicio">
            <input className="input" type="datetime-local" value={form.parking_start} onChange={set('parking_start')} />
          </Field>
          <fieldset className="field">
            <legend className="field-label" style={{ marginBottom: 6 }}>Duración</legend>
            <div className="row">
              <div style={{ flex: 1, position: 'relative' }}>
                <input className="input" style={{ paddingRight: 44 }} type="number" min="0" aria-label="Horas" value={form.hours} onChange={set('hours')} placeholder="0" />
                <span aria-hidden="true" style={unit}>h</span>
              </div>
              <div style={{ flex: 1, position: 'relative' }}>
                <input className="input" style={{ paddingRight: 44 }} type="number" min="0" max="59" aria-label="Minutos" value={form.minutes} onChange={set('minutes')} placeholder="0" />
                <span aria-hidden="true" style={unit}>min</span>
              </div>
            </div>
          </fieldset>
        </div>

        <Field label="Notas">
          <textarea className="input" value={form.notes} onChange={set('notes')} />
        </Field>

        {error && <div role="alert" className="notice notice-error">{error}</div>}
      </form>
    </Modal>
  );
}

function Field({ label, children, required }) {
  return (
    <label className="field">
      <span className="field-label">
        {label}{required && <span aria-hidden="true" className="required"> *</span>}
      </span>
      {children}
    </label>
  );
}

const unit = {
  position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
  fontSize: 12, color: 'var(--ink-3)', pointerEvents: 'none',
};
