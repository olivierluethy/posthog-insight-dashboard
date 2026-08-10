import { useMemo, useState } from 'react'
import type { Granularity, TimeseriesResult } from '../types'
import { fmtFactor } from '../analysis/format'
import { TimeSeriesChart } from './charts'
import { Section } from './primitives'

export function Timeseries({ day, hour }: { day: TimeseriesResult; hour: TimeseriesResult }) {
  const [gran, setGran] = useState<Granularity>('day')
  const ts = gran === 'day' ? day : hour
  const [seriesKey, setSeriesKey] = useState<string>('installs')

  // Derive the effective series so a key missing at this granularity falls back
  // without a setState-in-render.
  const series = ts.series.find((s) => s.key === seriesKey) ?? ts.series[0]
  const seriesAnoms = useMemo(
    () => ts.anomalies.filter((a) => a.event === series?.label),
    [ts, series],
  )
  const seriesCps = useMemo(
    () => ts.changePoints.filter((a) => a.event === series?.label),
    [ts, series],
  )

  const seriesColor =
    series?.category === 'error'
      ? 'var(--neg)'
      : series?.category === 'uninstall'
        ? 'var(--neg)'
        : series?.category === 'install'
          ? 'var(--pos)'
          : 'var(--signal)'

  return (
    <Section
      id="sec-timeseries"
      eyebrow="Time-series & change detection"
      title="From where to where did it change"
      sub="Robust MAD anomalies (>3.5σ) as violet rings; level-shift change-points as dashed rules. Hourly matters for short exports."
      right={
        <div className="seg-toggle">
          <button className={gran === 'day' ? 'seg on' : 'seg'} onClick={() => setGran('day')}>
            Day
          </button>
          <button className={gran === 'hour' ? 'seg on' : 'seg'} onClick={() => setGran('hour')}>
            Hour
          </button>
        </div>
      }
    >
      <div className="series-tabs">
        {ts.series.map((s) => (
          <button
            key={s.key}
            className={'series-tab' + (s.key === seriesKey ? ' on' : '')}
            onClick={() => setSeriesKey(s.key)}
          >
            {s.label}
          </button>
        ))}
      </div>

      {series && (
        <TimeSeriesChart
          points={series.points}
          bucketMs={ts.bucketMs}
          color={seriesColor}
          label={series.label}
          anomalies={seriesAnoms}
          changePoints={seriesCps}
        />
      )}

      <div className="anomaly-cols">
        <div>
          <div className="eyebrow anomaly-head">
            Anomalies ({gran}) · {ts.anomalies.length}
          </div>
          {ts.anomalies.length === 0 ? (
            <div className="empty-note sm">No anomalies at this granularity.</div>
          ) : (
            <ul className="anomaly-list">
              {ts.anomalies.slice(0, 8).map((a, i) => (
                <li key={i} className="anomaly-item">
                  <span
                    className="anomaly-arrow"
                    style={{ color: a.direction === 'higher' ? 'var(--warn)' : 'var(--cyan)' }}
                  >
                    {a.direction === 'higher' ? '▲' : '▼'} {fmtFactor(a.factor)}
                  </span>
                  <span className="anomaly-text">{a.label}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <div className="eyebrow anomaly-head">Change-points · {ts.changePoints.length}</div>
          {ts.changePoints.length === 0 ? (
            <div className="empty-note sm">No sustained level shifts detected.</div>
          ) : (
            <ul className="anomaly-list">
              {ts.changePoints.slice(0, 8).map((a, i) => (
                <li key={i} className="anomaly-item">
                  <span className="anomaly-arrow" style={{ color: 'var(--anomaly)' }}>
                    ⇉
                  </span>
                  <span className="anomaly-text">{a.label}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Section>
  )
}
