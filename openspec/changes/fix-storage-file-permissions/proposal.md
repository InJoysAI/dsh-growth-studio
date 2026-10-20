# Change: 落盘文件与目录权限位实现

## Why

`.context/criterion.md` §3.5 把「系统文件权限仅限当前操作系统用户」列为 MUST，`.context/architecture/data_architecture.md`「数据治理 / 文件权限」、`.context/architecture/tech_stack.md`「持久化 MUST」与 `.context/architecture/security_policy.md`「存储层加密」都把该条当作保护本地数据的**唯一**手段（存储加密为 N/A）。但实现层没有任何落点：`src/storage/draft-store.ts` 与 `src/config-store.ts` 的 `writeFileSync` / `mkdirSync` 均未传 `mode`（`grep -rn "mode:" src/` 为空），实际权限完全取决于进程 umask —— 这正是 `.context/architecture/risks_and_debt.md` TD-013（严重性中）记录的实现债务。

后果具体且可指认：配置 `$DSH_HOME/ops-manager/config.json` 存有 Injoys 明文令牌（criterion §3.4「令牌返回边界」只约束回传对象，不约束落盘），草稿 `$DSH_HOME/growth-studio/drafts/{id}.json` 存有未发布正文。在 umask 宽松的多用户主机上，同机其他操作系统用户可直接读取这两类文件，MUST 声明与实现不符。

本提案使**新写入**满足该 MUST：为本地落盘显式设定文件 `0o600` / 目录 `0o700`，并把权限位收敛到统一落盘封装内单点设定，供后续 `metrics/`（`feat-storage-metrics-snapshot`）与 `calendar/`（Phase 1 `feat-storage-calendar-items`）落盘复用。

> **范围界定（须知，避免过度声明）**：本提案只约束**新建**文件与目录。既有对象**不被回改**——`mkdirSync` 不会修正已存在的目录，既有目录可能在升级后长期保持 `0755`；既有文件在下一次保存时经「临时文件 + `rename`」被替换，权限位随即落为 `0o600`，但此后不再被保存的既有文件（尤其是不再改动配置的 `config.json`）会保持原权限。该残留属**已知未覆盖面**，记入「风险与注意事项」，其一次性收紧需另立迁移提案（本提案 Out of Scope），不得据本条宣称「MUST 已在全量对象上成立」。

> **派生来源**：本提案派生自 `.context/criterion.md` §3.5 MUST + `.context/architecture/risks_and_debt.md` TD-013，**无直接业务规则（BR）依据**；`BR-030`（草稿主数据存本机、不上传）、`BR-071`（接入凭证的用户可见管理）与 `BR-NFR-002`（内容留存边界）仅**间接相关**且行为不变。`.context/domain/business_rules.md` 自述「存储路径、锁 / 事务、错误码等技术约束归 `criterion.md` 与 `architecture/`」，故不列为关联资产。

## What Changes

### 新增功能

- `src/storage/local-fs.ts`（叶子模块，只依赖 `node:fs` / `node:path` / `node:crypto`）：构成**统一落盘封装**，导出
  - `FILE_MODE = 0o600`、`DIR_MODE = 0o700`（权限位单点定义）；
  - `mkdirWithMode(dir)`：以 `DIR_MODE` 递归建目录；
  - `writeJsonAtomic(filePath, value)`：临时文件（以 `FILE_MODE` 创建、唯一后缀）+ `renameSync` 原子替换；
  - `createFileWriteLocks()` → `{ withFileLock(filePath, fn) }`：按**绝对文件路径**归属的串行写锁（每次调用返回独立锁集，保持 `DraftStore` 现有的「每实例一套锁」语义）。

  权限位、目录创建、原子写与写锁四项在此**单点**定义；存储错误类型 `DraftStorageError` 与 `drafts/storage-unavailable` 映射仍由 `src/storage/draft-store.ts` 导出，各 store 在写失败时以该类型包装——即「统一落盘封装」= 本模块四项 + 该错误类型与映射口径。

### 修改功能

- `src/storage/draft-store.ts`：`ensureDirectory` 改用 `mkdirWithMode`；`writeDraftFile` 改用 `writeJsonAtomic`；`verifyDirectoryWritable` 的探测文件显式 `mode: FILE_MODE`；写锁由 `createFileWriteLocks()` 提供（私有 `writeLocks` / `withFileLock` 改由封装承载，锁定语义与键不变）。既有的目录固定、`DraftStorageError` 包装与 `drafts/storage-unavailable` 映射**均不变**。
- `src/config-store.ts`：`save()` 的 `mkdirSync` 与 `writeFileSync` + `renameSync` 改用同一封装，配置文件与草稿库的权限位一致。

### 技术实现

