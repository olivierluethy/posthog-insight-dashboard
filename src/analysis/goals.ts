// Goal-feasibility and metric-relationship math. Pure and DOM-free so the UI
// (Goal Lab, Metric Explorer) can call it directly on the aligned MetricMatrix.
//
// Covers: predict milestones, forecast any metric, compound goals, feasibility,
// explain-why-unreachable, required conditions, what-if scenarios, actual-vs-
// required, deadlines, and metric relationships (installs-to-users etc.).
import type { MetricMatrix, MetricSeries } from '../types'
import { DAY_MS } from './stats'

// ---- Single-term evaluation ----------------------------------------------

export interface TermInput {
  metricKey: MetricSeries['key']
  target: number
}

export interface TermResult {
  metricKey: MetricSeries['key']
  label: string
  unit: string
  color: string
  cumulative: boolean
  current: number
  target: number
  gap: number
  ratePerDay: number
  /** projection date at the current rate, epoch ms; null if unreachable/already. */
  etaT: number | null
  daysToTarget: number | null
  alreadyReached: boolean
  /** trend is flat/declining, so the target never arrives at the current rate. */
  neverAtRate: boolean
  // --- deadline evaluation (null when no deadline is set) ---
  deadlineT: number | null
  /** rate/day needed to reach the target exactly by the deadline. */
  requiredRatePerDay: number | null
  /** requiredRatePerDay − ratePerDay; positive means the pace must increase. */
  rateShortfall: number | null
  /** how much faster the pace must be, e.g. 1.8 = needs 1.8× the current rate. */
  requiredMultiple: number | null
  feasibleByDeadline: boolean | null
}

/** Reachable at the current rate — ignoring any deadline. */
export function reachableAtRate(t: TermResult): boolean {
  return t.alreadyReached || (!t.neverAtRate && t.etaT != null)
}

/** Fully feasible: reachable, and — if a deadline is set — reachable in time. */
export function feasible(t: TermResult): boolean {
  if (t.deadlineT != null) return t.feasibleByDeadline === true
  return reachableAtRate(t)
}

export function evaluateTerm(
  series: MetricSeries,
  target: number,
  fromT: number,
  deadlineT: number | null,
): TermResult {
  const current = series.current
  const rate = series.ratePerDay
  const gap = target - current
  const alreadyReached = current >= target

  let etaT: number | null = null
  let daysToTarget: number | null = null
  let neverAtRate = false
  if (alreadyReached) {
    daysToTarget = 0
  } else if (rate <= 0) {
    neverAtRate = true
  } else {
    daysToTarget = gap / rate
    etaT = fromT + daysToTarget * DAY_MS
  }

  let requiredRatePerDay: number | null = null
  let rateShortfall: number | null = null
  let requiredMultiple: number | null = null
  let feasibleByDeadline: boolean | null = null
  if (deadlineT != null) {
    const daysLeft = (deadlineT - fromT) / DAY_MS
    if (alreadyReached) {
      requiredRatePerDay = 0
      rateShortfall = 0
      requiredMultiple = 0
      feasibleByDeadline = true
    } else if (daysLeft <= 0) {
      // Deadline is now/past and the target is not met.
      requiredRatePerDay = Infinity
      rateShortfall = Infinity
      requiredMultiple = Infinity
      feasibleByDeadline = false
    } else {
      requiredRatePerDay = gap / daysLeft
      rateShortfall = requiredRatePerDay - rate
      requiredMultiple = rate > 0 ? requiredRatePerDay / rate : Infinity
      feasibleByDeadline = rate >= requiredRatePerDay
    }
  }

  return {
    metricKey: series.key,
    label: series.label,
    unit: series.unit,
    color: series.color,
    cumulative: series.cumulative,
    current,
    target,
    gap,
    ratePerDay: rate,
    etaT,
    daysToTarget,
    alreadyReached,
    neverAtRate,
    deadlineT,
    requiredRatePerDay,
    rateShortfall,
    requiredMultiple,
    feasibleByDeadline,
  }
}

// ---- Compound goal --------------------------------------------------------

export interface GoalVerdict {
  terms: TermResult[]
  compound: boolean
  /** latest of the term ETAs — when the whole goal is met at current rates. */
  overallEtaT: number | null
  overallDaysToTarget: number | null
  /** every term reachable at its current rate. */
  reachable: boolean
  /** every term reachable, and in time if a deadline is set. */
  feasible: boolean
  /** which metrics block the goal and why (human-readable). */
  blockers: string[]
  /** what would have to change for the goal to become achievable. */
  requirements: string[]
}

