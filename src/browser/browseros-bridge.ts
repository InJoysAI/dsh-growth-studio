/**
 * BrowserOS MCP bridge.
 *
 * `dsh-mcp-client` registers every external MCP tool on the ToolRuntime under a
 * stable server-qualified public name `mcp__<serverName>__<rawName>` and never
 * exposes a Cordis service for it. So the only reliable way for this plugin to
 * reach BrowserOS is to look those tools up on `ctx.tools` and forward the call.
 *
 * This module implements that lookup, and degrades to `undefined` (not a fake
 * client) when the server is not registered — the callers already treat that as
 * "BrowserOS unavailable" and report honestly instead of inventing numbers.
 *
 * @module @deepseek-ai/dsh-growth-studio/browser/browseros-bridge
 */

import type { Context } from '@deepseek-ai/cordis'
import type { BrowserOsMcpClient } from './browser-driver.js'

/** Server namespace configured in `dsh-mcp-client` for BrowserOS. */
export const BROWSEROS_SERVER_NAME = 'browseros'

/** Public name prefix of every tool that MCP server contributes. */
const BROWSEROS_TOOL_PREFIX = `mcp__${BROWSEROS_SERVER_NAME}__`

/** Raw tool names this plugin depends on, used for the diagnostic message. */
const EXPECTED_TOOLS = ['tabs', 'navigate', 'snapshot', 'act', 'read', 'grep', 'wait'] as const

/** One resolved BrowserOS tool: the registry definition that can execute. */
interface ResolvedBrowserOsTool {
  /** Raw MCP tool name, e.g. `navigate`. */
  rawName: string
  /** Registry definition exposing `execute(args, exec)`. */
  definition: { execute: (args: unknown, exec: unknown) => Promise<unknown> }
}

/** Outcome of resolving the BrowserOS bridge, carrying a diagnostic either way. */
export interface BrowserOsBridgeResolution {
  client?: BrowserOsMcpClient
  /** Raw tool names found under the `mcp__browseros__` prefix. */
  availableTools: string[]
  /** Why the bridge is unavailable; absent when a client was produced. */
  reason?: string
}

/**
 * Minimal execution context accepted by a ToolRuntime tool body.
 *
 * `dsh-mcp-client`'s executor only reads `exec` for optional image admission,
 * so a bare object with a non-aborted signal is enough for text-only calls.
 */
