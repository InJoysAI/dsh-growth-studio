/**
 * Multi-platform Creator Analytics Collector.
 * @module @deepseek-ai/dsh-ops-manager/analytics/metrics-collector
 */

import type { PlatformId, PlatformMetrics } from '../types.js'
import type { BrowserOsMcpClient } from '../browser/browser-driver.js'
import { BrowserOsSession } from '../browser/browseros-ops.js'

export interface MetricsCollectorOptions {
  /** If true, explicitly enables simulated offline mock data for testing. Defaults to false. */
  mockOffline?: boolean
  /** Connected BrowserOS client for scraping live creator dashboards. */
  browserOsClient?: BrowserOsMcpClient
  /** Clock used to stamp `capturedAt` and derive the request window; injectable for tests. */
  now?: () => Date
}

/** Where a metric value came from, so a real 0 is never confused with "not measured". */
export type MetricsSource = 'live' | 'unmeasured' | 'mock'

/**
 * Whether the scraped numbers are provably for the REQUESTED window.
 *
 * `'verified'` means the value is a window increment (mock data is generated per
 * requested window, so it is window-scoped by construction). `'unverified'` means
 * the dashboard only exposes an "all time" / "today" / "yesterday" figure, which
 * must never be relabelled as a 7d/30d increment — such a contribution stays
 * unknown to the aggregator (architecture §3.1「指标口径」).
 */
export type MetricsWindowScope = 'verified' | 'unverified'

/** Per-platform extraction outcome. */
export interface PlatformMetricsOutcome extends PlatformMetrics {
  source: MetricsSource
  /** Whether these numbers are provably scoped to the requested window. */
  windowScope: MetricsWindowScope
  /** Why the platform could not be measured; absent when measured. */
  note?: string
  /** Total followers at capture time, when the page reports one. */
  followerTotal?: number | undefined
  /** Number of published posts counted on the page, when reported. */
  postCount?: number | undefined
}


/**
 * Why a live scrape cannot be counted as a window increment.
 *
 * The creator dashboards report all-time totals (B站 播放量), per-post lifetime
 * sums (抖音), or single-day figures (视频号「昨日数据」). None of them exposes the
 * requested window's increment, so the value is kept but its contribution is
 * withheld from window totals rather than being relabelled.
 */
const UNVERIFIED_WINDOW_NOTE =
  '页面口径为累计 / 昨日数据，无法证实属于所请求统计窗口，未计入窗口汇总'

/** How one platform's numbers are scraped. */
interface PlatformScrapeSpec {
  /** Hostname of an already-open, logged-in tab to reuse. */
  host: string
  /** URL opened inside that tab when the dashboard data is not already visible. */
  dashboardUrl: string
  /** Pull numbers out of page text. */
  parse: (text: string) => Partial<PlatformMetricsOutcome>
  /** Shown when `parse` yields nothing, in place of the generic message. */
  emptyNote?: string
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
   *
   * `timeRange` is the REQUESTED window. It is forwarded to every path so the
   * window bounds are derived from the caller's request rather than hardcoded.
   */
  async fetchPlatformMetrics(
    platforms: PlatformId[],
    timeRange: '7d' | '30d' = '7d',
  ): Promise<PlatformMetricsOutcome[]> {
    const capturedAt = this.now().toISOString()
    const { windowStart, windowEnd } = this.resolveWindow(timeRange, capturedAt)

    // 1. If explicit mock mode is requested
    if (this.options.mockOffline) {
      const multiplier = timeRange === '30d' ? 4.2 : 1.0
      return platforms.map(platform => ({
        ...this.generateMockMetricsForPlatform(platform, multiplier, capturedAt),
        windowStart,
        windowEnd,
        source: 'mock' as const,
        // Mock figures are generated per requested window, so they are scoped to it.
        windowScope: 'verified' as const,
      }))
    }

    // 2. If live BrowserOS client is attached, attempt real dashboard collection
    if (this.options.browserOsClient) {
      return this.collectLivePlatformMetrics(platforms, capturedAt, windowStart, windowEnd)
    }

    // 3. Otherwise: honestly return unmeasured / null metrics (not fake numbers)
    return platforms.map(platform =>
      this.unmeasured(platform, capturedAt, windowStart, windowEnd, 'BrowserOS MCP 未接入'),
    )
  }

