/**
 * Styles for Ops Manager settings page in DeepSeek Harness.
 * Aligns natively with DeepSeek Harness design tokens and theme.
 */

const STYLES = `
.dim-ops-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  background: var(--dsw-alias-bg-layer-1, #f8f9fb);
  color: var(--dsw-alias-label-primary, #1f2329);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
}

.dim-ops-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 16px 24px;
  border-bottom: 1px solid var(--dsw-alias-border-default, #e5e5e5);
  background: var(--dsw-alias-bg-layer-3, #ffffff);
}

.dim-ops-title-group {
  display: flex;
  flex-direction: column;
}

.dim-ops-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  line-height: 22px;
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--dsw-alias-label-primary, #1f2329);
}

.dim-ops-title-badge {
  font-size: 11px;
  font-weight: 500;
  padding: 1px 6px;
  border-radius: 4px;
  background: color-mix(in srgb, #1677ff 12%, transparent);
  color: #1677ff;
}

.dim-ops-desc {
  margin: 3px 0 0 0;
  font-size: 12px;
  line-height: 16px;
  color: var(--dsw-alias-label-tertiary, #8f959e);
}

.dim-ops-header-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.dim-ops-body {
  flex: 1;
  overflow-y: auto;
  padding: 20px 24px;
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.dim-ops-notice {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  border-radius: 8px;
  font-size: 13px;
  line-height: 18px;
  animation: dimOpsFadeIn .2s ease;
}

@keyframes dimOpsFadeIn {
  from { opacity: 0; transform: translateY(-4px); }
  to { opacity: 1; transform: translateY(0); }
}

.dim-ops-notice[data-kind="success"] {
  background: rgb(34 197 94 / 10%);
  border: 1px solid color-mix(in srgb, #22c55e 35%, transparent);
  color: #15803d;
}

.dim-ops-notice[data-kind="error"] {
  background: rgb(239 68 68 / 10%);
  border: 1px solid color-mix(in srgb, #ef4444 35%, transparent);
  color: #b91c1c;
}

.dim-ops-card {
  background: var(--dsw-alias-bg-layer-3, #ffffff);
  border: 1px solid var(--dsw-alias-border-l2, #eef0f3);
  border-radius: 12px;
  padding: 18px 20px;
  box-shadow: 0 1px 3px rgba(31, 35, 41, 0.03);
  transition: border-color .18s ease, box-shadow .18s ease;
}

.dim-ops-card:hover {
  border-color: color-mix(in srgb, #1677ff 24%, var(--dsw-alias-border-l2, #eef0f3));
  box-shadow: 0 4px 12px rgba(31, 35, 41, 0.05);
}

.dim-ops-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--dsw-alias-border-l2, #f0f1f3);
}

.dim-ops-card-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 600;
  color: var(--dsw-alias-label-primary, #1f2329);
}

.dim-ops-card-icon {
  width: 20px;
  height: 20px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  background: rgb(31 35 41 / 5%);
  color: #1677ff;
}

.dim-ops-form-grid {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.dim-ops-form-row {
  display: grid;
  grid-template-columns: 160px 1fr;
  align-items: start;
  gap: 16px;
}

.dim-ops-form-label {
  font-size: 13px;
  font-weight: 500;
  padding-top: 6px;
  color: var(--dsw-alias-label-secondary, #646a73);
}

.dim-ops-form-field {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.dim-ops-input-wrap {
  display: flex;
  align-items: center;
  position: relative;
}

.dim-ops-input {
  width: 100%;
  height: 34px;
  padding: 0 12px;
  font-size: 13px;
  font-family: inherit;
  border: 1px solid var(--dsw-alias-border-l2, #dfe1e5);
  border-radius: 8px;
  background: var(--dsw-alias-bg-layer-3, #ffffff);
  color: var(--dsw-alias-label-primary, #1f2329);
  outline: none;
  transition: border-color .15s ease, box-shadow .15s ease;
}

.dim-ops-input:focus {
  border-color: #1677ff;
  box-shadow: 0 0 0 2px color-mix(in srgb, #1677ff 20%, transparent);
}

.dim-ops-input-btn {
  position: absolute;
  right: 6px;
  height: 24px;
  padding: 0 8px;
  font-size: 11px;
  border: none;
  background: rgb(31 35 41 / 6%);
  border-radius: 4px;
  cursor: pointer;
  color: var(--dsw-alias-label-secondary, #646a73);
}

.dim-ops-input-btn:hover {
  background: rgb(31 35 41 / 10%);
}

.dim-ops-form-hint {
  font-size: 12px;
  line-height: 16px;
  color: var(--dsw-alias-label-tertiary, #8f959e);
}

.dim-ops-tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 4px;
}

.dim-ops-tag {
  font-size: 11px;
  padding: 2px 7px;
  border-radius: 4px;
  background: var(--dsw-alias-bg-layer-2, #f4f5f7);
  color: var(--dsw-alias-label-secondary, #646a73);
  border: 1px solid var(--dsw-alias-border-l2, #eef0f3);
}

.dim-ops-btn {
  height: 32px;
  padding: 0 14px;
  font-size: 13px;
  font-weight: 500;
  border: 1px solid var(--dsw-alias-border-l2, #dfe1e5);
  border-radius: 8px;
  background: var(--dsw-alias-bg-layer-3, #ffffff);
  color: var(--dsw-alias-label-primary, #1f2329);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  transition: all .15s ease;
  white-space: nowrap;
}

.dim-ops-btn:hover:not(:disabled) {
  border-color: color-mix(in srgb, #1677ff 40%, var(--dsw-alias-border-l2, #dfe1e5));
  color: #1677ff;
  background: color-mix(in srgb, #1677ff 4%, var(--dsw-alias-bg-layer-3, #ffffff));
}

.dim-ops-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.dim-ops-btn[data-variant="primary"] {
  background: #1677ff;
  border-color: #1677ff;
  color: #ffffff;
}

.dim-ops-btn[data-variant="primary"]:hover:not(:disabled) {
  background: #0958d9;
  border-color: #0958d9;
  color: #ffffff;
}

.dim-ops-switch-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 8px 0;
}

.dim-ops-switch-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.dim-ops-switch-title {
  font-size: 13px;
  font-weight: 500;
  color: var(--dsw-alias-label-primary, #1f2329);
}

.dim-ops-switch-desc {
  font-size: 12px;
  color: var(--dsw-alias-label-tertiary, #8f959e);
}

/* Toggle Switch */
.dim-ops-toggle {
  position: relative;
  display: inline-block;
  width: 40px;
  height: 22px;
  flex-shrink: 0;
}

.dim-ops-toggle input {
  opacity: 0;
  width: 0;
  height: 0;
}

.dim-ops-toggle-slider {
  position: absolute;
  cursor: pointer;
  top: 0; left: 0; right: 0; bottom: 0;
  background-color: var(--dsw-alias-border-default, #ccc);
  border-radius: 22px;
  transition: .2s;
}

.dim-ops-toggle-slider:before {
  position: absolute;
  content: "";
  height: 16px;
  width: 16px;
  left: 3px;
  bottom: 3px;
  background-color: white;
  border-radius: 50%;
  transition: .2s;
  box-shadow: 0 1px 3px rgba(0,0,0,0.2);
}

.dim-ops-toggle input:checked + .dim-ops-toggle-slider {
  background-color: #1677ff;
}

.dim-ops-toggle input:checked + .dim-ops-toggle-slider:before {
  transform: translateX(18px);
}

/* Platform Status Grid */
.dim-ops-platforms-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 10px;
  margin-top: 10px;
}

.dim-ops-platform-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  border: 1px solid var(--dsw-alias-border-l2, #eef0f3);
  border-radius: 8px;
  background: var(--dsw-alias-bg-layer-2, #fafbfc);
  transition: border-color .15s ease;
}

.dim-ops-platform-item:hover {
  border-color: color-mix(in srgb, #1677ff 30%, var(--dsw-alias-border-l2, #eef0f3));
}

.dim-ops-platform-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--dsw-alias-label-primary, #1f2329);
  display: flex;
  align-items: center;
  gap: 6px;
}

.dim-ops-platform-actions {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.dim-ops-login-link {
  font-size: 11px;
  color: #1677ff;
  text-decoration: none;
  padding: 2px 7px;
  border-radius: 4px;
  background: color-mix(in srgb, #1677ff 10%, transparent);
  transition: all .15s ease;
  line-height: 1.4;
}

.dim-ops-login-link:hover {
  background: color-mix(in srgb, #1677ff 20%, transparent);
  text-decoration: underline;
}

.dim-ops-platform-status {
  font-size: 11px;
  padding: 2px 7px;
  border-radius: 4px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.dim-ops-platform-status[data-status="ok"] {
  background: rgb(34 197 94 / 12%);
  color: #15803d;
}

.dim-ops-platform-status[data-status="scan"] {
  background: rgb(245 158 11 / 12%);
  color: #b45309;
}

/* 导航栏 Ops 专属图标替换 */
button:has(.dim-ops-nav-label) > svg:not(.dim-ops-custom-svg) {
  display: none !important;
}

.dim-ops-custom-nav-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  color: inherit;
}

/* CSS Mask 兜底图标：当 JS 插入未完成时直接使用伪元素 */
button:has(.dim-ops-nav-label):not(:has(.dim-ops-custom-nav-icon))::before {
  content: "";
  display: inline-block;
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  background-color: currentColor;
  -webkit-mask: url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20viewBox%3D%220%200%2016%2016%22%20fill%3D%22none%22%20stroke%3D%22black%22%20stroke-width%3D%221.3%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22M2%205.5h2.5l5-3.5v12l-5-3.5H2a1%201%200%200%201-1-1V6.5a1%201%200%200%201%201-1z%22/%3E%3Cpath%20d%3D%22M4.5%2010.5v2.5a.8.8%200%200%200%20.8.8h.4a.8.8%200%200%200%20.8-.8v-2.5%22/%3E%3Cpath%20d%3D%22M12%205.5a3.5%203.5%200%200%201%200%205%22/%3E%3Cpath%20d%3D%22M13.8%204a5.5%205.5%200%200%201%200%208%22/%3E%3C/svg%3E") no-repeat center / contain;
  mask: url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20viewBox%3D%220%200%2016%2016%22%20fill%3D%22none%22%20stroke%3D%22black%22%20stroke-width%3D%221.3%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22M2%205.5h2.5l5-3.5v12l-5-3.5H2a1%201%200%200%201-1-1V6.5a1%201%200%200%201%201-1z%22/%3E%3Cpath%20d%3D%22M4.5%2010.5v2.5a.8.8%200%200%200%20.8.8h.4a.8.8%200%200%200%20.8-.8v-2.5%22/%3E%3Cpath%20d%3D%22M12%205.5a3.5%203.5%200%200%201%200%205%22/%3E%3Cpath%20d%3D%22M13.8%204a5.5%205.5%200%200%201%200%208%22/%3E%3C/svg%3E") no-repeat center / contain;
}
`

const STYLE_ID = 'dim-ops-manager-style'

export function installOpsStyles() {
  if (typeof document === 'undefined') return
  if (document.getElementById(STYLE_ID)) return
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = STYLES
  document.head.appendChild(style)
}
