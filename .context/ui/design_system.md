# 设计系统规范 (Design System)

> **Metadata**
> - **Source**: `.context/ui/source/ui-design-direction.md`
> - **Generated At**: `2026-10-21 00:15`
> - **Generator**: `Context-Agent v1.0`

---

> **权威与冲突**
> - 视觉/交互以 `source/ui-design-direction.md` 为准。
> - 工程硬约束以 `.context/criterion.md` 为准：背景 / 边框 / 文字 **MUST** 使用 `var(--dsw-alias-*)`，**MUST NOT** 硬编码色值。
> - 源文档 §4.2 将品牌/状态色写作 `var(--dsw-alias-brand-primary)` / `var(--dsw-alias-status-*)`，边框写作 `var(--dsw-alias-border-default)`。
> - criterion §3.1 与架构 §5.4 的边框令牌为 `--dsw-alias-border-l1` / `--dsw-alias-border-l2`；交互点缀色是令牌化的**唯一例外**，权威取值为主操作蓝 `#1677ff`、安全绿 `#15803d`、告警橙 `#b45309`、活力紫 `#7c3aed`（与源文档 status 回退 `#22c55e` / `#f59e0b` / `#ef4444` 不一致）。
> - **实现口径**：宿主已提供的 alias 一律绑定 CSS 变量；点缀色仅在宿主无对应 alias 时才使用架构 §5.4 例外色值。不得把未在宿主出现的 CSS 变量当成已存在，也不得把下表 Light/Dark 回退参考写成组件内硬编码。

---

## 视觉定位

| 项 | 决策 | 来源 |
|----|------|------|
| 承载形态 | DSH 独立工作台主视图（主侧边栏 / 主窗口级入口）；设置页保留引擎配置与快捷跳转 | DEC-UI-001 |
| 风格 | Modern Pro SaaS（Linear / Raycast 质感）：高信息密度、精细边框微质感、深浅色自适应 | DEC-UI-002 |
| 主布局 | 顶部 Sticky KPI & Engine Ribbon + 紧凑分段式 Tab + 主工作画布 | DEC-UI-003 |
| 工程 | React 18 + esbuild JSX；按 Tab / 通用组件分目录；禁止单文件 `createElement` 堆砌 | DEC-UI-004 |
| 文案 | 首版中文；全部静态/动态文案走字典或 `ctx.i18n.text`，禁止 JSX 深层写死 | DEC-UI-015 |

---

## 颜色系统

实现时写 `var(--dsw-alias-*)`。下表「Light / Dark 回退参考」仅复述源文档 §4.2，**不是**可硬编码的色板。

### 表面与文字（必须走令牌）

| 名称 | CSS 变量 | Light 回退参考 | Dark 回退参考 | 用途 |
|------|---------|----------------|---------------|------|
| 主背景底色 | `--dsw-alias-bg-layer-1` | `#f8f9fb` | `#111215` | 工作台外层容器底层背景 |
| 工作区 / 卡片底色 | `--dsw-alias-bg-layer-2` | `#ffffff` | `#18191d` | 模块卡片、工作区主体 |
| 浮层 / 高亮卡片 | `--dsw-alias-bg-layer-3` | `#f0f2f5` | `#22242a` | Hover 卡片、表单输入框、下拉菜单 |
| 一级主文本 | `--dsw-alias-label-primary` | `#1f2329` | `#f5f6f7` | 卡片标题、核心指标数字、主导航 |
| 二级正文 | `--dsw-alias-label-secondary` | `#4e5969` | `#c5c8ce` | 描述文案、表单标签、副标题 |
| 三级弱化文本 | `--dsw-alias-label-tertiary` | `#86909c` | `#7a808d` | 占位符、辅助时间戳、空状态说明 |
| 标准边框 | `--dsw-alias-border-default`（源文档） | `#e5e6eb` | `#2c2e36` | 卡片边框、分隔线、输入框边框 |

> **TODO（口径差）**：架构文档使用 `--dsw-alias-border-l1` / `--dsw-alias-border-l2`，未记录 `--dsw-alias-border-default`。实现前确认宿主实际暴露的边框 alias，优先绑定真实存在的变量。

### 语义 / 点缀色

| 名称 | 源文档 CSS 变量（含 fallback） | Light 回退参考 | Dark 回退参考 | 适用场景 |
|------|------------------------------|----------------|---------------|---------|
| 主品牌蓝 | `var(--dsw-alias-brand-primary, #1677ff)` | `#1677ff` | `#3c89ff` | 主行动按钮、选中 Tab、链接 |
| 成功色（绿） | `var(--dsw-alias-status-success, #22c55e)` | `#22c55e` | `#34d399` | 平台就绪、连接正常、发布完成 |
| 警告色（橙） | `var(--dsw-alias-status-warning, #f59e0b)` | `#f59e0b` | `#fbbf24` | 需要扫码登录、待补充 URL |
| 危险色（红） | `var(--dsw-alias-status-error, #ef4444)` | `#ef4444` | `#f87171` | 连接失败、校验未通过、草稿异常 |
| 中性无数据 | `var(--dsw-alias-status-neutral, #86909c)` | `#86909c` | `#6b7280` | `null`「暂无数据」中性徽章 |

> **TODO（口径差）**：criterion / 架构 §5.4 点缀色为例外硬编码：`#1677ff` / `#15803d` / `#b45309` / `#7c3aed`，无独立「危险红 / 中性灰」条目。业务语义（绿=就绪、琥珀=待登录、灰=规划中 / 暂无数据）见 `domain/business_rules.md` BR-081 与源文档 DEC-UI-010。

