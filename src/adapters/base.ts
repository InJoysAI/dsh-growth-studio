/**
 * Base platform adapter interface for content pre-filling and publishing.
 * @module @deepseek-ai/dsh-ops-manager/adapters/base
 */

import type { PlatformId, DraftPrefillResult, ContentKind } from '../types.js'

export interface AdapterContext {
  /** Target local profile or browser session flag. */
  reuseHostProfile: boolean
  /** Working directory or temp media cache. */
  workspaceDir?: string
}

export interface ArticlePayload {
  title: string
  digest: string
  contentMarkdown: string
  suggestedTags: string[]
  coverPath?: string
}

export interface VideoPayload {
  title: string
  description: string
  tags: string[]
  localVideoPath: string
  coverPath?: string
  /**
   * Platform category/section (e.g. Bilibili 科技/数码). Must be carried through to the
   * platform's category control; it is skipped rather than treated as an error when the
   * platform has no such field (architecture §3.5).
   */
  partition?: string
}

export interface PlatformAdapter {
  readonly id: PlatformId
  readonly name: string
  readonly kind: ContentKind
  readonly draftEditorUrl: string

  /**
   * Check if current browser profile is authenticated on this platform.
   */
  checkLogin(ctx: AdapterContext): Promise<boolean>

  /**
   * Pre-fill draft content on the platform web interface via BrowserOS.
   */
  prefillDraft(
    ctx: AdapterContext,
    payload: ArticlePayload | VideoPayload
  ): Promise<DraftPrefillResult>
}
