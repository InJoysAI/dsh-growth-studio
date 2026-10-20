## Context

`.context/criterion.md` §3.5 把「系统文件权限仅限当前操作系统用户」列为 MUST，且 `.context/architecture/security_policy.md`「存储层加密」与 `.context/architecture/api_strategy.md` §5.3 都把该条当作保护本地数据的唯一手段（存储加密 N/A）。但 `src/` 内两处本地落盘（`src/storage/draft-store.ts`、`src/config-store.ts`）的 `writeFileSync` / `mkdirSync` 均未传 `mode`，实际权限位完全由进程 umask 决定（`grep -rn "mode:" src/` 为空），即 TD-013 记录的实现债务。

相关权威口径：`.context/criterion.md` §3.5 / §3.4 / §6；`.context/architecture/risks_and_debt.md` TD-013；`.context/architecture/data_architecture.md`「数据治理 / 文件权限」与物理数据模型；`.context/architecture/security_policy.md`「存储层加密」；`.context/architecture/tech_stack.md`「持久化 MUST」；`.context/domain/testing_strategy.md`「风险覆盖对照」TD-013 行。

## Goals / Non-Goals

- Goals
  - 新建本地落盘文件权限位为 `0o600`、新建目录为 `0o700`（覆盖草稿与配置两类位置）。
  - 权限位与原子写机制在统一落盘封装内单点定义，供 `metrics/`（`feat-storage-metrics-snapshot`）与 `calendar/`（Phase 1）复用。
  - 保持既有落盘语义与公开面不变：原子写、按绝对文件路径的写锁、目录在单次操作内固定、`DraftStorageError` → `drafts/storage-unavailable` 映射、`src/storage/draft-store.ts` 的导出。
- Non-Goals
  - 存储加密（源文档未提供，`api_strategy.md` §5.3）。
  - `metrics/` / `calendar/` 的业务实现（分属 Phase 0 提案 2 与 Phase 1）。
  - 回改**既有**文件的权限位（见下方决策 3 与 Migration Plan）。
  - 修改 `src/browser/session-guard.ts` 的宿主 Cookie 临时副本（由 `fix-browser-session-cookie-probe` 整体移除）。
  - 修改 `ConfigStore.save()` 吞掉写盘失败的既有行为。

## Decisions

- **Decision 1: 权限位以 `mode` 选项传递，不引入写后 `chmodSync`**
  - `writeFileSync` / `mkdirSync` 的 `mode` 会在创建时设定权限位，实际结果为 `mode & ~umask`；umask 只能清除位、不能新增位，故结果不可能比 `0o600` / `0o700` 更宽松，criterion §3.5 的 MUST 成立。
  - Alternatives considered：写后 `chmodSync` 强制精确位（被否：增加一次系统调用与一个失败点，且 `chmod` 失败时「文件已写入但权限未收紧」的中间态更难处理；`mode` 已足以保证「不得更宽松」）；启动时扫描既有文件并修正（被否：属数据迁移，见决策 3）。

- **Decision 2: 抽取叶子模块 `src/storage/local-fs.ts` 作为统一落盘封装**
  - 该模块导出 `FILE_MODE = 0o600`、`DIR_MODE = 0o700`、`mkdirWithMode(dir)`、`writeJsonAtomic(filePath, value)`，且**只**依赖 `node:fs` / `node:path`。
  - 叶子约束是必需的而非风格偏好：`src/storage/draft-store.ts` 已 import `src/config-store.ts`（`resolveDshHome` / `defaultDraftsDir`）；若把原语放进 `draft-store.ts` 再由 `config-store.ts` 复用，即形成循环依赖。
  - `writeJsonAtomic` 封装「临时文件 + `rename`」：调用方因此无法各自实现一套原子写，权限位与原子写只有一处定义。
  - Alternatives considered：只在两个调用点各加 `mode`、不抽模块（被否：`feat-storage-metrics-snapshot` 已把「复用统一落盘封装、不得自设第二套落盘口径」作为显式前置条件，且该提案声明「抽取可导出写盘原语属前置提案的实现细节」，即属本提案范围；否则第三方口径必然漂移）；把 `DraftStorageError` 一并移入封装（被否：该错误类型的名称与「草稿」绑定，`ops-rpc.ts`、`tests/ops-manager.spec.ts`、`src/index.ts` 的 `export *` 均依赖其现有导出路径，移动只会扩大本次 diff 而无行为收益；错误包装继续留在调用点，映射口径仍单点于 `DraftStorageError`）。

- **Decision 3: 只对「新建」对象生效，不扫描或回改既有文件**
  - 落盘采用「临时文件（`mode: 0o600`）+ `rename`」，因此既有草稿 / 配置文件在**下一次保存**时被整体替换，权限位随之落为 `0o600`，无需迁移。
  - 主动扫描并 `chmod` 既有文件被排除：它需要定义扫描范围与时机（`$DSH_HOME` 下哪些目录、启动时还是按需）、部分失败的处理方式与对用户是否可见，属独立变更；且它触及用户目录中本插件未创建的文件时风险大于收益。
  - 后果：升级前已存在、且此后不再被保存的草稿 / 配置文件，其权限位仍可能宽于 `0o600`。该后果写入 `proposal.md` 的验证标准边界（验收只针对新建文件），不作为本提案的验收项。

- **Decision 4: 不改动 `ConfigStore.save()` 的错误吞没行为**
  - 该行为是相邻缺陷（配置文件不可写时 `config.save` 仍返回成功），但与权限位无关；修它会变更 RPC 行为（属 API 层契约变更，须另行提案）。
  - criterion §3.5 中与它最接近的 MUST NOT（「先让 `config.save` 报告成功、再由后续 `drafts.save` 以 `ENOENT` 失败」）已由 `src/ops-rpc.ts` 保存前的 `verifyDirectoryWritable` 预检与 `config/invalid-drafts-dir` 返回覆盖，故本次不扩大范围。
  - Alternatives considered：顺手改为抛出并映射错误码（被否：超出 roadmap 条目 In 范围，且会让本提案同时承担 RPC 行为变更的评审面）。

## Risks / Trade-offs

- **既有文件仍可能宽于 `0o600`**：见决策 3。缓解事实是「下次保存即收紧」，并已在 `proposal.md` 写明验收边界。
- **umask 与精确断言的交互**：实际位为 `mode & ~umask`；测试在标准 umask 下断言 `0o600` / `0o700`，`root` 运行的无意义分支复用 `tests/ops-manager.spec.ts` 既有的 `permissionBitsEnforced` 探测跳过口径。
- **`config-store.ts` 复用封装后的依赖方向**：`config-store.ts` 从 `src/` 根目录 import `src/storage/` 下的模块，是持久化基础设施内部的正常方向；叶子约束保证不成环，`pnpm typecheck` 可验证。
- **Windows 平台语义**：`mode` 在 Windows 上仅影响只读位，POSIX 权限位断言在该平台不适用；本项目既有测试与路径口径均针对 POSIX 主目录（`resolveDshHome`），本提案不新增跨平台承诺。

## Migration Plan

无数据迁移、无目录结构变更。不扫描、不回改既有文件；既有草稿与配置文件在下一次保存时经「临时文件 + `rename`」被替换为 `0o600`。`metrics/` / `calendar/` 目录首次写入时即由封装以 `0o700` 创建。

## Open Questions

- `ConfigStore.save()` 吞掉写盘失败是否应作为独立缺陷登记（例如补一条 TD）并由单独提案修复？本提案按决策 4 不处理，仅如实记录于 `proposal.md` 风险末条，供路线图后续判断，不在本变更内决定。
