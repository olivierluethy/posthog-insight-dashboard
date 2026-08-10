import type { Insight, Severity } from '../types'
import { Section, SeverityBadge } from './primitives'

const SEV_COLOR: Record<Severity, string> = {
  critical: 'var(--sev-critical)',
  high: 'var(--sev-high)',
  medium: 'var(--sev-medium)',
  low: 'var(--sev-low)',
  info: 'var(--sev-info)',
}

const MODULE_TARGET: Record<string, string> = {
  timeseries: 'sec-timeseries',
  retention: 'sec-retention',
  errors: 'sec-errors',
  segmentation: 'sec-segmentation',
  frequency: 'sec-frequency',
  forecast: 'sec-forecast',
  overview: 'sec-overview',
}

export function InsightsPanel({ insights }: { insights: Insight[] }) {
  const counts = insights.reduce<Record<string, number>>((acc, i) => {
    acc[i.severity] = (acc[i.severity] ?? 0) + 1
    return acc
  }, {})

  return (
    <Section
      id="sec-insights"
      eyebrow="Headline output"
      title="Auto-Insights"
      sub="Ranked findings synthesised across every module — what changed, what's hurting users, and what to do next."
      accent
      right={
        <div className="insight-legend">
          {(['critical', 'high', 'medium', 'low', 'info'] as Severity[])
            .filter((s) => counts[s])
            .map((s) => (
              <span key={s} className="insight-legend-item">
                <span className="dot" style={{ background: SEV_COLOR[s] }} /> {counts[s]} {s}
              </span>
            ))}
        </div>
      }
    >
      {insights.length === 0 ? (
        <div className="empty-note">No notable findings — the export looks steady.</div>
      ) : (
        <ol className="insight-list">
          {insights.map((i) => {
            const target = MODULE_TARGET[i.module]
            return (
              <li key={i.id} className="insight-card" style={{ ['--sev' as string]: SEV_COLOR[i.severity] }}>
                <div className="insight-top">
                  <SeverityBadge severity={i.severity} />
                  <h3 className="insight-title">{i.title}</h3>
                </div>
                <p className="insight-detail">{i.detail}</p>
                <div className="insight-action">
                  <span className="insight-action-arrow" aria-hidden>
                    →
                  </span>
                  <span>{i.suggestedAction}</span>
                  {target && (
                    <a className="insight-jump" href={`#${target}`}>
                      view section
                    </a>
                  )}
                </div>
              </li>
            )
          })}
        </ol>
      )}
    </Section>
  )
}
