import { useEffect, useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { fetchShareData } from '../api';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell, Legend,
} from 'recharts';
import { BarChart2, Zap, AlertTriangle, Clock, Loader2, Search, Timer } from 'lucide-react';
import ReportDayMap from '../components/ReportDayMap';

const DAY_ORDER = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const BRANCH_COLORS = {
  CARACAS: '#2563eb', DIXON: '#16a34a', MUELLE: '#d97706',
  TOCOA: '#7c3aed', SATUYE: '#0891b2', GIBSON: '#be185d', CENTRO: '#dc2626',
};
const branchColor = (b) => BRANCH_COLORS[b] || '#64748b';

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso + 'T12:00:00').toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatExpiry(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function SharedReport() {
  const { token } = useParams();
  const [report, setReport] = useState(null);
  const [expiresAt, setExpiresAt] = useState(null);
  const [status, setStatus] = useState('loading');
  const [activeTab, setActiveTab] = useState('resumen');

  useEffect(() => {
    fetchShareData(token)
      .then(data => {
        if (data.type !== 'report') { setStatus('notfound'); return; }
        setReport(data.report);
        setExpiresAt(data.expires_at);
        setStatus('ok');
      })
      .catch(err => {
        if (err.message.includes('expirado')) setStatus('expired');
        else setStatus('notfound');
      });
  }, [token]);

  const voltageByDay = useMemo(() => {
    if (!report) return [];
    const map = {};
    DAY_ORDER.forEach(d => { map[d] = 0; });
    report.voltage_drops.forEach(v => { if (map[v.day] !== undefined) map[v.day]++; });
    return DAY_ORDER.filter(d => map[d] > 0).map(d => ({ day: d.slice(0, 3), count: map[d] }));
  }, [report]);

  const voltageByBranch = useMemo(() => {
    if (!report) return [];
    const map = {};
    report.voltage_drops.forEach(v => { map[v.branch] = (map[v.branch] || 0) + 1; });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).map(([branch, count]) => ({ branch, count }));
  }, [report]);

  const nonDeployedByBranch = useMemo(() => {
    if (!report) return [];
    const map = {};
    report.non_deployed.forEach(v => { map[v.branch] = (map[v.branch] || 0) + 1; });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).map(([branch, count]) => ({ branch, count }));
  }, [report]);

  const nonDeployedByDay = useMemo(() => {
    if (!report) return [];
    const map = {};
    DAY_ORDER.forEach(d => { map[d] = 0; });
    report.non_deployed.forEach(v => { if (map[v.day] !== undefined) map[v.day]++; });
    return DAY_ORDER.map(d => ({ day: d.slice(0, 3), count: map[d] }));
  }, [report]);

  const ralentysByDay = useMemo(() => {
    if (!report) return [];
    const map = {};
    DAY_ORDER.forEach(d => { map[d] = 0; });
    (report.observations || []).forEach(o => { if (map[o.day] !== undefined) map[o.day]++; });
    return DAY_ORDER.map(d => ({ day: d.slice(0, 3), count: map[d] }));
  }, [report]);

  const ralentysByBranch = useMemo(() => {
    if (!report) return [];
    const map = {};
    (report.observations || []).forEach(o => { map[o.branch] = (map[o.branch] || 0) + 1; });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value }));
  }, [report]);

  const availableDays = useMemo(() => {
    if (!report) return [];
    const withData = new Set([
      ...report.voltage_drops.map(v => v.day),
      ...report.non_deployed.map(v => v.day),
      ...report.late_departures.map(v => v.day),
    ]);
    return DAY_ORDER.filter(d => withData.has(d));
  }, [report]);

  if (status === 'loading') return <Splash icon={<Loader2 size={48} color="#2563eb" style={{ animation: 'spin 1s linear infinite' }} />} title="Cargando reporte..." />;
  if (status === 'expired') return <Splash icon={<Timer size={48} color="#94a3b8" />} title="Enlace expirado" desc="Este enlace ya no es válido." />;
  if (status === 'notfound') return <Splash icon={<Search size={48} color="#94a3b8" />} title="Enlace no encontrado" desc="El enlace no existe o fue eliminado." />;

  const tabs = [
    { id: 'resumen', label: 'Resumen' },
    ...availableDays.map(d => ({ id: d, label: d })),
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#eef2f7' }}>
      <header style={headerStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <BarChart2 size={20} color="white" />
          </div>
          <div>
            <p style={{ fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 2 }}>Reporte Semanal</p>
            <h1 style={{ fontSize: 17, fontWeight: 700, color: 'white', letterSpacing: '-0.01em' }}>{report.week_label}</h1>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginTop: 1 }}>{formatDate(report.date_from)} — {formatDate(report.date_to)}</p>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 3 }}>Válido hasta</p>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', fontWeight: 500 }}>{formatExpiry(expiresAt)}</p>
        </div>
      </header>

      <div style={{ background: 'white', borderBottom: '1px solid #e8ecf0', display: 'flex', padding: '0 32px', gap: 0, overflowX: 'auto', boxShadow: '0 1px 0 #e8ecf0' }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)} style={activeTab === t.id ? tabActive : tabStyle}>
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '28px 40px' }}>
        {activeTab === 'resumen' && (
          <div style={{ maxWidth: 860, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
              <SummaryCard icon={<Zap size={20} />} label="Caídas de voltaje" value={report.voltage_drops.length} color="#dc2626" />
              <SummaryCard icon={<AlertTriangle size={20} />} label="Sin salida de yarda" value={report.non_deployed.length} color="#d97706" />
              <SummaryCard icon={<Clock size={20} />} label="Salidas tardías" value={report.late_departures.length} color="#2563eb" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <ChartCard title="Sin salida · por día">
                <BarChart data={nonDeployedByDay}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="count" name="Unidades" radius={[4, 4, 0, 0]} fill="#d97706" />
                </BarChart>
              </ChartCard>
              <ChartCard title="Sin salida · por sucursal">
                <BarChart data={nonDeployedByBranch} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                  <YAxis dataKey="branch" type="category" tick={{ fontSize: 11 }} width={72} />
                  <Tooltip />
                  <Bar dataKey="count" name="Unidades" radius={[0, 4, 4, 0]}>
                    {nonDeployedByBranch.map((e, i) => <Cell key={i} fill={branchColor(e.branch)} />)}
                  </Bar>
                </BarChart>
              </ChartCard>
              <ChartCard title="Caídas de voltaje · por día">
                <BarChart data={voltageByDay}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="count" name="Eventos" radius={[4, 4, 0, 0]} fill="#dc2626" />
                </BarChart>
              </ChartCard>
              <ChartCard title="Caídas de voltaje · por sucursal">
                <BarChart data={voltageByBranch} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                  <YAxis dataKey="branch" type="category" tick={{ fontSize: 11 }} width={72} />
                  <Tooltip />
                  <Bar dataKey="count" name="Eventos" radius={[0, 4, 4, 0]}>
                    {voltageByBranch.map((e, i) => <Cell key={i} fill={branchColor(e.branch)} />)}
                  </Bar>
                </BarChart>
              </ChartCard>
            </div>

            {/* Ralentís row */}
            {(ralentysByDay.some(d => d.count > 0) || ralentysByBranch.length > 0) && (
              <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 16 }}>
                {ralentysByDay.some(d => d.count > 0) && (
                  <ChartCard title="Ralentís · evolución por día">
                    <LineChart data={ralentysByDay}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                      <Tooltip />
                      <Line type="monotone" dataKey="count" stroke="#7c3aed" strokeWidth={2.5} dot={{ fill: '#7c3aed', r: 4 }} activeDot={{ r: 6 }} name="Ralentís" />
                    </LineChart>
                  </ChartCard>
                )}
                {ralentysByBranch.length > 0 && (
                  <ChartCard title="Ralentís · por sucursal" height={200}>
                    <PieChart>
                      <Pie data={ralentysByBranch} dataKey="value" nameKey="name" cx="50%" cy="45%" outerRadius={65} label={renderPieLabel} labelLine={false}>
                        {ralentysByBranch.map((e, i) => <Cell key={i} fill={BRANCH_COLORS[e.name] || '#64748b'} />)}
                      </Pie>
                      <Tooltip formatter={(v, n) => [v + ' ralentís', n]} />
                      <Legend iconSize={10} wrapperStyle={{ fontSize: 10 }} />
                    </PieChart>
                  </ChartCard>
                )}
              </div>
            )}
          </div>
        )}

        {availableDays.includes(activeTab) && (
          <DayContent
            voltageDrops={report.voltage_drops.filter(v => v.day === activeTab)}
            nonDeployed={report.non_deployed.filter(v => v.day === activeTab)}
            lateDeparts={report.late_departures.filter(v => v.day === activeTab)}
            observations={(report.observations || []).filter(v => v.day === activeTab)}
          />
        )}
      </div>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function DayContent({ voltageDrops, nonDeployed, lateDeparts, observations }) {
  const obsByBranch = useMemo(() => {
    const map = {};
    observations.forEach(o => { map[o.branch] = (map[o.branch] || 0) + 1; });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).map(([branch, count]) => ({ branch, count }));
  }, [observations]);

  const voltByBranch = useMemo(() => {
    const map = {};
    voltageDrops.forEach(v => { map[v.branch] = (map[v.branch] || 0) + 1; });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).map(([branch, count]) => ({ branch, count }));
  }, [voltageDrops]);

  const showCharts = obsByBranch.length > 0 || voltByBranch.length > 0;

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Mini stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        <MiniStat label="Ralentís (+30 min)" count={observations.length} color="#7c3aed" />
        <MiniStat label="Caídas de voltaje" count={voltageDrops.length} color="#dc2626" />
        <MiniStat label="Sin salida de yarda" count={nonDeployed.length} color="#d97706" />
        <MiniStat label="Salidas tardías" count={lateDeparts.length} color="#2563eb" />
      </div>

      {/* Day charts */}
      {showCharts && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          {obsByBranch.length > 0 && (
            <div style={{ background: 'white', borderRadius: 16, padding: '18px 20px', boxShadow: '0 1px 3px rgba(15,23,42,0.06), 0 4px 16px rgba(15,23,42,0.04)', border: '1px solid rgba(15,23,42,0.05)' }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', marginBottom: 14, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Ralentís por sucursal</p>
              <ResponsiveContainer width="100%" height={170}>
                <PieChart>
                  <Pie data={obsByBranch.map(e => ({ name: e.branch, value: e.count }))} dataKey="value" nameKey="name" cx="50%" cy="45%" outerRadius={60} label={renderPieLabel} labelLine={false}>
                    {obsByBranch.map((e, i) => <Cell key={i} fill={BRANCH_COLORS[e.branch] || '#64748b'} />)}
                  </Pie>
                  <Tooltip formatter={(v, n) => [v + ' ralentís', n]} />
                  <Legend iconSize={10} wrapperStyle={{ fontSize: 10 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
          {voltByBranch.length > 0 && (
            <div style={{ background: 'white', borderRadius: 16, padding: '18px 20px', boxShadow: '0 1px 3px rgba(15,23,42,0.06), 0 4px 16px rgba(15,23,42,0.04)', border: '1px solid rgba(15,23,42,0.05)' }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', marginBottom: 14, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Caídas de voltaje por sucursal</p>
              <ResponsiveContainer width="100%" height={140}>
                <BarChart data={voltByBranch} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
                  <YAxis dataKey="branch" type="category" tick={{ fontSize: 10 }} width={68} />
                  <Tooltip />
                  <Bar dataKey="count" name="Caídas" radius={[0, 4, 4, 0]}>
                    {voltByBranch.map((e, i) => <Cell key={i} fill="#dc2626" />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* Map — only renders if observations have coordinates */}
      <ReportDayMap observations={observations} />

      {/* Full-width tables */}
      <DaySection title="Ralentís (+30 min)" count={observations.length} color="#7c3aed" emptyMsg="Sin ralentís este día">
        <DataTable data={observations} columns={[
          { key: 'vehicle_num', label: 'Unidad', width: 90 },
          { key: 'plate', label: 'Placa', width: 110 },
          { key: 'branch', label: 'Sucursal', width: 110, render: v => <BranchBadge branch={v} /> },
          { key: 'time', label: 'Hora', width: 80 },
          { key: 'duration', label: 'Tiempo', width: 80 },
          { key: 'observation', label: 'Observación', flex: 1 },
        ]} emptyMsg="Sin ralentís este día" />
      </DaySection>

      <DaySection title="Caídas de voltaje" count={voltageDrops.length} color="#dc2626" emptyMsg="Sin caídas de voltaje este día">
        <DataTable data={voltageDrops} columns={[
          { key: 'vehicle_num', label: 'Unidad', width: 90 },
          { key: 'plate', label: 'Placa', width: 110 },
          { key: 'branch', label: 'Sucursal', width: 110, render: v => <BranchBadge branch={v} /> },
          { key: 'time', label: 'Hora', width: 80 },
          { key: 'location', label: 'Ubicación', flex: 1 },
        ]} emptyMsg="Sin caídas de voltaje este día" />
      </DaySection>

      {/* Narrow tables side by side */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, alignItems: 'start' }}>
        <DaySection title="Sin salida de yarda" count={nonDeployed.length} color="#d97706" emptyMsg="Todas las unidades salieron a tiempo">
          <DataTable data={nonDeployed} columns={[
            { key: 'vehicle_num', label: 'Unidad', width: 90 },
            { key: 'plate', label: 'Placa', width: 110 },
            { key: 'branch', label: 'Sucursal', flex: 1, render: v => <BranchBadge branch={v} /> },
          ]} emptyMsg="Todas las unidades salieron a tiempo" />
        </DaySection>

        <DaySection title="Salidas tardías (después de 11am)" count={lateDeparts.length} color="#2563eb" emptyMsg="Sin salidas tardías este día">
          <DataTable data={lateDeparts} columns={[
            { key: 'vehicle_num', label: 'Unidad', width: 90 },
            { key: 'plate', label: 'Placa', width: 110 },
            { key: 'branch', label: 'Sucursal', flex: 1, render: v => <BranchBadge branch={v} /> },
          ]} emptyMsg="Sin salidas tardías este día" />
        </DaySection>
      </div>
    </div>
  );
}

function MiniStat({ label, count, color }) {
  return (
    <div style={{ background: 'white', borderRadius: 14, padding: '18px 22px', boxShadow: '0 1px 3px rgba(15,23,42,0.06), 0 4px 16px rgba(15,23,42,0.04)', border: '1px solid rgba(15,23,42,0.05)' }}>
      <p style={{ fontSize: 32, fontWeight: 800, color, lineHeight: 1, letterSpacing: '-0.03em' }}>{count}</p>
      <p style={{ fontSize: 10, fontWeight: 600, color: '#94a3b8', marginTop: 7, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</p>
    </div>
  );
}

function DaySection({ title, count, color, children, emptyMsg }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{title}</p>
        <span style={{ background: count > 0 ? color : '#e2e8f0', color: count > 0 ? 'white' : '#94a3b8', borderRadius: 20, padding: '1px 9px', fontSize: 11, fontWeight: 700 }}>
          {count}
        </span>
      </div>
      {count === 0
        ? <p style={{ fontSize: 13, color: '#94a3b8', padding: '14px 18px', background: 'white', borderRadius: 10, boxShadow: '0 1px 3px rgba(15,23,42,0.04)', border: '1px solid rgba(15,23,42,0.05)' }}>{emptyMsg}</p>
        : children}
    </div>
  );
}

function Splash({ icon, title, desc }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: 14, background: '#eef2f7' }}>
      {icon}
      <h2 style={{ fontSize: 22, fontWeight: 700, color: '#0f172a' }}>{title}</h2>
      {desc && <p style={{ color: '#64748b', fontSize: 14 }}>{desc}</p>}
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function SummaryCard({ icon, label, value, color }) {
  return (
    <div style={{ background: 'white', borderRadius: 16, padding: '22px 24px', display: 'flex', gap: 16, alignItems: 'center', boxShadow: '0 1px 3px rgba(15,23,42,0.06), 0 6px 20px rgba(15,23,42,0.04)', border: '1px solid rgba(15,23,42,0.05)' }}>
      <div style={{ width: 48, height: 48, borderRadius: 12, background: color + '12', display: 'flex', alignItems: 'center', justifyContent: 'center', color, flexShrink: 0 }}>{icon}</div>
      <div>
        <p style={{ fontSize: 36, fontWeight: 800, color, lineHeight: 1, letterSpacing: '-0.03em' }}>{value}</p>
        <p style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', marginTop: 5, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{label}</p>
      </div>
    </div>
  );
}

function ChartCard({ title, children, height = 180 }) {
  return (
    <div style={{ background: 'white', borderRadius: 16, padding: '20px 22px', boxShadow: '0 1px 3px rgba(15,23,42,0.06), 0 4px 16px rgba(15,23,42,0.04)', border: '1px solid rgba(15,23,42,0.05)' }}>
      <p style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{title}</p>
      <ResponsiveContainer width="100%" height={height}>{children}</ResponsiveContainer>
    </div>
  );
}

function renderPieLabel({ cx, cy, midAngle, innerRadius, outerRadius, percent }) {
  if (percent < 0.06) return null;
  const RADIAN = Math.PI / 180;
  const r = innerRadius + (outerRadius - innerRadius) * 0.55;
  return (
    <text x={cx + r * Math.cos(-midAngle * RADIAN)} y={cy + r * Math.sin(-midAngle * RADIAN)}
      fill="white" textAnchor="middle" dominantBaseline="central" fontSize={10} fontWeight={700}>
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
}

function BranchBadge({ branch }) {
  if (!branch) return <span style={{ color: '#cbd5e1', fontSize: 12 }}>—</span>;
  const color = BRANCH_COLORS[branch] || '#64748b';
  return (
    <span style={{ background: color + '14', color, borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 600, letterSpacing: '0.02em' }}>
      {branch}
    </span>
  );
}

function DataTable({ data, columns, emptyMsg }) {
  if (data.length === 0) return <p style={{ color: '#94a3b8', textAlign: 'center', padding: 40, fontSize: 13 }}>{emptyMsg}</p>;
  return (
    <div style={{ background: 'white', borderRadius: 14, overflow: 'hidden', boxShadow: '0 1px 3px rgba(15,23,42,0.06), 0 4px 16px rgba(15,23,42,0.04)', border: '1px solid rgba(15,23,42,0.05)' }}>
      <div style={{ display: 'flex', background: '#f8fafc', borderBottom: '1px solid #f1f5f9', padding: '11px 20px' }}>
        {columns.map(col => (
          <div key={col.key} style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.09em', width: col.width, flex: col.flex, minWidth: col.width }}>{col.label}</div>
        ))}
      </div>
      <div style={{ maxHeight: 'calc(100vh - 260px)', overflowY: 'auto' }}>
        {data.map((row, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', padding: '11px 20px', borderBottom: i < data.length - 1 ? '1px solid #f8fafc' : 'none', background: i % 2 === 0 ? 'white' : '#fafbfc' }}>
            {columns.map(col => (
              <div key={col.key} style={{ fontSize: 12, color: '#334155', width: col.width, flex: col.flex, minWidth: col.width, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: col.flex ? 'nowrap' : 'normal' }}>
                {col.render ? col.render(row[col.key]) : (row[col.key] || '—')}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

const headerStyle = {
  background: '#0f172a',
  padding: '16px 32px',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  borderBottom: '1px solid rgba(255,255,255,0.06)',
  flexShrink: 0,
};
const tabStyle = {
  padding: '14px 20px', background: 'none', border: 'none',
  borderBottom: '3px solid transparent', cursor: 'pointer',
  fontSize: 13, color: '#64748b', fontFamily: 'inherit',
  fontWeight: 500, whiteSpace: 'nowrap', letterSpacing: '0.01em',
};
const tabActive = {
  ...tabStyle, color: '#0f172a', borderBottomColor: '#2563eb', fontWeight: 700,
};
