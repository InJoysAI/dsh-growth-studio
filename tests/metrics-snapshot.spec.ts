import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { InjoysClient } from '../src/injoys/client.js'
import { AdapterRegistry } from '../src/adapters/registry.js'
import { MetricsCollector, resolveMetricsWindow, type PlatformMetricsOutcome } from '../src/analytics/metrics-collector.js'
import {
  compareMetrics,
  deltaPercent,
  EMPTY_COMPARISON,
  previousEqualLengthWindow,
  selectBaselineRecord,
} from '../src/analytics/metrics-comparison.js'
import { registerOpsRpc, OPS_API_PATH, OPS_ENDPOINT } from '../src/ops-rpc.js'
import { DraftStorageError } from '../src/storage/draft-store.js'
import { DIR_MODE, FILE_MODE } from '../src/storage/local-fs.js'
import {
  MetricsStore,
  defaultMetricsDir,
  isPersistableOutcome,
  snapshotDateFromCapturedAt,
} from '../src/storage/metrics-store.js'
import type { PlatformId, PlatformMetrics } from '../src/types.js'

const NOW = '2026-10-20T00:00:00.000Z'
const WINDOW_7D = {
  windowStart: '2026-10-13T00:00:00.000Z',
  windowEnd: '2026-10-20T00:00:00.000Z',
}
const PREV_7D = {
  windowStart: '2026-10-06T00:00:00.000Z',
  windowEnd: '2026-10-13T00:00:00.000Z',
}

function outcome(
  platform: PlatformId,
  metrics: Partial<PlatformMetricsOutcome> = {},
): PlatformMetricsOutcome {
  return {
    platform,
    capturedAt: NOW,
    windowStart: WINDOW_7D.windowStart,
    windowEnd: WINDOW_7D.windowEnd,
    impressions: null,
    plays: null,
    views: 0,
    likes: null,
    comments: null,
    shares: null,
    favorites: null,
    followerDelta: null,
    source: 'live',
    windowScope: 'verified',
    ...metrics,
  }
}

describe('previousEqualLengthWindow', () => {
  it('shifts a 7d closed interval back by the same duration', () => {
    expect(previousEqualLengthWindow(WINDOW_7D.windowStart, WINDOW_7D.windowEnd)).toEqual(PREV_7D)
  })
})

describe('MetricsStore persistability gate', () => {
  it('accepts only live window-verified outcomes', () => {
    expect(isPersistableOutcome(outcome('wechat_mp'))).toBe(true)
    expect(isPersistableOutcome(outcome('wechat_mp', { source: 'mock', windowScope: 'verified' }))).toBe(false)
    expect(isPersistableOutcome(outcome('wechat_mp', { source: 'unmeasured', windowScope: 'unverified' }))).toBe(false)
    expect(isPersistableOutcome(outcome('bilibili', { source: 'live', windowScope: 'unverified' }))).toBe(false)
  })
})

