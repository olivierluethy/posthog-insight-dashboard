import { useState } from 'react'
import type { ClassifierConfig, EventCategory, EventClass } from '../types'
import { fmtFactor, fmtNum } from '../analysis/format'
import { Section } from './primitives'

const CATEGORIES: EventCategory[] = ['generic', 'install', 'uninstall', 'error', 'session', 'passive']

export function AdvancedPanel({
  classes,
  config,
  onApply,
  busy,
}: {
  classes: EventClass[]
  config: ClassifierConfig
  onApply: (c: ClassifierConfig) => void
  busy: boolean
}) {
  const [open, setOpen] = useState(false)
  const [overrides, setOverrides] = useState<Record<string, EventCategory>>(config.overrides)
  const [threshold, setThreshold] = useState<number>(config.passiveRatioThreshold)

  const dirty =
    threshold !== config.passiveRatioThreshold ||
    JSON.stringify(overrides) !== JSON.stringify(config.overrides)

  const setOverride = (event: string, auto: EventCategory, value: EventCategory) => {
    setOverrides((prev) => {
      const next = { ...prev }
      if (value === auto) delete next[event]
      else next[event] = value
      return next
    })
  }

  const apply = () => onApply({ passiveRatioThreshold: threshold, overrides })
  const reset = () => {
    setOverrides({})
    setThreshold(20)
    onApply({ passiveRatioThreshold: 20, overrides: {} })
  }

  return (
    <Section
      id="sec-advanced"
      eyebrow="Advanced"
      title="Event classification"
      sub="Auto-detected and product-agnostic. Correct any misclassification here — the whole report re-runs against your mapping."
      right={
        <button className="btn" onClick={() => setOpen((o) => !o)}>
          {open ? 'Hide' : 'Show'} classifier
        </button>
      }
    >
      {open && (
        <>
          <div className="advanced-controls">
            <label className="forecast-target">
              <span className="eyebrow">Passive / over-firing ratio (events ÷ users ≥)</span>
              <input
                className="input mono"
                type="number"
                min={2}
                step={1}
                value={threshold}
                onChange={(e) => setThreshold(Math.max(2, Number(e.target.value) || 20))}
              />
            </label>
            <div className="advanced-actions">
              <button className="btn" onClick={reset} disabled={busy}>
                Reset to auto
              </button>
              <button className="btn btn-primary" onClick={apply} disabled={!dirty || busy}>
                {busy ? 'Re-analysing…' : 'Apply & re-run'}
              </button>
            </div>
          </div>

          <div className="table-scroll advanced-table">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Event</th>
                  <th className="num">Reach</th>
                  <th className="num">Total</th>
                  <th className="num">Per user</th>
                  <th>Auto</th>
                  <th>Classify as</th>
                </tr>
              </thead>
              <tbody>
                {classes.slice(0, 60).map((c) => {
                  const current = overrides[c.event] ?? c.autoCategory
                  return (
                    <tr key={c.event} className={overrides[c.event] ? 'row-overridden' : ''}>
                      <td className="mono event-name">{c.event}</td>
                      <td className="num">{fmtNum(c.reach)}</td>
                      <td className="num">{fmtNum(c.total)}</td>
                      <td className="num">{fmtFactor(c.volumeReachRatio)}</td>
                      <td>
                        <span className="cat-chip">{c.autoCategory}</span>
                      </td>
                      <td>
                        <select
                          className="input"
                          value={current}
                          onChange={(e) => setOverride(c.event, c.autoCategory, e.target.value as EventCategory)}
                        >
                          {CATEGORIES.map((cat) => (
                            <option key={cat} value={cat}>
                              {cat}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Section>
  )
}
