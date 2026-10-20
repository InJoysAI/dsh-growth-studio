# feat-storage-metrics-snapshot 修复后独立核查

核查日期：2026-10-20（Asia/Shanghai）。核查对象为当前工作区，包含已有暂存修复；不沿用上一轮结论。

## 综合结论

**【核查通过】（PASS）**。当前未闭合缺陷：P0：0，P1：0，P2：0。

本轮对 D8–D10 修复重新核对代码、两条新增回归及文档，并重新执行全部指定验证命令。三项均闭合，无跳过修复项。D1、D3–D7 的已有修复继续通过专项回归，D2 维持撤回。

- 层 1（SSoT）：类型、环比字段、落盘门、窗口匹配和统一存储封装符合要求；两个复合入口均在首次 await 前捕获目录并贯穿存储读写，D8 已闭合。
- 层 2（可复现验收）：指定用例真实存在并通过，D4、D5、D7 均有直接证据；新增 RPC 与工具入口的 home 切换回归均断言旧操作只写 A，不写 B。
- 层 3（边界与风险）：范围没有扩至 calendar、采集页面可证性、快照 UI 或 weeklyPipeline 主数据；路线图及文档状态现与实现一致，D9、D10 已闭合。

## 范围与权威来源

按顺序读取 `.context/criterion.md`、`.context/AGENTS.md`、`.context/context-manifest.json`。核对新增与修改的宿主实现、专项测试、提案 proposal/design/tasks、两份 change spec，以及关联的 API、数据、运行时、风险、测试策略、业务规则、数据策略、边缘场景和 ADR-008。补查 `openspec/proposal-roadmap.md` 本条索引及 `openspec/proposal-roadmap-Phase-0.md` 提案 2。

约束以 criterion §3.2、§3.5、§4、§5.5、§6、§7 为准；工作流参考 `.agents/workflows/context-check.md` 与 `design/context-dev/check/{AGENTS.md,review/AGENTS.md}`。本轮仅更新本报告，不修改用户修复的代码、提案正文、任务、设计或 spec，不执行归档。上一轮临时复现测试已删除；本轮验证的是用户提交到专项文件的永久回归。

## 验证命令与实际结果

以下均重新执行，退出码均为 0：

- `pnpm typecheck`：`tsc -p tsconfig.json --noEmit` 通过。
- `pnpm test`：**8 个文件、132 个用例通过**。
- `pnpm test tests/metrics-snapshot.spec.ts`：**1 个文件、23 个用例通过**。
- `node design/context-dev/tools/specflow/specflow.mjs validate feat-storage-metrics-snapshot --strict`：`✅ OK`。
- `bash design/context-dev/scripts/check-context-manifest.sh`：Manifest 5424/32768 bytes；45 条 flat events；通过。此脚本不检查自然语言事实一致性。

本机为 POSIX，实际 UID=1000；两条 `chmod 0o500` 用例的 win32/root 提前返回条件均为 false，真实权限失败路径已执行。全量测试输出的 BrowserOS 工具未注册提示与 SQLite experimental warning 未导致失败，不表示访问了生产采集页面。

`tasks.md` 的 checkbox 检索仅发现 6.4 归档未勾选；其余均为 `[x]`，形式符合预期。4.1.5 已补明 RPC / 工具入口在首次 await 前捕获目录，与实现和新增回归一致。

## MUST / MUST NOT 合规矩阵（逐项记录）

