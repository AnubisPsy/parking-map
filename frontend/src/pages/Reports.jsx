import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchReports, deleteReport } from '../api';
import ReportImportModal from '../components/ReportImportModal';
import InfractionImportModal from '../components/InfractionImportModal';
import { useConfirm } from '../components/ConfirmModal';
import {
  BarChart2, Plus, Trash2, ArrowLeft, Calendar,
  Zap, Clock, AlertTriangle, AlertOctagon,
} from 'lucide-react';

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso + 'T12:00:00').toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function Reports() {
  const navigate = useNavigate();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('weekly');
  const [showImport, setShowImport] = useState(false);
  const { confirm, dialog } = useConfirm();

  useEffect(() => {
    fetchReports()
      .then(setReports)
      .finally(() => setLoading(false));
  }, []);

  const weekly = reports.filter(r => !r.type || r.type === 'weekly');
  const infractions = reports.filter(r => r.type === 'infractions');
  const visible = activeTab === 'weekly' ? weekly : infractions;

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
    setActiveTab(report.type === 'infractions' ? 'infractions' : 'weekly');
  }

  const isEmpty = !loading && visible.length === 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#eef2f7' }}>
      {/* Header */}
      <header style={headerStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <button onClick={() => navigate('/')} style={backBtn}><ArrowLeft size={18} /></button>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <BarChart2 size={18} color="white" />
          </div>
          <div>
            <p style={{ fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 2 }}>Módulo de Reportes</p>
            <h1 style={{ fontSize: 17, fontWeight: 700, color: 'white', letterSpacing: '-0.01em' }}>Reportes</h1>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginTop: 1 }}>
              {weekly.length} semanal{weekly.length !== 1 ? 'es' : ''} · {infractions.length} de infracciones
            </p>
          </div>
        </div>
        <button onClick={() => setShowImport(true)} style={btnWhite}>
          <Plus size={14} />
          {activeTab === 'weekly' ? 'Importar semanal' : 'Importar infracciones'}
        </button>
      </header>

      {/* Type tabs */}
      <div style={{ background: 'white', borderBottom: '1px solid #e8ecf0', display: 'flex', padding: '0 32px', gap: 0 }}>
        <button onClick={() => setActiveTab('weekly')} style={activeTab === 'weekly' ? tabActive : tabStyle}>
          <BarChart2 size={14} />
          Semanales
          <span style={tabBadge(activeTab === 'weekly')}>{weekly.length}</span>
        </button>
        <button onClick={() => setActiveTab('infractions')} style={activeTab === 'infractions' ? { ...tabActive, borderBottomColor: '#dc2626', color: activeTab === 'infractions' ? '#dc2626' : '#64748b' } : tabStyle}>
          <AlertOctagon size={14} />
          Infracciones
          <span style={tabBadge(activeTab === 'infractions', '#dc2626')}>{infractions.length}</span>
        </button>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '28px 32px', maxWidth: 960, width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>
        {loading && <p style={{ color: '#94a3b8', textAlign: 'center', padding: 40 }}>Cargando reportes...</p>}

        {isEmpty && (
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            {activeTab === 'weekly'
              ? <BarChart2 size={52} color="#cbd5e1" style={{ marginBottom: 16 }} />
              : <AlertOctagon size={52} color="#cbd5e1" style={{ marginBottom: 16 }} />}
            <p style={{ fontWeight: 700, fontSize: 17, color: '#334155', marginBottom: 6 }}>
              {activeTab === 'weekly' ? 'Sin reportes semanales' : 'Sin reportes de infracciones'}
            </p>
            <p style={{ color: '#94a3b8', fontSize: 14, marginBottom: 20 }}>
              {activeTab === 'weekly' ? 'Importa tu archivo Excel semanal' : 'Importa el archivo de infracciones del sistema GPS'}
            </p>
            <button onClick={() => setShowImport(true)} style={{ ...btnPrimary(activeTab), margin: '0 auto' }}>
              <Plus size={14} /> Importar
            </button>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {visible.map(r => (
            <ReportCard
              key={r.id}
              report={r}
              onClick={() => navigate(`/reports/${r.id}`)}
              onDelete={(e) => handleDelete(e, r.id, r.label || r.week_label)}
            />
          ))}
        </div>
      </div>

      {showImport && activeTab === 'weekly' && (
        <ReportImportModal onImported={handleImported} onClose={() => setShowImport(false)} />
      )}
      {showImport && activeTab === 'infractions' && (
        <InfractionImportModal onImported={handleImported} onClose={() => setShowImport(false)} />
      )}
      {dialog}
    </div>
  );
}

