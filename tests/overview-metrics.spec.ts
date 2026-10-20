import { describe, expect, it } from 'vitest'
import {
  aggregateOverviewMetrics,
  buildWeeklyPipeline,
  currentWeekRange,
} from '../src/analytics/overview-aggregator.js'
import type { PlatformMetricsOutcome } from '../src/analytics/metrics-collector.js'
import type { CalendarItem, ItemStatus, PlatformId } from '../src/types.js'

/**
 * A measured, window-verified outcome. Defaults are all-null so each test only
 * states the metric it cares about; a real 0 must be passed explicitly.
 */
function outcome(
  platform: PlatformId,
  metrics: Partial<PlatformMetricsOutcome> = {},
): PlatformMetricsOutcome {
  return {
    platform,
    capturedAt: '2026-10-20T00:00:00.000Z',
    windowStart: '2026-10-13T00:00:00.000Z',
    windowEnd: '2026-10-20T00:00:00.000Z',
    impressions: null,
    plays: null,
    views: 0,
    likes: null,
    comments: null,
    shares: null,
    favorites: null,
    followerDelta: null,
    source: 'mock',
    windowScope: 'verified',
    ...metrics,
  }
}

/** An outcome whose numbers exist but cannot be proven to belong to the window. */
function unverifiedOutcome(
  platform: PlatformId,
  metrics: Partial<PlatformMetricsOutcome> = {},
): PlatformMetricsOutcome {
  return outcome(platform, { ...metrics, source: 'live', windowScope: 'unverified' })
}

function unmeasuredOutcome(platform: PlatformId): PlatformMetricsOutcome {
  return outcome(platform, { source: 'unmeasured', windowScope: 'unverified', views: 0 })
}

/** Noon UTC on the Wednesday of the week starting Monday 2026-10-19. */
const NOW = new Date('2026-10-21T12:00:00.000Z')

function aggregate(
  outcomes: PlatformMetricsOutcome[],
  calendarItems: CalendarItem[] = [],
): ReturnType<typeof aggregateOverviewMetrics> {
  return aggregateOverviewMetrics({
    outcomes,
    expectedPlatforms: ['wechat_mp', 'bilibili'],
    calendarItems,
    readyChannelsCount: 1,
    totalChannelsCount: 2,
    now: NOW,
  })
}

describe('overview aggregator: platform coverage gate', () => {
  it('returns null totals when only one of two expected platforms was measured', () => {
    const result = aggregate([
      outcome('wechat_mp', { impressions: 1200, likes: 30, comments: 4, shares: 5, favorites: 6 }),
      unmeasuredOutcome('bilibili'),
    ])

    expect(result.totalImpressions).toBeNull()
    expect(result.totalPlays).toBeNull()
    expect(result.totalLikes).toBeNull()
    expect(result.totalEngagements).toBeNull()
    expect(result.measuredPlatforms).toEqual(['wechat_mp'])
    expect(result.unmeasuredPlatforms).toEqual(['bilibili'])
  })

  it('sums each platform when the expected set is fully measured', () => {
    const result = aggregate([
      outcome('wechat_mp', { impressions: 1000, likes: 10, comments: 2, shares: 3, favorites: 4 }),
      outcome('bilibili', { plays: 2500, likes: 40, comments: 5, shares: 6, favorites: 7 }),
    ])

    expect(result.totalImpressions).toBe(1000)
    expect(result.totalPlays).toBe(2500)
    expect(result.totalLikes).toBe(50)
    expect(result.measuredPlatforms).toEqual(['wechat_mp', 'bilibili'])
    expect(result.unmeasuredPlatforms).toEqual([])
  })

  it('never treats an unverified-window platform as measured', () => {
    const result = aggregate([
      outcome('wechat_mp', { impressions: 1000 }),
      unverifiedOutcome('bilibili', { plays: 2500 }),
    ])

    // B站 was scraped, but its figure is an all-time total, not a 7d increment.
    expect(result.totalImpressions).toBeNull()
    expect(result.totalPlays).toBeNull()
    expect(result.measuredPlatforms).toEqual(['wechat_mp'])
    expect(result.unmeasuredPlatforms).toEqual(['bilibili'])
  })
})