- ✅ criterion §5.5/§6/§7.2：`src/types.ts:185` 的 `MetricsSnapshotFile = PlatformMetrics[]`；`:206` 的 `MetricsComparison` 保持五键，`period` 为 `'7d' | '30d' | null`。`src/ops-rpc.ts:550` 消费领域函数；无另造 delta 键或 Codegen。当前结构与契约一致；静态核查不把任务勾选当作历史提交先后顺序的证明。
- ✅ §3.5 原子写、写锁、权限：`src/storage/metrics-store.ts:77` 以下持有 `createFileWriteLocks()`，同文件锁内读取、concat、`writeJsonAtomic`。`verifyDirectoryWritable` 经 `src/storage/draft-store.ts:146` → `ensureDirectory` → `mkdirWithMode`；数据文件写入走 `src/storage/local-fs.ts`。探测文件复用既有封装，没有新增第二套权限实现。本轮工作区 `draft-store.ts`、`config-store.ts` 相对 HEAD 无差异。
- ✅ §3.2/§4 真实性：`src/storage/metrics-store.ts:36` 明确要求 `source === 'live' && windowScope === 'verified'`；mock、unmeasured、unverified 不进入生产 metrics 根。`src/analytics/metrics-collector.ts:168,256` 的生产 live 仍是 unverified，生产空盘符合预期。
- ✅ §4 环比：`src/analytics/metrics-comparison.ts:59` 按 UTC 日期及窗口天数匹配；`:76` 先取 `|windowEnd-prev.windowEnd|` 最小，再以 capturedAt 最新破同距并列；没有 ISO 全等门。
- ✅ §4 覆盖：`compareMetrics` 逐个 expected platform 选完整记录，缺任一整条记录返回五键 null；平台记录齐全之后，各口径 skip null，与 `overview-aggregator` 一致。互动四项汇总任一未知时互动总量未知；零基准到非零当前值不编造百分比。
- ✅ §3.2/§3.5 失败信封：存储失败包装 `DraftStorageError`，`src/ops-rpc.ts:704` 统一映射 `drafts/storage-unavailable`，不返回成功。采集已发生的副作用不回滚。
- ✅ §3.5 固定路径与测试隔离：默认目录经 `resolveDshHome()`，没有依赖 draftsDir；`vitest.config.ts` 的 setupFiles 在收集前执行 `tests/setup-isolation.ts`，专项存储夹具均使用临时目录。
- ✅ §3.5 跨 await 目录固定：`src/ops-rpc.ts:509` 在 case 入口捕获 metricsDir，早于 BrowserOS/采集/Injoys 的 await；`:540-541` 使用同一目录追加和读取。`src/tools/index.ts:506` 在 execute 第一行捕获，`:519` 贯穿追加。
- ✅ §3.2/§3.4/§4 范围与安全：本变更未引入自动发布、Cookie 外发、凭证硬编码、新网络监听、持久连接或后台轮询；未改客户端外部服务调用边界。

## 验收标准完成矩阵（逐项判定）

以下测试路径均为 `tests/metrics-snapshot.spec.ts`，专项 23 个用例已全部复跑。

1. ✅ 同日追加不丢既有记录：`:88`，`appends verified rows by (platform, capturedAt) and keeps earlier rows`；检查两次采集均保留，磁盘行没有 source/windowScope 扩展。
2. ✅ unverified 不落盘、完整历史仍可 delta null：`:107`，`does not persist unverified, unmeasured, or mock outcomes`；`:459`，`does not persist unverified current rows when previous-window history is complete`。
3. ✅ 历史不足：`:172`，`returns empty comparison when there is no history`；`:185`，`returns empty comparison when any expected platform lacks a previous-window row`；`:243`，`does not use a 30d record as a 7d baseline`。
4. ✅ 等长窗口计算：`:198`，`computes percent deltas against the previous equal-length window`；`:280`，`matches a previous window when capture times of day differ by minutes`；`:224`，`prefers the row whose windowEnd is closest to the expected previous window`；RPC `:383`，`persists verified rows and fills comparison when history covers the previous window`。
5. ✅ 目录固定整体验收：`:117` 存储层固定及默认路径测试继续通过；新增 `:505` 的 `pins the metrics directory before collection await on workbench.overview` 和 `:537` 的 `pins the metrics directory before collection await on ops_fetch_metrics` 均在 collector 的 await 后把 home provider 从 A 切到 B，断言 A 的当日文件存在、B 的当日文件不存在。代码也确认 RPC 的 readAll 使用同一捕获目录，且每次新入口调用重新捕获目录；未绑定 draftsDir。
6. ✅ 权限：`:302`，`creates the metrics directory as 0o700 and snapshot files as 0o600`；检查 group/other 位为零，并在 umask 允许时检查精确位。
7. ✅ 写失败：`:428`，`returns drafts/storage-unavailable when snapshot write fails`（桩）；`:138`，`throws DraftStorageError when the metrics directory is not writable`；`:440`，`maps a real unwritable metrics directory to drafts/storage-unavailable`（两者均执行真实 chmod 0o500 路径）。
8. ✅ typecheck + 全量测试：8 个文件 / 132 个用例通过，详见命令结果。

