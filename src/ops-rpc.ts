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
import { parseTabs } from './browser/browseros-ops.js'
import { extractToolText } from './browser/browseros-bridge.js'
import {
  DraftStore,
  DraftConcurrencyError,
  DraftPublishGuardError,
  DraftUnknownChannelError,
  DraftInvalidPublishUrlError,
  DraftStorageError,
  verifyDirectoryWritable,
  getPublishProgress,
  isValidPublishUrl,
} from './storage/draft-store.js'
import { MetricsCollector } from './analytics/metrics-collector.js'
import type { ContentDraft, PlatformId, PlatformSessionStatus } from './types.js'
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

            // S1/T1: a new draftsDir must be prepared AND verified writable BEFORE it is
            // persisted. Existence alone is not enough — an existing read-only directory
            // passes mkdir but fails the first real write, so config.save would report
            // success while every later draft write fails.
            if (typeof toSave?.draftsDir === 'string' && toSave.draftsDir.trim().length > 0) {
              const targetDir = toSave.draftsDir.trim()
              try {
                verifyDirectoryWritable(targetDir)
              } catch (err) {
                result = {
                  ok: false,
                  error: {
                    code: 'config/invalid-drafts-dir',
                    message:
                      err instanceof DraftStorageError
                        ? err.message
                        : `草稿目录不可用：${targetDir}`,
                  },
                }
                break
              }
            }

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
            const currentConfig = configStore.load()
            const reuseHost = typeof (payload as any).reuseHostBrowserProfile === 'boolean'
              ? (payload as any).reuseHostBrowserProfile
              : Boolean(currentConfig.reuseHostBrowserProfile)

            let activeTabs: Array<{ url: string }> = []
            if (browserOsClient) {
              try {
                const tabsRes = await browserOsClient.callTool('tabs', { action: 'list' })
                // BrowserOS may answer with a JSON array or a `[n] <url>` text listing.
                activeTabs = parseTabs(extractToolText(tabsRes))
                  .filter(tab => typeof tab.url === 'string')
                  .map(tab => ({ url: tab.url as string }))
              } catch {
                // Ignore error if listing tabs fails
              }
            }

            let statuses: PlatformSessionStatus[]
            if (reuseHost) {
              const realStatuses = await sessionGuard.checkAllRealSessions(adapters.list())
              if (activeTabs.length > 0) {
                const browserStatuses = sessionGuard.checkBrowserSessions(adapters.list(), activeTabs)
                const browserStatusMap = new Map(browserStatuses.map(s => [s.platform, s]))
                statuses = realStatuses.map(rs => {
                  const bs = browserStatusMap.get(rs.platform)
                  if (bs && bs.isReady) return bs
                  return rs
                })
              } else {
                statuses = realStatuses
              }
            } else {
              statuses = sessionGuard.checkBrowserSessions(adapters.list(), activeTabs)
            }

            result = {
              ok: true,
              value: {
                statuses,
                reuseHostBrowserProfile: reuseHost,
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
              } else if (err instanceof DraftPublishGuardError) {
                // published 只能经 drafts.updatePublishUrl 推进（架构 §3.2.3 / §5.2）
                result = {
                  ok: false,
                  error: {
                    code: 'drafts/published-requires-url',
                    message: err.message,
                  },
                }
              } else if (err instanceof DraftStorageError) {
                // 目录不可用必须如实暴露，不得吞没后谎报保存成功
                result = {
                  ok: false,
                  error: {
                    code: 'drafts/storage-unavailable',
                    message: err.message,
                    details: { dir: err.dir },
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

            // URL 守卫（架构 §3.2.5）：published 的唯一可信证据是合法真实链接。
            // 使用 URL 解析器而非宽松正则，避免 `https://%` 这类结构非法值被当作有效凭据。
            if (!isValidPublishUrl(publishedUrl)) {
              result = {
                ok: false,
                error: {
                  code: 'drafts/invalid-published-url',
                  message: '回填的发布链接必须是合法的 http(s) URL。',
                },
              }
              break
            }

            let draft: ContentDraft | null = null
            try {
              draft = await actualDraftStore.markPublished(draftId, platform, publishedUrl)
            } catch (err) {
              if (err instanceof DraftUnknownChannelError) {
                result = {
                  ok: false,
                  error: { code: 'drafts/unknown-channel', message: err.message },
                }
                break
              }
              if (err instanceof DraftInvalidPublishUrlError) {
                result = {
                  ok: false,
                  error: { code: 'drafts/invalid-published-url', message: err.message },
                }
                break
              }
              throw err
            }

            if (!draft) {
              result = { ok: true, value: { draft: null } }
              break
            }

            // 渠道进度：整体 published 仅在全部渠道回填有效 URL 后成立（架构 §3.2.5）
            const progress = getPublishProgress(draft)

            result = {
              ok: true,
              value: {
                draft,
                publishedChannels: progress.publishedChannels,
                totalChannels: progress.totalChannels,
                allPublished: progress.allPublished,
              },
            }
            break
          }

          case 'workbench.generateArticleDraft': {
            const topic = String(payload.topic ?? '新特性发布')
            const targetPlatform = (payload.targetPlatform as PlatformId) || 'wechat_mp'
            // 同样固定目录：本路径落盘草稿后 await Injoys，再回写 injoysDocId。
            // 若在 await 之后重新解析目录，会把 docId 写进另一个库的同 ID 草稿。
            const articleStorageDir = actualDraftStore.getDirectory()
            const cfg = configStore.load()
            const kb = await injoys.getKnowledgeContext(cfg.defaultProduct)

            const title = `深度拆解：${topic} —— ${kb.productName} 架构实操`
            const digest = `基于 ${kb.productName} 核心理念，全面解析 ${topic} 在实际生产中的应用。`
            const contentMarkdown = `# ${title}\n\n> **导语**：${digest}\n\n## 一、 背景与痛点\n围绕 ${topic}，探讨开发者的核心痛点与解决思路。\n\n## 二、 架构实践\n深入 ${kb.productName} 模块化设计。\n`

            // 首次落盘也必须绑定同一个目录：本请求在 await 知识库之后才写草稿，
            // 若此处用实时目录，等待期间切换会产生「A 库读、B 库写」的双库副本（架构 §3.10.4）。
            const draft = await actualDraftStore.saveDraft(
              {
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
              },
              { dir: articleStorageDir },
            )

            const docId = await injoys.saveArticleDocument({
              id: draft.id,
              title,
              digest,
              contentMarkdown,
              suggestedTags: ['技术分享', 'AI'],
            })

            if (docId) {
              await actualDraftStore.saveDraft(
                {
                  ...draft,
                  injoysDocId: docId,
                },
                { dir: articleStorageDir },
              )
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
            const mediaPath = typeof payload.mediaPath === 'string' ? payload.mediaPath : undefined
            // 分区仅 B站 有效；未显式传入时留空，由调用方/预填阶段决定（架构 §3.5）
            const partition =
              platform === 'bilibili' && typeof payload.partition === 'string' && payload.partition.length > 0
                ? payload.partition
                : undefined
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
                  mediaPaths: mediaPath ? [mediaPath] : undefined,
                  partition,
                },
              ],
              status: 'ready_for_review',
            })

            result = {
              ok: true,
              value: {
                id: draft.id,
                // 与图文生成对齐：显式声明是否已落盘，避免客户端误判（架构 §3.5）
                draftSaved: true,
                titleCandidates,
                description,
                tags,
                partition,
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
                activeTabs = parseTabs(extractToolText(tabsRes))
                  .filter(tab => typeof tab.url === 'string')
                  .map(tab => ({ url: tab.url as string }))
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
            // T2: pin the storage directory for the WHOLE request. This handler reads the
            // draft, awaits the platform adapter, then writes the prefill result back; if
            // the directory were re-resolved after the await, a `draftsDir` change in
            // between would make the write land in a different library and pollute an
            // unrelated same-ID draft (architecture §3.10.4).
            const storageDir = actualDraftStore.getDirectory()
            const draft = await actualDraftStore.getDraft(draftId, storageDir)

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
                // 分区必须一路带到 Adapter，否则平台分区控件拿不到值（架构 §3.5）
                partition: variant.partition,
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
              await actualDraftStore.updatePrefillResult(
                draftId,
                platform,
                {
                  draftId: prefillRes.draftId,
                  draftUrl: prefillRes.draftUrl,
                },
                storageDir,
              )
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
        // T3: unify storage-error mapping at the single RPC boundary so every write entry
        // point (drafts.save, drafts.updatePublishUrl, prefill write-back, …) reports the
        // same `drafts/storage-unavailable` code instead of leaking `ops/internal-error`.
        // Configuration pre-check failures keep their own `config/invalid-drafts-dir`
        // code, which is mapped where the path is validated.
        if (error instanceof DraftStorageError) {
          return reply(rpcId, {
            ok: false,
            error: {
              code: 'drafts/storage-unavailable',
              message: error.message,
              details: { dir: error.dir },
            },
          })
        }
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
