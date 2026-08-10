import type { RunSnapshot } from '../types'
import type { DiffRow } from '../state/history'
import { computeDiff } from '../state/history'
import { fmtNum, fmtPct } from '../analysis/format'
import { DeltaChip, Section } from './primitives'

function fmtVal(r: DiffRow, v: number) {
  return r.format === 'pct' ? fmtPct(v) : fmtNum(v)
}

export function HistoryDiff({
  current,
  previous,
  runCount,
  onClear,
}: {
  current: RunSnapshot
  previous: RunSnapshot | null
  runCount: number
  onClear: () => void
}) {
  const rows = previous ? computeDiff(current, previous) : []
  return (
    <Section
      id="sec-history"
      eyebrow="Run history"
      title="Since last upload"
      sub={
        previous ? (
          <>
            Compared against <span className="mono">{previous.fileName}</span> · {runCount} runs stored
            locally
          </>
        ) : (
          <>First run stored — drop a newer export next time to see week-over-week deltas.</>
        )
      }
      right={
        runCount > 0 ? (
          <button className="btn" onClick={onClear}>
            Clear history
          </button>
        ) : undefined
      }
    >
      {previous ? (
        <div className="diff-grid">
          {rows.map((r) => (
            <div key={r.label} className="diff-cell">
              <div className="eyebrow">{r.label}</div>
              <div className="diff-values">
                <span className="mono diff-current">{fmtVal(r, r.current)}</span>
                <DeltaChip value={r.deltaPct} higherIsBetter={r.higherIsBetter} />
              </div>
              <div className="diff-prev mono">was {fmtVal(r, r.previous)}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-note">
          Nothing to compare yet. This snapshot was saved to IndexedDB; your next drop will diff
          against it.
        </div>
      )}
    </Section>
  )
}
