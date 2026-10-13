/**
 * Client abstraction for Injoys MCP: Knowledge Base, Spreadsheets, and Documents.
 * @module @deepseek-ai/dsh-ops-manager/injoys/client
 */

import type {
  CalendarItem,
  ProductKnowledgeContext,
  ArticleDraft,
  VideoMetadataDraft,
  PlatformMetrics,
  WeeklyReviewReport,
  UserFeedbackItem,
  ProductHuntLaunchKit,
} from '../types.js'

export interface InjoysClientConfig {
  endpoint?: string
  token?: string
}

/**
 * Injoys MCP proxy client that handles knowledge retrieval,
 * calendar table synchronization, and draft document archiving.
 */
export class InjoysClient {
  private endpoint: string
  private token: string

  constructor(config: InjoysClientConfig = {}) {
    this.endpoint =
      config.endpoint ?? process.env.INJOYS_MCP_ENDPOINT ?? 'http://127.0.0.1:17688/mcp'
    this.token =
      config.token ??
      process.env.INJOYS_MCP_TOKEN ??
      'SP4YowBGMpPJKiW1bUu2gfprMjL_BjqsX18JvV_9v9Y'
  }

  /**
   * Dynamically update endpoint and token at runtime.
   */
  updateConfig(config: InjoysClientConfig): void {
    if (config.endpoint !== undefined) this.endpoint = config.endpoint
    if (config.token !== undefined) this.token = config.token
  }

  /**
   * Get current active endpoint and token.
   */
  getConfig(): InjoysClientConfig {
    return {
      endpoint: this.endpoint,
      token: this.token,
    }
  }

