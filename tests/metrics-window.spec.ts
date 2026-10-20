import { describe, expect, it } from 'vitest'
import { MetricsCollector } from '../src/analytics/metrics-collector.js'

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

  it('marks live scrapes as unverified window scope with a reason', async () => {
    const client = { callTool: async () => ({ content: [{ type: 'text', text: '' }] }) }
    const collector = new MetricsCollector({ browserOsClient: client, now: () => NOW })
    const [row] = await collector.fetchPlatformMetrics(['bilibili'], '7d')

    // Dashboards expose all-time / yesterday figures, so the scope stays
    // unverified and the row carries an explanatory note.
    expect(row!.windowScope).toBe('unverified')
    expect(row!.note).toBeTruthy()
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