## D1–D7 闭合证据

- **D1 ✅**：`windowsCoverSameUtcPeriod` 检查日期与长度；`:280` 测试使用真实 `resolveMetricsWindow` 生成 10-01 09:00 与 10-08 09:05 两次窗口，命中基准并断言 period=7d、曝光/播放均增长 100%。
- **D2 ✅ 撤回**：`compareMetrics` 先要求每个应采平台都有一条匹配记录，再在 `sumMetric` 中 skip 单指标 null；`engagementsTotal` 与现有汇总器同口径。`:185` 验证缺整条平台记录整体空环比，`:198`、`:280` 及 RPC 正向测试验证混合渠道的分口径合法求和。没有证据支持原“部分求和冒充全网”判断。
- **D3 ✅**：`isPersistableOutcome` 为 live+verified；`:67` gate 测试拒绝 mock+verified，`:107` 实际存储测试确认没有文件和记录。
- **D4 ✅**：`:459` 先将微信、B站的完整上一窗口 verified 基准经 MetricsStore 落盘，再返回本次两平台 live/unverified 数值。断言 period=7d、四 delta 均 null、readAll 与之前一致、当日文件不存在。没有使用“无历史”替代。
- **D5 ✅**：`:138` 和 `:440` 实际 chmod 0o500，并在 finally 恢复 0o700；本机 UID=1000，均未提前返回。分别证实 DraftStorageError 和 RPC 失败码。
- **D6 ✅（限指定五处）**：`.context/architecture/api_strategy.md:201`、`data_architecture.md:272`、`risks_and_debt.md:310`、`proposal.md:73`、`design.md` Open Questions 均已改为 live+verified 或 UTC 日期+长度规则，没有旧落盘门或 ISO 全等要求。API 汇总覆盖门的 source !== unmeasured 属既有另一规则，未误报。本轮另复核路线图门及文档旧状态，D9、D10 均已闭合。
- **D7 ✅**：`:224` 用 `resolveMetricsWindow` 生成 00:10 与 23:55 两条历史，当前窗口结束为七天后 00:05；明确断言选择 00:10、值=100、windowEnd=early.windowEnd。`:215` 另测同距时 capturedAt 最新，两个选择规则均有证据。

## D8–D10 闭合证据与 M-n 处置

### D8 / M-1 — 已闭合（原 P1）

- **实现**：`src/ops-rpc.ts:509` 在 workbench.overview case 入口捕获 metricsDir，早于该分支所有 await；`src/tools/index.ts:506` 在 execute 第一行捕获。RPC appendVerified/readAll 及工具 appendVerified 都显式传入该目录，采集后没有再次解析目录。
- **回归**：`tests/metrics-snapshot.spec.ts:505` 和 `:537` 的两条永久回归使用临时 A/B home、可变目录 provider 和 SwitchingCollector；collector 先 await，再切到 B 并返回 live+verified 行。RPC 断言成功且只写 A；工具完成后也断言只写 A。两个用例都执行，并非仅证明存储层支持显式 dir。finally 清理两个临时 home。
- **判定**：修复覆盖原来“采集等待期间切 home 导致写入 B”的缺陷。RPC 历史读取同样保留 A 的目录语义，符合 criterion §3.5 / RISK-004。没有跳过修复。

### D9 / M-2 — 已闭合（原 P1）

- **文档**：`openspec/proposal-roadmap-Phase-0.md:129` 已改为仅 source=live 且 windowScope=verified 落盘，明确排除 mock/unmeasured/unverified；`:131` 的历史充足判定改为窗口长度匹配及 UTC 日历日起止对齐。
- **交叉证据**：与 `src/storage/metrics-store.ts:36`、proposal、metrics-history change spec 一致；专项 `accepts only live window-verified outcomes` 和 `does not persist unverified, unmeasured, or mock outcomes` 继续通过。窗口分钟差命中回归也继续通过。
- **判定**：路线图不再允许 mock+verified，也不再要求时刻完整覆盖而重新引入 D1。API 汇总覆盖门的另一条规则未被误改。没有跳过修复。

