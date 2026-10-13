import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { InjoysClient } from '../src/injoys/client.js'
import { AdapterRegistry } from '../src/adapters/registry.js'
import { SessionGuard } from '../src/browser/session-guard.js'
import { BrowserDriver } from '../src/browser/browser-driver.js'
import { MetricsCollector } from '../src/analytics/metrics-collector.js'
import { ReviewReporter } from '../src/analytics/review-reporter.js'
import { CommentsCrawler } from '../src/feedback/comments-crawler.js'
import { IssueExtractor } from '../src/feedback/issue-extractor.js'
import { TrendsDiscoverer } from '../src/feedback/trends-discoverer.js'
import { ScheduleBridge } from '../src/schedule/schedule-bridge.js'
import { OverseasStrategyManager } from '../src/international/overseas-strategy.js'
import { createOpsTools } from '../src/tools/index.js'


describe('Ops Manager (Stage 1 & 2)', () => {
  it('retrieves product knowledge context from Injoys client', async () => {
    const injoys = new InjoysClient()
    const ctx = await injoys.getKnowledgeContext('MyProduct')
    expect(ctx.productName).toBe('MyProduct')
    expect(ctx.coreFeatures.length).toBeGreaterThan(0)
    expect(ctx.targetPersona.length).toBeGreaterThan(0)
  })

  it('manages domestic platform adapters in AdapterRegistry', () => {
    const registry = new AdapterRegistry()
    const wxMp = registry.get('wechat_mp')
    const bili = registry.get('bilibili')
    const channels = registry.get('wechat_channels')
    const douyin = registry.get('douyin')

    expect(wxMp?.name).toBe('微信公众号')
    expect(bili?.name).toBe('哔哩哔哩 (B站)')
    expect(channels?.name).toBe('微信视频号')
    expect(douyin?.name).toBe('抖音创作者中心')
  })

  it('evaluates platform session states using SessionGuard', () => {
    const guard = new SessionGuard()

    // Active session
    const wxActive = guard.evaluateState('wechat_mp', 'https://mp.weixin.qq.com/cgi-bin/home?t=home/index')
    expect(wxActive.loggedIn).toBe(true)

    // Expired / login gate
    const wxLogin = guard.evaluateState('wechat_mp', 'https://mp.weixin.qq.com/cgi-bin/login?action=scan')
    expect(wxLogin.loggedIn).toBe(false)
    expect(wxLogin.scanRequired).toBe(true)
    expect(wxLogin.guidanceMessage).toContain('微信公众号')
  })

  it('plans prefill workflows using BrowserDriver with honest execution and error handling', async () => {
    // 1. Disconnected driver must NOT fake success
    const disconnectedDriver = new BrowserDriver()
    const disconnectedRes = await disconnectedDriver.planPrefillWorkflow({
      platform: 'bilibili',
      targetUrl: 'https://member.bilibili.com/platform/upload/video/frame',
      fields: { title: '测试视频' },
      uploadFilePath: '/path/to/demo.mp4',
    })
    expect(disconnectedRes.success).toBe(false)
    expect(disconnectedRes.message).toContain('未连接')
    expect(disconnectedRes.requiresUserAction).toBe(true)

    // 2. Driver with mock BrowserOS client succeeds
    const mockClient = {
      callTool: async (tool: string) => {
        if (tool === 'navigate') return { ok: true }
        if (tool === 'snapshot') return { nodes: [] }
        if (tool === 'act') return { ok: true }
        if (tool === 'upload') return { ok: true }
        return { ok: true }
      },
    }
    const liveDriver = new BrowserDriver(mockClient)
    const liveRes = await liveDriver.planPrefillWorkflow({
      platform: 'bilibili',
      targetUrl: 'https://member.bilibili.com/platform/upload/video/frame',
      fields: { title: '测试视频' },
      uploadFilePath: '/path/to/demo.mp4',
    })
    expect(liveRes.success).toBe(true)
    expect(liveRes.draftUrl).toContain('bilibili')

    // 3. Driver with failing BrowserOS client returns failure honestly
    const failingClient = {
      callTool: async (tool: string) => {
        if (tool === 'navigate') throw new Error('网络超时无法连接目标后台')
        return { ok: true }
      },
    }
    const failingDriver = new BrowserDriver(failingClient)
    const failingRes = await failingDriver.planPrefillWorkflow({
      platform: 'bilibili',
      targetUrl: 'https://member.bilibili.com/platform/upload/video/frame',
      fields: { title: '测试视频' },
    })
    expect(failingRes.success).toBe(false)
    expect(failingRes.message).toContain('网络超时')
  })

  it('plans multi-channel marketing calendar via ops_plan_calendar tool', async () => {
    const injoys = new InjoysClient()
    const registry = new AdapterRegistry()
    const tools = createOpsTools(injoys, registry)
    const planTool = tools.find(t => t.name === 'ops_plan_calendar')
    expect(planTool).toBeDefined()

    // Test pure UI presentation
    expect(planTool?.presentCall?.({ period: 'week', focusVersion: 'v1.0' })).toEqual({
      card: 'generic',
      title: '规划运营发布排期',
      kind: 'other',
      rawInput: '周期: week | 重点版本: v1.0',
    })

    const execContext = {
      signal: new AbortController().signal,
      token: 'test-token',
    }

    const result = await planTool!.execute(
      {
        period: 'week',
        focusVersion: 'v1.0.0 发布',
        platforms: ['wechat_mp', 'bilibili'],
      },
      execContext,
    )

    expect(result.period).toBe('week')
    expect(result.totalItems).toBe(2)
    expect(result.summary).toContain('wechat_mp')
    expect(result.summary).toContain('bilibili')
  })

  it('drafts WeChat article and saves to Injoys via ops_draft_article tool', async () => {
    const injoys = new InjoysClient()
    const registry = new AdapterRegistry()
    const tools = createOpsTools(injoys, registry)
    const draftTool = tools.find(t => t.name === 'ops_draft_article')
    expect(draftTool).toBeDefined()

    expect(draftTool?.presentCall?.({ topic: '测试长文' })).toEqual({
      card: 'generic',
      title: '撰写公众号图文底稿',
      kind: 'other',
      rawInput: '主题: 测试长文',
    })

    const execContext = {
      signal: new AbortController().signal,
      token: 'test-token',
    }

    const result = await draftTool!.execute(
      {
        topic: '如何实现个人产品的多渠道自动化运营',
      },
      execContext,
    )

    expect(result.docId).toBeDefined()
    expect(result.title).toContain('如何实现个人产品的多渠道自动化运营')
    expect(result.wordCount).toBeGreaterThan(1000)
  })

  it('extracts video metadata and title variants via ops_draft_video_meta tool', async () => {
    const injoys = new InjoysClient()
    const registry = new AdapterRegistry()
    const tools = createOpsTools(injoys, registry)
    const metaTool = tools.find(t => t.name === 'ops_draft_video_meta')
    expect(metaTool).toBeDefined()

    expect(metaTool?.presentCall?.({ videoPath: '/tmp/test.mp4' })).toEqual({
      card: 'generic',
      title: '生成视频发布文案与元数据',
      kind: 'other',
      rawInput: '视频: /tmp/test.mp4',
    })

    const execContext = {
      signal: new AbortController().signal,
      token: 'test-token',
    }

    const result = await metaTool!.execute(
      {
        videoPath: '/path/to/demo.mp4',
        coreMessage: '自动化演示展示',
      },
      execContext,
    )

    expect(result.videoPath).toBe('/path/to/demo.mp4')
    expect(result.titleVariant1).toBeDefined()
    expect(result.titleVariant2).toBeDefined()
    expect(result.titleVariant3).toBeDefined()
    expect(result.tags).toContain('#独立开发')
  })

  it('prefills platform draft boxes and returns review URLs via ops_push_drafts tool', async () => {
    const injoys = new InjoysClient()
    const registry = new AdapterRegistry(undefined, { allowDryRun: true })
    const tools = createOpsTools(injoys, registry)
    const pushTool = tools.find(t => t.name === 'ops_push_drafts')
    expect(pushTool).toBeDefined()

    expect(
      pushTool?.presentCall?.({
        platforms: ['wechat_mp', 'bilibili'],
        title: '测试推送到草稿',
        contentOrDescription: '内容',
      }),
    ).toEqual({
      card: 'generic',
      title: '正在向各平台草稿箱预填物料',
      kind: 'other',
      rawInput: '平台: wechat_mp, bilibili | 《测试推送到草稿》',
    })

    const execContext = {
      signal: new AbortController().signal,
      token: 'test-token',
    }

    const result = await pushTool!.execute(
      {
        platforms: ['wechat_mp', 'bilibili', 'douyin'],
        title: '产品实测与自动化发布',
        contentOrDescription: '详细介绍自动化流程并展示操作过程。',
        mediaPath: '/path/to/demo.mp4',
      },
      execContext,
    )

    expect(result.totalCount).toBe(3)
    expect(result.successCount).toBe(3)
    expect(result.summary).toContain('wechat_mp')
    expect(result.summary).toContain('bilibili')
    expect(result.summary).toContain('douyin')
    expect(result.summary).toContain('直达草稿箱')

    // Also assert that completely disconnected registry honestly returns failure
    const disconnectedRegistry = new AdapterRegistry()
    const disconnectedTools = createOpsTools(injoys, disconnectedRegistry)
    const disconnectedPush = disconnectedTools.find(t => t.name === 'ops_push_drafts')
    const disconnectedRes = await disconnectedPush!.execute(
      {
        platforms: ['wechat_mp'],
        title: '离线测试',
        contentOrDescription: '测试未连接驱动拒绝伪造成功',
      },
      execContext,
    )
    expect(disconnectedRes.successCount).toBe(0)
    expect(disconnectedRes.summary).toContain('⚠️')
  })
})

