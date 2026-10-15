# domain/ — 业务领域上下文

> **Metadata**
> - **Source**: `docs/product_requirements.md`, `docs/development_plan.md`
> - **Generated At**: `2026-10-15 12:19`
> - **Generator**: `Context-Dev-Agent v1.0`

---

## 权威源文档

| 文件 | 说明 |
|------|------|
| [`source/product_requirements.md`](./source/product_requirements.md) | **主 PRD**：产品需求文档 v1.1.0（评审整改基线版 / Approved Baseline） |
| [`source/development_plan.md`](./source/development_plan.md) | 开发与落地计划（含 2026-10-13 静态评审核实的实现基线矩阵） |

---

## 快速索引 — PRD

| 章节 | 内容 |
|------|------|
| §二 | 项目背景与产品愿景：现状痛点、「策-采-编-发-评」全链路、独立开发者 AI 运营增长工作台定位 |
| §三 | 用户画像（独立开发者 / 小微产研团队 / AI 自动化探索者）与典型用户旅程 |
| §四 | 功能架构全景：6 大工作区 Tab 与分阶段交付定义 |
| §5.1 | 顶部运营驾驶舱与 KPI 看板（4 个核心指标卡） |
| §5.2 | 模块一：运营总览与矩阵大盘（渠道矩阵、会话状态四态生命周期、热点雷达） |
| §5.3 | 模块二：内容日历与发布流水线 |
| §5.4 | 模块三：跨平台内容创作室（本地草稿持久化 + 所见即所得模拟器） |
| §5.5 | 模块四：AI 运营工具中枢与技能工坊（工具全景分类 + 可视化单步调试沙箱） |
| §5.6 | 模块五：舆情监控与需求提炼（Social Listening & User Voice） |
| §5.7 | 模块六：引擎与平台配置（Integrations & Governance） |
| §六 | 界面设计与交互规范（DSH 设计令牌对齐、零阻碍操作原则） |
| §七 | 实施里程碑规划：Phase 0 (M0) → Phase 1 (M1) → Phase 2 (M2) → Phase 3 (M3) |

## 快速索引 — 开发计划

| 章节 | 内容 |
|------|------|
| §一 | 项目背景与架构定位（运营控制中枢 Orchestrator，输入/执行/审核/调度/反馈五端） |
| §二 | **实现基线状态矩阵** — 各模块源码路径、文档规格 vs 代码实际、状态评级与交付阶段 |
| §三 | 四阶段分步实施里程碑与验收条件 |
| §四 | 核心数据模型更新（`SessionState` / `ContentDraft` / `PlatformMetrics`） |
| §五 | 关键风险与工程防线（统一实例防线、永不自动确认发布、DOM 变动防护） |

---

## 核心业务铁律

1. **始终仅预填草稿，严禁自动确认发布** — `ops_publish_now` 已彻底移除，不得重新引入。
2. **会话状态必须四态流转** — `unknown` / `needs_login` / `authenticated` / `no_publish_permission`，严禁退化为 boolean 假阳性。
3. **数据必须真实，不可获取时为 `null`** — 不得硬编码伪造指标，不得按 0 计算。曝光（`impressions`）与播放（`plays`）语义必须分离。
4. **统一 BrowserOS 实例** — 严禁混合使用宿主外部 Chrome 与后台 BrowserOS 两个不同浏览器实例。
5. **Human-in-the-Loop 闭环** — 预填后返回草稿直达链接，人工发布后回填 URL，状态方可流转为 `published`。

---

## 待生成资产

以下领域侧汇总资产将由 `.agent/workflows/context-openspec.md` 生成：

- `business_rules.md` — 业务逻辑规则
- `user_journeys.md` — 用户旅程

> ⚠️ `source/` 中的文件为权威只读快照，请勿直接编辑。