describe('overview aggregator: zero vs missing', () => {
  it('counts a real 0 as a value while keeping an unsupported metric null', () => {
    const result = aggregate([
      outcome('wechat_mp', { impressions: 0, likes: 0, comments: 0, shares: 0, favorites: 0 }),
      outcome('bilibili', { plays: 300, likes: 0, comments: 0, shares: 0, favorites: 0 }),
    ])

    // A genuine 0 participates in the sum rather than being dropped.
    expect(result.totalImpressions).toBe(0)
    expect(result.totalLikes).toBe(0)
    expect(result.totalPlays).toBe(300)
  })

  it('leaves a metric null when no platform can report it', () => {
    const result = aggregate([
      outcome('wechat_mp', { impressions: 10 }),
      outcome('bilibili', { plays: 20 }),
    ])

    // Neither platform reports 收藏, so the total is unknown — never 0.
    expect(result.totalFavorites).toBeNull()
    expect(result.totalEngagements).toBeNull()
  })
})

describe('overview aggregator: engagement total', () => {
  it('sums all four sub-totals when every one is known', () => {
    const result = aggregate([
      outcome('wechat_mp', { likes: 10, comments: 2, shares: 3, favorites: 4 }),
      outcome('bilibili', { likes: 20, comments: 5, shares: 6, favorites: 7 }),
    ])

    expect(result.totalLikes).toBe(30)
    expect(result.totalComments).toBe(7)
    expect(result.totalShares).toBe(9)
    expect(result.totalFavorites).toBe(11)
    expect(result.totalEngagements).toBe(57)
  })

  it('sums the non-null contributions of a platform-specific metric', () => {
    const result = aggregate([
      // 公众号 reports no 收藏 figure at all; 视频/B站 does.
      outcome('wechat_mp', { likes: 10, comments: 2, shares: 3, favorites: null }),
      outcome('bilibili', { likes: 20, comments: 5, shares: 6, favorites: 7 }),
    ])

    // A metric one platform does not expose is not "partial coverage" — the
    // platform-level gate already passed, so the known contribution stands.
    expect(result.totalFavorites).toBe(7)
    expect(result.totalLikes).toBe(30)
    expect(result.totalEngagements).toBe(53)
  })

  it('returns null when a sub-total itself is unknown', () => {
    const result = aggregate([
      outcome('wechat_mp', { likes: 10, comments: 2, shares: 3, favorites: null }),
      outcome('bilibili', { likes: 20, comments: 5, shares: 6, favorites: null }),
    ])

    // No platform could report 收藏, so that sub-total is unknown and the
    // engagement total must not be approximated from the other three.
    expect(result.totalFavorites).toBeNull()
    expect(result.totalLikes).toBe(30)
    expect(result.totalEngagements).toBeNull()
  })

  it('treats an omitted (undefined) favorites as unknown, not as 0', () => {
    const result = aggregate([
      outcome('wechat_mp', { likes: 10, comments: 2, shares: 3, favorites: undefined }),
      outcome('bilibili', { likes: 20, comments: 5, shares: 6, favorites: undefined }),
    ])

    // Were `undefined` folded to 0, this would read as a real 0 instead of unknown.
    expect(result.totalFavorites).toBeNull()
    expect(result.totalEngagements).toBeNull()
  })
})

