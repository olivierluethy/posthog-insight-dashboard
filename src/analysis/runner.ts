// Client-side dispatcher: prefer the inline Blob-URL worker, fall back to a
// chunked main-thread run if the worker cannot be constructed or errors. Either
// path streams the same progress/partial events, so the UI code is identical.
import type {
  AnalysisResult,
  ClassifierConfig,
  DataCompleteness,
  NormalizedRow,
  WorkerResponse,
} from '../types'
import { runEngine } from './engine'
import AnalysisWorker from './worker?worker&inline'

export interface RunHandlers {
  onProgress?: (stage: string, pct: number) => void
  onPartial?: (key: keyof AnalysisResult, value: unknown) => void
  onMode?: (mode: 'worker' | 'main-thread') => void
}

export function analyze(
  rows: NormalizedRow[],
  completeness: DataCompleteness,
  config: ClassifierConfig,
  handlers: RunHandlers = {},
): Promise<AnalysisResult> {
  return new Promise((resolve, reject) => {
    let worker: Worker | null = null
    let settled = false
    let fellBack = false

    const finish = (r: AnalysisResult) => {
      if (settled) return
      settled = true
      try {
        worker?.terminate()
      } catch {
        /* ignore */
      }
      resolve(r)
    }

    const dispatch = (m: WorkerResponse) => {
      if (m.type === 'progress') handlers.onProgress?.(m.stage, m.pct)
      else if (m.type === 'partial') handlers.onPartial?.(m.key, m.value)
      else if (m.type === 'done') finish(m.result)
      else if (m.type === 'error') runOnMainThread()
    }

    const runOnMainThread = () => {
      if (settled || fellBack) return
      fellBack = true
      try {
        worker?.terminate()
      } catch {
        /* ignore */
      }
      worker = null
      handlers.onMode?.('main-thread')
      runEngine(rows, completeness, config, dispatch)
        .then(finish)
        .catch((e) => {
          if (!settled) {
            settled = true
            reject(e)
          }
        })
    }

    try {
      worker = new AnalysisWorker()
      handlers.onMode?.('worker')
      worker.onmessage = (e: MessageEvent<WorkerResponse>) => dispatch(e.data)
      worker.onerror = () => runOnMainThread()
      worker.postMessage({ type: 'analyze', rows, completeness, config })
    } catch {
      runOnMainThread()
    }
  })
}
