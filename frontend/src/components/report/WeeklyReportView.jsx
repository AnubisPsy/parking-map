import { lazy, Suspense, useMemo, useState } from 'react';
import { AlertTriangle, Clock, Timer, Zap } from 'lucide-react';
import { formatDay } from '../../lib/format';
import { countBy, countByDay, DAY_ORDER } from '../../lib/reportStats';
import { useInView } from '../../hooks/useInView';
import DataTable from '../ui/DataTable';
import { Skeleton } from '../ui/Skeleton';
import { ColumnChart, TrendChart } from './charts';
import { BranchBadge, ChartCard, RankCard, ReportHeader, ReportTabs, StatTile } from './parts';

const ReportDayMap = lazy(() => import('../ReportDayMap'));

const gridOf = (minWidth) => ({ gridTemplateColumns: `repeat(auto-fit, minmax(min(100%, ${minWidth}px), 1fr))` });

const COLUMN = {
  unit: { key: 'vehicle_num', label: 'Unidad', width: 90 },
  plate: { key: 'plate', label: 'Placa', width: 110 },
  branch: { key: 'branch', label: 'Sucursal', width: 120, render: (v) => <BranchBadge branch={v} /> },
  branchWide: { key: 'branch', label: 'Sucursal', flex: 1, render: (v) => <BranchBadge branch={v} /> },
  time: { key: 'time', label: 'Hora', width: 80 },
};

// Cuerpo del reporte semanal, común a la vista privada y al enlace compartido.
export default function WeeklyReportView({ report, backTo, expiresAt, actions }) {
  const [activeTab, setActiveTab] = useState('resumen');

  const stats = useMemo(() => ({
    voltageByDay: countByDay(report.voltage_drops).filter((d) => d.count > 0),
    voltageByBranch: countBy(report.voltage_drops, 'branch', 'name'),
    nonDeployedByDay: countByDay(report.non_deployed),
    nonDeployedByBranch: countBy(report.non_deployed, 'branch', 'name'),
    ralentysByDay: countByDay(report.observations),
    ralentysByBranch: countBy(report.observations, 'branch', 'name'),
  }), [report]);

  const availableDays = useMemo(() => {
    const withData = new Set(
      [...report.voltage_drops, ...report.non_deployed, ...report.late_departures].map((row) => row.day),
    );
    return DAY_ORDER.filter((d) => withData.has(d));
  }, [report]);

  const tabs = [{ id: 'resumen', label: 'Resumen' }, ...availableDays.map((d) => ({ id: d, label: d }))];

  return (
    <div className="page">
      <ReportHeader
        title={report.week_label || report.label}
        subtitle={`Reporte semanal · ${formatDay(report.date_from)} — ${formatDay(report.date_to)}`}
        backTo={backTo}
        expiresAt={expiresAt}
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
  const hasRalentys = stats.ralentysByDay.some((d) => d.count > 0);
  return (
    <div className="content">
      <div className="grid-auto" style={gridOf(150)}>
        <StatTile icon={Zap} label="Caídas de voltaje" value={report.voltage_drops.length} />
        <StatTile icon={AlertTriangle} label="Sin salida de yarda" value={report.non_deployed.length} />
        <StatTile icon={Clock} label="Salidas tardías" value={report.late_departures.length} />
        {hasRalentys && <StatTile icon={Timer} label="Ralentís" value={report.observations.length} />}
      </div>

      <div className="grid-auto" style={gridOf(340)}>
        <ChartCard title="Sin salida por día"><ColumnChart data={stats.nonDeployedByDay} name="Unidades" /></ChartCard>
        <RankCard title="Sin salida por sucursal" rows={stats.nonDeployedByBranch} />
        <ChartCard title="Caídas de voltaje por día"><ColumnChart data={stats.voltageByDay} name="Eventos" /></ChartCard>
        <RankCard title="Caídas de voltaje por sucursal" rows={stats.voltageByBranch} />
        {hasRalentys && (
          <>
            <ChartCard title="Ralentís por día"><TrendChart data={stats.ralentysByDay} name="Ralentís" /></ChartCard>
            <RankCard title="Ralentís por sucursal" rows={stats.ralentysByBranch} />
          </>
        )}
      </div>
    </div>
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
      obsByBranch: countBy(obs, 'branch', 'name'),
      voltByBranch: countBy(voltage, 'branch', 'name'),
      hasCoords: obs.some((o) => o.latitude != null && o.longitude != null),
    };
  }, [report, day]);

  return (
    <div className="content">
      <div className="grid-auto" style={gridOf(150)}>
        <StatTile icon={Timer} label="Ralentís (+30 min)" value={observations.length} />
        <StatTile icon={Zap} label="Caídas de voltaje" value={voltageDrops.length} />
        <StatTile icon={AlertTriangle} label="Sin salida de yarda" value={nonDeployed.length} />
        <StatTile icon={Clock} label="Salidas tardías" value={lateDeparts.length} />
      </div>

      {(obsByBranch.length > 0 || voltByBranch.length > 0) && (
        <div className="grid-auto" style={gridOf(340)}>
          {obsByBranch.length > 0 && <RankCard title="Ralentís por sucursal" rows={obsByBranch} />}
          {voltByBranch.length > 0 && <RankCard title="Caídas de voltaje por sucursal" rows={voltByBranch} />}
        </div>
      )}

      {hasCoords && <DeferredDayMap observations={observations} />}

      <DaySection title="Ralentís (+30 min)" count={observations.length} emptyMsg="Sin ralentís este día">
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

      <DaySection title="Caídas de voltaje" count={voltageDrops.length} emptyMsg="Sin caídas de voltaje este día">
        <DataTable
          label="Caídas de voltaje"
          data={voltageDrops}
          columns={[COLUMN.unit, COLUMN.plate, COLUMN.branch, COLUMN.time, { key: 'location', label: 'Ubicación', flex: 1 }]}
        />
      </DaySection>

      <div className="grid-auto" style={{ ...gridOf(400), alignItems: 'start' }}>
        <DaySection title="Sin salida de yarda" count={nonDeployed.length} emptyMsg="Todas las unidades salieron a tiempo">
          <DataTable label="Sin salida de yarda" data={nonDeployed} columns={[COLUMN.unit, COLUMN.plate, COLUMN.branchWide]} />
        </DaySection>
        <DaySection title="Salidas tardías (después de 11am)" count={lateDeparts.length} emptyMsg="Sin salidas tardías este día">
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

function DaySection({ title, count, children, emptyMsg }) {
  return (
    <section style={{ minWidth: 0 }}>
      <div className="row" style={{ marginBottom: 8 }}>
        <h2 style={{ fontSize: 14 }}>{title}</h2>
        <span className="badge">{count}</span>
      </div>
      {count === 0 ? <p className="card muted" style={{ padding: '12px 16px', fontSize: 13 }}>{emptyMsg}</p> : children}
    </section>
  );
}
