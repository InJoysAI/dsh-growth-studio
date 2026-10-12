/**
 * User Feedback & Issue Extractor.
 * Clustered into Bug Reports, Feature Requests, and Knowledge Base FAQs.
 * @module @deepseek-ai/dsh-ops-manager/feedback/issue-extractor
 */

import type { CommentItem, UserFeedbackItem } from '../types.js'
import type { InjoysClient } from '../injoys/client.js'

export class IssueExtractor {
  constructor(private readonly injoys: InjoysClient) {}

  /**
   * Parse and cluster comments into structured feedback items.
   */
  extractFeedback(comments: CommentItem[], rawText?: string): UserFeedbackItem[] {
    const feedbackList: UserFeedbackItem[] = []

    // 1. Process structured comments
    for (const c of comments) {
      const item = this.categorizeComment(c)
      feedbackList.push(item)
    }

    // 2. Process raw text if provided
    if (rawText && rawText.trim().length > 0) {
      const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean)
      for (const [i, line] of lines.entries()) {
        feedbackList.push({
          id: `fb_custom_${Date.now()}_${i + 1}`,
          platform: 'wechat_mp',
          category: this.detectCategory(line),
          rawComment: line,
          summary: line.slice(0, 60),
          priority: this.detectPriority(line),
        })
      }
    }

    return feedbackList
  }

  /**
   * Save extracted items into Injoys Requirements Sheet & update KB FAQ.
   */
  async syncToInjoys(feedback: UserFeedbackItem[]): Promise<{
    sheetSynced: boolean
    faqsUpdated: number
  }> {
    const sheetSynced = await this.injoys.recordFeedbackToSheet(feedback)

    let faqsUpdated = 0
    for (const item of feedback) {
      if (item.category === 'question') {
        const ok = await this.injoys.updateKnowledgeFaq({
          question: item.summary,
          answer: `基于社群高频疑问整理：针对“${item.rawComment}”已纳入支持规划。`,
        })
        if (ok) faqsUpdated++
      }
    }

    return { sheetSynced, faqsUpdated }
  }

  private categorizeComment(c: CommentItem): UserFeedbackItem {
    const text = c.content
    const category = this.detectCategory(text)
    const priority = this.detectPriority(text)

    let summary = text
    if (category === 'bug') {
      summary = `[BUG] ${text.replace(/【BUG.*?】/g, '').trim().slice(0, 50)}`
    } else if (category === 'feature_request') {
      summary = `[需求] ${text.slice(0, 50)}`
    } else if (category === 'question') {
      summary = `[疑问] ${text.slice(0, 50)}`
    }

    return {
      id: `fb_${c.id}`,
      platform: c.platform,
      category,
      rawComment: c.content,
      summary,
      priority,
    }
  }

  private detectCategory(text: string): UserFeedbackItem['category'] {
    if (text.includes('BUG') || text.includes('报错') || text.includes('卡住') || text.includes('失败')) {
      return 'bug'
    }
    if (text.includes('支持吗') || text.includes('希望能加') || text.includes('建议') || text.includes('导出')) {
      return 'feature_request'
    }
    if (text.includes('请问') || text.includes('怎么') || text.includes('求指路') || text.includes('原理')) {
      return 'question'
    }
    if (text.includes('太强了') || text.includes('支持') || text.includes('收藏') || text.includes('点赞') || text.includes('香')) {
      return 'praise'
    }
    return 'complaint'
  }

  private detectPriority(text: string): UserFeedbackItem['priority'] {
    if (text.includes('BUG') || text.includes('报错') || text.includes('卡住') || text.includes('急需')) {
      return 'high'
    }
    if (text.includes('希望能') || text.includes('支持') || text.includes('教程')) {
      return 'medium'
    }
    return 'low'
  }
}
