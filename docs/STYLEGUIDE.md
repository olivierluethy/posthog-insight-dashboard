# PostHog Insight Dashboard — Styleguide

> **Single source of truth for the visual system.** Everything built after this file must look
> like it was always part of the product. Colours and type stay as defined here; new sections
> inherit these tokens rather than inventing their own.

## Design concept — "Signal Desk"

A forensic analytics console themed on signal-monitoring hardware (oscilloscope / mission
control). The tool reads *signal out of noise* — anomaly detection, change-points, forecasting —
so the interface is a dark instrument panel where a **phosphor-amber trace on a hairline grid**
is the recurring motif. Information-dense, fast-scanning, monospaced numerics. Distinctive by
committing to the signal-processing metaphor rather than a generic SaaS dashboard, and by
deliberately avoiding the dark + acid-green cliché.

- **Signature element:** the *phosphor trace* — time-series and sparklines render as glowing
  amber lines on a faint dotted grid, with anomalies marked as violet rings and change-points as
  dashed vertical rules. A thin scanline accent sits under the header.
- **Restraint:** boldness lives in the phosphor trace and the KPI numerics. Everything else is
  quiet — hairline borders, flat panels, no gratuitous motion.

## Colour tokens

All colours are exposed as CSS custom properties on `:root`. Dark is the only theme (an analytics
cockpit is a dark room); do not add a light variant.

### Surfaces & structure
| Token | Hex | Use |
|---|---|---|
| `--bg` | `#0B0E14` | App background (deep ink, faint blue) |
| `--bg-panel` | `#131722` | Cards, panels, sections |
| `--bg-panel-2` | `#1A2030` | Raised surfaces, table header, hover |
| `--bg-inset` | `#0E1219` | Inset wells, code, chart backgrounds |
| `--border` | `#232B3B` | Hairline borders (default) |
| `--border-strong` | `#2E3850` | Emphasised dividers, focus rings base |

### Text
| Token | Hex | Use |
|---|---|---|
| `--text` | `#E4E8F1` | Primary text |
| `--text-dim` | `#97A0B5` | Secondary / labels |
| `--text-faint` | `#616B82` | Captions, disabled, axis ticks |

### Signal & semantic
| Token | Hex | Use |
|---|---|---|
| `--signal` | `#F5B942` | **Primary phosphor amber** — traces, primary accent, focus |
| `--signal-dim` | `#8A6A28` | Amber grid/inactive |
| `--cyan` | `#4FC3E8` | Secondary accent, info, links |
| `--pos` | `#46C08D` | Positive / up / retained |
| `--neg` | `#F0555F` | Negative / error / churn / down |
| `--warn` | `#F5883E` | Warning |
| `--anomaly` | `#B98BF0` | Anomaly rings & change-point markers (violet) |

### Severity (Auto-Insights & anomalies)
| Level | Token | Hex |
|---|---|---|
| critical | `--sev-critical` | `#F0555F` |
| high | `--sev-high` | `#F5883E` |
| medium | `--sev-medium` | `#F5B942` |
| low | `--sev-low` | `#4FC3E8` |
| info | `--sev-info` | `#97A0B5` |

### Categorical chart palette (event series)
Ordered for maximum separation on the dark ground; colourblind-aware sequencing.
```
--cat-1 #4FC3E8  --cat-2 #F5B942  --cat-3 #46C08D  --cat-4 #B98BF0
--cat-5 #F0797F  --cat-6 #6E8BF0  --cat-7 #E8C24F  --cat-8 #58C7B0
```

## Typography

