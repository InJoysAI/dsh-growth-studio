# 设计系统规范 (Design System)

> **Metadata**
> - **Source**: `.context/ui/source/ui-design-direction.md`
> - **Generated At**: `2026-10-21 00:55`
> - **Generator**: `Context-Agent v1.0`

---

> **权威层级**
> 1. 工程：`criterion.md`（槽位、令牌、禁止客户端写状态机）。
> 2. 业务枚举/阶段：PRD / BR / `src/types.ts`。
> 3. 视觉细节：`source/ui-design-direction.md`（2026-10-21 已按 MUST 修订）。
>
> **实施门禁**：当前入口仅为 `settings.section`（`id: 'ops'` / `order: 60`）。独立主视图与 `styles/*.css` 目录重构须先提案更新 criterion。边框走 `--dsw-alias-border-l1/l2`；点缀色仅 `#1677ff` / `#15803d` / `#b45309` / `#7c3aed`。

---

## 视觉定位

| 项 | 决策 | 来源 |
|----|------|------|
| 承载形态 | **目标**独立主视图；**当前可实施** `settings.section`。设置主入口 **Megaphone** 图标 | DEC-UI-001、BR-080 |
| 风格 | Modern Pro SaaS（Linear / Raycast）；精细边框；**不采纳毛玻璃** | DEC-UI-002 |
| 主布局 | Sticky KPI Ribbon + 分段 Tab（顺序：驾驶舱 / 排期日历流水 / 创作室 / AI工具中枢 / 舆情需求大盘 / 引擎策略配置） | DEC-UI-003、PRD §四 |
| 工程 | 现行 `ops-page.js` + `ops-styles.js`；JSX 分目录是目标重构 | DEC-UI-004、criterion §3.3 |
| 文案 | `locale/*.json` 键 `ops.<area>.<name>`；`ctx.i18n.text` → 当前 locale → `zh.json` | DEC-UI-015 |

---

## 颜色系统

表面与文字只写 `var(--dsw-alias-*)`。点缀色只用架构 §5.4 四个授权 HEX。观测参考禁止写进组件。

### 表面与文字（必须走令牌）

| 名称 | CSS 变量 | 观测参考 Light / Dark | 用途 |
|------|---------|----------------------|------|
| 主背景底色 | `--dsw-alias-bg-layer-1` | `#f8f9fb` / `#111215` | 工作台外层容器 |
| 工作区 / 卡片底色 | `--dsw-alias-bg-layer-2` | `#ffffff` / `#18191d` | 模块卡片、工作区 |
| 浮层 / 输入底色 | `--dsw-alias-bg-layer-3` | `#f0f2f5` / `#22242a` | Hover、输入框、下拉 |
| 一级主文本 | `--dsw-alias-label-primary` | `#1f2329` / `#f5f6f7` | 标题、指标数字、导航 |
| 二级正文 | `--dsw-alias-label-secondary` | `#4e5969` / `#c5c8ce` | 描述、表单标签 |
| 三级弱化文本 | `--dsw-alias-label-tertiary` | `#86909c` / `#7a808d` | 占位符、`unknown`、`null` 徽章 |
| 边框 L1 | `--dsw-alias-border-l1` | 宿主主题 | 分割线、外层描边 |
| 边框 L2 | `--dsw-alias-border-l2` | 宿主主题 | 卡片 / 输入框边框 |

### 语义 / 点缀色（唯一允许的 HEX）

| 名称 | 值 | 适用场景 |
|------|-----|---------|
| 主操作蓝 | `#1677ff` | 主按钮、选中 Tab、链接、卡片 Hover 描边 |
| 安全绿 | `#15803d` | `authenticated`、已预填、连接正常 |
| 告警橙 | `#b45309` | `needs_login`、待回填 URL、`no_publish_permission`（加文字「无权限」） |
| 活力紫 | `#7c3aed` | 强调点缀，不可替代状态语义 |

`null` / `unknown` 用 `--dsw-alias-label-tertiary`，**不要**造 `--dsw-alias-status-*` 或未授权红 HEX。

