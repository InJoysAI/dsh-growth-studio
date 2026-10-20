# 实施任务清单

> 依据 `.context/criterion.md` §6 的 SSoT-first 顺序执行：类型契约（`src/types.ts`）→ 宿主 RPC 契约（`src/ops-rpc.ts`）→ 领域实现（`src/analytics/`）→ 测试。
> 本项目 API 层为「手写 TypeScript 契约」，§7.2 记录的**生成命令为「无」**（自研 RPC 信封，无 schema 源，无 Codegen；一致性由 `pnpm typecheck` + `pnpm test` 保证），故不含 codegen 步骤。
> 对应路线图条目：`openspec/proposal-roadmap-Phase-0.md` 提案 1 / `openspec/proposal-roadmap.md` 索引行 `fix-overview-metrics-null-semantics`。

## 1. SSoT 检查与变更（契约先行）

- [x] 1.1 SSoT 变更判定：本提案**变更** API 层契约（`src/types.ts` + `src/ops-rpc.ts`），须先改契约再改实现（criterion §6）
  - 判定依据：`workbench.overview` 响应补齐字段属宿主 RPC 方法契约变更；数据层/IPC 层/共享层未启用（criterion §2、§7.1），无迁移与 codegen
- [x] 1.2 在 `src/types.ts` 新增 `OverviewMetrics` 契约类型
  - 含 `measuredPlatforms` / `unmeasuredPlatforms` / `totalEngagements` / `totalFavorites` / `comparison` / `weeklyPipeline`
  - `comparison` 形状：`{ period: '7d' | '30d' | null; impressionsDeltaPercent: number | null; playsDeltaPercent: number | null; engagementsDeltaPercent: number | null; followersDeltaPercent: number | null }`
    - 键名与 `period` 取值以权威源 `.context/architecture/source/technical_architecture.md` §3.1 `comparison` 定义为准，**不得**自行更名（如 `total*DeltaPercent`）或放宽 `period` 为宽泛 `string | null`；本提案不改变源契约迎合新命名
  - `weeklyPipeline` 形状：`{ total: number; completed: number; byStatus: Record<ItemStatus, number> }`（`completed` 为 `prefilled + published`）
  - 汇总字段类型一律为 `number | null`（不得为必填数字）
- [x] 1.3 在 `src/types.ts` 的 `PlatformMetrics` 补 `windowStart` / `windowEnd`（ISO 8601，由请求窗口推导的**请求窗口**边界，区别于 `capturedAt` 采集时刻）
  - 契约来源：`.context/architecture/data_architecture.md` `PlatformMetrics` 注；TD-007 解决方案 ①
- [x] 1.4 运行契约校验：`pnpm typecheck`（无 codegen，§7.2「生成命令 = 无」）

## 2. 宿主 RPC 契约层（`src/ops-rpc.ts`）

- [x] 2.1 `workbench.overview` 响应类型对齐 `OverviewMetrics`，补齐 `measuredPlatforms` / `unmeasuredPlatforms` / `totalEngagements` / `totalFavorites` / `comparison` / `weeklyPipeline` 字段
- [x] 2.2 保留既有字段与形状，不引入破坏性变更
  - `productName` / `totalImpressions` / `totalPlays` / `totalLikes` / `totalComments` / `totalShares` / `totalFollowersDelta` / `scheduledCount` / `readyChannelsCount` / `totalChannelsCount` / `metricsAnnotation` / `statuses` / `calendarItems` / `feedbackItems` / `injoysConnected`
- [x] 2.3 移除硬编码热点样例数据（`keyword: 'Agentic AI'` / `heatScore: 95` 等），`trends` 如实返回空数组 `[]`
  - 真实热点来源属外部依赖（PRD 未指定渠道），未提供时不得编造（criterion §3.2）

## 3. 领域实现（`src/analytics/`）

- [x] 3.1 新增 `src/analytics/overview-aggregator.ts`：实现纯函数汇总判定（输入 `PlatformMetricsOutcome[]` + 应采平台集合 `P`，输出 `OverviewMetrics` 汇总部分）
- [x] 3.2 实现**平台级覆盖门**：`measuredPlatforms == P` 才给数字；`measuredPlatforms ⊂ P` 时所有汇总值为 `null`
  - 依据 `.context/architecture/api_strategy.md` §3.1「部分缺失汇总规则」；架构铁律 3
  - `measuredPlatforms` = 成功采集（`source !== 'unmeasured'`）的平台；`unmeasuredPlatforms` = `P` 中其余平台
