// ============================================================================
// Shared type contract for the whole analysis pipeline.
// Kept dependency-free so it can be imported from the worker and the UI alike.
// ============================================================================

/** A row after column-resolution/normalisation. Raw properties are flattened. */
export interface NormalizedRow {
  event: string
  /** epoch ms, or NaN when the timestamp could not be parsed. */
  ts: number
  distinctId: string
  /** flattened `properties.*` values, key without the `properties.` prefix. */
  props: Record<string, string | number | null>
}

/** Report of how complete/clean the parsed data is. Numbers are a floor, not exact. */
export interface DataCompleteness {
  totalRows: number
  /** rows dropped entirely (no event or no timestamp). */
  droppedRows: number
  rowsMissingTimestamp: number
  rowsMissingDistinctId: number
  rowsMissingProps: number
  /** 0..1 — usable rows / total rows. */
  completeness: number
  /** columns that were collapsed from `*.`-prefixed + alias duplicates. */
  resolvedColumns: string[]
  /** discovered `properties.*` field names (without prefix). */
  propertyFields: string[]
  parseErrors: number
  notes: string[]
}

export type EventCategory =
  | 'install'
  | 'uninstall'
  | 'error'
  | 'session'
  | 'passive'
  | 'generic'

/** Auto-detected, user-overridable classification of a single event name. */
export interface EventClass {
  event: string
  category: EventCategory
  /** volume / unique-user reach; high => passive/over-firing. */
  volumeReachRatio: number
  total: number
  reach: number
  /** true when the user overrode the auto class in the Advanced panel. */
  overridden?: boolean
  autoCategory: EventCategory
}

export interface ClassifierConfig {
  /** ratio at/above which an event is flagged passive/over-firing. */
  passiveRatioThreshold: number
  /** per-event overrides: event name -> category. */
  overrides: Record<string, EventCategory>
}

// ---- Module result types --------------------------------------------------

export interface KpiSummary {
  dateFrom: number
  dateTo: number
  spanDays: number
  totalEvents: number
  uniqueUsers: number
  newUsers: number
  installs: number
  uninstalls: number
  distinctEventTypes: number
  avgEventsPerDay: number
  avgDau: number
  completeness: number
  /** per-day active users for the DAU sparkline. */
  dauSeries: TimePoint[]
}

export interface TimePoint {
  /** bucket start, epoch ms. */
  t: number
  v: number
}

export interface EventFreqRow {
  event: string
  total: number
  reach: number
  ratio: number
  category: EventCategory
  passive: boolean
  /** share of total events, 0..1. */
  share: number
}

export type Granularity = 'day' | 'hour'

export interface Anomaly {
  t: number
  event: string
  value: number
  baseline: number
  /** multiplicative factor vs baseline. */
  factor: number
  direction: 'higher' | 'lower'
  /** MAD-based robust z score. */
  score: number
  kind: 'spike' | 'dip' | 'level-shift'
  label: string
}

export interface Series {
  key: string
  label: string
  category: EventCategory | 'meta'
  points: TimePoint[]
}

export interface TimeseriesResult {
  granularity: Granularity
  bucketMs: number
  series: Series[]
  anomalies: Anomaly[]
  changePoints: Anomaly[]
}

export interface UserJourney {
  distinctId: string
  installedAt: number | null
  uninstalledAt: number
  timeToChurnMs: number | null
  eventCount: number
  /** last N events before uninstall (most recent last). */
  lastEvents: { event: string; t: number }[]
  hitError: boolean
  hitReset: boolean
}

export interface EngagementCompare {
  churnedUsers: number
  retainedUsers: number
  churnedMedianEvents: number
  retainedMedianEvents: number
  churnedMeanEvents: number
  retainedMeanEvents: number
  /** true when churned users are *more* engaged than retained (dissatisfaction). */
  churnIsDissatisfaction: boolean
}

export interface ChurnSignal {
  event: string
  /** share of churned journeys whose last action was this event. */
  lastActionShare: number
  /** baseline share of this event among all events. */
  baselineShare: number
  /** lastActionShare / baselineShare. */
  lift: number
  churnedCount: number
}

export interface RetentionResult {
  installs: number
  uninstalls: number
  churnRate: number
  retainedUsers: number
  medianTimeToChurnMs: number | null
  journeys: UserJourney[]
  engagement: EngagementCompare
  churnSignals: ChurnSignal[]
}

export interface ErrorPattern {
  key: string
  groupedBy: 'event' | 'reason' | 'error_class' | 'error_code' | 'status'
  count: number
  reach: number
  sampleEvents: string[]
}

export interface ErrorResult {
  totalErrorEvents: number
  affectedUsers: number
  affectedShare: number
  patterns: ErrorPattern[]
}

