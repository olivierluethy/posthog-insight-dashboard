import type { EventClass, EventFreqRow } from '../types'

// Event frequency table: total count AND unique-user reach side by side, sorted
// by reach (the honest primary metric). Passive/over-firing events are flagged
// inline because their raw counts mislead.
export function computeEventFrequency(classes: EventClass[]): EventFreqRow[] {
  const totalEvents = classes.reduce((s, c) => s + c.total, 0) || 1
  return classes
    .map((c) => ({
      event: c.event,
      total: c.total,
      reach: c.reach,
      ratio: c.volumeReachRatio,
      category: c.category,
      passive: c.category === 'passive',
      share: c.total / totalEvents,
    }))
    .sort((a, b) => b.reach - a.reach || b.total - a.total)
}