describe('MetricsStore append / read', () => {
  let dir: string
  let store: MetricsStore

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'gs-metrics-'))
    store = new MetricsStore(undefined, dir)
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('appends verified rows by (platform, capturedAt) and keeps earlier rows', async () => {
    await store.appendVerified([
      outcome('wechat_mp', { impressions: 10, likes: 1, comments: 1, shares: 1, favorites: 1 }),
    ])
    await store.appendVerified([
      outcome('bilibili', { capturedAt: '2026-10-20T01:00:00.000Z', plays: 20 }),
    ])

    const file = join(dir, '2026-10-20.json')
    const rows = JSON.parse(readFileSync(file, 'utf-8')) as PlatformMetrics[]
    expect(rows).toHaveLength(2)
    expect(rows[0].platform).toBe('wechat_mp')
    expect(rows[0].impressions).toBe(10)
    expect(rows[1].platform).toBe('bilibili')
    expect(rows[1].capturedAt).toBe('2026-10-20T01:00:00.000Z')
    expect(rows[0]).not.toHaveProperty('source')
    expect(rows[0]).not.toHaveProperty('windowScope')
  })

  it('does not persist unverified, unmeasured, or mock outcomes', async () => {
    await store.appendVerified([
      outcome('wechat_mp', { source: 'live', windowScope: 'unverified', impressions: 9999 }),
      outcome('bilibili', { source: 'unmeasured', windowScope: 'unverified' }),
      outcome('wechat_mp', { source: 'mock', windowScope: 'verified', impressions: 8888 }),
    ])
    expect(existsSync(join(dir, '2026-10-20.json'))).toBe(false)
    expect(await store.readAll()).toEqual([])
  })

  it('pins the metrics root for the whole operation; draftsDir is irrelevant', async () => {
    const homeA = mkdtempSync(join(tmpdir(), 'gs-home-a-'))
    const homeB = mkdtempSync(join(tmpdir(), 'gs-home-b-'))
    let home = homeA
    const switching = new MetricsStore(undefined, () => join(home, 'growth-studio', 'metrics'))
    const pinned = switching.getDirectory()
    home = homeB
    await switching.appendVerified([outcome('wechat_mp', { impressions: 1 })], { dir: pinned })

    expect(existsSync(join(homeA, 'growth-studio', 'metrics', '2026-10-20.json'))).toBe(true)
    expect(existsSync(join(homeB, 'growth-studio', 'metrics', '2026-10-20.json'))).toBe(false)

    const isolated = process.env.DSH_HOME
    expect(isolated).toBeTruthy()
    expect(defaultMetricsDir(undefined)).toBe(join(isolated!, 'growth-studio', 'metrics'))
    expect(defaultMetricsDir(undefined)).not.toContain('drafts')

    rmSync(homeA, { recursive: true, force: true })
    rmSync(homeB, { recursive: true, force: true })
  })

  it('throws DraftStorageError when the metrics directory is not writable', async () => {
    if (process.platform === 'win32' || process.getuid?.() === 0) return
    chmodSync(dir, 0o500)
    try {
      await expect(
        store.appendVerified([outcome('wechat_mp', { impressions: 1 })]),
      ).rejects.toBeInstanceOf(DraftStorageError)
    } finally {
      chmodSync(dir, 0o700)
    }
  })
})

