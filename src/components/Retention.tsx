import { useState } from 'react'
import type { RetentionResult } from '../types'
import { fmtDuration, fmtFactor, fmtNum, fmtPct } from '../analysis/format'
import { Bar, Section } from './primitives'

function shortId(id: string) {
  if (!id) return '—'
  return id.length > 14 ? id.slice(0, 6) + '…' + id.slice(-4) : id
}

export function Retention({ r }: { r: RetentionResult }) {
  const [expanded, setExpanded] = useState<string | null>(null)
  const eng = r.engagement
  const maxLift = Math.max(...r.churnSignals.map((s) => s.lift).filter(Number.isFinite), 1)

  return (
    <Section
      id="sec-retention"
      eyebrow="Retention & churn"
      title="Who left, when, and why"
      sub="Install→uninstall funnel, reconstructed churn journeys, and whether churn is disengagement or dissatisfaction."
    >
      <div className="retention-top">
        <div className="funnel">
          <div className="funnel-stage">
            <div className="funnel-bar" style={{ width: '100%', background: 'var(--pos)' }} />
            <div className="funnel-label">
              <span className="mono">{fmtNum(r.installs)}</span> installers
            </div>
          </div>
          <div className="funnel-stage">
            <div
              className="funnel-bar"
              style={{
                width: `${Math.max(6, r.installs ? (r.uninstalls / r.installs) * 100 : 0)}%`,
                background: 'var(--neg)',
              }}
            />
            <div className="funnel-label">
              <span className="mono">{fmtNum(r.uninstalls)}</span> uninstalled
            </div>
          </div>
          <div className="funnel-metrics">
            <div>
              <div className="eyebrow">Churn rate</div>
              <div className="mono big-num" style={{ color: 'var(--neg)' }}>
                {fmtPct(r.churnRate)}
              </div>
            </div>
            <div>
              <div className="eyebrow">Retained</div>
              <div className="mono big-num" style={{ color: 'var(--pos)' }}>
                {fmtNum(r.retainedUsers)}
              </div>
            </div>
            <div>
              <div className="eyebrow">Median time to churn</div>
              <div className="mono big-num">
                {r.medianTimeToChurnMs != null ? fmtDuration(r.medianTimeToChurnMs / 1000) : '—'}
              </div>
            </div>
          </div>
        </div>

        <div className={'engagement ' + (eng.churnIsDissatisfaction ? 'engagement-warn' : '')}>
          <div className="eyebrow">Churned vs retained engagement</div>
          <div className="eng-rows">
            <div className="eng-row">
              <span>Median events — churned</span>
              <span className="mono">{fmtNum(eng.churnedMedianEvents)}</span>
            </div>
            <div className="eng-row">
              <span>Median events — retained</span>
              <span className="mono">{fmtNum(eng.retainedMedianEvents)}</span>
            </div>
          </div>
          <div className="eng-verdict">
            {eng.churnIsDissatisfaction
              ? 'Churned users were MORE engaged — this is dissatisfaction, not disengagement.'
              : 'Churned users were less engaged than retained — churn looks like drop-off, not frustration.'}
          </div>
        </div>
      </div>

      <div className="churn-signals">
        <div className="eyebrow anomaly-head">Churn-signal events (over-represented as the last action)</div>
        {r.churnSignals.length === 0 ? (
          <div className="empty-note sm">No event is disproportionately the final action before churn.</div>
        ) : (
          <div className="table-scroll">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Last action before uninstall</th>
                  <th className="num">Churned users</th>
                  <th className="num">Of churned</th>
                  <th className="num">Lift vs baseline</th>
                </tr>
              </thead>
              <tbody>
                {r.churnSignals.map((s) => (
                  <tr key={s.event}>
                    <td className="mono event-name">{s.event}</td>
                    <td className="num">{fmtNum(s.churnedCount)}</td>
                    <td className="num">{fmtPct(s.lastActionShare)}</td>
                    <td className="num">
                      <Bar value={s.lift} max={maxLift} color="var(--neg)" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="journeys">
        <div className="eyebrow anomaly-head">
          Churn journeys · showing {Math.min(r.journeys.length, 40)} of {fmtNum(r.uninstalls)}
        </div>
        <div className="table-scroll">
          <table className="tbl">
            <thead>
              <tr>
                <th>User</th>
                <th className="num">Events</th>
                <th className="num">Time to churn</th>
                <th>Signals</th>
                <th>Last actions</th>
              </tr>
            </thead>
            <tbody>
              {r.journeys.slice(0, 40).map((j) => (
                <tr
                  key={j.distinctId}
                  className="journey-row"
                  onClick={() => setExpanded(expanded === j.distinctId ? null : j.distinctId)}
                >
                  <td className="mono">{shortId(j.distinctId)}</td>
                  <td className="num">{fmtNum(j.eventCount)}</td>
                  <td className="num">{j.timeToChurnMs != null ? fmtDuration(j.timeToChurnMs / 1000) : '—'}</td>
                  <td>
                    {j.hitError && <span className="sig sig-err">error</span>}
                    {j.hitReset && <span className="sig sig-reset">reset</span>}
                    {!j.hitError && !j.hitReset && <span className="sig-none">—</span>}
                  </td>
                  <td>
                    <span className="journey-trail mono">
                      {(expanded === j.distinctId ? j.lastEvents : j.lastEvents.slice(-3)).map((e, i, arr) => (
                        <span key={i}>
                          {e.event}
                          {i < arr.length - 1 ? ' → ' : ''}
                        </span>
                      ))}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Section>
  )
}
