interface Cap {
  id: string
  label: string
  hint: string
}

// Ordered to match the dashboard flow; each jumps to its section so the whole
// analytical surface is visible and reachable without scrolling (story #1).
const CAPS: Cap[] = [
  { id: 'sec-insights', label: 'Auto-insights', hint: 'ranked findings + next step' },
  { id: 'sec-overview', label: 'KPIs', hint: 'users, DAU, installs, completeness' },
  { id: 'sec-metrics', label: 'Compare metrics', hint: 'overlay + correlate any two' },
  { id: 'sec-goals', label: 'Goal lab', hint: 'targets, deadlines, what-if' },
  { id: 'sec-frequency', label: 'Event reach', hint: 'unique-user reach, not raw counts' },
  { id: 'sec-timeseries', label: 'Anomalies', hint: 'spikes, dips, change-points' },
  { id: 'sec-retention', label: 'Retention', hint: 'churn journeys + signals' },
  { id: 'sec-errors', label: 'Errors', hint: 'grouped by affected users' },
  { id: 'sec-forecast', label: 'Forecast', hint: 'ETA to a target' },
  { id: 'sec-segmentation', label: 'Segments', hint: 'geo, version, power users' },
]

function jump(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

/** Top-of-page strip: everything the tool can do, visible without scrolling,
 *  each a jump-link to its section. */
export function Capabilities() {
  return (
    <section className="panel capabilities" aria-label="Analytics capabilities">
      <div className="capabilities-head">
        <div className="eyebrow">What you can do here</div>
        <h2 className="panel-title">Analytics &amp; goal analysis</h2>
      </div>
      <div className="capabilities-grid">
        {CAPS.map((c) => (
          <button key={c.id} className="cap-chip" onClick={() => jump(c.id)}>
            <span className="cap-chip-label">{c.label}</span>
            <span className="cap-chip-hint">{c.hint}</span>
          </button>
        ))}
      </div>
    </section>
  )
}
