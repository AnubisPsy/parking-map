import {
  Bar, BarChart, CartesianGrid, LabelList, Line, LineChart, Tooltip, XAxis, YAxis,
} from 'recharts';
import { CHART_COLOR } from '../../lib/colors';

const AXIS_TICK = { fontSize: 12, fill: '#4a4945' };
const AXIS_LINE = { stroke: '#c3c2b7' };
const GRID = '#ecebe6';
const TOOLTIP_STYLE = {
  background: 'white',
  border: '1px solid #e5e4df',
  borderRadius: 8,
  boxShadow: '0 2px 8px rgba(26,26,24,0.08)',
  fontSize: 12,
};

const margins = { top: 20, right: 8, bottom: 0, left: 8 };

// ResponsiveContainer entrega el tamaño por props a su hijo directo; hay que reenviarlo al gráfico

// Columnas con el valor sobre cada una: el eje vertical sobra
export function ColumnChart({ data, xKey = 'day', name, width, height }) {
  return (
    <BarChart width={width} height={height} data={data} margin={margins}>
      <XAxis dataKey={xKey} tick={AXIS_TICK} axisLine={AXIS_LINE} tickLine={false} interval={0} />
      <Tooltip cursor={{ fill: '#f3f3f0' }} contentStyle={TOOLTIP_STYLE} />
      <Bar dataKey="count" name={name} fill={CHART_COLOR} maxBarSize={24} radius={[4, 4, 0, 0]} isAnimationActive={false}>
        <LabelList dataKey="count" position="top" style={{ fontSize: 12, fontWeight: 600, fill: '#1a1a18' }} />
      </Bar>
    </BarChart>
  );
}

export function TrendChart({ data, xKey = 'day', name, width, height }) {
  return (
    <LineChart width={width} height={height} data={data} margin={{ ...margins, top: 10 }}>
      <CartesianGrid vertical={false} stroke={GRID} />
      <XAxis dataKey={xKey} tick={AXIS_TICK} axisLine={AXIS_LINE} tickLine={false} />
      <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} width={28} allowDecimals={false} />
      <Tooltip contentStyle={TOOLTIP_STYLE} />
      <Line
        type="monotone"
        dataKey="count"
        name={name}
        stroke={CHART_COLOR}
        strokeWidth={2}
        dot={{ r: 4, fill: CHART_COLOR, stroke: 'white', strokeWidth: 2 }}
        activeDot={{ r: 5, stroke: 'white', strokeWidth: 2 }}
        isAnimationActive={false}
      />
    </LineChart>
  );
}
