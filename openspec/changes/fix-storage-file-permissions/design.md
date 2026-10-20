## Context

`.context/criterion.md` §3.5 把「系统文件权限仅限当前操作系统用户」列为 MUST，且 `.context/architecture/security_policy.md`「存储层加密」与 `.context/architecture/api_strategy.md` §5.3 都把它当作保护本地数据的唯一手段（存储加密 N/A）。但 `src/` 内两处本地落盘（`src/storage/draft-store.ts`、`src/config-store.ts`）的 `writeFileSync` / `mkdirSync` 均未传 `mode`，实际权限位完全由进程 umask 决定（`grep -rn "mode:" src/` 为空），即 TD-013 记录的实现债务。

相关权威口径：`.context/criterion.md` §3.2 / §3.5 / §3.4 / §6；`.context/architecture/risks_and_debt.md` TD-013、RISK-005、RISK-010；`.context/architecture/constraints.md`（四条架构铁律）；`.context/architecture/data_architecture.md`「数据治理 / 文件权限」与物理数据模型；`.context/architecture/security_policy.md`「存储层加密」；`.context/architecture/tech_stack.md`「持久化 MUST」；`.context/domain/testing_strategy.md`「风险覆盖对照」TD-013 行。

## Goals / Non-Goals

- Goals
  - 新建本地落盘文件权限位为 `0o600`、新建目录为 `0o700`（覆盖草稿与配置两类位置）。
  - 权限位、目录创建、原子写与按绝对文件路径的写锁在统一落盘封装内单点定义，供 `metrics/`（`feat-storage-metrics-snapshot`）与 `calendar/`（Phase 1）复用。
  - 保持既有落盘语义与公开面不变：写锁的键与串行语义、目录在单次操作内固定、`DraftStorageError` → `drafts/storage-unavailable` 映射、`src/storage/draft-store.ts` 的导出。
- Non-Goals
  - 存储加密（源文档未提供，`api_strategy.md` §5.3）。
  - `metrics/` / `calendar/` 的业务实现（分属 Phase 0 提案 2 与 Phase 1）。
  - 一次性收紧**既有**文件与目录的权限位（见决策 3）。
  - 修改 `src/browser/session-guard.ts` 的宿主 Cookie 临时副本（由 `fix-browser-session-cookie-probe` 整体移除）。
  - 修改 `ConfigStore.save()` 的**失败上报语义**（已由归档提案 `fix-config-save-error-swallow` 落地，本提案不得回退为静默）。

## Decisions

- **Decision 1: 权限位以 `mode` 选项传递，不引入写后 `chmodSync`**
  - `writeFileSync` / `mkdirSync` 的 `mode` 会在创建时设定权限位，实际结果为 `mode & ~umask`；umask 只能清除位、不能新增位，故结果不可能比 `0o600` / `0o700` 更宽松，criterion §3.5 的 MUST 成立。
  - 由此得出断言口径：主判据是「组 / 其他用户位全为 0」（`mode & 0o077 === 0`），精确等值 `0o600` / `0o700` 只在标准 umask 下追加断言——否则异常 umask 会把「更严格」误报为失败。
  - Alternatives considered：写后 `chmodSync` 强制精确位（被否：增加一次系统调用与一个失败点，且 `chmod` 失败时「文件已写入但权限未收紧」的中间态更难处理；`mode` 已足以保证「不得更宽松」）；启动时扫描既有文件并修正（被否：属数据迁移，见决策 3）。