export function evaluateGoal(
  matrix: MetricMatrix,
  inputs: TermInput[],
  deadlineT: number | null,
): GoalVerdict | null {
  const byKey = new Map(matrix.series.map((s) => [s.key, s]))
  const terms: TermResult[] = []
  for (const inp of inputs) {
    const s = byKey.get(inp.metricKey)
    if (s) terms.push(evaluateTerm(s, inp.target, matrix.endT, deadlineT))
  }
  if (terms.length === 0) return null

  const reachable = terms.every(reachableAtRate)
  const feasibleAll = terms.every(feasible)

  // Overall ETA is the slowest term; null if any term never arrives.
  let overallEtaT: number | null = matrix.endT
  let overallDays = 0
  let anyNever = false
  for (const t of terms) {
    if (t.alreadyReached) continue
    if (t.etaT == null) {
      anyNever = true
      break
    }
    if (t.etaT > (overallEtaT ?? 0)) overallEtaT = t.etaT
    if ((t.daysToTarget ?? 0) > overallDays) overallDays = t.daysToTarget ?? 0
  }
  if (anyNever) {
    overallEtaT = null
  } else if (terms.every((t) => t.alreadyReached)) {
    overallEtaT = matrix.endT
    overallDays = 0
  }

  const blockers: string[] = []
  const requirements: string[] = []
  for (const t of terms) {
    const lbl = t.label.toLowerCase()
    if (t.alreadyReached) continue
    if (t.neverAtRate) {
      blockers.push(
        `${t.label} is flat or declining (${fmtRate(t.ratePerDay)}/day), so ${fmtN(
          t.target,
        )} never arrives at the current trend.`,
      )
      requirements.push(
        `${t.label} must start growing — it needs a positive daily rate (currently ${fmtRate(
          t.ratePerDay,
        )}/day) to reach ${fmtN(t.target)}.`,
      )
    } else if (t.deadlineT != null && t.feasibleByDeadline === false) {
      blockers.push(
        `${t.label} reaches ${fmtN(t.target)} around ${daysWord(
          t.daysToTarget,
        )}, past the deadline.`,
      )
      if (t.requiredRatePerDay != null && Number.isFinite(t.requiredRatePerDay)) {
        requirements.push(
          `${t.label} needs ${fmtRate(t.requiredRatePerDay)}/day (${
            t.requiredMultiple != null && Number.isFinite(t.requiredMultiple)
              ? `${t.requiredMultiple.toFixed(1)}× the current ${fmtRate(t.ratePerDay)}/day`
              : 'up from a standstill'
          }) to hit ${fmtN(t.target)} in time.`,
        )
      }
    } else {
      // Reachable — note the remaining gap so the requirement list is never empty.
      requirements.push(
        `${t.label}: ${fmtN(t.gap)} more ${lbl.includes('user') ? 'users' : t.unit} at ${fmtRate(
          t.ratePerDay,
        )}/day.`,
      )
    }
  }

  return {
    terms,
    compound: terms.length > 1,
    overallEtaT,
    overallDaysToTarget: anyNever ? null : overallDays,
    reachable,
    feasible: feasibleAll,
    blockers,
    requirements,
  }
}

// ---- What-if scenario -----------------------------------------------------

export interface WhatIf {
  multiplier: number
  scenarioRatePerDay: number
  etaT: number | null
  daysToTarget: number | null
  meetsDeadline: boolean | null
}

/** Re-run a term under a hypothetical rate = current rate × multiplier. */
export function whatIf(term: TermResult, multiplier: number, fromT: number): WhatIf {
  const rate = term.ratePerDay * multiplier
  if (term.alreadyReached) {
    return { multiplier, scenarioRatePerDay: rate, etaT: fromT, daysToTarget: 0, meetsDeadline: true }
  }
  if (rate <= 0) {
    return { multiplier, scenarioRatePerDay: rate, etaT: null, daysToTarget: null, meetsDeadline: term.deadlineT != null ? false : null }
  }
  const days = term.gap / rate
  const etaT = fromT + days * DAY_MS
  const meetsDeadline = term.deadlineT != null ? etaT <= term.deadlineT : null
  return { multiplier, scenarioRatePerDay: rate, etaT, daysToTarget: days, meetsDeadline }
}

// ---- Relationships --------------------------------------------------------

/** Pearson correlation of two equal-length numeric series. */
export function pearson(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length)
  if (n < 2) return NaN
  let ma = 0
  let mb = 0
  for (let i = 0; i < n; i++) {
    ma += a[i]
    mb += b[i]
  }
  ma /= n
  mb /= n
  let saa = 0
  let sbb = 0
  let sab = 0
  for (let i = 0; i < n; i++) {
    const da = a[i] - ma
    const db = b[i] - mb
    saa += da * da
    sbb += db * db
    sab += da * db
  }
  if (saa === 0 || sbb === 0) return NaN
  return sab / Math.sqrt(saa * sbb)
}

export interface Relationship {
  a: MetricSeries
  b: MetricSeries
  /** correlation of the daily series. */
  correlation: number
  /** total(a) / total(b) — e.g. events per user. */
  ratioAB: number
  /** total(b) / total(a). */
  ratioBA: number
}

export function relate(a: MetricSeries, b: MetricSeries): Relationship {
  const correlation = pearson(
    a.daily.map((p) => p.v),
    b.daily.map((p) => p.v),
  )
  const ratioAB = b.total !== 0 ? a.total / b.total : NaN
  const ratioBA = a.total !== 0 ? b.total / a.total : NaN
  return { a, b, correlation, ratioAB, ratioBA }
}

export function correlationStrength(r: number): string {
  const a = Math.abs(r)
  if (!Number.isFinite(r)) return 'n/a'
  if (a >= 0.8) return 'very strong'
  if (a >= 0.6) return 'strong'
  if (a >= 0.4) return 'moderate'
  if (a >= 0.2) return 'weak'
  return 'negligible'
}

// ---- Small local formatters (kept here to stay DOM-free) ------------------

function fmtN(n: number): string {
  if (!Number.isFinite(n)) return '∞'
  return Math.abs(n) >= 1000 ? Math.round(n).toLocaleString('en-US') : String(Math.round(n))
}
function fmtRate(n: number): string {
  if (!Number.isFinite(n)) return '∞'
  return (Math.round(n * 10) / 10).toString()
}
function daysWord(days: number | null): string {
  if (days == null || !Number.isFinite(days)) return 'never'
  const d = Math.ceil(days)
  return d <= 0 ? 'today' : `${d} day${d === 1 ? '' : 's'} out`
}
