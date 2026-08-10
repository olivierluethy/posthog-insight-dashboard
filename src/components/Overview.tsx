import type { DataCompleteness, KpiSummary } from '../types'
import type { DiffRow } from '../state/history'
import { fmtDayFull, fmtNum, fmtPct } from '../analysis/format'
import { Section, Sparkline, StatTile } from './primitives'

export function Overview({
  kpis,
  completeness,
  diff,
}: {
  kpis: KpiSummary
  completeness: DataCompleteness
  diff?: Map<string, DiffRow>
}) {
  const dau = kpis.dauSeries.map((p) => p.v)
  const d = (label: string) => diff?.get(label)?.deltaPct ?? null

  return (
    <Section
      id="sec-overview"
      eyebrow="Overview"
      title="KPIs"
      sub={
        <>
          {fmtDayFull(kpis.dateFrom)} → {fmtDayFull(kpis.dateTo)} · {kpis.spanDays} day span ·{' '}
          data completeness {fmtPct(kpis.completeness)}
          {completeness.droppedRows > 0 && (
            <> · {fmtNum(completeness.droppedRows)} rows dropped (missing event/timestamp)</>
          )}
        </>
      }
    >
      <div className="kpi-grid">
        <StatTile label="Unique users" value={fmtNum(kpis.uniqueUsers)} delta={d('Unique users')} />
        <StatTile label="New users" value={fmtNum(kpis.newUsers)} delta={d('New users')} />
        <StatTile
          label="Active users / day"
          value={fmtNum(Math.round(kpis.avgDau))}
          delta={d('Avg DAU')}
          sparkline={<Sparkline points={dau} />}
        />
        <StatTile label="Total events" value={fmtNum(kpis.totalEvents)} delta={d('Total events')} hint="floor" />
        <StatTile label="Events / day" value={fmtNum(Math.round(kpis.avgEventsPerDay))} />
        <StatTile label="Event types" value={fmtNum(kpis.distinctEventTypes)} />
        <StatTile label="Installs" value={fmtNum(kpis.installs)} delta={d('Installs')} />
        <StatTile
          label="Uninstalls"
          value={fmtNum(kpis.uninstalls)}
          delta={d('Uninstalls')}
          higherIsBetter={false}
        />
      </div>
      {completeness.notes.length > 0 && (
        <ul className="completeness-notes">
          {completeness.notes.map((n, i) => (
            <li key={i}>{n}</li>
          ))}
        </ul>
      )}
    </Section>
  )
}
