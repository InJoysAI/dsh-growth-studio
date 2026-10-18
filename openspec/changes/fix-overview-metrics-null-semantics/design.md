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
  - 现状汇总逻辑内联在 `ops-rpc.ts` 的 `workbench.overview` 分支中，而 `metricsCollector` 在处理器工厂内构造，直接对「部分缺失 / 真实 0」做单元测试的隔离成本较高。
  - 纯函数（`outcomes + 应采平台集合 P → 汇总部分`）可独立测试，避免经由 RPC 管道。
  - Alternatives considered：在 `ops-rpc.ts` 内联实现（被否：测试隔离成本较高、与既有 `analytics/` 分层不符）。

- **Decision: 覆盖门是「平台级」，不是「指标级」**
  - `.context/architecture/api_strategy.md` §3.1 与 `testing_strategy.md` 模块 5 场景 5 均以**应采平台集合** `P`（2 个渠道）为准：`measuredPlatforms == P` 才给数字。
  - 一个平台是否被采集成功由 `PlatformMetricsOutcome.source` 判定（`'unmeasured'` 为失败）；`measuredPlatforms` / `unmeasuredPlatforms` 由 `P` 与结果求差得出。
  - `mock` 出处仅用于测试（`mockOffline` 默认 `false`），本提案将其视同已测量。
  - Alternatives considered：改成**指标级**覆盖门（逐指标要求所有平台均支持该指标才汇总）（被否：`.context/criterion.md` §4 与 `api_strategy.md` §3.1 只定义平台级 `P`，未定义按指标扩展应采集合的机制；且图文 / 视频主口径不同，指标级门会误伤混合渠道的合法汇总）。

- **Decision: 覆盖门通过后，各汇总值为该指标非 `null` 贡献之和；无任何贡献者为 `null`**
  - 不同平台的主口径不同（BR-051：图文/推文用 `impressions`、视频用 `plays`），因此对某平台不适用的指标其值为 `null`（如视频平台的 `impressions`），不属于「部分缺失」。
  - 若某指标无任何平台贡献（全 `null`），汇总值为 `null` 而非 `0`（`0` 是真实零值，`null` 是未知）。
  - `totalEngagements` 额外严格：点赞 / 评论 / 转发 / 收藏四项汇总任一为 `null` 时整体 `null`（该「第 5 项」编号见 `.context/architecture/api_strategy.md` §3.1「部分缺失汇总规则」第 5 条与 `.context/architecture/constraints.md`「铁律 3 的口径规则」第 5 条；源文档 §3.1 同）。
  - Alternatives considered：把缺失贡献按 `0` 计入（被否：`0` 是真实零值，混同会把「未知」伪造成确定数字，违反 `.context/criterion.md` §3.2）。

- **Decision: `comparison` 无历史基准时如实返回空；`weeklyPipeline` 从既有 `calendarItems` 派生本周计数**
  - `comparison`：无历史基准来源时 `period: null` 且各 delta `null`（RISK-007：`null` 属预期行为）；基准读取与落盘属 `feat-storage-metrics-snapshot`。
  - `weeklyPipeline`：从**既有 Injoys 读取得到的 `calendarItems`**（`src/injoys/client.ts` 的 `listCalendarItems`）派生 `{ total, completed, byStatus }`；该列表**可能非空**，不得假设 Phase 0 必然为空。**只统计本周（自然周、周一起算）行**，跨周与远端历史行不计入；**零结构以筛选后的本周集合为准**——当且仅当筛选后本周集合为空（原始列表为空，**或原始列表非空但全部落在上周 / 下周**）时结果为全 `0`，原始列表非空**不得被无条件清空**。完成态为 `prefilled + published`。本地排期黄金主数据接入由 Phase 1 `feat-calendar-generate-list` 承接，本提案不新增数据源。
  - Alternatives considered：本提案一并实现快照落盘（被否：与 `feat-storage-metrics-snapshot` 重复建设，且落盘需先有 `fix-storage-file-permissions` 的权限封装）。

