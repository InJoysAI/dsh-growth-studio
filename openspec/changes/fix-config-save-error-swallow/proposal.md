# Change: 配置写盘失败如实上报

## Why

`.context/criterion.md` §3.2 把「错误不得吞没」列为 MUST、把「虚报成功（无客户端或执行失败时严禁返回成功）」列为 MUST NOT；同条在 `.context/architecture/risks_and_debt.md` RISK-005（存储不可用被误报）的缓解措施 ③ 中被再次点名——「不得吞异常后谎报保存成功」。但 `src/config-store.ts` 的 `save()`（`config-store.ts:179-188`）把整个落盘块包在 `try { mkdirSync; writeFileSync(tmp); renameSync } catch { /* Ignore disk persistence failures */ }` 里：当 `$DSH_HOME/ops-manager/` 目录不可写、或 `ops-manager/` 路径被普通文件占用（`mkdirSync` 抛 `EEXIST`）、或 tmp/rename 任一步失败时，`save()` 静默返回，`src/ops-rpc.ts` 的 `config.save` case（`ops-rpc.ts:150`）随后照常返回 `{ ok:true, value:{ success:true, config } }`。注：POSIX 下 `rename` 可覆盖只读**文件**，故 `config.json` 只读**不是**本缺陷的可复现触发条件。

后果具体且可指认：用户在配置页提交 Injoys 令牌 / 草稿目录 / 自动同步开关，界面提示「保存成功」；实际上 `config.json` 从未落盘，重启后配置整体回退。`config.json` 存有 Injoys 明文令牌，丢失等于凭证丢失，用户只能在重启后才发现——这正是 criterion §3.2 与 RISK-005 明令禁止的「虚报成功」。

需要澄清的覆盖关系：criterion §3.5 的 `draftsDir` 前置预检（`src/ops-rpc.ts:131-148`，返回 `config/invalid-drafts-dir`）只覆盖**草稿目录**的可用性，**不覆盖配置文件自身的写盘失败**；本提案不把它当作已覆盖，也不改动该预检语义。

## What Changes

### 新增功能

- 无对外新增功能。本提案是既有 `config.save` 行为的**纠错**（如实上报），信封形状与方法签名均不变。

### 修改功能

- `src/config-store.ts` `save()`：移除 `catch { /* Ignore disk persistence failures */ }` 吞错，让 `mkdirSync` / `writeFileSync` / `renameSync` 的落盘失败如实抛出（不再静默）。合并进 `inMemory` 的顺序不变——先更新内存再落盘、落盘失败不回滚内存（见 design.md 决策 2，保持运行中配置与用户刚提交的表单一致）。
- `src/ops-rpc.ts` `config.save` case：
  - **热更新与持久化解耦**：把 `injoys.updateConfig` 移到 `await configStore.save(toSave)` **之前**——`updateConfig` 只更新 `InjoysClient` 内存态（`client.ts:77-87`，不抛错），即便随后落盘失败、返回 `ok:false`，`InjoysClient` 仍持与 `inMemory` 一致的新令牌，满足 `criterion.md:104` MUST「配置热更新须实时生效并传给 `InjoysClient`（`updateConfig`）」；避免「界面显示新配置但真实调用仍走旧令牌」的分裂态。
  - **失败如实映射**：`save()` 抛出的落盘失败经**统一 RPC 错误边界**（`ops-rpc.ts:663-685`）映射为 `ok:false` + `error.code='drafts/storage-unavailable'` 失败信封，而非 `ok:true` 或 `ops/internal-error`；`error.message` 为面向用户的中文说明，不拼接 `errno` / 调用栈等技术细节。
  - **`details.dir` 取值**：`ConfigStore` 新增只读访问器 `getConfigDir(): string | undefined`（`config-store.ts`），返回 `configPath` 所在目录；`config.save` case 用它填 `details.dir`，避免在 RPC 层重新 `resolveDshHome(ctx)` 导致与构造期解析结果不一致（`index.ts` 的 `connectionCtx` ≠ `ctx`）。
