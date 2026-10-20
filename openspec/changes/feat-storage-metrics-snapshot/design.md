## Context

指标历史快照（`$DSH_HOME/growth-studio/metrics/{YYYY-MM-DD}.json`）在 `.context/architecture/data_architecture.md`、`system_design.md` 与 `api_strategy.md` §3.1 中都是环比基准的权威来源，但 `src/` 下没有任何 `metrics/` 读写实现（TD-010）。`workbench.overview` 的 `comparison` 因此只能恒返 `null`，`criterion.md` §4「历史不足以覆盖完整对比窗口时 delta 必须为 `null`」这条规则缺一个真实存在的目录才成立。

相关权威口径：`.context/criterion.md` §4「环比基准」/「指标真实性」/ §3.5 落盘约束 / §6 SSoT-first；`.context/architecture/api_strategy.md` §3.1「环比基准来源」；`.context/domain/data_strategy.md`「环比走势」；`.context/domain/edge_cases.md` §4；`.context/domain/testing_strategy.md` 模块 5 场景 6；BR-050 / BR-052；RISK-007。

## Goals / Non-Goals

- Goals
  - 让 `metrics/` 目录真实可读写，采集成功后按 `(platform, capturedAt)` 追加快照。
  - 让 `comparison` 的「上一个等长窗口」基准读取与「历史不足 → `null`」判定落地。
  - 复用 `fix-storage-file-permissions` 的统一落盘封装（权限位 + 原子写 + 写锁 + 目录固定 + 统一存储错误码）。
- Non-Goals
  - 不实现 `calendar/` 排期主数据落盘（Phase 1 `feat-storage-calendar-items`）。
  - 不修复指标采集适配器本身的窗口可证性问题。
  - 不提供快照的历史查看 / 恢复界面（`adr_008` 明确 MVP 不提供）。
  - 不新增 RPC 方法或 RPC 字段。

## Decisions

- **Decision: 快照写入复用统一落盘封装，不新增第二套存储路径**
  - 前置 `fix-storage-file-permissions`（已归档 2026-10-20）已把封装落地为 `src/storage/local-fs.ts`（叶子模块）：`FILE_MODE = 0o600` / `DIR_MODE = 0o700`、`mkdirWithMode`（目录创建）、`writeJsonAtomic`（临时文件 + `rename` 原子写）、`createFileWriteLocks()`（按绝对文件路径的串行写锁，每实例一套）。
  - 目录准备 / 可写性校验（`ensureDirectory` / `verifyDirectoryWritable`）与 `DraftStorageError` → `drafts/storage-unavailable` 映射仍由 `draft-store.ts` 导出；指标快照直接复用这两处（`metrics-store.ts` 写失败以 `DraftStorageError` 包装，沿用 A7 归档提案确定的封装分工），避免出现两套权限位 / 错误映射口径。
  - Alternatives considered：在 `metrics-store.ts` 内独立实现写盘与错误映射（被否：重复校验、易与 draft-store 口径漂移，违反 criterion §3.5「绕过 config-store / draft-store 模块直接操作」的约束精神）。

- **Decision: 追加语义以「读-改-写」实现，同日文件只增不改**
  - `metrics/{YYYY-MM-DD}.json` 内容为 `PlatformMetrics[]`；追加时读取当日数组、按 `(platform, capturedAt)` 追加、整体写临时文件后 `rename`。
  - 同一文件的并发追加由按绝对文件路径的串行写锁保证不互相覆盖。
  - Alternatives considered：逐条一行 JSON 追加（被否：与 `data_architecture.md` 声明的 `PlatformMetrics[]` 文件形状不一致）。

- **Decision: 快照只落盘可证实的窗口数据（可证性门）**
  - 仅 `source !== 'unmeasured'` 且 `windowScope === 'verified'` 的采集结果落盘；`windowScope: 'unverified'`（累计 / 昨日口径）与 `source: 'unmeasured'` 不落盘，避免未来「历史充足」时由不可证数据算出环比。
  - 这使快照行保持纯 `PlatformMetrics[]` 形状（`windowScope` 是 `PlatformMetricsOutcome` 的非契约扩展，不入快照），不新增快照行字段。
  - Alternatives considered：快照行扩展持久化 `windowScope` 标记、基准读取时过滤（被否：与 `data_architecture.md` 的 `PlatformMetrics[]` 契约形状不一致，需新增非契约字段）。
  - **上游出处说明**：快照的窗口可证性规则在上游权威文档中**未被约束** —— `.context/architecture/source/technical_architecture.md` §3.1「环比基准来源」与 `.context/architecture/api_strategy.md` §3.1「环比基准来源」只规定「按 `(platform, capturedAt)` 追加」，均未要求过滤 `windowScope: 'unverified'` 结果，属上游口径缺口（提案系忠实复刻该缺口，非自创）。本决策为提案层补口径；待后续 `.agents/workflows/context-update.md` 回填 TAD §3.1 / `api_strategy.md` §3.1 权威表述，届时可据本条追溯。
  - **生产后果（须知）**：当前生产采集路径 `live` 结果的 `windowScope` 均为 `'unverified'`（`api_strategy.md` §3.1「窗口真实性说明」），因此本提案落地后生产路径**暂不会写出快照**、`comparison` 在生产上仍五键 `null`，直到采集侧能产出 `windowScope: 'verified'` 的窗口化数据（属采集能力提案，本提案 Out）。正向路径由测试夹具（`verified` 记录）证明；不把「驾驶舱马上看到非空环比」写进本提案验收。

