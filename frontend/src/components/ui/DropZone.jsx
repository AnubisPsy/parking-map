import { useState } from 'react';
import { FileSpreadsheet, Loader2 } from 'lucide-react';

// Zona para soltar archivos o abrir el selector. El <input type="file"> lo pone cada
// modal, porque algunos también lo usan después de esta pantalla.
export default function DropZone({ title = 'Arrastra el archivo aquí o haz clic para elegirlo', hint, busy = false, onPick, onDropFiles }) {
  const [over, setOver] = useState(false);
  return (
    <button
      type="button"
      className={`dropzone${over ? ' dropzone-over' : ''}`}
      onClick={onPick}
      disabled={busy}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        onDropFiles([...e.dataTransfer.files]);
      }}
    >
      {busy
        ? <Loader2 size={28} className="spin" color="var(--accent)" />
        : <FileSpreadsheet size={28} color="var(--ink-3)" />}
      <span style={{ fontWeight: 600, marginTop: 6 }}>{busy ? 'Procesando archivo…' : title}</span>
      {hint && <span className="small muted">{hint}</span>}
    </button>
  );
}