- `draftsDir` 预检（`config/invalid-drafts-dir`）与成功路径响应 `{ success:true, config }` 均不变。
- **非代码：契约与债务同轮同步**：
  - `.context/architecture/api_strategy.md`：**四处同轮改**——§3.6 `config.save` 契约补写「配置文件写盘失败 → `ok:false` + `error.code='drafts/storage-unavailable'`」并明确 `success` 字段的失败语义（`ok:false` 时响应不含 `value.success`）；**§3.6 现有「持久化后**实时热更新**运行中的 `InjoysClient`」（`api_strategy.md:655`）须替换为「`draftsDir` 预检通过后、配置文件写盘**之前**完成 `updateConfig` 热更新；写盘失败仍保留已合并的内存态并返回失败信封」——否则设计/规范/契约三者继续「先/后」矛盾**；§2.3 `drafts/storage-unavailable` 触发条件由「目录不可写或创建失败」扩容为「目录不可写 / 创建失败 / 配置文件写盘失败」；§3.7 写失败诚实性口径同步加「含配置文件写盘失败」。
  - `.context/architecture/risks_and_debt.md`：该缺陷此前无 TD 登记，经 `.agents/workflows/context-update.md` 同轮补登 **TD-016**（对象：`ConfigStore.save()` 吞掉配置文件写盘失败）并刷新 Manifest / history。

### 技术实现

- 失败上报不改 `config.save` 的响应形状——成功仍 `{ ok:true, value:{ success:true, config: OpsConfig } }`，失败走统一信封 `{ ok:false, error:{ code:'drafts/storage-unavailable', message, details:{dir} } }`；仅 `ok` / `error.code` 如实，属纠错而非破坏性变更（criterion §3.2）。
- **错误类型不在 `config-store.ts` 内新建，也不从 `config-store.ts` import `DraftStorageError`**：`draft-store.ts` 已 import `config-store.ts`（`resolveDshHome` / `defaultDraftsDir`），反向 import 即成环。落盘失败在 `config.save` case 处包装为 `DraftStorageError`（`ops-rpc.ts` 已 import 该类，dir 取 `ops-manager` 配置目录），由既有统一边界单点映射为 `drafts/storage-unavailable`——不新增错误码、不新增第二套映射口径（见 design.md 决策 1）。
- 按 SSoT-first（criterion §6）：本提案的 API 层是**手写 TypeScript 契约**（`src/ops-rpc.ts` + `src/types.ts`），§7.2 记录的生成命令为「无」；契约同步落在 `api_strategy.md` §3.6，一致性由 `pnpm typecheck` + `pnpm test` 保证，无 codegen 步骤。
- 测试污染隔离（RISK-010）：新增用例一律经 `tests/setup-isolation.ts` 全局兜底使用独立 `DSH_HOME`，不写开发者真实 `$DSH_HOME`。

### 不在本次范围（Out of Scope）

- **新增错误码**：`drafts/storage-unavailable` 已覆盖所有写入口（criterion §3.5），`config.save` 失败复用该码；`api_strategy.md` §2.3 不新增语义相近的错误码。
- **`draftsDir` 前置预检语义**：`config/invalid-drafts-dir` 的返回条件与时机不变（roadmap 明确「不得改动 `draftsDir` 预检语义」）。
- **客户端提示文案与配置页 UI**：`feat-client-engine-config`（Phase 3）范围；本提案只让既有的「保存失败」提示分支变得可达，不新增客户端改动。
- **`OpsConfig.browserosCapabilities`**：属本 Phase 提案 5 `feat-browseros-capability-toggle`，本提案不动配置字段解析与默认值。
- **落盘失败的内存回滚**：`save()` 先更新 `inMemory` 再落盘；失败时进程内配置已生效、重启回退。回滚会让运行中配置与用户刚提交的表单不一致，属独立决策（roadmap 风险行⑤：保持现状并如实上报）。
- **权限位**：`config-store.ts` `save()` 的 `mkdirSync`/`writeFileSync` 权限位参数属 `fix-storage-file-permissions`（提案 7）；本提案只改失败处理（try/catch 与上报），建议在其落地后实施以减少同方法变基（不构成硬依赖）。

