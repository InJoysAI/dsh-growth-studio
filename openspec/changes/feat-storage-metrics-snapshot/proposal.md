# Change: 指标历史快照落盘（环比基准）

## Why

`workbench.overview` 的 `comparison` 环比字段目前只能恒为 `null`：`$DSH_HOME/growth-studio/metrics/` 指标历史快照**没有任何读写实现**（`.context/architecture/risks_and_debt.md` TD-010，严重性中）。`data_architecture.md`、`system_design.md` 与 `api_strategy.md` §3.1 都把 `metrics/{YYYY-MM-DD}.json` 列为环比基准的权威来源，`criterion.md` §4「环比基准」也以该目录为口径，但 `src/` 下只有 `src/storage/draft-store.ts` 与 `src/config-store.ts` 执行落盘，指标历史无处可存、无处可读。

这带来三类具体问题：

- **环比口径无从生效**：`criterion.md` §4「历史不足以覆盖完整对比窗口时 delta 必须为 `null`」需要目录真实存在才有意义；目录缺失时该规则恒成立，永远无法验证「历史充足 → delta 计算正确」这条正向路径（RISK-007 的缓解措施 ①②③ 也因此只停留在文档）。
- **文档与实现落差**：读者按 `data_architecture.md` 的布局表会误以为指标历史已落盘（TD-010「影响」明文记录）。
- **环比基准取自次级留存**：`.context/domain/data_strategy.md`「环比走势」的数据源为「本地保存的历史指标快照」，未落盘则该数据源为空集。

前置依赖 `fix-overview-metrics-null-semantics`（A1）已归档：`PlatformMetrics` 窗口字段、`comparison` 契约键名与「部分缺失 → `null`」判定已落地，环比基准现在才有正确的消费方。前置 `fix-storage-file-permissions` 提供统一落盘封装的权限位（`mode: 0o600` / `0o700`），本提案的快照写入必须复用该封装，不得自设第二套落盘口径。

## What Changes

### 新增功能

- `src/storage/` 新增指标历史快照读写服务（`metrics-store.ts`）：维护 `$DSH_HOME/growth-studio/metrics/{YYYY-MM-DD}.json`，采集成功后按 `(platform, capturedAt)` 追加写入当日文件，同日重复追加不丢弃既有记录。
- **落盘可证性门**：仅 `source !== 'unmeasured'` 且 `windowScope === 'verified'` 的采集结果落盘；不可证实的累计 / 昨日口径结果不落盘，避免未来「历史充足」时由不可证数据算出环比（快照行保持纯 `PlatformMetrics[]` 形状，不新增字段）。
- `workbench.overview` 的 `comparison` 接入真实基准：按请求窗口 `metricsWindow`（`'7d'` / `'30d'`）读取**上一个等长窗口**的快照作为对比基准，计算 `impressionsDeltaPercent` / `playsDeltaPercent` / `engagementsDeltaPercent` / `followersDeltaPercent`，`period` 置为对应的 `'7d'` / `'30d'`。
- **「历史充足」判定（可测试）**：对每个应采平台 `p ∈ P`，在上一个等长窗口内至少有一条 `windowStart` / `windowEnd` 完整覆盖该窗口且可证性达标的快照记录；任一平台缺失即为「历史不足」，对应 delta 为 `null` 且 `period` 为 `null`（「暂无环比」），不得用不完整历史算近似百分比。

### 修改功能

- 指标采集成功路径（`ops_fetch_metrics` 与 `workbench.overview` 共用的 `MetricsCollector` 调用方）在采集完成后追加快照写入；写入失败按统一存储错误口径如实上报（整体调用以 `drafts/storage-unavailable` 失败信封返回），不得虚报成功（criterion §3.2）。
- 环比 delta 为纯函数计算，落于 `src/analytics/`，与既有汇总判定同层，可脱离 RPC 管道测试。

### 技术实现

- 按 SSoT-first（`.context/criterion.md` §6）：`src/types.ts` 先补快照行的契约类型，再落 `src/storage/metrics-store.ts` 与 `src/analytics/` 的环比计算，最后接入 `src/ops-rpc.ts` / `src/tools/index.ts` 与测试。本项目 API 层为手写 TypeScript 契约，§7.2「生成命令 = 无」，一致性由 `pnpm typecheck` + `pnpm test` 保证。
- 快照写入复用 `fix-storage-file-permissions` 的统一落盘封装（临时文件 + `rename` 原子写、按绝对文件路径的串行写锁、目录 `0o700` / 文件 `0o600`、写盘失败统一映射 `drafts/storage-unavailable`）；目录在单次操作内固定，不在 `await` 之后重新解析。
- 只追加、不修改历史记录；不提供历史查看 / 恢复界面（MVP 不提供快照历史 UI，见 `adr_008_version_snapshot_storage.md`——该 ADR 裁决的是**草稿**版本快照，并明文保留运营指标历史）。
- 无破坏性变更：`comparison` 键名与 `period` 取值沿用 `.context/architecture/source/technical_architecture.md` §3.1，不新增 RPC 方法、不新增 RPC 字段。

