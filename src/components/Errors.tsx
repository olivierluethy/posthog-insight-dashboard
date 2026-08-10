import type { ErrorPattern, ErrorResult } from '../types'
import { fmtNum, fmtPct } from '../analysis/format'
import { Bar, Section } from './primitives'

const GROUP_LABEL: Record<ErrorPattern['groupedBy'], string> = {
  reason: 'reason',
  error_class: 'class',
  error_code: 'code',
  status: 'status',
  event: 'event',
}

export function Errors({ e }: { e: ErrorResult }) {
  const maxReach = Math.max(...e.patterns.map((p) => p.reach), 1)
  return (
    <Section
      id="sec-errors"
      eyebrow="Error analysis"
      title="What's breaking, and for how many"
      sub="Error-like events and error property fields grouped by reason / class / code / status, ranked by affected-user reach."
    >
      <div className="error-summary">
        <div className="stat-tile">
          <div className="eyebrow">Error events</div>
          <div className="stat-value mono">{fmtNum(e.totalErrorEvents)}</div>
        </div>
        <div className="stat-tile">
          <div className="eyebrow">Affected users</div>
          <div className="stat-value mono" style={{ color: 'var(--neg)' }}>
            {fmtNum(e.affectedUsers)}
          </div>
          <div className="stat-foot">
            <span className="stat-hint">{fmtPct(e.affectedShare)} of all users</span>
          </div>
        </div>
      </div>

      {e.patterns.length === 0 ? (
        <div className="empty-note">No error-like events or error properties found in this export.</div>
      ) : (
        <div className="table-scroll">
          <table className="tbl">
            <thead>
              <tr>
                <th>Pattern</th>
                <th>Grouped by</th>
                <th className="num">Affected users</th>
                <th className="num">Occurrences</th>
                <th>Seen on events</th>
              </tr>
            </thead>
            <tbody>
              {e.patterns.map((p) => (
                <tr key={p.groupedBy + ':' + p.key}>
                  <td className="mono event-name">{p.key}</td>
                  <td>
                    <span className="cat-chip" style={{ color: 'var(--anomaly)' }}>
                      {GROUP_LABEL[p.groupedBy]}
                    </span>
                  </td>
                  <td className="num">
                    <Bar value={p.reach} max={maxReach} color="var(--neg)" />
                  </td>
                  <td className="num">{fmtNum(p.count)}</td>
                  <td className="mono error-samples">{p.sampleEvents.join(', ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  )
}
