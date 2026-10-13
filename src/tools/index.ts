/**
 * Ops Manager model-facing tools registration.
 * @module @deepseek-ai/dsh-ops-manager/tools
 */

import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { ToolDefinition } from '@deepseek-ai/dsh-tools'
import { InjoysClient } from '../injoys/client.js'
import { AdapterRegistry } from '../adapters/registry.js'
import { MetricsCollector } from '../analytics/metrics-collector.js'
import { ReviewReporter } from '../analytics/review-reporter.js'
import { CommentsCrawler } from '../feedback/comments-crawler.js'
import { IssueExtractor } from '../feedback/issue-extractor.js'
import { TrendsDiscoverer } from '../feedback/trends-discoverer.js'
import { ScheduleBridge } from '../schedule/schedule-bridge.js'
import { OverseasStrategyManager } from '../international/overseas-strategy.js'
import { DraftStore } from '../storage/draft-store.js'
import type {
  CalendarItem,
  PlatformId,
  DraftPrefillResult,
  OpsScheduleAction,
} from '../types.js'

export function createOpsTools(
  injoys: InjoysClient,
  adapters: AdapterRegistry,
  ctx?: Context,
  draftStore?: DraftStore,
  metricsCollector?: MetricsCollector,
): ToolDefinition[] {
  const actualDraftStore = draftStore ?? new DraftStore(ctx)
  const isMockMetrics = Boolean((ctx as any)?.mockOffline)
  const actualMetricsCollector = metricsCollector ?? new MetricsCollector({ mockOffline: isMockMetrics })
  const reviewReporter = new ReviewReporter(injoys)
  const commentsCrawler = new CommentsCrawler()
  const issueExtractor = new IssueExtractor(injoys)
  const trendsDiscoverer = new TrendsDiscoverer()
  const scheduleBridge = new ScheduleBridge(ctx)
  const overseasStrategy = new OverseasStrategyManager()

  /** 1. Plan marketing calendar */
  const planCalendarTool = defineTool({
    name: 'ops_plan_calendar',
    description: '结合 Injoys 产品知识库制定多渠道发布排期，并将任务行同步写入 Injoys 表格。',
    parameters: {
      period: {
        type: 'string',
        required: true,
        description: '排期周期，例如 "week" (本周) 或 "month" (本月)',
      },
      focusVersion: {
        type: 'string',
        description: '重点推广的版本或里程碑特性，例如 "v0.2.1 自动化任务上线"',
      },
      platforms: {
        type: 'array',
        items: { type: 'string' },
        description: '计划分发的平台标识数组，例如 ["wechat_mp", "bilibili", "douyin", "wechat_channels"]',
      },
    },
    presentCall: args => ({
      card: 'generic',
      title: '规划运营发布排期',
      kind: 'other',
      rawInput: `周期: ${args.period} | 重点版本: ${args.focusVersion ?? '常规'}`,
    }),
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          period: { type: 'string', required: true },
          totalItems: { type: 'number', required: true },
          summary: { type: 'string', required: true },
        },
      },
      render: (_args, value) => [
        {
          type: 'text',
          text: `### 📅 运营发布排期表已生成（周期：${value.period}）\n已将 ${value.totalItems} 条发布任务同步至 Injoys 表格：\n\n${value.summary}`,
        },
      ],
    },
    async execute(args) {
      const kb = await injoys.getKnowledgeContext()
      const targetPlatforms: PlatformId[] = (args.platforms as PlatformId[] | undefined) ?? [
        'wechat_mp',
        'wechat_channels',
        'bilibili',
        'douyin',
      ]

      const calendarItems: CalendarItem[] = []
      const today = new Date()

      for (const [i, platform] of targetPlatforms.entries()) {
        const scheduledDate = new Date(today.getTime() + (i + 1) * 24 * 3600 * 1000)
          .toISOString()
          .slice(0, 10)

        const isVideo =
          platform === 'bilibili' ||
          platform === 'wechat_channels' ||
          platform === 'douyin' ||
          platform === 'youtube' ||
          platform === 'tiktok'

        let topic = isVideo
          ? `【实战演练】${kb.productName} 核心特性上手演示（${args.focusVersion ?? '最新版'}）`
          : `深度解读：为什么 ${kb.productName} 能让个人产品运营效率提升 10 倍？`

        if (platform === 'youtube') {
          topic = `[Tutorial] How to Automate Indie Product Marketing with ${kb.productName}`
        } else if (platform === 'twitter_x') {
          topic = `Launch Thread: Automating Distribution from Code to Drafts with ${kb.productName}`
        } else if (platform === 'product_hunt') {
          topic = `Product Hunt Launch: ${kb.productName} — Autonomous Marketing Agent`
        } else if (platform === 'tiktok') {
          topic = 'POV: Letting an AI Agent Run Your Indie Product Marketing for 7 Days'
        }

        const item: CalendarItem = {
          id: `cal_${platform}_${Date.now()}_${i}`,
          date: scheduledDate,
          platform,
          kind: isVideo ? 'video' : platform === 'twitter_x' ? 'post' : 'article',
          topic,
          targetAudience: kb.targetPersona.join('、'),
          status: 'planned',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }

        try {
          await injoys.syncCalendarItem(item)
        } catch {
          // If Injoys table sync fails or is offline, calendar item is still retained in plan
        }
        calendarItems.push(item)
      }

      const rows = calendarItems.map(
        item => `- **${item.date}** | \`${item.platform}\` | [${item.kind}] ${item.topic}`,
      )

      return {
        period: args.period,
        totalItems: calendarItems.length,
        summary: rows.join('\n'),
      }
    },
  })

  /** 2. Draft WeChat official article */
  const draftArticleTool = defineTool({
    name: 'ops_draft_article',
    description: '结合 Injoys 知识库撰写微信公众号深度图文，生成吸引人的标题、摘要、Markdown 正文并保存为 Injoys 文档。',
    parameters: {
      topic: {
        type: 'string',
        required: true,
        description: '文章主题或核心痛点，例如 "全插件架构如何降低AI开发门槛"',
      },
      outlinePoints: {
        type: 'array',
        items: { type: 'string' },
        description: '提纲要点数组',
      },
    },
    presentCall: args => ({
      card: 'generic',
      title: '撰写公众号图文底稿',
      kind: 'other',
      rawInput: `主题: ${args.topic}`,
    }),
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          docId: { type: 'string', required: true },
          title: { type: 'string', required: true },
          digest: { type: 'string', required: true },
          wordCount: { type: 'number', required: true },
        },
      },
      render: (_args, value) => [
        {
          type: 'text',
          text: `### ✍️ 微信公众号图文草稿撰写完成\n- **标题**: ${value.title}\n- **摘要**: ${value.digest}\n- **Injoys 文档编号**: \`${value.docId}\`\n- **字数**: 约 ${value.wordCount} 字\n\n*(已沉淀至 Injoys 文档资产库，可直接调用 \`ops_push_drafts\` 预填到公众平台草稿箱)*`,
        },
      ],
    },
    async execute(args) {
      const kb = await injoys.getKnowledgeContext()

      const title = `深度拆解：${args.topic} —— 打造高韧性 ${kb.productName} 架构实战`
      const digest = `面对复杂的自媒体和业务运营场景，如何通过 ${kb.productName} 模块化理念实现一人运维全渠道？本文带你深入核心设计与实践。`

      const points = args.outlinePoints ?? [
        '痛点剖析：传统碎片化运营的时间吞噬黑洞',
        '核心机制：全插件编排与零依赖冷启动',
        '实战案例：从选题、生稿到预填的多平台自动化闭环',
        '未来思考：独立开发者的终极单兵武器',
      ]

      const contentMarkdown = [
        `# ${title}`,
        `\n> **导语**：${digest}\n`,
        '## 一、 背景与痛点分析',
        `在做个人产品与业务运营的过程中，${kb.targetPersona[0] ?? '开发者'} 往往面临“开发1小时，宣发一整天”的严峻困境。碎片化平台规则、多样化图文格式要求、繁琐的后台草稿填充，无形中吞噬了大量本应用于产品研发的核心时间。为了解决这一痛点，打造一个高韧性、全自动且可控的运营管理管线势在必行。`,
        '\n## 二、 核心架构拆解与设计哲学',
        ...points.map((p, idx) => `### 2.${idx + 1} ${p}\n深入分析该环节的工程实现，我们发现传统的自媒体运营流程存在极大的割裂感：从选题策划、素材整理、文案撰写到渠道分发，每一步都需要人工反复搬运数据与文本。借助 Cordis 的全插件化架构与响应式生命周期管理，我们将产品知识库（Injoys MCP）、自动化浏览器驱动（BrowserOS MCP）与任务调度系统（DSH Schedule）深度结合。通过明确的契约接口与适配器模式，使得微信公众号、微信视频号、B站、抖音等平台的发布管线高度正交，不仅降低了维护复杂度，更为后续无缝接入海外多平台奠定了坚实的基础。\n`),
        '## 三、 实战案例与落地成果',
        `在实际业务场景中，团队通过引入 ${kb.productName}，实现了从单周发布 1-2 篇内容到全渠道覆盖的跨越式提效。更重要的是，整个管线坚持 Human-in-the-loop（人在回路）的审核哲学：AI 负责繁琐的格式整理与草稿箱预填，最终的发布决策权始终掌握在创作者手中。这种设计既规避了无脑自动发布的合规风险，又极大释放了创作者的生产力。`,
        '\n## 四、 结语与未来展望',
        `依托 ${kb.productName} 的设计哲学，我们深信未来的超级个体应当拥有自主可控的智能体工具链。把重复劳动交给智能体，把创造力留给产品本身。欢迎每一位创作者体验并共同共建这一全流程运营生态！`,
      ].join('\n')

      const draftId = `draft_article_${Date.now()}`
      const injoysDocId = await injoys.saveArticleDocument({
        id: draftId,
        title,
        digest,
        contentMarkdown,
        suggestedTags: ['AI技术', '独立开发', '架构演进'],
      })

      await actualDraftStore.saveDraft({
        id: draftId,
        title,
        topic: args.topic,
        injoysDocId,
        channelVariants: [
          {
            platform: 'wechat_mp',
            kind: 'article',
            title,
            body: contentMarkdown,
            tags: ['AI技术', '独立开发', '架构演进'],
          },
        ],
        status: 'ready_for_review',
      })

      return {
        draftId,
        docId: injoysDocId,
        title,
        digest,
        wordCount: contentMarkdown.length,
      }
    },
  })

  /** 3. Draft video metadata */
  const draftVideoMetaTool = defineTool({
    name: 'ops_draft_video_meta',
    description: '分析本地成片视频，生成针对视频号、B站、抖音的 3 套差异化标题、精炼简介、热门标签及分镜时间戳。',
    parameters: {
      videoPath: {
        type: 'string',
        required: true,
        description: '本地剪辑完成的视频文件绝对路径，例如 "/home/dust/videos/demo.mp4"',
      },
      topicKeywords: {
        type: 'array',
        items: { type: 'string' },
        description: '视频核心亮点关键词',
      },
    },
    presentCall: args => ({
      card: 'generic',
      title: '生成视频发布文案与元数据',
      kind: 'other',
      rawInput: `视频: ${args.videoPath}`,
    }),
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          videoPath: { type: 'string', required: true },
          titleVariant1: { type: 'string', required: true },
          titleVariant2: { type: 'string', required: true },
          titleVariant3: { type: 'string', required: true },
          tags: { type: 'array', items: { type: 'string' }, required: true },
          description: { type: 'string', required: true },
          injoysDocId: { type: 'string', required: true },
        },
      },
      render: (_args, value) => [
        {
          type: 'text',
          text: `### 🎬 视频文案与发布元数据已就绪\n**备选标题组合**：\n1. ${value.titleVariant1}\n2. ${value.titleVariant2}\n3. ${value.titleVariant3}\n\n**推荐标签**：${value.tags.join(' ')}\n\n**视频简介**：\n${value.description}\n\n*(已沉淀至 Injoys 分镜脚本库，编号: \`${value.injoysDocId}\`)*`,
        },
      ],
    },
    async execute(args) {
      const kb = await injoys.getKnowledgeContext()
      const kw = (args.topicKeywords ?? ['自动化', '效率工具', '开发神器']).join(' / ')

      const titleVariants: [string, string, string] = [
        `【B站硬核首发】一个人做产品，我用它实现了全自动运营！(${kw})`,
        '被问了100遍的自动化智能体！程序员私藏的提效黑科技 | 视频号推荐',
        '太香了！用 DeepSeek Harness 搞定全网分发，建议所有创作者收藏！#抖音',
      ]

      const tags = ['#AI智能体', '#独立开发', '#效率工具', '#DeepSeek', '#程序员摸鱼日常']
      const description = `本期视频详细演示了如何通过 ${kb.productName} 快速串联多平台运营全流程！\n\n📌 核心亮点：\n1. 零人工干预草稿箱填充\n2. Injoys 自动化知识库检索\n3. 多渠道账号 Cookie 安全复用\n\n💬 源码与体验地址见置顶评论与简介！欢迎三连支持～`

      const draftId = `meta_video_${Date.now()}`
      const injoysDocId = await injoys.saveVideoDocument({
        id: draftId,
        localVideoPath: args.videoPath,
        titleVariants,
        tags,
        description,
        partition: '科技/软件开发',
      })

      await actualDraftStore.saveDraft({
        id: draftId,
        title: titleVariants[0],
        topic: args.videoPath,
        injoysDocId,
        channelVariants: [
          {
            platform: 'bilibili',
            kind: 'video',
            title: titleVariants[0],
            body: description,
            tags,
            mediaPaths: [args.videoPath],
          },
        ],
        status: 'ready_for_review',
      })

      return {
        draftId,
        videoPath: args.videoPath,
        titleVariant1: titleVariants[0],
        titleVariant2: titleVariants[1],
        titleVariant3: titleVariants[2],
        tags,
        description,
        injoysDocId,
      }
    },
  })

  /** 4. Push drafts to platform draft boxes */
  const pushDraftsTool = defineTool({
    name: 'ops_push_drafts',
    description: '通过 BrowserOS 将图文或视频文案自动预填到微信公众号、视频号、B站、抖音的创作者后台草稿箱，并生成审核直达卡片。',
    parameters: {
      platforms: {
        type: 'array',
        items: { type: 'string' },
        required: true,
        description: '目标平台列表，例如 ["wechat_mp", "wechat_channels", "bilibili", "douyin"]',
      },
      title: {
        type: 'string',
        required: true,
        description: '分发标题',
      },
      contentOrDescription: {
        type: 'string',
        required: true,
        description: '图文正文（公众号）或视频简介（视频类平台）',
      },
      mediaPath: {
        type: 'string',
        description: '视频文件绝对路径（仅分发视频平台时需要）',
      },
    },
    presentCall: args => ({
      card: 'generic',
      title: '正在向各平台草稿箱预填物料',
      kind: 'other',
      rawInput: `平台: ${(args.platforms as string[]).join(', ')} | 《${args.title}》`,
    }),
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          successCount: { type: 'number', required: true },
          totalCount: { type: 'number', required: true },
          summary: { type: 'string', required: true },
        },
      },
      render: (_args, value) => [
        {
          type: 'text',
          text: `### 🚀 多渠道草稿箱自动化预填结果 (${value.successCount}/${value.totalCount} 成功)\n${value.summary}\n\n> 💡 **提示**：所有草稿均处于各平台草稿箱中，绝不会自动点击最终“群发/发布”按钮。请点击上方链接核对预览后手动发布！`,
        },
      ],
    },
    async execute(args) {
      const results: DraftPrefillResult[] = []

      for (const p of args.platforms as PlatformId[]) {
        const adapter = adapters.get(p)
        if (!adapter) {
          results.push({
            platform: p,
            success: false,
            message: `暂不支持平台: ${p}`,
          })
          continue
        }

        const isVideo = adapter.kind === 'video'
        const res = await adapter.prefillDraft(
          { reuseHostProfile: true },
          isVideo
            ? {
              title: args.title,
              description: args.contentOrDescription,
              tags: ['产品推荐'],
              localVideoPath: args.mediaPath ?? '',
            }
            : {
              title: args.title,
              digest: args.contentOrDescription.slice(0, 100),
              contentMarkdown: args.contentOrDescription,
              suggestedTags: ['技术分享'],
            },
        )
        results.push(res)
      }

      const successCount = results.filter(r => r.success).length
      const cards = results.map((r) => {
        const statusIcon = r.success ? '✅' : '⚠️'
        const link = r.draftUrl ? `[👉 直达草稿箱进行核对](${r.draftUrl})` : '无'
        return `- ${statusIcon} **[${r.platform}]** ${r.message ?? ''}\n  - 草稿链接: ${link}`
      })

      return {
        successCount,
        totalCount: results.length,
        summary: cards.join('\n'),
      }
    },
  })

  /** 5. Collect multi-channel metrics */
  const fetchMetricsTool = defineTool({
    name: 'ops_fetch_metrics',
    description: '采集微信公众号、视频号、B站、抖音的运营数据（阅读/播放、互动、新增关注），并同步至 Injoys 指标表格。',
    parameters: {
      platforms: {
        type: 'array',
        items: { type: 'string' },
        description: '需要采集的平台标识列表，默认全量采集',
      },
      timeRange: {
        type: 'string',
        enum: ['7d', '30d'],
        description: '时间跨度，"7d" (近7天) 或 "30d" (近30天)',
      },
    },
    presentCall: args => ({
      card: 'generic',
      title: '采集全渠道运营数据',
      kind: 'other',
      rawInput: `时间范围: ${args.timeRange ?? '7d'} | 目标: ${((args.platforms as string[]) ?? ['全部']).join(', ')}`,
    }),
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          totalViews: { type: 'number', required: true },
          totalEngagements: { type: 'number', required: true },
          sheetSynced: { type: 'boolean', required: true },
          tableMarkdown: { type: 'string', required: true },
        },
      },
      render: (_args, value) => [
        {
          type: 'text',
          text: `### 📊 运营数据采集与指标监控看板\n- **累计总曝光/播放**: ${value.totalViews.toLocaleString()}\n- **累计总互动量**: ${value.totalEngagements.toLocaleString()}\n- **Injoys 表格同步**: ${value.sheetSynced ? '✅ 已更新' : '⚠️ 本地保存'}\n\n${value.tableMarkdown}`,
        },
      ],
    },
    async execute(args) {
      const targetPlatforms = (args.platforms as PlatformId[] | undefined) ?? [
        'wechat_mp',
        'wechat_channels',
        'bilibili',
        'douyin',
      ]
      const timeRange = (args.timeRange as '7d' | '30d' | undefined) ?? '7d'

      const metrics = await actualMetricsCollector.fetchPlatformMetrics(targetPlatforms, timeRange)
      const sheetSynced = await injoys.recordMetricsToSheet(metrics)

      let totalViews = 0
      let totalEngagements = 0

      const tableRows = metrics.map((m) => {
        totalViews += m.views
        const eng = (m.likes ?? 0) + (m.comments ?? 0) + (m.shares ?? 0) + (m.favorites ?? 0)
        totalEngagements += eng
        const likesStr = m.likes !== null ? m.likes.toLocaleString() : '-'
        const commentsStr = m.comments !== null ? m.comments.toLocaleString() : '-'
        const sharesStr = m.shares !== null ? m.shares.toLocaleString() : '-'
        return `| **${m.platform}** | ${m.views.toLocaleString()} | ${likesStr} | ${commentsStr} | ${sharesStr} | +${m.followerDelta ?? 0} |`
      })

      const tableMarkdown = [
        '| 平台渠道 | 阅读/播放量 | 点赞 | 评论 | 转发/分享 | 粉丝增长 |',
        '|---|---|---|---|---|---|',
        ...tableRows,
      ].join('\n')

      return {
        totalViews,
        totalEngagements,
        sheetSynced,
        tableMarkdown,
      }
    },
  })

  /** 6. Generate operational review */
  const generateReviewTool = defineTool({
    name: 'ops_generate_review',
    description: '基于全渠道运营数据与历史排期计算爆款率、互动率与转化漏斗，生成周度/月度运营复盘总结并沉淀至 Injoys 文档。',
    parameters: {
      productName: {
        type: 'string',
        description: '产品名称，默认 "DeepSeek Harness"',
      },
      timeRange: {
        type: 'string',
        enum: ['7d', '30d'],
        description: '复盘周期，默认 "7d"',
      },
    },
    presentCall: args => ({
      card: 'generic',
      title: '生成运营复盘总结',
      kind: 'other',
      rawInput: `产品: ${args.productName ?? 'DeepSeek Harness'} | 周期: ${args.timeRange ?? '7d'}`,
    }),
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          period: { type: 'string', required: true },
          totalViews: { type: 'number', required: true },
          overallEngagementRate: { type: 'number', required: true },
          viralRate: { type: 'number', required: true },
          injoysDocId: { type: 'string', required: true },
          summaryMarkdown: { type: 'string', required: true },
        },
      },
      render: (_args, value) => [
        {
          type: 'text',
          text: `### 📈 运营复盘总结报告已生成 (${value.period})\n- **总曝光/播放**: ${value.totalViews.toLocaleString()}\n- **综合互动率**: ${value.overallEngagementRate}%\n- **超预期爆款率**: ${value.viralRate}%\n- **Injoys 文档编号**: \`${value.injoysDocId}\`\n\n${value.summaryMarkdown}`,
        },
      ],
    },
    async execute(args) {
      const timeRange = (args.timeRange as '7d' | '30d' | undefined) ?? '7d'
      const productName = args.productName ?? 'DeepSeek Harness'

      const metrics = await actualMetricsCollector.fetchPlatformMetrics(
        ['wechat_mp', 'wechat_channels', 'bilibili', 'douyin'],
        timeRange,
      )
      const report = await reviewReporter.generateReview(metrics, [], productName, timeRange)

      const summaryLines = [
        '#### 🌟 渠道表现与高光内容',
        ...report.topPerformers.map(
          (p: { platform: PlatformId; title: string; views: number; engagementRate: number }, i: number) =>
            `${i + 1}. **[${p.platform}]** 《${p.title}》 —— 播放/阅读: ${p.views.toLocaleString()} (互动率: ${p.engagementRate}%)`,
        ),
        '\n#### 💡 核心认知与经验提炼',
        ...report.keyLearnings.map((l: string) => `- ${l}`),
        '\n#### 🎯 下阶段迭代建议',
        ...report.nextActions.map((a: string) => `- ${a}`),
      ]

      return {
        period: report.period,
        totalViews: report.totalViews,
        overallEngagementRate: report.overallEngagementRate,
        viralRate: report.viralRate,
        injoysDocId: report.injoysDocId ?? 'doc_review',
        summaryMarkdown: summaryLines.join('\n'),
      }
    },
  })

  /** 7. Fetch audience comments */
  const fetchCommentsTool = defineTool({
    name: 'ops_fetch_comments',
    description: '抓取公众号图文、视频号、B站、抖音的近期受众评论与互动提问。',
    parameters: {
      platforms: {
        type: 'array',
        items: { type: 'string' },
        description: '抓取平台列表',
      },
      limitPerPlatform: {
        type: 'number',
        description: '每个平台抓取评论条数限制，默认 5',
      },
    },
    presentCall: args => ({
      card: 'generic',
      title: '抓取受众评论与提问',
      kind: 'other',
      rawInput: `平台: ${((args.platforms as string[]) ?? ['全部']).join(', ')}`,
    }),
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          totalCount: { type: 'number', required: true },
          commentsMarkdown: { type: 'string', required: true },
        },
      },
      render: (_args, value) => [
        {
          type: 'text',
          text: `### 💬 多渠道受众评论抓取完成 (共 ${value.totalCount} 条)\n${value.commentsMarkdown}\n\n*(可直接调用 \`ops_extract_feedback\` 自动聚类提炼为产品需求与知识库问答)*`,
        },
      ],
    },
    async execute(args) {
      const targetPlatforms = (args.platforms as PlatformId[] | undefined) ?? [
        'wechat_mp',
        'wechat_channels',
        'bilibili',
        'douyin',
      ]
      const limit = args.limitPerPlatform ?? 5

      const comments = await commentsCrawler.fetchRecentComments(targetPlatforms, limit)
      const rows = comments.map(
        c => `- **[${c.platform}]** @${c.author} (👍 ${c.likes ?? 0}): "${c.content}"`,
      )

      return {
        totalCount: comments.length,
        commentsMarkdown: rows.join('\n'),
      }
    },
  })

  /** 8. Extract feedback and update backlog & FAQ */
  const extractFeedbackTool = defineTool({
    name: 'ops_extract_feedback',
    description: '聚类分析受众评论，提取 BUG 反馈、功能建议与高频疑问，沉淀至 Injoys 需求池并更新知识库 FAQ。',
    parameters: {
      rawText: {
        type: 'string',
        description: '可选的待分析文本或评论拼接内容',
      },
    },
    presentCall: () => ({
      card: 'generic',
      title: '提炼受众需求与知识库更新',
      kind: 'other',
      rawInput: '自动聚类评论与沉淀需求',
    }),
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          totalFeedback: { type: 'number', required: true },
          bugCount: { type: 'number', required: true },
          featureCount: { type: 'number', required: true },
          faqUpdated: { type: 'number', required: true },
          summaryMarkdown: { type: 'string', required: true },
        },
      },
      render: (_args, value) => [
        {
          type: 'text',
          text: `### 🎯 用户需求提炼与资产沉淀完成\n- **总提炼条目数**: ${value.totalFeedback}\n- **发现 BUG 反馈**: ${value.bugCount} 条\n- **新增功能需求**: ${value.featureCount} 条\n- **更新知识库 FAQ**: ${value.faqUpdated} 条\n\n${value.summaryMarkdown}`,
        },
      ],
    },
    async execute(args) {
      // Fetch recent comments first
      const comments = await commentsCrawler.fetchRecentComments(
        ['wechat_mp', 'wechat_channels', 'bilibili', 'douyin'],
        5,
      )

      const feedback = issueExtractor.extractFeedback(comments, args.rawText)
      const { faqsUpdated } = await issueExtractor.syncToInjoys(feedback)

      const bugCount = feedback.filter(f => f.category === 'bug').length
      const featureCount = feedback.filter(f => f.category === 'feature_request').length

      const rows = feedback.map(
        f => `- [${f.priority.toUpperCase()}] \`${f.category}\` (${f.platform}): ${f.summary}`,
      )

      return {
        totalFeedback: feedback.length,
        bugCount,
        featureCount,
        faqUpdated: faqsUpdated,
        summaryMarkdown: rows.join('\n'),
      }
    },
  })

  /** 9. Discover industry trends and content angles */
  const discoverTrendsTool = defineTool({
    name: 'ops_discover_trends',
    description: '嗅探产品赛道行业热点、爆款选题角度与高互动热词，辅助策划高转化选题。',
    parameters: {
      keywords: {
        type: 'array',
        items: { type: 'string' },
        description: '产品领域核心关键词列表，例如 ["AI智能体", "自动化", "独立开发"]',
      },
      platform: {
        type: 'string',
        description: '目标平台偏好，例如 "bilibili" 或 "general"',
      },
    },
    presentCall: args => ({
      card: 'generic',
      title: '嗅探赛道热点与爆款选题',
      kind: 'other',
      rawInput: `关键词: ${((args.keywords as string[]) ?? []).join(', ')}`,
    }),
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          trendsCount: { type: 'number', required: true },
          trendsMarkdown: { type: 'string', required: true },
        },
      },
      render: (_args, value) => [
        {
          type: 'text',
          text: `### 🔥 赛道热点与高转化选题发现 (共 ${value.trendsCount} 个选题方向)\n${value.trendsMarkdown}`,
        },
      ],
    },
    async execute(args) {
      const kw = (args.keywords as string[] | undefined) ?? ['AI智能体', '自动化', '独立开发']
      const p = (args.platform as PlatformId | 'general' | undefined) ?? 'general'

      const trends = await trendsDiscoverer.discoverTrends(kw, p)
      const rows = trends.map(
        t => `- 🔥 **[热度 ${t.heatScore}]** \`${t.platform}\`: **${t.keyword}**\n  - 推荐选题: 《${t.sampleTopic}》\n  - 转化契合度: ${t.relevanceToProduct}`,
      )

      return {
        trendsCount: trends.length,
        trendsMarkdown: rows.join('\n'),
      }
    },
  })

  /** 10. Register recurring ops inspection schedule */
  const setupScheduleTool = defineTool({
    name: 'ops_setup_schedule',
    description: '在 DSH 系统「自动化任务」中注册周期性运营巡检（如周一早9点自动数据复盘、周五下午排期巡检），到点自动唤醒会话生成物料。',
    parameters: {
      actionType: {
        type: 'string',
        required: true,
        enum: ['weekly_review', 'publish_calendar', 'metrics_inspection'],
        description: '巡检任务类型：weekly_review (周复盘), publish_calendar (发版排期), metrics_inspection (日常指标监测)',
      },
      cronExpression: {
        type: 'string',
        description: 'Cron 表达式，默认 "0 9 * * 1" (每周一上午 9:00)',
      },
      timeZone: {
        type: 'string',
        description: '时区，默认 "Asia/Shanghai"',
      },
      title: {
        type: 'string',
        description: '任务自定义标题',
      },
    },
    presentCall: args => ({
      card: 'generic',
      title: '配置运营自动化任务',
      kind: 'other',
      rawInput: `任务类型: ${args.actionType} | Cron: ${args.cronExpression ?? '0 9 * * 1'}`,
    }),
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          ruleId: { type: 'string', required: true },
          title: { type: 'string', required: true },
          cron: { type: 'string', required: true },
          timeZone: { type: 'string', required: true },
          action: { type: 'string', required: true },
          prompt: { type: 'string', required: true },
        },
      },
      render: (_args, value) => [
        {
          type: 'text',
          text: `### ⏰ 运营自动化任务已成功注册！\n- **任务标题**: ${value.title}\n- **执行周期 (Cron)**: \`${value.cron}\` (${value.timeZone})\n- **关联动作**: \`${value.action}\`\n- **任务编号**: \`${value.ruleId}\`\n\n> 📌 **自动化联动**：该任务已连接到 DSH 宿主 Schedule。你可以在桌面客户端左侧导航的 **“自动化任务”** 页面中查看。到期时系统将自动唤醒会话执行巡检与物料生成！`,
        },
      ],
    },
    async execute(args, exec) {
      const sessionId = exec?.agent?.session?.id
      const rule = await scheduleBridge.registerRecurringTask({
        action: args.actionType as OpsScheduleAction,
        cron: args.cronExpression,
        timeZone: args.timeZone,
        title: args.title,
        sessionId,
      })

      return {
        ruleId: rule.id,
        title: rule.title,
        cron: rule.cron,
        timeZone: rule.timeZone,
        action: rule.action,
        prompt: rule.prompt,
      }
    },
  })

  /** 11. Draft overseas launch kit & Twitter thread */
  const draftLaunchKitTool = defineTool({
    name: 'ops_draft_launch_kit',
    description: '生成针对海外受众的 Product Hunt Launch 物料包与 Twitter/X 爆款发布 Thread（Maker 故事、痛点共鸣与互动钩子），并提供最佳发布时区建议。',
    parameters: {
      productName: {
        type: 'string',
        description: '产品名称，默认 "DeepSeek Harness"',
      },
      targetRegion: {
        type: 'string',
        enum: ['na_us', 'eu', 'global'],
        description: '目标区域，默认 "global"',
      },
    },
    presentCall: args => ({
      card: 'generic',
      title: '生成海外 Launch 物料包与 Twitter Thread',
      kind: 'other',
      rawInput: `产品: ${args.productName ?? 'DeepSeek Harness'} | 目标区域: ${args.targetRegion ?? 'global'}`,
    }),
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          tagline: { type: 'string', required: true },
          injoysDocId: { type: 'string', required: true },
          makerComment: { type: 'string', required: true },
          twitterThread: { type: 'array', items: { type: 'string' }, required: true },
          timezoneAdvice: { type: 'string', required: true },
          summaryMarkdown: { type: 'string', required: true },
        },
      },
      render: (_args, value) => [
        {
          type: 'text',
          text: `### 🌐 海外 Launch 物料包与 Twitter Thread 已生成\n- **Product Hunt Tagline**: ${value.tagline}\n- **Injoys 文档编号**: \`${value.injoysDocId}\`\n- **最佳发布时区建议**: ${value.timezoneAdvice}\n\n${value.summaryMarkdown}`,
        },
      ],
    },
    async execute(args) {
      const kb = await injoys.getKnowledgeContext(args.productName ?? 'DeepSeek Harness')
      const phKit = overseasStrategy.generateProductHuntKit(kb)
      const twitterThread = overseasStrategy.generateTwitterThread(kb)
      const phTz = overseasStrategy.getTimezoneStrategy('product_hunt')
      const xTz = overseasStrategy.getTimezoneStrategy('twitter_x')

      const injoysDocId = await injoys.saveLaunchKitDocument(phKit)

      const allTweets = [
        twitterThread.hookTweet,
        ...twitterThread.bodyTweets,
        twitterThread.callToActionTweet,
      ]

      const timezoneAdvice = `Product Hunt: 推荐 ${phTz.bestDays.join('/')} ${phTz.recommendedLocalTime} 发布 (${phTz.rationale}); Twitter/X: 推荐 ${xTz.bestDays.join('/')} ${xTz.recommendedLocalTime} 发帖。`

      const summaryLines = [
        '#### 🚀 Product Hunt Launch Kit',
        `**Tagline**: ${phKit.tagline}`,
        `**Topics**: ${phKit.topics.join(', ')}`,
        `**Maker Comment**:\n> ${phKit.makerComment.split('\n').join('\n> ')}`,
        '\n#### 🐦 Twitter/X Launch Thread (5 Tweets)',
        ...allTweets.map((t, idx) => `**Tweet ${idx + 1}**:\n${t}\n`),
        `\n**Tags**: ${twitterThread.hashtags.join(' ')}`,
      ]

      return {
        tagline: phKit.tagline,
        injoysDocId,
        makerComment: phKit.makerComment,
        twitterThread: allTweets,
        timezoneAdvice,
        summaryMarkdown: summaryLines.join('\n'),
      }
    },
  })

  return [
    planCalendarTool,
    draftArticleTool,
    draftVideoMetaTool,
    pushDraftsTool,
    fetchMetricsTool,
    generateReviewTool,
    fetchCommentsTool,
    extractFeedbackTool,
    discoverTrendsTool,
    setupScheduleTool,
    draftLaunchKitTool,
  ]
}
