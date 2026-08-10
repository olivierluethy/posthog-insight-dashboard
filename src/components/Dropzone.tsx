import { useRef, useState } from 'react'

export function Dropzone({ onFile }: { onFile: (file: File) => void }) {
  const [drag, setDrag] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const pick = (files: FileList | null) => {
    const f = files?.[0]
    if (f) onFile(f)
  }

  return (
    <div className="dropzone-wrap">
      <div
        className={'dropzone' + (drag ? ' dropzone-active' : '')}
        onDragOver={(e) => {
          e.preventDefault()
          setDrag(true)
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDrag(false)
          pick(e.dataTransfer.files)
        }}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            inputRef.current?.click()
          }
        }}
        role="button"
        tabIndex={0}
        aria-label="Drop a PostHog CSV export here or click to choose a file"
      >
        <div className="dropzone-glyph" aria-hidden>
          <svg width="46" height="46" viewBox="0 0 46 46" fill="none">
            <path
              d="M4 30 L12 30 L16 12 L23 38 L30 20 L34 30 L42 30"
              stroke="var(--signal)"
              strokeWidth="2.5"
              strokeLinejoin="round"
              strokeLinecap="round"
              style={{ filter: 'var(--glow-signal)' }}
            />
          </svg>
        </div>
        <div className="dropzone-title">Drop a PostHog CSV export</div>
        <div className="dropzone-sub">
          or <span className="dropzone-link">choose a file</span> — parsed and analysed entirely in
          your browser
        </div>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          hidden
          onChange={(e) => pick(e.target.files)}
        />
      </div>
      <div className="dropzone-foot">
        <div className="dropzone-foot-item">
          <b>Auto-report.</b> KPIs, anomalies, churn, errors, forecasts — no questions asked.
        </div>
        <div className="dropzone-foot-item">
          <b>Product-agnostic.</b> Event structure is detected; nothing is hardcoded.
        </div>
        <div className="dropzone-foot-item">
          <b>Private by design.</b> No server, no upload, no network — even works offline from a
          file.
        </div>
      </div>
    </div>
  )
}
