# 交互状态规范 (Interaction States)

> **Metadata**
> - **Source**: `.context/ui/source/ui-design-direction.md`
> - **Generated At**: `2026-10-21 00:55`
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

- Hover: `translateY(-2px)`；`border-color: #1677ff`；`box-shadow: 0 4px 16px -2px rgba(0, 0, 0, 0.08)`；`180ms ease`。

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

- `null` →「暂无数据」+ 悬浮原因。禁止 `0`。
- 分发矩阵连通度只计 `authenticated`；**项目 Phase 0** 分母为 2。

### Input（URL 回填）

- 客户端调用 `drafts.updatePublishUrl`，**不**本地改状态。
- 宿主用 URL 解析器校验；失败 `drafts/invalid-published-url`。
- 单渠道有效 URL → `published`；多渠道未齐 → 保持 `prefilled`，展示「已发布 n/m 渠道」。

### Toast / 通知条

- 预填成功：「去平台后台确认发布 ↗」+ `前往平台草稿箱 ↗`。
- 保存：`drafts.save` Toast「草稿已保存」。
- 全局 Toast：`dimOpsSlideDown 200ms`，停留 5s。

### 内容五态（`ItemStatus`）

`planned` → `drafting` → `draft_ready` → `prefilled` → `published`。  
禁止 `writing` / `drafted`。`published` 不可经 `calendar.updateStatus` 写入。UI 批次 1 为基础看板。

### 工作台数据域

统一 `loading` / `error` / `data`。刷新由用户触发，卡片原地更新（BR-082）。核心业务规则（状态机、权限）在宿主侧。
