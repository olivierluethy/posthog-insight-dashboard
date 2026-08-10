import { useState } from 'react'
import type { EventCategory, EventFreqRow } from '../types'
import { fmtFactor, fmtNum, fmtPct } from '../analysis/format'
import { Bar, Section } from './primitives'

const CAT_LABEL: Record<EventCategory, string> = {
  install: 'install',
  uninstall: 'uninstall',
  error: 'error',
  session: 'session',
  passive: 'passive',
  generic: 'event',
}
const CAT_COLOR: Record<EventCategory, string> = {
  install: 'var(--pos)',
  uninstall: 'var(--neg)',
  error: 'var(--neg)',
  session: 'var(--cyan)',
  passive: 'var(--anomaly)',
  generic: 'var(--text-dim)',
}

export function EventFrequency({ rows }: { rows: EventFreqRow[] }) {
  const [showAll, setShowAll] = useState(false)
  const maxReach = Math.max(...rows.map((r) => r.reach), 1)
  const maxTotal = Math.max(...rows.map((r) => r.total), 1)
  const shown = showAll ? rows : rows.slice(0, 15)

  return (
    <Section
      id="sec-frequency"
      eyebrow="Event frequency"
      title="Volume vs reach"
      sub="Sorted by unique-user reach — the honest metric. Over-firing events are flagged; their raw counts mislead."
      right={
        rows.length > 15 ? (
          <button className="btn" onClick={() => setShowAll((s) => !s)}>
            {showAll ? 'Show top 15' : `Show all ${rows.length}`}
          </button>
        ) : undefined
      }
    >
      <div className="table-scroll">
        <table className="tbl">
          <thead>
            <tr>
              <th>Event</th>
              <th>Type</th>
              <th className="num">Reach (users)</th>
              <th className="num">Total</th>
              <th className="num">Per user</th>
              <th className="num">% of events</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.event}>
                <td>
                  <span className="mono event-name">{r.event}</span>
                  {r.passive && <span className="pill-passive">over-firing</span>}
                </td>
                <td>
                  <span className="cat-chip" style={{ color: CAT_COLOR[r.category] }}>
                    {CAT_LABEL[r.category]}
                  </span>
                </td>
                <td className="num">
                  <Bar value={r.reach} max={maxReach} />
                </td>
                <td className="num">
                  <Bar value={r.total} max={maxTotal} color={r.passive ? 'var(--anomaly)' : 'var(--signal)'} />
                </td>
                <td className="num">{fmtFactor(r.ratio)}</td>
                <td className="num">{fmtPct(r.share)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  )
}