describe('Ops Manager (Stage 3: Analytics, Feedback & Schedule)', () => {
  it('collects creator metrics across multiple platforms via MetricsCollector', async () => {
    // Test unmeasured defaults without mock
    const unmeasuredCollector = new MetricsCollector()
    const unmeasured = await unmeasuredCollector.fetchPlatformMetrics(['wechat_mp', 'bilibili'])
    expect(unmeasured[0]!.impressions).toBeNull()
    expect(unmeasured[0]!.views).toBe(0)

    // Test explicit mock data
    const collector = new MetricsCollector({ mockOffline: true })
    const metrics = await collector.fetchPlatformMetrics(['wechat_mp', 'bilibili'], '7d')

    expect(metrics.length).toBe(2)
    const mp = metrics.find(m => m.platform === 'wechat_mp')
    const bili = metrics.find(m => m.platform === 'bilibili')

    expect(mp?.views).toBeGreaterThan(0)
    expect(mp?.likes).toBeGreaterThan(0)
    expect(mp?.followerDelta).toBeDefined()
    expect(bili?.views).toBeGreaterThan(0)
    expect(bili?.topPostTitle).toBeDefined()

    // Test 30d multiplier
    const metrics30d = await collector.fetchPlatformMetrics(['bilibili'], '30d')
    expect(metrics30d[0]!.views).toBeGreaterThan(bili!.views)
  })

  it('calculates performance metrics and generates review via ReviewReporter', async () => {
    const injoys = new InjoysClient()
    const collector = new MetricsCollector({ mockOffline: true })
    const reporter = new ReviewReporter(injoys)

    const metrics = await collector.fetchPlatformMetrics([
      'wechat_mp',
      'wechat_channels',
      'bilibili',
      'douyin',
    ])
    const report = await reporter.generateReview(metrics, [], 'DeepSeek Harness', '7d')

    expect(report.totalViews).toBeGreaterThan(0)
    expect(report.totalEngagements).toBeGreaterThan(0)
    expect(report.overallEngagementRate).toBeGreaterThan(0)
    expect(report.viralRate).toBeGreaterThan(0)
    expect(report.topPerformers.length).toBe(4)
    expect(report.keyLearnings.length).toBeGreaterThan(0)
    expect(report.nextActions.length).toBeGreaterThan(0)
    expect(report.injoysDocId).toBeDefined()
  })

  it('crawls audience comments across platforms via CommentsCrawler', async () => {
    const crawler = new CommentsCrawler()
    const comments = await crawler.fetchRecentComments(['wechat_mp', 'bilibili'], 3)

    expect(comments.length).toBeGreaterThan(0)
    for (const c of comments) {
      expect(c.id).toBeDefined()
      expect(c.author).toBeDefined()
      expect(c.content.length).toBeGreaterThan(0)
      expect(c.likes).toBeDefined()
    }
  })

  it('extracts issues, clusters categories and syncs backlog via IssueExtractor', async () => {
    const injoys = new InjoysClient()
    const crawler = new CommentsCrawler()
    const extractor = new IssueExtractor(injoys)

    const comments = await crawler.fetchRecentComments(['wechat_mp', 'bilibili', 'wechat_channels'])
    const feedback = extractor.extractFeedback(comments, '【BUG反馈】登录二维码偶尔超时刷新')

    expect(feedback.length).toBeGreaterThan(0)
    const bug = feedback.find(f => f.category === 'bug')
    expect(bug).toBeDefined()
    expect(bug?.priority).toBe('high')

    const syncRes = await extractor.syncToInjoys(feedback)
    expect(syncRes).toBeDefined()
    expect(typeof syncRes.sheetSynced).toBe('boolean')
    expect(typeof syncRes.faqsUpdated).toBe('number')
  })

  it('discovers trending topics and angles via TrendsDiscoverer', async () => {
    const discoverer = new TrendsDiscoverer()
    const trends = await discoverer.discoverTrends(['AI智能体', '开源软件'])

    expect(trends.length).toBeGreaterThanOrEqual(4)
    for (const t of trends) {
      expect(t.keyword).toBeDefined()
      expect(t.heatScore).toBeGreaterThanOrEqual(80)
      expect(t.sampleTopic).toBeDefined()
      expect(t.relevanceToProduct).toBeDefined()
    }
  })

  it('registers and manages ops inspection schedules via ScheduleBridge', async () => {
    const bridge = new ScheduleBridge()
    const rule = await bridge.registerRecurringTask({
      action: 'weekly_review',
      cron: '0 9 * * 1',
      timeZone: 'Asia/Shanghai',
    })

    expect(rule.id).toBeDefined()
    expect(rule.action).toBe('weekly_review')
    expect(rule.cron).toBe('0 9 * * 1')
    expect(rule.active).toBe(true)
    expect(rule.prompt).toContain('ops_fetch_metrics')

    const rules = bridge.listRules()
    expect(rules.length).toBe(1)

    const removed = bridge.removeRule(rule.id)
    expect(removed).toBe(true)
    expect(bridge.listRules().length).toBe(0)
  })

  it('executes Phase 3 tools ops_fetch_metrics and ops_generate_review', async () => {
    const injoys = new InjoysClient()
    const registry = new AdapterRegistry()
    const mockCollector = new MetricsCollector({ mockOffline: true })
    const tools = createOpsTools(injoys, registry, undefined, undefined, mockCollector)

    const fetchMetricsTool = tools.find(t => t.name === 'ops_fetch_metrics')
    const generateReviewTool = tools.find(t => t.name === 'ops_generate_review')

    expect(fetchMetricsTool).toBeDefined()
    expect(generateReviewTool).toBeDefined()

    const execContext = {
      signal: new AbortController().signal,
      token: 'test-token',
    }

    // 1. ops_fetch_metrics
    const metricsRes = await fetchMetricsTool!.execute(
      { platforms: ['wechat_mp', 'douyin'], timeRange: '7d' },
      execContext,
    )
    expect(metricsRes.totalViews).toBeGreaterThan(0)
    expect(metricsRes.totalEngagements).toBeGreaterThan(0)
    expect(metricsRes.tableMarkdown).toContain('wechat_mp')
    expect(metricsRes.tableMarkdown).toContain('douyin')

    // 2. ops_generate_review
    const reviewRes = await generateReviewTool!.execute(
      { timeRange: '7d', productName: 'DeepSeek Harness' },
      execContext,
    )
    expect(reviewRes.totalViews).toBeGreaterThan(0)
    expect(reviewRes.overallEngagementRate).toBeGreaterThan(0)
    expect(reviewRes.viralRate).toBeGreaterThan(0)
    expect(reviewRes.summaryMarkdown).toContain('高光内容')
  })

  it('executes Phase 3 tools ops_fetch_comments, ops_extract_feedback, ops_discover_trends, and ops_setup_schedule', async () => {
    const injoys = new InjoysClient()
    const registry = new AdapterRegistry()
    const tools = createOpsTools(injoys, registry)

    const commentsTool = tools.find(t => t.name === 'ops_fetch_comments')
    const feedbackTool = tools.find(t => t.name === 'ops_extract_feedback')
    const trendsTool = tools.find(t => t.name === 'ops_discover_trends')
    const scheduleTool = tools.find(t => t.name === 'ops_setup_schedule')

    expect(commentsTool).toBeDefined()
    expect(feedbackTool).toBeDefined()
    expect(trendsTool).toBeDefined()
    expect(scheduleTool).toBeDefined()

    const execContext = {
      signal: new AbortController().signal,
      token: 'test-token',
    }

    // 1. ops_fetch_comments
    const cmtRes = await commentsTool!.execute({ platforms: ['bilibili'] }, execContext)
    expect(cmtRes.totalCount).toBeGreaterThan(0)
    expect(cmtRes.commentsMarkdown).toContain('bilibili')

    // 2. ops_extract_feedback
    const fbRes = await feedbackTool!.execute(
      { rawText: '【BUG反馈】运行任务时偶尔中断' },
      execContext,
    )
    expect(fbRes.totalFeedback).toBeGreaterThan(0)
    expect(fbRes.bugCount).toBeGreaterThan(0)

    // 3. ops_discover_trends
    const trendsRes = await trendsTool!.execute(
      { keywords: ['智能体'], platform: 'bilibili' },
      execContext,
    )
    expect(trendsRes.trendsCount).toBeGreaterThan(0)
    expect(trendsRes.trendsMarkdown).toContain('智能体')

    // 4. ops_setup_schedule
    const schedRes = await scheduleTool!.execute(
      { actionType: 'weekly_review', cronExpression: '0 9 * * 1' },
      execContext,
    )
    expect(schedRes.ruleId).toBeDefined()
    expect(schedRes.action).toBe('weekly_review')
    expect(schedRes.cron).toBe('0 9 * * 1')
  })
})

