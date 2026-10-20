# 交互状态规范 (Interaction States)

> **Metadata**
> - **Source**: `.context/ui/source/ui-design-direction.md`
> - **Generated At**: `2026-10-21 01:08`
> - **Generator**: `Context-Agent v1.0`

---

## 状态列表

覆盖：Default / Hover / Loading / Error / Empty / `null` / `SessionState` 四态 / `ItemStatus` 五态 / Toast。  
Pressed / Focused 视觉 **TODO**（源文档未写）。

---

## 组件状态矩阵

| 组件 | Default | Hover | Pressed | Focused | Disabled | Loading | Error | Empty / null |
|------|---------|-------|---------|---------|----------|---------|-------|--------------|
| Card | ✅ | ✅ 上浮 + `#1677ff` 边框 + 阴影 | TODO | TODO | N/A | N/A | 走 SessionState | 空状态卡片 |
| Button | ✅ | TODO | TODO | TODO | 预填中不可再点 | ✅ 预填中 | N/A | N/A |
| Input / URL 回填 | ✅ | TODO | TODO | TODO | TODO | N/A | ✅ 宿主校验失败 | N/A |
| Badge / 状态灯 | ✅ SessionState | N/A | N/A | N/A | N/A | `authenticated` 呼吸 | `no_publish_permission` | `null` → 暂无数据 |
| MetricBox | ✅ 数值 + 环比 | N/A | N/A | N/A | N/A | 卡片级探活 | 探活失败 | `null` → 暂无数据 |
| EmptyState | N/A | N/A | N/A | N/A | N/A | N/A | N/A | ✅ 图标+文案+CTA |
| 看板卡片 | ItemStatus 之一 | 拖拽 = UI 批次 2 | TODO | TODO | N/A | N/A | 草稿异常 | 列空 TODO |

---

## 状态实现建议

### Card

- Hover: `translateY(-2px)`；`border-color: #1677ff`；`box-shadow: 0 4px 16px -2px rgba(0, 0, 0, 0.08)`；`180ms cubic-bezier(0.16, 1, 0.3, 1)`。

### Button

- Loading: 预填中展示 Loading，禁止连点。`Cmd/Ctrl+Enter` 前二次防呆。

### Badge / 状态灯（`SessionState`）

| `data-status` | 文案 | 色 | 动效 / CTA |
|---------------|------|----|-----------|
| `unknown` | 未知 / 探测中 | `--dsw-alias-label-tertiary` | 无 |
| `needs_login` | 需登录 | `#b45309` | **`去登录 ↗`** |
| `authenticated` | 已认证就绪 | `#15803d` | `dimStatusPulse` 2.4s |
| `no_publish_permission` | 无权限 | `#b45309` + 文字「无权限」 | **禁止写成「故障」** |

### MetricBox / null

- 指标 `null` →「暂无数据」+ 悬浮原因。禁止把 `null` 显示为 `0`。
- 平台真实 `0` 原样展示，与 `null` 互斥。
- 应采平台未全部成功 → 汇总值 `null`，展示 `measuredPlatforms` / `unmeasuredPlatforms`。
- 环比窗口不足 → delta `null`，文案「暂无环比」，禁止估算。
- 分发矩阵连通度只计 `authenticated`；**项目 Phase 0** 分母为 2。
- 客户端只展示宿主汇总，不在前端重算全网总量。

### Input（URL 回填）

- 客户端调用 `drafts.updatePublishUrl`，**不**本地改状态。
- 宿主用 URL 解析器校验；失败 `drafts/invalid-published-url`。
- 单渠道有效 URL → `published`；多渠道未齐 → 保持 `prefilled`，展示「已发布 n/m 渠道」。

### Toast / 通知条

- 预填成功：「去平台后台确认发布 ↗」+ `前往平台草稿箱 ↗`。
- 保存：`drafts.save` Toast「草稿已保存」。
- 全局 Toast：`dimOpsSlideDown 200ms cubic-bezier(0.16, 1, 0.3, 1)`，停留 5s 后淡出。
- 预填成功的**常驻通知条**不自动 5 秒消失，与 Toast 不是同一组件。

### 内容五态（`ItemStatus`）

`planned` → `drafting` → `draft_ready` → `prefilled` → `published`。  
禁止 `writing` / `drafted`。`published` 不可经 `calendar.updateStatus` 写入。UI 批次 1 为基础看板。

### 工作台数据域 / 刷新去重

统一 `loading` / `error` / `data`。核心业务规则（状态机、权限）在宿主侧。

刷新入口（卡片原地探活、Header「刷新大盘」、`Cmd/Ctrl+R`）共用同一 in-flight 状态，按**卡片 / 对应 RPC** 去重：请求未完成时连续点击或快捷键只执行一次；完成或失败后释放。快捷键防抖不能替代跨入口去重。**项目 Phase 0** 不自建 WebSocket / SSE 或后台轮询。
