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
import { resolveDshHome, defaultDraftsDir } from '../config-store.js'

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

/**
 * Raised when a caller tries to write `status: 'published'` through a path other than
 * the publish-URL backfill. See architecture §3.2.3 / §5.2.
 */
export class DraftPublishGuardError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'DraftPublishGuardError'
  }
}

/**
 * Raised when the target platform is not a channel of the draft being backfilled.
 * See architecture §3.2.5.
 */
export class DraftUnknownChannelError extends Error {
  constructor(
    message: string,
    public readonly platform: string,
  ) {
    super(message)
    this.name = 'DraftUnknownChannelError'
  }
}

/**
 * Raised when the backfilled URL is not a structurally valid http(s) URL.
 */
export class DraftInvalidPublishUrlError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'DraftInvalidPublishUrlError'
  }
}

export interface SaveDraftOptions {
  /** If specified, verifies that the existing draft matches this version before updating. */
  expectedVersion?: number
  /**
   * Pin the storage directory for this operation.
   *
   * Callers that span an `await` before writing (e.g. a prefill RPC that reads a draft,
   * calls a platform adapter, then writes the result back) MUST capture the directory
   * once at the start and pass it here. Otherwise a `draftsDir` change during the await
   * makes the read and the write target different libraries, and the write can land in
   * an unrelated same-ID draft (architecture §3.10.4).
   */
  dir?: string
}

/**
 * A URL that may legitimately serve as publish evidence.
 *
 * The previous `\S+` regex accepted structurally invalid values like `https://%`,
 * which then advanced a draft to `published` — i.e. an unusable link was treated as
 * proof of a real release. Parse with the URL parser instead and require a real
 * http(s) scheme plus a non-empty host. Parsing validity is necessary, not sufficient:
 * it does not prove the platform actually published anything (no network check here).
 */
export function isValidPublishUrl(value: string): boolean {
  if (typeof value !== 'string' || value.trim().length === 0) return false
  try {
    const parsed = new URL(value)
    return (parsed.protocol === 'http:' || parsed.protocol === 'https:') && parsed.hostname.length > 0
  } catch {
    return false
  }
}

/**
 * Effective publish progress of a draft.
 *
 * A channel counts as published only when it maps to a *valid* URL, so an empty or
 * malformed entry can never make a draft look complete.
 */
export function getPublishProgress(draft: Pick<ContentDraft, 'channelVariants' | 'publishedUrls'>): {
  publishedChannels: number
  totalChannels: number
  allPublished: boolean
} {
  const totalChannels = draft.channelVariants.length
  const publishedChannels = draft.channelVariants.filter(variant =>
    isValidPublishUrl(draft.publishedUrls?.[variant.platform] ?? ''),
  ).length
  return { publishedChannels, totalChannels, allPublished: totalChannels > 0 && publishedChannels === totalChannels }
}

/**
 * Ensure a draft directory **exists**, surfacing failures.
 *
 * `recursive: true` also covers a directory that disappears between config save and the
 * next write. This does NOT verify writability: an existing but read-only directory makes
 * `mkdirSync` succeed. Use {@link verifyDirectoryWritable} when the caller must know the
 * directory is actually usable *before* committing to it.
 */
export function ensureDirectory(dir: string): void {
  try {
    mkdirSync(dir, { recursive: true })
  } catch (err) {
    throw new DraftStorageError(
      `草稿目录不可用或无法创建（${dir}）：${(err as Error)?.message ?? '未知错误'}`,
      dir,
      { cause: err },
    )
  }
}

/**
 * Verify the directory exists **and is writable**, by creating and removing a
 * uniquely-named probe file.
 *
 * Existence alone is not usable: a read-only directory (e.g. mode 0500) passes
 * `mkdirSync` yet fails on the first real write, which is exactly how a "successful"
 * `config.save` turns into a later failure. Probing is the only portable check —
 * `fs.access(W_OK)` is unreliable under root/ACLs and does not prove a create works.
 *
 * A probe failure leaves no residue (the temp name is removed on both paths).
 * Note the permission may still change afterwards, so write-time errors are kept.
 */
