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
 * "Are POSIX mode bits actually stored?" is a property of the *filesystem*, not of the
 * platform: `win32` obviously cannot answer it, but neither can a POSIX kernel mounted on
 * a filesystem without mode bits (vfat/exfat, some FUSE/network mounts, some container
 * volume drivers). It is therefore probed at runtime rather than assumed from
 * `process.platform`, and the whole file skips with an explicit notice when the probe
 * says mode bits do not persist — a green run there must not be read as coverage.
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

/**
 * Probe whether the temporary filesystem actually stores POSIX mode bits.
 *
 * Deliberately independent of the modules under test: it writes its own scratch file
 * with `chmod`, so a bug that drops `mode` in the production wrapper cannot make this
 * probe report "unsupported" and silently disable the assertions it is supposed to guard.
 *
 * `chmod` is used instead of `writeFile(mode:)` so an unfavourable umask cannot be
 * mistaken for a filesystem that ignores the bits: if the widened group/other bits do
 * not read back, the filesystem is not storing modes at all.
 */
const posixModeSupported = (() => {
  if (process.platform === 'win32') return false
  let probeDir: string | undefined
  try {
    probeDir = mkdtempSync(join(tmpdir(), 'gs-mode-probe-'))
    const probeFile = join(probeDir, 'probe')
    writeFileSync(probeFile, '')
    chmodSync(probeFile, 0o640)
    const widened = (statSync(probeFile).mode & 0o777) === 0o640
    return widened
  } catch {
    return false
  } finally {
    if (probeDir) {
      try {
        rmSync(probeDir, { recursive: true, force: true })
      } catch {
        // Best-effort cleanup; a leftover probe directory must not fail the run.
      }
    }
  }
})()

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
 * Keep the suite honest when it is skipped: this prints one explicit notice so a green
 * run on a platform/filesystem without POSIX mode bits is not mistaken for coverage.
 * The message names which of the two conditions caused the skip, so a bare "skipped"
 * cannot hide a filesystem that silently drops the bits.
 */
if (!posixModeSupported) {
  describe('Local storage permission bits (unsupported filesystem)', () => {
    it('skips POSIX permission assertions and reports the gap', () => {
      expect(posixModeSupported).toBe(false)
      const reason = process.platform === 'win32'
        ? `platform ${process.platform} does not expose POSIX mode bits`
        : `the temporary filesystem (${tmpdir()}) does not preserve POSIX mode bits`
      console.warn(`[storage-permissions] permission assertions NOT covered: ${reason}.`)
    })
  })
}
