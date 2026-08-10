import type {
  EtaResult,
  ForecastMetric,
  ForecastResult,
  NormalizedRow,
  TimePoint,
} from '../types'
import type { ClassIndex } from './classify'
import { DAY_MS, bucketStart, denseBuckets, linreg } from './stats'

function cumulative(perDay: number[]): number[] {
  const out: number[] = []
  let acc = 0
  for (const v of perDay) {
    acc += v
    out.push(acc)
  }
  return out
}

function fitMetric(
  key: ForecastMetric['key'],
  label: string,
  days: number[],
  cum: number[],
): ForecastMetric {
  const xs = days.map((_, i) => i) // day index
  const { slope, intercept, r2 } = linreg(xs, cum)
  const points: TimePoint[] = days.map((t, i) => ({ t, v: cum[i] }))
  return {
    key,
    label,
    points,
    ratePerDay: slope,
    ratePerWeek: slope * 7,
    slope,
    intercept,
    r2,
    current: cum.length ? cum[cum.length - 1] : 0,
  }
}

export function computeForecast(rows: NormalizedRow[], idx: ClassIndex): ForecastResult {
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

  const newUsersPerDay = new Array(days.length).fill(0)
  const installsPerDay = new Array(days.length).fill(0)
  const uninstallsPerDay = new Array(days.length).fill(0)

  for (const [, t] of firstSeen) {
    const i = dayIndex.get(bucketStart(t, DAY_MS))
    if (i !== undefined) newUsersPerDay[i]++
  }
  for (const r of rows) {
    const i = dayIndex.get(bucketStart(r.ts, DAY_MS))
    if (i === undefined) continue
    const cat = idx.categoryOf(r.event)
    if (cat === 'install') installsPerDay[i]++
    else if (cat === 'uninstall') uninstallsPerDay[i]++
  }

  const cumUsers = cumulative(newUsersPerDay)
  const cumInstalls = cumulative(installsPerDay)
  const net = installsPerDay.map((v, i) => v - uninstallsPerDay[i])
  const cumNet = cumulative(net)

  const metrics: ForecastMetric[] = [
    fitMetric('cumUsers', 'Cumulative unique users', days, cumUsers),
    fitMetric('cumInstalls', 'Cumulative installs', days, cumInstalls),
    fitMetric('netGrowth', 'Net growth (installs − uninstalls)', days, cumNet),
  ]

  return { metrics, startT: days[0] ?? from, endT: days[days.length - 1] ?? to }
}

/** Project ETA to a target by extrapolating the current per-day rate from the
 *  last observed point. Extrapolation is linear and naive — surfaced with a caveat. */
export function computeEta(metric: ForecastMetric, target: number, endT: number): EtaResult {
  const current = metric.current
  const ratePerDay = metric.ratePerDay
  if (current >= target) {
    return {
      metricKey: metric.key,
      target,
      current,
      ratePerDay,
      etaT: null,
      daysToTarget: 0,
      alreadyReached: true,
      neverAtCurrentRate: false,
    }
  }
  if (ratePerDay <= 0) {
    return {
      metricKey: metric.key,
      target,
      current,
      ratePerDay,
      etaT: null,
      daysToTarget: null,
      alreadyReached: false,
      neverAtCurrentRate: true,
    }
  }
  const daysToTarget = (target - current) / ratePerDay
  return {
    metricKey: metric.key,
    target,
    current,
    ratePerDay,
    etaT: endT + daysToTarget * DAY_MS,
    daysToTarget,
    alreadyReached: false,
    neverAtCurrentRate: false,
  }
}

/** Next round-number milestone strictly above the current value. */
export function nextMilestone(current: number): number {
  if (current < 10) return 10
  const mag = Math.pow(10, Math.floor(Math.log10(current)))
  for (const step of [1, 2, 5, 10]) {
    const m = step * mag
    if (m > current) return m
  }
  return 10 * mag
}
