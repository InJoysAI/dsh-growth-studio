/**
 * Local metrics-history snapshots for period-over-period comparison.
 *
 * Persists `PlatformMetrics[]` to `$DSH_HOME/growth-studio/metrics/{YYYY-MM-DD}.json`.
 * The directory is resolved from `resolveDshHome` and is independent of `draftsDir`.
 *
 * @module @deepseek-ai/dsh-ops-manager/storage/metrics-store
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import type { MetricsSnapshotFile, PlatformMetrics } from '../types.js'
import type { PlatformMetricsOutcome } from '../analytics/metrics-collector.js'
import { resolveDshHome } from '../config-store.js'
import { createFileWriteLocks, writeJsonAtomic } from './local-fs.js'
import { DraftStorageError, verifyDirectoryWritable } from './draft-store.js'

/** UTC calendar date of a capture instant (`YYYY-MM-DD` from an ISO 8601 timestamp). */
export function snapshotDateFromCapturedAt(capturedAt: string): string {
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(capturedAt)
  if (!match) {
    throw new Error(`capturedAt 不是可解析的 ISO 8601 日期: ${capturedAt}`)
  }
  return match[1]
}

export function defaultMetricsDir(ctx?: Context): string {
  return join(resolveDshHome(ctx), 'growth-studio', 'metrics')
}

/**
 * Persistable rows keep the `PlatformMetrics` shape; source/windowScope stay off disk.
 * Only live, window-verified rows may become comparison baselines (criterion §3.2).
 */
export function isPersistableOutcome(outcome: PlatformMetricsOutcome): boolean {
  return outcome.source === 'live' && outcome.windowScope === 'verified'
}

export function toSnapshotRow(outcome: PlatformMetricsOutcome): PlatformMetrics {
  const row: PlatformMetrics = {
    platform: outcome.platform,
    capturedAt: outcome.capturedAt,
    windowStart: outcome.windowStart,
    windowEnd: outcome.windowEnd,
    impressions: outcome.impressions,
    plays: outcome.plays,
    views: outcome.views,
    likes: outcome.likes,
    comments: outcome.comments,
    shares: outcome.shares,
  }
  if (outcome.favorites !== undefined) row.favorites = outcome.favorites
  if (outcome.followerDelta !== undefined) row.followerDelta = outcome.followerDelta
  if (outcome.topPostTitle !== undefined) row.topPostTitle = outcome.topPostTitle
  return row
}

function readSnapshotFile(filePath: string, dir: string): MetricsSnapshotFile {
  if (!existsSync(filePath)) return []
  try {
    const parsed: unknown = JSON.parse(readFileSync(filePath, 'utf-8'))
    if (!Array.isArray(parsed)) {
      throw new DraftStorageError(`指标历史文件不是数组（${filePath}）`, dir)
    }
    return parsed as MetricsSnapshotFile
  } catch (err) {
    if (err instanceof DraftStorageError) throw err
    throw new DraftStorageError(
      `指标历史文件不可读（${filePath}）：${(err as Error)?.message ?? '未知错误'}`,
      dir,
      { cause: err },
    )
  }
}

export class MetricsStore {
  private readonly dirProvider: () => string
  private readonly writeLocks = createFileWriteLocks()

  constructor(ctx?: Context, customDir?: string | (() => string)) {
    if (typeof customDir === 'function') {
      this.dirProvider = customDir
    } else if (typeof customDir === 'string' && customDir.length > 0) {
      this.dirProvider = () => customDir
    } else {
      this.dirProvider = () => defaultMetricsDir(ctx)
    }
  }

  getDirectory(): string {
    return this.dirProvider()
  }

  /**
   * Append window-verified outcomes to the day's snapshot file.
   *
   * `dir` pins the metrics root for this whole operation. Callers that span an
   * `await` MUST capture the directory once at the start and pass it here.
   */
  async appendVerified(
    outcomes: PlatformMetricsOutcome[],
    options?: { dir?: string },
  ): Promise<void> {
    const dir = options?.dir ?? this.getDirectory()
    const rows = outcomes.filter(isPersistableOutcome).map(toSnapshotRow)
    if (rows.length === 0) return

    const byDate = new Map<string, PlatformMetrics[]>()
    for (const row of rows) {
      const date = snapshotDateFromCapturedAt(row.capturedAt)
      const list = byDate.get(date) ?? []
      list.push(row)
      byDate.set(date, list)
    }

    try {
      verifyDirectoryWritable(dir)
    } catch (err) {
      throw err instanceof DraftStorageError
        ? err
        : new DraftStorageError(`指标历史目录不可用（${dir}）`, dir, { cause: err })
    }

    for (const [date, additions] of byDate) {
      const filePath = join(dir, `${date}.json`)
      await this.writeLocks.withFileLock(filePath, async () => {
        const existing = readSnapshotFile(filePath, dir)
        try {
          writeJsonAtomic(filePath, existing.concat(additions))
        } catch (err) {
          throw new DraftStorageError(
            `指标历史目录不可写或写入失败（${dir}）：${(err as Error)?.message ?? '未知错误'}`,
            dir,
            { cause: err },
          )
        }
      })
    }
  }

  /** Read every daily snapshot under the (pinned) metrics root. */
  async readAll(options?: { dir?: string }): Promise<PlatformMetrics[]> {
    const dir = options?.dir ?? this.getDirectory()
    if (!existsSync(dir)) return []

    let files: string[]
    try {
      files = readdirSync(dir).filter(name => name.endsWith('.json'))
    } catch (err) {
      throw new DraftStorageError(
        `指标历史目录不可读（${dir}）：${(err as Error)?.message ?? '未知错误'}`,
        dir,
        { cause: err },
      )
    }

    const rows: PlatformMetrics[] = []
    for (const name of files) {
      rows.push(...readSnapshotFile(join(dir, name), dir))
    }
    return rows
  }
}