describe('compareMetrics', () => {
  const expected: PlatformId[] = ['wechat_mp', 'bilibili']

  function row(platform: PlatformId, extra: Partial<PlatformMetrics> = {}): PlatformMetrics {
    return {
      platform,
      capturedAt: '2026-10-13T00:00:00.000Z',
      windowStart: PREV_7D.windowStart,
      windowEnd: PREV_7D.windowEnd,
      impressions: 100,
      plays: 200,
      views: 200,
      likes: 10,
      comments: 2,
      shares: 3,
      favorites: 4,
      followerDelta: 5,
      ...extra,
    }
  }

  it('returns empty comparison when there is no history', () => {
    expect(
      compareMetrics({
        current: { impressions: 200, plays: 400, engagements: 38, followers: 10 },
        history: [],
        expectedPlatforms: expected,
        period: '7d',
        currentWindowStart: WINDOW_7D.windowStart,
        currentWindowEnd: WINDOW_7D.windowEnd,
      }),
    ).toEqual(EMPTY_COMPARISON)
  })

  it('returns empty comparison when any expected platform lacks a previous-window row', () => {
    expect(
      compareMetrics({
        current: { impressions: 200, plays: 400, engagements: 38, followers: 10 },
        history: [row('wechat_mp')],
        expectedPlatforms: expected,
        period: '7d',
        currentWindowStart: WINDOW_7D.windowStart,
        currentWindowEnd: WINDOW_7D.windowEnd,
      }),
    ).toEqual(EMPTY_COMPARISON)
  })

  it('computes percent deltas against the previous equal-length window', () => {
    const result = compareMetrics({
      current: { impressions: 300, plays: 600, engagements: 57, followers: 15 },
      history: [row('wechat_mp', { impressions: 100, plays: null }), row('bilibili', { impressions: 100, plays: 200 })],
      expectedPlatforms: expected,
      period: '7d',
      currentWindowStart: WINDOW_7D.windowStart,
      currentWindowEnd: WINDOW_7D.windowEnd,
    })
    expect(result.period).toBe('7d')
    // baseline impressions 100+100=200 → (300-200)/200 = 50
    expect(result.impressionsDeltaPercent).toBe(50)
    expect(result.playsDeltaPercent).toBe(200)
    expect(result.engagementsDeltaPercent).toBe(50)
    expect(result.followersDeltaPercent).toBe(50)
  })

  it('picks the latest capturedAt when several rows cover the same previous window', () => {
    const older = row('wechat_mp', { capturedAt: '2026-10-13T00:00:00.000Z', impressions: 10, plays: null, likes: 1, comments: 1, shares: 1, favorites: 1, followerDelta: 1 })
    const newer = row('wechat_mp', { capturedAt: '2026-10-13T12:00:00.000Z', impressions: 100, plays: null, likes: 10, comments: 2, shares: 3, favorites: 4, followerDelta: 5 })
    const bili = row('bilibili', { impressions: 0, plays: 200 })
    const chosen = selectBaselineRecord([older, newer, bili], 'wechat_mp', PREV_7D, '7d')
    expect(chosen?.capturedAt).toBe('2026-10-13T12:00:00.000Z')
    expect(chosen?.impressions).toBe(100)
  })

  it('prefers the row whose windowEnd is closest to the expected previous window', () => {
    const early = resolveMetricsWindow('7d', '2026-10-13T00:10:00.000Z')
    const late = resolveMetricsWindow('7d', '2026-10-13T23:55:00.000Z')
    const current = resolveMetricsWindow('7d', '2026-10-20T00:05:00.000Z')
    const prev = previousEqualLengthWindow(current.windowStart, current.windowEnd)!
    const chosen = selectBaselineRecord(
      [
        row('wechat_mp', { capturedAt: '2026-10-13T23:55:00.000Z', ...late, impressions: 999 }),
        row('wechat_mp', { capturedAt: '2026-10-13T00:10:00.000Z', ...early, impressions: 100 }),
      ],
      'wechat_mp',
      prev,
      '7d',
    )
    expect(chosen?.capturedAt).toBe('2026-10-13T00:10:00.000Z')
    expect(chosen?.impressions).toBe(100)
    expect(chosen?.windowEnd).toBe(early.windowEnd)
  })

  it('does not use a 30d record as a 7d baseline', () => {
    const thirty = row('wechat_mp', {
      windowStart: '2026-09-13T00:00:00.000Z',
      windowEnd: PREV_7D.windowEnd,
    })
    expect(
      compareMetrics({
        current: { impressions: 200, plays: 400, engagements: 38, followers: 10 },
        history: [thirty, row('bilibili')],
        expectedPlatforms: expected,
        period: '7d',
        currentWindowStart: WINDOW_7D.windowStart,
        currentWindowEnd: WINDOW_7D.windowEnd,
      }),
    ).toEqual(EMPTY_COMPARISON)
  })

  it('keeps a delta null when the current total is unknown', () => {
    const result = compareMetrics({
      current: { impressions: null, plays: 400, engagements: null, followers: 10 },
      history: [row('wechat_mp'), row('bilibili')],
      expectedPlatforms: expected,
      period: '7d',
      currentWindowStart: WINDOW_7D.windowStart,
      currentWindowEnd: WINDOW_7D.windowEnd,
    })
    expect(result.period).toBe('7d')
    expect(result.impressionsDeltaPercent).toBeNull()
    expect(result.engagementsDeltaPercent).toBeNull()
    expect(result.playsDeltaPercent).toBe(0)
  })

  it('does not fabricate a percent from a zero baseline unless current is also zero', () => {
    expect(deltaPercent(10, 0)).toBeNull()
    expect(deltaPercent(0, 0)).toBe(0)
  })

  it('matches a previous window when capture times of day differ by minutes', () => {
    const first = resolveMetricsWindow('7d', '2026-10-01T09:00:00.000Z')
    const second = resolveMetricsWindow('7d', '2026-10-08T09:05:00.000Z')
    const history = [
      row('wechat_mp', { capturedAt: '2026-10-01T09:00:00.000Z', ...first, plays: null }),
      row('bilibili', { capturedAt: '2026-10-01T09:00:00.000Z', ...first, impressions: null, plays: 200 }),
    ]
    const result = compareMetrics({
      current: { impressions: 200, plays: 400, engagements: 38, followers: 10 },
      history,
      expectedPlatforms: expected,
      period: '7d',
      currentWindowStart: second.windowStart,
      currentWindowEnd: second.windowEnd,
    })
    expect(result.period).toBe('7d')
    expect(result.impressionsDeltaPercent).toBe(100)
    expect(result.playsDeltaPercent).toBe(100)
  })
})