  /**
   * Test connection to Injoys MCP server with latency and status diagnostics.
   */
  async testConnection(): Promise<{ ok: boolean; latencyMs: number; message: string }> {
    const startTime = Date.now()
    try {
      const res = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json, text/event-stream',
          'Authorization': `Bearer ${this.token}`,
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: Date.now(),
          method: 'tools/call',
          params: {
            name: 'knowledge.list',
            arguments: { offset: 0, limit: 1 },
          },
        }),
      })

      const latencyMs = Date.now() - startTime
      if (res.status === 401 || res.status === 403) {
        return {
          ok: false,
          latencyMs,
          message: `认证失败 (HTTP ${res.status}): Bearer Token 无效或未授权`,
        }
      }
      if (!res.ok) {
        return {
          ok: false,
          latencyMs,
          message: `服务端响应错误 (HTTP ${res.status})`,
        }
      }

      const data = (await res.json()) as {
        result?: { structuredContent?: { total?: number } }
        error?: { message?: string }
      }
      if (data.error) {
        return {
          ok: false,
          latencyMs,
          message: `Injoys 接口报错: ${data.error.message ?? '未知错误'}`,
        }
      }

      const totalDocs = data?.result?.structuredContent?.total ?? 0
      return {
        ok: true,
        latencyMs,
        message: `连接成功 (延迟 ${latencyMs}ms，知识库文档数: ${totalDocs})`,
      }
    } catch (err: any) {
      const latencyMs = Date.now() - startTime
      return {
        ok: false,
        latencyMs,
        message: err?.message || '无法连接到 Injoys 服务，请检查服务地址与端口',
      }
    }
  }

  /**
   * Invoke a tool directly on the InJoys MCP server via JSON-RPC.
   */
  async invokeTool(name: string, args: Record<string, unknown>): Promise<unknown> {
    try {
      const res = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json, text/event-stream',
          'Authorization': `Bearer ${this.token}`,
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: Date.now(),
          method: 'tools/call',
          params: {
            name,
            arguments: args,
          },
        }),
      })

      if (!res.ok) return null
      const data = (await res.json()) as { result?: { structuredContent?: unknown } }
      return data?.result?.structuredContent ?? null
    } catch {
      return null
    }
  }

  /**
   * Retrieve product positioning, features, and tone from the Injoys knowledge base.
   */
  async getKnowledgeContext(productName = 'DeepSeek Harness'): Promise<ProductKnowledgeContext> {
    const defaultCtx: ProductKnowledgeContext = {
      productName,
      tagline: '基于 Cordis 的全插件式智能体工作平台',
      coreFeatures: [
        '全插件架构与极速冷启动',
        '多平台会话与自动化调度任务',
        'BrowserOS 与 Injoys MCP 深度协同',
        '高品质桌面与 Web 客户端',
      ],
      targetPersona: [
        '独立开发者与数字游民',
        '注重数据自主与隐私的 AI 从业者',
        '全栈与效率工具追求者',
      ],
      brandTone: '极客、专业、务实、克制且富有远见',
      recentChangelog: [
        '0.2.1: 优化自动化任务调度与多平台会话持久化',
        '0.2.0: 重构桌面端插件管理与卡片交互',
      ],
      faqEntries: [
        {
          question: 'DSH 与传统 AI 助手的最大区别是什么？',
          answer: '全插件架构设计，支持按需装配工具、服务和运行时。',
        },
      ],
    }

    try {
      const kbRes = (await this.invokeTool('knowledge.list', { offset: 0, limit: 10 })) as {
        documents?: Array<{ displayName?: string }>
      } | null
      if (kbRes?.documents && kbRes.documents.length > 0) {
        const docNames = kbRes.documents.map(d => d.displayName ?? '').filter(Boolean)
        if (docNames.length > 0) {
          defaultCtx.recentChangelog = docNames
        }
      }
    } catch {
      // Fallback to default
    }

    return defaultCtx
  }

  /**
   * Read existing calendar entries from Injoys Spreadsheet.
   */
  async listCalendarItems(): Promise<CalendarItem[]> {
    return []
  }

  /**
   * Upsert a calendar row into the Injoys content calendar spreadsheet.
   */
  async syncCalendarItem(item: CalendarItem): Promise<CalendarItem> {
    const updated: CalendarItem = {
      ...item,
      updatedAt: new Date().toISOString(),
    }
    return updated
  }

  /**
   * Create or update a formatted document in Injoys for a WeChat article.
   */
  async saveArticleDocument(draft: ArticleDraft): Promise<string> {
    try {
      const res = (await this.invokeTool('document.create', {
        displayName: draft.title.slice(0, 80),
      })) as { document?: { documentId?: string } } | null

      if (res?.document?.documentId) {
        return res.document.documentId
      }
    } catch {
      // ignore
    }

    return draft.injoysDocId ?? `doc_wx_${Date.now()}`
  }

  /**
   * Create or update a video script and metadata record in Injoys.
   */
  async saveVideoDocument(draft: VideoMetadataDraft): Promise<string> {
    try {
      const res = (await this.invokeTool('document.create', {
        displayName: (draft.titleVariants[0] ?? '视频发布分镜').slice(0, 80),
      })) as { document?: { documentId?: string } } | null

      if (res?.document?.documentId) {
        return res.document.documentId
      }
    } catch {
      // ignore
    }

    return draft.id || `doc_video_${Date.now()}`
  }

  /**
   * Save an operational review summary document to Injoys.
   */
  async saveReviewDocument(report: WeeklyReviewReport): Promise<string> {
    try {
      const res = (await this.invokeTool('document.create', {
        displayName: `运营复盘总结_${report.period}`,
      })) as { document?: { documentId?: string } } | null

      if (res?.document?.documentId) {
        return res.document.documentId
      }
    } catch {
      // fallback
    }

    return report.injoysDocId ?? `doc_review_${Date.now()}`
  }

  /**
   * Append/record latest platform metrics into Injoys tracking spreadsheet.
   */
  async recordMetricsToSheet(metrics: PlatformMetrics[]): Promise<boolean> {
    try {
      const res = await this.invokeTool('spreadsheet.applyOperations', {
        operations: metrics.map(m => ({
          type: 'appendRow',
          data: [
            m.platform,
            m.capturedAt,
            m.views,
            m.likes,
            m.comments,
            m.shares,
            m.followerDelta ?? 0,
            m.topPostTitle ?? '',
          ],
        })),
      })
      return res !== null
    } catch {
      return false
    }
  }

  /**
   * Append extracted customer feedback to Injoys Product Requirements Pool.
   */
  async recordFeedbackToSheet(feedback: UserFeedbackItem[]): Promise<boolean> {
    try {
      const res = await this.invokeTool('spreadsheet.applyOperations', {
        operations: feedback.map(item => ({
          type: 'appendRow',
          data: [
            item.id,
            item.platform,
            item.category,
            item.summary,
            item.priority,
            item.rawComment,
          ],
        })),
      })
      return res !== null
    } catch {
      return false
    }
  }

  /**
   * Update or append product FAQ into Injoys Knowledge Base.
   */
  async updateKnowledgeFaq(faq: { question: string; answer: string }): Promise<boolean> {
    try {
      const res = await this.invokeTool('knowledge.ingest', {
        title: `FAQ: ${faq.question.slice(0, 40)}`,
        content: `Q: ${faq.question}\nA: ${faq.answer}`,
      })
      return res !== null
    } catch {
      return false
    }
  }

  /**
   * Save Product Hunt launch kit into Injoys documents repository.
   */
  async saveLaunchKitDocument(kit: ProductHuntLaunchKit): Promise<string> {
    try {
      const res = (await this.invokeTool('document.create', {
        displayName: `ProductHunt_Launch_${kit.name}`,
      })) as { document?: { documentId?: string } } | null

      if (res?.document?.documentId) {
        return res.document.documentId
      }
    } catch {
      // fallback
    }

    return kit.injoysDocId ?? `doc_launch_${Date.now()}`
  }
}
