// Column-resolution layer. PostHog exports carry two parallel column sets:
// canonical `*.`-prefixed paths and duplicate un-prefixed query-alias columns.
// We prefer the prefixed columns, strip the `*.`, collapse duplicate resulting
// names (keeping the first non-null per row), and discover `properties.*`
// fields dynamically. Nothing about a specific product is assumed.
import type { DataCompleteness, NormalizedRow } from '../types'

const PROP_PREFIX = 'properties.'

export interface ColumnResolver {
  /** canonical name -> raw source header keys, prefixed sources first. */
  groups: Map<string, string[]>
  /** canonical names that collapsed >1 raw source. */
  resolvedColumns: string[]
  /** discovered property field names, without the `properties.` prefix. */
  propertyFields: string[]
  eventKeys: string[]
  timestampKeys: string[]
  distinctKeys: string[]
}

function canonical(header: string): string {
  return header.startsWith('*.') ? header.slice(2) : header
}

export function buildResolver(headers: string[]): ColumnResolver {
  const groups = new Map<string, string[]>()
  for (const h of headers) {
    if (h == null || h === '') continue
    const c = canonical(h)
    const arr = groups.get(c) ?? []
    arr.push(h)
    groups.set(c, arr)
  }
  // Order each group so `*.`-prefixed sources win.
  for (const [c, arr] of groups) {
    arr.sort((a, b) => {
      const pa = a.startsWith('*.') ? 0 : 1
      const pb = b.startsWith('*.') ? 0 : 1
      return pa - pb
    })
    groups.set(c, arr)
  }

  const resolvedColumns: string[] = []
  const propertyFields: string[] = []
  for (const [c, arr] of groups) {
    if (arr.length > 1) resolvedColumns.push(c)
    if (c.startsWith(PROP_PREFIX)) propertyFields.push(c.slice(PROP_PREFIX.length))
  }

  const eventKeys = groups.get('event') ?? []
  const timestampKeys = groups.get('timestamp') ?? groups.get('time') ?? []
  const distinctKeys = [
    ...(groups.get('distinct_id') ?? []),
    ...(groups.get('properties.distinct_id') ?? []),
  ]

  return {
    groups,
    resolvedColumns: resolvedColumns.sort(),
    propertyFields: propertyFields.sort(),
    eventKeys,
    timestampKeys,
    distinctKeys,
  }
}

function firstNonNull(raw: Record<string, unknown>, keys: string[]): string | null {
  for (const k of keys) {
    const v = raw[k]
    if (v !== undefined && v !== null && v !== '') return typeof v === 'string' ? v : String(v)
  }
  return null
}

/** Coerce a PostHog timestamp (ISO string or epoch) to epoch ms, or NaN. */
export function coerceTimestamp(v: string | null): number {
  if (!v) return NaN
  const s = v.trim()
  if (/^\d{9,}$/.test(s)) {
    const n = Number(s)
    // 13 digits => ms, 10 digits => seconds.
    return s.length >= 13 ? n : n * 1000
  }
  const t = Date.parse(s)
  return Number.isNaN(t) ? NaN : t
}

/** Running accumulator so parsing can stream chunk-by-chunk off the file reader. */
export class NormalizeAccumulator {
  private resolver: ColumnResolver | null = null
  rows: NormalizedRow[] = []
  totalRows = 0
  droppedRows = 0
  rowsMissingTimestamp = 0
  rowsMissingDistinctId = 0
  rowsMissingProps = 0
  parseErrors = 0

  setHeaders(headers: string[]) {
    if (!this.resolver) this.resolver = buildResolver(headers)
  }

  get columns(): ColumnResolver | null {
    return this.resolver
  }

  pushRaw(raw: Record<string, unknown>) {
    const r = this.resolver
    if (!r) return
    this.totalRows++

    const event = firstNonNull(raw, r.eventKeys)
    const ts = coerceTimestamp(firstNonNull(raw, r.timestampKeys))
    if (!event || Number.isNaN(ts)) {
      this.droppedRows++
      if (Number.isNaN(ts)) this.rowsMissingTimestamp++
      return
    }

    const distinctId = firstNonNull(raw, r.distinctKeys) ?? ''
    if (!distinctId) this.rowsMissingDistinctId++

    const props: Record<string, string | number | null> = {}
    let anyProp = false
    for (const field of r.propertyFields) {
      const grp = r.groups.get(PROP_PREFIX + field)
      if (!grp) continue
      const val = firstNonNull(raw, grp)
      if (val !== null) {
        props[field] = val
        anyProp = true
      }
    }
    if (!anyProp) this.rowsMissingProps++

    this.rows.push({ event, ts, distinctId, props })
  }

  finish(): { rows: NormalizedRow[]; completeness: DataCompleteness } {
    const usable = this.rows.length
    const notes: string[] = []
    const r = this.resolver
    if (r && r.distinctKeys.length === 0)
      notes.push('No distinct_id column found — user-level metrics may be unavailable.')
    if (r && r.timestampKeys.length === 0)
      notes.push('No timestamp column found — time-series and forecasting are disabled.')
    if (this.rowsMissingProps / Math.max(1, this.totalRows) > 0.1)
      notes.push('Over 10% of rows are missing properties — segmentation figures are a floor.')

    const completeness: DataCompleteness = {
      totalRows: this.totalRows,
      droppedRows: this.droppedRows,
      rowsMissingTimestamp: this.rowsMissingTimestamp,
      rowsMissingDistinctId: this.rowsMissingDistinctId,
      rowsMissingProps: this.rowsMissingProps,
      completeness: this.totalRows === 0 ? 0 : usable / this.totalRows,
      resolvedColumns: r?.resolvedColumns ?? [],
      propertyFields: r?.propertyFields ?? [],
      parseErrors: this.parseErrors,
      notes,
    }
    return { rows: this.rows, completeness }
  }
}
