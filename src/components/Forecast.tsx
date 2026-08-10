import { useMemo, useState } from 'react'
import type { ForecastMetric, ForecastResult } from '../types'
import { computeEta, nextMilestone } from '../analysis/forecast'
import { DAY_MS } from '../analysis/stats'
import { fmtDayFull, fmtNum } from '../analysis/format'
import { ForecastChart } from './charts'
import { Section } from './primitives'

export function Forecast({ f }: { f: ForecastResult }) {
  const [metricKey, setMetricKey] = useState<ForecastMetric['key']>('cumUsers')
  const metric = f.metrics.find((m) => m.key === metricKey) ?? f.metrics[0]
  const [target, setTarget] = useState<number>(() => nextMilestone(metric?.current ?? 0))

  const eta = useMemo(
    () => (metric ? computeEta(metric, target, f.endT) : null),
    [metric, target, f.endT],
  )

  if (!metric) return null

  return (
    <Section
      id="sec-forecast"
      eyebrow="Forecasting"
      title="How long until the target"
      sub="Linear trend on cumulative metrics, extrapolated from the current rate. A naive projection — treat the ETA as a guide, not a promise."
      right={
        <div className="seg-toggle">
          {f.metrics.map((m) => (
            <button
              key={m.key}
              className={m.key === metricKey ? 'seg on' : 'seg'}
              onClick={() => setMetricKey(m.key)}
            >
              {m.key === 'cumUsers' ? 'Users' : m.key === 'cumInstalls' ? 'Installs' : 'Net growth'}
            </button>
          ))}
        </div>
      }
    >
      <div className="forecast-controls">
        <label className="forecast-target">
          <span className="eyebrow">Target {metric.label.toLowerCase()}</span>
          <input
            className="input mono"
            type="number"
            min={0}
            value={target}
            onChange={(ev) => setTarget(Math.max(0, Number(ev.target.value) || 0))}
          />
        </label>
        <div className="forecast-stats">
          <div>
            <div className="eyebrow">Current</div>
            <div className="mono big-num">{fmtNum(metric.current)}</div>
          </div>
          <div>
            <div className="eyebrow">Rate / day</div>
            <div className="mono big-num">{fmtNum(Math.round(metric.ratePerDay * 10) / 10)}</div>
          </div>
          <div>
            <div className="eyebrow">Rate / week</div>
            <div className="mono big-num">{fmtNum(Math.round(metric.ratePerWeek))}</div>
          </div>
          <div>
            <div className="eyebrow">Fit R²</div>
            <div className="mono big-num">{metric.r2.toFixed(2)}</div>
          </div>
        </div>
      </div>

      <div className={'eta-banner ' + (eta?.neverAtCurrentRate ? 'eta-bad' : 'eta-good')}>
        {eta?.alreadyReached ? (
          <>
            <b>Already there.</b> {metric.label} is at {fmtNum(metric.current)}, past your target of{' '}
            {fmtNum(target)}.
          </>
        ) : eta?.neverAtCurrentRate ? (
          <>
            <b>Not at this rate.</b> The trend is flat or declining, so {fmtNum(target)} isn't
            reachable without changing the growth rate.
          </>
        ) : eta?.etaT != null ? (
          <>
            <b>ETA {fmtDayFull(eta.etaT)}</b> — about {Math.ceil((eta.etaT - f.endT) / DAY_MS)} days
            out, reaching {fmtNum(target)} at the current {fmtNum(Math.round(metric.ratePerDay * 10) / 10)}/day.
          </>
        ) : null}
      </div>

      <ForecastChart metric={metric} target={target} etaT={eta?.etaT ?? null} />
    </Section>
  )
}