- **Decision: `PlatformMetrics` 增加 `windowStart` / `windowEnd`，由收集器按「请求窗口」填充，并与「可证实的数据周期」分离**
  - 解决「采集时刻 ≠ 指标所属周期」歧义（`data_architecture.md` 明确二者是两个独立概念）。
  - **请求窗口贯穿调用**：`workbench.overview` MUST 把请求参数 `metricsWindow`（默认 `'7d'`）传给 `metricsCollector.fetchPlatformMetrics`，**不得**硬编码 `'7d'`；窗口边界由该请求窗口 + 采集发起时刻推导。
  - `windowStart` / `windowEnd` 描述**请求窗口**，本身不构成「数值属于该窗口」的证明；`capturedAt` 字段保持不变。
  - **数据周期真实性**：平台的数值贡献 MUST 仅在**可证实该数据属于请求窗口**时计入汇总；无法证实的数据 MUST 保持未知（`null` 贡献）并沿用既有说明字段，MUST NOT 把「今日 / 累计」值重新标成 `7d` / `30d` 充当窗口增量（`api_strategy.md` §3.1「窗口」为增量口径，非历史总量）。
  - 契约形状为**必填 `string`**（`data_architecture.md` 的 `PlatformMetrics` 定义，非可空），故 `live` 与 `unmeasured`（无客户端、指标全 `null`）路径**均**推导为非空 ISO 8601 窗口值，与 `capturedAt` 同源生成；不因指标全 `null` 而把窗口置 `null`，两路径口径一致。
  - 采集侧页面筛选 / 解析能力（使数值可证属于窗口）的扩展不在本提案范围，归采集能力提案；本提案不新增错误码，也不因无法证实而整包拒绝 `workbench.overview`。
  - Alternatives considered：仅生成正确 ISO 字符串即宣称已支持 `7d` / `30d`（被否：会把非窗口数据冒充窗口增量，属真实性缺口）；把窗口字段改为可空 / `null`（被否：与 `data_architecture.md` 的必填契约冲突，且把「请求时间边界」误当「未知数值」）。

- **Decision: 移除硬编码热点样例数据，`trends` 返回空数组**
  - 真实热点来源属外部依赖（PRD 未指定渠道），未提供时如实返回空优于假数据（criterion §3.2）。
  - Alternatives considered：保留样例热点待真实来源接入（被否：属伪造指标数据，违反 `.context/criterion.md` §3.2；真实热点来源明确后另行提案）。

## Risks / Trade-offs

- 移除硬编码热点后 `trends` 变空 → 驾驶舱热点区短期为空；以「空值优于假数据」接受，真实来源明确后另行提案。
- 采用平台级覆盖门 + 「无贡献者即 `null`」的口径，意味着混合渠道下 `totalImpressions` 可能因无图文渠道贡献而为 `null`；这是**如实**结果，不是缺陷（与「不把兼容字段 `views` 当真实值」一致）。
- 窗口字段只描述**请求窗口**，不证明数值周期；若采集侧暂无法证实某数据属于该窗口，其贡献保持 `null`（未知）并沿用既有说明，本提案不因此扩展采集能力、不新增错误码、不整包拒绝总览。
- `weeklyPipeline` 为「本周派生结构」→ 不得对外宣称已具备完整排期聚合；该结构可能非空，跨周行不计入，筛选后本周集合为空时才为全 `0`，Phase 1 接入本地主数据时只替换数据来源，不改契约。

## Migration Plan

- 无数据迁移。契约为**向后兼容的字段新增**：既有响应字段全部保留。
- 落地顺序（SSoT-first）：`src/types.ts` → `src/ops-rpc.ts` → `src/analytics/` → 测试 → `pnpm typecheck` + `pnpm test`。
- 无 Codegen（criterion §7.2「生成命令 = 无」）。
- 实现后按 `.agent/workflows/context-update.md` 刷新 `.context/` 资产（TD-007 状态、`context-manifest.json`），不得手工编辑 `.context/`。

## Open Questions

- 无阻塞项。`totalImpressions` / `totalPlays` 在混合渠道下的期望集合口径已按上述 Decision 收敛；若产品负责人后续要求「按渠道类型拆分期望集合」，属契约细化，另开提案。