- **Decision 2: 抽取叶子模块 `src/storage/local-fs.ts` 作为唯一落盘封装，并把写锁一并纳入**
  - 该模块导出 `FILE_MODE = 0o600`、`DIR_MODE = 0o700`、`mkdirWithMode(dir)`、`writeJsonAtomic(filePath, value)`（临时文件 + `rename`）、`createFileWriteLocks()` → `{ withFileLock(filePath, fn) }`，且**只**依赖 `node:fs` / `node:path` / `node:crypto`。
  - **叶子约束是必需的而非风格偏好**：`src/storage/draft-store.ts` 已 import `src/config-store.ts`（`resolveDshHome` / `defaultDraftsDir`）；若把封装放进 `draft-store.ts` 再由 `config-store.ts` 复用，即形成循环依赖。该实现结构要求记在本决策，不写进 spec（spec 只保留行为后果「复用不得成环」）。
  - **写锁必须一并抽出**：`feat-storage-metrics-snapshot`（已在进行中）的 `tasks.md` 要求复用「临时文件 + `rename` 原子写、按绝对文件路径的串行写锁、目录 `0o700` / 文件 `0o600`」，且其 `proposal.md` 明确**不修改** `draft-store.ts` / `config-store.ts`。若本次只抽权限位与原子写，该提案只能在 `metrics-store.ts` 内自建第二套锁实现——正是它自己禁止的「第二套落盘口径」，且两套锁会各自演化（并发覆盖风险的典型来源）。锁的抽取是等价搬移：按绝对文件路径归属、串行链、用后释放；`createFileWriteLocks()` 每次返回独立锁集，`DraftStore` 实例化时持有一套，与抽取前「每实例一个 `Map`」语义一致。
  - **错误类型不搬**：`DraftStorageError` 与 `drafts/storage-unavailable` 映射继续由 `src/storage/draft-store.ts` 导出（`src/ops-rpc.ts`、`tests/ops-manager.spec.ts`、`src/index.ts` 的 `export *` 依赖该路径），各 store 在写失败时以该类型包装。搬动它只会扩大本次 diff，并让错误名与「草稿」的绑定关系错位，而错误映射口径本来就是单点的。
  - `writeJsonAtomic` 的临时文件名使用随机后缀（取代原 `${filePath}.tmp.${Date.now()}`）：同一毫秒内由不同 `DraftStore` 实例写同一路径时，原命名会让临时文件互相覆盖。这是消除既有碰撞面的一行改动，不是新增机制。
  - Alternatives considered：只在两个调用点各加 `mode`、不抽模块（被否：下游已把「复用统一落盘封装、不得自设第二套」作为显式前置，且该提案声明「抽取可导出写盘原语属前置提案的实现细节」，即属本提案范围；否则两套口径必然漂移）；只抽权限位与原子写、保留锁在原处，并改写本提案与下游提案的措辞（被否：需要改动一个已在进行中的下游提案的诉求，且以「允许第二套锁实现」为代价换取本提案 diff 更小，把并发风险转嫁给下游）。

- **Decision 3: 只对「新建」对象生效；不回改既有文件，也不回改既有目录**
  - 落盘采用「临时文件（`mode: 0o600`）+ `rename`」，因此既有草稿 / 配置文件在**下一次保存**时被整体替换，权限位随之落为 `0o600`——文件层面的残留会自愈。
  - **目录层面不会自愈**：`mkdirSync` 不修改已存在目录的权限，升级前创建的 `$DSH_HOME/growth-studio/drafts`、`$DSH_HOME/ops-manager` 可能长期保持 `0755`（其他用户可列出文件名，文件内容仍受 `0600` 保护）。
  - 主动扫描并 `chmod` 既有对象被排除，理由：它需要定义扫描范围与时机（`$DSH_HOME` 下哪些目录、启动时还是按需）、部分失败的处理方式（静默？告警？拒绝启动？）以及是否对用户自选 `draftsDir` 生效，属独立变更；对插件未创建的用户目录执行 `chmod` 会改变用户自有文件的语义，风险大于收益。
  - 因此本提案的声明收窄为「使**新写入**满足 MUST」，并在 `proposal.md` 与本文「Risks / Trade-offs」显式登记该残留（既有目录 + 不再被保存的配置文件）。一次收紧须另立迁移提案。
  - Alternatives considered：首次加载 / 保存时对插件自有路径做一次性 `chmod`（被否：属数据迁移，需要自己的失败语义与用户可见行为，超出 roadmap 条目 In 范围；且会把「权限位实现」与「用户目录改动」两类风险混在同一个 1 人日变更里）。

