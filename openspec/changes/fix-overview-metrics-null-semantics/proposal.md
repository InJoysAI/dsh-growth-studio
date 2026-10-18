# Change: 工作台总览的汇总空值语义与真实数据来源

## Why

`workbench.overview` 当前把**易采集到的少量平台指标**直接累加后当作「全网总量」返回，并内置了一条硬编码的热点样例数据。这同时违犯两条不可协商的口径：

- **架构铁律 3（`.context/criterion.md` §4「指标真实性 / 汇总口径」）**：应采平台未全部成功采集时，汇总值必须为 `null`，不得只汇总已成功平台冒充全网总量，并须填充 `measuredPlatforms` / `unmeasuredPlatforms`；
- **`.context/criterion.md` §3.2「禁止伪造 / 硬编码指标数据」**：无法获取的字段必须为 `null`，`workbench.overview` 响应中的 `keyword: 'Agentic AI'` / `heatScore: 95` 属编造数据。

实现现状（`.context/architecture/risks_and_debt.md` TD-007，严重性**高**）：`src/ops-rpc.ts` 的 `workbench.overview` 对非 `null` 值直接累加（`totalImpressions = (totalImpressions ?? 0) + m.impressions`），且响应缺少 `measuredPlatforms` / `unmeasuredPlatforms` / `totalEngagements` / `totalFavorites` / `comparison` / `weeklyPipeline` 与窗口字段。该缺口会让驾驶舱产出虚高的运营结论，误导后续选题决策（RISK-006），并使环比因缺少字段与语义而不可用（RISK-007）。

本提案只修 `workbench.overview` 一处的契约与判定，不实现指标历史快照落盘（属 `feat-storage-metrics-snapshot`），也不接入真实排期数据（属 Phase 1 的 `feat-calendar-generate-list`）。

## What Changes

### 新增功能

- `src/types.ts` 新增 `OverviewMetrics` 契约类型：`measuredPlatforms` / `unmeasuredPlatforms` / `totalEngagements` / `totalFavorites` / `comparison` / `weeklyPipeline`，以及 `PlatformMetrics` 的 `windowStart` / `windowEnd` 窗口字段。
- `src/analytics/` 新增纯函数汇总判定：平台级覆盖门（`measuredPlatforms == P` 才给数字）+ 真实 `0` 参与求和 + `totalEngagements` 子项严格 `null`。

### 修改功能

- `src/ops-rpc.ts` 的 `workbench.overview` 改为消费上述契约与判定，响应补齐字段；`comparison` 在无历史基准来源时返回 `period: null` 且四个 delta（`impressionsDeltaPercent` / `playsDeltaPercent` / `engagementsDeltaPercent` / `followersDeltaPercent`）均为 `null`（键名以 `.context/architecture/source/technical_architecture.md` §3.1 定义为准；落盘基准属 `feat-storage-metrics-snapshot`）。
- `src/ops-rpc.ts` 移除硬编码热点样例数据，`trends` 如实返回空数组。
- `totalEngagements` 在点赞 / 评论 / 转发 / 收藏任一子项为 `null` 时为 `null`。
- `workbench.overview` 透传请求参数 `metricsWindow`（默认 `7d`）给采集器：`windowStart` / `windowEnd` 描述**请求窗口**而非数据周期；平台数值贡献只在可证实属于该窗口时计入，无法证实者保持未知，不得把今日 / 累计值标成 `7d` / `30d` 冒充窗口增量。

### 技术实现

- 按 SSoT-first（`.context/criterion.md` §6）先改 `src/types.ts`，再改 `src/ops-rpc.ts`；本项目无 Codegen（§7.2「生成命令 = 无」），一致性由 `pnpm typecheck` + `pnpm test` 保证。
- 汇总判定下沉为 `src/analytics/` 的纯函数，使「部分缺失 → `null`」与「真实 `0` 参与求和」可在**不依赖 RPC 管道**的情况下被单元测试直接覆盖。
- 业务逻辑只消费可空的 `impressions` / `plays`；兼容字段 `views`（`impressions ?? plays ?? 0`）仅保留形状，不得作为缺失指标的真实值（TD-005）。
- 无破坏性变更：既有字段（`productName` / `totalImpressions` / `totalPlays` / `totalLikes` / `totalComments` / `totalShares` / `totalFollowersDelta` / `scheduledCount` / `readyChannelsCount` / `totalChannelsCount` / `metricsAnnotation` / `statuses` / `calendarItems` / `feedbackItems` / `injoysConnected`）全部保留。

