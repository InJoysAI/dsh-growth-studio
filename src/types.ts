/**
 * Core type definitions for the Ops Manager plugin.
 * @module @deepseek-ai/dsh-ops-manager/types
 */

export type PlatformId =
  | 'wechat_mp'
  | 'wechat_channels'
  | 'bilibili'
  | 'douyin'
  | 'youtube'
  | 'twitter_x'
  | 'product_hunt'
  | 'tiktok'

export type ContentKind = 'article' | 'video' | 'post'

export type ItemStatus =
  | 'planned'
  | 'drafting'
  | 'draft_ready'
  | 'prefilled'
  | 'approved'
  | 'published'
  | 'archived'

/** Single entry in the Injoys content calendar spreadsheet. */
export interface CalendarItem {
  id: string
  date: string // YYYY-MM-DD
  platform: PlatformId
  kind: ContentKind
  topic: string
  targetAudience?: string
  status: ItemStatus
  documentId?: string // Associated Injoys document ID
  mediaPath?: string // Local video / image absolute path
  draftUrl?: string // Direct URL to platform draft editor
  publishedUrl?: string
  createdAt: string
  updatedAt: string
}

/** Product selling point and brand persona retrieved from Injoys knowledge base. */
export interface ProductKnowledgeContext {
  productName: string
  tagline: string
  coreFeatures: string[]
  targetPersona: string[]
  brandTone: string
  recentChangelog?: string[]
  faqEntries?: Array<{ question: string; answer: string }>
}

/** Rich article draft produced for WeChat Official Account. */
export interface ArticleDraft {
  id: string
  title: string
  digest: string
  contentMarkdown: string
  coverPrompt?: string
  suggestedTags: string[]
  injoysDocId?: string
}

/** Video draft metadata produced for Channels / Bilibili / Douyin. */
export interface VideoMetadataDraft {
  id: string
  localVideoPath: string
  titleVariants: [string, string, string] // 3 targeted title options
  tags: string[]
  description: string
  timestampChapters?: Array<{ timestamp: string; label: string }>
  coverSuggestions?: string[]
  partition?: string // Category e.g. 科技/知识/日常
}

/** Platform adapter result when pre-filling drafts via BrowserOS. */
export interface DraftPrefillResult {
  platform: PlatformId
  success: boolean
  draftId?: string
  draftUrl?: string
  message?: string
  requiresUserAction?: boolean
}

/** Platform performance metrics collected by BrowserOS. */
export interface PlatformMetrics {
  platform: PlatformId
  capturedAt: string
  views: number
  likes: number
  comments: number
  shares: number
  favorites?: number
  followerDelta?: number
  topPostTitle?: string
}

/** Feedback item extracted from audience comments. */
export interface UserFeedbackItem {
  id: string
  platform: PlatformId
  category: 'bug' | 'feature_request' | 'praise' | 'complaint' | 'question'
  rawComment: string
  summary: string
  priority: 'low' | 'medium' | 'high'
  addressedInVersion?: string
}

/** Operational weekly/monthly review report. */
export interface WeeklyReviewReport {
  period: string
  totalViews: number
  totalEngagements: number
  overallEngagementRate: number
  viralRate: number
  platformBreakdown: Record<PlatformId, PlatformMetrics>
  topPerformers: Array<{
    title: string
    platform: PlatformId
    views: number
    engagementRate: number
  }>
  keyLearnings: string[]
  nextActions: string[]
  injoysDocId?: string | undefined
}

/** Raw user comment retrieved from platforms. */
export interface CommentItem {
  id: string
  platform: PlatformId
  content: string
  author: string
  createdAt: string
  postId?: string | undefined
  likes?: number | undefined
}

/** Industry and domain trending topic / angle. */
export interface TrendItem {
  keyword: string
  platform: PlatformId | 'general'
  heatScore: number
  sampleTopic: string
  relevanceToProduct: string
}

export type OpsScheduleAction = 'weekly_review' | 'publish_calendar' | 'metrics_inspection'

/** Recurring ops inspection rule registered with DSH Schedule. */
export interface OpsScheduleRule {
  id: string
  action: OpsScheduleAction
  title: string
  cron: string
  timeZone: string
  prompt: string
  active: boolean
  lastTriggeredAt?: string | undefined
}

/** Product Hunt launch kit model for overseas campaigns. */
export interface ProductHuntLaunchKit {
  name: string
  tagline: string // Max 60 characters
  description: string
  topics: string[]
  makerComment: string
  pricingType: 'free' | 'paid' | 'subscription'
  injoysDocId?: string | undefined
}

/** Viral Twitter/X multi-part Thread structure. */
export interface TwitterThreadDraft {
  hookTweet: string
  bodyTweets: string[]
  callToActionTweet: string
  hashtags: string[]
}

/** Timezone strategy for overseas multi-region launches. */
export interface OverseasTimezoneStrategy {
  region: 'na_us' | 'eu' | 'apac' | 'global'
  targetPlatform: PlatformId
  recommendedUtcHour: number
  recommendedLocalTime: string
  timeZone: string
  bestDays: string[]
  rationale: string
}
