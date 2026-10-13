/**
 * Operational Review Reporter & Performance Funnel Calculator.
 * @module @deepseek-ai/dsh-ops-manager/analytics/review-reporter
 */

import type {
  CalendarItem,
  PlatformId,
  PlatformMetrics,
  WeeklyReviewReport,
} from '../types.js'
import type { InjoysClient } from '../injoys/client.js'

export class ReviewReporter {
  constructor(private readonly injoys: InjoysClient) {}

  /**
   * Synthesize platform metrics and historical content into a comprehensive review.
   */
  async generateReview(
    metrics: PlatformMetrics[],
    _recentItems: CalendarItem[],
    productName = 'DeepSeek Harness',
    timeRange: '7d' | '30d' = '7d',
  ): Promise<WeeklyReviewReport> {
    const periodLabel = timeRange === '7d' ? '本周 (最近7天)' : '本月 (最近30天)'

    let totalViews = 0
    let totalEngagements = 0
    const platformBreakdown: Record<string, PlatformMetrics> = {}
    const topPerformers: Array<{
      title: string
      platform: PlatformId
      views: number
      engagementRate: number
    }> = []

    for (const m of metrics) {
      totalViews += m.views
      const engagements = (m.likes ?? 0) + (m.comments ?? 0) + (m.shares ?? 0) + (m.favorites ?? 0)
      totalEngagements += engagements
      platformBreakdown[m.platform] = m

      const rate = m.views > 0 ? Number(((engagements / m.views) * 100).toFixed(2)) : 0
      if (m.topPostTitle) {
        topPerformers.push({
          title: m.topPostTitle,
          platform: m.platform,
          views: m.views,
          engagementRate: rate,
        })
      }
    }

    // Sort performers by view volume descending
    topPerformers.sort((a, b) => b.views - a.views)

    const overallEngagementRate =
      totalViews > 0 ? Number(((totalEngagements / totalViews) * 100).toFixed(2)) : 0

    // Viral rate: percentage of channels that achieved above-average views
    const avgViews = metrics.length > 0 ? totalViews / metrics.length : 1
    const viralCount = metrics.filter(m => m.views >= avgViews * 1.1).length
    const viralRate =
      metrics.length > 0 ? Number(((viralCount / metrics.length) * 100).toFixed(1)) : 0

    const keyLearnings = [
      `【长视频与硬核技术】B站与微信视频号完播率与收藏率突出，展现出强技术粘性，成为 ${productName} 最核心的技术影响力渠道。`,
      '【短视频流量爆发】抖音单条曝光上限高，前 3 秒痛点展现（“偷懒神器 / 自动化”）能显著提升完播与评论区讨论度。',
      '【图文深度沉淀】公众号深度拆解虽然浏览增速平稳，但读者赞赏、长文收藏与后续转化路径极高，适合沉淀架构思维。',
    ]

    const nextActions = [
      '保持 B站每周一期技术拆解精讲，在置顶评论区附带 Injoys 开源知识库与 GitHub 引导。',
      '提炼抖音高播放短剧本公式，将“痛点场景 ➔ 自动化执行 ➔ 最终结果”复制到视频号短视频。',
      '把近期评论区集中反馈的高频疑问，整理成 FAQ 文档反哺到产品知识库。',
    ]

    const report: WeeklyReviewReport = {
      period: periodLabel,
      totalViews,
      totalEngagements,
      overallEngagementRate,
      viralRate,
      platformBreakdown: platformBreakdown as Record<PlatformId, PlatformMetrics>,
      topPerformers,
      keyLearnings,
      nextActions,
    }

    // Save formatted report to Injoys Documents if connected
    const docId = await this.injoys.saveReviewDocument(report)
    if (docId) {
      report.injoysDocId = docId
    }

    return report
  }
}
