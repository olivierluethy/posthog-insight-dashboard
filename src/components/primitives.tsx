import type { ReactNode } from 'react'
import type { Severity } from '../types'
import { fmtNum, fmtSignedPct } from '../analysis/format'

export const CAT = ['--cat-1', '--cat-2', '--cat-3', '--cat-4', '--cat-5', '--cat-6', '--cat-7', '--cat-8']
export const catColor = (i: number) => `var(${CAT[i % CAT.length]})`

const SEV_COLOR: Record<Severity, string> = {
  critical: 'var(--sev-critical)',
  high: 'var(--sev-high)',
  medium: 'var(--sev-medium)',
  low: 'var(--sev-low)',
  info: 'var(--sev-info)',
}

export function SeverityBadge({ severity }: { severity: Severity }) {
  const c = SEV_COLOR[severity]
  return (
    <span
      className="badge"
      style={{ color: c, background: `color-mix(in srgb, ${c} 15%, transparent)` }}
    >
      {severity}
    </span>
  )
}

export function Section({
  id,
  eyebrow,
  title,
  sub,
  right,
  accent,
  children,
}: {
  id?: string
  eyebrow: string
  title: string
  sub?: ReactNode
  right?: ReactNode
  accent?: boolean
  children: ReactNode
}) {
  return (
    <section id={id} className={'panel section' + (accent ? ' section-accent' : '')}>
      <div className="panel-header">
        <div>
          <div className="eyebrow">{eyebrow}</div>
          <h2 className="panel-title">{title}</h2>
          {sub && <div className="panel-sub">{sub}</div>}
        </div>
        {right && <div className="section-controls">{right}</div>}
      </div>
      {children}
    </section>
  )
}

export function StatTile({
  label,
  value,
  hint,
  delta,
  higherIsBetter = true,
  sparkline,
  big,
}: {
  label: string
  value: ReactNode
  hint?: ReactNode
  delta?: number | null
  higherIsBetter?: boolean
  sparkline?: ReactNode
  big?: boolean
}) {
  return (
    <div className="stat-tile">
      <div className="eyebrow">{label}</div>
      <div className={'stat-value mono' + (big ? ' stat-value-big' : '')}>{value}</div>
      <div className="stat-foot">
        {delta != null && Number.isFinite(delta) ? (
          <DeltaChip value={delta} higherIsBetter={higherIsBetter} />
        ) : (
          hint && <span className="stat-hint">{hint}</span>
        )}
        {sparkline && <span className="stat-spark">{sparkline}</span>}
      </div>
    </div>
  )
}

export function DeltaChip({
  value,
  higherIsBetter = true,
}: {
  value: number | null
  higherIsBetter?: boolean
}) {
  if (value == null || !Number.isFinite(value)) return <span className="delta delta-flat mono">–</span>
  const up = value > 0.0001
  const down = value < -0.0001
  const good = up ? higherIsBetter : down ? !higherIsBetter : true
  const cls = up || down ? (good ? 'delta-good' : 'delta-bad') : 'delta-flat'
  const arrow = up ? '▲' : down ? '▼' : '–'
  return (
    <span className={'delta mono ' + cls}>
      {arrow} {fmtSignedPct(value)}
    </span>
  )
}

/** Inline reach/magnitude bar behind a number. */
export function Bar({ value, max, color = 'var(--cyan)' }: { value: number; max: number; color?: string }) {
  const pct = max > 0 ? Math.max(2, (value / max) * 100) : 0
  return (
    <span className="inlinebar">
      <span className="inlinebar-fill" style={{ width: `${pct}%`, background: color, opacity: 0.28 }} />
      <span className="inlinebar-text mono">{fmtNum(value)}</span>
    </span>
  )
}

/** Small phosphor sparkline (single series). */
export function Sparkline({
  points,
  width = 120,
  height = 28,
  color = 'var(--signal)',
}: {
  points: number[]
  width?: number
  height?: number
  color?: string
}) {
  if (points.length < 2) return <svg width={width} height={height} />
  const max = Math.max(...points, 1)
  const min = Math.min(...points, 0)
  const range = max - min || 1
  const step = width / (points.length - 1)
  const d = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${(i * step).toFixed(1)},${(height - ((p - min) / range) * (height - 4) - 2).toFixed(1)}`)
    .join(' ')
  return (
    <svg width={width} height={height} className="sparkline" aria-hidden>
      <path d={d} fill="none" stroke={color} strokeWidth={1.5} />
    </svg>
  )
}

export function EmptyNote({ children }: { children: ReactNode }) {
  return <div className="empty-note">{children}</div>
}