### 不在本次范围（Out of Scope）

- 指标历史快照的落盘实现（`feat-storage-metrics-snapshot`，本提案只定义 `comparison` 契约并如实返回 `null`）。
- `weeklyPipeline` 的真实排期**主数据接入**与本地持久化（归 Phase 1 的 `feat-calendar-generate-list`；本提案只补字段并从**既有 Injoys 读取得到的 `calendarItems`** 派生本周计数——该列表**可能非空**，本提案不假设其恒空，也不新增数据源）。
- 驾驶舱 UI 呈现（`feat-client-dashboard`，Phase 3）。
- 采集侧 Adapter 能力扩展（平台采集失败本身的修复、以及页面筛选 / 解析能力以使数值可证属于窗口，均不在本提案范围；本提案只落清窗口真实性口径，不据此把未验证周期的数据标成指定窗口）。

## Impact

### 涉及的规范（Specs）

- **新增**：`specs/workbench-overview/spec.md` — `workbench.overview` 汇总空值语义、真实零值、互动总量、曝光/播放口径、覆盖标注与窗口/环比/本周排期字段契约、无伪造数据。

### 涉及的代码

- **新增**：
  - `src/analytics/overview-aggregator.ts`（汇总判定纯函数）
  - `tests/overview-metrics.spec.ts`（或并入既有 `tests/ops-manager.spec.ts`）
- **修改**：
  - `src/types.ts`（`OverviewMetrics` + `PlatformMetrics.windowStart` / `windowEnd`）
  - `src/ops-rpc.ts`（`workbench.overview` 响应与硬编码热点数据移除）
  - `src/analytics/metrics-collector.ts`（填充 `windowStart` / `windowEnd`）

### 依赖关系

- **依赖**：无（前置提案：无）。
- **被依赖**：`feat-storage-metrics-snapshot`（消费本提案建立的 `comparison` 契约）、`feat-calendar-generate-list`（消费 `weeklyPipeline` 口径）、`feat-client-dashboard`（Phase 3 驾驶舱消费 `OverviewMetrics`）。
- **约束**：必须先改契约（`src/types.ts` → `src/ops-rpc.ts`）再改领域实现（`.context/criterion.md` §6）。

### 风险与注意事项

- **首次使用时全部环比 delta 为 `null` 被误报为缺陷**：依 RISK-007 应急预案，`null` 属**预期行为**（历史快照尚未积累），UI 应显示「暂无环比」而非 0%；测试以此为准。
- **移除硬编码热点后 `trends` 变空**：驾驶舱热点区短期内展示为空。空值优于假数据（`.context/criterion.md` §3.2）；真实热点来源属外部依赖（PRD 未指定渠道），未提供时如实返回空。
- **`weeklyPipeline` 为「本周派生结构」而非完整排期聚合**：`calendarItems` 来自既有 Injoys 读取、**可能非空**；本提案只统计本周（自然周、周一起算）行，跨周与远端历史行不计入；**零结构以筛选后的本周集合为准**（原始列表为空，或原始列表非空但全部落在上周 / 下周时得全 `0`），原始列表非空不得被无条件清空。本地排期黄金主数据接入由 Phase 1 承接，本提案不宣称已具备完整排期聚合。

### 验证标准