export function verifyDirectoryWritable(dir: string): void {
  ensureDirectory(dir)
  const probePath = join(dir, `.draftstore-probe-${randomBytes(6).toString('hex')}`)
  try {
    writeFileSync(probePath, '', 'utf-8')
  } catch (err) {
    throw new DraftStorageError(
      `草稿目录不可写（${dir}）：${(err as Error)?.message ?? '未知错误'}`,
      dir,
      { cause: err },
    )
  } finally {
    try {
      if (existsSync(probePath)) unlinkSync(probePath)
    } catch {
      // Best-effort cleanup; a leftover empty probe must not fail the operation.
    }
  }
}

/**
 * Raised when the draft directory cannot be prepared or written to.
 * Storage failures must surface, never be silently swallowed into a "success".
 */
export class DraftStorageError extends Error {
  constructor(
    message: string,
    public readonly dir: string,
    options?: { cause?: unknown },
  ) {
    super(message, options)
    this.name = 'DraftStorageError'
  }
}

export class DraftStore {
  /**
   * Resolved per operation, not per file access.
   *
   * A `draftsDir` change must take effect for **new** operations (architecture §3.10.4),
   * but a single operation has to read, validate and write against ONE fixed directory —
   * otherwise a config switch mid-flight makes `getDraft` read library A while the write
   * lands in library B, overwriting an unrelated same-ID draft. Each public method
   * therefore resolves the directory exactly once and threads it through.
   */
  private readonly dirProvider: () => string
  /** Locks keyed by absolute file path, so the same ID in different libraries is independent. */
  private readonly writeLocks = new Map<string, Promise<void>>()

  constructor(ctx?: Context, customDir?: string | (() => string)) {
    if (typeof customDir === 'function') {
      this.dirProvider = customDir
    } else if (typeof customDir === 'string' && customDir.length > 0) {
      this.dirProvider = () => customDir
    } else {
      this.dirProvider = () => defaultDraftsDir(ctx)
    }

    // Best-effort at construction; the authoritative check happens per write, where a
    // failure must be reported rather than swallowed.
    try {
      ensureDirectory(this.getDirectory())
    } catch (err) {
      console.warn(`[DraftStore] Failed to ensure drafts directory ${this.getDirectory()}:`, err)
    }
  }

  getDirectory(): string {
    return this.dirProvider()
  }

  private filePathIn(dir: string, id: string): string {
    // Sanitize id to prevent path traversal
    const safeId = id.replace(/[^a-zA-Z0-9_-]/g, '_')
    return join(dir, `${safeId}.json`)
  }

  private async withFileLock<T>(filePath: string, fn: () => Promise<T>): Promise<T> {
    const prevLock = this.writeLocks.get(filePath) ?? Promise.resolve()
    let releaseLock!: () => void
    const nextLock = new Promise<void>((resolve) => {
      releaseLock = resolve
    })
    this.writeLocks.set(filePath, nextLock)

    try {
      await prevLock
      return await fn()
    } finally {
      releaseLock()
      if (this.writeLocks.get(filePath) === nextLock) {
        this.writeLocks.delete(filePath)
      }
    }
  }

  /** Atomic write: temp file + rename, inside an already-prepared directory. */
  private writeDraftFile(filePath: string, dir: string, draft: ContentDraft): void {
    const tmpPath = `${filePath}.tmp.${Date.now()}`
    try {
      writeFileSync(tmpPath, JSON.stringify(draft, null, 2), 'utf-8')
      renameSync(tmpPath, filePath)
    } catch (err) {
      throw new DraftStorageError(
        `草稿目录不可写或写入失败（${dir}）：${(err as Error)?.message ?? '未知错误'}`,
        dir,
        { cause: err },
      )
    }
  }