### D10 / M-3 — 已闭合（原 P2）

- **测试策略**：`.context/domain/testing_strategy.md:530` TD-010 已引用 metrics-snapshot.spec.ts，并明确“部分修复（metrics 已覆盖，calendar 仍待 feat-storage-calendar-items）”，与架构 TD-010 当前注记一致。
- **设计说明**：`openspec/changes/feat-storage-metrics-snapshot/design.md:35` 已区分 TAD 源文档原有缺口与 api_strategy 实现状态段已经回填的事实，不再声称该总结文件未约束落盘门。
- **判定**：两处过时声明均已修复，无需将源文档回填扩大成本轮实现变更。没有跳过修复。

当前缺陷列表为空；M-1、M-2、M-3 均已按稳定的实现和测试事实完成，没有把本报告引入提案文件。

## BR-xxx 业务契合度

- BR-050（指标真实性，`.context/domain/business_rules.md:253`）：符合；仅 live+verified 落盘，当前 unknown delta 保持 null。
- BR-051（曝光/播放分口径，`:262`）：符合；分别计算，单平台不适用指标 null 被跳过，没有用兼容 views 作为基准。
- BR-052（互动/关注增长与环比，`:271`）：宿主比较计算符合；历史不足如实空值，互动与关注分别计算；UI 验收仍在范围外，不宣称已完成 UI。

## 大纲 ↔ 提案一致性及路线图依赖

- 存储读写、两个采集入口、环比纯函数、历史不足/充足测试：大纲提案 2 的四项任务均有实现；目录固定现有入口级回归及代码证据，D8 已闭合。
- 落盘门：大纲、提案、spec 与代码均为 live+verified，D9 已闭合。
- In/Out：calendar 持久化、采集器能力修复、历史 UI 均未被本提案实现；weeklyPipeline 沿用既有数据消费，未新增主数据接入。
- 前置：`fix-overview-metrics-null-semantics` 与 `fix-storage-file-permissions` 均已有归档目录；本实现复用其类型/覆盖门与 local-fs。没有新增外部服务或前置循环。后续消费者为 `feat-client-dashboard`，当前 in-progress 定位与尚未勾选 6.4 一致。
- Outline ↔ Context：业务目标、风险、边界和落盘门一致。Outline ↔ Proposal：四项工作一致，目录固定完整落地。Proposal → Context：D6 指定五处继续一致，D10 的状态矛盾已消除。

## 风险与不修复项

- RISK-007：首次使用、缺任一整条应采平台基准均五键 null；完整历史但当前未测时 period 可保留 7d、四 delta null，D4 已证明。此行为正确，不修复。
- D2 所指单指标 skip null：已有平台级覆盖门，且与汇总器一致；撤回该缺陷，不修复。
- 生产空盘：live 页面目前 unverified，禁止假装窗口可证；采集窗口证明能力属范围外，不要求当前驾驶舱立刻有非空环比。
- RISK-004：存储层及两个入口的固定目录机制均有证据，D8 已修；draftsDir 不改变 metrics 路径已正确，无需改成跟随草稿库。
- RISK-005：失败信封和真实只读目录路径已有覆盖；不回滚已发生采集符合设计，无需补回滚。
- RISK-010：测试收集前隔离已有机制覆盖，新增两条入口回归也仅写临时目录。
- 既有目录权限收紧、跨进程/跨实例统一锁、快照保留淘汰策略：本提案沿用 A7 的既定范围，没有新增此类保证，不扩展为本轮缺陷。
- 架构 TD-010 的旧描述有明确“保留历史记录、metrics 段已过时”提示，不把该历史段误报为当前未实现声明；测试策略 TD-010 现已区分 metrics 已覆盖与 calendar 待实现，D10 已闭合。

## 待澄清问题与结束条件

没有需要用户裁决的未知事项。当前待处理为 P0=0、P1=0、P2=0；D8–D10 已全部闭合，未发现新增缺陷。指定五条命令及两条新增入口回归均通过。6.4 仍未勾选符合本次核查边界，本轮未执行归档。

本报告仅写在当前 change 目录，未被引入 proposal/tasks/design/specs，未修改既有暂存修复。
