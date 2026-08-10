export function Header({ onReset, hasData }: { onReset?: () => void; hasData?: boolean }) {
  return (
    <header className="app-header">
      <div className="app-header-inner">
        <div className="brand">
          <span className="brand-mark" aria-hidden>
            <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
              <path
                d="M1 15 L6 15 L9 5 L13 21 L17 11 L20 15 L25 15"
                stroke="var(--signal)"
                strokeWidth="2"
                strokeLinejoin="round"
                strokeLinecap="round"
                style={{ filter: 'var(--glow-signal)' }}
              />
            </svg>
          </span>
          <div>
            <div className="brand-name">Signal Desk</div>
            <div className="brand-tag">PostHog insight dashboard</div>
          </div>
        </div>
        <div className="header-right">
          <span className="privacy-pill" title="No backend, no upload, no network calls.">
            <span className="privacy-dot" /> 100% local — nothing leaves your machine
          </span>
          {hasData && onReset && (
            <button className="btn" onClick={onReset}>
              Load another export
            </button>
          )}
        </div>
      </div>
      <div className="scanline" aria-hidden />
    </header>
  )
}