- ✅ 应采 2 平台仅 1 个成功采集时，汇总值为 `null`，且填充 `measuredPlatforms` / `unmeasuredPlatforms`（单元测试 + `pnpm test`）。
- ✅ 平台真实返回 `0` 时作为有效值计入求和，与 `null` 严格区分（单元测试）。
- ✅ `totalEngagements` 在点赞 / 评论 / 转发 / 收藏任一为 `null` 时为 `null`（单元测试）。
- ✅ `impressions` / `plays` 独立且可空；业务逻辑不把 `views` 当作缺失指标的真实值（单元测试 + `grep`：`views` 仅保留兼容形状）。
- ✅ `workbench.overview` 响应不含硬编码样例热点数据（代码审查 + `grep`）。
- ✅ `pnpm typecheck` + `pnpm test` 通过。

### 提案大纲对齐（Roadmap Alignment）

| 字段 | 内容 |
|------|------|
| roadmap_source_primary | `openspec/proposal-roadmap.md` |
| roadmap_source_supplement | `openspec/proposal-roadmap-Phase-0.md` |
| phase | Phase 0（安全与数据真实性修复） |
| change_id | `fix-overview-metrics-null-semantics` |
| business_goal | ① 消除「以部分平台数据冒充全网总量」的虚假结论，满足 §3.2 数据真实性；② 让 `comparison` / `weeklyPipeline` 具备可用且语义明确的字段，为 Phase 3 驾驶舱提供契约；③ 移除 `workbench.overview` 中硬编码的热点样例数据。 |
| dependencies | 前置：无；被依赖：`feat-storage-metrics-snapshot`、`feat-calendar-generate-list`、`feat-client-dashboard` |
| acceptance_criteria | 部分缺失汇总为空 / 真实零值参与求和 / 互动总量口径 / 曝光·播放口径 / 无伪造数据 |

### 关联 Context 资产

| Scope | 资产路径 | 关联说明 |
|-------|---------|---------|
| criterion | `.context/criterion.md` | §3.2 数据真实性、§4 指标口径（汇总 / 零值 / 环比基准）、§5.5 `PlatformMetrics`（`impressions` / `plays` 独立且可空，`views` 仅兼容）、§6 SSoT-first |
| architecture | `.context/architecture/risks_and_debt.md` | TD-007（高，本提案直接偿还）、TD-005（`views` 兼容字段误用，中）、RISK-006、RISK-007 |
| architecture | `.context/architecture/api_strategy.md` | §3.1 `workbench.overview` 契约与「部分缺失汇总规则」权威口径 |
| architecture | `.context/architecture/data_architecture.md` | `PlatformMetrics` 注（`windowStart` / `windowEnd`）与窗口字段 |
| domain | `.context/domain/business_rules.md` | BR-050（指标真实性与可空语义，MUST）、BR-051（曝光/播放区分口径，MUST）、BR-052（互动与关注增长汇总，SHOULD）、BR-053（本周排期履约与阶段拆分，SHOULD）、BR-060（热点雷达——本提案只去伪造，真实来源不属本次） |
| domain | `.context/domain/testing_strategy.md` | 模块 5 场景 4 / 5（BR-050 / BR-051，含 RISK-006 覆盖）与场景 6（历史不足环比为空，BR-052 / RISK-007） |
| domain | `.context/domain/edge_cases.md` | §4「指标与数据异常」（采集失败 → 暂无数据、应采未全成功 → 汇总暂无数据、平台真实 `0` 为有效值、历史不足 → 环比为空）与 §7「界面状态文案」（指标缺失显示「暂无数据」不显示为 `0`），即 spec 中 `null` 值显示语义的依据 |
| architecture (source) | `.context/architecture/source/technical_architecture.md` | §3.1 `workbench.overview` 的权威定义：`comparison` 精确键名与 `period` 取值、窗口增量口径（不是历史总量）、`weeklyPipeline` 自然周（周一起算）与 `prefilled + published` 完成态 |

> 范围说明：评论抓取无结果（`.context/domain/edge_cases.md` §4）对应 BR-054 的 Phase 1 评论与需求反哺闭环，**不在本次指标汇总修复范围**；`feedbackItems` 仅保留既有字段形状，本提案不扩采集。
