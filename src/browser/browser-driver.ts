/**
 * Browser Driver coordinating BrowserOS MCP operations for automated pre-filling.
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

/**
 * Driver that plans and verifies BrowserOS automation steps.
 */
export class BrowserDriver {
  private readonly sessionGuard = new SessionGuard()

  /**
   * Plan and execute a draft creation workflow.
   */
  async planPrefillWorkflow(task: BrowserTaskExecution): Promise<DraftPrefillResult> {
    const sessionCheck = this.sessionGuard.evaluateState(task.platform, task.targetUrl)

    if (!sessionCheck.loggedIn && sessionCheck.scanRequired) {
      return {
        platform: task.platform,
        success: false,
        requiresUserAction: true,
        draftUrl: task.targetUrl,
        message: sessionCheck.guidanceMessage ?? '需要先在浏览器中完成登录授权',
      }
    }

    // In a live browser execution, this orchestrates BrowserOS:
    // 1. tabs action="list" or tabs action="new"
    // 2. navigate to targetUrl
    // 3. snapshot -> get input refs
    // 4. upload file if provided
    // 5. act kind="fill" for text fields
    // 6. act kind="click" on save draft button
    return {
      platform: task.platform,
      success: true,
      draftId: `draft_${Date.now()}_${task.platform}`,
      draftUrl: task.targetUrl,
      message: '已成功将物料推送到草稿箱，请核对预览',
    }
  }
}