- 权限位以 `mode` 选项传给 `writeFileSync` / `mkdirSync`，**不引入写后 `chmodSync`**：实际权限位是 `mode` 与 umask 的交集，umask 只可能使结果更严格，MUST 不会因此被放宽，故不为它增加一次系统调用与新的失败点。
- 统一封装选为**叶子模块**（不 import 任何项目内模块）：`draft-store.ts` 已 import `config-store.ts`（`resolveDshHome` / `defaultDraftsDir`），若把封装放进 `draft-store.ts` 再供 `config-store.ts` 复用即产生循环依赖。
- 写锁抽入封装的必要性有具体消费方：`feat-storage-metrics-snapshot` 已在进行中，其 `tasks.md` 明确要求复用「临时文件 + `rename` 原子写、按绝对文件路径的串行写锁、目录 `0o700` / 文件 `0o600`」，且明确**不修改** `draft-store.ts` / `config-store.ts`。若本次只抽权限位与原子写，该提案将不得不在 `metrics-store.ts` 内自建第二套锁实现，正是它自己禁止的「第二套落盘口径」。锁的抽取为等价搬移（按路径归属、串行链、用后释放），不新增锁语义。
- 按 SSoT-first（criterion §6）：本提案**不改** API 层契约（`src/types.ts` / `src/ops-rpc.ts` 的 RPC 方法与信封不变、不新增字段），无契约先行步骤；§7.2「生成命令 = 无」，一致性由 `pnpm typecheck` + `pnpm test` 保证。

### 不在本次范围（Out of Scope）

- **存储加密**：源文档未提供，`api_strategy.md` §5.3「存储加密 N/A」。
- **`metrics/` / `calendar/` 的业务实现**：分别为本 Phase 提案 2 `feat-storage-metrics-snapshot` 与 Phase 1 `feat-storage-calendar-items`；本提案只提供它们复用的落盘封装。
- **既有对象权限位的一次性收紧**：不回改既有文件与既有目录（见 Why 的范围界定与 `design.md` 决策 3）；需另立迁移提案。**因此本提案不宣称 criterion §3.5 MUST 已在既有对象上成立。**
- **`src/browser/session-guard.ts` 中把宿主 Cookie 库复制到 `os.tmpdir()` 的 `copyFileSync`**：该路径由本 Phase 提案 6 `fix-browser-session-cookie-probe` **整体移除**（criterion §4 铁律 4 会话数据零外发）。本提案不修改它，避免两个 Phase 0 提案重叠改同一文件。**时序依赖须注意**：`openspec/changes/fix-browser-session-cookie-probe/` 目前尚未创建（仅有 roadmap 条目），在它落地前该 `copyFileSync` 仍会创建未显式设权的临时文件；本提案的「无遗漏」验收按下方验证标准显式排除该项，不以未创建的下游提案作为本提案的硬前置。
- **`plugin-src/client/build.mjs` 对 `lib/` 的构建产物写入**：不在 `src/` 运行时落盘范围，且为构建产物而非用户数据。
- **`ConfigStore.save()` 的失败上报语义**：已由 Phase 0 提案 9 `fix-config-save-error-swallow` 落地（`save()` 不再吞掉落盘失败，`config.save` 经统一边界返回 `drafts/storage-unavailable`；`.context/architecture/risks_and_debt.md` TD-016 已标记修复）。本提案**不得回退**该语义：`config-store.ts` 改用统一落盘封装时，写盘失败仍须如实抛出。

## Impact

### 涉及的规范（Specs）

- **新增**：`specs/local-storage-permissions/spec.md` — 本地落盘文件 `0o600` / 目录 `0o700` 的权限位要求（覆盖草稿与配置两类落盘位置，仅约束新建对象），以及权限位、原子写与写锁在统一落盘封装内单点设定的要求。
- **修改**：无。既有 `specs/workbench-overview/spec.md` 不涉及文件权限，本提案不改。

### 涉及的代码

- **新增**：
  - `src/storage/local-fs.ts`（权限位常量 + 目录创建 / JSON 原子写 / 写锁原语）
  - `tests/storage-permissions.spec.ts`（权限位断言用例）
- **修改**：
  - `src/storage/draft-store.ts`（改用统一落盘封装：目录、原子写、写锁；探测文件显式 `mode`）
  - `src/config-store.ts`（改用统一落盘封装）

### 依赖关系

