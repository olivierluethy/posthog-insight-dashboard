// Pure, DOM-free formatters shared by the worker (for anomaly labels) and the UI.
import { compactNum } from './stats'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function pad(n: number): string {
  return n < 10 ? '0' + n : String(n)
}

export function fmtDay(t: number): string {
  const d = new Date(t)
  return `${MONTHS[d.getUTCMonth()]} ${pad(d.getUTCDate())}`
}

export function fmtDayFull(t: number): string {
  const d = new Date(t)
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
}

export function fmtHour(t: number): string {
  const d = new Date(t)
  return `${MONTHS[d.getUTCMonth()]} ${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:00`
}

export function fmtBucket(t: number, bucketMs: number): string {
  return bucketMs < 86_400_000 ? fmtHour(t) : fmtDay(t)
}

export function fmtNum(n: number): string {
  return compactNum(n)
}

export function fmtPct(x: number, digits = 1): string {
  if (!Number.isFinite(x)) return '–'
  return (x * 100).toFixed(digits) + '%'
}

export function fmtSignedPct(x: number, digits = 1): string {
  if (!Number.isFinite(x)) return '–'
  const s = (x * 100).toFixed(digits)
  return (x > 0 ? '+' : x < 0 ? '−' : '') + s.replace('-', '') + '%'
}

export function fmtDuration(sec: number): string {
  if (!Number.isFinite(sec)) return '–'
  if (sec < 60) return `${Math.round(sec)}s`
  if (sec < 3600) return `${Math.floor(sec / 60)}m ${Math.round(sec % 60)}s`
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ${Math.floor((sec % 3600) / 60)}m`
  return `${Math.floor(sec / 86400)}d ${Math.floor((sec % 86400) / 3600)}h`
}

export function fmtFactor(x: number): string {
  if (!Number.isFinite(x)) return '–'
  return (x >= 10 ? x.toFixed(0) : x.toFixed(1)) + '×'
}