describe('MetricsStore permission bits', () => {
  it('creates the metrics directory as 0o700 and snapshot files as 0o600', async () => {
    if (process.platform === 'win32') return
    const dir = mkdtempSync(join(tmpdir(), 'gs-metrics-perm-'))
    const target = join(dir, 'metrics-root')
    const store = new MetricsStore(undefined, target)
    await store.appendVerified([outcome('wechat_mp', { impressions: 1 })])
    const file = join(target, '2026-10-20.json')
    expect((statSync(target).mode & 0o077) === 0).toBe(true)
    expect((statSync(file).mode & 0o077) === 0).toBe(true)
    if ((process.umask() & 0o700) === 0) {
      expect(statSync(target).mode & 0o777).toBe(DIR_MODE)
      expect(statSync(file).mode & 0o777).toBe(FILE_MODE)
    }
    rmSync(dir, { recursive: true, force: true })
  })
})

class RecordingCollector extends MetricsCollector {
  constructor(private readonly rows: PlatformMetricsOutcome[]) {
    super({ now: () => new Date(NOW) })
  }

  override async fetchPlatformMetrics(): Promise<PlatformMetricsOutcome[]> {
    return this.rows
  }
}

class FailingMetricsStore extends MetricsStore {
  override async appendVerified(): Promise<void> {
    throw new DraftStorageError('指标历史目录不可写', '/tmp/metrics-fail')
  }
}

async function registerOverview(
  collector: MetricsCollector,
  metricsStore?: MetricsStore,
): Promise<(req: Request) => Promise<Response>> {
  const { ConfigStore } = await import('../src/config-store.js')
  const store = new ConfigStore(undefined)
  const injoys = new InjoysClient()
  const adapters = new AdapterRegistry()
  let handler: ((req: Request) => Promise<Response>) | undefined
  const mockCtx: any = {
    allowDryRun: true,
    connection: {
      fetch: {
        register(opts: any) {
          if (opts.path === OPS_API_PATH) handler = opts.fetch
        },
      },
    },
  }
  registerOpsRpc(mockCtx, store, injoys, adapters, undefined, undefined, collector, metricsStore)
  if (!handler) throw new Error('handler not registered')
  return handler
}

function overviewRequest(): Request {
  return new Request('http://localhost/api/ops', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'client-request',
      rpcId: 'req-metrics-snapshot',
      method: OPS_ENDPOINT,
      payload: { method: 'workbench.overview', payload: { metricsWindow: '7d' } },
    }),
  })
}

