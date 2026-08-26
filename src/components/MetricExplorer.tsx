import { useMemo, useState } from 'react'
import type { MetricKey, MetricMatrix, MetricSeries } from '../types'
import { correlationStrength, relate } from '../analysis/goals'
import { fmtDayFull, fmtNum } from '../analysis/format'
import { MultiSeriesChart, type OverlaySeries } from './charts'
import { Section, StatTile } from './primitives'

type View = 'daily' | 'cumulative'

/** Build one CSV of the aligned daily matrix (date + per-day and running-total
 *  columns for every metric) and hand it to the browser as a download. Excel and
 *  Sheets both open CSV directly, so this satisfies the "export to Excel" story
 *  without any binary-format dependency — and it works from file://. */
function exportMatrixCsv(matrix: MetricMatrix): void {
  const head = ['date']
  for (const s of matrix.series) {
    head.push(`${s.label} (daily)`, `${s.label} (total)`)
  }
  const lines = [head.join(',')]
  matrix.days.forEach((t, i) => {
    const cells = [fmtDayFull(t)]
    for (const s of matrix.series) {
      cells.push(String(s.daily[i]?.v ?? 0), String(s.cumSeries[i]?.v ?? 0))
    }
    lines.push(cells.join(','))
  })
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'signal-desk-metrics.csv'
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

export function MetricExplorer({ m }: { m: MetricMatrix }) {
  const byKey = useMemo(() => new Map(m.series.map((s) => [s.key, s])), [m.series])
  // Default to the install/uninstall pair — the relationship the issue calls out.
  const initial = m.series.filter((s) => s.key === 'installs' || s.key === 'uninstalls')
  const [selected, setSelected] = useState<MetricKey[]>(
    (initial.length ? initial : m.series.slice(0, 2)).map((s) => s.key),
  )
  const [view, setView] = useState<View>('daily')
  const [normalize, setNormalize] = useState(true)

  const active = selected.map((k) => byKey.get(k)).filter(Boolean) as MetricSeries[]

  const toggle = (k: MetricKey) =>
    setSelected((prev) => (prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k]))

  const overlay: OverlaySeries[] = active.map((s) => ({
    key: s.key,
    label: s.label,
    color: s.color,
    points: view === 'daily' ? s.daily : s.cumSeries,
  }))

  // Relate the first selected metric (the anchor) to each other selected one.
  const anchor = active[0]
  const relationships = anchor ? active.slice(1).map((b) => relate(anchor, b)) : []

  return (
    <Section
      id="sec-metrics"
      eyebrow="Metric Explorer"
      title="Compare & relate any metrics"
      sub="Overlay any of the core product metrics on one shared day axis to spot relationships — installs vs uninstalls, events vs users, errors vs activity. Normalise to compare shapes across very different magnitudes."
      right={
        <div className="section-controls">
          <div className="seg-toggle">
            <button className={view === 'daily' ? 'seg on' : 'seg'} onClick={() => setView('daily')}>
              Per day
            </button>
            <button
              className={view === 'cumulative' ? 'seg on' : 'seg'}
              onClick={() => setView('cumulative')}
            >
              Cumulative
            </button>
          </div>
          <button
            className={normalize ? 'seg-toggle-btn on' : 'seg-toggle-btn'}
            onClick={() => setNormalize((v) => !v)}
            title="Rescale each series to 0–100% of its own peak"
          >
            Normalise
          </button>
          <button className="btn" onClick={() => exportMatrixCsv(m)}>
            ↓ Export CSV
          </button>
        </div>
      }
    >
      <div className="series-tabs">
        {m.series.map((s) => {
          const on = selected.includes(s.key)
          return (
            <button
              key={s.key}
              className={on ? 'series-tab on' : 'series-tab'}
              style={on ? { borderColor: s.color, color: s.color } : undefined}
              onClick={() => toggle(s.key)}
            >
              <span className="series-dot" style={{ background: s.color }} />
              {s.label}
            </button>
          )
        })}
      </div>

      {active.length === 0 ? (
        <div className="empty-note">Select one or more metrics above to plot them.</div>
      ) : (
        <>
          <MultiSeriesChart series={overlay} bucketMs={86_400_000} normalize={normalize} />

          <div className="kpi-grid metric-tiles">
            {active.map((s) => (
              <StatTile
                key={s.key}
                label={s.label}
                value={fmtNum(s.cumulative ? s.total : s.current)}
                hint={
                  <>
                    {fmtNum(Math.round(s.ratePerWeek))}/wk · peak {fmtNum(s.peakDaily)} · R²{' '}
                    {s.r2.toFixed(2)}
                  </>
                }
              />
            ))}
          </div>

          {relationships.length > 0 && (
            <div className="rel-block">
              <div className="eyebrow">Relationships vs {anchor.label.toLowerCase()}</div>
              <table className="tbl rel-table">
                <thead>
                  <tr>
                    <th>Metric</th>
                    <th className="num">Correlation</th>
                    <th className="num">{anchor.label} per unit</th>
                    <th className="num">Per {anchor.label.toLowerCase()}</th>
                  </tr>
                </thead>
                <tbody>
                  {relationships.map((r) => (
                    <tr key={r.b.key}>
                      <td>
                        <span className="series-dot" style={{ background: r.b.color }} /> {r.b.label}
                      </td>
                      <td className="num mono">
                        {Number.isFinite(r.correlation) ? r.correlation.toFixed(2) : '–'}
                        <span className="rel-strength"> {correlationStrength(r.correlation)}</span>
                      </td>
                      <td className="num mono">{Number.isFinite(r.ratioAB) ? fmtNum(r.ratioAB) : '–'}</td>
                      <td className="num mono">{Number.isFinite(r.ratioBA) ? fmtNum(r.ratioBA) : '–'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="seg-foot">
                Correlation is on the per-day series (−1…+1). Ratios use whole-range totals — e.g.
                events per user, installs per uninstall.
              </div>
            </div>
          )}
        </>
      )}
    </Section>
  )
}
