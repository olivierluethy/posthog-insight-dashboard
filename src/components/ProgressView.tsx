import { fmtNum } from '../analysis/format'

export function ProgressView({
  phase,
  stage,
  pct,
  rows,
  fileName,
  mode,
}: {
  phase: 'parsing' | 'analyzing'
  stage: string
  pct: number
  rows: number
  fileName: string
  mode: 'worker' | 'main-thread' | null
}) {
  return (
    <div className="progress-view panel">
      <div className="eyebrow">{phase === 'parsing' ? 'Reading file' : 'Analysing'}</div>
      <div className="progress-file mono">{fileName}</div>
      <div className="progress-stage">{stage}</div>
      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${Math.round(pct * 100)}%` }} />
      </div>
      <div className="progress-meta mono">
        <span>{Math.round(pct * 100)}%</span>
        <span>{fmtNum(rows)} rows parsed</span>
        {mode && <span className="progress-mode">{mode === 'worker' ? 'worker thread' : 'main thread (fallback)'}</span>}
      </div>
    </div>
  )
}
