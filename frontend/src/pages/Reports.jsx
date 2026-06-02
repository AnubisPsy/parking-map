import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchReports, deleteReport } from '../api';
import ReportImportModal from '../components/ReportImportModal';
import { useConfirm } from '../components/ConfirmModal';
import { BarChart2, Plus, Trash2, ArrowLeft, Calendar, Zap, Clock, AlertTriangle } from 'lucide-react';

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso + 'T12:00:00').toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function Reports() {
  const navigate = useNavigate();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showImport, setShowImport] = useState(false);
  const { confirm, dialog } = useConfirm();

  useEffect(() => {
    fetchReports()
      .then(setReports)
      .finally(() => setLoading(false));
  }, []);

  async function handleDelete(e, id, label) {
    e.stopPropagation();
    const ok = await confirm({
      title: `¿Eliminar "${label}"?`,
      message: 'Se eliminará el reporte y todos sus datos. Esta acción no se puede deshacer.',
    });
    if (!ok) return;
    await deleteReport(id);
    setReports(prev => prev.filter(r => r.id !== id));
  }

  function handleImported(report) {
    setReports(prev => [report, ...prev]);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#f8fafc' }}>
      {/* Header */}
      <header style={headerStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => navigate('/')} style={backBtn} title="Volver">
            <ArrowLeft size={18} />
          </button>
          <BarChart2 size={24} color="white" />
          <div>
            <h1 style={{ fontSize: 17, fontWeight: 800, color: 'white' }}>Reportes Semanales</h1>
            <p style={{ fontSize: 12, color: '#93c5fd' }}>
              {reports.length} reporte{reports.length !== 1 ? 's' : ''} importado{reports.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <button onClick={() => setShowImport(true)} style={btnWhite}>
          <Plus size={14} /> Importar reporte
        </button>
      </header>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 32px', maxWidth: 900, width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>
        {loading && (
          <p style={{ color: '#94a3b8', textAlign: 'center', padding: 40 }}>Cargando reportes...</p>
        )}

        {!loading && reports.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <BarChart2 size={52} color="#cbd5e1" style={{ marginBottom: 16 }} />
            <p style={{ fontWeight: 700, fontSize: 17, color: '#334155', marginBottom: 6 }}>Sin reportes aún</p>
            <p style={{ color: '#94a3b8', fontSize: 14, marginBottom: 20 }}>Importa tu primer archivo Excel semanal</p>
            <button onClick={() => setShowImport(true)} style={{ ...btnPrimary, margin: '0 auto' }}>
              <Plus size={14} /> Importar reporte
            </button>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {reports.map(r => (
            <div
              key={r.id}
              onClick={() => navigate(`/reports/${r.id}`)}
              style={card}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, flex: 1, minWidth: 0 }}>
                <div style={iconBox}>
                  <BarChart2 size={20} color="#2563eb" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontWeight: 700, fontSize: 15, color: '#1e293b', marginBottom: 3 }}>{r.week_label}</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                    <span style={metaItem}>
                      <Calendar size={12} />
                      {formatDate(r.date_from)} → {formatDate(r.date_to)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Summary badges */}
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
                <StatBadge icon={<Zap size={11} />} value={r.summary.voltage_drops} label="caídas" color="#dc2626" />
                <StatBadge icon={<AlertTriangle size={11} />} value={r.summary.non_deployed} label="sin salir" color="#d97706" />
                <StatBadge icon={<Clock size={11} />} value={r.summary.late_departures} label="tardías" color="#2563eb" />
                <button
                  onClick={(e) => handleDelete(e, r.id, r.week_label)}
                  style={deleteBtn}
                  title="Eliminar reporte"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {showImport && (
        <ReportImportModal onImported={handleImported} onClose={() => setShowImport(false)} />
      )}
      {dialog}
    </div>
  );
}

function StatBadge({ icon, value, label, color }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: color + '12', border: `1px solid ${color}30`, borderRadius: 20, padding: '3px 10px' }}>
      <span style={{ color }}>{icon}</span>
      <span style={{ fontSize: 12, fontWeight: 700, color }}>{value}</span>
      <span style={{ fontSize: 11, color: '#64748b' }}>{label}</span>
    </div>
  );
}

const headerStyle = {
  background: 'linear-gradient(135deg, #1d4ed8 0%, #2563eb 100%)',
  padding: '12px 24px', display: 'flex', justifyContent: 'space-between',
  alignItems: 'center', boxShadow: '0 2px 12px rgba(37,99,235,0.4)',
  flexShrink: 0,
};
const backBtn = {
  background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 8,
  cursor: 'pointer', color: 'white', display: 'flex', padding: '6px 8px',
};
const btnWhite = {
  display: 'flex', alignItems: 'center', gap: 6,
  padding: '8px 16px', background: 'white', color: '#1d4ed8',
  border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer',
};
const btnPrimary = {
  display: 'flex', alignItems: 'center', gap: 6,
  padding: '9px 20px', background: '#2563eb', color: 'white',
  border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
};
const card = {
  background: 'white', border: '1px solid #e2e8f0', borderRadius: 12,
  padding: '16px 20px', cursor: 'pointer', display: 'flex',
  alignItems: 'center', gap: 16,
  boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
  transition: 'box-shadow 0.15s, border-color 0.15s',
};
const iconBox = {
  width: 42, height: 42, borderRadius: 10, background: '#eff6ff',
  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
};
const metaItem = {
  display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#64748b',
};
const deleteBtn = {
  background: 'none', border: '1px solid #fee2e2', borderRadius: 6,
  cursor: 'pointer', color: '#dc2626', padding: '5px 8px', display: 'flex',
};
