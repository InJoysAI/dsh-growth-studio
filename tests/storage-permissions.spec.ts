/**
 * Permission-bit assertions for local persistence (criterion §3.5「系统文件权限仅限
 * 当前操作系统用户」, TD-013).
 *
 * ⚠️ Two different kinds of assertion live here and they must NOT share a skip rule:
 *
 * 1. "Was the creation mode applied?" — a plain `stat` read. This works the same for a
 *    root process as for a normal user on a POSIX-mode filesystem, so it is never
 *    skipped for being root; otherwise a root CI would let a missing `mode` pass.
 * 2. "Is a write to a read-only directory rejected?" — that one IS bypassed by root
 *    (DAC checks are skipped), so those cases use the existing probe used elsewhere in
 *    the suite. This file has no such case.
 *
 * `win32` (and filesystems without POSIX mode bits) cannot answer (1) at all, so the
 * whole file skips there and says so instead of pretending to cover it.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, statSync, chmodSync, writeFileSync, readdirSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DraftStore } from '../src/storage/draft-store.js'
import { ConfigStore } from '../src/config-store.js'
import {
  FILE_MODE,
  DIR_MODE,
  mkdirWithMode,
  writeJsonAtomic,
  createFileWriteLocks,
} from '../src/storage/local-fs.js'

/** True when POSIX permission bits are meaningful on this platform. */
const posixModeSupported = process.platform !== 'win32'

/**
 * Exact-value assertions are only meaningful under a "standard" umask that does not
 * strip owner bits. Under a stricter umask the result may be narrower than `0o600` /
 * `0o700`, which still satisfies the requirement, so only the group/other check runs.
 */
const standardUmask = (() => {
  const umask = process.umask()
  // Owner read+write (files) / read+write+execute (dirs) must survive the mask.
  return (umask & 0o700) === 0
})()

/** Group/other must have no permission bits at all. */
const expectNoGroupOrOther = (mode: number) => {
  expect((mode & 0o077) === 0).toBe(true)
}

