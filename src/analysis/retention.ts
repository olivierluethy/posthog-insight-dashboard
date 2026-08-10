import type {
  ChurnSignal,
  EngagementCompare,
  NormalizedRow,
  RetentionResult,
  UserJourney,
} from '../types'
import type { ClassIndex } from './classify'
import { hasErrorProps } from './fields'
import { median } from './stats'

const LAST_N = 8
const MAX_JOURNEYS = 500 // cap the payload; stats below are computed over ALL churned users.
const RE_RESET = /reset|reject|revoke|logout|sign[_-]?out|clear/i

interface UEvents {
  events: { e: string; t: number }[]
}

export function computeRetention(rows: NormalizedRow[], idx: ClassIndex): RetentionResult {
  const byUser = new Map<string, UEvents>()
  for (const r of rows) {
    if (!r.distinctId) continue
    let u = byUser.get(r.distinctId)
    if (!u) {
      u = { events: [] }
      byUser.set(r.distinctId, u)
    }
    u.events.push({ e: r.event, t: r.ts })
  }

  const installerUsers = new Set<string>()
  const churnedEventCounts: number[] = []
  const retainedEventCounts: number[] = []
  const lastActionCounts = new Map<string, number>()
  const allJourneys: UserJourney[] = []
  let churned = 0
  const timeToChurn: number[] = []

  for (const [id, u] of byUser) {
    u.events.sort((a, b) => a.t - b.t)
    let installT: number | null = null
    let uninstallT: number | null = null
    let hitError = false
    let hitReset = false
    for (const ev of u.events) {
      const cat = idx.categoryOf(ev.e)
      if (cat === 'install' && installT === null) installT = ev.t
      if (cat === 'uninstall' && uninstallT === null) uninstallT = ev.t
      if (cat === 'error') hitError = true
      if (RE_RESET.test(ev.e)) hitReset = true
    }
    if (installT !== null) installerUsers.add(id)

    if (uninstallT === null) {
      retainedEventCounts.push(u.events.length)
      continue
    }

    // Churned user.
    churned++
    churnedEventCounts.push(u.events.length)
    if (installT !== null) timeToChurn.push(uninstallT - installT)

    const pre = u.events.filter((ev) => ev.t <= uninstallT! && idx.categoryOf(ev.e) !== 'uninstall')
    const lastEvents = pre.slice(-LAST_N).map((ev) => ({ event: ev.e, t: ev.t }))
    const lastAction = pre.length ? pre[pre.length - 1].e : null
    if (lastAction) lastActionCounts.set(lastAction, (lastActionCounts.get(lastAction) ?? 0) + 1)

    allJourneys.push({
      distinctId: id,
      installedAt: installT,
      uninstalledAt: uninstallT,
      timeToChurnMs: installT !== null ? uninstallT - installT : null,
      eventCount: u.events.length,
      lastEvents,
      hitError,
      hitReset,
    })
  }

  // Row-level error-prop pass to enrich hitError (cheap single scan).
  const errUsers = new Set<string>()
  for (const r of rows) if (r.distinctId && hasErrorProps(r)) errUsers.add(r.distinctId)
  for (const j of allJourneys) if (!j.hitError && errUsers.has(j.distinctId)) j.hitError = true

  const totalUsers = byUser.size
  const installsBasis = installerUsers.size > 0 ? installerUsers.size : totalUsers
  const retainedUsers = totalUsers - churned

  // Churn-signal detection: events over-represented as the final action.
  const totalEvents = rows.length || 1
  const eventTotals = new Map<string, number>()
  for (const r of rows) eventTotals.set(r.event, (eventTotals.get(r.event) ?? 0) + 1)
  const churnSignals: ChurnSignal[] = []
  for (const [event, cnt] of lastActionCounts) {
    if (cnt < 3) continue
    const lastActionShare = cnt / Math.max(1, churned)
    const baselineShare = (eventTotals.get(event) ?? 0) / totalEvents
    const lift = baselineShare > 0 ? lastActionShare / baselineShare : Infinity
    if (lift < 1.5) continue
    churnSignals.push({ event, lastActionShare, baselineShare, lift, churnedCount: cnt })
  }
  churnSignals.sort((a, b) => b.lift - a.lift || b.churnedCount - a.churnedCount)

  const cMed = median(churnedEventCounts) || 0
  const rMed = median(retainedEventCounts) || 0
  const cMean = churnedEventCounts.reduce((s, x) => s + x, 0) / Math.max(1, churnedEventCounts.length)
  const rMean = retainedEventCounts.reduce((s, x) => s + x, 0) / Math.max(1, retainedEventCounts.length)
  const engagement: EngagementCompare = {
    churnedUsers: churned,
    retainedUsers,
    churnedMedianEvents: cMed,
    retainedMedianEvents: rMed,
    churnedMeanEvents: Number.isFinite(cMean) ? cMean : 0,
    retainedMeanEvents: Number.isFinite(rMean) ? rMean : 0,
    churnIsDissatisfaction: churned >= 5 && retainedUsers >= 5 && cMed > rMed,
  }

  allJourneys.sort((a, b) => b.uninstalledAt - a.uninstalledAt)

  return {
    installs: installsBasis,
    uninstalls: churned,
    churnRate: installsBasis > 0 ? churned / installsBasis : 0,
    retainedUsers,
    medianTimeToChurnMs: timeToChurn.length ? median(timeToChurn) : null,
    journeys: allJourneys.slice(0, MAX_JOURNEYS),
    engagement,
    churnSignals: churnSignals.slice(0, 12),
  }
}