### 不在本次范围（Out of Scope）

- `calendar/` 排期主数据落盘（`feat-storage-calendar-items`，Phase 1）。
- 指标采集适配器本身的修复（平台页面口径为累计 / 昨日、窗口不可证实的问题归采集能力提案；本提案消费既有 `PlatformMetricsOutcome`）。
- 快照的历史查看 / 恢复界面（MVP 不提供，见 `adr_008`）。
- `weeklyPipeline` 的真实排期数据接入（Phase 1 `feat-calendar-generate-list`）。

## Impact

### 涉及的规范（Specs）

- **新增**：`specs/metrics-history/spec.md` — 指标历史快照的追加写入（含落盘可证性门）、按 `(platform, capturedAt)` 唯一追加且不丢弃既有记录、写盘失败统一错误口径、上一个等长窗口基准读取、历史不足时 delta 为 `null`、目录固定语义。
- **修改**：`specs/workbench-overview/spec.md` — 「覆盖标注与环比 / 本周排期字段契约」中环比部分由「无历史快照时五键为 `null`」扩展为「接真实基准后按覆盖情况给出 delta，不足时仍为 `null`」。

### 涉及的代码

- **新增**：
  - `src/storage/metrics-store.ts`（指标历史快照读写服务）
  - `src/analytics/metrics-comparison.ts`（上一个等长窗口基准与 delta 计算纯函数）
  - `tests/metrics-snapshot.spec.ts`（落盘与环比用例）
- **修改**：
  - `src/types.ts`（快照行契约类型）
  - `src/ops-rpc.ts`（`workbench.overview` 采集成功后追加快照、`comparison` 消费基准）
  - `src/tools/index.ts`（`ops_fetch_metrics` 采集成功后追加快照，并校正工具描述提及本地 `metrics/` 落盘）
- **不修改（由前置提案 `fix-storage-file-permissions` 提供）**：
  - `src/storage/draft-store.ts` / `src/config-store.ts` 的权限位（`mode: 0o600` / `0o700`）改动归前置提案；本提案仅**调用**其统一落盘封装（原子写 + 写锁 + 目录准备 / 可写性校验 + `DraftStorageError` → `drafts/storage-unavailable`），不重复修改这两文件。若实施需从中抽取可导出写盘原语供 `metrics-store.ts` 调用，属前置提案的实现细节，不在本提案 diff 范围。

### 依赖关系

- **依赖**：`fix-overview-metrics-null-semantics`（已完成，`comparison` 契约与汇总判定的消费方）；`fix-storage-file-permissions`（**显式前置**，统一落盘封装的 `mode` 权限位；须先于本提案完成）。
- **被依赖**：`feat-client-dashboard`（Phase 3 驾驶舱消费 `comparison`）。
- **约束**：快照写入须经统一落盘封装，复用 `drafts/storage-unavailable` 类错误映射口径；不得绕过 `config-store` / `draft-store` 模块直接操作文件（criterion §3.5）。

### 风险与注意事项

- **首次使用与历史不足时全部 delta 为 `null` 被误报为缺陷**：依 RISK-007 应急预案，`null` 属**预期行为**，UI 显示「暂无环比」而非 0%；测试以此为准。
- **以不完整历史算近似百分比**：历史快照不足以覆盖完整上一个等长窗口时必须整体 `null`，不得部分求和后当作基准（RISK-007 描述的误导路径）。
- **不可证数据冒充窗口基准**：落盘可证性门确保只有 `source !== 'unmeasured'` 且 `windowScope === 'verified'` 的结果进入快照，避免未来由累计口径历史算出环比。
- **快照写入失败影响采集返回**：写盘失败须如实报错（统一 `drafts/storage-unavailable` 失败信封，不回滚已发生的采集副作用），不得静默吞掉后继续宣称「已落盘」；这是新增的存储写入口，必须纳入统一 RPC 错误边界。
- **同日多次采集的并发回写**：按绝对文件路径的串行写锁 + 临时文件 `rename` 原子替换，避免并发覆盖既有快照行。
- **前置提案未完成即实施的风险**：`fix-storage-file-permissions` 是显式硬前置，须先落地统一落盘封装的权限位；本提案不重复修改 `draft-store.ts` / `config-store.ts`，避免两提案重叠改同一文件。