describe.skipIf(!posixModeSupported)('Local storage permission bits', () => {
  let base: string

  beforeEach(() => {
    base = mkdtempSync(join(tmpdir(), 'gs-perm-'))
  })

  afterEach(() => {
    rmSync(base, { recursive: true, force: true })
  })

  describe('primitives', () => {
    it('constants match the documented modes', () => {
      expect(FILE_MODE).toBe(0o600)
      expect(DIR_MODE).toBe(0o700)
    })

    it('mkdirWithMode creates missing directories as 0o700', () => {
      // The target must not exist yet: asserting on a directory the test created
      // itself (mkdtemp is already 0700) would pass without exercising anything.
      const dir = join(base, 'created-by-primitive')
      expect(() => statSync(dir)).toThrow()

      mkdirWithMode(dir)

      const mode = statSync(dir).mode
      expectNoGroupOrOther(mode)
      if (standardUmask) expect(mode & 0o777).toBe(DIR_MODE)
    })

    it('writeJsonAtomic writes 0o600 and leaves no temp file behind', () => {
      const dir = join(base, 'atomic')
      mkdirWithMode(dir)
      const file = join(dir, 'payload.json')

      writeJsonAtomic(file, { a: 1 })

      const mode = statSync(file).mode
      expectNoGroupOrOther(mode)
      if (standardUmask) expect(mode & 0o777).toBe(FILE_MODE)

      // Success path must not leave `.tmp.*` siblings.
      expect(readdirSync(dir)).toEqual(['payload.json'])
    })

    it('writeJsonAtomic replaces an existing 0o644 file with a 0o600 inode', () => {
      const dir = join(base, 'replace')
      mkdirWithMode(dir)
      const file = join(dir, 'payload.json')

      // Simulate a file written before this change (or by another umask).
      writeFileSync(file, '{"old":true}', 'utf-8')
      chmodSync(file, 0o644)
      expect(statSync(file).mode & 0o077).not.toBe(0)

      writeJsonAtomic(file, { replaced: true })

      expectNoGroupOrOther(statSync(file).mode)
      if (standardUmask) expect(statSync(file).mode & 0o777).toBe(FILE_MODE)
    })

    it('lock sets are independent per factory call and serialize by path', async () => {
      const first = createFileWriteLocks()
      const second = createFileWriteLocks()
      const order: string[] = []

      const slow = first.withFileLock('/tmp/x.json', async () => {
        order.push('slow:start')
        await new Promise((resolve) => setTimeout(resolve, 10))
        order.push('slow:end')
      })
      const fast = first.withFileLock('/tmp/x.json', async () => {
        order.push('fast')
      })

      await Promise.all([slow, fast])

      // Same path in the same set: strictly serialized.
      expect(order).toEqual(['slow:start', 'slow:end', 'fast'])

      // A different set does not wait on the first set's lock.
      let secondSetRan = false
      await second.withFileLock('/tmp/x.json', async () => {
        secondSetRan = true
      })
      expect(secondSetRan).toBe(true)
    })
  })

  describe('DraftStore', () => {
    it('creates the drafts directory as 0o700 and the draft file as 0o600', async () => {
      // Neither the drafts directory nor its parent exists yet, so their modes come
      // from the store, not from mkdtemp.
      const draftsDir = join(base, 'home', 'growth-studio', 'drafts')
      expect(() => statSync(draftsDir)).toThrow()

      const store = new DraftStore(undefined, draftsDir)
      const draft = await store.saveDraft({ title: '权限位用例' })

      const dirMode = statSync(draftsDir).mode
      expectNoGroupOrOther(dirMode)
      if (standardUmask) expect(dirMode & 0o777).toBe(DIR_MODE)

      const fileMode = statSync(join(draftsDir, `${draft.id}.json`)).mode
      expectNoGroupOrOther(fileMode)
      if (standardUmask) expect(fileMode & 0o777).toBe(FILE_MODE)
    })

    it('tightens an existing 0o644 draft on the next save', async () => {
      const draftsDir = join(base, 'tighten', 'drafts')
      mkdirWithMode(draftsDir)

      const store = new DraftStore(undefined, draftsDir)
      const draft = await store.saveDraft({ title: '既有文件' })
      const file = join(draftsDir, `${draft.id}.json`)

      // Make it look like a pre-existing, loosely-permissioned file.
      chmodSync(file, 0o644)
      expect(statSync(file).mode & 0o077).not.toBe(0)

      await store.saveDraft({ id: draft.id, title: '既有文件（再存）' })

      expectNoGroupOrOther(statSync(file).mode)
      if (standardUmask) expect(statSync(file).mode & 0o777).toBe(FILE_MODE)
    })

    it('does not leave probe files or temp files after a successful write', async () => {
      const draftsDir = join(base, 'probe', 'drafts')
      const { verifyDirectoryWritable } = await import('../src/storage/draft-store.js')

      verifyDirectoryWritable(draftsDir)
      const store = new DraftStore(undefined, draftsDir)
      await store.saveDraft({ title: '无残留' })

      const entries = readdirSync(draftsDir)
      expect(entries.filter((name) => name.startsWith('.draftstore-probe-'))).toEqual([])
      expect(entries.filter((name) => name.includes('.tmp.'))).toEqual([])
      expect(entries).toHaveLength(1)
    })

    it('keeps drafts with the same id in different libraries on separate locks', async () => {
      // RISK-004 regression: the lock is keyed by absolute path, so two libraries may
      // hold the same id without blocking or overwriting each other.
      const dirA = join(base, 'libA')
      const dirB = join(base, 'libB')
      const storeA = new DraftStore(undefined, dirA)
      const storeB = new DraftStore(undefined, dirB)

      const [a, b] = await Promise.all([
        storeA.saveDraft({ id: 'shared-id', title: 'A 库' }),
        storeB.saveDraft({ id: 'shared-id', title: 'B 库' }),
      ])

      expect(a.title).toBe('A 库')
      expect(b.title).toBe('B 库')
      expect((await storeA.getDraft('shared-id'))?.title).toBe('A 库')
      expect((await storeB.getDraft('shared-id'))?.title).toBe('B 库')
    })
  })

  describe('ConfigStore', () => {
    it('creates ops-manager/ as 0o700 and config.json as 0o600 on first save', async () => {
      const home = join(base, 'cfg-home')
      const configDir = join(home, 'ops-manager')
      // The directory must not exist beforehand, otherwise the assertion is vacuous.
      expect(() => statSync(configDir)).toThrow()

      // Pin the home via profileContext so the write lands under the temp directory
      // and never in the developer's real `$DSH_HOME` (RISK-010).
      const store = new ConfigStore(
        { get: (name: string) => (name === 'profileContext' ? { home } : undefined) } as any,
        { draftsDir: join(home, 'growth-studio', 'drafts'), injoys: { token: 'secret-token' } },
      )
      expect(store.getConfigDir()).toBe(join(home, 'ops-manager'))
      await store.save({})

      const dirMode = statSync(configDir).mode
      expectNoGroupOrOther(dirMode)
      if (standardUmask) expect(dirMode & 0o777).toBe(DIR_MODE)

      const configPath = join(configDir, 'config.json')
      const fileMode = statSync(configPath).mode
      expectNoGroupOrOther(fileMode)
      if (standardUmask) expect(fileMode & 0o777).toBe(FILE_MODE)

      // The assertion above only proves something if the token really lives in it.
      expect(readFileSync(configPath, 'utf-8')).toContain('secret-token')
    })
  })
})

/**
 * Keep the suite honest on platforms we skip: this prints a single explicit notice so a
 * green run on win32 is not mistaken for cross-platform permission coverage.
 */
if (!posixModeSupported) {
  describe('Local storage permission bits (unsupported platform)', () => {
    it('skips POSIX permission assertions and reports the gap', () => {
      expect(posixModeSupported).toBe(false)
      console.warn(`[storage-permissions] POSIX mode bits unavailable on ${process.platform}; permission assertions not covered here.`)
    })
  })
}
