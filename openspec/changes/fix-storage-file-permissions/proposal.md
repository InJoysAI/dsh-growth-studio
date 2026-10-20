# Change: 落盘文件与目录权限位实现

## Why

`.context/criterion.md` §3.5 把「系统文件权限仅限当前操作系统用户」列为 MUST，`.context/architecture/data_architecture.md`「数据治理 / 文件权限」、`.context/architecture/tech_stack.md`「持久化 MUST」与 `.context/architecture/security_policy.md`「存储层加密」都把该条当作保护本地数据的**唯一**手段（存储加密为 N/A）。但实现层没有任何落点：`src/storage/draft-store.ts` 与 `src/config-store.ts` 的 `writeFileSync` / `mkdirSync` 均未传 `mode`（`grep -rn "mode:" src/` 为空），实际权限完全取决于进程 umask —— 这正是 `.context/architecture/risks_and_debt.md` TD-013（严重性中）记录的实现债务。

后果具体且可指认：配置 `$DSH_HOME/ops-manager/config.json` 存有 Injoys 明文令牌（criterion §3.4「令牌返回边界」只约束回传对象，不约束落盘），草稿 `$DSH_HOME/growth-studio/drafts/{id}.json` 存有未发布正文。在 umask 宽松的多用户主机上，同机其他操作系统用户可直接读取这两类文件，MUST 声明与实现不符。

本提案使该 MUST 在实现层成立：为本地落盘显式设定文件 `0o600` / 目录 `0o700`，并把权限位收敛到统一落盘封装内单点设定，供后续 `metrics/`（`feat-storage-metrics-snapshot`）与 `calendar/`（Phase 1 `feat-storage-calendar-items`）落盘复用。

## What Changes

### 新增功能

- `src/storage/local-fs.ts`（叶子模块，只依赖 `node:fs` / `node:path`）：导出 `FILE_MODE = 0o600`、`DIR_MODE = 0o700`、`mkdirWithMode(dir)`（`mkdirSync(dir, { recursive: true, mode: DIR_MODE })`）与 `writeJsonAtomic(filePath, value)`（临时文件 + `renameSync` 原子替换，临时文件以 `mode: FILE_MODE` 创建）。权限位与原子写机制在此**单点**定义。

### 修改功能

- `src/storage/draft-store.ts`：`ensureDirectory` 与 `writeDraftFile` 改用上述原语；`verifyDirectoryWritable` 的探测文件显式 `mode: FILE_MODE`。既有的目录固定、按绝对文件路径的写锁、`DraftStorageError` 包装与 `drafts/storage-unavailable` 映射**均不变**。
- `src/config-store.ts`：`save()` 的 `mkdirSync` 与 `writeFileSync` + `renameSync` 改用同一原语，配置文件与草稿库的权限位一致。

### 技术实现

- 权限位以 `mode` 选项传给 `writeFileSync` / `mkdirSync`，**不引入写后 `chmodSync`**：实际权限位是 `mode` 与 umask 的交集，umask 只可能使结果更严格，MUST 不会因此被放宽，故不为它增加一次系统调用与新的失败点。
- 统一封装选为**叶子模块**（不 import 任何项目内模块）：`draft-store.ts` 已 import `config-store.ts`（`resolveDshHome` / `defaultDraftsDir`），若把原语放进 `draft-store.ts` 再供 `config-store.ts` 复用即产生循环依赖。
- 按 SSoT-first（criterion §6）：本提案**不改** API 层契约（`src/types.ts` / `src/ops-rpc.ts` 的 RPC 方法与信封不变、不新增字段），无契约先行步骤；§7.2「生成命令 = 无」，一致性由 `pnpm typecheck` + `pnpm test` 保证。

### 不在本次范围（Out of Scope）

- **存储加密**：源文档未提供，`api_strategy.md` §5.3「存储加密 N/A」。
- **`metrics/` / `calendar/` 的业务实现**：分别为本 Phase 提案 2 `feat-storage-metrics-snapshot` 与 Phase 1 `feat-storage-calendar-items`；本提案只提供它们复用的落盘原语。
- **`src/browser/session-guard.ts` 中把宿主 Cookie 库复制到 `os.tmpdir()` 的 `copyFileSync`**：该路径由本 Phase 提案 6 `fix-browser-session-cookie-probe` **整体移除**（criterion §4 会话数据零外发）。本提案不修改它，避免两个 Phase 0 提案重叠改同一文件。
- **`plugin-src/client/build.mjs` 对 `lib/` 的构建产物写入**：不在 `src/` 运行时落盘范围，且为构建产物而非用户数据。
- **`ConfigStore.save()` 吞掉写盘失败的行为**：见「风险与注意事项」末条，本提案不新增任务。

## Impact

### 涉及的规范（Specs）

- **新增**：`specs/local-storage-permissions/spec.md` — 本地落盘文件 `0o600` / 目录 `0o700` 的权限位要求（覆盖草稿与配置两类落盘位置），以及权限位与原子写在统一落盘封装内单点设定的要求。
- **修改**：无。既有 `specs/workbench-overview/spec.md` 不涉及文件权限，本提案不改。

### 涉及的代码

- **新增**：
  - `src/storage/local-fs.ts`（权限位常量 + 目录创建 / JSON 原子写原语）
  - `tests/storage-permissions.spec.ts`（权限位断言用例）
- **修改**：
  - `src/storage/draft-store.ts`（改用统一落盘原语；探测文件显式 `mode`）
  - `src/config-store.ts`（改用统一落盘原语）

### 依赖关系