- [x] 3.3 实现**真实零值参与求和**：平台返回的 `0` 为有效值计入求和；`null` 视为未知，不得按 `0` 计入
- [x] 3.4 实现汇总口径：各汇总值仅在覆盖门通过且至少一个平台贡献非 `null` 时给出数字，否则为 `null`
- [x] 3.5 实现 `totalEngagements` = 点赞 + 评论 + 转发 + 收藏；四项汇总任一为 `null` 时整体 `null`
- [x] 3.6 实现曝光 / 播放口径：只消费 `impressions` / `plays`；不得以兼容字段 `views` 作为缺失指标的真实值（TD-005）
- [x] 3.7 实现 `comparison`：无历史基准来源时 `period` 与各 delta 均为 `null`（落盘基准属 `feat-storage-metrics-snapshot`，本提案不实现）
- [x] 3.8 实现 `weeklyPipeline`：由当前 `calendarItems` 派生 `total` / `completed` / `byStatus`
  - **来源事实**：`calendarItems` 来自既有 Injoys Spreadsheet 读取（`src/injoys/client.ts` 的 `listCalendarItems`），**可能非空**（远端已有历史行），不得假设 Phase 0 必然为空
  - **本周范围**：只统计**本周（自然周，周一起算）**的排期项，跨周的历史行不计入；时间口径沿用宿主既有约定（若需用户时区，先查现有配置，不自行引入系统时区依赖）
  - **零结构判定以「筛选后的本周集合」为准**：当且仅当筛选后本周集合为空（原始列表为空，**或原始列表非空但全部落在上周 / 下周**）时结果为全 `0`；原始列表非空**不得被无条件清空**，也不得跳过本周筛选直接按原始列表计数
  - 不得以估算值填充；本地排期黄金主数据接入仍归 Phase 1 `feat-calendar-generate-list`（B2），本提案不接新数据源
- [x] 3.9 在 `src/analytics/metrics-collector.ts` 为采集结果（含 `live` 与 `unmeasured` 路径）填充 `windowStart` / `windowEnd`
  - 契约形状为必填 `string`（`.context/architecture/data_architecture.md` 的 `PlatformMetrics` 定义），故 **`live` 与 `unmeasured` 两条路径均按同一时刻推导为非空 ISO 8601 值**（与 `capturedAt` 同源生成）；`unmeasured`（无客户端、指标全 `null`）路径同样填非空窗口，禁止两路径静默不一致，也不得因指标全 `null` 而返回 `null`
  - **请求窗口 ≠ 可证实数据周期**：`fetchPlatformMetrics` MUST 接收并透传调用方的 `metricsWindow`（默认 `7d`），停止忽略 `timeRange`；窗口边界由该请求窗口 + 采集发起时刻推导，`capturedAt` 与窗口相互独立、不得互相代替
  - 平台数值贡献 MUST 仅在**可证实属于请求窗口**时计入汇总；无法证实的数据 MUST 保持未知（`null` 贡献）并沿用既有说明字段，**不得**把「今日 / 累计」值标成 `7d` / `30d` 冒充窗口增量；`metricsWindow` 为 `30d` 时不得以标签宣称已真实支持 30d
  - 采集侧页面筛选 / 解析能力的扩展不在本提案范围（归采集能力提案）；本提案不新增错误码，也不因无法证实而整包拒绝 `workbench.overview`
- [x] 3.10 在 `src/ops-rpc.ts` 的 `workbench.overview` 接入 `overview-aggregator`，移除原内联累加逻辑
  - 透传请求参数 `metricsWindow`（未传时默认 `7d`）给 `metricsCollector.fetchPlatformMetrics`，**移除**现有硬编码 `'7d'`（`src/ops-rpc.ts` 的 `workbench.overview` 分支）

## 4. 测试

- [x] 4.1 单元测试（汇总判定纯函数，不依赖 RPC 管道）
  - [x] 4.1.1 「部分缺失 → `null`」：应采 2 平台仅 1 个成功时，汇总值为 `null` 且 `measuredPlatforms` / `unmeasuredPlatforms` 正确填充
  - [x] 4.1.2 「真实 0 参与求和」：平台真实返回 `0` 时计入求和，与 `null` 严格区分
  - [x] 4.1.3 「互动总量口径」：四项任一为 `null` 时 `totalEngagements` 为 `null`；四项齐全时为四项之和
    - `favorites` / `followerDelta` 等可选字段的 `undefined` 与 `null` **等价处理**：缺失即视为未知，不得回退为 `0`；须显式断言该边界
  - [x] 4.1.4 「曝光/播放口径」：视频渠道只贡献 `plays`；`impressions` / `plays` 均 `null` 时不得以 `views`（值为 `0`）计入
  - [x] 4.1.5 「本周排期进度」：固定时钟构造**上周 / 本周 / 下周**三类排期项，仅本周（自然周、周一起算）行计入 `total` / `byStatus`
    - `byStatus` MUST 覆盖 `ItemStatus` 全部五态；`completed` MUST 为 `prefilled + published` 且精确断言
    - **筛选后本周集合为空 → 全 `0`**：分别断言「原始列表为空」与「原始列表非空但全部为上周 / 下周行」两种情况均得 `total = 0` / `completed = 0` / `byStatus` 各态为 `0`；非空原始列表不得被无条件清空
    - 加入本周行后，仅本周行参与计数（上周 / 下周行仍不计入）