## Impact

### 涉及的规范（Specs）
- **新增**：`specs/ops-config/spec.md` — `config.save` 写盘失败的如实上报语义：失败走统一 `drafts/storage-unavailable` 信封、成功路径与 `draftsDir` 预检不变、内存配置不回滚。
- **修改**：无。既有 `specs/workbench-overview/spec.md` 不涉及 `config.save`，本提案不改。

### 涉及的代码
- **修改**：
  - `src/config-store.ts`（`save()` 移除吞错 `catch`，落盘失败如实抛出）
  - `src/ops-rpc.ts`（`config.save` case 把落盘失败包装为 `DraftStorageError`，走统一错误边界）
- **测试**：
  - `tests/`（新增 `config.save` 不可写 → `ok:false` + `drafts/storage-unavailable`、可写 → `ok:true` 且 `config.json` 落盘；复用既有 `permissionBitsEnforced` 探测与 `buildIsolatedRpcStack` 隔离栈）
- **同轮文档（经 `.agents/workflows/context-update.md`）**：
  - `.context/architecture/api_strategy.md`（§3.6 契约补写失败映射与 `success` 失败语义；**§2.3 `drafts/storage-unavailable` 触发条件由「目录不可写或创建失败」扩容为「目录不可写 / 创建失败 / 配置文件写盘失败，覆盖所有写入口」**；§3.7 同步加「含配置文件写盘失败」）
  - `.context/architecture/cross_cutting_concepts.md`（`:39` 同一错误码触发条件同步扩容，避免契约内部矛盾）
  - `.context/architecture/risks_and_debt.md`（补登 TD-016）+ Manifest / history 刷新

### 依赖关系
- **依赖**：无前置硬依赖（roadmap「前置: 无」）。**建议**在 `fix-storage-file-permissions` 落地后实施——两者同改 `config-store.ts` 的 `save()`（提案 7 改 `mkdirSync`/`writeFileSync` 权限位参数，本提案改失败处理），串行可减少变基，但功能上无前置关系。
- **被依赖**：无硬被依赖。`feat-client-engine-config`（Phase 3）的「保存失败」提示分支已存在于客户端（`ops-page.js` `handleSave` catch + `management-rpc.mjs` `unwrapRpcResult` 抛错），本提案使其**可达**，但不构成它的硬前置。
- **约束**：契约先行（criterion §6）——先落 `api_strategy.md` §3.6 与 `src/ops-rpc.ts` 的失败映射，再补测试；不新增错误码；不改 `draftsDir` 预检语义。

### 架构铁律与业务规则立场
- **四条架构铁律**（`.context/architecture/constraints.md`）：① 仅预填、严禁自动确认发布 —— 不涉及；② `published` 只能由真实 URL 回填推进 —— 不涉及；③ 绝不用不完整数据冒充全网总量 —— 不涉及；④ 会话数据零外发 —— 不涉及（本提案只改本地配置写盘的失败上报）。本提案触碰「存储失败语义」，按 `openspec/config.yaml` proposal 规则逐条声明如上。
- **业务规则**：无直接 BR 依据；本提案派生自 criterion §3.2 MUST/MUST NOT + RISK-005 缓解措施 ③（`.context/domain/business_rules.md` 自述存储错误码等技术约束归 `criterion.md` 与 `architecture/`）。`BR-071`（接入凭证的用户可见管理）仅间接相关——如实上报让用户能感知凭证未保存，行为不放宽任何既有可读性承诺。

### 风险与注意事项

