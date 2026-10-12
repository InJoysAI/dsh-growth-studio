/**
 * Multi-platform Audience Comments Crawler.
 * @module @deepseek-ai/dsh-ops-manager/feedback/comments-crawler
 */

import type { CommentItem, PlatformId } from '../types.js'

export class CommentsCrawler {
  /**
   * Fetch recent comments across selected platforms.
   */
  async fetchRecentComments(
    platforms: PlatformId[],
    limitPerPlatform = 5,
  ): Promise<CommentItem[]> {
    const results: CommentItem[] = []

    for (const platform of platforms) {
      const platformComments = this.getMockCommentsForPlatform(platform, limitPerPlatform)
      results.push(...platformComments)
    }

    return results
  }

  private getMockCommentsForPlatform(platform: PlatformId, limit: number): CommentItem[] {
    const now = new Date().toISOString()
    const pool: Record<PlatformId, Array<Omit<CommentItem, 'id' | 'platform' | 'createdAt'>>> = {
      wechat_mp: [
        {
          author: 'GeekRunner',
          content: '全插件架构思路太清晰了！请问有支持 Docker 单独部署的现成镜像吗？',
          likes: 24,
        },
        {
          author: '独立开发小杰',
          content: '用 Mac 跑的时候终端有时会提示端口占用报错，希望能加个自动切换端口的功能。',
          likes: 12,
        },
        {
          author: '架构师老张',
          content: '文章分析得很深刻，特别是 Cordis 的依赖生命周期设计，收藏了！',
          likes: 35,
        },
      ],
      wechat_channels: [
        {
          author: '前端摸鱼选手',
          content: '这草稿箱一键预填功能太强了！支持小红书吗？急需小红书图文同步！',
          likes: 48,
        },
        {
          author: 'AI探索者',
          content: '请问国内大模型目前除了 DeepSeek 官方 API，还支持本地 Ollama 跑吗？',
          likes: 19,
        },
      ],
      bilibili: [
        {
          author: '代码即艺术',
          content: '【BUG反馈】在 Windows 客户端下，如果开启长视频文件上传，进度条有时会停在 99% 卡住，重试才行。',
          likes: 67,
        },
        {
          author: '硬核数码君',
          content: '三连支持！希望能出一期接入微信公众号排版样式的教程，排版还能自定义吗？',
          likes: 82,
        },
        {
          author: '全栈学徒',
          content: '这个开源项目太宝藏了，每周的运营排期表能直接导出成 Excel 或者飞书表格吗？',
          likes: 31,
        },
      ],
      douyin: [
        {
          author: '做副业的阿强',
          content: '求指路！这个工具新手小白看得懂吗？怎么跟着实操搭建？',
          likes: 104,
        },
        {
          author: '科技范儿',
          content: '好东西，已关注，坐等下期更新！',
          likes: 56,
        },
      ],
      youtube: [
        {
          author: 'AlexDeveloper',
          content: 'The Cordis plugin architecture explained here is brilliant. Does this support headless Docker runs?',
          likes: 54,
        },
        {
          author: 'IndieHackerTom',
          content: 'This saved me hours of manual copy-pasting to social draft boxes! Subscribed.',
          likes: 38,
        },
      ],
      twitter_x: [
        {
          author: '@dev_sarah',
          content: 'Love that it keeps humans in the loop instead of blindly auto-tweeting. Starring the repo! 🚀',
          likes: 89,
        },
        {
          author: '@solopreneur_ben',
          content: 'Can this connect to custom webhooks or Notion databases as well?',
          likes: 42,
        },
      ],
      product_hunt: [
        {
          author: 'Hunter_Chris',
          content: 'Congrats on the launch! How do you handle cookie expiration across platforms?',
          likes: 27,
        },
        {
          author: 'Elena_V',
          content: 'Upvoted! Really impressed by the local-first security model. Great work team!',
          likes: 33,
        },
      ],
      tiktok: [
        {
          author: 'coding_daily',
          content: 'Wait, this actually works without breaking platform rate limits? Mind blown 🤯',
          likes: 142,
        },
        {
          author: 'ai_nerd',
          content: 'Need a tutorial on setting this up on Ubuntu ASAP!',
          likes: 67,
        },
      ],
    }

    const items = pool[platform] ?? []
    return items.slice(0, limit).map((c, idx) => ({
      id: `cmt_${platform}_${Date.now()}_${idx + 1}`,
      platform,
      content: c.content,
      author: c.author,
      createdAt: now,
      likes: c.likes,
    }))
  }
}
