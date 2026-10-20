import { describe, expect, it } from 'vitest'
import { MetricsCollector } from '../src/analytics/metrics-collector.js'
import { aggregateOverviewMetrics } from '../src/analytics/overview-aggregator.js'

/** Fixed clock so window bounds are exact rather than "about now". */
const NOW = new Date('2026-10-20T00:00:00.000Z')

describe('MetricsCollector window fields', () => {
  it('fills an identical non-empty window on the unmeasured path', async () => {
    const collector = new MetricsCollector({ now: () => NOW })
    const [row] = await collector.fetchPlatformMetrics(['bilibili'], '7d')

    expect(row!.source).toBe('unmeasured')
    expect(row!.windowStart).toBe('2026-10-13T00:00:00.000Z')
    expect(row!.windowEnd).toBe('2026-10-20T00:00:00.000Z')
    // Window bounds and the capture moment are separate concepts that must not
    // stand in for one another.
    expect(row!.capturedAt).toBe('2026-10-20T00:00:00.000Z')
  })

  it('fills the same window on the live path as on the unmeasured path', async () => {
    // An empty tab listing means every platform ends up unmeasured, but the
    // window must still be derived identically for both paths.
    const client = { callTool: async () => ({ content: [{ type: 'text', text: '' }] }) }
    const live = new MetricsCollector({ browserOsClient: client, now: () => NOW })
    const offline = new MetricsCollector({ now: () => NOW })

    const [liveRow] = await live.fetchPlatformMetrics(['bilibili'], '7d')
    const [offlineRow] = await offline.fetchPlatformMetrics(['bilibili'], '7d')

    expect(liveRow!.windowStart).toBe(offlineRow!.windowStart)
    expect(liveRow!.windowEnd).toBe(offlineRow!.windowEnd)
    expect(liveRow!.windowStart).not.toBeNull()
  })

  it('derives exact 7d and 30d bounds from a fixed clock', async () => {
    const collector = new MetricsCollector({ now: () => NOW })

    const [sevenDay] = await collector.fetchPlatformMetrics(['bilibili'], '7d')
    expect(sevenDay!.windowStart).toBe('2026-10-13T00:00:00.000Z')
    expect(sevenDay!.windowEnd).toBe('2026-10-20T00:00:00.000Z')

    const [thirtyDay] = await collector.fetchPlatformMetrics(['bilibili'], '30d')
    expect(thirtyDay!.windowStart).toBe('2026-09-20T00:00:00.000Z')
    expect(thirtyDay!.windowEnd).toBe('2026-10-20T00:00:00.000Z')

    // Both bounds must be parseable ISO 8601 instants.
    for (const row of [sevenDay!, thirtyDay!]) {
      expect(Number.isNaN(Date.parse(row.windowStart))).toBe(false)
      expect(Number.isNaN(Date.parse(row.windowEnd))).toBe(false)
      // `capturedAt` stays the capture moment regardless of the window length.
      expect(row.capturedAt).toBe('2026-10-20T00:00:00.000Z')
    }
  })

  it('marks rows unverified when no logged-in tab is open', async () => {
    // An empty tab listing means the platform is never scraped at all.
    const client = { callTool: async () => ({ content: [{ type: 'text', text: '' }] }) }
    const collector = new MetricsCollector({ browserOsClient: client, now: () => NOW })
    const [row] = await collector.fetchPlatformMetrics(['bilibili'], '7d')

    expect(row!.source).toBe('unmeasured')
    expect(row!.windowScope).toBe('unverified')
    expect(row!.note).toContain('未打开')
  })

  it('keeps a successfully scraped live row but withholds it from window totals', async () => {
    // A stub BrowserOS instance with a logged-in B站 tab whose dashboard parses.
    // This is the ONLY path where a real value is produced, so it is the one that
    // proves the window-provenance guard actually fires (regressing it to
    // 'verified' would let all-time figures back into the 7d/30d totals).
    const dashboardText =
      '视频数据专栏数据统计截至：2026-10-12（每日12点更新）实时数据查询 播放量 296 评论 2 弹幕 0 点赞 27 分享 1 收藏 13 投币 2粉丝概览粉丝总数1今日粉丝数变化+0'
    const client = {
      callTool: async (name: string) => {
        if (name === 'tabs') {
          return {
            content: [
              { type: 'text', text: '[2] https://member.bilibili.com/platform/home (B站)' },
            ],
          }
        }
        if (name === 'read') {
          return { content: [{ type: 'text', text: dashboardText }] }
        }
        return { content: [{ type: 'text', text: '' }] }
      },
    }
    const collector = new MetricsCollector({ browserOsClient: client, now: () => NOW })
    const [row] = await collector.fetchPlatformMetrics(['bilibili'], '7d')

    // The scrape genuinely succeeded and the numbers are kept for display...
    expect(row!.source).toBe('live')
    expect(row!.plays).toBe(296)
    expect(row!.likes).toBe(27)

    // ...and the success path fills the same window contract as every other path.
    // Asserted explicitly so swapping the bounds here cannot slip through.
    expect(row!.windowStart).toBe('2026-10-13T00:00:00.000Z')
    expect(row!.windowEnd).toBe('2026-10-20T00:00:00.000Z')
    expect(row!.capturedAt).toBe('2026-10-20T00:00:00.000Z')
    // Bounds are a closed interval: start is strictly before end.
    expect(Date.parse(row!.windowStart)).toBeLessThan(Date.parse(row!.windowEnd))

    // ...but an all-time dashboard figure is not a 7d increment, so it is marked
    // unverified and carries the reason for the withheld contribution.
    expect(row!.windowScope).toBe('unverified')
    expect(row!.note).toContain('累计')

    // End-to-end: the value must not reach the window totals.
    const overview = aggregateOverviewMetrics({
      outcomes: [row!],
      expectedPlatforms: ['bilibili'],
      calendarItems: [],
      readyChannelsCount: 1,
      totalChannelsCount: 1,
      now: NOW,
    })
    expect(overview.totalPlays).toBeNull()
    expect(overview.measuredPlatforms).toEqual([])
    expect(overview.unmeasuredPlatforms).toEqual(['bilibili'])
  })

  it('derives the 30d window on the live success path too', async () => {
    // Same logged-in tab, but a 30d request: the success path must honour the
    // requested window instead of always reporting 7d.
    const dashboardText = '播放量 296 评论 2 点赞 27 分享 1 收藏 13'
    const client = {
      callTool: async (name: string) => {
        if (name === 'tabs') {
          return {
            content: [
              { type: 'text', text: '[2] https://member.bilibili.com/platform/home (B站)' },
            ],
          }
        }
        if (name === 'read') {
          return { content: [{ type: 'text', text: dashboardText }] }
        }
        return { content: [{ type: 'text', text: '' }] }
      },
    }
    const collector = new MetricsCollector({ browserOsClient: client, now: () => NOW })
    const [row] = await collector.fetchPlatformMetrics(['bilibili'], '30d')

    expect(row!.source).toBe('live')
    expect(row!.windowStart).toBe('2026-09-20T00:00:00.000Z')
    expect(row!.windowEnd).toBe('2026-10-20T00:00:00.000Z')
    expect(row!.capturedAt).toBe('2026-10-20T00:00:00.000Z')
    expect(Date.parse(row!.windowStart)).toBeLessThan(Date.parse(row!.windowEnd))
  })

  it('marks mock rows as window-verified', async () => {
    const collector = new MetricsCollector({ mockOffline: true, now: () => NOW })
    const rows = await collector.fetchPlatformMetrics(['wechat_mp', 'bilibili'], '7d')

    for (const row of rows) {
      expect(row.windowScope).toBe('verified')
      expect(row.windowStart).toBe('2026-10-13T00:00:00.000Z')
      expect(row.windowEnd).toBe('2026-10-20T00:00:00.000Z')
    }
  })
})