- **依赖**：无前置（roadmap 条目「前置: 无」）。
- **被依赖**：`feat-storage-metrics-snapshot`（**显式前置**：其快照写入须复用本提案的统一落盘封装，含写锁与权限位，不得自设第二套落盘口径）；Phase 1 `feat-storage-calendar-items` 的 `calendar/` 落盘同样复用该封装。
- **约束**：criterion §3.5 的其余落盘 MUST/MUST NOT（原子写、串行写锁、目录在单次操作内固定、存储错误码统一 `drafts/storage-unavailable`、不得绕过 `config-store` / `draft-store` 直接操作文件）在本提案中**保持不变**。
- **与下游的措辞一致性**：本提案落地后，「统一落盘封装」= `local-fs` 的权限位 + 目录创建 + 原子写 + 写锁，加 `DraftStorageError` 的统一错误映射；`feat-storage-metrics-snapshot` 现有措辞（同上四项 + 错误映射）据此成立，无需改写其诉求。

### 架构铁律与业务规则立场

- **四条架构铁律**（`.context/architecture/constraints.md`「架构铁律」）：① 仅预填、严禁自动确认发布 —— 不涉及（本提案不触碰发布工具与预填路径）；② `published` 只能由真实 URL 回填推进 —— 不涉及（不改状态机与 `publishedUrls` 治理）；③ 绝不用不完整数据冒充全网总量 —— 不涉及（不改指标聚合）；④ 会话数据零外发 —— **保持**：本提案只对落盘对象收紧权限位，不增加任何数据外发，也不改变 `session-guard.ts` 的 Cookie 处理（其移除归提案 6）。本提案触碰「存储」，按 `openspec/config.yaml` 的 proposal 规则逐条声明如上。
- **业务规则**：无直接 BR；`BR-030` / `BR-071` / `BR-NFR-002` 仅间接相关且行为不变（收窄权限位不放宽任何既有可读性承诺，也不改变草稿主数据留在本机的语义）。

### 风险与注意事项

- **多用户主机读取（本提案要消除的对象）**：umask 宽松时草稿正文与含 Injoys 令牌的配置文件可被同机其他用户读取；显式 `mode` 后新写入不再依赖 umask。
- **既有对象残留（已知未覆盖面）**：升级前已存在的 `drafts/`、`ops-manager/` 目录可能长期保持 `0755`（`mkdir` 不修正已存在目录）；既有文件在下一次保存时被收紧为 `0o600`，但不再被保存的 `config.json`（含令牌）会保持原权限。缓解与去向：记入本节，一次性收紧须另立迁移提案（本提案 Out of Scope）；验收只覆盖新建对象，不把残留当作已解决。
- **`ConfigStore.save()` 的失败上报是既有前提，不是本提案的待偿债务**：Phase 0 提案 9 `fix-config-save-error-swallow` 已归档——`save()` 不再吞掉落盘失败，`config.save` 失败经统一 RPC 边界返回 `drafts/storage-unavailable`（TD-016 已修复）。本提案在该语义之上只做一件事：把 `mkdirSync` / `writeFileSync` + `renameSync` 换成统一落盘封装以取得权限位与原子写；**不得**因改用封装而重新吞掉失败。`config-store.ts` 仍不得 import `storage/draft-store.ts`（否则成环），故失败包装保持在 `config.save` case 处，与现状一致。
- **umask 与权限断言的关系**：实际权限位为 `mode & ~umask`，umask 只可能更严格、不可能放宽，故 MUST 成立；权限位断言以「`(mode & 0o077) === 0`」为主判据，并在标准 umask 下追加精确 `0o600` / `0o700` 断言，避免异常 umask 下误报失败；`root` 运行与 `win32` 平台下权限位无意义，显式跳过并输出原因（沿用 `tests/ops-manager.spec.ts` 既有的 `permissionBitsEnforced` 探测口径）。
- **测试污染真实 `$DSH_HOME`（RISK-010，高）**：新用例须使用独立 `DSH_HOME` 或显式 `profileContext.home`，隔离在模块作用域生效（`tests/setup-isolation.ts`），用例内在 `finally` 恢复环境变量，不得写入开发者真实 `$DSH_HOME`。
- **循环依赖**：封装若放进 `draft-store.ts`，`config-store.ts` 复用它即与既有的 `draft-store.ts → config-store.ts` 依赖成环；故置于不 import 项目内模块的叶子模块，由 `pnpm typecheck` 验证。
- **写锁抽取的等价性**：`createFileWriteLocks()` 每次返回独立锁集，`DraftStore` 在实例化时持有一套，与抽取前「每实例一个 `Map`」语义一致；跨实例不共享锁的既有性质保持不变（不同库 / 不同 store 写同一路径的并发保护与今日相同，不因本次抽取而变化）。
- **既有导出面与错误码不变**：`DraftStorageError`、`ensureDirectory`、`verifyDirectoryWritable` 仍由 `src/storage/draft-store.ts` 导出（`src/ops-rpc.ts`、`tests/ops-manager.spec.ts` 与 `src/index.ts` 的 `export *` 依赖该路径），`drafts/storage-unavailable` 映射不变。
- **临时文件唯一性**：原子写的临时文件名改用随机后缀（原为 `${filePath}.tmp.${Date.now()}`），避免同一毫秒内跨实例写同一路径时临时文件互相覆盖；成功路径不残留 `.tmp.*`（有对应用例）。