function createExecContext(): Record<string, unknown> {
  const controller = new AbortController()
  return {
    signal: controller.signal,
    agent: undefined,
    session: undefined,
    toolCallId: `growth-studio-browseros-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  }
}

/**
 * Flatten a ToolRuntime/MCP tool result down to its text payload.
 *
 * `dsh-mcp-client` returns `{ content: [{ type: 'text', text }] }`, and throws
 * when the upstream result is an MCP error. BrowserOS additionally wraps page
 * text in `[UNTRUSTED_PAGE_CONTENT nonce=…]` markers, which callers must treat
 * as data — the marker stays in place and only the outer envelope is stripped.
 */
export function extractToolText(result: unknown): string {
  if (result == null) return ''
  if (typeof result === 'string') return result
  const content = (result as { content?: unknown }).content
  if (Array.isArray(content)) {
    const parts: string[] = []
    for (const block of content) {
      if (block && typeof block === 'object' && (block as { type?: unknown }).type === 'text') {
        const text = (block as { text?: unknown }).text
        if (typeof text === 'string') parts.push(text)
      }
    }
    if (parts.length > 0) return parts.join('\n')
  }
  const structured = (result as { structuredContent?: unknown }).structuredContent
  if (structured != null) {
    try {
      return JSON.stringify(structured)
    } catch {
      return String(structured)
    }
  }
  try {
    return JSON.stringify(result)
  } catch {
    return String(result)
  }
}

/**
 * Strip the BrowserOS `[UNTRUSTED_PAGE_CONTENT …]` envelope, keeping the inner
 * text verbatim. Untrusted content is returned as data; callers parse it with
 * their own extractors and never treat it as instructions.
 */
export function stripUntrustedEnvelope(text: string): string {
  if (!text) return text
  return text
    .replace(/^\s*\[UNTRUSTED_PAGE_CONTENT[^\]]*\]\s*/i, '')
    .replace(/\s*\[END_UNTRUSTED_PAGE_CONTENT[^\]]*\]\s*$/i, '')
    .trim()
}

/**
 * Read the BrowserOS session handle out of a tool result.
 *
 * BrowserOS returns it under `_meta['com.browseros/session']` on every call;
 * passing it back keeps the same browser session and its tab ownership, which
 * matters because a fresh session may not share the logged-in tabs.
 */
export function extractSessionHandle(result: unknown): string | undefined {
  const meta = (result as { _meta?: unknown } | null | undefined)?._meta
  if (!meta || typeof meta !== 'object') return undefined
  const session = (meta as Record<string, unknown>)['com.browseros/session']
  return typeof session === 'string' ? session : undefined
}

/**
 * Resolve the BrowserOS tools registered by `dsh-mcp-client`.
 *
 * Prefers `ctx.tools.view()`, which exposes every visible tool name; falls back
 * to probing `ctx.tools.get()` for the known names when `view` is unavailable.
 */
function resolveBrowserOsTools(ctx: Context | undefined): {
  tools: Map<string, ResolvedBrowserOsTool>
  error?: string
} {
  const tools = new Map<string, ResolvedBrowserOsTool>()
  if (!ctx) return { tools, error: 'plugin context unavailable' }

  const registry = (ctx as unknown as { tools?: unknown }).tools as
    | {
        view?: (scope?: unknown) => { visible?: Map<string, unknown> } | undefined
        get?: (name: string, scope?: unknown) => unknown
      }
    | undefined

  if (!registry) return { tools, error: 'ctx.tools unavailable' }

  const consider = (publicName: string, definition: unknown): void => {
    if (typeof publicName !== 'string' || !publicName.startsWith(BROWSEROS_TOOL_PREFIX)) return
    if (!definition || typeof definition !== 'object') return
    const execute = (definition as { execute?: unknown }).execute
    if (typeof execute !== 'function') return
    tools.set(publicName.slice(BROWSEROS_TOOL_PREFIX.length), {
      rawName: publicName.slice(BROWSEROS_TOOL_PREFIX.length),
      definition: definition as ResolvedBrowserOsTool['definition'],
    })
  }

  if (typeof registry.view === 'function') {
    try {
      const view = registry.view()
      const visible = view?.visible
      if (visible && typeof (visible as Map<string, unknown>).forEach === 'function') {
        ;(visible as Map<string, unknown>).forEach((definition, name) => consider(name, definition))
      } else if (visible && typeof visible === 'object') {
        for (const [name, definition] of Object.entries(visible as unknown as Record<string, unknown>)) {
          consider(name, definition)
        }
      }
      if (tools.size > 0) return { tools }
    } catch {
      // fall through to the probing path
    }
  }

  if (typeof registry.get === 'function') {
    for (const rawName of EXPECTED_TOOLS) {
      try {
        const definition = registry.get(`${BROWSEROS_TOOL_PREFIX}${rawName}`)
        if (definition) consider(`${BROWSEROS_TOOL_PREFIX}${rawName}`, definition)
      } catch {
        // ignore a single failing probe
      }
    }
    if (tools.size > 0) return { tools }
  }

  return { tools, error: 'no mcp__browseros__* tools registered (is dsh-mcp-client configured?)' }
}

/**
 * Build a {@link BrowserOsMcpClient} backed by the registered MCP tools.
 *
 * Returns `undefined` instead of a stub when BrowserOS is not wired up, so
 * callers keep their "unmeasured, not fabricated" behaviour.
 */
export function resolveBrowserOsClient(ctx: Context | undefined): BrowserOsBridgeResolution {
  const { tools, error } = resolveBrowserOsTools(ctx)
  const availableTools = [...tools.keys()].sort()

  if (tools.size === 0) {
    return {
      availableTools,
      reason:
        error ??
        `BrowserOS MCP 未接入：未在工具表中找到 ${BROWSEROS_TOOL_PREFIX}* 工具。` +
          `请在 DSH profile 的 cordis.patch.yml 注册 serverName: ${BROWSEROS_SERVER_NAME} 后重启。`,
    }
  }

  const missing = EXPECTED_TOOLS.filter(name => !tools.has(name))

  const client: BrowserOsMcpClient = {
    /** Raw MCP tool names this bridge can reach, for diagnostics. */
    availableTools,
    async callTool(toolName: string, args: Record<string, unknown> = {}): Promise<unknown> {
      const tool = tools.get(toolName)
      if (!tool) {
        throw new Error(
          `BrowserOS 未提供工具 "${toolName}"（可用: ${availableTools.join(', ')}）`,
        )
      }
      const exec = createExecContext()
      return tool.definition.execute(args, exec)
    },
  }

  return {
    client,
    availableTools,
    reason:
      missing.length > 0
        ? `BrowserOS 已接入，但缺少工具: ${missing.join(', ')}`
        : undefined,
  }
}
