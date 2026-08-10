// Small, dependency-free statistics used across the engine.

export function median(xs: number[]): number {
  if (xs.length === 0) return NaN
  const s = [...xs].sort((a, b) => a - b)
  const mid = s.length >> 1
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

export function quantile(xs: number[], q: number): number {
  if (xs.length === 0) return NaN
  const s = [...xs].sort((a, b) => a - b)
  const pos = (s.length - 1) * q
  const base = Math.floor(pos)
  const rest = pos - base
  return s[base + 1] !== undefined ? s[base] + rest * (s[base + 1] - s[base]) : s[base]
}

export function mean(xs: number[]): number {
  if (xs.length === 0) return NaN
  let sum = 0
  for (const x of xs) sum += x
  return sum / xs.length
}

/** Median absolute deviation, scaled to be a consistent estimator of sigma. */
export function mad(xs: number[]): { median: number; mad: number; scaled: number } {
  const m = median(xs)
  const dev = xs.map((x) => Math.abs(x - m))
  const md = median(dev)
  return { median: m, mad: md, scaled: 1.4826 * md }
}

/** Ordinary least squares y = intercept + slope*x. */
export function linreg(xs: number[], ys: number[]): { slope: number; intercept: number; r2: number } {
  const n = xs.length
  if (n < 2) return { slope: 0, intercept: ys[0] ?? 0, r2: 0 }
  const mx = mean(xs)
  const my = mean(ys)
  let sxx = 0
  let sxy = 0
  let syy = 0
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - mx
    const dy = ys[i] - my
    sxx += dx * dx
    sxy += dx * dy
    syy += dy * dy
  }
  const slope = sxx === 0 ? 0 : sxy / sxx
  const intercept = my - slope * mx
  const r2 = sxx === 0 || syy === 0 ? 0 : (sxy * sxy) / (sxx * syy)
  return { slope, intercept, r2 }
}

export const DAY_MS = 86_400_000
export const HOUR_MS = 3_600_000

/** Floor an epoch-ms timestamp to the start of its day/hour bucket. */
export function bucketStart(t: number, bucketMs: number): number {
  return Math.floor(t / bucketMs) * bucketMs
}

/** Fill a dense, gap-free series of bucket timestamps between two epochs. */
export function denseBuckets(from: number, to: number, bucketMs: number): number[] {
  const start = bucketStart(from, bucketMs)
  const end = bucketStart(to, bucketMs)
  const out: number[] = []
  // Cap to avoid runaway ranges from a stray far-future timestamp.
  const max = 100_000
  for (let t = start, i = 0; t <= end && i < max; t += bucketMs, i++) out.push(t)
  return out
}

export function compactNum(n: number): string {
  const abs = Math.abs(n)
  if (abs >= 1e9) return (n / 1e9).toFixed(abs >= 1e10 ? 0 : 1) + 'B'
  if (abs >= 1e6) return (n / 1e6).toFixed(abs >= 1e7 ? 0 : 1) + 'M'
  if (abs >= 1e3) return (n / 1e3).toFixed(abs >= 1e4 ? 0 : 1) + 'k'
  return String(Math.round(n))
}