describe('Ops Manager (Stage 4: Overseas Expansion & Multi-Language)', () => {
  it('manages overseas platform adapters in AdapterRegistry', () => {
    const registry = new AdapterRegistry()
    const yt = registry.get('youtube')
    const tiktok = registry.get('tiktok')
    const x = registry.get('twitter_x')
    const ph = registry.get('product_hunt')

    expect(yt?.name).toBe('YouTube Studio')
    expect(yt?.kind).toBe('video')
    expect(tiktok?.name).toBe('TikTok 创作者中心')
    expect(tiktok?.kind).toBe('video')
    expect(x?.name).toBe('X (Twitter)')
    expect(x?.kind).toBe('post')
    expect(ph?.name).toBe('Product Hunt')
    expect(ph?.kind).toBe('article')
  })

  it('provides timezone recommendations for overseas platforms via OverseasStrategyManager', () => {
    const manager = new OverseasStrategyManager()

    // Product Hunt: 00:01 AM PT reset
    const phTz = manager.getTimezoneStrategy('product_hunt')
    expect(phTz.targetPlatform).toBe('product_hunt')
    expect(phTz.timeZone).toBe('America/Los_Angeles')
    expect(phTz.recommendedUtcHour).toBe(7)
    expect(phTz.bestDays).toContain('Tuesday')
    expect(phTz.rationale).toContain('Product Hunt')

    // Twitter/X: US East/West overlap
    const xTz = manager.getTimezoneStrategy('twitter_x')
    expect(xTz.targetPlatform).toBe('twitter_x')
    expect(xTz.timeZone).toBe('America/New_York')
    expect(xTz.recommendedUtcHour).toBe(16)

    // YouTube: pre-weekend tech tutorial
    const ytTz = manager.getTimezoneStrategy('youtube')
    expect(ytTz.targetPlatform).toBe('youtube')
    expect(ytTz.timeZone).toBe('America/Los_Angeles')
    expect(ytTz.recommendedUtcHour).toBe(19)

    // TikTok: evening leisure hours
    const tiktokTz = manager.getTimezoneStrategy('tiktok')
    expect(tiktokTz.targetPlatform).toBe('tiktok')
    expect(tiktokTz.recommendedUtcHour).toBe(2)

    // Domestic fallback
    const domesticTz = manager.getTimezoneStrategy('wechat_mp')
    expect(domesticTz.timeZone).toBe('Asia/Shanghai')
  })

  it('generates authentic Product Hunt launch kit and maker comment via OverseasStrategyManager', async () => {
    const injoys = new InjoysClient()
    const ctx = await injoys.getKnowledgeContext('DeepSeek Harness')
    const manager = new OverseasStrategyManager()

    const phKit = manager.generateProductHuntKit(ctx)
    expect(phKit.name).toBe('DeepSeek Harness')
    expect(phKit.tagline.length).toBeLessThanOrEqual(60)
    expect(phKit.topics).toContain('Developer Tools')
    expect(phKit.topics).toContain('Artificial Intelligence')
    expect(phKit.description).toContain('DeepSeek Harness')
    expect(phKit.makerComment).toContain('Hey Product Hunt community!')
    expect(phKit.makerComment).toContain('Injoys sheets')
    expect(phKit.pricingType).toBe('free')
  })

  it('generates viral Twitter/X launch thread via OverseasStrategyManager', async () => {
    const injoys = new InjoysClient()
    const ctx = await injoys.getKnowledgeContext('DeepSeek Harness')
    const manager = new OverseasStrategyManager()

    const thread = manager.generateTwitterThread(ctx)
    expect(thread.hookTweet).toContain('I spent months building DeepSeek Harness')
    expect(thread.hookTweet).toContain('🧵👇')
    expect(thread.bodyTweets.length).toBe(4)
    expect(thread.bodyTweets[0]).toContain('1/ The Problem:')
    expect(thread.bodyTweets[1]).toContain('2/ The Solution:')
    expect(thread.bodyTweets[2]).toContain('3/ Human-in-the-loop')
    expect(thread.callToActionTweet).toContain('5/')
    expect(thread.hashtags).toContain('#buildinpublic')
    expect(thread.hashtags).toContain('#indiedev')
  })

  it('plans overseas marketing calendar via ops_plan_calendar tool', async () => {
    const injoys = new InjoysClient()
    const registry = new AdapterRegistry()
    const tools = createOpsTools(injoys, registry)
    const planTool = tools.find(t => t.name === 'ops_plan_calendar')
    expect(planTool).toBeDefined()

    const execContext = {
      signal: new AbortController().signal,
      token: 'test-token',
    }

    const result = await planTool!.execute(
      {
        period: 'month',
        focusVersion: 'v2.0 Global Launch',
        platforms: ['product_hunt', 'twitter_x', 'youtube', 'tiktok'],
      },
      execContext,
    )

    expect(result.period).toBe('month')
    expect(result.totalItems).toBe(4)
    expect(result.summary).toContain('product_hunt')
    expect(result.summary).toContain('twitter_x')
    expect(result.summary).toContain('youtube')
    expect(result.summary).toContain('tiktok')
    expect(result.summary).toContain('Product Hunt Launch')
    expect(result.summary).toContain('Launch Thread')
  })

  it('executes ops_draft_launch_kit tool and outputs localized preview', async () => {
    const injoys = new InjoysClient()
    const registry = new AdapterRegistry()
    const tools = createOpsTools(injoys, registry)
    const kitTool = tools.find(t => t.name === 'ops_draft_launch_kit')
    expect(kitTool).toBeDefined()

    expect(kitTool?.presentCall?.({ productName: 'DeepSeek Harness', targetRegion: 'na_us' })).toEqual({
      card: 'generic',
      title: '生成海外 Launch 物料包与 Twitter Thread',
      kind: 'other',
      rawInput: '产品: DeepSeek Harness | 目标区域: na_us',
    })

    const execContext = {
      signal: new AbortController().signal,
      token: 'test-token',
    }

    const result = await kitTool!.execute(
      {
        productName: 'DeepSeek Harness',
        targetRegion: 'global',
      },
      execContext,
    )

    expect(result.tagline.length).toBeLessThanOrEqual(60)
    expect(result.injoysDocId).toBeDefined()
    expect(result.makerComment).toContain('Product Hunt')
    expect(result.twitterThread.length).toBe(6) // 1 hook + 4 body + 1 cta
    expect(result.timezoneAdvice).toContain('Product Hunt')
    expect(result.timezoneAdvice).toContain('Twitter/X')
    expect(result.summaryMarkdown).toContain('Product Hunt Launch Kit')
    expect(result.summaryMarkdown).toContain('Twitter/X Launch Thread')
  })

  it('collects metrics and comments for overseas platforms', async () => {
    const collector = new MetricsCollector({ mockOffline: true })
    const crawler = new CommentsCrawler()

    const metrics = await collector.fetchPlatformMetrics(['youtube', 'twitter_x', 'product_hunt', 'tiktok'], '7d')
    expect(metrics.length).toBe(4)
    for (const m of metrics) {
      expect(m.views).toBeGreaterThan(0)
      expect(m.likes).toBeGreaterThan(0)
    }

    const comments = await crawler.fetchRecentComments(['youtube', 'twitter_x', 'product_hunt', 'tiktok'], 2)
    expect(comments.length).toBe(8)
    const phComment = comments.find(c => c.platform === 'product_hunt')
    expect(phComment?.content).toContain('launch')
  })

  describe('Ops Settings & RPC Management', () => {
    const originalDshHome = process.env.DSH_HOME
    beforeEach(async () => {
      const { tmpdir } = await import('node:os')
      const { join } = await import('node:path')
      process.env.DSH_HOME = join(tmpdir(), `dsh-ops-test-${Date.now()}-${Math.random().toString(36).slice(2)}`)
    })

    afterEach(() => {
      if (originalDshHome !== undefined) {
        process.env.DSH_HOME = originalDshHome
      } else {
        delete process.env.DSH_HOME
      }
    })

    it('manages configuration lifecycle via ConfigStore', async () => {
      const { ConfigStore } = await import('../src/config-store.js')
      const store = new ConfigStore(undefined, {
        defaultProduct: 'Custom Product',
        injoys: {
          endpoint: 'http://127.0.0.1:20000/mcp',
          token: 'custom-token',
        },
      })

      const loaded = store.load()
      expect(loaded.defaultProduct).toBe('Custom Product')
      expect(loaded.injoys.endpoint).toBe('http://127.0.0.1:20000/mcp')
      expect(loaded.injoys.token).toBe('custom-token')

      await store.save({
        defaultProduct: 'Updated Product',
        reuseHostBrowserProfile: false,
      })

      const after = store.load()
      expect(after.defaultProduct).toBe('Updated Product')
      expect(after.reuseHostBrowserProfile).toBe(false)
    })

    it('dynamically updates InjoysClient configuration', () => {
      const client = new InjoysClient({
        endpoint: 'http://localhost:1111/mcp',
        token: 'token-a',
      })
      expect(client.getConfig()).toEqual({
        endpoint: 'http://localhost:1111/mcp',
        token: 'token-a',
      })

      client.updateConfig({
        endpoint: 'http://localhost:2222/mcp',
        token: 'token-b',
      })
      expect(client.getConfig()).toEqual({
        endpoint: 'http://localhost:2222/mcp',
        token: 'token-b',
      })
    })

    it('handles Ops RPC requests through registerOpsRpc', async () => {
      const { ConfigStore } = await import('../src/config-store.js')
      const { registerOpsRpc, OPS_API_PATH, OPS_ENDPOINT } = await import('../src/ops-rpc.js')
      const { DraftStore } = await import('../src/storage/draft-store.js')
      const store = new ConfigStore(undefined)
      const injoys = new InjoysClient()
      const adapters = new AdapterRegistry()
      const draftStore = new DraftStore(undefined)

      let registeredHandler: ((req: Request) => Promise<Response>) | undefined
      const mockCtx: any = {
        allowDryRun: true,
        connection: {
          fetch: {
            register(opts: any) {
              if (opts.path === OPS_API_PATH) {
                registeredHandler = opts.fetch
              }
            },
          },
        },
      }

      registerOpsRpc(mockCtx, store, injoys, adapters, draftStore)
      expect(registeredHandler).toBeDefined()

      // Test config.get
      const reqGet = new Request('http://localhost/api/ops', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'client-request',
          rpcId: 'req-1',
          method: OPS_ENDPOINT,
          payload: { method: 'config.get', payload: {} },
        }),
      })

      const resGet = await registeredHandler!(reqGet)
      const dataGet = (await resGet.json()) as any
      expect(dataGet.type).toBe('server-response')
      expect(dataGet.result.ok).toBe(true)
      expect(dataGet.result.value.defaultProduct).toBe('DeepSeek Harness')

      // Test config.save
      const reqSave = new Request('http://localhost/api/ops', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'client-request',
          rpcId: 'req-2',
          method: OPS_ENDPOINT,
          payload: {
            method: 'config.save',
            payload: {
              defaultProduct: 'Brand New Product',
              injoys: { endpoint: 'http://127.0.0.1:33333/mcp', token: 'new-token' },
            },
          },
        }),
      })

      const resSave = await registeredHandler!(reqSave)
      const dataSave = (await resSave.json()) as any
      expect(dataSave.type).toBe('server-response')
      expect(dataSave.result.ok).toBe(true)
      expect(store.load().defaultProduct).toBe('Brand New Product')
      expect(injoys.getConfig().endpoint).toBe('http://127.0.0.1:33333/mcp')

      // Test browser.sessions
      const reqSessions = new Request('http://localhost/api/ops', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'client-request',
          rpcId: 'req-3',
          method: OPS_ENDPOINT,
          payload: { method: 'browser.sessions', payload: {} },
        }),
      })

      const resSessions = await registeredHandler!(reqSessions)
      const dataSessions = (await resSessions.json()) as any
      expect(dataSessions.type).toBe('server-response')
      expect(dataSessions.result.ok).toBe(true)
      expect(dataSessions.result.value.statuses.length).toBeGreaterThanOrEqual(4)

      // Test drafts.save & drafts.list
      const reqDraftSave = new Request('http://localhost/api/ops', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'client-request',
          rpcId: 'req-4',
          method: OPS_ENDPOINT,
          payload: {
            method: 'drafts.save',
            payload: {
              title: '深度拆解 AI Agent 工作流',
              topic: 'Agentic Workflow',
              channelVariants: [
                {
                  platform: 'wechat_mp',
                  kind: 'article',
                  title: '深度拆解：为什么全插件式智能体正在颠覆传统工作流？',
                  body: '本文深入解析 Cordis 微内核架构...',
                  tags: ['AI', 'Agent', '架构'],
                },
                {
                  platform: 'bilibili',
                  kind: 'video',
                  title: '【硬核】手把手带你写一个全插件式智能体！',
                  body: 'B站视频简介与时间轴章节...',
                  tags: ['开源', '独立开发'],
                },
              ],
            },
          },
        }),
      })

      const resDraftSave = await registeredHandler!(reqDraftSave)
      const dataDraftSave = (await resDraftSave.json()) as any
      expect(dataDraftSave.result.ok).toBe(true)
      const savedDraftId = dataDraftSave.result.value.draft.id
      expect(savedDraftId).toBeDefined()
      expect(dataDraftSave.result.value.draft.version).toBe(1)

      // Test drafts.list
      const reqDraftList = new Request('http://localhost/api/ops', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'client-request',
          rpcId: 'req-5',
          method: OPS_ENDPOINT,
          payload: { method: 'drafts.list', payload: {} },
        }),
      })

      const resDraftList = await registeredHandler!(reqDraftList)
      const dataDraftList = (await resDraftList.json()) as any
      expect(dataDraftList.result.ok).toBe(true)
      expect(dataDraftList.result.value.drafts.length).toBeGreaterThanOrEqual(1)

      // Test drafts.updatePublishUrl
      const reqPublishUrl = new Request('http://localhost/api/ops', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'client-request',
          rpcId: 'req-6',
          method: OPS_ENDPOINT,
          payload: {
            method: 'drafts.updatePublishUrl',
            payload: {
              draftId: savedDraftId,
              platform: 'wechat_mp',
              publishedUrl: 'https://mp.weixin.qq.com/s/sample_article_published',
            },
          },
        }),
      })

      const resPublishUrl = await registeredHandler!(reqPublishUrl)
      const dataPublishUrl = (await resPublishUrl.json()) as any
      expect(dataPublishUrl.result.ok).toBe(true)
      expect(dataPublishUrl.result.value.draft.status).toBe('published')
      expect(dataPublishUrl.result.value.draft.publishedUrls.wechat_mp).toBe(
        'https://mp.weixin.qq.com/s/sample_article_published',
      )

      // Test workbench.overview
      const reqOverview = new Request('http://localhost/api/ops', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'client-request',
          rpcId: 'req-7',
          method: OPS_ENDPOINT,
          payload: { method: 'workbench.overview', payload: {} },
        }),
      })

      const resOverview = await registeredHandler!(reqOverview)
      const dataOverview = (await resOverview.json()) as any
      expect(dataOverview.result.ok).toBe(true)
      expect(dataOverview.result.value.overviewMetrics).toBeDefined()
      expect(dataOverview.result.value.overviewMetrics.metricsAnnotation).toContain('非去重')
      expect(dataOverview.result.value.statuses.length).toBeGreaterThanOrEqual(2)

      // Test workbench.prefillDraft
      const reqPrefill = new Request('http://localhost/api/ops', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'client-request',
          rpcId: 'req-8',
          method: OPS_ENDPOINT,
          payload: {
            method: 'workbench.prefillDraft',
            payload: {
              draftId: savedDraftId,
              platform: 'wechat_mp',
            },
          },
        }),
      })

      const resPrefill = await registeredHandler!(reqPrefill)
      const dataPrefill = (await resPrefill.json()) as any
      expect(dataPrefill.result.ok).toBe(true)
      expect(dataPrefill.result.value.success).toBe(true)
      expect(dataPrefill.result.value.message).toContain('草稿箱')

      // Test workbench.generateArticleDraft (AI generation connected to DraftStore)
      const reqGen = new Request('http://localhost/api/ops', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'client-request',
          rpcId: 'req-9',
          method: OPS_ENDPOINT,
          payload: {
            method: 'workbench.generateArticleDraft',
            payload: { topic: '全插件式智能体架构实践' },
          },
        }),
      })

      const resGen = await registeredHandler!(reqGen)
      const dataGen = (await resGen.json()) as any
      expect(dataGen.result.ok).toBe(true)
      expect(dataGen.result.value.draftSaved).toBe(true)
      const generatedDraft = await draftStore.getDraft(dataGen.result.value.id)
      expect(generatedDraft).toBeDefined()
      expect(generatedDraft?.title).toContain('全插件式智能体架构实践')
    })

    it('manages ContentDraft persistence lifecycle and concurrency conflicts via DraftStore', async () => {
      const { DraftStore, DraftConcurrencyError } = await import('../src/storage/draft-store.js')
      const store = new DraftStore(undefined)

      const draft1 = await store.saveDraft({
        title: 'B站硬核视频',
        topic: 'AI Agent',
        channelVariants: [
          {
            platform: 'bilibili',
            kind: 'video',
            title: '手把手带你写 AI Agent',
            body: '视频介绍与章节分镜...',
            tags: ['AI', '开源'],
          },
        ],
      })

      expect(draft1.id).toBeDefined()
      expect(draft1.version).toBe(1)
      expect(draft1.status).toBe('draft')

      // Update draft -> version bumps to 2
      const draft2 = await store.saveDraft({
        ...draft1,
        title: 'B站硬核视频（修改版）',
      })
      expect(draft2.id).toBe(draft1.id)
      expect(draft2.version).toBe(2)
      expect(draft2.title).toBe('B站硬核视频（修改版）')

      // Concurrency conflict: saving with expectedVersion 1 on a v2 draft MUST throw DraftConcurrencyError
      await expect(
        store.saveDraft({ ...draft2, title: '并发覆盖试图' }, { expectedVersion: 1 }),
      ).rejects.toThrow(DraftConcurrencyError)

      // Get draft
      const fetched = await store.getDraft(draft1.id)
      expect(fetched?.title).toBe('B站硬核视频（修改版）')

      // Update prefill result
      const prefilled = await store.updatePrefillResult(draft1.id, 'bilibili', {
        draftId: 'bili_draft_123',
        draftUrl: 'https://member.bilibili.com/platform/upload',
      })
      expect(prefilled?.status).toBe('prefilled')
      expect(prefilled?.prefillResults?.bilibili?.draftId).toBe('bili_draft_123')

      // Mark published
      const published = await store.markPublished(
        draft1.id,
        'bilibili',
        'https://www.bilibili.com/video/BV1234567890',
      )
      expect(published?.status).toBe('published')
      expect(published?.publishedUrls?.bilibili).toBe('https://www.bilibili.com/video/BV1234567890')

      // List drafts
      const allDrafts = await store.listDrafts()
      expect(allDrafts.some(d => d.id === draft1.id)).toBe(true)

      // Delete draft
      const deleted = await store.deleteDraft(draft1.id)
      expect(deleted).toBe(true)
      expect(await store.getDraft(draft1.id)).toBeNull()
    })

    it('validates SessionGuard four-state lifecycle including no_publish_permission and active tabs', async () => {
      const { SessionGuard } = await import('../src/browser/session-guard.js')
      const guard = new SessionGuard()

      // 1. WeChat MP login scan gate -> needs_login
      const mpLogin = guard.evaluateState('wechat_mp', 'https://mp.weixin.qq.com/cgi-bin/scanlogin?action=scan')
      expect(mpLogin.loggedIn).toBe(false)
      expect(mpLogin.state).toBe('needs_login')
      expect(mpLogin.isReady).toBe(false)
      expect(mpLogin.scanRequired).toBe(true)

      // 2. WeChat MP logged in home -> authenticated
      const mpHome = guard.evaluateState('wechat_mp', 'https://mp.weixin.qq.com/cgi-bin/home?t=home/index')
      expect(mpHome.loggedIn).toBe(true)
      expect(mpHome.state).toBe('authenticated')
      expect(mpHome.isReady).toBe(true)

      // 3. Bilibili passport login gate -> needs_login
      const biliLogin = guard.evaluateState('bilibili', 'https://passport.bilibili.com/login')
      expect(biliLogin.loggedIn).toBe(false)
      expect(biliLogin.state).toBe('needs_login')

      // 4. Bilibili creator home -> authenticated
      const biliHome = guard.evaluateState('bilibili', 'https://member.bilibili.com/platform/home')
      expect(biliHome.loggedIn).toBe(true)
      expect(biliHome.state).toBe('authenticated')

      // 5. No permission page -> no_publish_permission
      const noPerm = guard.evaluateState('wechat_mp', 'https://mp.weixin.qq.com/cgi-bin/no_permission')
      expect(noPerm.loggedIn).toBe(false)
      expect(noPerm.state).toBe('no_publish_permission')
      expect(noPerm.isReady).toBe(false)

      // 6. Unknown URL -> unknown
      const unknown = guard.evaluateState('wechat_mp', 'https://example.com/other')
      expect(unknown.loggedIn).toBe(false)
      expect(unknown.state).toBe('unknown')

      // 7. checkBrowserSessions with live active tabs
      const browserSessions = guard.checkBrowserSessions(
        [{ id: 'wechat_mp', name: '微信公众号', kind: 'article', draftEditorUrl: 'https://mp.weixin.qq.com' }],
        [{ url: 'https://mp.weixin.qq.com/cgi-bin/home' }],
      )
      expect(browserSessions[0]!.state).toBe('authenticated')
      expect(browserSessions[0]!.isReady).toBe(true)
    })

    it('propagates InjoysClient sync failures when remote MCP rejects operation', async () => {
      const failingInjoys = new InjoysClient({ endpoint: 'http://127.0.0.1:99999/down' })
      await expect(
        failingInjoys.syncCalendarItem({
          id: 'test_fail_item',
          date: '2026-10-15',
          platform: 'wechat_mp',
          kind: 'article',
          topic: '测试失败排期',
          status: 'planned',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }),
      ).rejects.toThrow('Injoys 表格写入失败')
    })
  })
})