  /**
   * Save or update a draft. Auto-increments version and updates timestamps.
   * Throws DraftConcurrencyError if expectedVersion is provided and does not match.
   *
   * ⛔ Publish governance: this generic entry point may not touch release evidence.
   *   - `status: 'published'` is rejected outright (only {@link markPublished} may set it).
   *   - `publishedUrls` is a **server-governed** field: caller input is ignored so a
   *     client cannot fabricate release evidence (e.g. `{ wechat_mp: '' }`) and let the
   *     all-channels invariant appear satisfied.
   *   - The overall status is **recomputed** from the effective per-channel URLs whenever
   *     the channel set or stored URLs change, so a draft that was fully published and
   *     then gained a new, un-backfilled channel drops back to `prefilled` instead of
   *     continuing to claim it is live everywhere.
   */
  async saveDraft(
    input: Partial<ContentDraft> & { title: string },
    options?: SaveDraftOptions,
  ): Promise<ContentDraft> {
    if (input.status === 'published') {
      throw new DraftPublishGuardError(
        'published 状态不可经 drafts.save 写入；请在平台真实发布后调用 drafts.updatePublishUrl 回填链接。',
      )
    }

    const id = input.id ?? `draft_${Date.now()}_${randomBytes(4).toString('hex')}`
    // Fix the target directory for this whole operation: an explicit pin wins, otherwise
    // resolve once here (never again mid-operation).
    const dir = options?.dir ?? this.getDirectory()
    const filePath = this.filePathIn(dir, id)

    return this.withFileLock(filePath, async () => {
      try {
        ensureDirectory(dir)
      } catch (err) {
        // Directory failures must reach the caller as a real error, not a silent miss.
        throw err instanceof DraftStorageError
          ? err
          : new DraftStorageError(`草稿目录不可用（${dir}）`, dir, { cause: err })
      }

      const now = new Date().toISOString()
      const existing = await this.getDraft(id, dir)

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

      const channelVariants = input.channelVariants ?? existing?.channelVariants ?? []

      // Release evidence is never taken from caller input. Prune stored URLs that no
      // longer correspond to a current channel so removed channels can't keep a draft
      // "complete", and so no stale/orphan keys linger in the record.
      const knownPlatforms = new Set(channelVariants.map(variant => variant.platform))
      const publishedUrls: Partial<Record<PlatformId, string>> = {}
      for (const [platform, url] of Object.entries(existing?.publishedUrls ?? {})) {
        if (knownPlatforms.has(platform as PlatformId) && isValidPublishUrl(url)) {
          publishedUrls[platform as PlatformId] = url
        }
      }

      // Recompute the overall status from the invariant rather than trusting stored state.
      // Order matters: a *fully* published draft stays published; a *partially* published
      // draft is pinned to `prefilled` and may NOT be edited back down to `draft`, since
      // release evidence still exists and the approval we made to the user would otherwise
      // silently disagree with the stored URLs; only a draft with no evidence at all may
      // take an ordinary draft-stage status (architecture §3.2.5, criterion §4).
      const progress = getPublishProgress({ channelVariants, publishedUrls })
      const requestedStatus = input.status ?? existing?.status ?? 'draft'
      const status: ContentDraft['status'] = progress.allPublished
        ? 'published'
        : progress.publishedChannels > 0
          ? 'prefilled'
          : requestedStatus === 'published'
            ? 'prefilled'
            : requestedStatus

      const draft: ContentDraft = {
        id,
        title: input.title,
        topic: input.topic ?? existing?.topic ?? input.title,
        targetAudience: input.targetAudience ?? existing?.targetAudience,
        channelVariants,
        status,
        version: existing ? existing.version + 1 : 1,
        injoysDocId: input.injoysDocId ?? existing?.injoysDocId,
        prefillResults: {
          ...(existing?.prefillResults ?? {}),
          ...(input.prefillResults ?? {}),
        },
        publishedUrls,
        createdAt: existing ? existing.createdAt : now,
        updatedAt: now,
      }

      this.writeDraftFile(filePath, dir, draft)

      return draft
    })
  }

