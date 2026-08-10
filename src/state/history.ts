// Lightweight run-history via IndexedDB. We persist only KPIs + key aggregates
// per analysed export (never raw rows), so a fresh drop can be diffed against
// the previous upload with no backend.
import type { AnalysisResult, RunSnapshot } from '../types'

const DB_NAME = 'signal-desk'
const STORE = 'runs'
const DB_VERSION = 1

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'))
      return
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        const os = db.createObjectStore(STORE, { keyPath: 'id' })
        os.createIndex('createdAt', 'createdAt')
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function newId(): string {
  try {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  } catch {
    /* ignore */
  }
  return `run-${Date.now()}-${Math.floor(Math.random() * 1e6)}`
}

export function buildSnapshot(
  fileName: string,
  rowCount: number,
  result: AnalysisResult,
): RunSnapshot {
  const topEvents = [...result.eventFreq]
    .slice(0, 12)
    .map((e) => ({ event: e.event, total: e.total, reach: e.reach }))
  return {
    id: newId(),
    createdAt: Date.now(),
    fileName,
    rowCount,
    kpis: result.kpis,
    topEvents,
    churnRate: result.retention.churnRate,
    errorAffectedShare: result.errors.affectedShare,
    insightCount: result.insights.length,
  }
}

export async function saveSnapshot(snap: RunSnapshot): Promise<void> {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(snap)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  db.close()
}

export async function listSnapshots(): Promise<RunSnapshot[]> {
  const db = await openDb()
  const all = await new Promise<RunSnapshot[]>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).getAll()
    req.onsuccess = () => resolve(req.result as RunSnapshot[])
    req.onerror = () => reject(req.error)
  })
  db.close()
  return all.sort((a, b) => b.createdAt - a.createdAt)
}

export async function clearSnapshots(): Promise<void> {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).clear()
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  db.close()
}

export interface DiffRow {
  label: string
  current: number
  previous: number
  deltaPct: number | null
  direction: 'up' | 'down' | 'flat'
  /** whether up is good (users) or bad (churn) — for colour semantics. */
  higherIsBetter: boolean
  /** format hint for the UI. */
  format: 'count' | 'pct'
}

function row(
  label: string,
  current: number,
  previous: number,
  higherIsBetter: boolean,
  format: 'count' | 'pct',
): DiffRow {
  const delta = previous !== 0 ? (current - previous) / Math.abs(previous) : current !== 0 ? null : 0
  const dir = current > previous ? 'up' : current < previous ? 'down' : 'flat'
  return { label, current, previous, deltaPct: delta, direction: dir, higherIsBetter, format }
}

export function computeDiff(current: RunSnapshot, previous: RunSnapshot): DiffRow[] {
  const c = current.kpis
  const p = previous.kpis
  return [
    row('Unique users', c.uniqueUsers, p.uniqueUsers, true, 'count'),
    row('New users', c.newUsers, p.newUsers, true, 'count'),
    row('Total events', c.totalEvents, p.totalEvents, true, 'count'),
    row('Avg DAU', Math.round(c.avgDau), Math.round(p.avgDau), true, 'count'),
    row('Installs', c.installs, p.installs, true, 'count'),
    row('Uninstalls', c.uninstalls, p.uninstalls, false, 'count'),
    row('Churn rate', current.churnRate, previous.churnRate, false, 'pct'),
    row('Error-affected users', current.errorAffectedShare, previous.errorAffectedShare, false, 'pct'),
  ]
}
