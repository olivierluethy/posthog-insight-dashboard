import { useMemo, useState } from 'react'
import type { MetricKey, MetricMatrix } from '../types'
import {
  evaluateGoal,
  feasible as termFeasible,
  reachableAtRate,
  whatIf,
  type TermInput,
} from '../analysis/goals'
import { nextMilestone } from '../analysis/forecast'
import { DAY_MS } from '../analysis/stats'
import { fmtDayFull, fmtNum } from '../analysis/format'
import { ProjectionChart } from './charts'
import { Section } from './primitives'

interface Term extends TermInput {
  id: number
}

let nextId = 1

/** Parse a yyyy-mm-dd input as a UTC day start, matching the engine's UTC axis. */
function parseDeadline(v: string): number | null {
  if (!v) return null
  const [y, m, d] = v.split('-').map(Number)
  if (!y || !m || !d) return null
  return Date.UTC(y, m - 1, d)
}

function fmtRate(n: number): string {
  if (!Number.isFinite(n)) return '∞'
  return String(Math.round(n * 10) / 10)
}

const WHATIF_STEPS = [0.5, 1, 1.25, 1.5, 2, 3, 5]

export function GoalLab({ m }: { m: MetricMatrix }) {
  const byKey = useMemo(() => new Map(m.series.map((s) => [s.key, s])), [m.series])
  const seed = m.series.find((s) => s.key === 'activeUsers') ?? m.series[0]
  const [terms, setTerms] = useState<Term[]>(() =>
    seed ? [{ id: nextId++, metricKey: seed.key, target: nextMilestone(seed.current) }] : [],
  )
  const [deadline, setDeadline] = useState('')
  const [multiplier, setMultiplier] = useState(1)

  const deadlineT = parseDeadline(deadline)
  const verdict = useMemo(
    () =>
      evaluateGoal(
        m,
        terms.map((t) => ({ metricKey: t.metricKey, target: t.target })),
        deadlineT,
      ),
    [m, terms, deadlineT],
  )

  const setTerm = (id: number, patch: Partial<TermInput>) =>
    setTerms((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)))
  const removeTerm = (id: number) => setTerms((prev) => prev.filter((t) => t.id !== id))
  const addTerm = () => {
    const used = new Set(terms.map((t) => t.metricKey))
    const free = m.series.find((s) => !used.has(s.key)) ?? m.series[0]
    if (free) setTerms((prev) => [...prev, { id: nextId++, metricKey: free.key, target: nextMilestone(free.current) }])
  }

  const primary = verdict?.terms[0] ?? null
  const primarySeries = primary ? byKey.get(primary.metricKey) : null
  const primaryPoints = primarySeries
    ? primarySeries.cumulative
      ? primarySeries.cumSeries
      : primarySeries.daily
    : []

  const verdictClass = verdict
    ? verdict.feasible
      ? 'eta-good'
      : verdict.reachable && deadlineT == null
        ? 'eta-good'
        : 'eta-bad'
    : 'eta-bad'

  return (
    <Section
      id="sec-goals"
      eyebrow="Goal Lab"
      title="Is the goal achievable — and when?"
      sub="Set a target on one or more metrics (a compound goal), optionally with a deadline. Signal Desk projects the current trend, tells you whether it lands in time, explains what blocks it, and what pace would get you there."
      accent
      right={
        <button className="btn btn-primary" onClick={addTerm}>
          + Add metric
        </button>
      }
    >
      <div className="goal-terms">
        {terms.map((t) => {
          const s = byKey.get(t.metricKey)
          const res = verdict?.terms.find((r) => r.metricKey === t.metricKey)
          return (
            <div key={t.id} className="goal-term">
              <div className="goal-term-head">
                <select
                  className="input"
                  value={t.metricKey}
                  onChange={(e) => setTerm(t.id, { metricKey: e.target.value as MetricKey })}
                >
                  {m.series.map((mm) => (
                    <option key={mm.key} value={mm.key}>
                      {mm.label}
                    </option>
                  ))}
                </select>
                <span className="goal-term-reach">reach</span>
                <input
                  className="input mono goal-target"
                  type="number"
                  min={0}
                  value={t.target}
                  onChange={(e) => setTerm(t.id, { target: Math.max(0, Number(e.target.value) || 0) })}
                />
                {terms.length > 1 && (
                  <button className="goal-remove" onClick={() => removeTerm(t.id)} title="Remove metric">
                    ×
                  </button>
                )}
              </div>
              {res && s && (
                <div className="goal-term-stats">
                  <span>
                    now <b className="mono">{fmtNum(res.current)}</b>
                  </span>
                  <span>
                    gap <b className="mono">{res.alreadyReached ? '0' : fmtNum(res.gap)}</b>
                  </span>
                  <span>
                    rate <b className="mono">{fmtRate(res.ratePerDay)}/day</b>
                  </span>
                  <span>
                    {res.alreadyReached ? (
                      <b className="mono goal-ok">reached</b>
                    ) : res.etaT != null ? (
                      <>
                        ETA <b className="mono">{fmtDayFull(res.etaT)}</b>
                        {res.daysToTarget != null && (
                          <span className="goal-days"> ({Math.ceil(res.daysToTarget)}d)</span>
                        )}
                      </>
                    ) : (
                      <b className="mono goal-bad">never at rate</b>
                    )}
                  </span>
                  {deadlineT != null && !res.alreadyReached && res.requiredRatePerDay != null && (
                    <span className={termFeasible(res) ? 'goal-ok' : 'goal-bad'}>
                      needs <b className="mono">{fmtRate(res.requiredRatePerDay)}/day</b>
                      {res.requiredMultiple != null && Number.isFinite(res.requiredMultiple) && (
                        <span className="goal-days"> ({fmtRate(res.requiredMultiple)}×)</span>
                      )}
                    </span>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="goal-controls">
        <label className="goal-deadline">
          <span className="eyebrow">Deadline (optional)</span>
          <input
            className="input mono"
            type="date"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
          />
        </label>
        {deadline && (
          <button className="btn" onClick={() => setDeadline('')}>
            Clear deadline
          </button>
        )}
      </div>

      {verdict && (
        <div className={'eta-banner ' + verdictClass}>
          {verdict.feasible ? (
            <>
              <b>Achievable{deadlineT != null ? ' in time' : ''}.</b>{' '}
              {verdict.overallEtaT != null ? (
                <>
                  {verdict.compound ? 'All targets are' : 'The target is'} met around{' '}
                  <b>{fmtDayFull(verdict.overallEtaT)}</b>
                  {verdict.overallDaysToTarget != null &&
                    ` — about ${Math.ceil(verdict.overallDaysToTarget)} days out`}{' '}
                  at the current trend.
                </>
              ) : (
                'Every target is already reached.'
              )}
            </>
          ) : verdict.reachable && deadlineT != null ? (
            <>
              <b>Reachable, but not by the deadline.</b> At the current trend the goal lands around{' '}
              {verdict.overallEtaT != null ? <b>{fmtDayFull(verdict.overallEtaT)}</b> : 'never'}, past{' '}
              {fmtDayFull(deadlineT)}.
            </>
          ) : (
            <>
              <b>Not achievable at the current trend.</b> {verdict.blockers[0] ?? ''}
            </>
          )}
        </div>
      )}

      {verdict && (verdict.blockers.length > 0 || verdict.requirements.length > 0) && (
        <div className="goal-explain">
          {verdict.blockers.length > 0 && (
            <div className="goal-explain-col">
              <div className="eyebrow">Why it's blocked</div>
              <ul className="goal-list goal-list-bad">
                {verdict.blockers.map((b, i) => (
                  <li key={i}>{b}</li>
                ))}
              </ul>
            </div>
          )}
          {verdict.requirements.length > 0 && (
            <div className="goal-explain-col">
              <div className="eyebrow">What it would take</div>
              <ul className="goal-list goal-list-ok">
                {verdict.requirements.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {primary && primarySeries && (
        <div className="goal-scenario">
          <div className="goal-scenario-head">
            <div className="eyebrow">What-if — pace on {primarySeries.label.toLowerCase()}</div>
            <div className="seg-toggle">
              {WHATIF_STEPS.map((x) => (
                <button
                  key={x}
                  className={multiplier === x ? 'seg on' : 'seg'}
                  onClick={() => setMultiplier(x)}
                >
                  {x}×
                </button>
              ))}
            </div>
          </div>
          {(() => {
            const w = whatIf(primary, multiplier, m.endT)
            return (
              <div className="goal-scenario-out">
                {primary.alreadyReached ? (
                  <span className="goal-ok">Already reached — pace change has no effect.</span>
                ) : w.etaT != null ? (
                  <>
                    At <b className="mono">{multiplier}×</b> the current pace (
                    <b className="mono">{fmtRate(w.scenarioRatePerDay)}/day</b>), {primarySeries.label.toLowerCase()}{' '}
                    reaches <b className="mono">{fmtNum(primary.target)}</b> around{' '}
                    <b className="mono">{fmtDayFull(w.etaT)}</b>
                    {w.daysToTarget != null && ` (${Math.ceil(w.daysToTarget)} days out)`}
                    {w.meetsDeadline != null && (
                      <span className={w.meetsDeadline ? 'goal-ok' : 'goal-bad'}>
                        {' '}
                        — {w.meetsDeadline ? 'meets the deadline' : 'still misses the deadline'}
                      </span>
                    )}
                    .
                  </>
                ) : (
                  <span className="goal-bad">
                    Even at {multiplier}× the pace the rate is not positive, so the target never arrives.
                  </span>
                )}
              </div>
            )
          })()}
          <ProjectionChart
            points={primaryPoints}
            color={primarySeries.color}
            current={primary.current}
            ratePerDay={primary.ratePerDay * multiplier}
            target={primary.target}
            etaT={whatIf(primary, multiplier, m.endT).etaT}
            fromT={m.endT}
            deadlineT={deadlineT}
            requiredRatePerDay={primary.requiredRatePerDay}
          />
          <div className="seg-foot">
            Projection is a naive linear extrapolation of the current rate — a guide, not a promise.
            The green line is the pace needed to hit the target by the deadline.
            {reachableAtRate(primary) ? '' : ' The metric is flat or declining at its current trend.'}
          </div>
        </div>
      )}
    </Section>
  )
}
