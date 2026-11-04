import { lazy, Suspense, useMemo, useState } from 'react';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie,
  XAxis, YAxis, Tooltip, CartesianGrid, Cell, Legend,
} from 'recharts';
import { AlertTriangle, BarChart2, Clock, Zap } from 'lucide-react';
import { branchColor } from '../../lib/colors';
import { formatDay } from '../../lib/format';
import { countBy, countByDay, DAY_ORDER } from '../../lib/reportStats';
import { useInView } from '../../hooks/useInView';
import DataTable from '../ui/DataTable';
import { Skeleton } from '../ui/Skeleton';
import { BranchBadge, card, ChartCard, renderPieLabel, ReportHeader, ReportTabs } from './parts';

const ReportDayMap = lazy(() => import('../ReportDayMap'));

const gridOf = (minWidth) => ({ gridTemplateColumns: `repeat(auto-fit, minmax(min(100%, ${minWidth}px), 1fr))` });

const COLUMN = {
  unit: { key: 'vehicle_num', label: 'Unidad', width: 90 },
  plate: { key: 'plate', label: 'Placa', width: 110 },
  branch: { key: 'branch', label: 'Sucursal', width: 110, render: (v) => <BranchBadge branch={v} /> },
  branchWide: { key: 'branch', label: 'Sucursal', flex: 1, render: (v) => <BranchBadge branch={v} /> },
  time: { key: 'time', label: 'Hora', width: 80 },
};

// Cuerpo del reporte semanal, común a la vista privada y al enlace compartido.
// `backTo` y `actions` son lo único que cambia entre ambas.
export default function WeeklyReportView({ report, backTo, actions }) {
  const [activeTab, setActiveTab] = useState('resumen');

  const stats = useMemo(() => ({
    voltageByDay: countByDay(report.voltage_drops).filter((d) => d.count > 0),
    voltageByBranch: countBy(report.voltage_drops, 'branch'),
    nonDeployedByDay: countByDay(report.non_deployed),
    nonDeployedByBranch: countBy(report.non_deployed, 'branch'),
    ralentysByDay: countByDay(report.observations),
    ralentysByBranch: countBy(report.observations, 'branch', 'name').map((r) => ({ name: r.name, value: r.count })),
  }), [report]);

  const availableDays = useMemo(() => {
    const withData = new Set(
      [...report.voltage_drops, ...report.non_deployed, ...report.late_departures].map((row) => row.day),
    );
    return DAY_ORDER.filter((d) => withData.has(d));
  }, [report]);

  const tabs = [{ id: 'resumen', label: 'Resumen' }, ...availableDays.map((d) => ({ id: d, label: d }))];

  return (
    <div className="page page-report">
      <ReportHeader
        Icon={BarChart2}
        eyebrow="Reporte Semanal"
        title={report.week_label || report.label}
        subtitle={`${formatDay(report.date_from)} — ${formatDay(report.date_to)}`}
        backTo={backTo}
      >
        {actions}
      </ReportHeader>

      <ReportTabs tabs={tabs} active={activeTab} onChange={setActiveTab} />

      <main className="scroll-body" tabIndex={0}>
        {activeTab === 'resumen' ? (
          <Summary report={report} stats={stats} />
        ) : (
          <DayContent key={activeTab} report={report} day={activeTab} />
        )}
      </main>
    </div>
  );
}

