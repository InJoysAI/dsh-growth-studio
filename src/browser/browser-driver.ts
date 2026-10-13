/**
 * Browser Driver coordinating BrowserOS MCP operations for automated pre-filling.
 * Executes safe draft prefilling for WeChat Official Account and Bilibili.
 * @module @deepseek-ai/dsh-ops-manager/browser/browser-driver
 */

import type { PlatformId, DraftPrefillResult } from '../types.js'
import { SessionGuard } from './session-guard.js'

export interface BrowserTaskExecution {
  platform: PlatformId
  targetUrl: string
  fields: Record<string, string>
  uploadFilePath?: string | undefined
  submitButtonSelector?: string | undefined
}

export interface BrowserOsMcpClient {
  callTool: (toolName: string, args: Record<string, unknown>) => Promise<any>
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
    if (this.browserOsClient) {
      try {
        const tabsRes = await this.browserOsClient.callTool('tabs', { action: 'list' }).catch(() => null)
        const tabs = Array.isArray(tabsRes?.tabs) ? tabsRes.tabs : []
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
        return await this.executeBrowserOsWorkflow(task)
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
   */
  private async executeBrowserOsWorkflow(task: BrowserTaskExecution): Promise<DraftPrefillResult> {
    const client = this.browserOsClient!

    // 1. Navigate to target URL
    const navRes = await client.callTool('navigate', { url: task.targetUrl })
    if (navRes?.error) {
      throw new Error(`导航至 ${task.targetUrl} 失败: ${navRes.error}`)
    }

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

    // 2. Snapshot the page to observe interactive elements
    await client.callTool('snapshot', {})

    // 3. Fill text fields (title, body, tags, description)
    let anyFilled = false
    for (const [fieldName, val] of Object.entries(task.fields)) {
      if (!val) continue
      try {
        const actRes = await client.callTool('act', {
          kind: 'fill',
          selector: `[name="${fieldName}"], [placeholder*="${fieldName}"], #${fieldName}`,
          value: val,
        })
        if (!actRes?.error) anyFilled = true
      } catch {
        // continue
      }
    }

    // 4. If uploadFilePath is specified, trigger upload
    if (task.uploadFilePath) {
      const uploadRes = await client.callTool('upload', {
        path: task.uploadFilePath,
      })
      if (uploadRes?.error) {
        throw new Error(`附件上传失败: ${uploadRes.error}`)
      }
    }

    // 5. Click "Save Draft" button (NEVER click Publish!)
    const draftButtonSelector =
      task.submitButtonSelector ??
      'button:has-text("保存为草稿"), button:has-text("保存草稿"), .save-draft-btn'
    const clickRes = await client.callTool('act', {
      kind: 'click',
      selector: draftButtonSelector,
    })

    if (clickRes?.error && !anyFilled) {
      throw new Error(`无法定位并点击“保存草稿”按钮: ${clickRes.error}`)
    }

    return {
      platform: task.platform,
      success: true,
      draftId: `draft_${Date.now()}_${task.platform}`,
      draftUrl: task.targetUrl,
      message: '物料已成功填入平台草稿箱，请在创作者中心人工核对',
    }
  }
}
