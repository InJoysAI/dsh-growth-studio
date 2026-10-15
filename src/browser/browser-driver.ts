/**
 * Browser Driver coordinating BrowserOS MCP operations for automated pre-filling.
 * Executes safe draft prefilling for WeChat Official Account and Bilibili.
 * @module @deepseek-ai/dsh-ops-manager/browser/browser-driver
 */

import type { PlatformId, DraftPrefillResult } from '../types.js'
import { SessionGuard } from './session-guard.js'
import { parseTabs } from './browseros-ops.js'
import { extractToolText } from './browseros-bridge.js'

export interface BrowserTaskExecution {
  platform: PlatformId
  targetUrl: string
  fields: Record<string, string>
  requiredFields?: string[]
  uploadFilePath?: string | undefined
  submitButtonSelector?: string | undefined
}

export interface BrowserOsMcpClient {
  callTool: (toolName: string, args?: Record<string, unknown>) => Promise<any>
  /** Raw MCP tool names this client can reach, when the source can report them. */
  availableTools?: readonly string[]
}

/** BrowserOS tab as returned by `tabs action=list`. */
export interface BrowserOsTab {
  /** Page id used by every other BrowserOS tool call. */
  page: number
  url?: string
  title?: string
}

/** Result of listing BrowserOS tabs. */
export interface BrowserOsTabListResult {
  tabs: BrowserOsTab[]
  /** Session handle to pass back so the same browser session is reused. */
  session?: string
  /** Set when the listing failed; callers must not treat it as "no tabs". */
  error?: string
}

/**
 * Test whether an MCP tool result denotes failure or error status.
 * Covers { error: ... }, { isError: true }, { ok: false }, and nested result errors.
 */
export function isMcpToolError(res: any): boolean {
  if (!res) return true
  if (res.error) return true
  if (res.isError === true) return true
  if (res.ok === false) return true
  if (res.result?.isError === true) return true
  if (res.result?.error) return true
  return false
}

export interface BrowserDriverOptions {
  /** If true, allows simulated execution when browserOsClient is absent (used strictly for dry-run tests). Defaults to false. */
  allowDryRun?: boolean
}

/**
 * Driver that coordinates BrowserOS automation steps.
 */
export class BrowserDriver {
  private readonly sessionGuard = new SessionGuard()
  private readonly browserOsClient?: BrowserOsMcpClient | undefined
  private readonly allowDryRun: boolean

  constructor(client?: BrowserOsMcpClient, options?: BrowserDriverOptions) {
    this.browserOsClient = client
    this.allowDryRun = options?.allowDryRun ?? false
  }

  /**
   * Plan and execute a draft creation workflow.
   * Safety constraint: Never click official publish; only save to drafts!
   */
  async planPrefillWorkflow(task: BrowserTaskExecution): Promise<DraftPrefillResult> {
    // If a live client is available, check live tab state rather than static URL
    let openTabs: Array<{ page: number; url?: string }> | undefined
    if (this.browserOsClient) {
      try {
        const tabsRes = await this.browserOsClient.callTool('tabs', { action: 'list' }).catch(() => null)
        // BrowserOS may answer with a JSON array or a `[n] <url>` text listing.
        openTabs = parseTabs(extractToolText(tabsRes))
        const tabs = openTabs
          .filter((tab): tab is { page: number; url: string } => typeof tab.url === 'string')
          .map(tab => ({ url: tab.url }))
        const statuses = this.sessionGuard.checkBrowserSessions(
          [{ id: task.platform, name: task.platform, kind: 'article', draftEditorUrl: task.targetUrl }],
          tabs,
        )
        const currentStatus = statuses[0]
        if (currentStatus && (currentStatus.state === 'needs_login' || currentStatus.state === 'no_publish_permission')) {
          return {
            platform: task.platform,
            success: false,
            requiresUserAction: true,
            draftUrl: task.targetUrl,
            message: currentStatus.message || '需要在浏览器中先完成登录授权',
          }
        }
      } catch {
        // Fall back to evaluateState on targetUrl
      }
    }

    // Execute via live BrowserOS MCP if connected
    if (this.browserOsClient) {
      try {
        return await this.executeBrowserOsWorkflow(task, openTabs)
      } catch (err: any) {
        return {
          platform: task.platform,
          success: false,
          draftUrl: task.targetUrl,
          message: `BrowserOS 执行失败: ${err?.message || '未知异常'}`,
          requiresUserAction: true,
        }
      }
    }

    // If dry-run is explicitly requested in options
    if (this.allowDryRun) {
      const generatedDraftId = `draft_${Date.now()}_${task.platform}`
      return {
        platform: task.platform,
        success: true,
        draftId: generatedDraftId,
        draftUrl: task.targetUrl,
        message: '[Dry-Run] 已模拟将物料推送到平台草稿箱，请在浏览器中核对预览',
      }
    }

    // Disconnected and no dry-run flag -> explicit failure!
    return {
      platform: task.platform,
      success: false,
      draftUrl: task.targetUrl,
      message: 'BrowserOS 驱动未连接，无法执行真实预填。请确保 BrowserOS MCP 运行正常。',
      requiresUserAction: true,
    }
  }