| Role | Stack | Notes |
|---|---|---|
| Display / headings | `"Space Grotesk", "Segoe UI", system-ui, sans-serif` | Technical grotesque; used with restraint. Falls back gracefully offline (no web-font fetch — file:// safe). |
| Body / UI | `system-ui, -apple-system, "Segoe UI", Roboto, sans-serif` | |
| Mono / numerics | `ui-monospace, "SF Mono", "JetBrains Mono", "Cascadia Code", Menlo, Consolas, monospace` | **All figures, ticks, IDs, deltas use mono** with `font-variant-numeric: tabular-nums`. |

### Type scale
| Token | px / line-height | Use |
|---|---|---|
| `--fs-xs` | 11 / 1.4 | micro labels, eyebrows (uppercase, letter-spacing .06em) |
| `--fs-sm` | 12.5 / 1.45 | secondary text, table cells |
| `--fs-base` | 14 / 1.5 | body |
| `--fs-md` | 16 / 1.4 | section intro |
| `--fs-lg` | 20 / 1.25 | section titles |
| `--fs-xl` | 26 / 1.2 | KPI values (mono) |
| `--fs-2xl` | 34 / 1.1 | hero KPI / big numbers (mono) |

Weights: 400 body, 500 labels/UI, 600 headings & KPI values, 700 sparingly. Eyebrows use
`text-transform: uppercase; letter-spacing: .07em; color: var(--text-faint)`.

## Spacing scale
4px base. Tokens: `--sp-1 4`, `--sp-2 8`, `--sp-3 12`, `--sp-4 16`, `--sp-5 20`, `--sp-6 24`,
`--sp-8 32`, `--sp-10 40`, `--sp-12 48`. Dense by default; section padding 20–24px, card padding
16px, tight rows 8–12px.

## Radii
`--r-xs 4` (insets, tags-inner), `--r-sm 6` (buttons, inputs), `--r-md 8` (cards/panels),
`--r-lg 12` (modals/hero), `--r-pill 999` (chips, severity badges).

## Borders & shadows
- Default border: `1px solid var(--border)`. Elevation on dark is expressed by **lightening the
  surface + a hairline border**, not heavy drop shadows.
- `--shadow-panel`: `0 1px 0 rgba(255,255,255,.02) inset, 0 8px 24px -12px rgba(0,0,0,.6)`.
- `--shadow-pop`: `0 12px 40px -12px rgba(0,0,0,.7)` (modals, menus).
- **Phosphor glow** (signature, charts only): `drop-shadow(0 0 6px rgba(245,185,66,.45))` on the
  primary trace. Never apply glow to text or borders.

## Component patterns

- **Panel / Section** — `bg-panel`, `--r-md`, `1px solid var(--border)`, padding `--sp-6`.
  Header row: eyebrow + title (`--fs-lg`, display, weight 600) left; controls right. A `2px`
  amber left-accent bar marks the currently-focused / anomalous section.
- **KPI tile** — `bg-panel-2`, `--r-md`, padding `--sp-4`. Eyebrow label (xs, faint) → value
  (mono, `--fs-xl/2xl`, `--text`) → delta chip (mono sm, `--pos`/`--neg` with ▲/▼) + sparkline.
- **Severity badge** — pill, `--fs-xs` uppercase, tinted bg at ~14% of the severity colour, text
  at full colour. e.g. critical = `rgba(240,85,95,.14)` bg / `#F0555F` text.
- **Delta chip** — mono, `▲ +12.4%` positive `--pos`, `▼ −8.1%` negative `--neg`, `–` neutral
  `--text-faint`. Use real minus `−` and arrows.
- **Table** — `bg-panel`; header `bg-panel-2`, xs uppercase faint labels, sticky. Numeric columns
  right-aligned, mono, tabular-nums. Row hover `bg-panel-2`. Reach bars: thin inline horizontal
  bar behind the number using `--cyan` at low alpha.
- **Buttons** — primary: amber text on `rgba(245,185,66,.12)`, `1px solid rgba(245,185,66,.35)`,
  `--r-sm`, weight 500, hover raises bg alpha. Secondary/ghost: `--text-dim` on transparent,
  border `--border`, hover `bg-panel-2`. Focus-visible: `2px` amber outline offset 2px.
- **Dropzone** — dashed `--border-strong`, `--r-lg`, big; active (drag-over) → amber dashed +
  faint amber wash + phosphor glow. States: idle / drag-over / parsing (progress) / error.
- **Chips / tags** — pill, `bg-panel-2`, `--text-dim`, xs. Removable classification chips in the
  Advanced panel.
- **Progress** — thin 2px amber bar; module streaming uses skeleton shimmer on `bg-inset`.

## Interactive & accessibility states
- **Hover:** surfaces step up one level (`bg-panel` → `bg-panel-2`); accents raise alpha.
- **Focus-visible:** `outline: 2px solid var(--signal); outline-offset: 2px;` — always visible,
  never removed.
- **Disabled:** `--text-faint`, `opacity .6`, no pointer.
- **Reduced motion:** honour `prefers-reduced-motion` — disable scanline, shimmer, trace-draw
  animation; keep instant states.
- Contrast: body text ≥ 7:1 on `--bg`; never rely on colour alone — pair severity colour with a
  label and pair up/down colour with an arrow glyph.

## Motion
Sparingly. Allowed: header scanline (slow, 8s, subtle), KPI count-up on first paint (250ms),
trace draw-in on chart mount (400ms), skeleton shimmer while a module streams, 120ms ease on
hover/focus. Everything disabled under reduced-motion. No parallax, no bouncing, no decorative
loops.

## Numerics formatting (product rule)
All counts/percentages are mono + tabular-nums. Large numbers use compact form (`37.2k`,
`1.4M`). Percentages one decimal. Dates ISO-ish (`2026-08-10`, `Aug 10`). Deltas always signed.
Because ~10% of rows may lack properties, surfaced totals are labelled as a **floor** with a
data-completeness caption where relevant.