- **Decision: 环比基准读取落在 `src/analytics/` 纯函数，快照存取落在 `src/storage/`**
  - 与既有 `overview-aggregator.ts` 的分层一致：计算（delta、覆盖判定）纯函数化可脱离 RPC 管道测试，I/O 收敛在 storage 层。
  - 「上一个等长窗口」的判定与 delta 计算在纯函数中完成，输入为当前窗口结果 + 历史记录集合，输出 `MetricsComparison`。
  - Alternatives considered：把环比计算内联在 `ops-rpc.ts` 的 `workbench.overview` 分支（被否：测试隔离成本高，与上一提案的分层决策不一致）。

- **Decision: 「历史不足以覆盖完整对比窗口」按平台级窗口覆盖判定，不按记录条数**
  - 判定规则（可测试）：设应采平台集合 `P`，对每个 `p ∈ P`，在上一个等长窗口内**至少存在一条**已落盘快照记录（因可证性门而必然是 `source !== 'unmeasured'` 且 `windowScope === 'verified'`），且其 `windowStart` / `windowEnd` **等于**该窗口（同一窗口长度）；任一 `p ∈ P` 缺少这样的记录即判定为「历史不足」，对应 delta 为 `null` 且 `period` 为 `null`。
  - **基准选取**：同一 `p` 多条满足时取 `capturedAt` **最新**的一条；禁止跨窗口长度混用（30d 记录不得充当 7d 基准）。这使 `tasks.md` 4.1.4 对同一夹具能给出唯一期望 delta。
  - 与汇总覆盖门（`measuredPlatforms == P`）同源的平台级判定，保持两条口径一致。
  - 不得以部分记录求和后当作基准（RISK-007 描述的误导路径）。
  - Alternatives considered：只要有任意历史记录就计算 delta（被否：会用不完整历史算近似百分比，违反 criterion §4 与 RISK-007）；按记录条数判定（被否：条数不等于窗口覆盖，可能由同一平台多次采集凑数）。

- **Decision: 快照写入失败按统一存储错误码整体失败返回，不回滚已发生的采集副作用**
  - 响应形态以 spec Requirement 2 为准：写盘失败经统一 RPC 错误边界返回 `drafts/storage-unavailable`（`{ ok: false, error: { code: 'drafts/storage-unavailable' } }`），**不得**返回成功信封附带落盘失败标注（否则需新增 RPC 字段，违反「不新增 RPC 字段」承诺）。
  - 「不阻断」仅指**不回滚**已发生的采集副作用（采集本身已成功，回滚会让真实指标数据丢失，扩大阻断范围）；响应形态仍是失败信封，调用方据此识别「未落盘」。
  - Alternatives considered：成功信封 + 落盘失败标注字段（被否：需新增 RPC 字段，违反提案承诺）；写盘失败时整体回滚采集结果（被否：局部失败不自动阻断无关操作）。

## Risks / Trade-offs

- **首次使用 / 历史不足时全部 delta 为 `null`**：属预期行为（RISK-007 应急预案），UI 显示「暂无环比」而非 0%；测试以此为准。
- **可证性门致生产空盘**：当前生产 `live` 全为 `unverified`，本提案在生产上暂不落盘、`comparison` 仍恒 `null`，直到采集能力补齐窗口化采集；正向路径由测试夹具证明，验收不依赖 live 页面产出非空 `comparison`。
- **同日并发追加**：依赖按绝对文件路径的串行写锁；锁粒度为单个日文件，不跨文件阻塞。
- **历史窗口覆盖判定依赖快照完整性**：若用户中途删除历史文件，环比退化为 `null`（如实反映历史不足），不自动补齐。

## Migration Plan

无数据迁移。`metrics/` 目录首次写入时创建；不回填历史、不迁移既有数据。前置提案 `fix-storage-file-permissions` 已归档（2026-10-20），本提案直接复用其落地的 `src/storage/local-fs.ts` 封装。

## Open Questions

- 无。「完整对比窗口」的最小记录要求已落为可测试判定（见 Decisions 第 4 条：每个 `p ∈ P` 在上一个等长窗口内至少一条 `windowStart` / `windowEnd` **等于**该窗口（同一窗口长度）且可证性达标的快照记录）。