```css
.dim-ops-workbench {
  background: var(--dsw-alias-bg-layer-1);
  color: var(--dsw-alias-label-primary);
}

.dim-ops-card {
  background: var(--dsw-alias-bg-layer-2);
  border: 1px solid var(--dsw-alias-border-default);
  color: var(--dsw-alias-label-primary);
}
```

---

## 字体规范

源文档**未给出**字体族、字号或行高。

| 名称 | 大小 | 行高 | 用途 |
|------|------|------|------|
| text-sm | TODO | TODO | 占位符、时间戳、空状态说明 |
| text-base | TODO | TODO | 正文、表单标签 |
| text-xl | TODO | TODO | 卡片标题、核心指标数字 |

```css
/* TODO: 源文档未指定字体族；实现时跟随 DSH 宿主字体，不得另造品牌字体 */
--font-sans: TODO;
--font-mono: TODO; /* 调试抽屉原始 JSON */
```

---

## 间距 / 圆角 / 阴影

源文档**未给出**间距刻度或圆角。已明确的阴影仅出现在卡片 Hover：

| 名称 | 值 | 用途 |
|------|-----|------|
| spacing-* | TODO | 紧凑 SaaS 密度，数值待确认 |
| radius-* | TODO | 卡片 / 按钮 / 输入框圆角待确认 |
| card-hover-shadow | `0 4px 16px -2px rgba(0, 0, 0, 0.08)` | `.dim-ops-card:hover`（源文档 §4.3） |

---

## 组件规范

类名前缀与源文档示例保持一致（`dim-ops-*` / `dim-status-*`）。文案走 i18n 字典，下表中文仅为首版文案。

### Button

变体（源文档 §6）：主 / 次 / 危险 / 图标。

```html
<button class="dim-ops-btn dim-ops-btn--primary" type="button">一键预填至草稿箱</button>
<button class="dim-ops-btn dim-ops-btn--secondary" type="button">保存本地草稿</button>
<button class="dim-ops-btn dim-ops-btn--danger" type="button">危险操作</button>
<button class="dim-ops-btn dim-ops-btn--icon" type="button" aria-label="刷新大盘">🔄</button>
```

- 主按钮：品牌蓝；执行中展示 Loading，禁止连点。
- `Cmd/Ctrl+Enter` 触发预填前必须二次防呆弹层（DEC-UI-014）。
- **严禁**出现「正式发布 / 群发」自动点击入口。

### Input

```html
<input
  class="dim-ops-input"
  type="url"
  placeholder="回填真实发布 URL"
/>
```

- 底色走 `--dsw-alias-bg-layer-3`，边框走标准边框令牌。
- URL 回填必须用 URL 解析器校验，禁止宽松正则；失败走危险色与错误提示。

### Card

```html
<article class="dim-ops-card">
  <!-- 渠道 Logo、名称、四态状态灯、指标或「暂无数据」、底部行动 -->
</article>
```

Hover（源文档 §4.3）：

```css
.dim-ops-card {
  transition: transform 180ms ease, box-shadow 180ms ease, border-color 180ms ease;
}
.dim-ops-card:hover {
  transform: translateY(-2px);
  border-color: var(--dsw-alias-brand-primary, #1677ff);
  box-shadow: 0 4px 16px -2px rgba(0, 0, 0, 0.08);
}
```

### Badge / 状态灯

四态：`已就绪` / `待扫码` / `未连接` / `故障`。`null` 指标使用中性「暂无数据」徽章，悬浮说明原因（例如「尚未探活或平台未发布」），**不得显示为 0**。

```html
<span class="dim-status-dot" data-status="active"></span>
<span class="dim-ops-badge dim-ops-badge--neutral">暂无数据</span>
```

`data-status="active"` 使用 `dimStatusPulse` 2.4s 呼吸（见 `motion_tokens.md`）。

### MetricBox

四个 Sticky KPI：全网非去重曝光、真实互动与关注净增、本周排期履约流水、分发矩阵就绪度。`null` → 中性徽章，禁止用 `0` 占位。

### EmptyState

结构固定为「微图标 + 解释文案 + 行动按钮」。未登录渠道提供 `去登录 ↗` 外链，禁止阻塞、禁止泄露 Cookie。

### SegmentedTabs

六个工作区：运营驾驶舱、内容创作室、排期流水线、AI 工具中枢、舆情大盘、引擎配置。选中态走主品牌蓝。

---

## 工作台骨架约束

```text
HeaderCockpit: 产品名 / 当前产品选择 / Injoys MCP 连通 / BrowserOS n/n 就绪 / 刷新大盘 / 新建物料
Sticky KPI Ribbon: 4 张 MetricBox（≥1280 与 960–1279 为 4 列；<960 为 2×2）
Segmented Tabs: 6 个工作区
Active Workspace Canvas: 当前 Tab 内容
```

Phase 0 深度打通：驾驶舱 + 内容创作室 + 引擎配置；排期与 AI 工具中枢为基础看板 / 场景卡片（DEC-UI-012）。

---

## AI 引用指南

当 AI 生成前端组件时：

1. 颜色只绑 `var(--dsw-alias-*)`；不要把回退参考写成组件硬编码色值。
2. `null` 指标渲染「暂无数据」，禁止 `0`。
3. 预填成功只引导「去平台后台确认发布 ↗」，禁止自动发布控件。
4. 文案走字典；快捷键与断点见 `accessibility_checklist.md`、`layout_grid.md`。
5. 细节以 `source/ui-design-direction.md` 为准；与 criterion 冲突时工程实现服从 criterion。
