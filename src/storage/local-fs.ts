/**
 * Shared local write primitives for Growth Studio.
 *
 * Collects the permission bits, directory creation, atomic write and per-path write
 * locking used by every local JSON store, so those decisions are defined once instead
 * of being restated at each call site.
 *
 * ⛔ Permissions (`.context/criterion.md` §3.5 MUST「系统文件权限仅限当前操作系统用户」):
 * created files are `0o600` and created directories are `0o700`. The effective mode is
 * `mode & ~umask`, so a stricter umask can only narrow the result — never widen it.
 *
 * ⚠️ This module MUST NOT import anything else from the project. `draft-store.ts`
 * already imports `config-store.ts`; if these primitives lived in `draft-store.ts` and
 * `config-store.ts` imported them back, the two would form a cycle. Keeping the module
 * free of project imports preserves that direction. Domain error types stay in
 * `draft-store.ts` — callers decide how to wrap failures.
 *
 * @module @deepseek-ai/dsh-ops-manager/storage/local-fs
 */

import { mkdirSync, renameSync, writeFileSync } from 'node:fs'
import { randomBytes } from 'node:crypto'

/** Mode for files created by local persistence (`0o600`). Source: criterion §3.5. */
export const FILE_MODE = 0o600

/** Mode for directories created by local persistence (`0o700`). Source: criterion §3.5. */
export const DIR_MODE = 0o700

/**
 * Create every missing directory on the path, with {@link DIR_MODE}.
 *
 * Failures are rethrown as the original fs error: the caller owns the domain error
 * type (e.g. `DraftStorageError`) and the user-facing message.
 */
export function mkdirWithMode(dir: string): void {
  mkdirSync(dir, { recursive: true, mode: DIR_MODE })
}

/**
 * Write `value` as pretty-printed JSON, atomically, with {@link FILE_MODE}.
 *
 * The payload goes to a uniquely-named sibling temp file first and is then renamed over
 * the target, so a reader never observes a half-written document. The unique suffix
 * matters because two stores may write the same path within the same millisecond.
 *
 * Like {@link mkdirWithMode}, failures are rethrown as the original fs error.
 */
export function writeJsonAtomic(filePath: string, value: unknown): void {
  const tmpPath = `${filePath}.tmp.${randomBytes(6).toString('hex')}`
  writeFileSync(tmpPath, JSON.stringify(value, null, 2), { encoding: 'utf-8', mode: FILE_MODE })
  renameSync(tmpPath, filePath)
}

export interface FileWriteLock {
  /** Run `fn` once every earlier write to the same absolute path has finished. */
  withFileLock<T>(filePath: string, fn: () => Promise<T>): Promise<T>
}

/**
 * Create an independent set of per-path write locks.
 *
 * Each call returns its own lock set: a store holds one set for its lifetime, matching
 * the previous per-instance `Map`. Locks are keyed by **absolute file path**, so the
 * same draft ID in two different libraries never blocks or overwrites the other.
 */
export function createFileWriteLocks(): FileWriteLock {
  const locks = new Map<string, Promise<void>>()

  return {
    async withFileLock<T>(filePath: string, fn: () => Promise<T>): Promise<T> {
      const prevLock = locks.get(filePath) ?? Promise.resolve()
      let releaseLock!: () => void
      const nextLock = new Promise<void>((resolve) => {
        releaseLock = resolve
      })
      locks.set(filePath, nextLock)

      try {
        await prevLock
        return await fn()
      } finally {
        releaseLock()
        if (locks.get(filePath) === nextLock) {
          locks.delete(filePath)
        }
      }
    },
  }
}
