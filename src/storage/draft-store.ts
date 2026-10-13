/**
 * Local persistent draft storage for Growth Studio.
 * Persists ContentDraft entities to $DSH_HOME/growth-studio/drafts/{id}.json
 * Supports optimistic concurrency control and in-process write serialization.
 * @module @deepseek-ai/dsh-ops-manager/storage/draft-store
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, unlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { randomBytes } from 'node:crypto'
import type { Context } from '@deepseek-ai/cordis'
import type { ContentDraft, PlatformId } from '../types.js'
import { resolveDshHome } from '../config-store.js'

export class DraftConcurrencyError extends Error {
  constructor(
    message: string,
    public readonly currentVersion: number,
    public readonly expectedVersion: number,
  ) {
    super(message)
    this.name = 'DraftConcurrencyError'
  }
}

export interface SaveDraftOptions {
  /** If specified, verifies that the existing draft matches this version before updating. */
  expectedVersion?: number
}

export class DraftStore {
  private readonly draftsDir: string
  private readonly writeLocks = new Map<string, Promise<void>>()

  constructor(ctx?: Context, customDir?: string) {
    if (customDir) {
      this.draftsDir = customDir
    } else {
      const dshHome = resolveDshHome(ctx)
      this.draftsDir = join(dshHome, 'growth-studio', 'drafts')
    }

    try {
      if (!existsSync(this.draftsDir)) {
        mkdirSync(this.draftsDir, { recursive: true })
      }
    } catch (err) {
      console.warn(`[DraftStore] Failed to ensure drafts directory ${this.draftsDir}:`, err)
    }
  }

  getDirectory(): string {
    return this.draftsDir
  }

  private getFilePath(id: string): string {
    // Sanitize id to prevent path traversal
    const safeId = id.replace(/[^a-zA-Z0-9_-]/g, '_')
    return join(this.draftsDir, `${safeId}.json`)
  }

  private async withWriteLock<T>(id: string, fn: () => Promise<T>): Promise<T> {
    const prevLock = this.writeLocks.get(id) ?? Promise.resolve()
    let releaseLock!: () => void
    const nextLock = new Promise<void>((resolve) => {
      releaseLock = resolve
    })
    this.writeLocks.set(id, nextLock)

    try {
      await prevLock
      return await fn()
    } finally {
      releaseLock()
      if (this.writeLocks.get(id) === nextLock) {
        this.writeLocks.delete(id)
      }
    }
  }

  /**
   * Save or update a draft. Auto-increments version and updates timestamps.
   * Throws DraftConcurrencyError if expectedVersion is provided and does not match.
   */
  async saveDraft(
    input: Partial<ContentDraft> & { title: string },
    options?: SaveDraftOptions,
  ): Promise<ContentDraft> {
    const id = input.id ?? `draft_${Date.now()}_${randomBytes(4).toString('hex')}`

    return this.withWriteLock(id, async () => {
      const now = new Date().toISOString()
      const existing = await this.getDraft(id)

      if (options?.expectedVersion !== undefined) {
        const currentVersion = existing ? existing.version : 0
        if (currentVersion !== options.expectedVersion) {
          throw new DraftConcurrencyError(
            `草稿并发冲突: 草稿 [${id}] 当前版本为 v${currentVersion}，期望版本为 v${options.expectedVersion}`,
            currentVersion,
            options.expectedVersion,
          )
        }
      }

      const draft: ContentDraft = {
        id,
        title: input.title,
        topic: input.topic ?? existing?.topic ?? input.title,
        targetAudience: input.targetAudience ?? existing?.targetAudience,
        channelVariants: input.channelVariants ?? existing?.channelVariants ?? [],
        status: input.status ?? existing?.status ?? 'draft',
        version: existing ? existing.version + 1 : 1,
        injoysDocId: input.injoysDocId ?? existing?.injoysDocId,
        prefillResults: {
          ...(existing?.prefillResults ?? {}),
          ...(input.prefillResults ?? {}),
        },
        publishedUrls: {
          ...(existing?.publishedUrls ?? {}),
          ...(input.publishedUrls ?? {}),
        },
        createdAt: existing ? existing.createdAt : now,
        updatedAt: now,
      }

      const filePath = this.getFilePath(id)
      const tmpPath = `${filePath}.tmp.${Date.now()}`

      writeFileSync(tmpPath, JSON.stringify(draft, null, 2), 'utf-8')
      renameSync(tmpPath, filePath)

      return draft
    })
  }

