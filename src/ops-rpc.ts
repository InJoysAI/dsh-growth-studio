/**
 * Host-side RPC handler for Ops Manager / Growth Studio settings page & workbench.
 * @module @deepseek-ai/dsh-ops-manager/ops-rpc
 */

import type { Context } from '@deepseek-ai/cordis'
import type { ConfigStore } from './config-store.js'
import { InjoysClient } from './injoys/client.js'
import type { AdapterRegistry } from './adapters/registry.js'
import { SessionGuard } from './browser/session-guard.js'
import { BrowserDriver, type BrowserOsMcpClient } from './browser/browser-driver.js'
import { DraftStore, DraftConcurrencyError } from './storage/draft-store.js'
import { MetricsCollector } from './analytics/metrics-collector.js'
import type { PlatformId } from './types.js'
import type { AdapterContext, ArticlePayload, VideoPayload } from './adapters/base.js'

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
  browserOsClient?: BrowserOsMcpClient,
): void {
  const connection = ctx?.get ? (ctx.get("connection", false) ?? (ctx as any).connection) : (ctx as any).connection
  if (!connection?.fetch?.register) return

  const sessionGuard = new SessionGuard()
  const actualDraftStore = draftStore ?? new DraftStore(ctx)
  const isDryRunAllowed = Boolean(ctx?.get ? ctx.get("allowDryRun", false) : (ctx as any)?.allowDryRun)
  const browserDriver = new BrowserDriver(browserOsClient, { allowDryRun: isDryRunAllowed })
  adapters.setBrowserOsClient(browserOsClient, { allowDryRun: isDryRunAllowed })
  const metricsCollector = new MetricsCollector({ browserOsClient })

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
            let activeTabs: Array<{ url: string }> = []
            if (browserOsClient) {
              try {
                const tabsRes = await browserOsClient.callTool('tabs', { action: 'list' })
                activeTabs = Array.isArray(tabsRes?.tabs) ? tabsRes.tabs : []
              } catch {
                // Ignore error if listing tabs fails
              }
            }

            // Evaluate unified BrowserOS sessions using active tabs
            const statuses = sessionGuard.checkBrowserSessions(adapters.list(), activeTabs)

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
            const expectedVersion = typeof payload.expectedVersion === 'number' ? payload.expectedVersion : undefined
            try {
              const draft = await actualDraftStore.saveDraft(draftInput, { expectedVersion })
              result = {
                ok: true,
                value: { draft },
              }
            } catch (err) {
              if (err instanceof DraftConcurrencyError) {
                result = {
                  ok: false,
                  error: {
                    code: 'ops/concurrency-conflict',
                    message: err.message,
                    details: { currentVersion: err.currentVersion, expectedVersion: err.expectedVersion },
                  },
                }
              } else {
                throw err
              }
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

          case 'workbench.generateArticleDraft': {
            const topic = String(payload.topic ?? '新特性发布')
            const targetPlatform = (payload.targetPlatform as PlatformId) || 'wechat_mp'
            const cfg = configStore.load()
            const kb = await injoys.getKnowledgeContext(cfg.defaultProduct)

            const title = `深度拆解：${topic} —— ${kb.productName} 架构实操`
            const digest = `基于 ${kb.productName} 核心理念，全面解析 ${topic} 在实际生产中的应用。`
            const contentMarkdown = `# ${title}\n\n> **导语**：${digest}\n\n## 一、 背景与痛点\n围绕 ${topic}，探讨开发者的核心痛点与解决思路。\n\n## 二、 架构实践\n深入 ${kb.productName} 模块化设计。\n`

            const draft = await actualDraftStore.saveDraft({
              title,
              topic,
              channelVariants: [
                {
                  platform: targetPlatform,
                  kind: 'article',
                  title,
                  body: contentMarkdown,
                  tags: ['技术分享', 'AI'],
                },
              ],
              status: 'ready_for_review',
            })

            const docId = await injoys.saveArticleDocument({
              id: draft.id,
              title,
              digest,
              contentMarkdown,
              suggestedTags: ['技术分享', 'AI'],
            })

            if (docId) {
              await actualDraftStore.saveDraft({
                ...draft,
                injoysDocId: docId,
              })
            }

            result = {
              ok: true,
              value: {
                id: draft.id,
                title: draft.title,
                digest,
                contentMarkdown,
                wordCount: contentMarkdown.length,
                draftSaved: true,
                injoysDocId: docId,
              },
            }
            break
          }

          case 'workbench.generateVideoMeta': {
            const topic = String(payload.topic ?? '硬核实战')
            const platform = (payload.platform as PlatformId) || 'bilibili'
            const titleCandidates = [
              { title: `【硬核】手把手带你玩转 ${topic}`, angle: '硬核实战型', estimatedCtr: '高点击率' },
              { title: `告别重复造轮子：${topic} 实操全记录`, angle: '痛点揭秘型', estimatedCtr: '高转化率' },
              { title: `我用这套智能体工作流做 ${topic}，太香了！`, angle: '自媒体爆款型', estimatedCtr: '高完播率' },
            ]
            const description = `本期视频详细演示 ${topic} 的完整落地过程。\n欢迎点赞、投币、收藏支持！`
            const tags = ['AI智能体', '独立开发', '效率工具', 'Python', '全栈']

            const draft = await actualDraftStore.saveDraft({
              title: titleCandidates[0].title,
              topic,
              channelVariants: [
                {
                  platform,
                  kind: 'video',
                  title: titleCandidates[0].title,
                  body: description,
                  tags,
                },
              ],
              status: 'ready_for_review',
            })

            result = {
              ok: true,
              value: {
                id: draft.id,
                titleCandidates,
                description,
                tags,
                coverPromptSuggestion: `极简科技感封面，中心突出关键词 "${topic}"`,
              },
            }
            break
          }

          case 'workbench.overview': {
            const cfg = configStore.load()
            let activeTabs: Array<{ url: string }> = []
            if (browserOsClient) {
              try {
                const tabsRes = await browserOsClient.callTool('tabs', { action: 'list' })
                activeTabs = Array.isArray(tabsRes?.tabs) ? tabsRes.tabs : []
              } catch {
                // Ignore tab query failure
              }
            }

            const statuses = sessionGuard.checkBrowserSessions(adapters.list(), activeTabs)

            const platformMetrics = await metricsCollector.fetchPlatformMetrics(['wechat_mp', 'bilibili'], '7d')
            const calendarItems = await injoys.listCalendarItems().catch(() => [])
            const injoysHealth = await injoys.testConnection().catch(() => ({ ok: false, latencyMs: 0, message: '' }))

            let totalImpressions: number | null = null
            let totalPlays: number | null = null
            let totalLikes: number | null = null
            let totalComments: number | null = null
            let totalShares: number | null = null
            let totalFollowersDelta: number | null = null

            for (const m of platformMetrics) {
              if (m.impressions !== null) totalImpressions = (totalImpressions ?? 0) + m.impressions
              if (m.plays !== null) totalPlays = (totalPlays ?? 0) + m.plays
              if (m.likes !== null) totalLikes = (totalLikes ?? 0) + m.likes
              if (m.comments !== null) totalComments = (totalComments ?? 0) + m.comments
              if (m.shares !== null) totalShares = (totalShares ?? 0) + m.shares
              if (m.followerDelta !== null && m.followerDelta !== undefined) {
                totalFollowersDelta = (totalFollowersDelta ?? 0) + m.followerDelta
              }
            }

            const readyCount = statuses.filter(s => s.state === 'authenticated' || (s as any).loggedIn).length

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
                  totalFollowersDelta,
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
                injoysConnected: injoysHealth.ok,
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

            const adapter = adapters.get(platform)
            if (!adapter) {
              result = {
                ok: false,
                error: {
                  code: 'ops/platform-unsupported',
                  message: `不支持或未配置的平台: ${platform}`,
                },
              }
              break
            }

            const variant = draft.channelVariants.find(v => v.platform === platform)
            if (!variant) {
              result = {
                ok: false,
                error: {
                  code: 'ops/variant-not-found',
                  message: `草稿未包含平台 [${platform}] 的发布变体，请先生成或配置变体`,
                },
              }
              break
            }

            const hasTitle = Boolean(variant.title?.trim())
            const hasBody = Boolean(variant.body?.trim())
            if (!hasTitle || !hasBody) {
              const bodyName = adapter.kind === 'video' ? '简介/描述' : '正文'
              result = {
                ok: false,
                error: {
                  code: 'ops/material-incomplete',
                  message: `平台 [${platform}] 变体缺少必要物料（${!hasTitle ? '标题' : ''}${!hasTitle && !hasBody ? '与' : ''}${!hasBody ? bodyName : ''}不能为空）`,
                },
              }
              break
            }

            const adapterCtx: AdapterContext = {
              reuseHostProfile: false,
            }

            let prefillPayload: ArticlePayload | VideoPayload
            if (adapter.kind === 'video') {
              prefillPayload = {
                title: variant.title,
                description: variant.body,
                tags: variant.tags ?? [],
                localVideoPath: variant.mediaPaths?.[0] ?? '',
                coverPath: variant.coverPath,
              }
            } else {
              prefillPayload = {
                title: variant.title,
                digest: variant.body.slice(0, 100),
                contentMarkdown: variant.body,
                suggestedTags: variant.tags ?? [],
                coverPath: variant.coverPath,
              }
            }

            const prefillRes = await adapter.prefillDraft(adapterCtx, prefillPayload)

            // Only persist prefill results when prefill succeeded
            if (prefillRes.success) {
              await actualDraftStore.updatePrefillResult(draftId, platform, {
                draftId: prefillRes.draftId,
                draftUrl: prefillRes.draftUrl,
              })
            }

            result = {
              ok: prefillRes.success,
              value: prefillRes,
              error: prefillRes.success
                ? undefined
                : { code: 'ops/prefill-failed', message: prefillRes.message },
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
