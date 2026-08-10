import type { ErrorPattern, ErrorResult, NormalizedRow } from '../types'
import type { ClassIndex } from './classify'
import { errorClass, errorCode, errorReason, errorStatus, hasErrorProps } from './fields'

interface Group {
  count: number
  users: Set<string>
  events: Set<string>
}

function bump(map: Map<string, Group>, key: string | null, id: string, event: string) {
  if (!key) return
  let g = map.get(key)
  if (!g) {
    g = { count: 0, users: new Set(), events: new Set() }
    map.set(key, g)
  }
  g.count++
  if (id) g.users.add(id)
  if (g.events.size < 5) g.events.add(event)
}

export function computeErrors(
  rows: NormalizedRow[],
  idx: ClassIndex,
  totalUsers: number,
): ErrorResult {
  const byEvent = new Map<string, Group>()
  const byReason = new Map<string, Group>()
  const byClass = new Map<string, Group>()
  const byCode = new Map<string, Group>()
  const byStatus = new Map<string, Group>()

  let totalErrorEvents = 0
  const affected = new Set<string>()

  for (const r of rows) {
    const isError = idx.categoryOf(r.event) === 'error' || hasErrorProps(r)
    if (!isError) continue
    totalErrorEvents++
    if (r.distinctId) affected.add(r.distinctId)
    bump(byEvent, r.event, r.distinctId, r.event)
    bump(byReason, errorReason(r), r.distinctId, r.event)
    bump(byClass, errorClass(r), r.distinctId, r.event)
    bump(byCode, errorCode(r), r.distinctId, r.event)
    bump(byStatus, errorStatus(r), r.distinctId, r.event)
  }

  const patterns: ErrorPattern[] = []
  const collect = (map: Map<string, Group>, groupedBy: ErrorPattern['groupedBy']) => {
    for (const [key, g] of map) {
      patterns.push({
        key,
        groupedBy,
        count: g.count,
        reach: g.users.size,
        sampleEvents: [...g.events],
      })
    }
  }
  collect(byReason, 'reason')
  collect(byClass, 'error_class')
  collect(byCode, 'error_code')
  collect(byStatus, 'status')
  collect(byEvent, 'event')

  patterns.sort((a, b) => b.reach - a.reach || b.count - a.count)

  return {
    totalErrorEvents,
    affectedUsers: affected.size,
    affectedShare: totalUsers > 0 ? affected.size / totalUsers : 0,
    patterns: patterns.slice(0, 24),
  }
}
