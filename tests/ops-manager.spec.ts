import { Context } from "@deepseek-ai/cordis"
import * as GrowthStudio from "../src/index.js"
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

    // 4. Driver with save button rejection/isError returns failure honestly (cannot fake success)
    const rejectSaveClient = {
      callTool: async (tool: string, args?: any) => {
        if (tool === 'act' && args?.kind === 'click') {
          return { isError: true, message: '保存草稿按钮被禁用或权限拒绝' }
        }
        return { ok: true }
      },
    }
    const rejectSaveDriver = new BrowserDriver(rejectSaveClient)
    const rejectRes = await rejectSaveDriver.planPrefillWorkflow({
      platform: 'bilibili',
      targetUrl: 'https://member.bilibili.com/platform/upload/video/frame',
      fields: { title: '测试视频' },
    })
    expect(rejectRes.success).toBe(false)
    expect(rejectRes.message).toContain('保存草稿')
    expect(rejectRes.requiresUserAction).toBe(true)
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
    injoys.invokeTool = async (name: string) => {
      if (name === 'document.create') {
        return { document: { documentId: 'injoys_doc_real_456' } }
      }
      return null
    }
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

    expect(result.docId).toBe('injoys_doc_real_456')
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
    injoys.invokeTool = async (name: string) => {
      if (name === 'document.create') {
        return { document: { documentId: 'doc_review_real_789' } }
      }
      return null
    }
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
    // NOTE: never capture the entry DSH_HOME at describe scope. `tests/setup-isolation.ts`
    // has already redirected it, but capturing here and restoring it in afterEach is how a
    // previous revision accidentally reintroduced the real home for later suites. Restore
    // to the isolated base lazily instead, so ordering can never resurrect the real one.
    let isolatedBaseHome: string | undefined

    beforeEach(async () => {
      const { tmpdir } = await import('node:os')
      const { join } = await import('node:path')
      isolatedBaseHome = process.env.DSH_HOME
      process.env.DSH_HOME = join(tmpdir(), `dsh-ops-test-${Date.now()}-${Math.random().toString(36).slice(2)}`)
    })

    afterEach(() => {
      if (isolatedBaseHome !== undefined) {
        process.env.DSH_HOME = isolatedBaseHome
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
      // 该草稿含 2 个渠道（wechat_mp + bilibili），此处只回填 1 个：
      // 按架构 §3.2.5，整体状态保持 prefilled，渠道进度由 publishedUrls 体现。
      expect(dataPublishUrl.result.value.draft.status).toBe('prefilled')
      expect(dataPublishUrl.result.value.publishedChannels).toBe(1)
      expect(dataPublishUrl.result.value.totalChannels).toBe(2)
      expect(dataPublishUrl.result.value.allPublished).toBe(false)
      expect(dataPublishUrl.result.value.draft.publishedUrls.wechat_mp).toBe(
        'https://mp.weixin.qq.com/s/sample_article_published',
      )

      // 回填第二个渠道后，整体状态才推进为 published
      const reqPublishUrl2 = new Request('http://localhost/api/ops', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'client-request',
          rpcId: 'req-6b',
          method: OPS_ENDPOINT,
          payload: {
            method: 'drafts.updatePublishUrl',
            payload: {
              draftId: savedDraftId,
              platform: 'bilibili',
              publishedUrl: 'https://www.bilibili.com/video/BV1sample',
            },
          },
        }),
      })
      const resPublishUrl2 = await registeredHandler!(reqPublishUrl2)
      const dataPublishUrl2 = (await resPublishUrl2.json()) as any
      expect(dataPublishUrl2.result.ok).toBe(true)
      expect(dataPublishUrl2.result.value.draft.status).toBe('published')
      expect(dataPublishUrl2.result.value.publishedChannels).toBe(2)
      expect(dataPublishUrl2.result.value.allPublished).toBe(true)

      // 非法 URL 必须被拒绝，不得推进状态
      const reqBadUrl = new Request('http://localhost/api/ops', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'client-request',
          rpcId: 'req-6c',
          method: OPS_ENDPOINT,
          payload: {
            method: 'drafts.updatePublishUrl',
            payload: { draftId: savedDraftId, platform: 'wechat_mp', publishedUrl: 'not-a-url' },
          },
        }),
      })
      const resBadUrl = await registeredHandler!(reqBadUrl)
      const dataBadUrl = (await resBadUrl.json()) as any
      expect(dataBadUrl.result.ok).toBe(false)
      expect(dataBadUrl.result.error.code).toBe('drafts/invalid-published-url')

      // drafts.save 不得直接写入 published（发布闭环守卫）
      const reqSavePublished = new Request('http://localhost/api/ops', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'client-request',
          rpcId: 'req-6d',
          method: OPS_ENDPOINT,
          payload: {
            method: 'drafts.save',
            payload: { id: savedDraftId, title: '试图绕过发布闭环', status: 'published' },
          },
        }),
      })
      const resSavePublished = await registeredHandler!(reqSavePublished)
      const dataSavePublished = (await resSavePublished.json()) as any
      expect(dataSavePublished.result.ok).toBe(false)
      expect(dataSavePublished.result.error.code).toBe('drafts/published-requires-url')

      // R1-a：注入 publishedUrls 伪造发布凭据（空串）必须被忽略并重算状态
      const reqInjectUrls = new Request('http://localhost/api/ops', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'client-request',
          rpcId: 'req-6e',
          method: OPS_ENDPOINT,
          payload: {
            method: 'drafts.save',
            payload: {
              id: savedDraftId,
              title: '注入伪造发布凭据',
              publishedUrls: { wechat_mp: '', bilibili: 'https://evil.example/forged' },
            },
          },
        }),
      })
      const resInjectUrls = await registeredHandler!(reqInjectUrls)
      const dataInjectUrls = (await resInjectUrls.json()) as any
      expect(dataInjectUrls.result.ok).toBe(true)
      // 已发布的两条真实 URL 必须保留，注入值不得生效
      expect(dataInjectUrls.result.value.draft.publishedUrls).toEqual({
        wechat_mp: 'https://mp.weixin.qq.com/s/sample_article_published',
        bilibili: 'https://www.bilibili.com/video/BV1sample',
      })
      expect(dataInjectUrls.result.value.draft.status).toBe('published')

      // R1-b：已发布草稿新增未回填渠道后，整体状态必须回退为 prefilled。
      // 使用独立草稿，避免污染后续用例依赖的 savedDraftId 渠道集合。
      const isolatedDraft = await draftStore.saveDraft({
        id: 'draft-r1b-isolated',
        title: 'R1-b 独立草稿',
        channelVariants: [
          { platform: 'wechat_mp', kind: 'article', title: 'a', body: 'a', tags: [] },
          { platform: 'bilibili', kind: 'video', title: 'b', body: 'b', tags: [] },
        ],
      })
      await draftStore.markPublished(
        isolatedDraft.id,
        'wechat_mp',
        'https://mp.weixin.qq.com/s/r1b',
      )
      const fullyPublished = await draftStore.markPublished(
        isolatedDraft.id,
        'bilibili',
        'https://www.bilibili.com/video/BV1r1b',
      )
      expect(fullyPublished?.status).toBe('published')

      const reqAddChannel = new Request('http://localhost/api/ops', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'client-request',
          rpcId: 'req-6f',
          method: OPS_ENDPOINT,
          payload: {
            method: 'drafts.save',
            payload: {
              id: 'draft-r1b-isolated',
              title: '新增未回填渠道',
              channelVariants: [
                { platform: 'wechat_mp', kind: 'article', title: 'a', body: 'a', tags: [] },
                { platform: 'bilibili', kind: 'video', title: 'b', body: 'b', tags: [] },
                { platform: 'youtube', kind: 'video', title: 'c', body: 'c', tags: [] },
              ],
            },
          },
        }),
      })
      const resAddChannel = await registeredHandler!(reqAddChannel)
      const dataAddChannel = (await resAddChannel.json()) as any
      expect(dataAddChannel.result.ok).toBe(true)
      expect(dataAddChannel.result.value.draft.status).toBe('prefilled')
      // youtube 无回填记录，不得凭空出现键
      expect(dataAddChannel.result.value.draft.publishedUrls.youtube).toBeUndefined()

      // R2：前缀合法但结构非法的 URL（https://%）必须被拒绝
      const reqStructuralBadUrl = new Request('http://localhost/api/ops', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'client-request',
          rpcId: 'req-6g',
          method: OPS_ENDPOINT,
          payload: {
            method: 'drafts.updatePublishUrl',
            payload: { draftId: 'draft-r1b-isolated', platform: 'youtube', publishedUrl: 'https://%' },
          },
        }),
      })
      const resStructuralBadUrl = await registeredHandler!(reqStructuralBadUrl)
      const dataStructuralBadUrl = (await resStructuralBadUrl.json()) as any
      expect(dataStructuralBadUrl.result.ok).toBe(false)
      expect(dataStructuralBadUrl.result.error.code).toBe('drafts/invalid-published-url')

      // R3：未知渠道必须返回 drafts/unknown-channel，且不写入发布记录
      const reqUnknownChannel = new Request('http://localhost/api/ops', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'client-request',
          rpcId: 'req-6h',
          method: OPS_ENDPOINT,
          payload: {
            method: 'drafts.updatePublishUrl',
            payload: {
              draftId: savedDraftId,
              platform: 'not_a_channel',
              publishedUrl: 'https://example.com/ok',
            },
          },
        }),
      })
      const resUnknownChannel = await registeredHandler!(reqUnknownChannel)
      const dataUnknownChannel = (await resUnknownChannel.json()) as any
      expect(dataUnknownChannel.result.ok).toBe(false)
      expect(dataUnknownChannel.result.error.code).toBe('drafts/unknown-channel')

      const reqAfterUnknown = new Request('http://localhost/api/ops', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'client-request',
          rpcId: 'req-6i',
          method: OPS_ENDPOINT,
          payload: { method: 'drafts.get', payload: { id: savedDraftId } },
        }),
      })
      const resAfterUnknown = await registeredHandler!(reqAfterUnknown)
      const dataAfterUnknown = (await resAfterUnknown.json()) as any
      expect(dataAfterUnknown.result.value.draft.publishedUrls.not_a_channel).toBeUndefined()

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

      // New overview contract fields are present and the pre-existing ones survive.
      const overview = dataOverview.result.value.overviewMetrics
      expect(overview.measuredPlatforms).toEqual([])
      expect(overview.unmeasuredPlatforms).toEqual(['wechat_mp', 'bilibili'])
      expect(overview.totalImpressions).toBeNull()
      expect(overview.totalEngagements).toBeNull()
      expect(overview.totalFavorites).toBeNull()
      expect(overview.scheduledCount).toBe(0)
      expect(overview.readyChannelsCount).toBeGreaterThanOrEqual(0)
      expect(overview.totalChannelsCount).toBe(2)
      expect(overview.weeklyPipeline).toEqual({
        total: 0,
        completed: 0,
        byStatus: { planned: 0, drafting: 0, draft_ready: 0, prefilled: 0, published: 0 },
      })
      // No local snapshot yet, so every delta is null rather than a fabricated 0%.
      expect(overview.comparison).toEqual({
        period: null,
        impressionsDeltaPercent: null,
        playsDeltaPercent: null,
        engagementsDeltaPercent: null,
        followersDeltaPercent: null,
      })
      // Fabricated sample trends are gone.
      expect(dataOverview.result.value.trends).toEqual([])

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

      // Test workbench.prefillDraft for bilibili (video adapter routing)
      const reqPrefillBili = new Request('http://localhost/api/ops', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'client-request',
          rpcId: 'req-8-bili',
          method: OPS_ENDPOINT,
          payload: {
            method: 'workbench.prefillDraft',
            payload: {
              draftId: savedDraftId,
              platform: 'bilibili',
            },
          },
        }),
      })
      const resPrefillBili = await registeredHandler!(reqPrefillBili)
      const dataPrefillBili = (await resPrefillBili.json()) as any
      expect(dataPrefillBili.result.ok).toBe(true)
      expect(dataPrefillBili.result.value.success).toBe(true)

      // Test workbench.prefillDraft rejection on missing platform variant
      const reqPrefillMissing = new Request('http://localhost/api/ops', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'client-request',
          rpcId: 'req-8-missing',
          method: OPS_ENDPOINT,
          payload: {
            method: 'workbench.prefillDraft',
            payload: {
              draftId: savedDraftId,
              platform: 'youtube', // draft has no youtube variant
            },
          },
        }),
      })
      const resPrefillMissing = await registeredHandler!(reqPrefillMissing)
      const dataPrefillMissing = (await resPrefillMissing.json()) as any
      expect(dataPrefillMissing.result.ok).toBe(false)
      expect(dataPrefillMissing.result.error.code).toBe('ops/variant-not-found')

      // Test workbench.prefillDraft rejection on incomplete materials (empty body)
      const savedIncomplete = await draftStore.saveDraft({
        id: 'draft-incomplete-materials',
        title: '缺少正文的草稿',
        channelVariants: [
          {
            platform: 'wechat_mp',
            kind: 'article',
            title: '有标题但无正文',
            body: '   ', // empty body
            tags: [],
          },
        ],
      })
      const reqPrefillIncomplete = new Request('http://localhost/api/ops', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'client-request',
          rpcId: 'req-8-incomplete',
          method: OPS_ENDPOINT,
          payload: {
            method: 'workbench.prefillDraft',
            payload: {
              draftId: savedIncomplete.id,
              platform: 'wechat_mp',
            },
          },
        }),
      })
      const resPrefillIncomplete = await registeredHandler!(reqPrefillIncomplete)
      const dataPrefillIncomplete = (await resPrefillIncomplete.json()) as any
      expect(dataPrefillIncomplete.result.ok).toBe(false)
      expect(dataPrefillIncomplete.result.error.code).toBe('ops/material-incomplete')

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

      // Concurrent edit vs updatePrefillResult: ensure title is not overwritten
      const baseDraft = await store.saveDraft({
        id: 'concurrent-draft-1',
        title: 'base',
        topic: 'topic',
      })
      expect(baseDraft.version).toBe(1)

      await Promise.all([
        store.saveDraft({ id: 'concurrent-draft-1', title: 'edited' }),
        store.updatePrefillResult('concurrent-draft-1', 'wechat_mp', {
          draftId: 'prefill-123',
          draftUrl: 'https://mp.weixin.qq.com/s/123',
        }),
      ])

      const finalDraft = await store.getDraft('concurrent-draft-1')
      expect(finalDraft).toBeDefined()
      expect(finalDraft?.version).toBe(3)
      expect(finalDraft?.title).toBe('edited')
      expect(finalDraft?.prefillResults?.wechat_mp?.draftId).toBe('prefill-123')
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

    it('detects isError: true from remote MCP and returns null', async () => {
      const injoys = new InjoysClient()
      const originalFetch = globalThis.fetch
      globalThis.fetch = (async () => {
        return new Response(
          JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            result: {
              isError: true,
              structuredContent: { error: 'PermissionDenied' },
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        )
      }) as any

      try {
        const res = await injoys.invokeTool('spreadsheet.applyOperations', {})
        expect(res).toBeNull()
      } finally {
        globalThis.fetch = originalFetch
      }
    })

    it('returns null instead of fake doc ID when saveArticleDocument fails', async () => {
      const failingInjoys = new InjoysClient({ endpoint: 'http://127.0.0.1:99999/down' })
      const docId = await failingInjoys.saveArticleDocument({
        id: 'draft-fail-test',
        title: '测试文档标题',
        digest: '摘要',
        contentMarkdown: '# 正文',
        suggestedTags: [],
      })
      expect(docId).toBeNull()
    })

    it('terminates immediately when navigate returns isError: true without proceeding to fill or save', async () => {
      const callLog: string[] = []
      const navFailingClient = {
        callTool: async (tool: string) => {
          callLog.push(tool)
          if (tool === 'navigate') {
            return { isError: true, message: 'DNS resolution failure' }
          }
          return { ok: true }
        },
      }
      const driver = new BrowserDriver(navFailingClient)
      const res = await driver.planPrefillWorkflow({
        platform: 'wechat_mp',
        targetUrl: 'https://mp.weixin.qq.com',
        fields: { title: '测试', content: '正文' },
      })
      expect(res.success).toBe(false)
      expect(res.message).toContain('导航至')
      // Did NOT call snapshot, act, or save!
      expect(callLog).toEqual(['tabs', 'navigate'])
    })

    it('strictly fails when content/body filling fails even if title and save button would succeed', async () => {
      const callLog: string[] = []
      const contentFailingClient = {
        callTool: async (tool: string, args?: any) => {
          callLog.push(`${tool}:${args?.kind || ''}`)
          if (tool === 'act' && args?.kind === 'fill') {
            if (args.selector?.includes('content')) {
              return { isError: true, message: '编辑器正文未能定位' }
            }
            return { ok: true }
          }
          if (tool === 'act' && args?.kind === 'click') {
            return { ok: true } // Save button would have succeeded
          }
          return { ok: true }
        },
      }
      const driver = new BrowserDriver(contentFailingClient)
      const res = await driver.planPrefillWorkflow({
        platform: 'wechat_mp',
        targetUrl: 'https://mp.weixin.qq.com',
        fields: { title: '测试标题', content: '测试正文' },
      })
      expect(res.success).toBe(false)
      expect(res.message).toContain('必要字段填入失败')
      // Save button click was NEVER executed
      expect(callLog.some(c => c.includes('click'))).toBe(false)
    })

    it('does not generate fake local draftId when remote platform response provides none', async () => {
      const mockClient = {
        callTool: async (tool: string) => {
          if (tool === 'act') return { ok: true } // No draftId returned
          return { ok: true }
        },
      }
      const driver = new BrowserDriver(mockClient)
      const res = await driver.planPrefillWorkflow({
        platform: 'wechat_mp',
        targetUrl: 'https://mp.weixin.qq.com',
        fields: { title: '测试标题' },
      })
      expect(res.success).toBe(true)
      expect(res.draftId).toBeUndefined()
    })

    it('serializes concurrent syncCalendarItem calls to avoid duplicate appendRow', async () => {
      const injoys = new InjoysClient()
      const originalFetch = globalThis.fetch
      const executedOperations: any[] = []
      let existingSpreadsheetRows: any[] = []

      globalThis.fetch = (async (_url: string, opts: any) => {
        const body = JSON.parse(opts.body)
        const toolName = body.params.name
        if (toolName === 'spreadsheet.read') {
          return new Response(
            JSON.stringify({
              jsonrpc: '2.0',
              id: body.id,
              result: {
                structuredContent: {
                  rows: existingSpreadsheetRows,
                },
              },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          )
        }
        if (toolName === 'spreadsheet.applyOperations') {
          const ops = body.params.arguments.operations
          for (const op of ops) {
            executedOperations.push(op)
            if (op.type === 'appendRow') {
              existingSpreadsheetRows.push(op.data)
            }
          }
          return new Response(
            JSON.stringify({
              jsonrpc: '2.0',
              id: body.id,
              result: { structuredContent: { ok: true } },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          )
        }
        return new Response('{}', { status: 200 })
      }) as any

      try {
        const itemToSync = {
          id: 'concurrent-cal-item-1',
          date: '2026-10-15',
          platform: 'wechat_mp' as const,
          kind: 'article' as const,
          topic: '并发排期测试',
          status: 'planned' as const,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }

        // Two simultaneous sync requests with the same item.id
        await Promise.all([
          injoys.syncCalendarItem(itemToSync),
          injoys.syncCalendarItem(itemToSync),
        ])

        const appendOps = executedOperations.filter(op => op.type === 'appendRow')
        const updateOps = executedOperations.filter(op => op.type === 'updateRow')

        // Exactly ONE appendRow, the second MUST be updateRow
        expect(appendOps.length).toBe(1)
        expect(updateOps.length).toBe(1)
        expect(executedOperations.length).toBe(2)
      } finally {
        globalThis.fetch = originalFetch
      }
    })

    it('invalidates calendar cache when updateConfig switches remote endpoint', async () => {
      const injoys = new InjoysClient({ endpoint: 'http://service-a/mcp' })
      const originalFetch = globalThis.fetch
      const operationsByEndpoint: Record<string, string[]> = {
        'http://service-a/mcp': [],
        'http://service-b/mcp': [],
      }

      globalThis.fetch = (async (url: string, opts: any) => {
        const body = JSON.parse(opts.body)
        const toolName = body.params.name
        if (toolName === 'spreadsheet.read') {
          return new Response(
            JSON.stringify({
              jsonrpc: '2.0',
              id: body.id,
              result: { structuredContent: { rows: [] } },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          )
        }
        if (toolName === 'spreadsheet.applyOperations') {
          const ops = body.params.arguments.operations
          for (const op of ops) {
            operationsByEndpoint[url].push(op.type)
          }
          return new Response(
            JSON.stringify({
              jsonrpc: '2.0',
              id: body.id,
              result: { structuredContent: { ok: true, affected: 1 } },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          )
        }
        return new Response('{}', { status: 200 })
      }) as any

      try {
        const item = {
          id: 'cross-service-item',
          date: '2026-10-15',
          platform: 'wechat_mp' as const,
          kind: 'article' as const,
          topic: '跨服务测试',
          status: 'planned' as const,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }

        // 1. Sync on Service A -> appendRow
        await injoys.syncCalendarItem(item)
        expect(operationsByEndpoint['http://service-a/mcp']).toEqual(['appendRow'])

        // 2. Switch to Service B
        injoys.updateConfig({ endpoint: 'http://service-b/mcp' })

        // 3. Sync same item on Service B -> must be appendRow, NOT updateRow!
        await injoys.syncCalendarItem(item)
        expect(operationsByEndpoint['http://service-b/mcp']).toEqual(['appendRow'])
      } finally {
        globalThis.fetch = originalFetch
      }
    })

    it('falls back to appendRow if remote updateRow matched 0 rows', async () => {
      const injoys = new InjoysClient()
      const originalFetch = globalThis.fetch
      const executedOps: string[] = []

      globalThis.fetch = (async (_url: string, opts: any) => {
        const body = JSON.parse(opts.body)
        const toolName = body.params.name
        if (toolName === 'spreadsheet.read') {
          // Pre-populate so client chooses updateRow
          return new Response(
            JSON.stringify({
              jsonrpc: '2.0',
              id: body.id,
              result: {
                structuredContent: {
                  rows: [['mismatch-row', '2026-10-15', 'wechat_mp', 'article', 'T', 'planned', '', '', '']],
                },
              },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          )
        }
        if (toolName === 'spreadsheet.applyOperations') {
          const ops = body.params.arguments.operations
          for (const op of ops) {
            executedOps.push(op.type)
          }
          // If updateRow, simulate remote database returning 0 affected rows
          if (ops[0]?.type === 'updateRow') {
            return new Response(
              JSON.stringify({
                jsonrpc: '2.0',
                id: body.id,
                result: { structuredContent: { ok: true, affected: 0 } },
              }),
              { status: 200, headers: { 'Content-Type': 'application/json' } },
            )
          }
          return new Response(
            JSON.stringify({
              jsonrpc: '2.0',
              id: body.id,
              result: { structuredContent: { ok: true, affected: 1 } },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          )
        }
        return new Response('{}', { status: 200 })
      }) as any

      try {
        const item = {
          id: 'mismatch-row',
          date: '2026-10-15',
          platform: 'wechat_mp' as const,
          kind: 'article' as const,
          topic: '回退测试',
          status: 'planned' as const,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }

        await injoys.syncCalendarItem(item)
        // First tried updateRow, matched 0, then issued appendRow fallback!
        expect(executedOps).toEqual(['updateRow', 'appendRow'])
      } finally {
        globalThis.fetch = originalFetch
      }
    })

    it('prevents config race conditions during in-flight calendar sync (pins target and serializes updateConfig)', async () => {
      const injoys = new InjoysClient({ endpoint: 'http://service-a/mcp' })
      const originalFetch = globalThis.fetch
      const requestLog: Array<{ url: string; tool: string }> = []

      globalThis.fetch = (async (url: string, opts: any) => {
        const body = JSON.parse(opts.body)
        const toolName = body.params.name
        requestLog.push({ url, tool: toolName })

        if (toolName === 'spreadsheet.read') {
          // Simulate slow network read on Service A
          await new Promise(resolve => setTimeout(resolve, 30))
          return new Response(
            JSON.stringify({
              jsonrpc: '2.0',
              id: body.id,
              result: { structuredContent: { rows: [] } },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          )
        }

        if (toolName === 'spreadsheet.applyOperations') {
          return new Response(
            JSON.stringify({
              jsonrpc: '2.0',
              id: body.id,
              result: { structuredContent: { ok: true, affected: 1 } },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          )
        }

        return new Response('{}', { status: 200 })
      }) as any

      try {
        const item = {
          id: 'inflight-race-item',
          date: '2026-10-15',
          platform: 'wechat_mp' as const,
          kind: 'article' as const,
          topic: '竞态防护测试',
          status: 'planned' as const,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }

        // Start syncing on Service A
        const syncPromise = injoys.syncCalendarItem(item)

        // While read is in-flight on Service A, attempt to mutate config to Service B
        await new Promise(resolve => setTimeout(resolve, 5))
        injoys.updateConfig({ endpoint: 'http://service-b/mcp' })

        await syncPromise

        // Verify that during the in-flight sync, BOTH read and applyOperations went to Service A!
        expect(requestLog[0]).toEqual({ url: 'http://service-a/mcp', tool: 'spreadsheet.read' })
        expect(requestLog[1]).toEqual({ url: 'http://service-a/mcp', tool: 'spreadsheet.applyOperations' })

        // Now that in-flight sync is done, config is switched to Service B for subsequent tasks
        expect(injoys.getConfig().endpoint).toBe('http://service-b/mcp')

        // Subsequent sync cleanly routes to Service B
        await injoys.syncCalendarItem({ ...item, id: 'next-item-service-b' })
        expect(requestLog[2]).toEqual({ url: 'http://service-b/mcp', tool: 'spreadsheet.read' })
        expect(requestLog[3]).toEqual({ url: 'http://service-b/mcp', tool: 'spreadsheet.applyOperations' })
      } finally {
        globalThis.fetch = originalFetch
      }
    })
  })

  describe('DraftStore 存储不变量 (S1–S3)', () => {
    /**
     * Build a fully isolated RPC stack for one test.
     *
     * `ConfigStore` resolves `$DSH_HOME/ops-manager/config.json` via `resolveDshHome(ctx)`,
     * which also honours `ctx.profileContext.home`. Pinning that here means these tests
     * neither read nor write any other test's config, so they no longer depend on run
     * order or on leftover config from an earlier suite (the cause of a previous
     * order-dependent T3 failure).
     */
    const buildIsolatedRpcStack = async (home: string, draftsDir: string) => {
      const mod = await import('../src/ops-rpc.js')
      const conn = await import('../src/config-store.js')
      const { InjoysClient } = await import('../src/injoys/client.js')
      const { AdapterRegistry } = await import('../src/adapters/registry.js')
      const { DraftStore } = await import('../src/storage/draft-store.js')

      let handler: ((req: Request) => Promise<Response>) | undefined
      const ctx: any = {
        connection: { fetch: { register: (o: any) => { handler = o.fetch } } },
        get: (name: string) => (name === 'profileContext' ? { home } : undefined),
      }
      const configStore = new conn.ConfigStore(ctx, { draftsDir })
      const draftStore = new DraftStore(ctx, () => configStore.load().draftsDir)
      const injoys = new InjoysClient({ endpoint: 'http://127.0.0.1:1/mcp', token: 't' })
      mod.registerOpsRpc(
        ctx,
        configStore,
        injoys,
        new AdapterRegistry(),
        draftStore as any,
      )

      const call = async (method: string, payload: any) => {
        const res = await handler!(new Request('http://localhost/api/ops', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'client-request', rpcId: 'x', method: 'ops', payload: { method, payload } }),
        }))
        return (await res.json()) as any
      }
      return { call, configStore, draftStore, injoys }
    }

    /**
     * Permission-bit based cases (chmod 0500) are meaningless for root, which bypasses
     * DAC checks — a root-run CI would silently pass without exercising the guard.
     * Probe the real behaviour once and skip explicitly instead of pretending to cover it.
     */
    const permissionBitsEnforced = (() => {
      const os = require('node:os') as typeof import('node:os')
      const fs = require('node:fs') as typeof import('node:fs')
      const path = require('node:path') as typeof import('node:path')
      const probe = fs.mkdtempSync(path.join(os.tmpdir(), 'gs-perm-probe-'))
      const ro = path.join(probe, 'ro')
      fs.mkdirSync(ro)
      fs.chmodSync(ro, 0o500)
      let enforced = false
      try {
        fs.writeFileSync(path.join(ro, 'x'), '')
      } catch {
        enforced = true
      }
      fs.chmodSync(ro, 0o700)
      fs.rmSync(probe, { recursive: true, force: true })
      return enforced
    })()

    it('S1: 构造后切换到尚不存在的新目录仍能写入；不可用目录如实抛错', async () => {
      const { DraftStore, DraftStorageError } = await import('../src/storage/draft-store.js')
      const os = await import('node:os')
      const fs = await import('node:fs')
      const path = await import('node:path')
      const base = fs.mkdtempSync(path.join(os.tmpdir(), 'gs-s1-'))
      const dirA = path.join(base, 'A')
      fs.mkdirSync(dirA, { recursive: true })

      // 关键：先构造（此时只有 A 存在），再切到一个尚不存在的深层目录
      let dir = dirA
      const store = new DraftStore(undefined, () => dir)
      const newDir = path.join(base, 'brand-new', 'nested')
      expect(fs.existsSync(newDir)).toBe(false)
      dir = newDir

      // 真实场景：config.save 切到新目录后立即保存草稿，必须成功而非 ENOENT
      const saved = await store.saveDraft({
        id: 's1',
        title: 't',
        channelVariants: [{ platform: 'bilibili', kind: 'video', title: 'b', body: 'b', tags: [] }],
      })
      expect(saved.id).toBe('s1')
      expect(fs.existsSync(path.join(newDir, 's1.json'))).toBe(true)
      expect(await store.getDraft('s1')).not.toBeNull()

      // 目录不可用（父路径是普通文件）：必须抛 DraftStorageError，不得静默失败
      const fileAsParent = path.join(base, 'blocker')
      fs.writeFileSync(fileAsParent, 'x')
      dir = path.join(fileAsParent, 'sub')
      await expect(
        store.saveDraft({
          id: 's1b',
          title: 't',
          channelVariants: [{ platform: 'bilibili', kind: 'video', title: 'b', body: 'b', tags: [] }],
        }),
      ).rejects.toThrow(DraftStorageError)

      fs.rmSync(base, { recursive: true, force: true })
    })

    it('S2: 在途保存固定目录，中途切换配置不跨库覆盖', async () => {
      const { DraftStore } = await import('../src/storage/draft-store.js')
      const os = await import('node:os')
      const fs = await import('node:fs')
      const path = await import('node:path')
      const base = fs.mkdtempSync(path.join(os.tmpdir(), 'gs-s2-'))
      const dirA = path.join(base, 'A')
      const dirB = path.join(base, 'B')
      fs.mkdirSync(dirA, { recursive: true })
      fs.mkdirSync(dirB, { recursive: true })

      // A 与 B 中放入同 ID 但内容不同的独立草稿
      const variants = (platform: string) => [
        { platform, kind: 'video' as const, title: platform, body: platform, tags: [] },
      ]
      fs.writeFileSync(
        path.join(dirA, 'same.json'),
        JSON.stringify({ id: 'same', title: 'A original', topic: 't', channelVariants: variants('bilibili'), status: 'draft', version: 1, createdAt: 'x', updatedAt: 'x' }),
      )
      fs.writeFileSync(
        path.join(dirB, 'same.json'),
        JSON.stringify({ id: 'same', title: 'B independent', topic: 't', channelVariants: variants('youtube'), status: 'draft', version: 1, createdAt: 'x', updatedAt: 'x' }),
      )

      // 动态目录：先指向 A，启动保存后切到 B
      let dir = dirA
      const store = new DraftStore(undefined, () => dir)
      const pending = store.saveDraft({ id: 'same', title: 'A updated' })
      await Promise.resolve()
      dir = dirB
      await pending

      // A 被更新；B 必须保持不变（不得被 A 的内容覆盖）
      const a = JSON.parse(fs.readFileSync(path.join(dirA, 'same.json'), 'utf-8'))
      const b = JSON.parse(fs.readFileSync(path.join(dirB, 'same.json'), 'utf-8'))
      expect(a.title).toBe('A updated')
      expect(b.title).toBe('B independent')
      expect(b.channelVariants[0].platform).toBe('youtube')

      fs.rmSync(base, { recursive: true, force: true })
    })

    it('S3: 部分回填后普通保存不得降级为 draft', async () => {
      const { DraftStore } = await import('../src/storage/draft-store.js')
      const os = await import('node:os')
      const fs = await import('node:fs')
      const path = await import('node:path')
      const base = fs.mkdtempSync(path.join(os.tmpdir(), 'gs-s3-'))
      const store = new DraftStore(undefined, base)

      await store.saveDraft({
        id: 's3',
        title: 't',
        channelVariants: [
          { platform: 'wechat_mp', kind: 'article', title: 'a', body: 'a', tags: [] },
          { platform: 'bilibili', kind: 'video', title: 'b', body: 'b', tags: [] },
        ],
      })
      // 仅回填一个渠道 -> 部分发布
      const partial = await store.markPublished('s3', 'wechat_mp', 'https://mp.weixin.qq.com/s/s3')
      expect(partial!.status).toBe('prefilled')

      // 普通保存传入 status: 'draft' 不得把部分发布降级
      const after = await store.saveDraft({ id: 's3', title: 't2', status: 'draft' })
      expect(after.status).toBe('prefilled')
      expect(after.publishedUrls!.wechat_mp).toBe('https://mp.weixin.qq.com/s/s3')

      // 无任何发布凭据的草稿仍可正常处于 draft
      const plain = await store.saveDraft({
        id: 's3-plain',
        title: 'p',
        channelVariants: [{ platform: 'wechat_mp', kind: 'article', title: 'a', body: 'a', tags: [] }],
      })
      expect(plain.status).toBe('draft')

      fs.rmSync(base, { recursive: true, force: true })
    })
    it('S1(RPC): config.save 切到新目录后立即可写；不可用目录必须拒绝保存', async () => {
      const os = await import('node:os')
      const fs = await import('node:fs')
      const path = await import('node:path')
      const base = fs.mkdtempSync(path.join(os.tmpdir(), 'gs-s1rpc-'))
      const { call } = await buildIsolatedRpcStack(base, path.join(base, 'drafts'))

      // 切到尚不存在的深层新目录 -> 应立即创建并成功，随后保存草稿不得 ENOENT
      const newDir = path.join(base, 'fresh', 'deep')
      expect((await call('config.save', { draftsDir: newDir })).result.ok).toBe(true)
      const saveDraft = await call('drafts.save', {
        title: 'in new dir',
        channelVariants: [{ platform: 'bilibili', kind: 'video', title: 'b', body: 'b', tags: [] }],
      })
      expect(saveDraft.result.ok).toBe(true)

      // 目录不可用（父路径是普通文件）-> config.save 必须拒绝，而非先报成功
      const blocker = path.join(base, 'blocker')
      fs.writeFileSync(blocker, 'x')
      const badCfg = await call('config.save', { draftsDir: path.join(blocker, 'nope') })
      expect(badCfg.result.ok).toBe(false)
      expect(badCfg.result.error.code).toBe('config/invalid-drafts-dir')

      fs.rmSync(base, { recursive: true, force: true })
    })

    it.skipIf(!permissionBitsEnforced)('T1: 只读目录必须被 config.save 拒绝（存在 ≠ 可写）', async () => {
      const os = await import('node:os')
      const fs = await import('node:fs')
      const path = await import('node:path')
      const { ensureDirectory, verifyDirectoryWritable, DraftStorageError } =
        await import('../src/storage/draft-store.js')

      const base = fs.mkdtempSync(path.join(os.tmpdir(), 'gs-t1-'))
      const readOnly = path.join(base, 'readonly')
      fs.mkdirSync(readOnly, { recursive: true })
      fs.chmodSync(readOnly, 0o500)

      // ensureDirectory 只创建，故对已存在的只读目录不报错——这正是旧缺陷
      expect(() => ensureDirectory(readOnly)).not.toThrow()
      // verifyDirectoryWritable 必须凭探测文件识别出不可写
      let probeErr: any = null
      try { verifyDirectoryWritable(readOnly) } catch (e) { probeErr = e }
      expect(probeErr).toBeInstanceOf(DraftStorageError)

      // RPC 层：config.save 到只读目录必须被拒绝
      const { call } = await buildIsolatedRpcStack(base, path.join(base, 'ok'))
      const data = await call('config.save', { draftsDir: readOnly })

      fs.chmodSync(readOnly, 0o700)
      fs.rmSync(base, { recursive: true, force: true })

      expect(data.result.ok).toBe(false)
      expect(data.result.error.code).toBe('config/invalid-drafts-dir')
    })

    it('C1: ops-manager 路径被普通文件占用时 config.save 如实失败（跨平台 EEXIST）', async () => {
      const os = await import('node:os')
      const fs = await import('node:fs')
      const path = await import('node:path')

      const base = fs.mkdtempSync(path.join(os.tmpdir(), 'gs-c1-'))
      // Occupy the config directory path with a regular file: mkdirSync(recursive) then
      // fails with EEXIST regardless of platform or permission bits.
      const home = path.join(base, 'home')
      fs.mkdirSync(home, { recursive: true })
      fs.writeFileSync(path.join(home, 'ops-manager'), 'not a directory')

      const { call } = await buildIsolatedRpcStack(home, path.join(base, 'drafts'))
      const data = await call('config.save', { injoys: { endpoint: 'http://127.0.0.1:9/mcp', token: 'newtok' } })

      fs.rmSync(base, { recursive: true, force: true })

      expect(data.result.ok).toBe(false)
      expect(data.result.error.code).toBe('drafts/storage-unavailable')
      // User-facing message only: no errno / stack leakage into the client-facing string.
      expect(data.result.error.message).not.toMatch(/EEXIST|ENOENT|EACCES|errno|at Object|\.ts:\d+/)
      // Exact directory, not just truthy: catches `$DSH_HOME`, the config.json file path, and
      // the `'ops-manager'` literal fallback that `ops-rpc.ts` uses when getConfigDir() is undefined.
      expect(data.result.error.details?.dir).toBe(path.join(home, 'ops-manager'))
    })

    it.skipIf(!permissionBitsEnforced)('C2: ops-manager 目录只读时 config.save 如实失败（EACCES）', async () => {
      const os = await import('node:os')
      const fs = await import('node:fs')
      const path = await import('node:path')

      const base = fs.mkdtempSync(path.join(os.tmpdir(), 'gs-c2-'))
      const home = path.join(base, 'home')
      const configDir = path.join(home, 'ops-manager')
      fs.mkdirSync(configDir, { recursive: true })
      const { call } = await buildIsolatedRpcStack(home, path.join(base, 'drafts'))
      fs.chmodSync(configDir, 0o500)

      const data = await call('config.save', { injoys: { endpoint: 'http://127.0.0.1:9/mcp', token: 'newtok' } })

      fs.chmodSync(configDir, 0o700)
      fs.rmSync(base, { recursive: true, force: true })

      expect(data.result.ok).toBe(false)
      expect(data.result.error.code).toBe('drafts/storage-unavailable')
    })

    it('C3: 可写时 config.save 仍成功且 config.json 确实落盘（含令牌字段）', async () => {
      const os = await import('node:os')
      const fs = await import('node:fs')
      const path = await import('node:path')

      const base = fs.mkdtempSync(path.join(os.tmpdir(), 'gs-c3-'))
      const { call } = await buildIsolatedRpcStack(base, path.join(base, 'drafts'))

      const data = await call('config.save', {
        injoys: { endpoint: 'http://127.0.0.1:9/mcp', token: 'tok-c3' },
      })

      const configFile = path.join(base, 'ops-manager', 'config.json')
      const onDisk = JSON.parse(fs.readFileSync(configFile, 'utf-8'))
      fs.rmSync(base, { recursive: true, force: true })

      expect(data.result.ok).toBe(true)
      expect(data.result.value.success).toBe(true)
      expect(onDisk.injoys.token).toBe('tok-c3')
    })

    it('C4: 落盘失败时 updateConfig 已先行生效（非空字段），内存态与客户端不分叉', async () => {
      const os = await import('node:os')
      const fs = await import('node:fs')
      const path = await import('node:path')

      const base = fs.mkdtempSync(path.join(os.tmpdir(), 'gs-c4-'))
      const home = path.join(base, 'home')
      fs.mkdirSync(home, { recursive: true })
      fs.writeFileSync(path.join(home, 'ops-manager'), 'blocker')

      const { call, injoys } = await buildIsolatedRpcStack(home, path.join(base, 'drafts'))
      const data = await call('config.save', {
        injoys: { endpoint: 'http://127.0.0.1:9/mcp', token: 'tok-c4' },
      })
      // Assert the CLIENT itself, not `config.get`: the latter reads ConfigStore.inMemory only
      // and would pass even with updateConfig deleted or moved back after save().
      const clientCfg = injoys.getConfig()

      fs.rmSync(base, { recursive: true, force: true })

      expect(data.result.ok).toBe(false)
      // Hot-update precedes the failed write, so the submitted token is live on the client.
      expect(clientCfg.token).toBe('tok-c4')
      expect(clientCfg.endpoint).toBe('http://127.0.0.1:9/mcp')
    })

    it('C5: 写盘失败不得降级为 ops/internal-error，且不影响 draftsDir 预检码', async () => {
      const os = await import('node:os')
      const fs = await import('node:fs')
      const path = await import('node:path')

      const base = fs.mkdtempSync(path.join(os.tmpdir(), 'gs-c5-'))
      const home = path.join(base, 'home')
      fs.mkdirSync(home, { recursive: true })
      fs.writeFileSync(path.join(home, 'ops-manager'), 'blocker')

      const { call } = await buildIsolatedRpcStack(home, path.join(base, 'drafts'))

      const writeFail = await call('config.save', { tone: 'concise' })
      // draftsDir pre-check must still own its own code, unchanged by the new mapping.
      const blocker = path.join(base, 'blocker')
      fs.writeFileSync(blocker, 'x')
      const precheckFail = await call('config.save', { draftsDir: path.join(blocker, 'nope') })

      fs.rmSync(base, { recursive: true, force: true })

      expect(writeFail.result.ok).toBe(false)
      expect(writeFail.result.error.code).toBe('drafts/storage-unavailable')
      expect(writeFail.result.error.code).not.toBe('ops/internal-error')
      expect(precheckFail.result.error.code).toBe('config/invalid-drafts-dir')
    })

    it('C6: 非存储类异常仍映射为 ops/internal-error（兜底分支不被新映射吞并）', async () => {
      const os = await import('node:os')
      const fs = await import('node:fs')
      const path = await import('node:path')

      const base = fs.mkdtempSync(path.join(os.tmpdir(), 'gs-c6-'))
      const { call, configStore } = await buildIsolatedRpcStack(base, path.join(base, 'drafts'))

      // Throw a plain Error from OUTSIDE the save() wrap (here: the post-save `load()`).
      // The unified boundary must keep mapping it to `ops/internal-error`; a broken fallback
      // would silently relabel every unknown failure as a storage problem.
      const original = configStore.load.bind(configStore)
      ;(configStore as any).load = () => {
        throw new Error('boom-not-a-storage-error')
      }
      const data = await call('config.save', { tone: 'concise' })
      ;(configStore as any).load = original

      fs.rmSync(base, { recursive: true, force: true })

      expect(data.result.ok).toBe(false)
      expect(data.result.error.code).toBe('ops/internal-error')
    })

    it('T2: 预填回写固定在发起时的草稿库，不污染同 ID 的其他库', async () => {
      const os = await import('node:os')
      const fs = await import('node:fs')
      const path = await import('node:path')
      const { DraftStore } = await import('../src/storage/draft-store.js')

      const base = fs.mkdtempSync(path.join(os.tmpdir(), 'gs-t2-'))
      const dirA = path.join(base, 'A')
      const dirB = path.join(base, 'B')
      fs.mkdirSync(dirA, { recursive: true })
      fs.mkdirSync(dirB, { recursive: true })

      let dir = dirA
      const store = new DraftStore(undefined, () => dir)
      await store.saveDraft({
        id: 'same', title: 'A draft',
        channelVariants: [{ platform: 'bilibili', kind: 'video', title: 'a', body: 'a', tags: [] }],
      })
      dir = dirB
      await store.saveDraft({
        id: 'same', title: 'B independent',
        channelVariants: [{ platform: 'youtube', kind: 'video', title: 'b', body: 'b', tags: [] }],
      })

      // 模拟预填 RPC：在 A 上读取并固定目录，await 期间配置切到 B，再回写
      dir = dirA
      const pinned = store.getDirectory()
      expect((await store.getDraft('same', pinned))!.title).toBe('A draft')
      dir = dirB
      await store.updatePrefillResult('same', 'bilibili', { draftUrl: 'https://bili/x' }, pinned)

      const a = JSON.parse(fs.readFileSync(path.join(dirA, 'same.json'), 'utf-8'))
      const b = JSON.parse(fs.readFileSync(path.join(dirB, 'same.json'), 'utf-8'))
      fs.rmSync(base, { recursive: true, force: true })

      expect(a.prefillResults?.bilibili?.draftUrl).toBe('https://bili/x')
      expect(b.prefillResults?.bilibili).toBeUndefined()
      expect(b.title).toBe('B independent')
    })

    it('U2: 图文生成在知识库等待期间切换目录，不得产生双库副本', async () => {
      const os = await import('node:os')
      const fs = await import('node:fs')
      const path = await import('node:path')
      const mod = await import('../src/ops-rpc.js')
      const conn = await import('../src/config-store.js')
      const { InjoysClient } = await import('../src/injoys/client.js')
      const { AdapterRegistry } = await import('../src/adapters/registry.js')
      const { DraftStore } = await import('../src/storage/draft-store.js')

      const base = fs.mkdtempSync(path.join(os.tmpdir(), 'gs-u2-'))
      const dirA = path.join(base, 'A')
      const dirB = path.join(base, 'B')
      fs.mkdirSync(dirA, { recursive: true })
      fs.mkdirSync(dirB, { recursive: true })

      // 闸门：让 getKnowledgeContext 卡住，期间切换目录
      let releaseGate: () => void = () => {}
      const gate = new Promise<void>(resolve => { releaseGate = resolve })
      let gateReached: () => void = () => {}
      const reached = new Promise<void>(resolve => { gateReached = resolve })

      const dirProvider = { current: dirA }
      let handler: ((req: Request) => Promise<Response>) | undefined
      const ctx: any = {
        connection: { fetch: { register: (o: any) => { handler = o.fetch } } },
        get: (name: string) => (name === 'profileContext' ? { home: base } : undefined),
      }
      const configStore = new conn.ConfigStore(ctx, { draftsDir: dirA })
      const drafts = new DraftStore(ctx, () => dirProvider.current)
      const injoys = new InjoysClient({ endpoint: 'http://127.0.0.1:1/mcp', token: 't' })
      // 用闸门替换知识库调用（不触网）
      ;(injoys as any).getKnowledgeContext = async () => {
        gateReached()
        await gate
        return { productName: 'P', coreFeatures: [], targetPersona: [], brandTone: '' }
      }
      ;(injoys as any).saveArticleDocument = async () => undefined

      mod.registerOpsRpc(ctx, configStore, injoys, new AdapterRegistry(), drafts as any)

      const call = async (method: string, payload: any) => {
        const res = await handler!(new Request('http://localhost/api/ops', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'client-request', rpcId: 'x', method: 'ops', payload: { method, payload } }),
        }))
        return (await res.json()) as any
      }

      const pending = call('workbench.generateArticleDraft', { topic: 'U2' })
      await reached            // 请求已进入知识库等待
      dirProvider.current = dirB   // 期间切换目录
      releaseGate()
      const res = await pending

      const inA = fs.readdirSync(dirA).filter(f => f.endsWith('.json'))
      const inB = fs.readdirSync(dirB).filter(f => f.endsWith('.json'))
      fs.rmSync(base, { recursive: true, force: true })

      expect(res.result.ok).toBe(true)
      // 整个请求必须留在发起时的 A 库，B 库不得出现任何副本
      expect(inA.length).toBe(1)
      expect(inB.length).toBe(0)
    })

    it.skipIf(!permissionBitsEnforced)('T3: 写盘失败在所有写入口统一返回 drafts/storage-unavailable', async () => {
      const os = await import('node:os')
      const fs = await import('node:fs')
      const path = await import('node:path')

      const base = fs.mkdtempSync(path.join(os.tmpdir(), 'gs-t3-'))
      const dir = path.join(base, 'drafts')
      fs.mkdirSync(dir, { recursive: true })

      const { call } = await buildIsolatedRpcStack(base, dir)

      const saved = await call('drafts.save', {
        title: 't',
        channelVariants: [{ platform: 'wechat_mp', kind: 'article', title: 'a', body: 'a', tags: [] }],
      })
      const id = saved.result.value.draft.id

      fs.chmodSync(dir, 0o500)
      const res = await call('drafts.updatePublishUrl', {
        draftId: id, platform: 'wechat_mp', publishedUrl: 'https://ok.example/x',
      })
      fs.chmodSync(dir, 0o700)
      fs.rmSync(base, { recursive: true, force: true })

      expect(res.result.ok).toBe(false)
      // 统一错误码，而不是 ops/internal-error
      expect(res.result.error.code).toBe('drafts/storage-unavailable')
    })
  })

  describe("Cordis Plugin Lifecycle & Optional Services", () => {
    it("activates cleanly into Cordis lifecycle without without inject errors", async () => {
      const root = new Context()
      const registeredTools: string[] = []
      root.provide("tools" as any, {
        register(tool: any) {
          registeredTools.push(tool.name)
        },
      })
      root.provide("systemPrompt" as any, {
        section(_sec: any) {},
      })

      const fiber = root.plugin(GrowthStudio as any, {})
      await fiber

      expect(registeredTools).toHaveLength(11)
      expect(registeredTools).toContain("ops_plan_calendar")
      expect(registeredTools).toContain("ops_push_drafts")
    })

    it("bridges browserOsClient from Cordis context when provided", async () => {
      const root = new Context()
      root.provide("tools" as any, { register() {} })
      root.provide("systemPrompt" as any, { section() {} })
      let toolCalled = ""
      root.provide("browserOsClient" as any, {
        callTool: async (tool: string) => {
          toolCalled = tool
          return { success: true }
        },
      })

      const fiber = root.plugin(GrowthStudio as any, {})
      await fiber
      expect(fiber).toBeDefined()
    })

    it("bridges mcp service when provided and registers RPC endpoints under connection", async () => {
      const root = new Context()
      root.provide("tools" as any, { register() {} })
      root.provide("systemPrompt" as any, { section() {} })
      root.provide("mcp" as any, {
        callTool: async () => ({ success: true }),
      })
      let registeredRoute: any = null
      root.provide("connection" as any, {
        fetch: {
          register(route: any) {
            registeredRoute = route
          },
        },
      })

      const fiber = root.plugin(GrowthStudio as any, {})
      await fiber

      expect(registeredRoute).toBeDefined()
      expect(registeredRoute.path).toBe("/api/ops")
      expect(registeredRoute.methods).toContain("POST")
    })
  })

})
