// Streaming CSV parse. PapaParse reads the File in chunks off a FileReader, so
// the main thread is free between chunks — the UI stays responsive on a 40 MB
// export without a classic worker (which would not load from file://).
import Papa from 'papaparse'
import type { DataCompleteness, NormalizedRow } from '../types'
import { NormalizeAccumulator } from './normalize'

export interface ParseOutcome {
  rows: NormalizedRow[]
  completeness: DataCompleteness
}

export function parseCsvFile(
  file: File,
  onProgress: (pct: number, rows: number) => void,
): Promise<ParseOutcome> {
  return new Promise((resolve, reject) => {
    const acc = new NormalizeAccumulator()
    const size = file.size || 1
    let headersSet = false

    Papa.parse<Record<string, unknown>>(file, {
      header: true,
      skipEmptyLines: 'greedy',
      dynamicTyping: false,
      // ~1 MB chunks: small enough to keep the UI live, large enough to be fast.
      chunkSize: 1024 * 1024,
      chunk: (results, parser) => {
        try {
          if (!headersSet && results.meta.fields) {
            acc.setHeaders(results.meta.fields)
            headersSet = true
          }
          if (results.errors?.length) acc.parseErrors += results.errors.length
          for (const raw of results.data) acc.pushRaw(raw)
          const cursor = (results.meta as { cursor?: number }).cursor ?? 0
          onProgress(Math.min(0.99, cursor / size), acc.rows.length)
        } catch (err) {
          parser.abort()
          reject(err instanceof Error ? err : new Error(String(err)))
        }
      },
      complete: () => {
        onProgress(1, acc.rows.length)
        resolve(acc.finish())
      },
      error: (err) => reject(err),
    })
  })
}