function Summary({ report, stats }) {
  const hasRalentysByDay = stats.ralentysByDay.some((d) => d.count > 0);
  return (
    <div style={{ maxWidth: 860, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div className="grid-auto" style={gridOf(220)}>
        <SummaryCard icon={<Zap size={20} />} label="Caídas de voltaje" value={report.voltage_drops.length} color="#b91c1c" />
        <SummaryCard icon={<AlertTriangle size={20} />} label="Sin salida de yarda" value={report.non_deployed.length} color="#b45309" />
        <SummaryCard icon={<Clock size={20} />} label="Salidas tardías" value={report.late_departures.length} color="#2563eb" />
      </div>

      <div className="grid-auto" style={{ ...gridOf(340), gap: 16 }}>
        <ChartCard title="Sin salida · por día">
          <BarChart data={stats.nonDeployedByDay}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="day" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
            <Tooltip />
            <Bar dataKey="count" name="Unidades" radius={[4, 4, 0, 0]} fill="#b45309" />
          </BarChart>
        </ChartCard>
        <ChartCard title="Sin salida · por sucursal">
          <BranchBars data={stats.nonDeployedByBranch} name="Unidades" />
        </ChartCard>
        <ChartCard title="Caídas de voltaje · por día">
          <BarChart data={stats.voltageByDay}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="day" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
            <Tooltip />
            <Bar dataKey="count" name="Eventos" radius={[4, 4, 0, 0]} fill="#b91c1c" />
          </BarChart>
        </ChartCard>
        <ChartCard title="Caídas de voltaje · por sucursal">
          <BranchBars data={stats.voltageByBranch} name="Eventos" />
        </ChartCard>
      </div>

      {(hasRalentysByDay || stats.ralentysByBranch.length > 0) && (
        <div className="grid-3-2">
          {hasRalentysByDay && (
            <ChartCard title="Ralentís · evolución por día">
              <LineChart data={stats.ralentysByDay}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Line type="monotone" dataKey="count" stroke="#7c3aed" strokeWidth={2.5} dot={{ fill: '#7c3aed', r: 4 }} activeDot={{ r: 6 }} name="Ralentís" />
              </LineChart>
            </ChartCard>
          )}
          {stats.ralentysByBranch.length > 0 && (
            <ChartCard title="Ralentís · por sucursal" height={200}>
              <BranchPie data={stats.ralentysByBranch} outerRadius={65} />
            </ChartCard>
          )}
        </div>
      )}
    </div>
  );
}

// ResponsiveContainer entrega el tamaño por props a su hijo directo; hay que reenviarlo al gráfico
function BranchBars({ data, name, width, height, fill, tickSize = 11, axisWidth = 72 }) {
  return (
    <BarChart width={width} height={height} data={data} layout="vertical">
      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
      <XAxis type="number" tick={{ fontSize: tickSize }} allowDecimals={false} />
      <YAxis dataKey="branch" type="category" tick={{ fontSize: tickSize }} width={axisWidth} interval={0} />
      <Tooltip />
      <Bar dataKey="count" name={name} radius={[0, 4, 4, 0]}>
        {data.map((e, i) => <Cell key={i} fill={fill || branchColor(e.branch)} />)}
      </Bar>
    </BarChart>
  );
}

function BranchPie({ data, outerRadius, width, height }) {
  return (
    <PieChart width={width} height={height}>
      <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="45%" outerRadius={outerRadius} label={renderPieLabel} labelLine={false}>
        {data.map((e, i) => <Cell key={i} fill={branchColor(e.name)} />)}
      </Pie>
      <Tooltip formatter={(v, n) => [`${v} ralentís`, n]} />
      <Legend iconSize={10} wrapperStyle={{ fontSize: 10 }} />
    </PieChart>
  );
}

function DayContent({ report, day }) {
  const { observations, voltageDrops, nonDeployed, lateDeparts, obsByBranch, voltByBranch, hasCoords } = useMemo(() => {
    const onDay = (row) => row.day === day;
    const obs = report.observations.filter(onDay);
    const voltage = report.voltage_drops.filter(onDay);
    return {
      observations: obs,
      voltageDrops: voltage,
      nonDeployed: report.non_deployed.filter(onDay),
      lateDeparts: report.late_departures.filter(onDay),
      obsByBranch: countBy(obs, 'branch', 'name').map((r) => ({ name: r.name, value: r.count })),
      voltByBranch: countBy(voltage, 'branch'),
      hasCoords: obs.some((o) => o.latitude != null && o.longitude != null),
    };
  }, [report, day]);

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="grid-auto" style={{ ...gridOf(160), gap: 12 }}>
        <MiniStat label="Ralentís (+30 min)" count={observations.length} color="#7c3aed" />
        <MiniStat label="Caídas de voltaje" count={voltageDrops.length} color="#b91c1c" />
        <MiniStat label="Sin salida de yarda" count={nonDeployed.length} color="#b45309" />
        <MiniStat label="Salidas tardías" count={lateDeparts.length} color="#2563eb" />
      </div>

      {(obsByBranch.length > 0 || voltByBranch.length > 0) && (
        <div className="grid-auto" style={gridOf(340)}>
          {obsByBranch.length > 0 && (
            <ChartCard title="Ralentís por sucursal" height={170} compact>
              <BranchPie data={obsByBranch} outerRadius={60} />
            </ChartCard>
          )}
          {voltByBranch.length > 0 && (
            <ChartCard title="Caídas de voltaje por sucursal" height={140} compact>
              <BranchBars data={voltByBranch} name="Caídas" fill="#b91c1c" tickSize={10} axisWidth={68} />
            </ChartCard>
          )}
        </div>
      )}

      {hasCoords && <DeferredDayMap observations={observations} />}

      <DaySection title="Ralentís (+30 min)" count={observations.length} color="#7c3aed" emptyMsg="Sin ralentís este día">
        <DataTable
          label="Ralentís"
          data={observations}
          columns={[
            COLUMN.unit, COLUMN.plate, COLUMN.branch, COLUMN.time,
            { key: 'duration', label: 'Tiempo', width: 80 },
            { key: 'observation', label: 'Observación', flex: 1 },
          ]}
        />
      </DaySection>

      <DaySection title="Caídas de voltaje" count={voltageDrops.length} color="#b91c1c" emptyMsg="Sin caídas de voltaje este día">
        <DataTable
          label="Caídas de voltaje"
          data={voltageDrops}
          columns={[COLUMN.unit, COLUMN.plate, COLUMN.branch, COLUMN.time, { key: 'location', label: 'Ubicación', flex: 1 }]}
        />
      </DaySection>

      <div className="grid-auto" style={{ ...gridOf(400), alignItems: 'start' }}>
        <DaySection title="Sin salida de yarda" count={nonDeployed.length} color="#b45309" emptyMsg="Todas las unidades salieron a tiempo">
          <DataTable label="Sin salida de yarda" data={nonDeployed} columns={[COLUMN.unit, COLUMN.plate, COLUMN.branchWide]} />
        </DaySection>
        <DaySection title="Salidas tardías (después de 11am)" count={lateDeparts.length} color="#2563eb" emptyMsg="Sin salidas tardías este día">
          <DataTable label="Salidas tardías" data={lateDeparts} columns={[COLUMN.unit, COLUMN.plate, COLUMN.branchWide]} />
        </DaySection>
      </div>
    </div>
  );
}

const MAP_HEIGHT = 360;

// Leaflet y el mapa se descargan solo cuando esta sección se acerca a la pantalla
function DeferredDayMap({ observations }) {
  const [ref, inView] = useInView();
  const fallback = <Skeleton height={MAP_HEIGHT} radius={12} />;
  return (
    <div ref={ref} style={{ height: MAP_HEIGHT }}>
      {inView ? (
        <Suspense fallback={fallback}>
          <ReportDayMap observations={observations} />
        </Suspense>
      ) : fallback}
    </div>
  );
}

function SummaryCard({ icon, label, value, color }) {
  return (
    <div style={{ ...card, borderRadius: 16, padding: '22px 24px', display: 'flex', gap: 16, alignItems: 'center' }}>
      <div style={{ width: 48, height: 48, borderRadius: 12, background: `${color}12`, display: 'flex', alignItems: 'center', justifyContent: 'center', color, flexShrink: 0 }}>
        {icon}
      </div>
      <div>
        <p style={{ fontSize: 36, fontWeight: 800, color, lineHeight: 1, letterSpacing: '-0.03em' }}>{value}</p>
        <p style={{ fontSize: 11, fontWeight: 600, color: '#475569', marginTop: 5, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{label}</p>
      </div>
    </div>
  );
}

function MiniStat({ label, count, color }) {
  return (
    <div style={{ ...card, borderRadius: 14, padding: '18px 22px' }}>
      <p style={{ fontSize: 32, fontWeight: 800, color, lineHeight: 1, letterSpacing: '-0.03em' }}>{count}</p>
      <p style={{ fontSize: 10, fontWeight: 600, color: '#475569', marginTop: 7, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</p>
    </div>
  );
}

function DaySection({ title, count, color, children, emptyMsg }) {
  return (
    <section style={{ minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <h2 style={{ fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{title}</h2>
        <span style={{ background: count > 0 ? color : '#e2e8f0', color: count > 0 ? 'white' : '#334155', borderRadius: 20, padding: '1px 9px', fontSize: 11, fontWeight: 700 }}>
          {count}
        </span>
      </div>
      {count === 0
        ? <p style={{ ...card, fontSize: 13, color: '#475569', padding: '14px 18px', borderRadius: 10 }}>{emptyMsg}</p>
        : children}
    </section>
  );
}
