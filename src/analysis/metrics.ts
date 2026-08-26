// Builds one aligned daily matrix of the core product metrics (new/active users,
// installs, uninstalls, net growth, events, errors). Every series shares the same
// dense day axis so they can be overlaid, correlated, and forecast against each
// other. This is the foundation for the Metric Explorer and Goal Lab.
import type { MetricKey, MetricMatrix, MetricSeries, NormalizedRow, TimePoint } from '../types'
import type { ClassIndex } from './classify'
import { hasErrorProps } from './fields'
import { DAY_MS, bucketStart, denseBuckets, linreg, mean } from './stats'

interface MetricDef {
  key: MetricKey
  label: string
  cumulative: boolean
  unit: string
  color: string
}

// Fixed assignment order from the validated categorical palette (styleguide).
const DEFS: MetricDef[] = [
  { key: 'newUsers', label: 'New users', cumulative: true, unit: 'users', color: 'var(--cat-1)' },
  { key: 'activeUsers', label: 'Active users / day', cumulative: false, unit: 'users', color: 'var(--cat-3)' },
  { key: 'installs', label: 'Installs', cumulative: true, unit: 'installs', color: 'var(--cat-2)' },
  { key: 'uninstalls', label: 'Uninstalls', cumulative: true, unit: 'uninstalls', color: 'var(--cat-5)' },
  { key: 'netGrowth', label: 'Net growth', cumulative: true, unit: 'net', color: 'var(--cat-4)' },
  { key: 'events', label: 'Events', cumulative: true, unit: 'events', color: 'var(--cat-6)' },
  { key: 'errors', label: 'Errors', cumulative: true, unit: 'errors', color: 'var(--cat-8)' },
]

function cumulative(daily: number[]): number[] {
  const out: number[] = []
  let acc = 0
  for (const v of daily) {
    acc += v
    out.push(acc)
  }
  return out
}

function toSeries(def: MetricDef, days: number[], daily: number[]): MetricSeries {
  const cum = cumulative(daily)
  const dailyPts: TimePoint[] = days.map((t, i) => ({ t, v: daily[i] }))
  const cumPts: TimePoint[] = days.map((t, i) => ({ t, v: cum[i] }))
  // Goals run on the running total for count metrics, on the daily level otherwise.
  const fitYs = def.cumulative ? cum : daily
  const xs = days.map((_, i) => i)
  const { slope, r2 } = linreg(xs, fitYs)
  const current = fitYs.length ? fitYs[fitYs.length - 1] : 0
  return {
    key: def.key,
    label: def.label,
    cumulative: def.cumulative,
    unit: def.unit,
    color: def.color,
    daily: dailyPts,
    cumSeries: cumPts,
    total: cum.length ? cum[cum.length - 1] : 0,
    current,
    ratePerDay: slope,
    ratePerWeek: slope * 7,
    r2,
    peakDaily: daily.length ? Math.max(...daily) : 0,
    meanDaily: daily.length ? mean(daily) : 0,
  }
}

export function computeMetrics(rows: NormalizedRow[], idx: ClassIndex): MetricMatrix {
  let from = Infinity
  let to = -Infinity
  const firstSeen = new Map<string, number>()
  for (const r of rows) {
    if (r.ts < from) from = r.ts
    if (r.ts > to) to = r.ts
    if (r.distinctId) {
      const prev = firstSeen.get(r.distinctId)
      if (prev === undefined || r.ts < prev) firstSeen.set(r.distinctId, r.ts)
    }
  }
  if (!Number.isFinite(from)) {
    from = 0
    to = 0
  }
  const days = denseBuckets(from, to, DAY_MS)
  const dayIndex = new Map<number, number>()
  days.forEach((t, i) => dayIndex.set(t, i))

  const n = days.length
  const newUsers = new Array(n).fill(0)
  const installs = new Array(n).fill(0)
  const uninstalls = new Array(n).fill(0)
  const events = new Array(n).fill(0)
  const errors = new Array(n).fill(0)
  const dauSets: Set<string>[] = days.map(() => new Set<string>())

  for (const [, t] of firstSeen) {
    const i = dayIndex.get(bucketStart(t, DAY_MS))
    if (i !== undefined) newUsers[i]++
  }
  for (const r of rows) {
    const i = dayIndex.get(bucketStart(r.ts, DAY_MS))
    if (i === undefined) continue
    events[i]++
    if (r.distinctId) dauSets[i].add(r.distinctId)
    const cat = idx.categoryOf(r.event)
    if (cat === 'install') installs[i]++
    else if (cat === 'uninstall') uninstalls[i]++
    if (cat === 'error' || hasErrorProps(r)) errors[i]++
  }
  const activeUsers = dauSets.map((s) => s.size)
  const netGrowth = installs.map((v, i) => v - uninstalls[i])

  const byKey: Record<MetricKey, number[]> = {
    newUsers,
    activeUsers,
    installs,
    uninstalls,
    netGrowth,
    events,
    errors,
  }

  const series = DEFS.map((def) => toSeries(def, days, byKey[def.key]))
  return { startT: days[0] ?? from, endT: days[days.length - 1] ?? to, days, series }
}