  /**
   * Orchestrate BrowserOS MCP tool actions: navigate, snapshot, and act.
   *
   * BrowserOS requires a `page` id on every navigation, so the tab that already
   * holds the platform session is reused instead of opening a new one (a fresh
   * tab starts unauthenticated on most creator backends). `openTabs` carries the
   * listing the caller already fetched, so tabs are queried only once.
   */
  private async executeBrowserOsWorkflow(
    task: BrowserTaskExecution,
    openTabs?: Array<{ page: number; url?: string }>,
  ): Promise<DraftPrefillResult> {
    const client = this.browserOsClient!

    // 1. Reuse an existing tab for the target host when one is open.
    let page: number | undefined
    let targetUrl = task.targetUrl
    try {
      const host = new URL(task.targetUrl).hostname
      const tabs = openTabs ?? parseTabs(extractToolText(await client.callTool('tabs', { action: 'list' })))
      const existing = tabs.find(tab => {
        if (!tab.url) return false
        try {
          return new URL(tab.url).hostname === host
        } catch {
          return false
        }
      })
      if (typeof existing?.page === 'number') page = existing.page
      if (existing?.url) targetUrl = existing.url
    } catch {
      // Tab discovery is best-effort; navigation below still works.
    }

    // 2. Navigate the resolved tab (or ask BrowserOS for a fresh one).
    const navArgs: Record<string, unknown> = page !== undefined ? { page } : { url: targetUrl }
    const navRes = await client.callTool('navigate', navArgs)
    if (isMcpToolError(navRes)) {
      const errDetail =
        navRes?.error?.message ??
        navRes?.error ??
        navRes?.message ??
        navRes?.result?.error ??
        '导航执行失败或被拒绝'
      throw new Error(`导航至 ${targetUrl} 失败: ${errDetail}`)
    }

    const liveUrl = typeof navRes?.url === 'string' && navRes.url ? navRes.url : targetUrl
    if (typeof navRes?.url === 'string') {
      const liveCheck = this.sessionGuard.evaluateState(task.platform, navRes.url)
      if (liveCheck.state === 'needs_login' || liveCheck.state === 'no_publish_permission') {
        return {
          platform: task.platform,
          success: false,
          requiresUserAction: true,
          draftUrl: navRes.url,
          message: liveCheck.guidanceMessage ?? '页面重定向至登录或权限受限页',
        }
      }
    }

    // 3. Snapshot the page to observe interactive elements
    const snapshotArgs: Record<string, unknown> = page !== undefined ? { page } : {}
    const snapRes = await client.callTool('snapshot', snapshotArgs)
    if (isMcpToolError(snapRes)) {
      throw new Error(`页面结构提取失败 (snapshot): ${snapRes?.error ?? snapRes?.message ?? '工具执行错误'}`)
    }

    // 4. Fill text fields (title, body, tags, description)
    // Determine required fields: explicitly specified or default essential fields (title, content, body, description)
    const requiredFieldKeys = new Set(
      task.requiredFields ?? [
        ...(task.fields.title ? ['title'] : []),
        ...(task.fields.content ? ['content'] : []),
        ...(task.fields.body ? ['body'] : []),
        ...(task.fields.description && !task.fields.content && !task.fields.body ? ['description'] : []),
      ],
    )

    const filledFields = new Set<string>()
    const fillErrors: Record<string, string> = {}

    for (const [fieldName, val] of Object.entries(task.fields)) {
      if (!val) continue
      try {
        const actRes = await client.callTool('act', {
          ...(page !== undefined ? { page } : {}),
          kind: 'fill',
          selector: `[name="${fieldName}"], [placeholder*="${fieldName}"], #${fieldName}`,
          value: val,
        })
        if (!isMcpToolError(actRes)) {
          filledFields.add(fieldName)
        } else {
          fillErrors[fieldName] = String(
            actRes?.error?.message ?? actRes?.error ?? actRes?.message ?? 'fill 错误',
          )
        }
      } catch (err: any) {
        fillErrors[fieldName] = String(err?.message ?? '异常')
      }
    }

    // Validate required fields: every required field provided in task.fields must be filled
    const missingRequired: string[] = []
    for (const reqKey of requiredFieldKeys) {
      if (!filledFields.has(reqKey)) {
        missingRequired.push(`${reqKey}: ${fillErrors[reqKey] ?? '未填入或未找到输入框'}`)
      }
    }

    if (missingRequired.length > 0) {
      throw new Error(`必要字段填入失败 (${missingRequired.join('; ')})`)
    }

    if (filledFields.size === 0) {
      const errList = Object.entries(fillErrors).map(([k, v]) => `${k}: ${v}`).join('; ')
      throw new Error(`所有物料字段填入均失败 (${errList || '未能匹配任何输入框'})`)
    }

    // 5. If uploadFilePath is specified, trigger upload
    if (task.uploadFilePath) {
      const uploadRes = await client.callTool('upload', {
        ...(page !== undefined ? { page } : {}),
        path: task.uploadFilePath,
      })
      if (isMcpToolError(uploadRes)) {
        throw new Error(`附件上传失败: ${uploadRes?.error ?? uploadRes?.message ?? 'upload 执行错误'}`)
      }
    }

    // 6. Click "Save Draft" button (NEVER click Publish!)
    const draftButtonSelector =
      task.submitButtonSelector ??
      'button:has-text("保存为草稿"), button:has-text("保存草稿"), .save-draft-btn'
    const clickRes = await client.callTool('act', {
      ...(page !== undefined ? { page } : {}),
      kind: 'click',
      selector: draftButtonSelector,
    })

    if (isMcpToolError(clickRes)) {
      throw new Error(`无法定位或点击“保存草稿”按钮: ${clickRes?.error ?? clickRes?.message ?? '按钮未响应或被拒绝'}`)
    }

    // Extract real remote draftId if returned by the platform, otherwise omit instead of generating fake local ID
    const remoteDraftId = clickRes?.draftId ?? clickRes?.result?.draftId ?? undefined

    return {
      platform: task.platform,
      success: true,
      draftId: remoteDraftId,
      draftUrl: liveUrl,
      message: '物料已成功填入平台草稿箱，请在创作者中心人工核对',
    }
  }
}
