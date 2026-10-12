/**
 * Bridge connecting Ops Manager workflows with DeepSeek Harness Schedule.
 * @module @deepseek-ai/dsh-ops-manager/schedule/schedule-bridge
 */

import type { Context } from '@deepseek-ai/cordis'
import type { OpsScheduleAction, OpsScheduleRule } from '../types.js'

declare module '@deepseek-ai/cordis' {
  interface Context {
    schedule?: {
      create(
        sessionId: string,
        request: {
          title: string
          prompt: string
          cron?: { expression: string; time_zone: string }
        },
      ): Promise<{ id: string }>
    }
  }
}

export interface CreateOpsScheduleParams {
  action: OpsScheduleAction
  title?: string | undefined
  cron?: string | undefined
  timeZone?: string | undefined
  prompt?: string | undefined
  sessionId?: string | undefined
}

export class ScheduleBridge {
  private readonly rules = new Map<string, OpsScheduleRule>()

  constructor(private readonly ctx?: Context) {}

  /**
   * Register a recurring operations task into DSH Schedule and local store.
   */
  async registerRecurringTask(params: CreateOpsScheduleParams): Promise<OpsScheduleRule> {
    const timeZone = params.timeZone ?? 'Asia/Shanghai'
    const cron = params.cron ?? '0 9 * * 1' // Default: Every Monday at 9:00 AM

    let defaultTitle = '运营自动化巡检任务'
    let defaultPrompt = '请执行自动化运营巡检流程。'

    if (params.action === 'weekly_review') {
      defaultTitle = '每周运营数据复盘'
      defaultPrompt =
        '【每周运营巡检】请调用 ops_fetch_metrics 采集过去7天公众号、视频号、B站、抖音的运营数据，并调用 ops_generate_review 生成周度运营复盘报告，最后同步至 Injoys 文档。'
    } else if (params.action === 'publish_calendar') {
      defaultTitle = '每周发布排期与草稿生成'
      defaultPrompt =
        '【排期提醒】请结合当前产品重点，调用 ops_plan_calendar 制定下周全渠道发布日历，并为高优先级内容调用 ops_draft_article 与 ops_draft_video_meta 生成物料。'
    } else if (params.action === 'metrics_inspection') {
      defaultTitle = '多渠道数据指标日常巡检'
      defaultPrompt =
        '【数据巡检】请调用 ops_fetch_metrics 与 ops_fetch_comments 检查最新用户评论与转化数据，若有高优先级 BUG 反馈立即调用 ops_extract_feedback 归档。'
    }

    const title = params.title ?? defaultTitle
    const prompt = params.prompt ?? defaultPrompt
    const ruleId = `ops_sched_${Date.now()}`

    const rule: OpsScheduleRule = {
      id: ruleId,
      action: params.action,
      title,
      cron,
      timeZone,
      prompt,
      active: true,
    }

    // Connect to host ctx.schedule if available and sessionId provided
    if (this.ctx?.schedule && params.sessionId) {
      try {
        await this.ctx.schedule.create(params.sessionId, {
          title,
          prompt,
          cron: {
            expression: cron,
            time_zone: timeZone,
          },
        })
      } catch {
        // Continue with local rule registration if host schedule rejects
      }
    }

    this.rules.set(ruleId, rule)
    return rule
  }

  /**
   * List all registered ops schedule rules.
   */
  listRules(): OpsScheduleRule[] {
    return [...this.rules.values()]
  }

  /**
   * Remove an ops schedule rule by ID.
   */
  removeRule(ruleId: string): boolean {
    return this.rules.delete(ruleId)
  }
}
