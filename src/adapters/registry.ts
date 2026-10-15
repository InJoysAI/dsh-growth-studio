/**
 * Adapter Registry for managing domestic and overseas platform adapters.
 * @module @deepseek-ai/dsh-ops-manager/adapters/registry
 */

import type { PlatformId, DraftPrefillResult } from '../types.js'
import type { PlatformAdapter, AdapterContext, ArticlePayload, VideoPayload } from './base.js'
import { BrowserDriver, type BrowserDriverOptions, type BrowserOsMcpClient } from '../browser/browser-driver.js'

export class WeChatArticleAdapter implements PlatformAdapter {
  readonly id = 'wechat_mp'
  readonly name = '微信公众号'
  readonly kind = 'article' as const
  readonly draftEditorUrl = 'https://mp.weixin.qq.com/cgi-bin/appmsg?t=media/appmsg_edit'

  private readonly driver: BrowserDriver

  constructor(driver?: BrowserDriver) {
    this.driver = driver ?? new BrowserDriver()
  }

  async checkLogin(_ctx: AdapterContext): Promise<boolean> {
    return true
  }

  async prefillDraft(_ctx: AdapterContext, payload: ArticlePayload | VideoPayload): Promise<DraftPrefillResult> {
    const article = payload as ArticlePayload
    return this.driver.planPrefillWorkflow({
      platform: this.id,
      targetUrl: this.draftEditorUrl,
      fields: {
        title: article.title,
        digest: article.digest,
        content: article.contentMarkdown,
        tags: article.suggestedTags.join(','),
      },
      requiredFields: ['title', 'content'],
    })
  }
}

export abstract class BaseVideoAdapter implements PlatformAdapter {
  abstract readonly id: PlatformId
  abstract readonly name: string
  readonly kind = 'video' as const
  abstract readonly draftEditorUrl: string

  private readonly driver: BrowserDriver

  constructor(driver?: BrowserDriver) {
    this.driver = driver ?? new BrowserDriver()
  }

  async checkLogin(_ctx: AdapterContext): Promise<boolean> {
    return true
  }

  async prefillDraft(_ctx: AdapterContext, payload: ArticlePayload | VideoPayload): Promise<DraftPrefillResult> {
    const video = payload as VideoPayload
    const fields: Record<string, string> = {
      title: video.title,
      description: video.description,
      tags: video.tags.join(','),
    }
    // 分区随变体一路传递到平台分区控件；平台无该字段时跳过而非报错（架构 §3.5）
    if (video.partition) fields.partition = video.partition

    return this.driver.planPrefillWorkflow({
      platform: this.id,
      targetUrl: this.draftEditorUrl,
      uploadFilePath: video.localVideoPath,
      fields,
      requiredFields: ['title', 'description'],
    })
  }
}

export class BilibiliVideoAdapter extends BaseVideoAdapter {
  readonly id = 'bilibili'
  readonly name = '哔哩哔哩 (B站)'
  readonly draftEditorUrl = 'https://member.bilibili.com/platform/upload/video/frame'
}

export class ChannelsVideoAdapter extends BaseVideoAdapter {
  readonly id = 'wechat_channels'
  readonly name = '微信视频号'
  readonly draftEditorUrl = 'https://channels.weixin.qq.com/platform'
}

export class DouyinVideoAdapter extends BaseVideoAdapter {
  readonly id = 'douyin'
  readonly name = '抖音创作者中心'
  readonly draftEditorUrl = 'https://creator.douyin.com/creator-micro/content/upload'
}

export class YouTubeAdapter extends BaseVideoAdapter {
  readonly id = 'youtube'
  readonly name = 'YouTube Studio'
  readonly draftEditorUrl = 'https://studio.youtube.com/channel/videos/upload'
}

export class TikTokAdapter extends BaseVideoAdapter {
  readonly id = 'tiktok'
  readonly name = 'TikTok 创作者中心'
  readonly draftEditorUrl = 'https://www.tiktok.com/creator-center/upload'
}

export class TwitterXAdapter implements PlatformAdapter {
  readonly id = 'twitter_x'
  readonly name = 'X (Twitter)'
  readonly kind = 'post' as const
  readonly draftEditorUrl = 'https://x.com/compose/post'

  private readonly driver: BrowserDriver

  constructor(driver?: BrowserDriver) {
    this.driver = driver ?? new BrowserDriver()
  }

  async checkLogin(_ctx: AdapterContext): Promise<boolean> {
    return true
  }

  async prefillDraft(_ctx: AdapterContext, payload: ArticlePayload | VideoPayload): Promise<DraftPrefillResult> {
    const isVideo = 'localVideoPath' in payload
    return this.driver.planPrefillWorkflow({
      platform: this.id,
      targetUrl: this.draftEditorUrl,
      uploadFilePath: isVideo ? payload.localVideoPath : undefined,
      fields: {
        title: payload.title,
        content: isVideo ? payload.description : payload.contentMarkdown,
        tags: isVideo ? payload.tags.join(' ') : payload.suggestedTags.join(' '),
      },
      requiredFields: ['title', 'content'],
    })
  }
}

export class ProductHuntAdapter implements PlatformAdapter {
  readonly id = 'product_hunt'
  readonly name = 'Product Hunt'
  readonly kind = 'article' as const
  readonly draftEditorUrl = 'https://www.producthunt.com/posts/new'

  private readonly driver: BrowserDriver

  constructor(driver?: BrowserDriver) {
    this.driver = driver ?? new BrowserDriver()
  }

  async checkLogin(_ctx: AdapterContext): Promise<boolean> {
    return true
  }

  async prefillDraft(_ctx: AdapterContext, payload: ArticlePayload | VideoPayload): Promise<DraftPrefillResult> {
    const article = payload as ArticlePayload
    return this.driver.planPrefillWorkflow({
      platform: this.id,
      targetUrl: this.draftEditorUrl,
      fields: {
        name: article.title.slice(0, 40),
        tagline: article.digest.slice(0, 60),
        description: article.contentMarkdown,
        topics: article.suggestedTags.join(','),
      },
      requiredFields: ['name', 'description'],
    })
  }
}

export class AdapterRegistry {
  private readonly adapters = new Map<PlatformId, PlatformAdapter>()

  constructor(browserOsClient?: BrowserOsMcpClient, options?: BrowserDriverOptions) {
    this.initAdapters(browserOsClient, options)
  }

  initAdapters(browserOsClient?: BrowserOsMcpClient, options?: BrowserDriverOptions): void {
    const driver = new BrowserDriver(browserOsClient, options)
    // Domestic platforms
    this.register(new WeChatArticleAdapter(driver))
    this.register(new BilibiliVideoAdapter(driver))
    this.register(new ChannelsVideoAdapter(driver))
    this.register(new DouyinVideoAdapter(driver))

    // Overseas platforms (Phase 4)
    this.register(new YouTubeAdapter(driver))
    this.register(new TikTokAdapter(driver))
    this.register(new TwitterXAdapter(driver))
    this.register(new ProductHuntAdapter(driver))
  }

  setBrowserOsClient(browserOsClient?: BrowserOsMcpClient, options?: BrowserDriverOptions): void {
    this.adapters.clear()
    this.initAdapters(browserOsClient, options)
  }

  register(adapter: PlatformAdapter): void {
    this.adapters.set(adapter.id, adapter)
  }

  get(id: PlatformId): PlatformAdapter | undefined {
    return this.adapters.get(id)
  }

  list(): PlatformAdapter[] {
    return Array.from(this.adapters.values())
  }
}
