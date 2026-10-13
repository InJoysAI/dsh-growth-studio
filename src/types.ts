/**
 * Core type definitions for the Growth Studio (Ops Manager) plugin.
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

/** Four-state session lifecycle. */
export type SessionState =
  | 'unknown'
  | 'needs_login'
  | 'authenticated'
  | 'no_publish_permission'

/** Platform session status for workbench display. */
export interface PlatformSessionStatus {
  id?: PlatformId | undefined
  platform: PlatformId
  name?: string | undefined
  kind?: ContentKind | undefined
  state: SessionState
  isReady: boolean
  loggedIn?: boolean | undefined
  accountName?: string | undefined
  scanRequired?: boolean | undefined
  draftEditorUrl?: string | undefined
  lastCheckedAt: string
  message: string
}

/** Channel-specific variant within a ContentDraft. */
export interface ChannelVariant {
  platform: PlatformId
  kind: ContentKind
  title: string
  body: string
  tags: string[]
  mediaPaths?: string[] | undefined
  coverPath?: string | undefined
}

/** Persistent ContentDraft model stored in $DSH_HOME/growth-studio/drafts/. */
export interface ContentDraft {
  id: string
  title: string
  topic: string
  targetAudience?: string | undefined
  channelVariants: ChannelVariant[]
  status: 'draft' | 'ready_for_review' | 'prefilled' | 'published'
  version: number
  injoysDocId?: string | undefined
  prefillResults?: Partial<Record<PlatformId, { draftId?: string; draftUrl?: string; prefilledAt: string }>> | undefined
  publishedUrls?: Partial<Record<PlatformId, string>> | undefined
  createdAt: string
  updatedAt: string
}

/** Single entry in the Injoys content calendar spreadsheet. */
export interface CalendarItem {
  id: string
  date: string // YYYY-MM-DD
  platform: PlatformId
  kind: ContentKind
  topic: string
  targetAudience?: string | undefined
  status: ItemStatus
  documentId?: string | undefined // Associated Injoys document ID
  mediaPath?: string | undefined // Local video / image absolute path
  draftUrl?: string | undefined // Direct URL to platform draft editor
  publishedUrl?: string | undefined
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
  recentChangelog?: string[] | undefined
  faqEntries?: Array<{ question: string; answer: string }> | undefined
}

/** Rich article draft produced for WeChat Official Account. */
export interface ArticleDraft {
  id: string
  title: string
  digest: string
  contentMarkdown: string
  coverPrompt?: string | undefined
  suggestedTags: string[]
  injoysDocId?: string | undefined
}

/** Video draft metadata produced for Channels / Bilibili / Douyin. */
export interface VideoMetadataDraft {
  id: string
  localVideoPath: string
  titleVariants: [string, string, string] // 3 targeted title options
  tags: string[]
  description: string
  timestampChapters?: Array<{ timestamp: string; label: string }> | undefined
  coverSuggestions?: string[] | undefined
  partition?: string | undefined // Category e.g. 科技/知识/日常
}

/** Platform adapter result when pre-filling drafts via BrowserOS. */
export interface DraftPrefillResult {
  platform: PlatformId
  success: boolean
  draftId?: string | undefined
  draftUrl?: string | undefined
  message?: string | undefined
  requiresUserAction?: boolean | undefined
}

/** Platform performance metrics collected by BrowserOS. */
export interface PlatformMetrics {
  platform: PlatformId
  capturedAt: string
  impressions: number | null
  plays: number | null
  views: number // For backward compatibility: impressions ?? plays ?? 0
  likes: number | null
  comments: number | null
  shares: number | null
  favorites?: number | null | undefined
  followerDelta?: number | null | undefined
  topPostTitle?: string | undefined
}

/** Feedback item extracted from audience comments. */
export interface UserFeedbackItem {
  id: string
  platform: PlatformId
  category: 'bug' | 'feature_request' | 'praise' | 'complaint' | 'question'
  rawComment: string
  summary: string
  priority: 'low' | 'medium' | 'high'
  addressedInVersion?: string | undefined
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
