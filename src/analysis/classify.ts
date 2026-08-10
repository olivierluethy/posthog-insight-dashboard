// Heuristic, product-agnostic event classification. Auto-detected defaults are
// user-overridable from the Advanced panel via ClassifierConfig.overrides.
import type { ClassifierConfig, EventCategory, EventClass, NormalizedRow } from '../types'
import { hasErrorProps, sessionCount, sessionDuration } from './fields'

export const DEFAULT_PASSIVE_RATIO = 20

const RE_INSTALL = /install(ed)?/i
const RE_UNINSTALL = /uninstall/i
const RE_ERROR = /(fail|failed|failure|rejected|reject|error|blocked|dropped|denied|crash)/i
const RE_SESSION = /session/i

interface Agg {
  total: number
  users: Set<string>
  errorRows: number
  sessionRows: number
}

export function aggregateEvents(rows: NormalizedRow[]): Map<string, Agg> {
  const map = new Map<string, Agg>()
  for (const r of rows) {
    let a = map.get(r.event)
    if (!a) {
      a = { total: 0, users: new Set(), errorRows: 0, sessionRows: 0 }
      map.set(r.event, a)
    }
    a.total++
    if (r.distinctId) a.users.add(r.distinctId)
    if (hasErrorProps(r)) a.errorRows++
    if (Number.isFinite(sessionCount(r)) || Number.isFinite(sessionDuration(r))) a.sessionRows++
  }
  return map
}

function autoCategory(event: string, a: Agg, ratio: number, passiveRatio: number): EventCategory {
  if (RE_UNINSTALL.test(event)) return 'uninstall'
  if (RE_INSTALL.test(event)) return 'install'
  if (RE_ERROR.test(event) || a.errorRows / Math.max(1, a.total) >= 0.5) return 'error'
  if (RE_SESSION.test(event) || a.sessionRows / Math.max(1, a.total) >= 0.5) return 'session'
  if (a.users.size > 0 && ratio >= passiveRatio) return 'passive'
  return 'generic'
}

export function classifyEvents(rows: NormalizedRow[], config: ClassifierConfig): EventClass[] {
  const agg = aggregateEvents(rows)
  const passiveRatio = config.passiveRatioThreshold || DEFAULT_PASSIVE_RATIO
  const out: EventClass[] = []
  for (const [event, a] of agg) {
    const reach = a.users.size
    const ratio = reach > 0 ? a.total / reach : a.total
    const auto = autoCategory(event, a, ratio, passiveRatio)
    const override = config.overrides[event]
    out.push({
      event,
      total: a.total,
      reach,
      volumeReachRatio: ratio,
      category: override ?? auto,
      autoCategory: auto,
      overridden: override != null && override !== auto,
    })
  }
  // Reach-primary sort so the most impactful events lead the classification view.
  out.sort((x, y) => y.reach - x.reach || y.total - x.total)
  return out
}

/** Index helpers derived from a classification, used by downstream modules. */
export interface ClassIndex {
  categoryOf: (event: string) => EventCategory
  installEvents: Set<string>
  uninstallEvents: Set<string>
  errorEvents: Set<string>
  passiveEvents: Set<string>
  byEvent: Map<string, EventClass>
}

export function buildClassIndex(classes: EventClass[]): ClassIndex {
  const byEvent = new Map<string, EventClass>()
  const installEvents = new Set<string>()
  const uninstallEvents = new Set<string>()
  const errorEvents = new Set<string>()
  const passiveEvents = new Set<string>()
  for (const c of classes) {
    byEvent.set(c.event, c)
    if (c.category === 'install') installEvents.add(c.event)
    if (c.category === 'uninstall') uninstallEvents.add(c.event)
    if (c.category === 'error') errorEvents.add(c.event)
    if (c.category === 'passive') passiveEvents.add(c.event)
  }
  return {
    byEvent,
    installEvents,
    uninstallEvents,
    errorEvents,
    passiveEvents,
    categoryOf: (e) => byEvent.get(e)?.category ?? 'generic',
  }
}
