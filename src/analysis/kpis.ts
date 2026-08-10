import type { DataCompleteness, KpiSummary, NormalizedRow, TimePoint } from '../types'
import type { ClassIndex } from './classify'
import { DAY_MS, bucketStart, denseBuckets, mean } from './stats'

export function computeKpis(
  rows: NormalizedRow[],
  idx: ClassIndex,
  completeness: DataCompleteness,
): KpiSummary {
  const users = new Set<string>()
  let dateFrom = Infinity
  let dateTo = -Infinity
  let installs = 0
  let uninstalls = 0
  const installUsers = new Set<string>()
  const eventTypes = new Set<string>()
  // day bucket -> unique users
  const dauMap = new Map<number, Set<string>>()

  for (const r of rows) {
    if (r.distinctId) users.add(r.distinctId)
    eventTypes.add(r.event)
    if (r.ts < dateFrom) dateFrom = r.ts
    if (r.ts > dateTo) dateTo = r.ts

    const cat = idx.categoryOf(r.event)
    if (cat === 'install') {
      installs++
      if (r.distinctId) installUsers.add(r.distinctId)
    } else if (cat === 'uninstall') {
      uninstalls++
    }

    const day = bucketStart(r.ts, DAY_MS)
    let s = dauMap.get(day)
    if (!s) {
      s = new Set()
      dauMap.set(day, s)
    }
    if (r.distinctId) s.add(r.distinctId)
  }

  if (!Number.isFinite(dateFrom)) {
    dateFrom = 0
    dateTo = 0
  }

  const dauSeries: TimePoint[] = denseBuckets(dateFrom, dateTo, DAY_MS).map((t) => ({
    t,
    v: dauMap.get(t)?.size ?? 0,
  }))
  const dayCount = Math.max(1, dauSeries.length)
  const spanDays = Math.max(1, Math.round((dateTo - dateFrom) / DAY_MS) + 1)
  const newUsers = installUsers.size > 0 ? installUsers.size : users.size

  return {
    dateFrom,
    dateTo,
    spanDays,
    totalEvents: rows.length,
    uniqueUsers: users.size,
    newUsers,
    installs,
    uninstalls,
    distinctEventTypes: eventTypes.size,
    avgEventsPerDay: rows.length / dayCount,
    avgDau: mean(dauSeries.map((p) => p.v)) || 0,
    completeness: completeness.completeness,
    dauSeries,
  }
}
