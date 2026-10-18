## Context

`workbench.overview` 的方法已在 `src/ops-rpc.ts` 登记，但响应字段与 `.context/architecture/api_strategy.md` §3.1 的契约不一致，且**未实现部分缺失汇总语义**（TD-007，严重性高，触碰架构铁律 3）。本提案按 SSoT-first 补齐契约与判定。相关权威口径：`.context/criterion.md` §3.2 / §4 / §5.5 / §6；`api_strategy.md` §3.1；`data_architecture.md` 的 `PlatformMetrics` 注；BR-050 / BR-051 / BR-052。

现状关键事实：
- `MetricsCollector.fetchPlatformMetrics()` 已返回带出处的 `PlatformMetricsOutcome[]`（`source: 'live' | 'unmeasured' | 'mock'`），并已实现「无客户端时如实返回 `unmeasured` 空值」——即**采集侧的 `null` 语义已就位**，缺口在**汇总侧**。
- `PlatformMetrics` 已有可空的 `impressions` / `plays`，兼容字段 `views`（`impressions ?? plays ?? 0`）。
- `PlatformMetrics` **缺少** `windowStart` / `windowEnd`（源文档 §4.1 已定义，实现待补）。

## Goals / Non-Goals

- Goals
  - 让汇总侧满足「部分缺失 → `null`、真实 `0` 参与求和、`totalEngagements` 子项严格 `null`」。
  - 补齐 `OverviewMetrics` 与 `PlatformMetrics` 窗口字段契约，为 Phase 3 驾驶舱与 `feat-storage-metrics-snapshot` 提供消费面。
  - 移除 `workbench.overview` 中的硬编码热点样例数据。
- Non-Goals
  - 不实现指标历史快照落盘（`feat-storage-metrics-snapshot`）。
  - 不接入真实排期数据（Phase 1 `feat-calendar-generate-list`）。
  - 不修复采集适配器本身（平台采集失败不在本提案范围）。
  - 不做客户端 UI。

## Decisions

- **Decision: 汇总判定下沉为 `src/analytics/` 的纯函数（`overview-aggregator.ts`）**
  - 现状汇总逻辑内联在 `ops-rpc.ts` 的 `workbench.overview` 分支中，而 `metricsCollector` 在处理器工厂内构造，难以对「部分缺失 / 真实 0」做直接单元测试。
  - 纯函数（`outcomes + 应采平台集合 P → 汇总部分`）可独立测试，避免经由 RPC 管道。
  - Alternatives considered：在 `ops-rpc.ts` 内联实现（被否：不可直接测试、与既有 `analytics/` 分层不符）。

- **Decision: 覆盖门是「平台级」，不是「指标级」**
  - `.context/architecture/api_strategy.md` §3.1 与 `testing_strategy.md` 模块 5 场景 5 均以**应采平台集合** `P`（2 个渠道）为准：`measuredPlatforms == P` 才给数字。
  - 一个平台是否被采集成功由 `PlatformMetricsOutcome.source` 判定（`'unmeasured'` 为失败）；`measuredPlatforms` / `unmeasuredPlatforms` 由 `P` 与结果求差得出。
  - `mock` 出处仅用于测试（`mockOffline` 默认 `false`），本提案将其视同已测量。

- **Decision: 覆盖门通过后，各汇总值为该指标非 `null` 贡献之和；无任何贡献者为 `null`**
  - 不同平台的主口径不同（BR-051：图文/推文用 `impressions`、视频用 `plays`），因此对某平台不适用的指标其值为 `null`（如视频平台的 `impressions`），不属于「部分缺失」。
  - 若某指标无任何平台贡献（全 `null`），汇总值为 `null` 而非 `0`（`0` 是真实零值，`null` 是未知）。
  - `totalEngagements` 额外严格：点赞 / 评论 / 转发 / 收藏四项汇总任一为 `null` 时整体 `null`（criterion §4）。

- **Decision: `comparison` 与 `weeklyPipeline` 本提案只落契约，如实返回空**
  - `comparison`：无历史基准来源时 `period: null` 且各 delta `null`（RISK-007：`null` 属预期行为）；基准读取与落盘属 `feat-storage-metrics-snapshot`。
  - `weeklyPipeline`：从当前 `calendarItems` 派生 `{ total, completed, byStatus }`；Phase 0 无本地排期主数据，得到零值结构，真实数据由 Phase 1 接入。
  - Alternatives considered：本提案一并实现快照落盘（被否：与 `feat-storage-metrics-snapshot` 重复建设，且落盘需先有 `fix-storage-file-permissions` 的权限封装）。

- **Decision: `PlatformMetrics` 增加 `windowStart` / `windowEnd`，由收集器填充**
  - 解决「采集时刻 ≠ 指标所属周期」歧义（`data_architecture.md` 明确二者是两个独立概念）。
  - 窗口由 `metricsWindow`（`7d` / `30d`）与采集发起时刻推导；`capturedAt` 字段保持不变。
  - 契约形状为**必填 `string`**（`data_architecture.md` 的 `PlatformMetrics` 定义，非可空），故 `live` 与 `unmeasured`（无客户端、指标全 `null`）路径**均**推导为非空 ISO 8601 窗口值，与 `capturedAt` 同源生成；不因指标全 `null` 而把窗口置 `null`，两路径口径一致。

- **Decision: 移除硬编码热点样例数据，`trends` 返回空数组**
  - 真实热点来源属外部依赖（PRD 未指定渠道），未提供时如实返回空优于假数据（criterion §3.2）。

## Risks / Trade-offs

- 移除硬编码热点后 `trends` 变空 → 驾驶舱热点区短期为空；以「空值优于假数据」接受，真实来源明确后另行提案。
- 采用平台级覆盖门 + 「无贡献者即 `null`」的口径，意味着混合渠道下 `totalImpressions` 可能因无图文渠道贡献而为 `null`；这是**如实**结果，不是缺陷（与「不把 pads 当真实值」一致）。
- `weeklyPipeline` 暂为派生零值结构 → 不得对外宣称已具备排期聚合；Phase 1 接入时只替换数据来源，不改契约。

## Migration Plan

- 无数据迁移。契约为**向后兼容的字段新增**：既有响应字段全部保留。
- 落地顺序（SSoT-first）：`src/types.ts` → `src/ops-rpc.ts` → `src/analytics/` → 测试 → `pnpm typecheck` + `pnpm test`。
- 无 Codegen（criterion §7.2「生成命令 = 无」）。
- 实现后按 `.agent/workflows/context-update.md` 刷新 `.context/` 资产（TD-007 状态、`context-manifest.json`），不得手工编辑 `.context/`。

## Open Questions

- 无阻塞项。`totalImpressions` / `totalPlays` 在混合渠道下的期望集合口径已按上述 Decision 收敛；若产品负责人后续要求「按渠道类型拆分期望集合」，属契约细化，另开提案。
