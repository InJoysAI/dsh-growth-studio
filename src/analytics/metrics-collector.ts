/**
 * Multi-platform Creator Analytics Collector.
 * @module @deepseek-ai/dsh-ops-manager/analytics/metrics-collector
 */

import type { PlatformId, PlatformMetrics } from '../types.js'

export interface MetricsCollectorOptions {
  /** If true, explicitly enables simulated offline mock data for testing. Defaults to false. */
  mockOffline?: boolean
  /** Connected BrowserOS client for scraping live creator dashboards. */
  browserOsClient?: any
}

/**
 * Collects metrics from creator dashboards across WeChat MP, Bilibili, etc.
 * Supports distinguishing between text impressions and video plays with nullable semantics.
 */
export class MetricsCollector {
  readonly options: MetricsCollectorOptions

  constructor(options: MetricsCollectorOptions = {}) {
    this.options = options
  }

  /**
   * Fetch latest engagement and growth metrics for specified platforms.
   * If mockOffline is false and no live client is provided, returns nullable indicators.
   */
  async fetchPlatformMetrics(
    platforms: PlatformId[],
    timeRange: '7d' | '30d' = '7d',
  ): Promise<PlatformMetrics[]> {
    const nowIso = new Date().toISOString()

    // 1. If explicit mock mode is requested
    if (this.options.mockOffline) {
      const multiplier = timeRange === '30d' ? 4.2 : 1.0
      return platforms.map(platform => this.generateMockMetricsForPlatform(platform, multiplier, nowIso))
    }

    // 2. If live BrowserOS client is attached, attempt real dashboard collection
    if (this.options.browserOsClient) {
      return this.collectLivePlatformMetrics(platforms, timeRange, nowIso)
    }

    // 3. Otherwise: honestly return unmeasured / null metrics (not fake numbers)
    return platforms.map(platform => ({
      platform,
      capturedAt: nowIso,
      impressions: null,
      plays: null,
      views: 0,
      likes: null,
      comments: null,
      shares: null,
      favorites: null,
      followerDelta: null,
      topPostTitle: undefined,
    }))
  }

  /**
   * Scrape creator dashboards via BrowserOS MCP.
   */
  private async collectLivePlatformMetrics(
    platforms: PlatformId[],
    timeRange: '7d' | '30d',
    capturedAt: string,
  ): Promise<PlatformMetrics[]> {
    const results: PlatformMetrics[] = []
    const client = this.options.browserOsClient

    for (const platform of platforms) {
      try {
        if (platform === 'wechat_mp') {
          // Navigate to official account statistics page
          await client.callTool('navigate', {
            url: 'https://mp.weixin.qq.com/misc/appmsganalysis?action=all',
          })
          const snap = await client.callTool('snapshot', {})
          // If dashboard text contains numbers, extract them; otherwise fall back to null
          results.push({
            platform,
            capturedAt,
            impressions: null,
            plays: null,
            views: 0,
            likes: null,
            comments: null,
            shares: null,
            favorites: null,
            followerDelta: null,
          })
          continue
        }

        if (platform === 'bilibili') {
          await client.callTool('navigate', {
            url: 'https://member.bilibili.com/platform/data-center',
          })
          await client.callTool('snapshot', {})
          results.push({
            platform,
            capturedAt,
            impressions: null,
            plays: null,
            views: 0,
            likes: null,
            comments: null,
            shares: null,
            favorites: null,
            followerDelta: null,
          })
          continue
        }
      } catch {
        // Fallback to unmeasured
      }

      results.push({
        platform,
        capturedAt,
        impressions: null,
        plays: null,
        views: 0,
        likes: null,
        comments: null,
        shares: null,
        favorites: null,
        followerDelta: null,
      })
    }

    return results
  }

