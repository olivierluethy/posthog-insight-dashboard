// Convenience accessors over a normalised row's flattened `props`.
// Every accessor degrades gracefully to null/NaN when the field is absent, so
// a product that never emits (say) a version field simply yields empty results
// rather than crashing the pipeline.
import type { NormalizedRow } from '../types'

export function propStr(row: NormalizedRow, ...names: string[]): string | null {
  for (const n of names) {
    const v = row.props[n]
    if (v !== undefined && v !== null && v !== '') return String(v)
  }
  return null
}

export function propNum(row: NormalizedRow, ...names: string[]): number {
  for (const n of names) {
    const v = row.props[n]
    if (v === undefined || v === null || v === '') continue
    const num = typeof v === 'number' ? v : Number(String(v).replace(/[, ]/g, ''))
    if (Number.isFinite(num)) return num
  }
  return NaN
}

export const country = (r: NormalizedRow) =>
  propStr(r, '$geoip_country_name', 'geoip_country_name', '$geoip_country_code')

export const language = (r: NormalizedRow) =>
  propStr(r, 'browser_language', '$browser_language', 'language', 'locale')

export const version = (r: NormalizedRow) =>
  propStr(r, 'extension_version', 'version', 'app_version', '$app_version')

export const errorClass = (r: NormalizedRow) => propStr(r, 'error_class', 'error_type', 'errorClass')
export const errorReason = (r: NormalizedRow) => propStr(r, 'reason', 'error_reason', 'message')
export const errorStatus = (r: NormalizedRow) => propStr(r, 'status', 'endpoint_status', 'http_status')
export const errorCode = (r: NormalizedRow) =>
  propStr(r, 'error_codes.0', 'error_code', 'error_codes', 'code')
export const errorCount = (r: NormalizedRow) => propNum(r, 'error_count', 'errors', 'error_total')

export const sessionCount = (r: NormalizedRow) => propNum(r, 'session_count', 'sessions')
export const sessionDuration = (r: NormalizedRow) =>
  propNum(r, 'session_duration_seconds', 'session_duration', '$session_duration')

/** true when the row carries any error-signalling property (independent of event name). */
export function hasErrorProps(r: NormalizedRow): boolean {
  if (errorClass(r)) return true
  if (errorCode(r)) return true
  const c = errorCount(r)
  return Number.isFinite(c) && c > 0
}
