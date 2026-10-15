/**
 * End-to-end check of the live BrowserOS scrape path.
 *
 * Runs the real MetricsCollector against the live BrowserOS MCP server, so the
 * parsers are verified against the actual creator-dashboard text rather than a
 * hand-written fixture. Requires BrowserOS to be running (default
 * http://127.0.0.1:9002/mcp) with the target platforms open and logged in.
 *
 * Usage: node --experimental-strip-types scripts/verify-live-metrics.mts [mcpUrl]
 */

import { MetricsCollector } from '../lib/analytics/metrics-collector.js'
import { BrowserOsSession } from '../lib/browser/browseros-ops.js'
import { extractToolText } from '../lib/browser/browseros-bridge.js'

const MCP_URL = process.argv[2] ?? 'http://127.0.0.1:9002/mcp'
const PLATFORMS = (process.argv[3] ?? 'bilibili,douyin,wechat_channels,wechat_mp').split(',')

/** Minimal MCP client speaking Streamable HTTP directly. */
async function callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  const response = await fetch(MCP_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: Date.now(),
      method: 'tools/call',
      params: { name, arguments: args },
    }),
  })
  const body = await response.text()
  // The response may be plain JSON or an SSE frame whose `data:` line holds it.
  const dataLine = body
    .split('\n')
    .find(line => line.startsWith('data:'))
    ?.slice(5)
    .trim()
  const raw = dataLine && dataLine.length > 0 ? dataLine : body.trim()
  const payload = JSON.parse(raw) as { result?: unknown; error?: unknown }
  if (payload.error) throw new Error(`MCP 错误: ${JSON.stringify(payload.error)}`)
  return payload.result
}

async function main(): Promise<void> {
  console.log(`BrowserOS MCP: ${MCP_URL}`)

  const probe = await callTool('tabs', { action: 'list' })
  console.log('\n--- 已打开的标签页 ---')
  console.log(extractToolText(probe))

  const collector = new MetricsCollector({
    browserOsClient: { callTool },
  })

  const metrics = await collector.fetchPlatformMetrics(
    PLATFORMS as Parameters<MetricsCollector['fetchPlatformMetrics']>[0],
    '7d',
  )

  console.log('\n--- 采集结果 ---')
  for (const m of metrics) {
    const extras: string[] = []
    if (m.followerTotal !== undefined) extras.push(`粉丝总数=${m.followerTotal}`)
    if (m.postCount !== undefined) extras.push(`内容数=${m.postCount}`)
    console.log(
      [
        m.platform.padEnd(16),
        `source=${m.source.padEnd(11)}`,
        `播放/阅读=${String(m.views).padStart(8)}`,
        `点赞=${String(m.likes ?? '-').padStart(6)}`,
        `评论=${String(m.comments ?? '-').padStart(5)}`,
        `分享=${String(m.shares ?? '-').padStart(5)}`,
        `收藏=${String(m.favorites ?? '-').padStart(5)}`,
        `涨粉=${String(m.followerDelta ?? '-').padStart(5)}`,
        extras.join(' '),
        m.note ? `| ${m.note}` : '',
      ].join(' '),
    )
  }

  const live = metrics.filter(m => m.source === 'live')
  const unmeasured = metrics.filter(m => m.source === 'unmeasured')
  console.log(`\n真实采集: ${live.length}/${metrics.length}`)
  if (unmeasured.length > 0) {
    console.log('未采集原因:')
    for (const m of unmeasured) console.log(`  - ${m.platform}: ${m.note ?? '未知'}`)
    process.exitCode = 1
  }
}

main().catch((err: unknown) => {
  console.error('验证失败:', err instanceof Error ? err.message : err)
  process.exitCode = 1
})

// Keep the session import referenced so the shared helpers stay in one place.
void BrowserOsSession
