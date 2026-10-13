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
import { registerOpsRpc } from './ops-rpc.js'
import { createOpsTools } from './tools/index.js'

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
    token: z.string().default('SP4YowBGMpPJKiW1bUu2gfprMjL_BjqsX18JvV_9v9Y'),
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
  const adapters = new AdapterRegistry()
  const draftStore = new DraftStore(ctx)

  ctx.inject(['connection'], (connectionCtx) => {
    registerOpsRpc(connectionCtx, configStore, injoys, adapters, draftStore)
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
      'Use `ops_fetch_metrics` to collect creator metrics across channels and sync to Injoys metrics spreadsheets.',
      'Use `ops_generate_review` to calculate viral rates and output weekly/monthly ops reviews into Injoys documents.',
      'Use `ops_fetch_comments` to crawl audience comments and questions from video and article channels.',
      'Use `ops_extract_feedback` to cluster comments into bugs/features and update Injoys backlog and FAQ.',
      'Use `ops_discover_trends` to identify high-converting industry topics and viral angles.',
      'Use `ops_setup_schedule` to register recurring ops inspections with the DSH automated tasks system.',
      'Use `ops_draft_launch_kit` to craft Product Hunt launch materials, Twitter/X threads, and timezone schedules for overseas reach.',
    ].join(' '),
  })

  const tools = createOpsTools(injoys, adapters, ctx)
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
export * from './tools/index.js'
