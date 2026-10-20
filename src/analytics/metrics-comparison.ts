/**
 * Period-over-period comparison against local metrics snapshots.
 *
 * History is sufficient when every expected platform has a snapshot whose window
 * length matches the request (`7d` / `30d`) and whose UTC calendar dates equal
 * the previous equal-length window. Exact ISO-string equality is not required:
 * capture times of day differ between refreshes.
 *
 * @module @deepseek-ai/dsh-growth-studio/analytics/metrics-comparison
 */

import type { MetricsComparison, PlatformId, PlatformMetrics } from '../types.js'

const DAY_MS = 24 * 60 * 60 * 1000

export const EMPTY_COMPARISON: Readonly<MetricsComparison> = Object.freeze({
  period: null,
  impressionsDeltaPercent: null,
  playsDeltaPercent: null,
  engagementsDeltaPercent: null,
  followersDeltaPercent: null,
})

function emptyComparison(): MetricsComparison {
  return { ...EMPTY_COMPARISON }
}

export function utcCalendarDate(iso: string): string | null {
  const ms = Date.parse(iso)
  if (!Number.isFinite(ms)) return null
  return new Date(ms).toISOString().slice(0, 10)
}

export function windowLengthDays(windowStart: string, windowEnd: string): number | null {
  const start = Date.parse(windowStart)
  const end = Date.parse(windowEnd)
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null
  return Math.round((end - start) / DAY_MS)
}

function periodLengthDays(period: '7d' | '30d'): number {
  return period === '30d' ? 30 : 7
}

export function previousEqualLengthWindow(
  windowStart: string,
  windowEnd: string,
): { windowStart: string; windowEnd: string } | null {
  const startMs = Date.parse(windowStart)
  const endMs = Date.parse(windowEnd)
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) return null
  const duration = endMs - startMs
  return {
    windowStart: new Date(startMs - duration).toISOString(),
    windowEnd: windowStart,
  }
}

export function windowsCoverSameUtcPeriod(
  row: Pick<PlatformMetrics, 'windowStart' | 'windowEnd'>,
  prev: { windowStart: string; windowEnd: string },
  period: '7d' | '30d',
): boolean {
  if (windowLengthDays(row.windowStart, row.windowEnd) !== periodLengthDays(period)) return false
  return (
    utcCalendarDate(row.windowStart) === utcCalendarDate(prev.windowStart) &&
    utcCalendarDate(row.windowEnd) === utcCalendarDate(prev.windowEnd)
  )
}

/**
 * Among rows whose UTC-day window equals `prev` at the requested length, pick
 * the smallest |windowEnd - prev.windowEnd|. Equal distance keeps the later
 * `capturedAt` (and file order if timestamps also tie).
 */
export function selectBaselineRecord(
  history: PlatformMetrics[],
  platform: PlatformId,
  prev: { windowStart: string; windowEnd: string },
  period: '7d' | '30d',
): PlatformMetrics | null {
  const matches = history.filter(
    row => row.platform === platform && windowsCoverSameUtcPeriod(row, prev, period),
  )
  if (matches.length === 0) return null
  const prevEnd = Date.parse(prev.windowEnd)
  const distance = (row: PlatformMetrics) => Math.abs(Date.parse(row.windowEnd) - prevEnd)
  let chosen = matches[0]
  for (let i = 1; i < matches.length; i++) {
    const row = matches[i]
    const delta = distance(row) - distance(chosen)
    if (delta < 0) chosen = row
    else if (delta === 0 && row.capturedAt >= chosen.capturedAt) chosen = row
  }
  return chosen
}

function sumMetric(
  rows: PlatformMetrics[],
  pick: (row: PlatformMetrics) => number | null | undefined,
): number | null {
  let total: number | null = null
  for (const row of rows) {
    const value = pick(row)
    if (value === null || value === undefined) continue
    total = (total ?? 0) + value
  }
  return total
}

function engagementsTotal(rows: PlatformMetrics[]): number | null {
  const likes = sumMetric(rows, r => r.likes)
  const comments = sumMetric(rows, r => r.comments)
  const shares = sumMetric(rows, r => r.shares)
  const favorites = sumMetric(rows, r => r.favorites)
  if (likes === null || comments === null || shares === null || favorites === null) return null
  return likes + comments + shares + favorites
}

/** Finite percent change; unknown or a zero baseline that cannot scale is `null`. */
export function deltaPercent(current: number | null, baseline: number | null): number | null {
  if (current === null || baseline === null) return null
  if (baseline === 0) return current === 0 ? 0 : null
  return ((current - baseline) / baseline) * 100
}

export interface CompareMetricsInput {
  current: {
    impressions: number | null
    plays: number | null
    engagements: number | null
    followers: number | null
  }
  history: PlatformMetrics[]
  expectedPlatforms: PlatformId[]
  period: '7d' | '30d'
  currentWindowStart: string
  currentWindowEnd: string
}

export function compareMetrics(input: CompareMetricsInput): MetricsComparison {
  const { current, history, expectedPlatforms, period, currentWindowStart, currentWindowEnd } = input
  if (expectedPlatforms.length === 0) return emptyComparison()

  const prev = previousEqualLengthWindow(currentWindowStart, currentWindowEnd)
  if (!prev) return emptyComparison()

  const baselineRows: PlatformMetrics[] = []
  for (const platform of expectedPlatforms) {
    const row = selectBaselineRecord(history, platform, prev, period)
    if (!row) return emptyComparison()
    baselineRows.push(row)
  }

  return {
    period,
    impressionsDeltaPercent: deltaPercent(current.impressions, sumMetric(baselineRows, r => r.impressions)),
    playsDeltaPercent: deltaPercent(current.plays, sumMetric(baselineRows, r => r.plays)),
    engagementsDeltaPercent: deltaPercent(current.engagements, engagementsTotal(baselineRows)),
    followersDeltaPercent: deltaPercent(current.followers, sumMetric(baselineRows, r => r.followerDelta)),
  }
}
