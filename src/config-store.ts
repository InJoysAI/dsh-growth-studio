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

export interface OpsManagerConfigInput {
  defaultProduct?: string
  reuseHostBrowserProfile?: boolean
  injoys?: {
    endpoint?: string
    token?: string
  }
  autoSyncToInjoys?: boolean
}

export const DEFAULT_OPS_CONFIG: OpsManagerConfig = {
  defaultProduct: 'DeepSeek Harness',
  reuseHostBrowserProfile: true,
  injoys: {
    endpoint: 'http://127.0.0.1:17688/mcp',
    token: 'SP4YowBGMpPJKiW1bUu2gfprMjL_BjqsX18JvV_9v9Y',
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

  private loadFromFile(): void {
    if (!this.configPath || !existsSync(this.configPath)) return
    try {
      const data = JSON.parse(readFileSync(this.configPath, 'utf-8'))
      if (data && typeof data === 'object') {
        if (typeof data.defaultProduct === 'string' && data.defaultProduct.length > 0) {
          this.inMemory.defaultProduct = data.defaultProduct
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
      try {
        mkdirSync(join(this.configPath, '..'), { recursive: true })
        const tmp = `${this.configPath}.tmp`
        writeFileSync(tmp, JSON.stringify(this.inMemory, null, 2), 'utf-8')
        renameSync(tmp, this.configPath)
      } catch {
        // Ignore disk persistence failures
      }
    }
  }
}