### 验证标准

- ✅ 采集成功后 `metrics/{YYYY-MM-DD}.json` 按 `(platform, capturedAt)` 追加写入，同日重复追加不丢既有记录（单元测试 + 文件断言）。
- ✅ 不可证实（`windowScope: 'unverified'`）的结果不落盘，历史看似充足时 delta 仍为 `null`（单元测试）。
- ✅ 历史不足以覆盖完整对比窗口时 delta 为 `null`，不编造近似值（单元测试）。
- ✅ 历史充足时 delta 按「上一个等长窗口」基准计算正确（单元测试）。
- ✅ 单次操作内目录固定，配置切换只对新操作生效（单元测试，参照 criterion §3.5）。
- ✅ 新建快照文件权限为 `0o600`、目录 `0o700`（复用统一落盘封装的权限位，`stat().mode` 断言）。
- ✅ 快照写入失败时调用以 `drafts/storage-unavailable` 失败信封返回（单元测试断言 `error.code`）。
- ✅ `pnpm typecheck` + `pnpm test` 通过。

### 提案大纲对齐（Roadmap Alignment）

| 字段 | 内容 |
|------|------|
| roadmap_source_primary | `openspec/proposal-roadmap.md` |
| roadmap_source_supplement | `openspec/proposal-roadmap-Phase-0.md`（提案 2 正文） |
| phase | Phase 0（安全与数据真实性修复） |
| change_id | `feat-storage-metrics-snapshot` |
| business_goal | ① 落地 `$DSH_HOME/growth-studio/metrics/{YYYY-MM-DD}.json` 指标历史快照，使环比有真实基准而非恒 `null` 占位；② 使 criterion §4「历史不足以覆盖完整对比窗口时 delta 必须为 `null`」在目录真实存在的前提下成立并可验证 |
| dependencies | 前置：`fix-overview-metrics-null-semantics`、`fix-storage-file-permissions`；被依赖：`feat-client-dashboard` |
| acceptance_criteria | 快照落盘（按 `(platform, capturedAt)` 追加）/ 历史不足为 `null` / 目录固定语义 |

### 关联 Context 资产

| Scope | 资产路径 | 关联说明 |
|-------|---------|---------|
| criterion | `.context/criterion.md` | §4「环比基准」与指标真实性口径、§3.5 落盘约束（原子写、写锁、目录固定、统一错误码、权限位）、§6 SSoT-first、§5.5 `PlatformMetrics` |
| architecture | `.context/architecture/risks_and_debt.md` | TD-010（`metrics/` 持久化契约未落地，本提案偿还其 metrics 部分）、TD-013（权限位，前置提案提供）、RISK-007（环比基准不可用误读） |
| architecture | `.context/architecture/data_architecture.md` | `metrics/{YYYY-MM-DD}.json` 布局（`PlatformMetrics[]`，按 `(platform, capturedAt)` 追加，供环比）与「指标快照按日分文件」分区策略 |
| architecture | `.context/architecture/api_strategy.md` | §3.1「环比基准来源」权威口径（上一个等长窗口、历史不足 → `null`）与 `workbench.overview` 契约 |
| architecture | `.context/architecture/adr_008_version_snapshot_storage.md` | 草稿版本快照取消但「运营指标历史仍保留，用于环比」的边界裁决 |
| domain | `.context/domain/business_rules.md` | BR-050（指标真实性与可空语义，MUST）、BR-052（互动与关注增长汇总含环比走势，SHOULD） |
| domain | `.context/domain/data_strategy.md` | 「环比走势」数据源 = 本地保存的历史指标快照；历史不足时环比显示为空不得编造 |
| domain | `.context/domain/edge_cases.md` | §4「历史数据不足以覆盖对比窗口 → 环比走势显示为空」 |
| domain | `.context/domain/testing_strategy.md` | 模块 5 场景 6「历史不足时环比为空」（BR-052 / RISK-007）及其自动化范围注记 |
| architecture (source) | `.context/architecture/source/technical_architecture.md` | §3.1「环比基准来源（已明确）」与 §5.3 本地数据布局的权威定义 |
