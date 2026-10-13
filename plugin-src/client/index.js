/**
 * Client entry point for Ops Manager plugin.
 * Injects 'Ops' tab into DSH Desktop Settings and customizes the navigation icon.
 */

import * as React from 'react'
import { callOpsRpc, unwrapRpcResult } from '../management-rpc.mjs'
import { installOpsStyles } from './ops-styles.js'
import { OpsPage } from './ops-page.js'

export const inject = ['slots', 'connection']

const OPS_ICON_SVG = `<svg class="dim-ops-custom-svg" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 5.5h2.5l5-3.5v12l-5-3.5H2a1 1 0 0 1-1-1V6.5a1 1 0 0 1 1-1z"/><path d="M4.5 10.5v2.5a.8.8 0 0 0 .8.8h.4a.8.8 0 0 0 .8-.8v-2.5"/><path d="M12 5.5a3.5 3.5 0 0 1 0 5"/><path d="M13.8 4a5.5 5.5 0 0 1 0 8"/></svg>`

function updateOpsNavIcon() {
  if (typeof document === 'undefined') return
  const labelEl = document.querySelector('.dim-ops-nav-label')
  if (!labelEl) return
  const btn = labelEl.closest('button')
  if (!btn) return
  const existingSvg = btn.querySelector('svg:not(.dim-ops-custom-svg)')
  if (existingSvg) existingSvg.style.display = 'none'
  if (!btn.querySelector('.dim-ops-custom-nav-icon')) {
    const iconSpan = document.createElement('span')
    iconSpan.className = 'dim-ops-custom-nav-icon'
    iconSpan.innerHTML = OPS_ICON_SVG
    btn.insertBefore(iconSpan, btn.firstChild)
  }
}

function startOpsNavIconObserver() {
  if (typeof document === 'undefined') return () => {}
  updateOpsNavIcon()
  const observer = new MutationObserver(() => updateOpsNavIcon())
  observer.observe(document.body, { childList: true, subtree: true })
  return () => observer.disconnect()
}

export function apply(ctx) {
  ctx.effect(() => installOpsStyles(), 'ops: install styles')
  ctx.effect(() => startOpsNavIconObserver(), 'ops: nav icon observer')

  const rpcCall = async (method, payload, signal) => {
    const raw = await callOpsRpc(ctx.connection, method, payload, signal)
    return unwrapRpcResult(raw)
  }

  ctx.slots.inject('settings.section', () =>
    ctx.slots.register(
      {
        name: 'settings.section',
        id: 'ops',
        order: 60,
        label: () => React.createElement('span', { className: 'dim-ops-nav-label' }, 'Ops'),
        inject: () => ({ rpcCall }),
      },
      OpsPage,
    ),
  )
}
