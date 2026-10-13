/**
 * Host-side RPC handler for Ops Manager settings page.
 * @module @deepseek-ai/dsh-ops-manager/ops-rpc
 */

import type { Context } from '@deepseek-ai/cordis'
import type { ConfigStore } from './config-store.js'
import { InjoysClient } from './injoys/client.js'
import type { AdapterRegistry } from './adapters/registry.js'
import { SessionGuard } from './browser/session-guard.js'

export const OPS_ENDPOINT = 'ops'
export const OPS_API_PATH = '/api/ops'

function reply(rpcId: string, result: unknown): Response {
  return new Response(
    JSON.stringify({
      type: 'server-response',
      rpcId,
      result,
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    },
  )
}

/**
 * Register Ops RPC handlers on the DSH connection service.
 */
export function registerOpsRpc(
  ctx: Context,
  configStore: ConfigStore,
  injoys: InjoysClient,
  adapters: AdapterRegistry,
): void {
  const connection = (ctx as any).connection
  if (!connection?.fetch?.register) return

  const sessionGuard = new SessionGuard()

  connection.fetch.register({
    path: OPS_API_PATH,
    methods: ['POST'],
    requestBody: 'buffered' as const,
    async fetch(request: Request): Promise<Response> {
      if (request.method !== 'POST') {
        return new Response('method not allowed', { status: 405 })
      }
      const contentType = request.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase()
      if (contentType !== 'application/json') {
        return new Response('content type must be application/json', { status: 415 })
      }

      let message: Record<string, unknown>
      try {
        message = (await request.json()) as Record<string, unknown>
      } catch {
        return new Response('body is not JSON', { status: 400 })
      }

      const rpcId = typeof message.rpcId === 'string' ? message.rpcId : 'invalid-request'
      const call = message.payload as Record<string, unknown> | undefined
      if (
        message.type !== 'client-request' ||
        typeof message.rpcId !== 'string' ||
        message.method !== OPS_ENDPOINT ||
        !call ||
        typeof call.method !== 'string' ||
        !Object.prototype.hasOwnProperty.call(call, 'payload')
      ) {
        return reply(rpcId, {
          ok: false,
          error: { code: 'ops/bad-request', message: 'Invalid Ops management request.' },
        })
      }

      try {
        const method = call.method as string
        const payload = (call.payload ?? {}) as Record<string, unknown>
        let result: unknown

        switch (method) {
          case 'config.get': {
            const current = configStore.load()
            result = {
              ok: true,
              value: {
                ...current,
                hasEnvEndpoint: Boolean(process.env.INJOYS_MCP_ENDPOINT),
                hasEnvToken: Boolean(process.env.INJOYS_MCP_TOKEN),
              },
            }
            break
          }

          case 'config.save': {
            const toSave = payload as any
            await configStore.save(toSave)
            if (toSave.injoys) {
              injoys.updateConfig({
                endpoint: toSave.injoys.endpoint,
                token: toSave.injoys.token,
              })
            }
            result = {
              ok: true,
              value: {
                success: true,
                config: configStore.load(),
              },
            }
            break
          }

          case 'injoys.test': {
            const endpoint =
              (payload.endpoint as string | undefined) || configStore.load().injoys.endpoint
            const token =
              (payload.token as string | undefined) || configStore.load().injoys.token

            const testClient = new InjoysClient({ endpoint, token })
            const testRes = await testClient.testConnection()

            result = {
              ok: true,
              value: {
                connected: testRes.ok,
                latencyMs: testRes.latencyMs,
                message: testRes.message,
              },
            }
            break
          }

          case 'browser.sessions': {
            const statuses = await sessionGuard.checkAllRealSessions(adapters.list())
            result = {
              ok: true,
              value: {
                statuses,
                reuseHostBrowserProfile: configStore.load().reuseHostBrowserProfile,
              },
            }
            break
          }

          default: {
            result = {
              ok: false,
              error: { code: 'ops/unknown-method', message: `Unknown Ops RPC method: ${method}` },
            }
          }
        }

        return reply(rpcId, result)
      } catch (error: any) {
        return reply(rpcId, {
          ok: false,
          error: { code: 'ops/handler-failed', message: error?.message ?? String(error) },
        })
      }
    },
  })
}
