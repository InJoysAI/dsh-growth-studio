# 原子化设计组件清单 (Atomic Design Components)

> **Metadata**
> - **Source**: `.context/ui/source/ui-design-direction.md`
> - **Generated At**: `2026-10-21 00:15`
> - **Generator**: `Context-Agent v1.0`

---

## 概述

源文档 DEC-UI-004 / §6 要求全面启用 JSX 模块化与原子组件体系，目录按 `components/ui`、`components/simulators`、`components/layout`、`workspaces/` 拆分。下表只收录源文档点名的层与组成，未点名的原子（如独立 Search Box）不编造。

工程落点（源文档 §6，权威目录以源文档为准）：

```text
plugin-src/client/components/ui/          Button Badge Card MetricBox SegmentedTabs EmptyState
plugin-src/client/components/simulators/  WechatCardSimulator BilibiliSimulator
plugin-src/client/components/layout/      HeaderCockpit TopKpiRibbon
plugin-src/client/workspaces/             六个 Tab 页面
```

---

## 1. 原子 (Atoms)

### 色彩原子

实现绑定 CSS 变量，不要把 HEX 写进组件。完整对照见 `design_system.md` / `design_tokens.json`。

| Token 名称 | 值 | 用途 |
|-----------|----|----|
| `--dsw-alias-bg-layer-1/2/3` | DSH alias | 底色 / 卡片 / 浮层 |
| `--dsw-alias-label-primary/secondary/tertiary` | DSH alias | 文字阶梯 |
| `--dsw-alias-border-default` | 源文档 alias（与架构 `border-l1/l2` 口径差，见 design_system） | 边框 |
| `--dsw-alias-brand-primary` | 源文档 alias + fallback | 主操作 |
| `--dsw-alias-status-success/warning/error/neutral` | 源文档 alias + fallback | 四态与 null |

### 字体原子

| Token 名称 | 值 | 用途 |
|-----------|----|----|
| 字体族 / 字号 / 行高 | TODO（源文档未给出） | 跟随 DSH 宿主 |

### 图标原子

源文档以 Emoji / 语义符号出现在布局示意中，**未给出独立 SVG 图标集或尺寸**。

| 图标名称 | 尺寸 | 用途 |
|---------|------|-----|
| 刷新 / 新建 / 登录外链 / 状态灯 | TODO | Header 行动、卡片 CTA、四态灯 |
| 空状态微图标 | TODO | EmptyState 必备组成 |

### 控件原子

| 原子 | 源文档约束 | 实现文件（规划） |
|------|-----------|----------------|
| Button | 主 / 次 / 危险 / 图标；预填中 Loading | `components/ui/Button.jsx` |
| Badge | 四态灯、null 中性徽章 | `components/ui/Badge.jsx` |
| 输入框 | 表单、URL 回填 | 源文档未单列文件；随表单使用 |
| 状态点 | `.dim-status-dot[data-status]` | Badge 内或独立 span |

---

## 2. 分子 (Molecules)

### 指标卡 MetricBox

```
组成原子:
├── 指标名称（二级文本）
├── 数值（一级文本）或「暂无数据」中性徽章
└── 环比 / 单位（源文档示意见 §4.1；null 时不得用 0）
```

**HTML 结构**:

```html
<section class="dim-ops-metric">
  <h3 class="dim-ops-metric__label">全网非去重曝光</h3>
  <p class="dim-ops-metric__value">128.4k</p>
  <!-- 若值为 null： -->
  <span class="dim-ops-badge dim-ops-badge--neutral" title="尚未探活或平台未发布">暂无数据</span>
</section>
```

实现文件：`components/ui/MetricBox.jsx`。

### 空状态 EmptyState

```
组成原子:
├── 微图标
├── 解释文案
└── 行动按钮（CTA；未登录则为「去登录 ↗」）
```

实现文件：`components/ui/EmptyState.jsx`（DEC-UI-010）。

### 标准卡片 Card

```
组成原子:
├── 容器（.dim-ops-card，Hover 微动效）
├── 标题区
└── 内容槽
```

实现文件：`components/ui/Card.jsx`。

### 分段 Tab SegmentedTabs

```
组成原子:
├── 多个 Tab 按钮
└── 选中态（主品牌蓝）
```

实现文件：`components/ui/SegmentedTabs.jsx`。六个工作区标签文案见源文档 §4.1 / §5。

### URL 回填输入组

```
组成原子:
├── URL 输入框
└── 确认按钮
```

