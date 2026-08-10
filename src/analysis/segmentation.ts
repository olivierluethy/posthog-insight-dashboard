import type {
  Breakdown,
  EventClass,
  FeatureAdoption,
  NormalizedRow,
  PowerUserDist,
  SegmentationResult,
  SessionStats,
  VersionHealth,
} from '../types'
import type { ClassIndex } from './classify'
import { country, hasErrorProps, language, sessionCount, sessionDuration, version } from './fields'
import { median, quantile } from './stats'

interface Seg {
  users: Set<string>
  events: number
}

function bump(map: Map<string, Seg>, key: string, id: string) {
  let s = map.get(key)
  if (!s) {
    s = { users: new Set(), events: 0 }
    map.set(key, s)
  }
  s.events++
  if (id) s.users.add(id)
}

function toBreakdown(map: Map<string, Seg>, totalUsers: number, limit = 15): Breakdown[] {
  return [...map.entries()]
    .map(([key, s]) => ({
      key,
      label: key,
      users: s.users.size,
      events: s.events,
      share: totalUsers > 0 ? s.users.size / totalUsers : 0,
    }))
    .sort((a, b) => b.users - a.users || b.events - a.events)
    .slice(0, limit)
}

interface VAgg {
  users: Set<string>
  events: number
  errorEvents: number
  uninstallUsers: Set<string>
}

export function computeSegmentation(
  rows: NormalizedRow[],
  classes: EventClass[],
  idx: ClassIndex,
  totalUsers: number,
): SegmentationResult {
  const geoMap = new Map<string, Seg>()
  const langMap = new Map<string, Seg>()
  const verMap = new Map<string, VAgg>()
  const perUser = new Map<string, number>()

  const sessCountByUser = new Map<string, number>()
  const durations: number[] = []
  let sessionSignal = false

  let overallErrorEvents = 0

  for (const r of rows) {
    const id = r.distinctId
    bump(geoMap, country(r) ?? 'Unknown', id)
    bump(langMap, language(r) ?? 'Unknown', id)
    if (id) perUser.set(id, (perUser.get(id) ?? 0) + 1)

    const cat = idx.categoryOf(r.event)
    const isError = cat === 'error' || hasErrorProps(r)
    if (isError) overallErrorEvents++

    const ver = version(r) ?? 'Unknown'
    let v = verMap.get(ver)
    if (!v) {
      v = { users: new Set(), events: 0, errorEvents: 0, uninstallUsers: new Set() }
      verMap.set(ver, v)
    }
    v.events++
    if (id) v.users.add(id)
    if (isError) v.errorEvents++
    if (cat === 'uninstall' && id) v.uninstallUsers.add(id)

    const sc = sessionCount(r)
    if (Number.isFinite(sc)) {
      sessionSignal = true
      if (id) sessCountByUser.set(id, Math.max(sessCountByUser.get(id) ?? 0, sc))
    }
    const sd = sessionDuration(r)
    if (Number.isFinite(sd)) {
      sessionSignal = true
      durations.push(sd)
    }
  }

  const overallErrorRate = rows.length > 0 ? overallErrorEvents / rows.length : 0

  const versions: VersionHealth[] = [...verMap.entries()]
    .filter(([k]) => k !== 'Unknown')
    .map(([ver, v]) => {
      const errorRate = v.events > 0 ? v.errorEvents / v.events : 0
      const churnRate = v.users.size > 0 ? v.uninstallUsers.size / v.users.size : 0
      return {
        version: ver,
        users: v.users.size,
        events: v.events,
        errorEvents: v.errorEvents,
        errorRate,
        uninstalls: v.uninstallUsers.size,
        churnRate,
        suspect: v.users.size >= 5 && (errorRate > overallErrorRate * 1.5 + 0.01 || churnRate > 0.4),
      }
    })
    .sort((a, b) => b.users - a.users)
    .slice(0, 20)

  const features: FeatureAdoption[] = classes
    .filter((c) => c.category === 'generic' || c.category === 'session')
    .map((c) => ({
      event: c.event,
      category: c.category,
      users: c.reach,
      adoption: totalUsers > 0 ? c.reach / totalUsers : 0,
    }))
    .sort((a, b) => b.adoption - a.adoption)
    .slice(0, 20)

  // Power-user distribution.
  const counts = [...perUser.values()]
  const bucketDefs = [
    { label: '1 event', test: (n: number) => n === 1 },
    { label: '2–3', test: (n: number) => n >= 2 && n <= 3 },
    { label: '4–10', test: (n: number) => n >= 4 && n <= 10 },
    { label: '11–50', test: (n: number) => n >= 11 && n <= 50 },
    { label: '51+', test: (n: number) => n > 50 },
  ]
  const buckets = bucketDefs.map((b) => ({
    label: b.label,
    users: counts.filter((n) => b.test(n)).length,
  }))
  const p90 = quantile(counts, 0.9)
  const oneAndDone = counts.filter((n) => n === 1).length
  const powerUsers = counts.filter((n) => n >= p90 && n > 1).length
  const power: PowerUserDist = {
    buckets,
    oneAndDoneUsers: oneAndDone,
    oneAndDoneShare: counts.length ? oneAndDone / counts.length : 0,
    powerUsers,
    powerUserShare: counts.length ? powerUsers / counts.length : 0,
    medianEventsPerUser: median(counts) || 0,
  }

  const sessCounts = [...sessCountByUser.values()]
  const sessions: SessionStats = {
    available: sessionSignal,
    users: sessCountByUser.size,
    medianSessionCount: sessCounts.length ? median(sessCounts) : null,
    medianDurationSec: durations.length ? median(durations) : null,
    avgDurationSec: durations.length ? durations.reduce((s, x) => s + x, 0) / durations.length : null,
  }

  return {
    geo: toBreakdown(geoMap, totalUsers),
    language: toBreakdown(langMap, totalUsers),
    versions,
    features,
    power,
    sessions,
  }
}