- [x] 4.2 集成 / RPC 测试
  - [x] 4.2.1 `workbench.overview` 响应包含新增字段且既有字段未破坏（扩展现有 `tests/ops-manager.spec.ts` 的概要断言）
    - `comparison` MUST 按权威键名逐字断言（`period` / `impressionsDeltaPercent` / `playsDeltaPercent` / `engagementsDeltaPercent` / `followersDeltaPercent`），无历史时 `period` 为 `null` 且各 delta 为 `null`
  - [x] 4.2.2 `workbench.overview` 响应不含硬编码样例热点数据（`trends` 为空数组）
- [x] 4.3 静态校验
  - [x] 4.3.1 `grep` 校验：**校验范围仅限业务汇总逻辑**（`src/analytics/overview-aggregator.ts` 与 `workbench.overview` 分支）不得以 `views` 作为缺失指标的真实值
    - 排除项（不在本条校验范围，须零误报）：`src/analytics/metrics-collector.ts` 对 `views` 的**兼容形状填充**；`src/analytics/review-reporter.ts` 对 `views` 的存量消费（**复盘路径存量债务，当前路线图未确认专门承接提案**，本提案不关闭该债务，也不据此扩改复盘代码）
  - [x] 4.3.2 测试隔离：用例不写入开发者真实 `$DSH_HOME`（`tests/setup-isolation.ts` 模块作用域隔离，criterion §3.5）
  - [x] 4.3.3 运行 `pnpm typecheck`
  - [x] 4.3.4 运行 `pnpm test`

- [x] 4.4 采集器窗口字段测试（在 `MetricsCollector` 实际采集路径验证，与 4.1 纯函数测试分开、不可互相替代）
  - [x] 4.4.1 `live` 与无客户端 `unmeasured` 两条路径均产出非空 ISO 8601 `windowStart` / `windowEnd`，取值口径一致，且不与 `capturedAt` 相互代替
  - [x] 4.4.2 固定时钟分别校验 `7d` / `30d` 窗口的精确边界（ISO 可解析），并断言 `capturedAt` 保持采集时刻
  - [x] 4.4.3 请求窗口穿透：以桩请求 `30d` 时 `workbench.overview` 与采集器均按 `30d` 取窗口（mock 路径可验证）；未传时默认 `7d`
  - [x] 4.4.4 mock 构造与 fixtures 满足新增必填类型（同步补 `windowStart` / `windowEnd`），不新增真实采集能力

> note: 本提案无手动测试脚本需求（无 HTTP 端点新增 / 无 SQL）；验收以单元测试 + `pnpm test` 为准，不提供 curl / SQL 示例。

## 5. 文档与资产一致性

- [x] 5.1 核对 `.context/architecture/api_strategy.md` §3.1 的请求 / 响应示例与本实现一致；如有差异，**经 `.agents/workflows/context-update.md` 流程同步 `.context/` 资产**（禁止手工编辑 `.context/`）
- [x] 5.2 实现完成后按 `.agents/workflows/context-update.md` 刷新 `.context/architecture/risks_and_debt.md` 的 TD-007 状态与 `.context/context-manifest.json`（不得手工编辑）
- [x] 5.3 确认 `openspec/specs/`、`openspec/config.yaml`、`openspec/proposal-roadmap*.md` 无需手工改动（由 `/context-*` 工作流维护）

## 6. 验证与收口

- [x] 6.1 逐条验证 acceptance criteria 已覆盖并通过
  - [x] 6.1.1 部分缺失汇总为空 / 真实零值参与求和 / 互动总量口径 / 曝光·播放口径 / 无伪造数据
  - [x] 6.1.2 四条架构铁律未被触碰：本提案不涉及发布、状态机、存储写入与 Cookie；仅强化铁律 3（不得以不完整数据冒充全网总量）
- [x] 6.2 代码审查
  - [x] 6.2.1 代码规范检查（沿用既有命名与错误码，不新造近似错误码）
  - [x] 6.2.2 安全性检查（无硬编码凭证 / 无新增外联 / 无 Cookie 外发）
- [x] 6.3 运行 `node design/context-dev/tools/specflow/specflow.mjs validate fix-overview-metrics-null-semantics --strict`（等价简写：specflow validate fix-overview-metrics-null-semantics --strict）
- [ ] 6.4 运行 `node design/context-dev/tools/specflow/specflow.mjs archive fix-overview-metrics-null-semantics --yes --no-validate`（等价简写：specflow archive fix-overview-metrics-null-semantics --yes --no-validate）