- **Decision 4: `ConfigStore.save()` 的失败上报已由前置提案落地，本提案只在其上补权限位**
  - `fix-config-save-error-swallow`（Phase 0 提案 9）已归档：`src/config-store.ts` 的 `save()` 不再 `catch {}` 吞掉落盘失败，失败经 `src/ops-rpc.ts` 的统一 RPC 错误边界映射为 `drafts/storage-unavailable`；对应 `.context/architecture/risks_and_debt.md` TD-016 已标记修复。
  - 因此本提案**不承担**该缺陷的修复，也**不再需要**登记它；本提案对 `src/config-store.ts` 的改动只有一类：让 `save()` 的 `mkdirSync` / `writeFileSync` + `renameSync` 改用统一落盘封装取权限位与原子写，**保留**其失败如实抛出的既有语义（不得改回静默）。
  - 需要注意的兼容点：`save()` 的失败抛出不带错误类型，`config.save` case 处已将其包装为 `DraftStorageError` 并带上 `details.dir`（取自 `getConfigDir()`）。本提案改用封装原语后，抛出的仍是 fs 原始错误，包装位置与结果不变，故该路径无需改动。
  - 另需保持：`config-store.ts` 不得 import `storage/draft-store.ts`（后者已 import 前者，反向即成环）——这是统一封装必须落在叶子模块的直接原因（见决策 2），而非新引入的约束。

## Risks / Trade-offs

- **既有目录残留（已知未覆盖面）**：升级前的 `drafts/` / `ops-manager/` 目录可能长期保持 `0755`；其他用户可列出文件名，但无法读取 `0600` 的文件内容。缓解：在下一次保存时文件被收紧；目录的一次性收紧留待迁移提案。为此本提案把声明限定为「新写入满足 MUST」。
- **既有配置文件残留**：升级前权限宽于 `0600` 的 `config.json`（含明文令牌）在用户再次保存配置前保持原权限。缓解同上，且已在 `proposal.md` 风险中登记为未覆盖面，不作为验收项。
- **umask 与精确断言**：见决策 1；`root` 运行与 `win32` 下权限位无意义，用例显式跳过并输出原因，不假装覆盖。
- **写锁抽取的等价性**：锁键仍为绝对文件路径，串行语义与实例级隔离不变；跨实例不共享锁的既有性质保持（不因本次抽取而改变），由既有并发用例回归。
- **`config-store.ts` 复用封装的依赖方向**：`config-store.ts` 从 `src/` 根目录 import `src/storage/` 下的模块，是持久化基础设施内部的正常方向；叶子约束保证不成环，`pnpm typecheck` 可验证。
- **Windows 平台语义**：`mode` 在 Windows 上仅影响只读位，POSIX 权限位断言在该平台不适用；本项目既有测试与路径口径均针对 POSIX 主目录（`resolveDshHome`），本提案不新增跨平台承诺，用例按平台跳过。
- **与提案 6 的时序**：`src/browser/session-guard.ts` 的宿主 Cookie 临时副本在本提案落地后、提案 6 落地前仍为未显式设权。本提案不修改它（避免同文件冲突），该残留的移除责任在提案 6，已在 `proposal.md` 的 Out of Scope 与验证标准中写明。

## Migration Plan

无数据迁移、无目录结构变更。不扫描、不回改既有对象：既有草稿与配置文件在下一次保存时经「临时文件 + `rename`」被替换为 `0o600`；既有目录保持其当前权限（不会自愈）。`metrics/` / `calendar/` 目录首次写入时即由封装以 `0o700` 创建。既有对象的一次性收紧属后续迁移提案。

## Open Questions

- 无。`ConfigStore.save()` 的失败上报已由归档提案 `fix-config-save-error-swallow` 解决（TD-016 已修复），本提案只在其上补权限位与统一原语，不重复该缺陷的登记或修复。
