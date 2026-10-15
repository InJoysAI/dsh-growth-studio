/**
 * High-level BrowserOS operations used by the metrics collector.
 *
 * Keeps the BrowserOS calling conventions in one place: every tool call needs a
 * `page` id, results carry a `com.browseros/session` handle that must be passed
 * back, and page text arrives wrapped in an untrusted-content envelope.
 *
 * @module @deepseek-ai/dsh-growth-studio/browser/browseros-ops
 */

import { extractSessionHandle, extractToolText, stripUntrustedEnvelope } from './browseros-bridge.js'
import type { BrowserOsMcpClient, BrowserOsTabListResult } from './browser-driver.js'

/** Current BrowserOS session handle, refreshed after every call. */
export class BrowserOsSession {
  private handle: string | undefined

  constructor(private readonly client: BrowserOsMcpClient) {}

  /** Remember the session handle a result reported, if any. */
  adopt(result: unknown): void {
    const next = extractSessionHandle(result)
    if (next) this.handle = next
  }

  /** Session handle to attach to the next call, if one is known. */
  get args(): Record<string, unknown> {
    return this.handle ? { session: this.handle } : {}
  }

  /**
   * List open tabs, resolving each entry's page id and url.
   *
   * BrowserOS returns either a JSON array or a human-readable `[n] <url>` list
   * depending on the version, so both shapes are accepted.
   */
  async listTabs(): Promise<BrowserOsTabListResult> {
    const raw = await this.client.callTool('tabs', { action: 'list', ...this.args })
    this.adopt(raw)
    const tabs = parseTabs(extractToolText(raw))
    return { tabs, session: this.handle }
  }

  /** Find the first tab whose URL belongs to `hostname`. */
  async findTabByHost(hostname: string): Promise<{ page: number; url: string } | undefined> {
    const { tabs, error } = await this.listTabs()
    if (error) return undefined
    const match = tabs.find(tab => {
      if (!tab.url) return false
      try {
        return new URL(tab.url).hostname === hostname
      } catch {
        return tab.url.includes(hostname)
      }
    })
    return match?.url ? { page: match.page, url: match.url } : undefined
  }

  /**
   * Navigate an existing tab and return the resulting page text.
   *
   * `page` is mandatory for BrowserOS's `navigate`; navigating a tab that is
   * already logged in preserves that platform session, which a brand-new tab
   * would not have.
   */
  async navigate(page: number, url: string): Promise<string> {
    const raw = await this.client.callTool('navigate', { page, url, ...this.args })
    this.adopt(raw)
    return stripUntrustedEnvelope(extractToolText(raw))
  }

  /**
   * Read the visible text of a tab, retrying while the page is still loading.
   *
   * A dashboard's data block renders well after its shell, so a short read is a
   * loading frame rather than data. Reads are retried until the text stops
   * growing, and the longest result wins.
   */
  async read(page: number, minLength = 600, attempts = 5): Promise<string> {
    let best = ''
    let previous = -1
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      const raw = await this.client.callTool('read', { page, ...this.args })
      this.adopt(raw)
      const text = stripUntrustedEnvelope(extractToolText(raw))
      if (text.length > best.length) best = text
      // Stop once the page has settled: enough content, or nothing new arrived.
      if (best.length >= minLength) return best
      if (best.length > 0 && best.length === previous) return best
      previous = best.length
      await this.wait(page, 1500)
    }
    return best
  }

  /**
   * Pause for `ms` on a page.
   *
   * BrowserOS's `wait` requires a `page` and expresses a timed pause as
   * `{ for: 'time', value: <ms> }` — a bare `ms` key is rejected.
   */
  async wait(page: number, ms: number): Promise<void> {
    try {
      const raw = await this.client.callTool('wait', { page, for: 'time', value: ms, ...this.args })
      this.adopt(raw)
    } catch {
      // A failed wait must not abort a collection that already has data.
    }
  }

  /**
   * Navigate a tab to `url` and read the page once it has settled.
   *
   * `read` retries internally until the text stops growing, so the returned text
   * is the fullest version the page offered — including a login page, which
   * callers detect themselves rather than having it masked here.
   */
  async openAndRead(page: number, url: string, settleMs = 2000): Promise<string> {
    await this.navigate(page, url)
    await this.wait(page, settleMs)
    return this.read(page)
  }
}

/** Parse a BrowserOS tab listing in either supported shape. */
export function parseTabs(text: string): BrowserOsTabListResult['tabs'] {
  if (!text) return []
  const trimmed = text.trim()
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed)
      const rows: unknown[] = Array.isArray(parsed)
        ? parsed
        : Array.isArray((parsed as { tabs?: unknown }).tabs)
          ? ((parsed as { tabs: unknown[] }).tabs as unknown[])
          : []
      const tabs: BrowserOsTabListResult['tabs'] = []
      for (const row of rows) {
        if (!row || typeof row !== 'object') continue
        const record = row as Record<string, unknown>
        const page = typeof record.page === 'number' ? record.page : undefined
        if (page === undefined) continue
        tabs.push({
          page,
          url: typeof record.url === 'string' ? record.url : undefined,
          title: typeof record.title === 'string' ? record.title : undefined,
        })
      }
      if (tabs.length > 0) return tabs
    } catch {
      // fall through to the text form
    }
  }

  // Text form: lines like `[3] https://example.com/path (Page title)`
  const tabs: BrowserOsTabListResult['tabs'] = []
  for (const line of trimmed.split('\n')) {
    const match = line.match(/^\s*\[(\d+)\]\s+(\S+)/)
    if (!match) continue
    const page = Number(match[1])
    const url = match[2]
    if (!Number.isFinite(page) || !url) continue
    tabs.push({ page, url })
  }
  return tabs
}