describe('overview aggregator: impressions / plays are independent', () => {
  it('lets a video channel contribute plays only, without borrowing views', () => {
    const result = aggregate([
      outcome('wechat_mp', { impressions: 100, likes: 1, comments: 1, shares: 1, favorites: 1 }),
      outcome('bilibili', {
        impressions: null,
        plays: 500,
        // The compatibility field is populated, but it must not feed impressions.
        views: 500,
        likes: 1,
        comments: 1,
        shares: 1,
        favorites: 1,
      }),
    ])

    expect(result.totalPlays).toBe(500)
    // Only 公众号 reported impressions; the video channel did not borrow `views`.
    expect(result.totalImpressions).toBe(100)
  })

  it('ignores the compatibility views field when both metrics are null', () => {
    const result = aggregate([
      outcome('wechat_mp', { impressions: null, plays: null, views: 0 }),
      outcome('bilibili', { impressions: null, plays: null, views: 0 }),
    ])

    expect(result.totalImpressions).toBeNull()
    expect(result.totalPlays).toBeNull()
  })
})

describe('weekly pipeline', () => {
  function calendarItem(date: string, status: ItemStatus, id = `${date}-${status}`): CalendarItem {
    return {
      id,
      date,
      platform: 'wechat_mp',
      kind: 'article',
      topic: '测试排期项',
      status,
      createdAt: `${date}T00:00:00.000Z`,
      updatedAt: `${date}T00:00:00.000Z`,
    }
  }

  it('uses a Monday-based natural week', () => {
    expect(currentWeekRange(NOW)).toEqual({ start: '2026-10-19', end: '2026-10-25' })
    // Sunday belongs to the week that started the previous Monday.
    expect(currentWeekRange(new Date('2026-10-25T12:00:00.000Z'))).toEqual({
      start: '2026-10-19',
      end: '2026-10-25',
    })
  })

  it('counts only this week and splits completed into prefilled + published', () => {
    const pipeline = buildWeeklyPipeline(
      [
        calendarItem('2026-10-12', 'planned', 'last-week'),
        calendarItem('2026-10-19', 'prefilled', 'this-monday'),
        calendarItem('2026-10-21', 'published', 'this-wednesday'),
        calendarItem('2026-10-22', 'drafting', 'this-thursday'),
        calendarItem('2026-10-26', 'planned', 'next-week'),
      ],
      NOW,
    )

    expect(pipeline.total).toBe(3)
    expect(pipeline.completed).toBe(2)
    expect(pipeline.byStatus).toEqual({
      planned: 0,
      drafting: 1,
      draft_ready: 0,
      prefilled: 1,
      published: 1,
    })
  })

  it('covers every ItemStatus in byStatus', () => {
    const pipeline = buildWeeklyPipeline([], NOW)

    expect(Object.keys(pipeline.byStatus).sort()).toEqual(
      ['planned', 'drafting', 'draft_ready', 'prefilled', 'published'].sort(),
    )
  })

  it('is a zero structure when the source list is empty', () => {
    const pipeline = buildWeeklyPipeline([], NOW)

    expect(pipeline.total).toBe(0)
    expect(pipeline.completed).toBe(0)
    expect(Object.values(pipeline.byStatus).every(count => count === 0)).toBe(true)
  })

  it('is a zero structure when every row falls in another week', () => {
    const pipeline = buildWeeklyPipeline(
      [calendarItem('2026-10-13', 'published', 'last-week'), calendarItem('2026-10-27', 'planned', 'next-week')],
      NOW,
    )

    // A non-empty source list must not be blanked, but out-of-week rows still
    // contribute nothing to this week's progress.
    expect(pipeline.total).toBe(0)
    expect(pipeline.completed).toBe(0)
    expect(Object.values(pipeline.byStatus).every(count => count === 0)).toBe(true)
  })

  it('reports comparison as null everywhere when no history exists', () => {
    const result = aggregate([outcome('wechat_mp'), outcome('bilibili')])

    expect(result.comparison).toEqual({
      period: null,
      impressionsDeltaPercent: null,
      playsDeltaPercent: null,
      engagementsDeltaPercent: null,
      followersDeltaPercent: null,
    })
  })
})