```css
.dim-ops-workbench {
  background: var(--dsw-alias-bg-layer-1);
  color: var(--dsw-alias-label-primary);
}

.dim-ops-card {
  background: var(--dsw-alias-bg-layer-2);
  border: 1px solid var(--dsw-alias-border-l2);
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

变体（源文档 §6）：主 / 次 / 告警（危险语义） / 图标。

```html
<button class="dim-ops-btn dim-ops-btn--primary" type="button">一键预填至草稿箱</button>
<button class="dim-ops-btn dim-ops-btn--secondary" type="button">保存本地草稿</button>
<button class="dim-ops-btn dim-ops-btn--danger" type="button">危险操作</button>
<button class="dim-ops-btn dim-ops-btn--icon" type="button" aria-label="刷新大盘">🔄</button>
```

- 主按钮：`#1677ff`；执行中展示 Loading，禁止连点。
- 告警/危险变体：背景或描边 `#b45309`，按钮文字必须含危险语义（如「危险操作」），**不得另造红 HEX**；独立红色须先提案登记宿主 error alias。
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

- 底色走 `--dsw-alias-bg-layer-3`，边框走 `--dsw-alias-border-l2`。
- URL 回填只调用 `drafts.updatePublishUrl`；宿主用 URL 解析器校验，禁止宽松正则。失败展示告警橙 + 错误文案。客户端不得本地写 `published`。

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
  border-color: #1677ff;
  box-shadow: 0 4px 16px -2px rgba(0, 0, 0, 0.08);
}
```

### Badge / 状态灯

会话四态（`SessionState`）：`unknown` / `needs_login` / `authenticated` / `no_publish_permission`。`null` 指标使用「暂无数据」徽章（`--dsw-alias-label-tertiary`），**不得显示为 0**。禁止用「故障」替代「无权限」。

```html
<span class="dim-status-dot" data-status="authenticated"></span>
<span class="dim-ops-badge dim-ops-badge--neutral">暂无数据</span>
```

`data-status="authenticated"` 使用 `dimStatusPulse` 2.4s 呼吸（见 `motion_tokens.md`）。

### MetricBox

四个 Sticky KPI（PRD §5.1.2）：全网曝光/播放总量、互动与关注增长、排期履约流水、分发矩阵连通度。第 4 项只统计 `authenticated`；未交付渠道不计入。`null` →「暂无数据」，禁止 `0`。

### EmptyState

结构固定为「微图标 + 解释文案 + 行动按钮」。未登录渠道提供 `去登录 ↗` 外链，禁止阻塞、禁止泄露 Cookie。

### SegmentedTabs

六个工作区（顺序对齐 PRD）：运营驾驶舱、排期日历流水、内容创作室、AI工具中枢、舆情需求大盘、引擎策略配置。选中态走 `#1677ff`。

---

## 工作台骨架约束

```text
HeaderCockpit: 产品名 / 当前产品 / Injoys MCP / BrowserOS authenticated 计数（项目 Phase 0 为 2/2）
设置导航 chrome（画布外）：Megaphone 矢量图标，由 `index.js` 注入 `settings.section`，不是 Header 内按钮
快捷行动: + 生成 7 天排期日历 / 新建多端物料 / 刷新大盘
Sticky KPI Ribbon: 4 张 MetricBox（≥1280 与 960–1279 为 4 列；<960 为 2×2）
Segmented Tabs: 6 个工作区（PRD 顺序）
Active Workspace Canvas: 当前 Tab 内容
```

UI 批次 1（路线图项目 Phase 3 客户端首批）：驾驶舱 + 创作室 + 配置深打通；排期与 AI 工具中枢为基础看板。业务渠道 = 项目 Phase 0 公众号 + B 站。

---

## AI 引用指南

当 AI 生成前端组件时：

1. 表面/文字只绑 `var(--dsw-alias-*)`；点缀色只用四个授权 HEX。
2. `null` →「暂无数据」，禁止 `0`。会话四态与内容五态用 `src/types.ts` 键值。
3. 预填成功只引导人工发布；`published` 仅经宿主 `drafts.updatePublishUrl`。
4. 文案走 `locale/*.json`；快捷键与断点见 `accessibility_checklist.md`、`layout_grid.md`。
5. 独立主视图 / CSS 拆目录未授权前，实现面仍是 `settings.section` + `ops-styles.js`。
