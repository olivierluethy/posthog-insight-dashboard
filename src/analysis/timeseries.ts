import type {
  Anomaly,
  EventClass,
  Granularity,
  NormalizedRow,
  Series,
  TimePoint,
  TimeseriesResult,
} from '../types'
import type { ClassIndex } from './classify'
import { hasErrorProps } from './fields'
import { fmtBucket, fmtFactor } from './format'
import { DAY_MS, HOUR_MS, bucketStart, denseBuckets, mad, mean } from './stats'

const TOP_EVENT_SERIES = 5

interface SeriesDef {
  key: string
  label: string
  category: Series['category']
  match: (r: NormalizedRow, cat: string) => boolean
}

function buildSeriesDefs(classes: EventClass[], idx: ClassIndex): SeriesDef[] {
  const defs: SeriesDef[] = [
    { key: 'installs', label: 'Installs', category: 'install', match: (_r, c) => c === 'install' },
    { key: 'uninstalls', label: 'Uninstalls', category: 'uninstall', match: (_r, c) => c === 'uninstall' },
    {
      key: 'errors',
      label: 'Errors',
      category: 'error',
      match: (r, c) => c === 'error' || hasErrorProps(r),
    },
  ]
  // Top generic/session events by reach become their own series.
  const top = classes
    .filter((c) => c.category === 'generic' || c.category === 'session' || c.category === 'passive')
    .slice(0, TOP_EVENT_SERIES)
  for (const c of top) {
    defs.push({
      key: `ev:${c.event}`,
      label: c.event,
      category: c.category,
      match: (r) => r.event === c.event,
    })
  }
  return defs
}

function detectAnomalies(series: Series, bucketMs: number): Anomaly[] {
  const vals = series.points.map((p) => p.v)
  if (vals.length < 4) return []
  const { median: med, scaled } = mad(vals)
  if (scaled < 1e-9) return [] // series is essentially flat; MAD can't discriminate.
  const out: Anomaly[] = []
  for (const p of series.points) {
    const score = Math.abs(p.v - med) / scaled
    if (score <= 3.5) continue
    const baseline = Math.max(med, 0.5)
    const higher = p.v > med
    if (!higher && med < 1) continue // dips below a ~0 baseline are noise.
    const factor = p.v / baseline
    out.push({
      t: p.t,
      event: series.label,
      value: p.v,
      baseline: med,
      factor,
      direction: higher ? 'higher' : 'lower',
      score,
      kind: higher ? 'spike' : 'dip',
      label: `On ${fmtBucket(p.t, bucketMs)}, ${series.label} was ${p.v} vs baseline ${med} (${fmtFactor(
        higher ? factor : baseline / Math.max(p.v, 0.5),
      )} ${higher ? 'higher' : 'lower'}).`,
    })
  }
  return out
}

function detectChangePoint(series: Series, bucketMs: number): Anomaly | null {
  const vals = series.points.map((p) => p.v)
  const n = vals.length
  const w = bucketMs < DAY_MS ? Math.max(6, Math.floor(n / 8)) : Math.max(2, Math.floor(n / 5))
  if (n < w * 2 + 1) return null
  const { scaled } = mad(vals)
  let best: { i: number; before: number; after: number; mag: number } | null = null
  for (let i = w; i <= n - w; i++) {
    const before = mean(vals.slice(i - w, i))
    const after = mean(vals.slice(i, i + w))
    const mag = Math.abs(after - before)
    if (!best || mag > best.mag) best = { i, before, after, mag }
  }
  if (!best) return null
  const noise = scaled > 1e-9 ? scaled : Math.max(1, mean(vals) * 0.5)
  const rel = best.before > 0 ? best.mag / best.before : best.after > 0 ? 1 : 0
  if (best.mag < 2 * noise || rel < 0.5) return null
  const p = series.points[best.i]
  const higher = best.after > best.before
  return {
    t: p.t,
    event: series.label,
    value: Math.round(best.after),
    baseline: Math.round(best.before),
    factor: best.before > 0 ? best.after / best.before : Infinity,
    direction: higher ? 'higher' : 'lower',
    score: best.mag / noise,
    kind: 'level-shift',
    label: `Level shift on ${fmtBucket(p.t, bucketMs)}: ${series.label} moved from ~${Math.round(
      best.before,
    )} to ~${Math.round(best.after)} per ${bucketMs < DAY_MS ? 'hour' : 'day'} (${
      higher ? 'up' : 'down'
    }).`,
  }
}

export function computeTimeseries(
  rows: NormalizedRow[],
  classes: EventClass[],
  idx: ClassIndex,
  granularity: Granularity,
): TimeseriesResult {
  const bucketMs = granularity === 'hour' ? HOUR_MS : DAY_MS
  let from = Infinity
  let to = -Infinity
  for (const r of rows) {
    if (r.ts < from) from = r.ts
    if (r.ts > to) to = r.ts
  }
  if (!Number.isFinite(from)) {
    from = 0
    to = 0
  }
  const buckets = denseBuckets(from, to, bucketMs)
  const bucketIndex = new Map<number, number>()
  buckets.forEach((t, i) => bucketIndex.set(t, i))

  const defs = buildSeriesDefs(classes, idx)
  const counts = defs.map(() => new Float64Array(buckets.length))

  for (const r of rows) {
    const bi = bucketIndex.get(bucketStart(r.ts, bucketMs))
    if (bi === undefined) continue
    const cat = idx.categoryOf(r.event)
    for (let d = 0; d < defs.length; d++) {
      if (defs[d].match(r, cat)) counts[d][bi]++
    }
  }

  const series: Series[] = defs.map((def, d) => ({
    key: def.key,
    label: def.label,
    category: def.category,
    points: buckets.map((t, i) => ({ t, v: counts[d][i] } as TimePoint)),
  }))

  const anomalies: Anomaly[] = []
  const changePoints: Anomaly[] = []
  for (const s of series) {
    for (const a of detectAnomalies(s, bucketMs)) anomalies.push(a)
    const cp = detectChangePoint(s, bucketMs)
    if (cp) changePoints.push(cp)
  }
  anomalies.sort((a, b) => b.score - a.score)
  changePoints.sort((a, b) => b.score - a.score)

  return { granularity, bucketMs, series, anomalies, changePoints }
}