- **`config.save` 由「恒成功」变「可能失败」（本提案要引入的诚实变化）**：更精确地说，`draftsDir` 预检失败已能返回 `config/invalid-drafts-dir`，真正恒被吞没的是**配置文件写盘异常分支**。客户端此前从未收到过该失败。处理决定 = **接受**：criterion §3.2 要求失败必须如实返回；客户端失败分支已存在（`unwrapRpcResult` 抛错 → `handleSave` catch 展示「保存失败」），同一信封形状仅 `ok`/`error.code` 如实，属纠错而非破坏性变更，无需 UI 改动。
- **该缺陷此前无 TD 登记**：无「TD → 提案」追溯链。处理决定 = **同轮补登**：实施时经 `.agents/workflows/context-update.md` 在 `risks_and_debt.md` 新增 TD-016 并刷新 Manifest / history。
- **与 `feat-browseros-capability-toggle`（提案 5）同改 `config-store.ts`**：功能点不同（本提案只动 `save()` 失败上报，不改字段解析与默认值）。处理决定 = 同文件串行落地或后者变基，**不构成依赖**。
- **与 `fix-storage-file-permissions`（提案 7）同改 `save()`**：同一方法内两轮改动。处理决定 = **建议**在提案 7 落地后实施以最小化变基，功能上无前置关系。
- **失败不回滚内存配置**：落盘失败时进程内配置已生效、下次重启回退。处理决定 = **保持现状并如实上报**：回滚会让运行中配置与用户刚提交的表单不一致；本提案只解决「不谎报成功」，回滚语义另属独立决策。配套决策：`injoys.updateConfig` 提前到 `save()` 之前执行（`updateConfig` 不抛错），保证失败路径下 `inMemory`/`InjoysClient` 仍一致，满足 `criterion.md:104` MUST「配置热更新须实时生效并传给 `InjoysClient`（`updateConfig`）」。
- **测试污染真实 `$DSH_HOME`（RISK-010，高）**：新用例须使用独立 `DSH_HOME` 或显式 `profileContext.home`，隔离在模块作用域生效（`tests/setup-isolation.ts`），不得写入开发者真实 `$DSH_HOME`。
- **循环依赖**：`config-store.ts` 不得 import `draft-store.ts`（后者已 import 前者）。失败包装放在 `ops-rpc.ts` 的 `config.save` case（该文件已 import `DraftStorageError`），由 `pnpm typecheck` 验证依赖不成环（见 design.md 决策 1）。

### 验证标准

- ✅ `ops-manager/` 目录只读（tmp 写入 `EACCES`）或 `ops-manager/` 路径被普通文件占用（`mkdirSync` 抛 `EEXIST`）时 `config.save` 返回 `ok:false`，`error.code` 为 `drafts/storage-unavailable`（单元测试断言 `error.code`，不得为 `ok:true` 或 `ops/internal-error`）。注：POSIX 下 `rename` 可覆盖只读**文件**，因此触发条件必须用「目录不可写」或「路径被文件占用」，不能用「`config.json` 只读」。
- ✅ 目录可写时 `config.save` 仍 `ok:true`，且 `config.json` 已落盘（含令牌字段；单元测试 + 文件断言）
- ✅ `api_strategy.md` §3.6 写明失败映射、`success` 失败语义，且**已替换「持久化后热更新」旧时序条款为「写盘前热更新」**；§2.3 未新增错误码但 `drafts/storage-unavailable` 触发条件已同步扩容为覆盖配置文件写盘失败，`cross_cutting_concepts.md` 同步（逐处比对 + `grep`，消除「§3.6 覆盖、§2.3 仅限目录」的契约内部矛盾与「先/后热更新」时序矛盾）
- ✅ 客户端零改动：`ok:false` 时客户端 `unwrapRpcResult` 抛错、`handleSave` 进入失败提示分支（代码审查，不新增客户端改动）
- ✅ `risks_and_debt.md` 补登 TD-016 且 Manifest / history 已刷新
- ✅ `pnpm typecheck` + `pnpm test` 通过

### 提案大纲对齐（Roadmap Alignment）