  /**
   * Retrieve a draft by ID.
   */
  async getDraft(id: string): Promise<ContentDraft | null> {
    const filePath = this.getFilePath(id)
    if (!existsSync(filePath)) return null

    try {
      const content = readFileSync(filePath, 'utf-8')
      return JSON.parse(content) as ContentDraft
    } catch (err) {
      console.error(`[DraftStore] Failed to parse draft file ${filePath}:`, err)
      return null
    }
  }

  /**
   * List all drafts, sorted by updatedAt descending.
   */
  async listDrafts(): Promise<ContentDraft[]> {
    if (!existsSync(this.draftsDir)) return []

    const files = readdirSync(this.draftsDir).filter(f => f.endsWith('.json'))
    const drafts: ContentDraft[] = []

    for (const file of files) {
      try {
        const fullPath = join(this.draftsDir, file)
        const content = readFileSync(fullPath, 'utf-8')
        drafts.push(JSON.parse(content) as ContentDraft)
      } catch (err) {
        console.warn(`[DraftStore] Failed to read draft file ${file}:`, err)
      }
    }

    return drafts.sort((a, b) => (b.updatedAt > a.updatedAt ? 1 : -1))
  }

  /**
   * Delete a draft by ID.
   */
  async deleteDraft(id: string): Promise<boolean> {
    const filePath = this.getFilePath(id)
    if (!existsSync(filePath)) return false

    try {
      unlinkSync(filePath)
      return true
    } catch (err) {
      console.error(`[DraftStore] Failed to delete draft file ${filePath}:`, err)
      return false
    }
  }

  /**
   * Record prefill result for a platform atomically without overwriting concurrent edits.
   */
  async updatePrefillResult(
    draftId: string,
    platform: PlatformId,
    result: { draftId?: string; draftUrl?: string },
  ): Promise<ContentDraft | null> {
    return this.withWriteLock(draftId, async () => {
      const freshDraft = await this.getDraft(draftId)
      if (!freshDraft) return null

      const prefillResults = { ...(freshDraft.prefillResults ?? {}) }
      prefillResults[platform] = {
        draftId: result.draftId,
        draftUrl: result.draftUrl,
        prefilledAt: new Date().toISOString(),
      }

      const updatedDraft: ContentDraft = {
        ...freshDraft,
        status: 'prefilled',
        prefillResults,
        version: freshDraft.version + 1,
        updatedAt: new Date().toISOString(),
      }

      const filePath = this.getFilePath(draftId)
      const tmpPath = `${filePath}.tmp.${Date.now()}`
      writeFileSync(tmpPath, JSON.stringify(updatedDraft, null, 2), 'utf-8')
      renameSync(tmpPath, filePath)

      return updatedDraft
    })
  }

  /**
   * Mark draft as published and record platform callback URL atomically.
   */
  async markPublished(
    draftId: string,
    platform: PlatformId,
    publishedUrl: string,
  ): Promise<ContentDraft | null> {
    return this.withWriteLock(draftId, async () => {
      const freshDraft = await this.getDraft(draftId)
      if (!freshDraft) return null

      const publishedUrls = { ...(freshDraft.publishedUrls ?? {}) }
      publishedUrls[platform] = publishedUrl

      const updatedDraft: ContentDraft = {
        ...freshDraft,
        status: 'published',
        publishedUrls,
        version: freshDraft.version + 1,
        updatedAt: new Date().toISOString(),
      }

      const filePath = this.getFilePath(draftId)
      const tmpPath = `${filePath}.tmp.${Date.now()}`
      writeFileSync(tmpPath, JSON.stringify(updatedDraft, null, 2), 'utf-8')
      renameSync(tmpPath, filePath)

      return updatedDraft
    })
  }
}
