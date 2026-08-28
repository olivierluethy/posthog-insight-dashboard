import { useEffect, useState, type ReactNode } from 'react'

/** One entry per dashboard section, in document order. `id` matches the
 *  `id="sec-…"` each Section renders; sections stream in, so items are shown
 *  only once their target exists in the DOM. */
interface NavItem {
  id: string
  label: string
  icon: ReactNode
}

// 16px line icons on currentColor — same phosphor-stroke language as the brand mark.
const I = (d: ReactNode) => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.7"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    {d}
  </svg>
)

const NAV: NavItem[] = [
  { id: 'sec-insights', label: 'Auto-insights', icon: I(<><path d="M9 18h6" /><path d="M10 21h4" /><path d="M12 3a6 6 0 0 0-4 10.5c.6.6 1 1.4 1 2.5h6c0-1.1.4-1.9 1-2.5A6 6 0 0 0 12 3Z" /></>) },
  { id: 'sec-overview', label: 'KPIs', icon: I(<><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>) },
  { id: 'sec-history', label: 'Run diff', icon: I(<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>) },
  { id: 'sec-metrics', label: 'Compare', icon: I(<><path d="M3 17l5-6 4 3 6-8" /><path d="M3 21l5-4 4 2 6-5" opacity=".55" /></>) },
  { id: 'sec-goals', label: 'Goal lab', icon: I(<><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="4" /><circle cx="12" cy="12" r="1" /></>) },
  { id: 'sec-frequency', label: 'Event reach', icon: I(<><path d="M4 20V10" /><path d="M10 20V4" /><path d="M16 20v-7" /><path d="M22 20H2" /></>) },
  { id: 'sec-timeseries', label: 'Anomalies', icon: I(<><path d="M2 13h4l3-7 4 12 3-8 2 3h4" /><circle cx="15" cy="6" r="1.6" /></>) },
  { id: 'sec-retention', label: 'Retention', icon: I(<><path d="M3 6c0 1.7 4 3 9 3s9-1.3 9-3-4-3-9-3-9 1.3-9 3Z" /><path d="M3 6v6c0 1.7 4 3 9 3s9-1.3 9-3V6" /><path d="M3 12v6c0 1.7 4 3 9 3s9-1.3 9-3v-6" /></>) },
  { id: 'sec-errors', label: 'Errors', icon: I(<><path d="M12 3 2 20h20L12 3Z" /><path d="M12 10v4" /><path d="M12 17h.01" /></>) },
  { id: 'sec-forecast', label: 'Forecast', icon: I(<><path d="M3 17l6-6 4 4 8-9" /><path d="M15 6h6v6" /></>) },
  { id: 'sec-segmentation', label: 'Segments', icon: I(<><circle cx="12" cy="12" r="9" /><path d="M12 12V3" /><path d="M12 12l7 5" /></>) },
  { id: 'sec-advanced', label: 'Advanced', icon: I(<><path d="M4 6h16" /><path d="M4 12h16" /><path d="M4 18h16" /><circle cx="9" cy="6" r="2" fill="var(--bg-panel)" /><circle cx="15" cy="12" r="2" fill="var(--bg-panel)" /><circle cx="8" cy="18" r="2" fill="var(--bg-panel)" /></>) },
]

const NAV_IDS = NAV.map((n) => n.id)

/** Measure the sticky header once (and on resize) so jump-scrolls clear it and
 *  the rail parks just below it. Written to a CSS var for the stylesheet. */
function useHeaderHeight() {
  const [h, setH] = useState(68)
  useEffect(() => {
    const header = document.querySelector('.app-header') as HTMLElement | null
    if (!header) return
    const measure = () => {
      const v = header.offsetHeight
      setH(v)
      document.documentElement.style.setProperty('--header-h', `${v}px`)
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(header)
    window.addEventListener('resize', measure)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [])
  return h
}

/** Scroll-spy: reports which sections exist and which one is currently in view.
 *  `signature` changes whenever the set of mounted sections changes (they stream
 *  in), re-collecting the freshly-mounted DOM.
 *
 *  Active = the last section whose top has crossed a single trigger line just
 *  below the header. Reading real positions each frame (rather than reacting to a
 *  wide IntersectionObserver band) means the highlight never skips several
 *  sections at once and always matches what is actually under the line. */
function useScrollSpy(signature: string, headerH: number) {
  const [present, setPresent] = useState<string[]>([])
  const [active, setActive] = useState<string | null>(null)

  useEffect(() => {
    const els = NAV_IDS.map((id) => document.getElementById(id)).filter(
      (el): el is HTMLElement => !!el,
    )
    setPresent(els.map((e) => e.id))
    if (els.length === 0) return

    const line = headerH + 16 // trigger line, in px from the top of the viewport
    let raf = 0

    const compute = () => {
      raf = 0
      // Sections stack vertically, so tops are monotonic in document order:
      // walk down and keep the last one whose top has passed the trigger line.
      let current = els[0].id
      for (const el of els) {
        if (el.getBoundingClientRect().top - line <= 0.5) current = el.id
        else break
      }
      // At the very bottom of the page the last section can never reach the line —
      // force it so the final entry is reachable.
      const atBottom =
        window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2
      if (atBottom) current = els[els.length - 1].id
      setActive(current)
    }

    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(compute)
    }

    compute()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      if (raf) cancelAnimationFrame(raf)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [signature, headerH])

  return { present, active }
}

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true

/** Sticky section navigator. Left rail on wide screens, horizontal strip when
 *  narrow. Highlights the section in view and jumps to any other on click. */
export function QuickNav({ signature }: { signature: string }) {
  const headerH = useHeaderHeight()
  const { present, active } = useScrollSpy(signature, headerH)
  const items = NAV.filter((n) => present.includes(n.id))

  if (items.length < 2) return null // nothing worth navigating yet

  const jump = (id: string) => {
    const el = document.getElementById(id)
    if (!el) return
    const y = el.getBoundingClientRect().top + window.scrollY - headerH - 12
    window.scrollTo({ top: Math.max(0, y), behavior: prefersReducedMotion() ? 'auto' : 'smooth' })
  }

  return (
    <nav className="quick-nav" aria-label="Section navigation">
      <div className="quick-nav-inner">
        <div className="eyebrow quick-nav-title">Jump to</div>
        <ul className="quick-nav-list">
          {items.map((n) => {
            const on = n.id === active
            return (
              <li key={n.id}>
                <button
                  type="button"
                  className={'quick-nav-link' + (on ? ' is-active' : '')}
                  aria-current={on ? 'true' : undefined}
                  onClick={() => jump(n.id)}
                >
                  <span className="quick-nav-icon">{n.icon}</span>
                  <span className="quick-nav-label">{n.label}</span>
                </button>
              </li>
            )
          })}
        </ul>
      </div>
    </nav>
  )
}
