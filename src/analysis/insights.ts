import type {
  Anomaly,
  ErrorResult,
  EventFreqRow,
  ForecastResult,
  Insight,
  KpiSummary,
  RetentionResult,
  SegmentationResult,
  Severity,
  TimeseriesResult,
} from '../types'
import { computeEta, nextMilestone } from './forecast'
import { fmtDayFull, fmtDuration, fmtFactor, fmtNum, fmtPct } from './format'
import { DAY_MS } from './stats'

const SEV_RANK: Record<Severity, number> = { critical: 4, high: 3, medium: 2, low: 1, info: 0 }

interface Bundle {
  kpis: KpiSummary
  eventFreq: EventFreqRow[]
  tsDay: TimeseriesResult
  tsHour: TimeseriesResult
  retention: RetentionResult
  errors: ErrorResult
  forecast: ForecastResult
  segmentation: SegmentationResult
}

export function computeInsights(b: Bundle): Insight[] {
  const out: Insight[] = []
  const push = (i: Insight) => out.push(i)

  // --- Biggest anomaly this period -----------------------------------------
  const allAnoms: Anomaly[] = [...b.tsDay.anomalies, ...b.tsHour.anomalies].sort(
    (x, y) => y.score - x.score,
  )
  const biggest = allAnoms[0]
  if (biggest) {
    push({
      id: 'anomaly-top',
      severity: biggest.factor >= 4 ? 'high' : 'medium',
      score: biggest.score,
      title: `Biggest change this period: ${biggest.event} ${biggest.direction} than usual`,
      detail: biggest.label,
      suggestedAction:
        'Open the Time-series section and confirm whether this bucket lines up with a release, campaign, or outage.',
      module: 'timeseries',
    })
  }

  // --- Install spike --------------------------------------------------------
  const installSpike = allAnoms.find(
    (a) => a.event.toLowerCase().includes('install') && !a.event.toLowerCase().includes('uninstall') && a.direction === 'higher',
  )
  if (installSpike) {
    push({
      id: 'install-spike',
      severity: 'medium',
      score: installSpike.score + 1,
      title: 'Install spike detected',
      detail: `${installSpike.label} Sudden install jumps are usually external traffic.`,
      suggestedAction:
        'Likely a blog post, feature launch, or press mention — check acquisition source for that window before reading it as organic growth.',
      module: 'timeseries',
    })
  }

  // --- Uninstall spike + cohort behaviour ----------------------------------
  const uninstallSpike = allAnoms.find(
    (a) => a.event.toLowerCase().includes('uninstall') && a.direction === 'higher',
  )
  if (uninstallSpike) {
    const sig = b.retention.churnSignals[0]
    push({
      id: 'uninstall-spike',
      severity: 'high',
      score: uninstallSpike.score + 2,
      title: 'Uninstall spike detected',
      detail:
        `${uninstallSpike.label}` +
        (sig
          ? ` The most over-represented last action before churn is “${sig.event}” (${fmtFactor(sig.lift)} vs baseline).`
          : ''),
      suggestedAction: sig
        ? `Investigate what happens around “${sig.event}” — it dominates the pre-uninstall cohort.`
        : 'Inspect the churned-user journeys for a common last action.',
      module: 'retention',
    })
  }

  // --- Passive / over-firing event -----------------------------------------
  const passiveEvt = [...b.eventFreq]
    .filter((e) => e.passive)
    .sort((a, c) => c.ratio - a.ratio)[0]
  if (passiveEvt) {
    push({
      id: 'passive-event',
      severity: 'medium',
      score: 2 + Math.min(passiveEvt.ratio, 100),
      title: `“${passiveEvt.event}” is an over-firing event`,
      detail: `It fires ${fmtNum(passiveEvt.total)}× across only ${fmtNum(
        passiveEvt.reach,
      )} users (${fmtFactor(passiveEvt.ratio)} per user). Raw counts of it are ${fmtPct(
        passiveEvt.share,
      )} of all events.`,
      suggestedAction:
        'Treat its reach, not its count, as the real metric. A passive render event this hot can also signal a performance hot-path worth checking.',
      module: 'frequency',
    })
  }

  // --- Top error by reach ---------------------------------------------------
  const topErr = b.errors.patterns[0]
  if (topErr && topErr.reach > 0) {
    const sev: Severity = b.errors.affectedShare > 0.25 ? 'critical' : b.errors.affectedShare > 0.1 ? 'high' : 'medium'
    push({
      id: 'top-error',
      severity: sev,
      score: 5 + topErr.reach,
      title: `Top error affects ${fmtNum(topErr.reach)} users`,
      detail: `“${topErr.key}” (by ${topErr.groupedBy.replace('_', ' ')}) fired ${fmtNum(
        topErr.count,
      )}× across ${fmtNum(topErr.reach)} users. Errors reach ${fmtPct(
        b.errors.affectedShare,
      )} of all users overall.`,
      suggestedAction: 'Prioritise this error pattern — it has the widest user reach in the export.',
      module: 'errors',
    })
  }

  // --- Churn-trigger event --------------------------------------------------
  const trigger = b.retention.churnSignals.find((s) => s.lift >= 2)
  if (trigger) {
    push({
      id: 'churn-trigger',
      severity: 'high',
      score: 4 + trigger.lift,
      title: `“${trigger.event}” looks like a churn trigger`,
      detail: `It is the last action before uninstall for ${fmtPct(
        trigger.lastActionShare,
      )} of churned users — ${fmtFactor(trigger.lift)} its baseline share.`,
      suggestedAction: `Trace the flow around “${trigger.event}”; a frustrating or dead-end step here may be pushing users out.`,
      module: 'retention',
    })
  }

  // --- Churn is dissatisfaction ---------------------------------------------
  const eng = b.retention.engagement
  if (eng.churnIsDissatisfaction) {
    push({
      id: 'churn-dissatisfaction',
      severity: 'high',
      score: 6,
      title: 'Churned users were MORE engaged than retained ones',
      detail: `Median events — churned ${fmtNum(eng.churnedMedianEvents)} vs retained ${fmtNum(
        eng.retainedMedianEvents,
      )}. People are leaving after using the product heavily, not from neglect.`,
      suggestedAction:
        'This is dissatisfaction, not disengagement — audit the heavy-usage path for a breaking or frustrating experience.',
      module: 'retention',
    })
  }

  // --- High churn rate ------------------------------------------------------
  if (b.retention.installs >= 10 && b.retention.churnRate > 0.3) {
    push({
      id: 'high-churn',
      severity: b.retention.churnRate > 0.5 ? 'critical' : 'high',
      score: 3 + b.retention.churnRate * 10,
      title: `Churn rate is ${fmtPct(b.retention.churnRate)}`,
      detail: `${fmtNum(b.retention.uninstalls)} of ${fmtNum(
        b.retention.installs,
      )} installers uninstalled${
        b.retention.medianTimeToChurnMs != null
          ? `, typically after ${fmtDuration(b.retention.medianTimeToChurnMs / 1000)}`
          : ''
      }.`,
      suggestedAction: 'Focus on the first-session experience and the churn-signal events below.',
      module: 'retention',
    })
  }

  // --- Low-adoption feature (discoverability) -------------------------------
  const lowFeat = [...b.segmentation.features]
    .filter((f) => f.users > 0)
    .sort((a, b2) => a.adoption - b2.adoption)[0]
  if (lowFeat && lowFeat.adoption < 0.15 && b.segmentation.features.length > 1) {
    push({
      id: 'low-adoption',
      severity: 'low',
      score: 1,
      title: `Low adoption: “${lowFeat.event}” reaches only ${fmtPct(lowFeat.adoption)} of users`,
      detail: 'A feature this far below the others usually has a discoverability problem, not a demand problem.',
      suggestedAction: 'Surface it earlier in the UI or onboarding and re-measure.',
      module: 'segmentation',
    })
  }

  // --- Bad release ----------------------------------------------------------
  const badVer = b.segmentation.versions.find((v) => v.suspect)
  if (badVer) {
    push({
      id: 'bad-release',
      severity: 'high',
      score: 5 + badVer.errorRate * 10,
      title: `Version ${badVer.version} looks like a bad release`,
      detail: `Error rate ${fmtPct(badVer.errorRate)} and churn ${fmtPct(
        badVer.churnRate,
      )} across ${fmtNum(badVer.users)} users — elevated versus the baseline.`,
      suggestedAction: 'Compare against the previous version and consider a rollback or hotfix.',
      module: 'segmentation',
    })
  }

  // --- Growth ETA to next milestone ----------------------------------------
  const usersMetric = b.forecast.metrics.find((m) => m.key === 'cumUsers')
  if (usersMetric && usersMetric.current > 0) {
    const milestone = nextMilestone(usersMetric.current)
    const eta = computeEta(usersMetric, milestone, b.forecast.endT)
    let detail: string
    let action: string
    if (eta.neverAtCurrentRate) {
      detail = `Cumulative users are flat or declining (${fmtNum(usersMetric.ratePerDay)}/day), so ${fmtNum(
        milestone,
      )} is not reachable at the current rate.`
      action = 'Growth has stalled — revisit acquisition before setting a target date.'
    } else if (eta.etaT != null) {
      detail = `At the current ${fmtNum(usersMetric.ratePerDay)} users/day, you reach ${fmtNum(
        milestone,
      )} cumulative users around ${fmtDayFull(eta.etaT)} (~${Math.ceil(
        (eta.etaT - b.forecast.endT) / DAY_MS,
      )} days). Linear extrapolation — treat as a rough guide.`
      action = 'Set your real target in the Forecasting section to get an ETA for it.'
    } else {
      detail = `Already past ${fmtNum(milestone)} cumulative users.`
      action = 'Set a higher target in the Forecasting section.'
    }
    push({
      id: 'growth-eta',
      severity: 'info',
      score: 0,
      title: `Growth pace: ~${fmtNum(usersMetric.ratePerDay)} new users/day`,
      detail,
      suggestedAction: action,
      module: 'forecast',
    })
  }

  // --- Data completeness caveat --------------------------------------------
  if (b.kpis.completeness < 0.9) {
    push({
      id: 'completeness',
      severity: 'info',
      score: -1,
      title: `Data completeness is ${fmtPct(b.kpis.completeness)}`,
      detail: 'Some rows were dropped or lack properties, so counts here are a floor, not an exact total.',
      suggestedAction: 'Read absolute numbers as minimums; trends and ratios remain reliable.',
      module: 'overview',
    })
  }

  out.sort((a, b2) => SEV_RANK[b2.severity] - SEV_RANK[a.severity] || b2.score - a.score)
  return out
}
