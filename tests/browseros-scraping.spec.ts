import { describe, expect, it } from 'vitest'
import {
  MetricsCollector,
  parseBilibili,
  parseDouyin,
  parseWechatChannels,
  parseWechatMp,
  parseXiaohongshu,
} from '../src/analytics/metrics-collector.js'
import { parseTabs } from '../src/browser/browseros-ops.js'
import { stripUntrustedEnvelope, extractSessionHandle } from '../src/browser/browseros-bridge.js'

/**
 * Fixtures are trimmed captures of the real creator dashboards as BrowserOS
 * returns them, so the parsers are pinned to the layouts they actually meet.
 */
describe('BrowserOS live scraping', () => {
  describe('parseBilibili', () => {
    it('reads the labelled summary block', () => {
      const parsed = parseBilibili(
        '视频数据专栏数据统计截至：2026-10-12（每日12点更新）实时数据查询 播放量 296 评论 2 弹幕 0 点赞 27 分享 1 收藏 13 投币 2粉丝概览粉丝总数1今日粉丝数变化+0',
      )
      expect(parsed.plays).toBe(296)
      expect(parsed.likes).toBe(27)
      expect(parsed.comments).toBe(2)
      expect(parsed.shares).toBe(1)
      // 收藏 and 投币 are both收藏-type signals on B站.
      expect(parsed.favorites).toBe(15)
      expect(parsed.followerDelta).toBe(0)
      expect(parsed.followerTotal).toBe(1)
    })

    it('reports nothing on a login page', () => {
      expect(parseBilibili('请登录后查看创作数据')).toEqual({})
    })
  })

  describe('parseDouyin', () => {
    it('sums one row per published work', () => {
      const parsed = parseDouyin(
        '置顶00:30作品一2026年10月10日 13:18已发布播放165点赞0评论0分享1收藏1完播率2.77%2秒跳出率51.5%吸粉量000:40作品二2026年10月09日 13:56已发布播放127点赞1评论0分享0收藏0完播率0.6%2秒跳出率56.82%吸粉量1',
      )
      expect(parsed.plays).toBe(292)
      expect(parsed.likes).toBe(1)
      expect(parsed.shares).toBe(1)
      expect(parsed.favorites).toBe(1)
      expect(parsed.followerDelta).toBe(1)
    })

    it('does not count 完播率 or 跳出率 as plays', () => {
      const parsed = parseDouyin('已发布播放238点赞2评论0分享0收藏0完播率1.92%2秒跳出率33.24%吸粉量0')
      expect(parsed.plays).toBe(238)
      expect(parsed.likes).toBe(2)
    })
  })

  describe('parseWechatChannels', () => {
    it('reads 昨日数据 and the account summary', () => {
      const parsed = parseWechatChannels(
        '视频号 · 助手通知中心injoys.ai ## injoys.ai 申请认证 视频号ID: sphTL4bjVl4YTv0 视频13关注者12 昨日数据 净增关注 0 新增播放 8 新增 0 新增评论 0',
      )
      expect(parsed.plays).toBe(8)
      expect(parsed.followerDelta).toBe(0)
      expect(parsed.followerTotal).toBe(12)
      expect(parsed.postCount).toBe(13)
    })

    it('does not satisfy the post count from 视频号ID', () => {
      const parsed = parseWechatChannels('视频号ID: sphTL4bjVl4YTv0 视频13关注者12')
      expect(parsed.postCount).toBe(13)
    })
  })

  describe('parseWechatMp', () => {
    it('reads follower counts when present', () => {
      const parsed = parseWechatMp('总用户数 1284 新增人数 12')
      expect(parsed.followerTotal).toBe(1284)
      expect(parsed.followerDelta).toBe(12)
    })
  })

  describe('parseXiaohongshu', () => {
    it('reports nothing rather than guessing glued-together numbers', () => {
      // Reads and duration arrive without a separator: "50000" + "04:15".
      const parsed = parseXiaohongshu(
        '你的AI还在陪你聊天？我的会直接干活2026-10-01 00:265000004:15AI工具2026-09-22 12:271930020留下邮箱',
      )
      expect(parsed).toEqual({})
    })
  })

  describe('MetricsCollector source semantics', () => {
    it('marks rows unmeasured with a reason when no client is attached', async () => {
      const collector = new MetricsCollector()
      const rows = await collector.fetchPlatformMetrics(['bilibili'], '7d')
      expect(rows).toHaveLength(1)
      expect(rows[0].source).toBe('unmeasured')
      expect(rows[0].note).toBeTruthy()
      expect(rows[0].plays).toBeNull()
    })

    it('labels mock rows as mock, not live', async () => {
      const collector = new MetricsCollector({ mockOffline: true })
      const rows = await collector.fetchPlatformMetrics(['bilibili'], '7d')
      expect(rows[0].source).toBe('mock')
      expect(rows[0].plays).toBeGreaterThan(0)
    })

    it('reports an unavailable platform instead of zero', async () => {
      // A client that answers every call with an empty tab list.
      const client = { callTool: async () => ({ content: [{ type: 'text', text: '' }] }) }
      const collector = new MetricsCollector({ browserOsClient: client })
      const rows = await collector.fetchPlatformMetrics(['bilibili'], '7d')
      expect(rows[0].source).toBe('unmeasured')
      expect(rows[0].note).toContain('未打开')
    })
  })

  describe('BrowserOS response helpers', () => {
    it('strips the untrusted-content envelope', () => {
      const text = stripUntrustedEnvelope(
        '[UNTRUSTED_PAGE_CONTENT nonce=abc origin=https://x.com] body [END_UNTRUSTED_PAGE_CONTENT nonce=abc]',
      )
      expect(text).toBe('body')
    })

    it('reads the session handle from _meta', () => {
      expect(extractSessionHandle({ _meta: { 'com.browseros/session': 's-1' } })).toBe('s-1')
      expect(extractSessionHandle({})).toBeUndefined()
    })

    it('parses the `[n] <url>` tab listing', () => {
      const tabs = parseTabs('[1] https://mp.weixin.qq.com/home (公众号)\n[2] https://member.bilibili.com/platform/home (B站)')
      expect(tabs).toEqual([
        { page: 1, url: 'https://mp.weixin.qq.com/home' },
        { page: 2, url: 'https://member.bilibili.com/platform/home' },
      ])
    })

    it('parses a JSON tab listing', () => {
      const tabs = parseTabs(JSON.stringify([{ page: 4, url: 'https://member.bilibili.com/platform/home' }]))
      expect(tabs).toEqual([{ page: 4, url: 'https://member.bilibili.com/platform/home' }])
    })
  })
})
