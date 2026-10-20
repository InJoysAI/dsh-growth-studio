# 原子化设计组件清单 (Atomic Design Components)

> **Metadata**
> - **Source**: `.context/ui/source/ui-design-direction.md`
> - **Generated At**: `2026-10-21 01:12`
> - **Generator**: `Context-Agent v1.0`

---

## 概述

DEC-UI-004 / §6 的 JSX 分目录是**目标重构**。criterion §3.3 现行实现面仍是 `ops-page.js` + `ops-styles.js` + `settings.section`。落地前须提案更新 criterion。

```text
plugin-src/client/                 现行：index.js + ops-page.js + ops-styles.js
plugin-src/client/components/ui/   目标：Button Badge Card MetricBox SegmentedTabs EmptyState
plugin-src/client/components/simulators/  WechatCardSimulator BilibiliSimulator
plugin-src/client/components/layout/      HeaderCockpit TopKpiRibbon
plugin-src/client/workspaces/      六个 Tab（PRD 顺序）
```

---

## 1. 原子 (Atoms)

### 色彩原子

表面/文字绑 CSS 变量；点缀色只用架构 §5.4 四个 HEX。详见 `design_system.md`。

| Token 名称 | 值 | 用途 |
|-----------|----|----|
| `--dsw-alias-bg-layer-1/2/3` | DSH alias | 底色 / 卡片 / 浮层 |
| `--dsw-alias-label-primary/secondary/tertiary` | DSH alias | 文字阶梯、`unknown`、`null` |
| `--dsw-alias-border-l1/l2` | DSH alias | 边框 |
| `#1677ff` / `#15803d` / `#b45309` / `#7c3aed` | 架构 §5.4 例外 | 主操作 / 已认证 / 需登录·无权限 / 强调 |

### 字体原子

| Token 名称 | 值 | 用途 |
|-----------|----|----|
| 字体族 / 字号 / 行高 | TODO（源文档未给出） | 跟随 DSH 宿主 |

### 图标原子

| 图标名称 | 尺寸 | 用途 |
|---------|------|-----|
| **Megaphone（大喇叭）** | 16×16（现行 `index.js` SVG） | **宿主导航 chrome**（`settings.section` 注入，BR-080）；非 HeaderCockpit 按钮 |
| 刷新 / 新建 / 登录外链 / 状态灯 | TODO | Header 行动、卡片 CTA、四态灯 |
| 空状态微图标 | TODO | EmptyState |

### 控件原子

| 原子 | 源文档约束 | 实现文件（规划） |
|------|-----------|----------------|
| Button | 主 / 次 / 告警(危险语义) / 图标；危险变体 `#b45309` + 文字，不得另造红 HEX | `components/ui/Button.jsx` |
| Badge | `SessionState` 四态灯、null 中性徽章 | `components/ui/Badge.jsx` |
| 输入框 | 表单、URL 回填 | 随表单使用 |
| 状态点 | `.dim-status-dot[data-status]` | Badge 内或独立 span |

---

## 2. 分子 (Molecules)

### 指标卡 MetricBox

KPI 命名对齐 PRD §5.1.2。数值与「暂无数据」**互斥**，同一状态不得并存。`128.4k` 仅为示意，不可作运行时回退。

```html
<!-- 有值：真实 0 也走此分支 -->
<section class="dim-ops-metric">
  <h3 class="dim-ops-metric__label">全网曝光/播放总量</h3>
  <p class="dim-ops-metric__caption">全网非去重曝光与播放累计人次</p>
  <p class="dim-ops-metric__value"><!-- bound: data.value --></p>
  <p class="dim-ops-metric__delta"><!-- bound: data.delta；null 时改为「暂无环比」 --></p>
  <p class="dim-ops-metric__coverage"><!-- bound: measuredPlatforms / unmeasuredPlatforms --></p>
</section>

<!-- null 汇总（应采平台未全部成功或采集失败） -->
<section class="dim-ops-metric">
  <h3 class="dim-ops-metric__label">全网曝光/播放总量</h3>
  <span class="dim-ops-badge dim-ops-badge--neutral" title="尚未探活或平台未发布">暂无数据</span>
</section>
```

### 空状态 EmptyState

微图标 + 解释文案 + CTA；`needs_login` 为 `去登录 ↗`。

### URL 回填输入组

