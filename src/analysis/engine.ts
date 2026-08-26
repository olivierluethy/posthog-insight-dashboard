// Orchestrates every analytical module and streams results out stage-by-stage
// (KPIs first, heavier modules after) via the `emit` callback. Runs identically
// inside the inline worker and in the main-thread fallback.
import type {
  AnalysisResult,
  ClassifierConfig,
  DataCompleteness,
  NormalizedRow,
  WorkerResponse,
} from '../types'
import { buildClassIndex, classifyEvents } from './classify'
import { computeErrors } from './errors'
import { computeEventFrequency } from './frequency'
import { computeForecast } from './forecast'
import { computeInsights } from './insights'
import { computeKpis } from './kpis'
import { computeMetrics } from './metrics'
import { computeRetention } from './retention'
import { computeSegmentation } from './segmentation'
import { computeTimeseries } from './timeseries'

export type Emit = (msg: WorkerResponse) => void

const yieldToLoop = () => new Promise<void>((r) => setTimeout(r, 0))

export async function runEngine(
  rows: NormalizedRow[],
  completeness: DataCompleteness,
  config: ClassifierConfig,
  emit: Emit,
): Promise<AnalysisResult> {
  const started = performanceNow()
  const progress = (stage: string, pct: number) => emit({ type: 'progress', stage, pct })
  const partial = (key: keyof AnalysisResult, value: unknown) => emit({ type: 'partial', key, value })

  progress('Classifying events', 0.08)
  const classes = classifyEvents(rows, config)
  const idx = buildClassIndex(classes)
  partial('classes', classes)
  await yieldToLoop()

  progress('Computing KPIs', 0.18)
  const kpis = computeKpis(rows, idx, completeness)
  partial('kpis', kpis)
  partial('completeness', completeness)
  await yieldToLoop()

  progress('Ranking events by reach', 0.28)
  const eventFreq = computeEventFrequency(classes)
  partial('eventFreq', eventFreq)
  await yieldToLoop()

  progress('Building daily time-series', 0.42)
  const timeseriesDay = computeTimeseries(rows, classes, idx, 'day')
  partial('timeseriesDay', timeseriesDay)
  await yieldToLoop()

  progress('Building hourly time-series', 0.55)
  const timeseriesHour = computeTimeseries(rows, classes, idx, 'hour')
  partial('timeseriesHour', timeseriesHour)
  await yieldToLoop()

  progress('Reconstructing churn journeys', 0.68)
  const retention = computeRetention(rows, idx)
  partial('retention', retention)
  await yieldToLoop()

  progress('Aggregating errors', 0.78)
  const errors = computeErrors(rows, idx, kpis.uniqueUsers)
  partial('errors', errors)
  await yieldToLoop()

  progress('Fitting forecast', 0.84)
  const forecast = computeForecast(rows, idx)
  partial('forecast', forecast)
  await yieldToLoop()

  progress('Aligning metric matrix', 0.89)
  const metrics = computeMetrics(rows, idx)
  partial('metrics', metrics)
  await yieldToLoop()

  progress('Segmenting users', 0.93)
  const segmentation = computeSegmentation(rows, classes, idx, kpis.uniqueUsers)
  partial('segmentation', segmentation)
  await yieldToLoop()

  progress('Synthesising insights', 0.99)
  const insights = computeInsights({
    kpis,
    eventFreq,
    tsDay: timeseriesDay,
    tsHour: timeseriesHour,
    retention,
    errors,
    forecast,
    segmentation,
  })
  partial('insights', insights)

  const result: AnalysisResult = {
    kpis,
    completeness,
    classes,
    eventFreq,
    timeseriesDay,
    timeseriesHour,
    retention,
    errors,
    forecast,
    metrics,
    segmentation,
    insights,
    elapsedMs: performanceNow() - started,
  }
  progress('Done', 1)
  return result
}

function performanceNow(): number {
  return typeof performance !== 'undefined' ? performance.now() : 0
}
