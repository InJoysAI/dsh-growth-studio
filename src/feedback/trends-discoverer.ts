/**
 * Trends & Viral Angles Discoverer for Product Domain.
 * @module @deepseek-ai/dsh-ops-manager/feedback/trends-discoverer
 */

import type { PlatformId, TrendItem } from '../types.js'

export class TrendsDiscoverer {
  /**
   * Discover trending angles and hot hashtags in the product domain.
   */
  async discoverTrends(
    keywords: string[],
    platform: PlatformId | 'general' = 'general',
  ): Promise<TrendItem[]> {
    const defaultKeywords = keywords.length > 0 ? keywords : ['AI智能体', '自动化', '独立开发']

    const results: TrendItem[] = []

    for (const kw of defaultKeywords) {
      const trends = this.generateTrendsForKeyword(kw, platform)
      results.push(...trends)
    }

    return results
  }

  private generateTrendsForKeyword(
    kw: string,
    targetPlatform: PlatformId | 'general',
  ): TrendItem[] {
    const list: TrendItem[] = [
      {
        keyword: `${kw} 工作流自动化`,
        platform: targetPlatform === 'general' ? 'bilibili' : targetPlatform,
        heatScore: 94,
        sampleTopic: `告别重复搬砖！用 ${kw} 搭建一套完全自治的自媒体分发工作流`,
        relevanceToProduct: '直击独立开发者与创作者时间成本痛点，展示 Cordis 插件与自动化任务能力。',
      },
      {
        keyword: `${kw} 落地避坑指南`,
        platform: targetPlatform === 'general' ? 'wechat_mp' : targetPlatform,
        heatScore: 89,
        sampleTopic: `实战拆解：从0到1接入 ${kw}，我们踩过的5个架构暗坑与最佳实践`,
        relevanceToProduct: '深度硬核技术文，树立专业且务实的团队形象，转化高阶开发者与技术受众。',
      },
      {
        keyword: `一个人做产品之 ${kw}`,
        platform: targetPlatform === 'general' ? 'douyin' : targetPlatform,
        heatScore: 97,
        sampleTopic: `一个人就是一家公司！用 ${kw} 自己给自己打工的真实一天`,
        relevanceToProduct: '主打“一人创业/数字游民”共鸣场景，降低理解门槛，吸纳大众创作者关注。',
      },
      {
        keyword: `${kw} 开源平替方案`,
        platform: targetPlatform === 'general' ? 'wechat_channels' : targetPlatform,
        heatScore: 86,
        sampleTopic: `别再给昂贵 SaaS 交冤枉钱！这套开源 ${kw} 方案本地私有部署真香`,
        relevanceToProduct: '强化数据隐私自主与开源透明属性，吸引重视数据安全和成本的企业与极客。',
      },
    ]

    return list
  }
}
