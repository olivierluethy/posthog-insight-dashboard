/// <reference lib="webworker" />
// Inline Blob-URL worker entry (built via `?worker&inline` so the whole engine
// is embedded in one blob — no external chunk fetches that would fail on file://).
import type { WorkerRequest, WorkerResponse } from '../types'
import { runEngine } from './engine'

const ctx = self as unknown as DedicatedWorkerGlobalScope

ctx.onmessage = async (e: MessageEvent<WorkerRequest>) => {
  const msg = e.data
  if (!msg || msg.type !== 'analyze') return
  try {
    const result = await runEngine(msg.rows, msg.completeness, msg.config, (m) =>
      ctx.postMessage(m),
    )
    const done: WorkerResponse = { type: 'done', result }
    ctx.postMessage(done)
  } catch (err) {
    const error: WorkerResponse = {
      type: 'error',
      message: err instanceof Error ? err.message : String(err),
    }
    ctx.postMessage(error)
  }
}
