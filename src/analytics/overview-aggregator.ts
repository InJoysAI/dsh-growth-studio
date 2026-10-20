/**
 * `workbench.overview` aggregation rules.
 *
 * Kept as pure functions so the two rules that are non-negotiable — "partial
 * coverage must never masquerade as a whole-network total" and "a real 0 is a
 * value, `null` is unknown" — can be tested without going through the RPC pipe.
 *
 * @module @deepseek-ai/dsh-growth-studio/analytics/overview-aggregator
 */

import type {
  CalendarItem,
  ItemStatus,
  OverviewMetrics,
  PlatformId,
  WeeklyPipeline,
} from '../types.js'
import type { PlatformMetricsOutcome } from './metrics-collector.js'
import { EMPTY_COMPARISON } from './metrics-comparison.js'

/** Every `ItemStatus`, in lifecycle order; used to seed `byStatus`. */
const ITEM_STATUSES: readonly ItemStatus[] = [
  'planned',
  'drafting',
  'draft_ready',
  'prefilled',
  'published',
]

/** Statuses that count as done for the week's pipeline progress. */
const COMPLETED_STATUSES: readonly ItemStatus[] = ['prefilled', 'published']



export interface AggregateOverviewInput {
  /** Per-platform collection outcomes, including their window provenance. */
  outcomes: PlatformMetricsOutcome[]
  /** The expected platform set `P` — every member must be measured for a total. */
  expectedPlatforms: PlatformId[]
  /** Rows read from Injoys; may be non-empty and may include other weeks. */
  calendarItems: CalendarItem[]
  readyChannelsCount: number
  /** Total supported platforms in this phase. */
  totalChannelsCount: number
  /** Clock used to resolve "this week"; injectable so tests stay deterministic. */
  now?: Date
}

/**
 * Whether a platform's numbers may contribute to a window total.
 *
 * A successful scrape is not enough: the scraped figures must be provably for
 * the REQUESTED window. Dashboards that only expose "today" or "all time" can
 * never be relabelled as a 7d/30d increment (architecture §3.1「指标口径」).
 */
function contributesToWindow(outcome: PlatformMetricsOutcome): boolean {
  if (outcome.source === 'unmeasured') return false
  return outcome.windowScope === 'verified'
}

/**
 * Sum one metric across the measured platforms.
 *
 * `null` means unknown and never enters the sum; a real `0` does. When no
 * platform contributed a value the result is `null`, not `0`.
 */
function sumMetric(
  outcomes: PlatformMetricsOutcome[],
  pick: (outcome: PlatformMetricsOutcome) => number | null | undefined,
): number | null {
  let total: number | null = null
  for (const outcome of outcomes) {
    const value = pick(outcome)
    if (value === null || value === undefined) continue
    total = (total ?? 0) + value
  }
  return total
}

/** Monday-based bounds of the week containing `now`, as `YYYY-MM-DD`. */
export function currentWeekRange(now: Date): { start: string; end: string } {
  const dayMs = 24 * 60 * 60 * 1000
  // `getUTCDay()` is 0 for Sunday; shift so Monday is day 0 of the week.
  const offsetFromMonday = (now.getUTCDay() + 6) % 7
  const monday = new Date(now.getTime() - offsetFromMonday * dayMs)
  const sunday = new Date(monday.getTime() + 6 * dayMs)
  return {
    start: monday.toISOString().slice(0, 10),
    end: sunday.toISOString().slice(0, 10),
  }
}

/**
 * Week-to-date pipeline counts, restricted to the CURRENT natural week.
 *
 * Rows from other weeks are dropped; an empty result is a genuine zero
 * structure, and a non-empty source list is never blanked wholesale. `date` is
 * `YYYY-MM-DD`, so lexicographic comparison is chronological.
 */
export function buildWeeklyPipeline(calendarItems: CalendarItem[], now: Date): WeeklyPipeline {
  const { start, end } = currentWeekRange(now)
  const byStatus = Object.fromEntries(ITEM_STATUSES.map(status => [status, 0])) as Record<
    ItemStatus,
    number
  >

  let total = 0
  let completed = 0
  for (const item of calendarItems) {
    if (typeof item.date !== 'string' || item.date < start || item.date > end) continue
    if (!(item.status in byStatus)) continue
    total += 1
    byStatus[item.status] += 1
    if (COMPLETED_STATUSES.includes(item.status)) completed += 1
  }

  return { total, completed, byStatus }
}

/**
 * Build the `overviewMetrics` block for `workbench.overview`.
 *
 * The coverage gate is PLATFORM level: unless every expected platform yields
 * window-provenance numbers, every total is `null`. Summing only the platforms
 * that happened to succeed would present a partial slice as the whole network.
 */
export function aggregateOverviewMetrics(input: AggregateOverviewInput): OverviewMetrics {
  const { outcomes, expectedPlatforms, calendarItems, readyChannelsCount, totalChannelsCount } = input
  const now = input.now ?? new Date()

  const measuredPlatforms = outcomes
    .filter(contributesToWindow)
    .map(outcome => outcome.platform)
    .filter(platform => expectedPlatforms.includes(platform))

  const unmeasuredPlatforms = expectedPlatforms.filter(
    platform => !measuredPlatforms.includes(platform),
  )

  const coverageComplete =
    expectedPlatforms.length > 0 &&
    expectedPlatforms.every(platform => measuredPlatforms.includes(platform))

  // Only window-verified platforms may contribute; the gate below decides
  // whether a number is reported at all.
  const contributing = outcomes.filter(
    outcome =>
      contributesToWindow(outcome) && expectedPlatforms.includes(outcome.platform),
  )

  const totalLikes = coverageComplete ? sumMetric(contributing, o => o.likes) : null
  const totalComments = coverageComplete ? sumMetric(contributing, o => o.comments) : null
  const totalShares = coverageComplete ? sumMetric(contributing, o => o.shares) : null
  const totalFavorites = coverageComplete ? sumMetric(contributing, o => o.favorites) : null

  // Engagement total is only meaningful when all four sub-totals are known.
  const totalEngagements =
    totalLikes !== null &&
    totalComments !== null &&
    totalShares !== null &&
    totalFavorites !== null
      ? totalLikes + totalComments + totalShares + totalFavorites
      : null

  return {
    totalImpressions: coverageComplete ? sumMetric(contributing, o => o.impressions) : null,
    totalPlays: coverageComplete ? sumMetric(contributing, o => o.plays) : null,
    totalLikes,
    totalComments,
    totalShares,
    totalFavorites,
    totalFollowersDelta: coverageComplete ? sumMetric(contributing, o => o.followerDelta) : null,
    totalEngagements,
    scheduledCount: calendarItems.length,
    weeklyPipeline: buildWeeklyPipeline(calendarItems, now),
    readyChannelsCount,
    totalChannelsCount,
    measuredPlatforms,
    unmeasuredPlatforms,
    metricsAnnotation: '全网非去重曝光与播放累计人次',
    comparison: { ...EMPTY_COMPARISON },
  }
}