- **依赖**：无前置（roadmap 条目「前置: 无」）。
- **被依赖**：`feat-storage-metrics-snapshot`（**显式前置**：其快照写入须复用本提案的统一落盘封装与权限位，不得自设第二套落盘口径）；Phase 1 `feat-storage-calendar-items` 的 `calendar/` 落盘同样复用该封装。
- **约束**：criterion §3.5 的其余落盘 MUST/MUST NOT（原子写、串行写锁、目录在单次操作内固定、存储错误码统一 `drafts/storage-unavailable`、不得绕过 `config-store` / `draft-store` 直接操作文件）在本提案中**保持不变**。

### 风险与注意事项

- **多用户主机读取（本提案要消除的对象）**：umask 宽松时草稿正文与含 Injoys 令牌的配置文件可被同机其他用户读取；显式 `mode` 后不再依赖 umask。
- **umask 与权限断言的关系**：实际权限位为 `mode & ~umask`，umask 只可能更严格、不可能放宽，故 MUST 成立；权限位断言在标准 umask 下比对 `0o600` / `0o700`，`root` 运行导致权限位无意义的场景沿用 `tests/ops-manager.spec.ts` 既有的 `permissionBitsEnforced` 探测跳过口径（不假装已覆盖）。
- **循环依赖**：原语若放进 `draft-store.ts`，`config-store.ts` 复用它即与既有的 `draft-store.ts → config-store.ts` 依赖成环；故置于不 import 项目内模块的叶子模块。
- **既有导出面与错误码不变**：`DraftStorageError`、`ensureDirectory`、`verifyDirectoryWritable` 仍由 `src/storage/draft-store.ts` 导出（`src/ops-rpc.ts`、`tests/ops-manager.spec.ts` 与 `src/index.ts` 的 `export *` 依赖该路径），`drafts/storage-unavailable` 映射不变。
- **相邻观察（本提案不处理）**：`ConfigStore.save()` 以 `catch {}` 吞掉配置文件写盘失败，故配置文件不可写时 `config.save` 仍返回成功。该行为既非权限位问题、本提案也不改动它（改它会变更 RPC 行为，属契约变更；且 criterion §3.5 的「先让 `config.save` 报告成功、再由后续 `drafts.save` 以 `ENOENT` 失败」MUST NOT 已由 `src/ops-rpc.ts` 保存前的 `verifyDirectoryWritable` 预检覆盖）。此处仅如实记录，以免被当作本提案已偿还。

### 验证标准

- ✅ 新建草稿文件权限为 `0o600`、草稿目录权限为 `0o700`（单元测试断言 `stat().mode`）
- ✅ 新建配置文件 `$DSH_HOME/ops-manager/config.json` 权限为 `0o600`（单元测试断言 `stat().mode`）
- ✅ `src/` 内本地落盘调用（`writeFileSync` / `mkdirSync`）均设定模式，无遗漏（`grep` + 代码审查；`src/browser/session-guard.ts` 的宿主 Cookie 临时副本由 `fix-browser-session-cookie-probe` 移除，不计入）
- ✅ `pnpm typecheck` + `pnpm test` 通过

### 提案大纲对齐（Roadmap Alignment）

| 字段 | 内容 |
|------|------|
| roadmap_source_primary | `openspec/proposal-roadmap.md` |
| roadmap_source_supplement | `openspec/proposal-roadmap-Phase-0.md`（提案 7「落盘文件与目录权限位实现」正文） |
| phase | Phase 0（安全与数据真实性修复） |
| change_id | `fix-storage-file-permissions` |
| business_goal | 使 `criterion.md` §3.5「系统文件权限仅限当前操作系统用户」在实现层成立，避免多用户主机上草稿与配置（含 Injoys 令牌）被同机其他用户读取 |
| dependencies | 前置：无；被依赖：`feat-storage-metrics-snapshot`（显式前置）、Phase 1 `feat-storage-calendar-items` |
| acceptance_criteria | 文件权限 `0o600` / 目录权限 `0o700` / `src/` 内落盘调用无遗漏 |

> roadmap 条目未定义扩展字段（`milestones` / `coverage_scope` / `gate_vs_non_gate` / `change_management` / `ops_support` / `kpi` / `risk_acceptance_policy` 在该条目中均为 N/A），本提案不新增这些字段。

### 关联 Context 资产

| Scope | 资产路径 | 关联说明 |
|-------|---------|---------|
| criterion | `.context/criterion.md` | §3.5「系统文件权限仅限当前操作系统用户」MUST 及落盘 MUST/MUST NOT 的权威来源；§3.4「令牌返回边界」（明文令牌落盘的邻近约束）；§6 SSoT-first 执行顺序 |
| architecture | `.context/architecture/risks_and_debt.md` | TD-013（中）「criterion 文件权限约束无实现落点」——本提案偿还该条 |
| architecture | `.context/architecture/api_strategy.md` | §5.3「存储加密 N/A，依赖文件系统权限仅限当前操作系统用户」 |
| architecture | `.context/architecture/security_policy.md` | 「存储层加密」表：Injoys Token 与草稿内容的保护方式均为文件系统权限 |
| architecture | `.context/architecture/data_architecture.md` | 「数据治理 / 文件权限」行；物理数据模型给出 `ops-manager/config.json` 与 `drafts/{id}.json` 两个落盘位置 |
| architecture | `.context/architecture/tech_stack.md` | 「持久化 MUST」逐条列出原子写、写锁、目录固定、文件权限与统一错误码 |
| domain | `.context/domain/testing_strategy.md` | 「风险覆盖对照」TD-013 行：工程检查口径为「落盘文件 `0o600` / 目录 `0o700` 权限位，无对应 BDD 场景」 |
