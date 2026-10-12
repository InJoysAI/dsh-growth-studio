import { describe, expect, it } from 'vitest'
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

  it('plans prefill workflows using BrowserDriver', async () => {
    const driver = new BrowserDriver()
    const res = await driver.planPrefillWorkflow({
      platform: 'bilibili',
      targetUrl: 'https://member.bilibili.com/platform/upload/video/frame',
      fields: { title: '测试视频' },
      uploadFilePath: '/path/to/demo.mp4',
    })

    expect(res.success).toBe(true)
    expect(res.draftUrl).toContain('bilibili')
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
    const registry = new AdapterRegistry()
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
  })
})

describe('Ops Manager (Stage 3: Analytics, Feedback & Schedule)', () => {
  it('collects creator metrics across multiple platforms via MetricsCollector', async () => {
    const collector = new MetricsCollector()
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
    const collector = new MetricsCollector()
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
    const tools = createOpsTools(injoys, registry)

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
    const collector = new MetricsCollector()
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
})