客户端只调用 `drafts.updatePublishUrl`。宿主用 URL 解析器校验。部分渠道回填保持 `prefilled`，展示「已发布 n/m 渠道」。客户端不得本地写 `published`。

### 平台状态灯组

Logo + 名称 + `SessionState`：`unknown` / `needs_login` / `authenticated` / `no_publish_permission`。禁止「故障」替代「无权限」。

---

## 3. 有机体 (Organisms)

### HeaderCockpit

产品名、当前产品、Injoys MCP、BrowserOS `authenticated` 计数（**项目 Phase 0** 分母为 2）、**`+ 生成 7 天排期日历`**、**`✍ 新建多端物料`**（切创作室并聚焦）、**`🔄 刷新大盘`**。Megaphone 不在 Header 内，见宿主导航 chrome。

### TopKpiRibbon

MetricBox × 4（PRD §5.1.2）。第 4 项只统计 `authenticated`。覆盖范围、暂无环比、非去重注释见 MetricBox。

### 平台矩阵卡片

UI 批次 1 **仅公众号 + B 站两张**。原地探活；`needs_login` 才出现 `去登录 ↗`。

### 热点雷达列表项

标题、热度、建议渠道、「采用此选题创作 ➔」（预填**标题与基调**）。

### 微信公众号模拟器

朋友圈分享卡片 + 文章详情 + Markdown 代码高亮（BR-032）。

### B 站视频元数据模拟器

3 套候选标题、结构化简介、标签词云、分区选择（BR-032）。

### 物料与预填栏

- `📋 一键复制物料`（**项目 Phase 0** 首版，剪贴板）
- `💾 沉淀至 Injoys 知识文档`（仅用户显式点击）
- `💾 保存本地草稿`（`drafts.save`，不得传 `published`）
- `🚀 一键预填` + `前往平台草稿箱 ↗`
- URL 回填 → `drafts.updatePublishUrl`

MVP **不提供**草稿历史 / 版本恢复。

### 排期看板卡片

五态：`planned` / `drafting` / `draft_ready` / `prefilled` / `published`。另提供 `📥 导出至 Injoys 表格` 与 `从 Injoys 导入` 两个独立动作（BR-024）。

### 配置页有机体

- Injoys MCP：Endpoint、Token 显隐、连通测试
- BrowserOS：探活；能力管理列出**实际暴露**工具，默认八项不是上限
- 草稿目录：**可配置** + 健康度；失败展示 `config/invalid-drafts-dir`。切换成功后**同时**展示三项事实：「新目录对后续操作生效；正在进行的保存仍写入原目录。旧草稿不会自动迁移。」
- 全局策略：默认产品名、**调性基调**、保存即时生效

---

## 4. 模板 (Templates)

### 工作台壳层

HeaderCockpit + Sticky KPI Ribbon + SegmentedTabs（PRD 顺序）+ Canvas。当前注入 `settings.section`。

### 内容创作室分屏

左：特性 / 受众 / 基调 / 标题 / 正文 / AI 润色；右：模拟器 + 操作条。`<960px` 上下堆叠。

### 排期双视图

默认 5 态看板 + 导出/导入；可切周日历。拖拽深度 = UI 批次 2。

---

## 5. 页面 (Pages)

| 页面 | 文件 | UI 批次 1 | 关键状态 |
|------|------|-----------|---------|
| 运营驾驶舱 | `OverviewCockpitTab.jsx` | 核心 | 两张卡片、SessionState、快捷行动组、热点采用 |
| 排期日历流水 | `PipelineCalendarTab.jsx` | 基础看板 | `ItemStatus` 五态、导出/导入 |
| 内容创作室 | `ContentStudioTab.jsx` | 核心 | 特性/受众/基调、复制/沉淀、宿主回填 |
| AI 工具中枢 | `ToolsHubTab.jsx` | 场景卡片 + 抽屉 | 表单、脱敏后的 JSON、耗时；令牌/Cookie 不进抽屉/错误/日志/遥测；完整正文不进日志与遥测，预览按需 |
| 舆情需求大盘 | `SocialListeningTab.jsx` | 基础指标 | 播放/阅读、点赞、评论、分享、收藏；null 容错 |
| 引擎策略配置 | `SettingsGovernanceTab.jsx` | 核心 | draftsDir 可配 + 三项切换提示、能力开关非上限；Megaphone 在宿主导航 chrome（`index.js`） |

现行 `ops-page.js` 在提案落地前仍是唯一实现面。