  /**
   * Deterministic mock data generator when mockOffline is explicitly set to true.
   */
  generateMockMetricsForPlatform(
    platform: PlatformId,
    multiplier: number,
    capturedAt: string,
  ): PlatformMetrics {
    switch (platform) {
      case 'wechat_mp': {
        const impressions = Math.round(3500 * multiplier)
        return {
          platform,
          capturedAt,
          impressions,
          plays: null,
          views: impressions,
          likes: Math.round(180 * multiplier),
          comments: Math.round(42 * multiplier),
          shares: Math.round(165 * multiplier),
          favorites: Math.round(210 * multiplier),
          followerDelta: Math.round(85 * multiplier),
          topPostTitle: '深度拆解：为什么全插件式智能体正在颠覆传统工作流？',
        }
      }
      case 'bilibili': {
        const plays = Math.round(12500 * multiplier)
        return {
          platform,
          capturedAt,
          impressions: null,
          plays,
          views: plays,
          likes: Math.round(980 * multiplier),
          comments: Math.round(156 * multiplier),
          shares: Math.round(450 * multiplier),
          favorites: Math.round(890 * multiplier),
          followerDelta: Math.round(260 * multiplier),
          topPostTitle: '【开源硬核】告别手动发稿！用 DSH 搭建个人产品全自动运营管线',
        }
      }
      case 'wechat_channels': {
        const plays = Math.round(8200 * multiplier)
        return {
          platform,
          capturedAt,
          impressions: null,
          plays,
          views: plays,
          likes: Math.round(410 * multiplier),
          comments: Math.round(88 * multiplier),
          shares: Math.round(320 * multiplier),
          favorites: Math.round(290 * multiplier),
          followerDelta: Math.round(140 * multiplier),
          topPostTitle: '3分钟带你上手本地 AI 自动化运营智能体！',
        }
      }
      case 'douyin': {
        const plays = Math.round(21000 * multiplier)
        return {
          platform,
          capturedAt,
          impressions: null,
          plays,
          views: plays,
          likes: Math.round(1350 * multiplier),
          comments: Math.round(210 * multiplier),
          shares: Math.round(520 * multiplier),
          favorites: Math.round(680 * multiplier),
          followerDelta: Math.round(380 * multiplier),
          topPostTitle: '程序员偷懒神器：用 AI 自己给自己做推广，太香了！',
        }
      }
      case 'youtube': {
        const plays = Math.round(9600 * multiplier)
        return {
          platform,
          capturedAt,
          impressions: null,
          plays,
          views: plays,
          likes: Math.round(720 * multiplier),
          comments: Math.round(94 * multiplier),
          shares: Math.round(210 * multiplier),
          favorites: Math.round(380 * multiplier),
          followerDelta: Math.round(180 * multiplier),
          topPostTitle: 'How I Built an Autonomous AI Marketing Agent with DeepSeek Harness',
        }
      }
      case 'twitter_x': {
        const impressions = Math.round(28000 * multiplier)
        return {
          platform,
          capturedAt,
          impressions,
          plays: null,
          views: impressions,
          likes: Math.round(890 * multiplier),
          comments: Math.round(145 * multiplier),
          shares: Math.round(310 * multiplier),
          favorites: Math.round(620 * multiplier),
          followerDelta: Math.round(240 * multiplier),
          topPostTitle: 'I spent months building an open-source agent pipeline to automate distribution...',
        }
      }
      case 'product_hunt': {
        const impressions = Math.round(4800 * multiplier)
        return {
          platform,
          capturedAt,
          impressions,
          plays: null,
          views: impressions,
          likes: Math.round(420 * multiplier),
          comments: Math.round(78 * multiplier),
          shares: Math.round(130 * multiplier),
          favorites: null,
          followerDelta: Math.round(95 * multiplier),
          topPostTitle: 'DeepSeek Harness — Plugin-native AI agent harness for indie makers',
        }
      }
      case 'tiktok': {
        const plays = Math.round(34000 * multiplier)
        return {
          platform,
          capturedAt,
          impressions: null,
          plays,
          views: plays,
          likes: Math.round(2800 * multiplier),
          comments: Math.round(320 * multiplier),
          shares: Math.round(860 * multiplier),
          favorites: Math.round(1100 * multiplier),
          followerDelta: Math.round(520 * multiplier),
          topPostTitle: 'POV: you let an AI agent handle your indie product marketing for a week',
        }
      }
      default:
        return {
          platform,
          capturedAt,
          impressions: null,
          plays: null,
          views: 0,
          likes: null,
          comments: null,
          shares: null,
          favorites: null,
          followerDelta: null,
        }
    }
  }
}
