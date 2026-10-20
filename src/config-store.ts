/**
 * Persistent configuration store for Ops Manager.
 * @module @deepseek-ai/dsh-ops-manager/config-store
 */

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'
import type { Context } from '@deepseek-ai/cordis'

export interface OpsManagerConfig {
  /** Default product name for knowledge base matching */
  defaultProduct: string
  /** Generation tone (PRD §5.7 全局运营策略「调性基调」) */
  tone: OpsTone
  /** Local draft storage directory (PRD §5.7). Defaults to $DSH_HOME/growth-studio/drafts/ */
  draftsDir: string
  /** Whether to reuse host local browser profile for BrowserOS sessions */
  reuseHostBrowserProfile: boolean
  /** Injoys MCP connection settings */
  injoys: {
    endpoint: string
    token: string
  }
  /** Whether to automatically sync calendar and review reports into Injoys */
  autoSyncToInjoys?: boolean
}

export type OpsTone = 'technical' | 'viral' | 'concise'

export interface OpsManagerConfigInput {
  defaultProduct?: string
  tone?: OpsTone
  draftsDir?: string
  reuseHostBrowserProfile?: boolean
  injoys?: {
    endpoint?: string
    token?: string
  }
  autoSyncToInjoys?: boolean
}

/**
 * Default local draft directory, resolved lazily against the active DSH home so a
 * custom `DSH_HOME` / profile home is honoured (see {@link resolveDshHome}).
 */
export function defaultDraftsDir(ctx?: Context): string {
  return join(resolveDshHome(ctx), 'growth-studio', 'drafts')
}

/**
 * Default Injoys MCP endpoint.
 *
 * ⛔ No token default: a shared/global token must never be shipped in source
 * (criterion §4 密钥管理). The token is resolved only from the user's own
 * configuration (config UI / `$DSH_HOME/ops-manager/config.json`) or the
 * `INJOYS_MCP_TOKEN` environment variable; otherwise it stays empty and the
 * caller must surface an "unconfigured" state instead of pretending to be ready.
 */
export const DEFAULT_OPS_CONFIG: OpsManagerConfig = {
  defaultProduct: 'DeepSeek Harness',
  tone: 'technical',
  draftsDir: '',
  reuseHostBrowserProfile: true,
  injoys: {
    endpoint: 'http://127.0.0.1:17688/mcp',
    token: '',
  },
  autoSyncToInjoys: true,
}

export function resolveDshHome(ctx?: Context): string {
  const profileContext = ctx?.get ? ctx.get("profileContext", false) : (ctx as any)?.profileContext
  const profileHome = profileContext?.home
  if (typeof profileHome === 'string' && profileHome.length > 0) return profileHome
  if (process.env.DSH_HOME && process.env.DSH_HOME.trim().length > 0) return process.env.DSH_HOME.trim()
  return join(homedir(), '.dsh')
}

export class ConfigStore {
  private inMemory: OpsManagerConfig
  private readonly configPath?: string

  constructor(ctx?: Context, initialConfig?: OpsManagerConfigInput) {
    this.inMemory = {
      defaultProduct: initialConfig?.defaultProduct ?? DEFAULT_OPS_CONFIG.defaultProduct,
      tone: initialConfig?.tone ?? DEFAULT_OPS_CONFIG.tone,
      draftsDir: initialConfig?.draftsDir ?? defaultDraftsDir(ctx),
      reuseHostBrowserProfile:
        initialConfig?.reuseHostBrowserProfile ?? DEFAULT_OPS_CONFIG.reuseHostBrowserProfile,
      injoys: {
        endpoint:
          initialConfig?.injoys?.endpoint ??
          process.env.INJOYS_MCP_ENDPOINT ??
          DEFAULT_OPS_CONFIG.injoys.endpoint,
        token:
          initialConfig?.injoys?.token ??
          process.env.INJOYS_MCP_TOKEN ??
          DEFAULT_OPS_CONFIG.injoys.token,
      },
      autoSyncToInjoys: initialConfig?.autoSyncToInjoys ?? DEFAULT_OPS_CONFIG.autoSyncToInjoys,
    }

    try {
      const home = resolveDshHome(ctx)
      this.configPath = join(home, 'ops-manager', 'config.json')
      this.loadFromFile()
    } catch {
      // Fallback to in-memory config
    }
  }

