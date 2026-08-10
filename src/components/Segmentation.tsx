import type { Breakdown, SegmentationResult } from '../types'
import { fmtDuration, fmtNum, fmtPct } from '../analysis/format'
import { Bar, Section } from './primitives'

function BreakdownList({ title, rows, empty }: { title: string; rows: Breakdown[]; empty: string }) {
  const max = Math.max(...rows.map((r) => r.users), 1)
  return (
    <div className="seg-card">
      <div className="eyebrow">{title}</div>
      {rows.length === 0 ? (
        <div className="empty-note sm">{empty}</div>
      ) : (
        <ul className="seg-bars">
          {rows.map((r) => (
            <li key={r.key} className="seg-bar-row">
              <span className="seg-bar-label">{r.label}</span>
              <span className="seg-bar-track">
                <span className="seg-bar-fill" style={{ width: `${(r.users / max) * 100}%` }} />
              </span>
              <span className="mono seg-bar-val">{fmtNum(r.users)}</span>
              <span className="mono seg-bar-pct">{fmtPct(r.share)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function Segmentation({ s }: { s: SegmentationResult }) {
  const maxAdopt = Math.max(...s.features.map((f) => f.users), 1)
  return (
    <Section
      id="sec-segmentation"
      eyebrow="Segmentation"
      title="Who, where, which version, which features"
      sub="Geography and language, per-version health (to catch bad releases), feature adoption, power-user distribution, and sessions."
    >
      <div className="seg-grid">
        <BreakdownList title="Geography" rows={s.geo} empty="No country property found." />
        <BreakdownList title="Language" rows={s.language} empty="No language property found." />

        <div className="seg-card">
          <div className="eyebrow">Power-user distribution</div>
          <ul className="seg-bars">
            {s.power.buckets.map((b) => {
              const max = Math.max(...s.power.buckets.map((x) => x.users), 1)
              return (
                <li key={b.label} className="seg-bar-row">
                  <span className="seg-bar-label">{b.label}</span>
                  <span className="seg-bar-track">
                    <span
                      className="seg-bar-fill"
                      style={{ width: `${(b.users / max) * 100}%`, background: 'var(--signal)' }}
                    />
                  </span>
                  <span className="mono seg-bar-val">{fmtNum(b.users)}</span>
                </li>
              )
            })}
          </ul>
          <div className="seg-foot mono">
            {fmtPct(s.power.oneAndDoneShare)} one-and-done · {fmtPct(s.power.powerUserShare)} power ·
            median {fmtNum(s.power.medianEventsPerUser)} events/user
          </div>
        </div>

        <div className="seg-card">
          <div className="eyebrow">Sessions</div>
          {s.sessions.available ? (
            <div className="session-stats">
              <div className="eng-row">
                <span>Users with sessions</span>
                <span className="mono">{fmtNum(s.sessions.users)}</span>
              </div>
              <div className="eng-row">
                <span>Median session count</span>
                <span className="mono">
                  {s.sessions.medianSessionCount != null ? fmtNum(s.sessions.medianSessionCount) : '—'}
                </span>
              </div>
              <div className="eng-row">
                <span>Median duration</span>
                <span className="mono">
                  {s.sessions.medianDurationSec != null ? fmtDuration(s.sessions.medianDurationSec) : '—'}
                </span>
              </div>
            </div>
          ) : (
            <div className="empty-note sm">No session_count / session_duration fields present.</div>
          )}
        </div>
      </div>

      <div className="seg-wide">
        <div className="seg-card">
          <div className="eyebrow">Version health</div>
          {s.versions.length === 0 ? (
            <div className="empty-note sm">No version property found.</div>
          ) : (
            <div className="table-scroll">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Version</th>
                    <th className="num">Users</th>
                    <th className="num">Error rate</th>
                    <th className="num">Churn rate</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {s.versions.map((v) => (
                    <tr key={v.version} className={v.suspect ? 'row-suspect' : ''}>
                      <td className="mono">{v.version}</td>
                      <td className="num">{fmtNum(v.users)}</td>
                      <td className="num" style={{ color: v.errorRate > 0.05 ? 'var(--neg)' : undefined }}>
                        {fmtPct(v.errorRate)}
                      </td>
                      <td className="num" style={{ color: v.churnRate > 0.3 ? 'var(--neg)' : undefined }}>
                        {fmtPct(v.churnRate)}
                      </td>
                      <td>{v.suspect && <span className="pill-passive">bad release?</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="seg-card">
          <div className="eyebrow">Feature adoption (% of users reaching each)</div>
          {s.features.length === 0 ? (
            <div className="empty-note sm">No feature-like events detected.</div>
          ) : (
            <ul className="seg-bars">
              {s.features.map((f) => (
                <li key={f.event} className="seg-bar-row">
                  <span className="seg-bar-label mono">{f.event}</span>
                  <span className="seg-bar-track">
                    <span
                      className="seg-bar-fill"
                      style={{ width: `${(f.users / maxAdopt) * 100}%`, background: 'var(--cyan)' }}
                    />
                  </span>
                  <span className="mono seg-bar-pct">{fmtPct(f.adoption)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Section>
  )
}
