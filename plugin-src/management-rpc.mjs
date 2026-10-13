/**
 * Client RPC helper for invoking host-side Ops Manager management APIs.
 *
 * Uses DSH connection.rpc.call('/api', 'ops', { method, payload }, signal)
 */

const ENDPOINT = 'ops'

/**
 * Call host Ops RPC endpoint.
 *
 * @param {any} connection
 * @param {string} method
 * @param {unknown} payload
 * @param {AbortSignal} [signal]
 */
export function callOpsRpc(connection, method, payload, signal) {
  return connection.rpc.call('/api', ENDPOINT, { method, payload }, signal)
}

/**
 * Unwrap RPC response result.
 * Format is { ok: true, value } or { ok: false, error: { message, code } }
 */
export function unwrapRpcResult(result) {
  if (result?.ok === true) return result.value
  if (result?.ok === false) {
    const error = new Error(result.error?.message || 'Ops 接口请求失败')
    error.code = result.error?.code
    throw error
  }
  return result
}