  /**
   * Retrieve a draft by ID.
   *
   * `dir` may be supplied by a caller that already fixed the directory for its operation
   * (see {@link saveDraft}); otherwise it is resolved once here.
   */
  async getDraft(id: string, dir?: string): Promise<ContentDraft | null> {
    const filePath = this.filePathIn(dir ?? this.getDirectory(), id)
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
    const dir = this.getDirectory()
    if (!existsSync(dir)) return []

    const files = readdirSync(dir).filter(f => f.endsWith('.json'))
    const drafts: ContentDraft[] = []

    for (const file of files) {
      try {
        const fullPath = join(dir, file)
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
    const filePath = this.filePathIn(this.getDirectory(), id)
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
   *
   * `dir` pins the storage directory: a prefill RPC spans an `await` on the platform
   * adapter, so the caller must pass the directory it read from (see SaveDraftOptions.dir).
   */
  async updatePrefillResult(
    draftId: string,
    platform: PlatformId,
    result: { draftId?: string; draftUrl?: string },
    dir?: string,
  ): Promise<ContentDraft | null> {
    const targetDir = dir ?? this.getDirectory()
    const filePath = this.filePathIn(targetDir, draftId)

    return this.withFileLock(filePath, async () => {
      const freshDraft = await this.getDraft(draftId, targetDir)
      if (!freshDraft) return null

      const prefillResults = { ...(freshDraft.prefillResults ?? {}) }
      prefillResults[platform] = {
        draftId: result.draftId,
        draftUrl: result.draftUrl,
        prefilledAt: new Date().toISOString(),
      }

      // Prefilling must not downgrade release state: keep the invariant authoritative.
      const progress = getPublishProgress({
        channelVariants: freshDraft.channelVariants,
        publishedUrls: freshDraft.publishedUrls ?? {},
      })
      const status: ContentDraft['status'] = progress.allPublished ? 'published' : 'prefilled'

      const updatedDraft: ContentDraft = {
        ...freshDraft,
        status,
        prefillResults,
        version: freshDraft.version + 1,
        updatedAt: new Date().toISOString(),
      }

      this.writeDraftFile(filePath, targetDir, updatedDraft)

      return updatedDraft
    })
  }

  /**
   * Mark a single channel as published by recording its real platform URL.
   *
   * Per architecture §3.2.5 the draft's *overall* `status` only becomes `published`
   * once EVERY channel variant has a backfilled URL; a partial backfill keeps the
   * draft at `prefilled` and the per-channel detail lives in `publishedUrls`.
   * This prevents "one channel live" from being reported as "everything published".
   */
  async markPublished(
    draftId: string,
    platform: PlatformId,
    publishedUrl: string,
    dir?: string,
  ): Promise<ContentDraft | null> {
    // Validate the URL before taking the lock: an invalid link must never count as
    // release evidence, and must not write or bump the version (architecture §3.2.5).
    if (!isValidPublishUrl(publishedUrl)) {
      throw new DraftInvalidPublishUrlError('回填的发布链接必须是合法的 http(s) URL。')
    }

    const targetDir = dir ?? this.getDirectory()
    const filePath = this.filePathIn(targetDir, draftId)

    return this.withFileLock(filePath, async () => {
      const freshDraft = await this.getDraft(draftId, targetDir)
      if (!freshDraft) return null

      // Membership is checked against the freshly-read draft inside the same write
      // lock, so an unrelated platform key cannot pollute release records.
      if (!freshDraft.channelVariants.some(variant => variant.platform === platform)) {
        throw new DraftUnknownChannelError(
          `草稿 [${draftId}] 不包含渠道 [${String(platform)}]，无法回填发布链接。`,
          String(platform),
        )
      }

      const publishedUrls = { ...(freshDraft.publishedUrls ?? {}) }
      publishedUrls[platform] = publishedUrl

      const progress = getPublishProgress({ channelVariants: freshDraft.channelVariants, publishedUrls })

      const updatedDraft: ContentDraft = {
        ...freshDraft,
        status: progress.allPublished ? 'published' : 'prefilled',
        publishedUrls,
        version: freshDraft.version + 1,
        updatedAt: new Date().toISOString(),
      }

      this.writeDraftFile(filePath, targetDir, updatedDraft)

      return updatedDraft
    })
  }
}