  load(): OpsManagerConfig {
    return {
      ...this.inMemory,
      injoys: { ...this.inMemory.injoys },
    }
  }

  /**
   * Directory holding `config.json`, for callers that must report WHERE a save failed.
   *
   * Exposed instead of letting callers re-resolve `resolveDshHome(ctx)`: the RPC layer
   * receives a different context object than the one this store was built with, so a
   * second resolution could disagree with `configPath` and misreport `details.dir`.
   */
  getConfigDir(): string | undefined {
    if (!this.configPath) return undefined
    return join(this.configPath, '..')
  }

  private loadFromFile(): void {
    if (!this.configPath || !existsSync(this.configPath)) return
    try {
      const data = JSON.parse(readFileSync(this.configPath, 'utf-8'))
      if (data && typeof data === 'object') {
        if (typeof data.defaultProduct === 'string' && data.defaultProduct.length > 0) {
          this.inMemory.defaultProduct = data.defaultProduct
        }
        if (data.tone === 'technical' || data.tone === 'viral' || data.tone === 'concise') {
          this.inMemory.tone = data.tone
        }
        if (typeof data.draftsDir === 'string' && data.draftsDir.length > 0) {
          this.inMemory.draftsDir = data.draftsDir
        }
        if (typeof data.reuseHostBrowserProfile === 'boolean') {
          this.inMemory.reuseHostBrowserProfile = data.reuseHostBrowserProfile
        }
        if (data.injoys && typeof data.injoys === 'object') {
          if (typeof data.injoys.endpoint === 'string' && data.injoys.endpoint.length > 0) {
            this.inMemory.injoys.endpoint = data.injoys.endpoint
          }
          if (typeof data.injoys.token === 'string' && data.injoys.token.length > 0) {
            this.inMemory.injoys.token = data.injoys.token
          }
        }
        if (typeof data.autoSyncToInjoys === 'boolean') {
          this.inMemory.autoSyncToInjoys = data.autoSyncToInjoys
        }
      }
    } catch {
      // Ignore parse failure and keep current
    }
  }

  async save(newConfig: Partial<OpsManagerConfig>): Promise<void> {
    if (typeof newConfig.defaultProduct === 'string' && newConfig.defaultProduct.length > 0) {
      this.inMemory.defaultProduct = newConfig.defaultProduct
    }
    if (newConfig.tone === 'technical' || newConfig.tone === 'viral' || newConfig.tone === 'concise') {
      this.inMemory.tone = newConfig.tone
    }
    if (typeof newConfig.draftsDir === 'string' && newConfig.draftsDir.length > 0) {
      this.inMemory.draftsDir = newConfig.draftsDir
    }
    if (typeof newConfig.reuseHostBrowserProfile === 'boolean') {
      this.inMemory.reuseHostBrowserProfile = newConfig.reuseHostBrowserProfile
    }
    if (newConfig.injoys && typeof newConfig.injoys === 'object') {
      if (typeof newConfig.injoys.endpoint === 'string' && newConfig.injoys.endpoint.length > 0) {
        this.inMemory.injoys.endpoint = newConfig.injoys.endpoint
      }
      if (typeof newConfig.injoys.token === 'string' && newConfig.injoys.token.length > 0) {
        this.inMemory.injoys.token = newConfig.injoys.token
      }
    }
    if (typeof newConfig.autoSyncToInjoys === 'boolean') {
      this.inMemory.autoSyncToInjoys = newConfig.autoSyncToInjoys
    }

    if (this.configPath) {
      // Disk persistence failures must surface: `config.save` reports them as
      // `drafts/storage-unavailable` instead of silently claiming success.
      mkdirSync(join(this.configPath, '..'), { recursive: true })
      const tmp = `${this.configPath}.tmp`
      writeFileSync(tmp, JSON.stringify(this.inMemory, null, 2), 'utf-8')
      renameSync(tmp, this.configPath)
    }
  }
}
