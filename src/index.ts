/**
 * Personal Product Growth Marketing & Operations Studio plugin for DeepSeek Harness.
 * @module @deepseek-ai/dsh-growth-studio
 */

import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { InjoysClient } from './injoys/client.js'
import { AdapterRegistry } from './adapters/registry.js'
import { ConfigStore } from './config-store.js'
import { DraftStore } from './storage/draft-store.js'
import { MetricsStore } from './storage/metrics-store.js'
import { registerOpsRpc } from './ops-rpc.js'
import { createOpsTools } from './tools/index.js'
import { MetricsCollector } from './analytics/metrics-collector.js'
import { resolveBrowserOsClient, BROWSEROS_SERVER_NAME } from './browser/browseros-bridge.js'
import type { BrowserOsMcpClient } from './browser/browser-driver.js'

export const name = 'growth-studio'
export const inject = ['tools', 'systemPrompt']

export interface Config {
  /** Default product key to look up in Injoys knowledge base */
  defaultProduct?: string
  /** Whether to reuse the host local browser profile for BrowserOS sessions */
  reuseHostBrowserProfile?: boolean
  /** Injoys MCP connection settings */
  injoys?: {
    endpoint?: string
    token?: string
  }
  /** Auto-sync operations results to Injoys sheets and docs */
  autoSyncToInjoys?: boolean
}

export const Config: z<Config> = z.object({
  defaultProduct: z.string().default('DeepSeek Harness'),
  reuseHostBrowserProfile: z.boolean().default(true),
  injoys: z.object({
    endpoint: z.string().default('http://127.0.0.1:17688/mcp'),
    // ⛔ 禁止内置默认令牌（criterion §4）；仅允许用户配置或 INJOYS_MCP_TOKEN 环境变量
    token: z.string().default(''),
  }).default({}),
  autoSyncToInjoys: z.boolean().default(true),
})

/**
 * Apply the Growth Studio plugin into the Cordis lifecycle.
 * Registers tools, connects to Injoys and BrowserOS MCP adapters,
 * registers Ops management settings RPC, and contributes prompt guidance to the model.
 */
export function apply(ctx: Context, config: Config): void {
  const configStore = new ConfigStore(ctx, config)
  const currentConfig = configStore.load()
  const defaultProduct = currentConfig.defaultProduct ?? 'DeepSeek Harness'
  const injoys = new InjoysClient(currentConfig.injoys)

  // Resolve BrowserOS through the tools `dsh-mcp-client` registers. That plugin
  // publishes every external MCP tool as `mcp__<serverName>__<tool>` on
  // `ctx.tools` and exposes no Cordis service, so a service lookup can never
  // find it. Resolving here (rather than guessing service keys) keeps the
  // bridge honest: when the server is not registered we get `undefined` and the
  // collectors report "unmeasured" instead of fabricating numbers.
  const bridge = resolveBrowserOsClient(ctx)
  const browserOsClient: BrowserOsMcpClient | undefined = bridge.client

  if (browserOsClient) {
    console.info(
      `[growth-studio] BrowserOS MCP 已接入，可用工具: ${bridge.availableTools.join(', ')}`,
    )
  } else {
    console.warn(
      `[growth-studio] ${bridge.reason ?? 'BrowserOS MCP 未接入'}（serverName: ${BROWSEROS_SERVER_NAME}）`,
    )
  }

  const adapters = new AdapterRegistry(browserOsClient)
  // Resolve the drafts directory from live config so a `draftsDir` change takes
  // effect immediately without recreating the plugin (architecture §3.10.4).
  const draftStore = new DraftStore(ctx, () => configStore.load().draftsDir)
  const metricsStore = new MetricsStore(ctx)

  ctx.inject(['connection'], (connectionCtx) => {
    registerOpsRpc(connectionCtx, configStore, injoys, adapters, draftStore, browserOsClient, undefined, metricsStore)
  })

  ctx.systemPrompt.section({
    name: 'tool:growth-studio',
    order: 350,
    text: [
      `The growth-studio tools provide marketing and content operations capabilities for ${defaultProduct}.`,
      'Use `ops_plan_calendar` to schedule multi-channel releases and sync to Injoys spreadsheets.',
      'Use `ops_draft_article` for WeChat Official Account in-depth copywriting and Injoys documents.',
      'Use `ops_draft_video_meta` for video titles, tags, and chapter timestamps from local finished videos.',
      'Use `ops_push_drafts` to automatically prefill platform draft boxes via BrowserOS and provide review URLs.',
      'Use `ops_fetch_metrics` to collect creator metrics across channels, append window-verified snapshots under local metrics/, and sync to Injoys metrics spreadsheets.',
      'Use `ops_generate_review` to calculate viral rates and output weekly/monthly ops reviews into Injoys documents.',
      'Use `ops_fetch_comments` to crawl audience comments and questions from video and article channels.',
      'Use `ops_extract_feedback` to cluster comments into bugs/features and update Injoys backlog and FAQ.',
      'Use `ops_discover_trends` to identify high-converting industry topics and viral angles.',
      'Use `ops_setup_schedule` to register recurring ops inspections with the DSH automated tasks system.',
      'Use `ops_draft_launch_kit` to craft Product Hunt launch materials, Twitter/X threads, and timezone schedules for overseas reach.',
    ].join(' '),
  })

  // Pass one collector that already holds the live BrowserOS client. Without
  // this the tool builds its own client-less collector and every metric reads as
  // unmeasured even though BrowserOS is reachable.
  const metricsCollector = new MetricsCollector({ browserOsClient })

  const tools = createOpsTools(injoys, adapters, ctx, draftStore, metricsCollector, undefined, metricsStore)
  for (const tool of tools) {
    ctx.tools.register(tool)
  }
}

export * from './config-store.js'
export * from './ops-rpc.js'

export * from './types.js'
export * from './injoys/client.js'
export * from './browser/session-guard.js'
export * from './browser/browser-driver.js'
export * from './browser/browseros-bridge.js'
export * from './browser/browseros-ops.js'
export * from './adapters/base.js'
export * from './adapters/registry.js'
export * from './international/overseas-strategy.js'
export * from './analytics/metrics-collector.js'
export * from './analytics/review-reporter.js'
export * from './feedback/comments-crawler.js'
export * from './feedback/issue-extractor.js'
export * from './feedback/trends-discoverer.js'
export * from './schedule/schedule-bridge.js'
export * from './storage/draft-store.js'
export * from './storage/metrics-store.js'
export * from './analytics/metrics-comparison.js'
export * from './tools/index.js'