function ReportCard({ report: r, onClick, onDelete }) {
  const isInfraction = r.type === 'infractions';
  const accent = isInfraction ? '#dc2626' : '#2563eb';
  const label = r.label || r.week_label;

  return (
    <div onClick={onClick} style={card}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flex: 1, minWidth: 0 }}>
        <div style={{ ...iconBox, background: accent + '12' }}>
          {isInfraction
            ? <AlertOctagon size={20} color={accent} />
            : <BarChart2 size={20} color={accent} />}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: accent, textTransform: 'uppercase', letterSpacing: '0.08em', background: accent + '12', padding: '1px 7px', borderRadius: 20 }}>
              {isInfraction ? 'Infracciones' : 'Semanal'}
            </span>
          </div>
          <p style={{ fontWeight: 700, fontSize: 15, color: '#0f172a', marginBottom: 3 }}>{label}</p>
          <span style={metaItem}>
            <Calendar size={12} />
            {formatDate(r.date_from)} → {formatDate(r.date_to)}
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
        {isInfraction ? (
          <StatBadge icon={<AlertOctagon size={11} />} value={r.summary.infractions} label="infracciones" color="#dc2626" />
        ) : (
          <>
            <StatBadge icon={<Zap size={11} />} value={r.summary.voltage_drops} label="caídas" color="#dc2626" />
            <StatBadge icon={<AlertTriangle size={11} />} value={r.summary.non_deployed} label="sin salir" color="#d97706" />
            <StatBadge icon={<Clock size={11} />} value={r.summary.late_departures} label="tardías" color="#2563eb" />
          </>
        )}
        <button onClick={onDelete} style={deleteBtn} title="Eliminar reporte">
          <Trash2 size={14} />
        </button>
      </div>
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
  background: '#0f172a', padding: '16px 24px', display: 'flex', justifyContent: 'space-between',
  alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0,
};
const backBtn = { background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, cursor: 'pointer', color: 'white', display: 'flex', padding: '7px 9px' };
const btnWhite = { display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: 'white', color: '#0f172a', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' };
const btnPrimary = (tab) => ({ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 20px', background: tab === 'infractions' ? '#dc2626' : '#2563eb', color: 'white', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' });
const tabStyle = { display: 'flex', alignItems: 'center', gap: 6, padding: '14px 20px', background: 'none', border: 'none', borderBottom: '3px solid transparent', cursor: 'pointer', fontSize: 13, color: '#64748b', fontFamily: 'inherit', fontWeight: 500, whiteSpace: 'nowrap' };
const tabActive = { ...tabStyle, color: '#0f172a', borderBottomColor: '#2563eb', fontWeight: 700 };
const tabBadge = (active, color = '#2563eb') => ({ background: active ? color + '18' : '#f1f5f9', color: active ? color : '#94a3b8', borderRadius: 20, padding: '1px 7px', fontSize: 11, fontWeight: 700 });
const card = { background: 'white', border: '1px solid rgba(15,23,42,0.06)', borderRadius: 14, padding: '16px 20px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 16, boxShadow: '0 1px 3px rgba(15,23,42,0.06), 0 4px 12px rgba(15,23,42,0.04)' };
const iconBox = { width: 42, height: 42, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 };
const metaItem = { display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#64748b' };
const deleteBtn = { background: 'none', border: '1px solid #fee2e2', borderRadius: 6, cursor: 'pointer', color: '#dc2626', padding: '5px 8px', display: 'flex' };
