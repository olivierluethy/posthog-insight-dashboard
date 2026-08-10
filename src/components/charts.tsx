import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { Anomaly, ForecastMetric, TimePoint } from '../types'
import { fmtBucket, fmtDayFull, fmtNum } from '../analysis/format'

const axisTick = { fill: 'var(--text-faint)', fontSize: 11, fontFamily: 'var(--font-mono)' }
const GRID = 'var(--border)'

interface TipRow {
  color?: string
  label: string
  value: number
}
function Tip({ title, rows }: { title: string; rows: TipRow[] }) {
  return (
    <div className="chart-tip">
      <div className="chart-tip-title mono">{title}</div>
      {rows.map((r, i) => (
        <div key={i} className="chart-tip-row">
          {r.color && <span className="chart-tip-dot" style={{ background: r.color }} />}
          <span className="chart-tip-label">{r.label}</span>
          <span className="mono chart-tip-val">{fmtNum(r.value)}</span>
        </div>
      ))}
    </div>
  )
}

export function TimeSeriesChart({
  points,
  bucketMs,
  color = 'var(--signal)',
  label,
  anomalies = [],
  changePoints = [],
  height = 220,
}: {
  points: TimePoint[]
  bucketMs: number
  color?: string
  label: string
  anomalies?: Anomaly[]
  changePoints?: Anomaly[]
  height?: number
}) {
  const data = points.map((p) => ({ t: p.t, v: p.v }))
  const gid = 'g-' + label.replace(/\W+/g, '')
  return (
    <div className="phosphor-chart">
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
          <defs>
            <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.28} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={GRID} strokeDasharray="2 4" vertical={false} />
          <XAxis
            dataKey="t"
            type="number"
            domain={['dataMin', 'dataMax']}
            scale="time"
            tick={axisTick}
            tickFormatter={(t) => fmtBucket(t, bucketMs)}
            stroke={GRID}
            minTickGap={40}
          />
          <YAxis tick={axisTick} stroke={GRID} width={40} allowDecimals={false} />
          <Tooltip
            cursor={{ stroke: 'var(--border-strong)' }}
            content={({ active, payload }) =>
              active && payload && payload.length ? (
                <Tip
                  title={fmtBucket(payload[0].payload.t, bucketMs)}
                  rows={[{ color, label, value: payload[0].payload.v }]}
                />
              ) : null
            }
          />
          <Area
            type="monotone"
            dataKey="v"
            stroke={color}
            strokeWidth={2}
            fill={`url(#${gid})`}
            isAnimationActive={false}
            className="phosphor-area"
          />
          {changePoints.map((cp, i) => (
            <ReferenceLine
              key={'cp' + i}
              x={cp.t}
              stroke="var(--anomaly)"
              strokeDasharray="4 3"
              strokeWidth={1.5}
            />
          ))}
          {anomalies.map((a, i) => (
            <ReferenceDot
              key={'an' + i}
              x={a.t}
              y={a.value}
              r={5}
              fill="transparent"
              stroke="var(--anomaly)"
              strokeWidth={2}
            />
          ))}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

export function ForecastChart({
  metric,
  target,
  etaT,
  height = 260,
}: {
  metric: ForecastMetric
  target?: number | null
  etaT?: number | null
  height?: number
}) {
  const obs = metric.points.map((p) => ({ t: p.t, observed: p.v, projected: null as number | null }))
  const last = metric.points[metric.points.length - 1]
  const rows: { t: number; observed: number | null; projected: number | null }[] = [...obs]
  if (last && etaT && etaT > last.t && metric.ratePerDay > 0) {
    // extend the projection line from the last observed point to the ETA.
    rows[rows.length - 1] = { ...rows[rows.length - 1], projected: last.v }
    rows.push({ t: etaT, observed: null, projected: target ?? metric.current })
  }
  return (
    <div className="phosphor-chart">
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={rows} margin={{ top: 8, right: 16, bottom: 4, left: 4 }}>
          <CartesianGrid stroke={GRID} strokeDasharray="2 4" vertical={false} />
          <XAxis
            dataKey="t"
            type="number"
            domain={['dataMin', 'dataMax']}
            scale="time"
            tick={axisTick}
            tickFormatter={(t) => fmtDayFull(t)}
            stroke={GRID}
            minTickGap={60}
          />
          <YAxis tick={axisTick} stroke={GRID} width={44} allowDecimals={false} />
          <Tooltip
            cursor={{ stroke: 'var(--border-strong)' }}
            content={({ active, payload }) => {
              if (!active || !payload || !payload.length) return null
              const p = payload[0].payload
              const rowsT: TipRow[] = []
              if (p.observed != null) rowsT.push({ color: 'var(--signal)', label: 'Observed', value: p.observed })
              if (p.projected != null) rowsT.push({ color: 'var(--cyan)', label: 'Projected', value: p.projected })
              return <Tip title={fmtDayFull(p.t)} rows={rowsT} />
            }}
          />
          {target != null && (
            <ReferenceLine
              y={target}
              stroke="var(--pos)"
              strokeDasharray="5 4"
              label={{ value: `target ${fmtNum(target)}`, fill: 'var(--pos)', fontSize: 11, position: 'insideTopRight' }}
            />
          )}
          {etaT != null && (
            <ReferenceLine x={etaT} stroke="var(--pos)" strokeDasharray="3 3" />
          )}
          <Area
            type="monotone"
            dataKey="observed"
            stroke="var(--signal)"
            strokeWidth={2}
            fill="url(#fc-grad)"
            connectNulls
            isAnimationActive={false}
            className="phosphor-area"
          />
          <defs>
            <linearGradient id="fc-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--signal)" stopOpacity={0.24} />
              <stop offset="100%" stopColor="var(--signal)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <Line
            type="linear"
            dataKey="projected"
            stroke="var(--cyan)"
            strokeWidth={2}
            strokeDasharray="5 4"
            dot={false}
            connectNulls
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
