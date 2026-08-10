# Signal Desk — PostHog Insight Dashboard

Drop a raw PostHog CSV export in, get a full analytics report out in seconds — **100%
in your browser**. No backend, no upload, no network calls of any kind. The privacy-
sensitive behavioural data never leaves your machine (works offline, even from a
`file://` double-click).

It answers, without being asked: what happened, how often each event *really* fired
(reach, not raw counts), how retention and churn look, which errors hurt the most
users, **what changed and when**, and **how long until you hit a target** (e.g. 500
active users at the current rate).

## What it does

- **Auto-Insights** — a ranked, plain-English list of findings with a concrete next
  step for each (biggest anomaly, install/uninstall spikes, over-firing events, top
  error by reach, churn triggers, dissatisfaction-vs-disengagement, bad releases,
  growth ETA…).
- **Overview KPIs** — date range, users, new users, DAU, events/day, event types,
  data-completeness.
- **Event frequency** — total count *and* unique-user reach side by side, reach-first.
- **Time-series & change detection** — day/hour buckets, robust MAD anomalies
  (`|x−median|/(1.4826·MAD) > 3.5`) and level-shift change-points, each stated as
  "on `<bucket>`, `<event>` was X vs baseline Y (Z× higher)".
- **Retention & churn** — install→uninstall funnel, reconstructed per-user journeys,
  churned-vs-retained engagement, and events over-represented as the last action.
- **Error analysis** — grouped by reason / class / code / status / event, ranked by
  affected-user reach.
- **Forecasting** — linear trend on cumulative users / installs / net growth; enter a
  target and get the ETA date (with an extrapolation caveat).
- **Segmentation** — geography, language, per-version error+churn health, feature
  adoption, power-user distribution, sessions.
- **Run history** — a lightweight snapshot per export is stored in IndexedDB, so each
  new drop shows week-over-week KPI deltas. No raw rows are persisted.

It is **product-agnostic**: no event names are hardcoded. Structure is detected
generically and events are classified by heuristic (install / uninstall / error /
session / passive), all correctable in the **Advanced** panel — corrections re-run the
whole report.

## Build & run

```bash
npm install
npm run build       # type-checks, then produces a single self-contained dist/index.html
```

Then **open `dist/index.html`** — double-click it, or drag it into a browser. It runs
straight from `file://`; there is nothing to serve.

For development with hot reload:

```bash
npm run dev
```

### How it stays a single file that works offline

- `vite-plugin-singlefile` + `base: './'` inline all JS/CSS into one `index.html`.
- Heavy analysis runs in an **inline Blob-URL worker** (`?worker&inline`, classic/iife
  format) so there are no split chunks or separate worker files that `file://` would
  refuse to load. If the worker can't be constructed, it falls back to a **chunked
  main-thread run** that still streams progress.
- Parsing streams the CSV in ~1 MB chunks (PapaParse) to keep the UI responsive on
  large (~40 MB) exports.

## Sample data

`sample/posthog-sample.csv` is a small synthetic export (PostHog's `*.`-prefixed +
alias column shape) you can drop in to see the dashboard immediately. It is generated,
not real user data.

## Tech

React + Vite + TypeScript · PapaParse · Recharts · IndexedDB. Design system in
[`docs/STYLEGUIDE.md`](docs/STYLEGUIDE.md).
