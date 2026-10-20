import { describe, expect, it } from 'vitest'
import { InjoysClient } from '../src/injoys/client.js'
import { AdapterRegistry } from '../src/adapters/registry.js'
import { MetricsCollector, type PlatformMetricsOutcome } from '../src/analytics/metrics-collector.js'
import { registerOpsRpc, OPS_API_PATH, OPS_ENDPOINT } from '../src/ops-rpc.js'
import type { PlatformId } from '../src/types.js'

/** A collector that records the window it was asked for and returns nothing. */
class RecordingCollector extends MetricsCollector {
  readonly requested: Array<{ platforms: PlatformId[]; timeRange: '7d' | '30d' }> = []

  constructor() {
    super({ now: () => new Date('2026-10-20T00:00:00.000Z') })
  }

  override async fetchPlatformMetrics(
    platforms: PlatformId[],
    timeRange: '7d' | '30d' = '7d',
  ): Promise<PlatformMetricsOutcome[]> {
    this.requested.push({ platforms, timeRange })
    return super.fetchPlatformMetrics(platforms, timeRange)
  }
}

/** Register the RPC handler with a caller-supplied collector. */
async function registerFor(collector: MetricsCollector): Promise<(req: Request) => Promise<Response>> {
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

  registerOpsRpc(mockCtx, store, injoys, adapters, undefined, undefined, collector)
  if (!handler) throw new Error('handler not registered')
  return handler
}

function overviewRequest(payload: Record<string, unknown> = {}): Request {
  return new Request('http://localhost/api/ops', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'client-request',
      rpcId: 'req-overview-window',
      method: OPS_ENDPOINT,
      payload: { method: 'workbench.overview', payload },
    }),
  })
}

describe('workbench.overview metricsWindow pass-through', () => {
  it('defaults to 7d when the caller omits metricsWindow', async () => {
    const collector = new RecordingCollector()
    const handler = await registerFor(collector)

    const res = await handler(overviewRequest())
    const data = (await res.json()) as any

    expect(data.result.ok).toBe(true)
    expect(collector.requested).toHaveLength(1)
    expect(collector.requested[0]!.timeRange).toBe('7d')
  })

  it('forwards metricsWindow=30d instead of hardcoding 7d', async () => {
    const collector = new RecordingCollector()
    const handler = await registerFor(collector)

    const res = await handler(overviewRequest({ metricsWindow: '30d' }))
    const data = (await res.json()) as any

    expect(data.result.ok).toBe(true)
    expect(collector.requested[0]!.timeRange).toBe('30d')
  })

  it('asks the collector for the expected platform set', async () => {
    const collector = new RecordingCollector()
    const handler = await registerFor(collector)

    await handler(overviewRequest())

    expect(collector.requested[0]!.platforms).toEqual(['wechat_mp', 'bilibili'])
  })
})
