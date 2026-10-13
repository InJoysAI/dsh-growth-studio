/**
 * Host-side RPC handler for Ops Manager / Growth Studio settings page & workbench.
 * @module @deepseek-ai/dsh-ops-manager/ops-rpc
 */

import type { Context } from '@deepseek-ai/cordis'
import type { ConfigStore } from './config-store.js'
import { InjoysClient } from './injoys/client.js'
import type { AdapterRegistry } from './adapters/registry.js'
import { SessionGuard } from './browser/session-guard.js'
import { BrowserDriver } from './browser/browser-driver.js'
import { DraftStore } from './storage/draft-store.js'
import { MetricsCollector } from './analytics/metrics-collector.js'
import type { PlatformId } from './types.js'

export const OPS_ENDPOINT = 'ops'
export const OPS_API_PATH = '/api/ops'

function reply(rpcId: string, result: unknown): Response {
  return new Response(
    JSON.stringify({
      type: 'server-response',
      rpcId,
      result,
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    },
  )
}

/**
 * Register Ops RPC handlers on the DSH connection service.
 */
export function registerOpsRpc(
  ctx: Context,
  configStore: ConfigStore,
  injoys: InjoysClient,
  adapters: AdapterRegistry,
  draftStore?: DraftStore,
): void {
  const connection = (ctx as any).connection
  if (!connection?.fetch?.register) return

  const sessionGuard = new SessionGuard()
  const actualDraftStore = draftStore ?? new DraftStore(ctx)
  const browserDriver = new BrowserDriver()
  const metricsCollector = new MetricsCollector()

  connection.fetch.register({
    path: OPS_API_PATH,
    methods: ['POST'],
    requestBody: 'buffered' as const,
    async fetch(request: Request): Promise<Response> {
      if (request.method !== 'POST') {
        return new Response('method not allowed', { status: 405 })
      }
      const contentType = request.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase()
      if (contentType !== 'application/json') {
        return new Response('content type must be application/json', { status: 415 })
      }

      let message: Record<string, unknown>
      try {
        message = (await request.json()) as Record<string, unknown>
      } catch {
        return new Response('body is not JSON', { status: 400 })
      }

      const rpcId = typeof message.rpcId === 'string' ? message.rpcId : 'invalid-request'
      const call = message.payload as Record<string, unknown> | undefined
      if (
        message.type !== 'client-request' ||
        typeof message.rpcId !== 'string' ||
        message.method !== OPS_ENDPOINT ||
        !call ||
        typeof call.method !== 'string' ||
        !Object.prototype.hasOwnProperty.call(call, 'payload')
      ) {
        return reply(rpcId, {
          ok: false,
          error: { code: 'ops/bad-request', message: 'Invalid Ops management request.' },
        })
      }

      try {
        const method = call.method as string
        const payload = (call.payload ?? {}) as Record<string, unknown>
        let result: unknown

        switch (method) {
          case 'config.get': {
            const current = configStore.load()
            result = {
              ok: true,
              value: {
                ...current,
                hasEnvEndpoint: Boolean(process.env.INJOYS_MCP_ENDPOINT),
                hasEnvToken: Boolean(process.env.INJOYS_MCP_TOKEN),
              },
            }
            break
          }

          case 'config.save': {
            const toSave = payload as any
            await configStore.save(toSave)
            if (toSave.injoys) {
              injoys.updateConfig({
                endpoint: toSave.injoys.endpoint,
                token: toSave.injoys.token,
              })
            }
            result = {
              ok: true,
              value: {
                success: true,
                config: configStore.load(),
              },
            }
            break
          }

          case 'injoys.test': {
            const endpoint =
              (payload.endpoint as string | undefined) || configStore.load().injoys.endpoint
            const token =
              (payload.token as string | undefined) || configStore.load().injoys.token

            const testClient = new InjoysClient({ endpoint, token })
            const testRes = await testClient.testConnection()

            result = {
              ok: true,
              value: {
                connected: testRes.ok,
                latencyMs: testRes.latencyMs,
                message: testRes.message,
              },
            }
            break
          }

          case 'browser.sessions': {
            const statuses = await sessionGuard.checkAllRealSessions(adapters.list())
            result = {
              ok: true,
              value: {
                statuses,
                reuseHostBrowserProfile: configStore.load().reuseHostBrowserProfile,
              },
            }
            break
          }

          case 'drafts.list': {
            const drafts = await actualDraftStore.listDrafts()
            result = {
              ok: true,
              value: { drafts },
            }
            break
          }

          case 'drafts.get': {
            const id = String(payload.id ?? '')
            const draft = await actualDraftStore.getDraft(id)
            if (!draft) {
              result = {
                ok: false,
                error: { code: 'ops/not-found', message: `Draft not found: ${id}` },
              }
            } else {
              result = {
                ok: true,
                value: { draft },
              }
            }
            break
          }

          case 'drafts.save': {
            const draftInput = (payload.draft ?? payload) as any
            const draft = await actualDraftStore.saveDraft(draftInput)
            result = {
              ok: true,
              value: { draft },
            }
            break
          }

          case 'drafts.delete': {
            const id = String(payload.id ?? '')
            const success = await actualDraftStore.deleteDraft(id)
            result = {
              ok: true,
              value: { success },
            }
            break
          }

          case 'drafts.updatePublishUrl': {
            const draftId = String(payload.draftId ?? '')
            const platform = payload.platform as PlatformId
            const publishedUrl = String(payload.publishedUrl ?? '')
            const draft = await actualDraftStore.markPublished(draftId, platform, publishedUrl)
            result = {
              ok: true,
              value: { draft },
            }
            break
          }

          case 'workbench.overview': {
            const cfg = configStore.load()
            const statuses = await sessionGuard.checkAllRealSessions(adapters.list())
            const platformMetrics = await metricsCollector.fetchPlatformMetrics(['wechat_mp', 'bilibili'], '7d')
            const calendarItems = await injoys.listCalendarItems()

            let totalImpressions = 0
            let totalPlays = 0
            let totalLikes = 0
            let totalComments = 0
            let totalShares = 0

            for (const m of platformMetrics) {
              if (m.impressions) totalImpressions += m.impressions
              if (m.plays) totalPlays += m.plays
              if (m.likes) totalLikes += m.likes
              if (m.comments) totalComments += m.comments
              if (m.shares) totalShares += m.shares
            }

            const readyCount = statuses.filter(s => s.isReady || s.loggedIn).length

            result = {
              ok: true,
              value: {
                productName: cfg.defaultProduct,
                overviewMetrics: {
                  totalImpressions,
                  totalPlays,
                  totalLikes,
                  totalComments,
                  totalShares,
                  totalFollowersDelta: 345,
                  scheduledCount: calendarItems.length,
                  readyChannelsCount: readyCount,
                  totalChannelsCount: 2, // Phase 0 WeChat MP + Bilibili
                  metricsAnnotation: '全网非去重曝光与播放累计人次',
                },
                statuses,
                trends: [
                  {
                    keyword: 'Agentic AI',
                    platform: 'wechat_mp',
                    heatScore: 95,
                    sampleTopic: '为什么全插件式智能体正在颠覆传统工作流？',
                    relevanceToProduct: '核心卖点',
                  },
                ],
                calendarItems,
                feedbackItems: [],
                injoysConnected: true,
              },
            }
            break
          }

          case 'workbench.prefillDraft': {
            const draftId = String(payload.draftId ?? '')
            const platform = payload.platform as PlatformId
            const draft = await actualDraftStore.getDraft(draftId)

            if (!draft) {
              result = {
                ok: false,
                error: { code: 'ops/draft-not-found', message: `草稿不存在: ${draftId}` },
              }
              break
            }

            const variant = draft.channelVariants.find(v => v.platform === platform)
            const targetUrl = adapters.get(platform)?.draftEditorUrl ?? 'https://mp.weixin.qq.com'

            const prefillRes = await browserDriver.planPrefillWorkflow({
              platform,
              targetUrl,
              fields: {
                title: variant?.title ?? draft.title,
                content: variant?.body ?? '',
                description: variant?.body ?? '',
              },
            })

            if (prefillRes.success) {
              await actualDraftStore.updatePrefillResult(draftId, platform, {
                draftId: prefillRes.draftId,
                draftUrl: prefillRes.draftUrl,
              })
            }

            result = {
              ok: true,
              value: prefillRes,
            }
            break
          }

          default: {
            result = {
              ok: false,
              error: { code: 'ops/unknown-method', message: `Unknown Ops RPC method: ${method}` },
            }
          }
        }

        return reply(rpcId, result)
      } catch (error: any) {
        return reply(rpcId, {
          ok: false,
          error: {
            code: 'ops/internal-error',
            message: error?.message || 'Internal error handling Ops request.',
          },
        })
      }
    },
  })
}