校验通过后草稿跃迁 `published`（DEC-UI-009）。非法 URL 不得放行。

### 平台状态灯组

```
组成原子:
├── 渠道 Logo（源文档要求展示，资产规格 TODO）
├── 渠道名称
└── 四态状态灯（已就绪 / 待扫码 / 未连接 / 故障）
```

---

## 3. 有机体 (Organisms)

### HeaderCockpit（顶部驾驶舱常驻栏）

```
组成分子:
├── 产品名「Growth Studio」
├── 当前产品选择器
├── Injoys MCP 连通指示
├── BrowserOS n/n 就绪指示
├── 刷新大盘按钮
└── 新建物料按钮
```

实现文件：`components/layout/HeaderCockpit.jsx`。

### TopKpiRibbon（4 核心指标条）

```
组成分子:
├── MetricBox × 4（曝光 / 互动与关注净增 / 排期履约 / 分发矩阵就绪度）
```

实现文件：`components/layout/TopKpiRibbon.jsx`。断点行为见 `layout_grid.md`。

### 平台矩阵卡片

```
组成分子:
├── 平台状态灯组
├── 核心指标或「暂无数据」徽章（悬浮原因）
├── 「原地探活」按钮（无整页刷新）
└── 「去登录 ↗」外链
```

出现在运营驾驶舱（§5.1）。

### 热点雷达列表项

```
组成分子:
├── 选题标题
├── 热度指数
├── 建议渠道
└── 「一键采用此选题 ➔」（切创作室并注入标题）
```

### 微信公众号模拟器

```
组成分子:
├── 手机框架
├── 封面大图
├── 居底标题
├── 号名与发布时间
└── 正文排版预览
```

实现文件：`components/simulators/WechatCardSimulator.jsx`。

### B 站视频元数据模拟器

```
组成分子:
├── 桌面端详情外观
├── 16:9 封面
├── 主标题
├── 标签胶囊
└── 视频简介
```

实现文件：`components/simulators/BilibiliSimulator.jsx`。

### 预填与回填栏

```
组成分子:
├── 「一键预填至草稿箱 (BrowserOS)」主按钮（Loading + 成功通知条）
└── URL 回填输入组
```

成功文案：「已成功预填，请前往平台人工审核发布」。禁止自动发布。

### AI 工具调试抽屉

```
组成分子:
├── 可视化参数表单
├── 可折叠原始 JSON
├── 执行耗时
└── 返回值结构化渲染
```

`Esc` 关闭（DEC-UI-014）。

### 排期看板卡片

```
组成分子:
├── 内容标题
├── 平台图标
├── 计划日期
├── 负责人
└── 当前操作快捷按钮
```

五态泳道：`planned` / `writing` / `drafted` / `prefilled` / `published`。

---

## 4. 模板 (Templates)

### 工作台壳层

- HeaderCockpit + Sticky KPI Ribbon + SegmentedTabs + Active Workspace Canvas
- 不包含具体业务数据

### 内容创作室分屏

- 左：多渠道表单与 AI 润色；右：平台模拟器 + 底部预填 / 回填栏
- `<960px` 退化为上下垂直流（DEC-UI-013）

### 排期双视图

- 默认 5 态看板；可切换周排期日历（DEC-UI-006）
- Phase 0 为基础看板，深度交互在 Phase 1

---

## 5. 页面 (Pages)

对应 `workspaces/`，均为源文档 §5 的业务工作区。

| 页面 | 文件 | Phase 0 深度 | 关键状态 |
|------|------|-------------|---------|
| 运营驾驶舱 | `OverviewCockpitTab.jsx` | 核心 | 四态灯、null 徽章、原地探活、热点一键采用 |
| 内容创作室 | `ContentStudioTab.jsx` | 核心 | 编辑 / 预览 / 预填 Loading / URL 校验 |
| 排期流水线 | `PipelineCalendarTab.jsx` | 基础看板 | 五态泳道；日历视图 Phase 1 |
| AI 工具中枢 | `ToolsHubTab.jsx` | 场景卡片 + 抽屉 | 表单校验、JSON、耗时 |
| 舆情需求大盘 | `SocialListeningTab.jsx` | 基础指标 | null 容错；聚类 Phase 1 |
| 引擎策略配置 | `SettingsGovernanceTab.jsx` | 核心 | Token 显隐、连通测试、能力开关 |

旧 `ops-page.js` 的配置与探活逻辑迁入 `SettingsGovernanceTab.jsx`（源文档 §7.1）。
