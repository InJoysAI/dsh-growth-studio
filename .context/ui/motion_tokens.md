# 动效 Token (Motion Tokens)

> **Metadata**
> - **Source**: `.context/ui/source/ui-design-direction.md`
> - **Generated At**: `2026-10-21 00:40`
> - **Generator**: `Context-Agent v1.0`

---

源文档 DEC-UI-011 / §4.3：150ms~200ms 缓动微动效，兼顾 Modern SaaS 质感与低耗。

---

## Duration Tokens

| Token | 值 | 用途 |
|-------|----|------|
| motion-micro-min | `150ms` | 微交互区间下限 |
| motion-micro-max | `200ms` | 微交互区间上限 |
| motion-card | `180ms` | `.dim-ops-card` 的 transform / box-shadow / border-color |
| motion-toast-enter | `200ms` | `dimOpsSlideDown` 顶部滑入 |
| motion-toast-persist | `5s` | Toast 停留后淡出 |
| motion-status-pulse | `2.4s` | 就绪状态灯呼吸周期 |

---

## Easing Tokens

| Token | 值 | 用途 |
|-------|----|------|
| ease-standard | `ease` | 卡片 Hover 过渡（源文档 §4.3 `.dim-ops-card`） |
| ease-emphasized | `cubic-bezier(0.16, 1, 0.3, 1)` | 统一加速缓出曲线（源文档 §4.3 正文） |
| ease-in-out | `ease-in-out` | `dimStatusPulse` |

> 源文档同时给出「统一 cubic-bezier」与卡片 `transition: … 180ms ease`。实现卡片 Hover 时以 §4.3 代码块为准（`ease` + 180ms）；其他微交互使用 `cubic-bezier(0.16, 1, 0.3, 1)`。

---

## 已定义关键帧

```css
@keyframes dimStatusPulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.55; transform: scale(0.92); }
}

.dim-status-dot[data-status="authenticated"] {
  animation: dimStatusPulse 2.4s ease-in-out infinite;
}
```

卡片 Hover：`transform: translateY(-2px)` + `border-color: #1677ff` + `box-shadow: 0 4px 16px -2px rgba(0, 0, 0, 0.08)`。

Toast：顶部滑入动画名 `dimOpsSlideDown`（源文档未给出关键帧百分比，**TODO**：补 0%/100% transform/opacity）。

---

## Reduced Motion

源文档**未规定** `prefers-reduced-motion`。

```css
/* TODO: 源文档未要求。实现前确认是否跟随 DSH 宿主减弱动效。 */
```