describe('workbench.overview snapshot integration', () => {
  let dir: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'gs-metrics-rpc-'))
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('persists verified rows and fills comparison when history covers the previous window', async () => {
    const store = new MetricsStore(undefined, dir)
    await store.appendVerified([
      outcome('wechat_mp', {
        capturedAt: '2026-10-13T00:00:00.000Z',
        windowStart: PREV_7D.windowStart,
        windowEnd: PREV_7D.windowEnd,
        impressions: 100,
        likes: 10,
        comments: 2,
        shares: 3,
        favorites: 4,
        followerDelta: 5,
      }),
      outcome('bilibili', {
        capturedAt: '2026-10-13T00:00:00.000Z',
        windowStart: PREV_7D.windowStart,
        windowEnd: PREV_7D.windowEnd,
        plays: 200,
        likes: 10,
        comments: 2,
        shares: 3,
        favorites: 4,
        followerDelta: 5,
      }),
    ])

    const current = [
      outcome('wechat_mp', { impressions: 200, likes: 20, comments: 4, shares: 6, favorites: 8, followerDelta: 10 }),
      outcome('bilibili', { plays: 400, likes: 20, comments: 4, shares: 6, favorites: 8, followerDelta: 10 }),
    ]
    const handler = await registerOverview(new RecordingCollector(current), store)
    const res = await handler(overviewRequest())
    const body = (await res.json()) as any
    expect(body.result.ok).toBe(true)
    const comparison = body.result.value.overviewMetrics.comparison
    expect(comparison.period).toBe('7d')
    expect(comparison.impressionsDeltaPercent).toBe(100)
    expect(comparison.playsDeltaPercent).toBe(100)

    const file = join(dir, snapshotDateFromCapturedAt(NOW) + '.json')
    const rows = JSON.parse(readFileSync(file, 'utf-8')) as PlatformMetrics[]
    expect(rows.some(r => r.capturedAt === NOW && r.platform === 'wechat_mp')).toBe(true)
  })

  it('returns drafts/storage-unavailable when snapshot write fails', async () => {
    const current = [
      outcome('wechat_mp', { impressions: 1, likes: 1, comments: 1, shares: 1, favorites: 1 }),
      outcome('bilibili', { plays: 1, likes: 1, comments: 1, shares: 1, favorites: 1 }),
    ]
    const handler = await registerOverview(new RecordingCollector(current), new FailingMetricsStore(undefined, dir))
    const res = await handler(overviewRequest())
    const body = (await res.json()) as any
    expect(body.result.ok).toBe(false)
    expect(body.result.error.code).toBe('drafts/storage-unavailable')
  })

  it('maps a real unwritable metrics directory to drafts/storage-unavailable', async () => {
    if (process.platform === 'win32' || process.getuid?.() === 0) return
    const store = new MetricsStore(undefined, dir)
    chmodSync(dir, 0o500)
    try {
      const current = [
        outcome('wechat_mp', { impressions: 1, likes: 1, comments: 1, shares: 1, favorites: 1 }),
        outcome('bilibili', { plays: 1, likes: 1, comments: 1, shares: 1, favorites: 1 }),
      ]
      const handler = await registerOverview(new RecordingCollector(current), store)
      const res = await handler(overviewRequest())
      const body = (await res.json()) as any
      expect(body.result.ok).toBe(false)
      expect(body.result.error.code).toBe('drafts/storage-unavailable')
    } finally {
      chmodSync(dir, 0o700)
    }
  })

  it('does not persist unverified current rows when previous-window history is complete', async () => {
    const store = new MetricsStore(undefined, dir)
    await store.appendVerified([
      outcome('wechat_mp', {
        capturedAt: '2026-10-13T00:00:00.000Z',
        windowStart: PREV_7D.windowStart,
        windowEnd: PREV_7D.windowEnd,
        impressions: 100,
        likes: 10,
        comments: 2,
        shares: 3,
        favorites: 4,
        followerDelta: 5,
      }),
      outcome('bilibili', {
        capturedAt: '2026-10-13T00:00:00.000Z',
        windowStart: PREV_7D.windowStart,
        windowEnd: PREV_7D.windowEnd,
        plays: 200,
        likes: 10,
        comments: 2,
        shares: 3,
        favorites: 4,
        followerDelta: 5,
      }),
    ])
    const before = await store.readAll()

    const unverifiedNow = [
      outcome('wechat_mp', { source: 'live', windowScope: 'unverified', impressions: 9999, likes: 99, comments: 99, shares: 99, favorites: 99, followerDelta: 99 }),
      outcome('bilibili', { source: 'live', windowScope: 'unverified', plays: 9999, likes: 99, comments: 99, shares: 99, favorites: 99, followerDelta: 99 }),
    ]
    const handler = await registerOverview(new RecordingCollector(unverifiedNow), store)
    const res = await handler(overviewRequest())
    const body = (await res.json()) as any
    expect(body.result.ok).toBe(true)
    const comparison = body.result.value.overviewMetrics.comparison
    expect(comparison.period).toBe('7d')
    expect(comparison.impressionsDeltaPercent).toBeNull()
    expect(comparison.playsDeltaPercent).toBeNull()
    expect(comparison.engagementsDeltaPercent).toBeNull()
    expect(comparison.followersDeltaPercent).toBeNull()
    expect(await store.readAll()).toEqual(before)
    expect(existsSync(join(dir, snapshotDateFromCapturedAt(NOW) + '.json'))).toBe(false)
  })
})

describe('snapshotDateFromCapturedAt', () => {
  it('uses the UTC calendar date of capturedAt', () => {
    expect(snapshotDateFromCapturedAt('2026-10-20T23:15:00.000Z')).toBe('2026-10-20')
  })
})