| 字段 | 内容 |
|------|------|
| roadmap_source_primary | `openspec/proposal-roadmap.md` |
| roadmap_source_supplement | `openspec/proposal-roadmap-Phase-0.md`（提案 9「配置写盘失败如实上报」正文） |
| phase | Phase 0（安全与数据真实性修复） |
| change_id | `fix-config-save-error-swallow` |
| business_goal | 消除 `config.save` 的虚报成功：配置文件不可写时用户当场看到保存失败而非重启后才发现配置丢失；落实 criterion §3.2 与 RISK-005 缓解措施 ③ |
| dependencies | 前置：无（建议 `fix-storage-file-permissions` 落地后实施以减少变基）；被依赖：无 |
| acceptance_criteria | 虚报成功不得发生（`ok:false`+`drafts/storage-unavailable`，criterion §3.2 MUST NOT）/ 正常路径不变 / 契约一致 / 客户端零改动 |

> roadmap 条目未定义扩展字段（`milestones` / `coverage_scope` / `gate_vs_non_gate` / `change_management` / `ops_support` / `kpi` / `risk_acceptance_policy` 均为 N/A），本提案不新增这些字段。`change_kind` 未在 roadmap 声明，经用户确认为 `code`。

### 关联 Context 资产

| Scope | 资产路径 | 关联说明 |
|-------|---------|---------|
| criterion | `.context/criterion.md` | §3.2 MUST「错误不得吞没」/ MUST NOT「虚报成功（无客户端或执行失败时严禁返回成功）」——本提案的权威依据；§3.5 统一存储错误码 `drafts/storage-unavailable` 覆盖所有写入口、`config.save` 须先预校验 `draftsDir`（预检语义不动）；§3.4「令牌返回边界」（`config.json` 含明文令牌的邻近约束）；§6 SSoT-first 执行顺序 |
| architecture | `.context/architecture/risks_and_debt.md` | RISK-005（存储不可用被误报，含缓解措施 ③「不得吞异常后谎报保存成功」）；TD-001~TD-015 索引——本提案补登 TD-016；RISK-010（测试污染真实 `$DSH_HOME`） |
| architecture | `.context/architecture/api_strategy.md` | §3.6 `config.save` 契约（本提案同轮补写失败映射与 `success` 失败语义）；§2.3 `drafts/storage-unavailable` 触发条件（同轮扩容为覆盖配置文件写盘失败，不新增错误码）；§3.7 写失败诚实性口径 |
| architecture | `.context/architecture/constraints.md` | §架构铁律的四条定义（本提案触碰「存储失败语义」，须逐条声明保持方式） |
| architecture | `.context/architecture/runtime_view.md` | 「`config.save` 目标目录不可用」的失败返回路径（本提案把配置文件自身写失败纳入同一失败语义） |
| architecture | `.context/architecture/cross_cutting_concepts.md` | 「前置校验优先」（`draftsDir` 预检保留在前、配置文件写失败上报在后）；错误码与错误边界段（`drafts/storage-unavailable` 触发条件同轮扩容） |
| architecture | `.context/architecture/data_architecture.md` | 物理文件布局（`$DSH_HOME/ops-manager/config.json` 的落盘位置与权限语义） |
| architecture | `.context/architecture/tech_stack.md` | 持久化 MUST/MUST NOT（配置文件落盘的技术选型约束） |
| architecture | `.context/architecture/system_design.md` | QS-6 质量场景（`draftsDir` 前置校验返回 `config/invalid-drafts-dir`）——**邻近但未覆盖**配置文件写盘失败；本提案新增专项覆盖，不声称该场景已有此分支 |
| architecture | `.context/architecture/security_policy.md` | 令牌返回策略与存储（`config.json` 明文令牌的保护方式，邻近约束） |
| domain | `.context/domain/testing_strategy.md` | 模块 6 场景 4（`:347-353`）只覆盖切换可用草稿目录与提示文案，**未覆盖**配置文件写盘失败；`:520` 的「部分覆盖」属 RISK-005 总体映射——本提案为配置文件写盘失败新增专项用例，不声称原场景已有该分支 |