### 验证标准

- ✅ 新建草稿文件权限为 `0o600`、新建草稿目录（`$DSH_HOME/growth-studio/drafts`，**不得预先创建**）权限为 `0o700`（单元测试断言 `stat().mode`；主判据 `(mode & 0o077) === 0`，标准 umask 下追加精确值）
- ✅ 新建配置文件 `$DSH_HOME/ops-manager/config.json` 权限为 `0o600`（单元测试断言 `stat().mode`）
- ✅ 预置为 `0644` 的既有草稿文件在保存后变为 `0o600`（单元测试；既有**目录**不被回改属已知范围外行为，按 `design.md` 决策 3 记录，不作为验收项）
- ✅ `src/` 内本地落盘调用均设定模式，无遗漏（`grep -rn "writeFileSync\|mkdirSync\|appendFileSync\|copyFileSync\|createWriteStream" src/` 加 `fs/promises` 的 `writeFile` / `mkdir`；唯一排除项为 `src/browser/session-guard.ts` 的宿主 Cookie 临时副本，归 `fix-browser-session-cookie-probe`）
- ✅ 写入成功路径不残留 `.tmp.*` 文件（单元测试）
- ✅ `pnpm typecheck` + `pnpm test` 通过

### 提案大纲对齐（Roadmap Alignment）

| 字段 | 内容 |
|------|------|
| roadmap_source_primary | `openspec/proposal-roadmap.md` |
| roadmap_source_supplement | `openspec/proposal-roadmap-Phase-0.md`（提案 7「落盘文件与目录权限位实现」正文） |
| phase | Phase 0（安全与数据真实性修复） |
| change_id | `fix-storage-file-permissions` |
| business_goal | 使 `criterion.md` §3.5「系统文件权限仅限当前操作系统用户」在实现层对**新写入**成立，避免多用户主机上草稿与配置（含 Injoys 令牌）被同机其他用户读取 |
| dependencies | 前置：无；被依赖：`feat-storage-metrics-snapshot`（显式前置）、Phase 1 `feat-storage-calendar-items` |
| acceptance_criteria | 文件权限 `0o600` / 目录权限 `0o700` / `src/` 内落盘调用无遗漏（排除项见验证标准） |

> roadmap 条目未定义扩展字段（`milestones` / `coverage_scope` / `gate_vs_non_gate` / `change_management` / `ops_support` / `kpi` / `risk_acceptance_policy` 在该条目中均为 N/A），本提案不新增这些字段。

### 关联 Context 资产

| Scope | 资产路径 | 关联说明 |
|-------|---------|---------|
| criterion | `.context/criterion.md` | §3.5「系统文件权限仅限当前操作系统用户」MUST 及落盘 MUST/MUST NOT 的权威来源；§3.2「错误不得吞没」与不虚报成功（本提案须保持、不得回退）；§3.4「令牌返回边界」（明文令牌落盘的邻近约束）；§6 SSoT-first 执行顺序 |
| architecture | `.context/architecture/risks_and_debt.md` | TD-013（中）「criterion 文件权限约束无实现落点」——本提案偿还该条；TD-016（`config.save` 虚报成功，已由前置提案修复，本提案在其上补权限位）；RISK-005（含缓解措施 ③）；RISK-010（测试污染真实 `$DSH_HOME`） |
| architecture | `.context/architecture/constraints.md` | §架构铁律的四条定义（本提案触碰「存储」，须逐条声明保持方式） |
| architecture | `.context/architecture/security_policy.md` | 「存储层加密」表：Injoys Token 与草稿内容的保护方式均为文件系统权限 |
| architecture | `.context/architecture/data_architecture.md` | 「数据治理 / 文件权限」行；物理数据模型给出 `ops-manager/config.json` 与 `drafts/{id}.json` 两个落盘位置 |
| architecture | `.context/architecture/tech_stack.md` | 「持久化 MUST」逐条列出原子写、写锁、目录固定、文件权限与统一错误码 |
| architecture | `.context/architecture/api_strategy.md` | §5.3「存储加密 N/A，依赖文件系统权限仅限当前操作系统用户」 |
| domain | `.context/domain/testing_strategy.md` | 「风险覆盖对照」TD-013 行：工程检查口径为「落盘文件 `0o600` / 目录 `0o700` 权限位，无对应 BDD 场景」 |