export interface ForecastMetric {
  key: 'cumUsers' | 'cumInstalls' | 'netGrowth'
  label: string
  /** observed cumulative series. */
  points: TimePoint[]
  /** slope per day. */
  ratePerDay: number
  ratePerWeek: number
  /** intercept + slope*t fit (t in days from series start). */
  slope: number
  intercept: number
  r2: number
  current: number
}

export interface ForecastResult {
  metrics: ForecastMetric[]
  startT: number
  endT: number
}

export interface EtaResult {
  metricKey: ForecastMetric['key']
  target: number
  current: number
  ratePerDay: number
  /** epoch ms when projection crosses target, or null if never/already. */
  etaT: number | null
  daysToTarget: number | null
  alreadyReached: boolean
  neverAtCurrentRate: boolean
}

export interface Breakdown {
  key: string
  label: string
  users: number
  events: number
  share: number
}

export interface VersionHealth {
  version: string
  users: number
  events: number
  errorEvents: number
  errorRate: number
  uninstalls: number
  churnRate: number
  /** flagged as a likely bad release. */
  suspect: boolean
}

export interface FeatureAdoption {
  event: string
  category: EventCategory
  users: number
  adoption: number
}

export interface PowerUserDist {
  buckets: { label: string; users: number }[]
  oneAndDoneUsers: number
  oneAndDoneShare: number
  powerUsers: number
  powerUserShare: number
  medianEventsPerUser: number
}

export interface SessionStats {
  available: boolean
  users: number
  medianSessionCount: number | null
  medianDurationSec: number | null
  avgDurationSec: number | null
}

export interface SegmentationResult {
  geo: Breakdown[]
  language: Breakdown[]
  versions: VersionHealth[]
  features: FeatureAdoption[]
  power: PowerUserDist
  sessions: SessionStats
}

export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info'

export interface Insight {
  id: string
  severity: Severity
  /** for ordering within a severity. */
  score: number
  title: string
  detail: string
  suggestedAction: string
  /** which module this came from, for the UI to deep-link/scroll. */
  module: string
}

// ---- Unified metric matrix (comparison / relationships / goals) -----------

export type MetricKey =
  | 'newUsers'
  | 'activeUsers'
  | 'installs'
  | 'uninstalls'
  | 'netGrowth'
  | 'events'
  | 'errors'

/** One aligned daily metric, with both the per-day level and its running total,
 *  plus a linear fit on whichever of the two goals/forecasts should run on. */
export interface MetricSeries {
  key: MetricKey
  label: string
  /** true when a target refers to a running total (installs) rather than a
   *  daily level (active users). Determines which series the fit runs on. */
  cumulative: boolean
  unit: string
  /** short accent colour token, e.g. 'var(--cat-1)'. */
  color: string
  /** dense per-day values. */
  daily: TimePoint[]
  /** dense running total. */
  cumSeries: TimePoint[]
  /** sum of daily over the whole range (== last cumulative). */
  total: number
  /** latest value of the series a goal is measured against. */
  current: number
  /** slope/day of the fitted (cumulative or level) series. */
  ratePerDay: number
  ratePerWeek: number
  r2: number
  peakDaily: number
  meanDaily: number
}

export interface MetricMatrix {
  startT: number
  endT: number
  /** dense day-bucket starts shared by every series. */
  days: number[]
  series: MetricSeries[]
}

// ---- Top-level analysis payload ------------------------------------------

export interface AnalysisResult {
  kpis: KpiSummary
  completeness: DataCompleteness
  classes: EventClass[]
  eventFreq: EventFreqRow[]
  timeseriesDay: TimeseriesResult
  timeseriesHour: TimeseriesResult
  retention: RetentionResult
  errors: ErrorResult
  forecast: ForecastResult
  metrics: MetricMatrix
  segmentation: SegmentationResult
  insights: Insight[]
  /** wall-clock ms the engine took. */
  elapsedMs: number
}

/** A lightweight snapshot persisted to IndexedDB for run-history diffing. */
export interface RunSnapshot {
  id: string
  createdAt: number
  fileName: string
  rowCount: number
  kpis: KpiSummary
  topEvents: { event: string; total: number; reach: number }[]
  churnRate: number
  errorAffectedShare: number
  insightCount: number
}

// ---- Worker protocol ------------------------------------------------------

export type WorkerRequest = {
  type: 'analyze'
  rows: NormalizedRow[]
  completeness: DataCompleteness
  config: ClassifierConfig
}

export type WorkerResponse =
  | { type: 'progress'; stage: string; pct: number }
  | { type: 'partial'; key: keyof AnalysisResult; value: unknown }
  | { type: 'done'; result: AnalysisResult }
  | { type: 'error'; message: string }