  /** Injectable clock; defaults to the real one. */
  private now(): Date {
    return this.options.now ? this.options.now() : new Date()
  }

  /**
   * Bounds of the requested statistics window, as a half-open ISO 8601 range
   * ending at the capture start.
   */
  private resolveWindow(
    timeRange: '7d' | '30d',
    capturedAt: string,
  ): { windowStart: string; windowEnd: string } {
    const days = timeRange === '30d' ? 30 : 7
    const end = new Date(capturedAt)
    const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000)
    return { windowStart: start.toISOString(), windowEnd: end.toISOString() }
  }

  /** A metrics row that states plainly that nothing was measured. */
  private unmeasured(
    platform: PlatformId,
    capturedAt: string,
    windowStart: string,
    windowEnd: string,
    note: string,
  ): PlatformMetricsOutcome {
    return {
      platform,
      capturedAt,
      windowStart,
      windowEnd,
      impressions: null,
      plays: null,
      views: 0,
      likes: null,
      comments: null,
      shares: null,
      favorites: null,
      followerDelta: null,
      source: 'unmeasured',
      windowScope: 'unverified',
      note,
    }
  }

  /**
   * Scrape creator dashboards via BrowserOS MCP.
   *
   * Each platform reuses an already-open logged-in tab when one exists, because
   * a freshly opened tab does not inherit the platform session.
   */
  private async collectLivePlatformMetrics(
    platforms: PlatformId[],
    capturedAt: string,
    windowStart: string,
    windowEnd: string,
  ): Promise<PlatformMetricsOutcome[]> {
    const client = this.options.browserOsClient!
    const session = new BrowserOsSession(client)
    const results: PlatformMetricsOutcome[] = []

    for (const platform of platforms) {
      const spec = PLATFORM_SCRAPE_SPECS[platform]
      if (!spec) {
        results.push(
          this.unmeasured(
            platform,
            capturedAt,
            windowStart,
            windowEnd,
            `平台 ${platform} 暂无采集配置`,
          ),
        )
        continue
      }

      try {
        const tab = await session.findTabByHost(spec.host)
        if (!tab) {
          results.push(
            this.unmeasured(
              platform,
              capturedAt,
              windowStart,
              windowEnd,
              `浏览器中未打开 ${spec.host} 的已登录页面`,
            ),
          )
          continue
        }

        // A dashboard can render in stages, so the page is read more than once
        // and the longest text wins — a short read is a loading frame, not data.
        let text = ''
        let parsed: Partial<PlatformMetricsOutcome> = {}
        for (let attempt = 0; attempt < 3; attempt += 1) {
          text = await session.openAndRead(tab.page, spec.dashboardUrl)
          parsed = spec.parse(text)
          if (Object.keys(parsed).length > 0) break
          await session.wait(tab.page, 2000)
        }

        const found = Object.keys(parsed).length > 0

        // WeChat answers a stale session with a login gate rather than data.
        const note = found
          ? UNVERIFIED_WINDOW_NOTE
          : isWechatLoginGate(text)
            ? '微信会话已过期，需在浏览器中重新扫码登录'
            : (spec.emptyNote ?? '页面已读取，但未解析到数据')

        results.push({
          platform,
          capturedAt,
          windowStart,
          windowEnd,
          impressions: parsed.impressions ?? null,
          plays: parsed.plays ?? null,
          views: parsed.views ?? parsed.impressions ?? parsed.plays ?? 0,
          likes: parsed.likes ?? null,
          comments: parsed.comments ?? null,
          shares: parsed.shares ?? null,
          favorites: parsed.favorites ?? null,
          followerDelta: parsed.followerDelta ?? null,
          topPostTitle: parsed.topPostTitle,
          source: found ? 'live' : 'unmeasured',
          // These dashboards expose all-time / yesterday figures, never a window
          // increment, so the numbers cannot be proven to belong to this window.
          windowScope: 'unverified',
          note,
        })
      } catch (err: any) {
        results.push(
          this.unmeasured(
            platform,
            capturedAt,
            windowStart,
            windowEnd,
            `采集失败: ${err?.message ?? '未知异常'}`,
          ),
        )
      }
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
  ): Omit<PlatformMetrics, 'windowStart' | 'windowEnd'> {
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

// ─── Live scraping rules ────────────────────────────────────────────────────

/**
 * Pull the first number that follows `label` in page text.
 *
 * Dashboards render label and value as separate text nodes, so the value is
 * whatever number appears after the label, not necessarily adjacent to it.
 * Chinese full-width digits and thousands separators are tolerated.
 */
function numberAfterLabel(text: string, labels: string[]): number | undefined {
  for (const label of labels) {
    const index = text.indexOf(label)
    if (index === -1) continue
    const tail = text.slice(index + label.length, index + label.length + 60)
    const match = tail.match(/(\d[\d,，\.]*)/)
    if (!match) continue
    const value = Number(match[1].replace(/[,，]/g, ''))
    if (Number.isFinite(value)) return value
  }
  return undefined
}

/**
 * Sum the numbers that follow `label`, but only where `label` is immediately
 * preceded by `anchor`.
 *
 * A per-post table repeats the same label for every row, while unrelated text
 * can contain the same word (for example 抖音's "2秒跳出率51.5%" also contains
 * a bare number after a metric word). Requiring the anchor keeps the sum to the
 * rows that actually belong to the metric.
 */
function sumAnchored(
  text: string,
  anchor: string,
  label: string,
): number | undefined {
  let total = 0
  let found = false
  const pattern = new RegExp(`${anchor}${label}\\s*(\\d[\\d,]*)`, 'g')
  let match: RegExpExecArray | null
  while ((match = pattern.exec(text)) !== null) {
    const value = Number(match[1].replace(/,/g, ''))
    if (Number.isFinite(value)) {
      total += value
      found = true
    }
  }
  return found ? total : undefined
}

/** Parse a B站 creator-home page: a labelled summary block plus 粉丝概览. */
export function parseBilibili(text: string): Partial<PlatformMetricsOutcome> {
  const plays = numberAfterLabel(text, ['播放量'])
  const comments = numberAfterLabel(text, ['评论'])
  const danmaku = numberAfterLabel(text, ['弹幕'])
  const likes = numberAfterLabel(text, ['点赞'])
  const shares = numberAfterLabel(text, ['分享'])
  const favorites = numberAfterLabel(text, ['收藏'])
  const coins = numberAfterLabel(text, ['投币'])

  // 粉丝总数 1 今日粉丝数变化 +0 — the follower block follows the video block.
  const followerTotal = numberAfterLabel(text, ['粉丝总数'])
  const followerDelta = numberAfterLabel(text, ['今日粉丝数变化', '今日粉丝变化'])

  const out: Partial<PlatformMetricsOutcome> = {}
  if (plays !== undefined) {
    out.plays = plays
    out.views = plays
  }
  if (likes !== undefined) out.likes = likes
  if (comments !== undefined) out.comments = comments
  if (danmaku !== undefined) out.comments = (out.comments ?? 0) + danmaku
  if (shares !== undefined) out.shares = shares
  if (favorites !== undefined) out.favorites = favorites
  if (coins !== undefined) out.favorites = (out.favorites ?? 0) + coins
  if (followerDelta !== undefined) out.followerDelta = followerDelta
  if (followerTotal !== undefined) out.followerTotal = followerTotal
  return out
}

/**
 * Parse a 抖音 content-manager page.
 *
 * Every published work renders as
 * `...已发布播放<n>点赞<n>评论<n>分享<n>收藏<n>完播率…2秒跳出率…吸粉量<n>`,
 * so each metric is summed across the `已发布` rows. 完播率/跳出率 numbers are
 * excluded because they never follow one of the counted labels.
 */
export function parseDouyin(text: string): Partial<PlatformMetricsOutcome> {
  const plays = sumAnchored(text, '已发布', '播放')
  const likes = sumAnchored(text, '已发布播放\\d+', '点赞')
  const comments = sumAnchored(text, '点赞\\d+', '评论')
  const shares = sumAnchored(text, '评论\\d+', '分享')
  const favorites = sumAnchored(text, '分享\\d+', '收藏')
  const followers = sumAnchored(text, '2秒跳出率[\\d.]+%', '吸粉量')

  const out: Partial<PlatformMetricsOutcome> = {}
  if (plays !== undefined) {
    out.plays = plays
    out.views = plays
  }
  if (likes !== undefined) out.likes = likes
  if (comments !== undefined) out.comments = comments
  if (shares !== undefined) out.shares = shares
  if (favorites !== undefined) out.favorites = favorites
  if (followers !== undefined) out.followerDelta = followers
  return out
}

/**
 * Parse a 视频号 assistant home page.
 *
 * Renders as `视频<n>关注者<n> … 昨日数据 净增关注 <n> 新增播放 <n> 新增 <n> 新增评论 <n>`.
 * The follower count is anchored to 关注者 so the "视频号ID" label cannot
 * satisfy the post-count lookup.
 */
export function parseWechatChannels(text: string): Partial<PlatformMetricsOutcome> {
  const followerDelta = numberAfterLabel(text, ['净增关注'])
  const plays = numberAfterLabel(text, ['新增播放'])
  const comments = numberAfterLabel(text, ['新增评论'])

  const followerTotal = numberAfterLabel(text, ['关注者'])
  // "视频号ID" must not satisfy this; anchor on a digit right after 视频.
  const postMatch = text.match(/视频\s*(\d+)/)
  const postCount = postMatch ? Number(postMatch[1]) : undefined

  const out: Partial<PlatformMetricsOutcome> = {}
  if (plays !== undefined) {
    out.plays = plays
    out.views = plays
  }
  if (comments !== undefined) out.comments = comments
  if (followerDelta !== undefined) out.followerDelta = followerDelta
  if (followerTotal !== undefined) out.followerTotal = followerTotal
  if (postCount !== undefined) out.postCount = postCount
  return out
}

/**
 * Parse a 公众号 home page.
 *
 * The home page carries only the account summary, so follower counts are
 * reported and impressions are left null rather than guessed.
 */
export function parseWechatMp(text: string): Partial<PlatformMetricsOutcome> {
  const followers = numberAfterLabel(text, ['总用户数', '关注总数'])
  const netNew = numberAfterLabel(text, ['新增人数', '净增关注'])
  const out: Partial<PlatformMetricsOutcome> = {}
  if (followers !== undefined) out.followerTotal = followers
  if (netNew !== undefined) out.followerDelta = netNew
  return out
}

/** Whether a page is WeChat's "please log in again" gate. */
export function isWechatLoginGate(text: string): boolean {
  return /请重新登录|重新\[\s*登录|loginpage/i.test(text)
}

/**
 * 小红书 note manager page.
 *
 * The note list renders as `<title> <date> <HH:mm> <reads> <duration>` with no
 * separators between the numbers, so a reads value and the following `mm:ss`
 * duration arrive glued together (`50000` + `04:15` reads as `5000004:15`) and
 * the digit count of the duration varies per note. No text-only rule can split
 * them reliably, so this parser reports nothing rather than return a number
 * that could be wrong by orders of magnitude. Getting a real figure needs the
 * platform's structured API or a DOM-level read of each note row.
 */
export function parseXiaohongshu(_text: string): Partial<PlatformMetricsOutcome> {
  return {}
}

/**
 * Per-platform scrape targets and parsers.
 *
 * `host` must match a tab that is already open and logged in: BrowserOS does
 * not share cookies between sessions, and a newly opened tab typically lands on
 * a login page. `dashboardUrl` is where the numbers live for that platform.
 */
const PLATFORM_SCRAPE_SPECS: Partial<Record<PlatformId, PlatformScrapeSpec>> = {
  bilibili: {
    host: 'member.bilibili.com',
    dashboardUrl: 'https://member.bilibili.com/platform/home',
    parse: parseBilibili,
  },
  douyin: {
    host: 'creator.douyin.com',
    dashboardUrl: 'https://creator.douyin.com/creator-micro/content/manage',
    parse: parseDouyin,
  },
  wechat_channels: {
    host: 'channels.weixin.qq.com',
    dashboardUrl: 'https://channels.weixin.qq.com/platform',
    parse: parseWechatChannels,
  },
  wechat_mp: {
    host: 'mp.weixin.qq.com',
    dashboardUrl: 'https://mp.weixin.qq.com/cgi-bin/home',
    parse: parseWechatMp,
  },
  xiaohongshu: {
    host: 'creator.xiaohongshu.com',
    dashboardUrl: 'https://creator.xiaohongshu.com/new/note-manager',
    parse: parseXiaohongshu,
    emptyNote: '小红书笔记列表的阅读数与时长在文本中无分隔符，无法可靠拆分，需平台结构化接口',
  },
}
