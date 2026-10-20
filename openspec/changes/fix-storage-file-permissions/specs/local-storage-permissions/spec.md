## ADDED Requirements

### Requirement: 本地落盘的文件与目录权限仅限当前操作系统用户

本地持久化写入 MUST 以 `mode` 显式设定权限位：新建文件 MUST 为 `0o600`、新建目录 MUST 为 `0o700`，MUST NOT 把进程 umask 当作权限来源（`.context/criterion.md` §3.5 MUST「系统文件权限仅限当前操作系统用户」；`.context/architecture/risks_and_debt.md` TD-013；`.context/architecture/data_architecture.md`「数据治理 / 文件权限」）。

覆盖范围 MUST 至少包含两类落盘位置（`.context/architecture/data_architecture.md` 物理数据模型；`criterion.md` §3.5 路径表）：

- 配置 `$DSH_HOME/ops-manager/config.json`（含 Injoys 明文令牌，`security_policy.md`「存储层加密」以本权限为唯一保护手段）；
- 草稿 `$DSH_HOME/growth-studio/drafts/{id}.json`（含未发布正文）。

实际权限位是 `mode` 与进程 umask 的交集，umask 只可能使结果更严格、不可能放宽，因此 MUST NOT 出现比 `0o600` / `0o700` 更宽松的结果；本要求不通过写后 `chmodSync` 实现（见同目录 `design.md` 决策）。本要求对应 roadmap 验收项「文件权限」与「目录权限」。

#### Scenario: 新建草稿文件权限为 0o600

- **GIVEN** 草稿存储目录已就绪
- **WHEN** `DraftStore` 保存一份新草稿
- **THEN** 生成的 `{id}.json` 权限位 MUST 为 `0o600`（`stat().mode`）
- **AND** MUST NOT 让同机其他操作系统用户可读该文件

#### Scenario: 新建草稿目录权限为 0o700

- **GIVEN** 目标草稿存储目录尚不存在
- **WHEN** 草稿落盘创建该目录
- **THEN** 该目录权限位 MUST 为 `0o700`（`stat().mode`）
- **AND** MUST NOT 让同机其他操作系统用户可进入或列出该目录

#### Scenario: 配置文件（含 Injoys 令牌）权限为 0o600

- **GIVEN** 配置文件所在的 `ops-manager/` 目录尚未就绪
- **WHEN** `ConfigStore.save()` 写入 `$DSH_HOME/ops-manager/config.json`
- **THEN** 新建目录权限位 MUST 为 `0o700`、新建配置文件权限位 MUST 为 `0o600`（`stat().mode`）
- **AND** 写入的配置对象含 Injoys 令牌字段时，该令牌 MUST 只落在这一权限位受限的文件内

#### Scenario: 更严格的 umask 不得使结果更宽松

- **GIVEN** 进程 umask 已清除组 / 其他用户的权限位（例如 `0o077`）
- **WHEN** 本地落盘创建文件与目录
- **THEN** 实际权限位 MUST NOT 宽于 `0o600` / `0o700`
- **AND** 该结果 MUST 被视为满足本要求（本要求限定的是「不得更宽松」，不要求以放宽权限来命中精确字面值）

### Requirement: 权限位与原子写在统一落盘封装内单点设定

本地落盘的权限位与原子写机制 MUST 在统一落盘封装内单点定义，草稿与配置的落盘 MUST 经该封装执行，MUST NOT 在各调用点重复定义权限位字面量或自建第二套原子写（`.context/criterion.md` §3.5 MUST NOT「绕过 `config-store` / `draft-store` 模块直接操作配置文件或草稿文件」；同节 MUST「原子写入（临时文件 + `rename`）」）。

该封装 MUST 为不 import 任何项目内模块的叶子模块：`src/storage/draft-store.ts` 已 import `src/config-store.ts`（`resolveDshHome` / `defaultDraftsDir`），封装若落在 `draft-store.ts` 内再供 `config-store.ts` 复用即形成循环依赖。

后续新增的本地落盘位置（`metrics/`、`calendar/`）MUST 复用同一封装取权限位与原子写，MUST NOT 各自定义 `0o600` / `0o700`（`feat-storage-metrics-snapshot` 已以「复用该封装、不得自设第二套落盘口径」为其显式前置条件）。本要求对应 roadmap 验收项「无遗漏」。

#### Scenario: 落盘调用点均经统一封装设定权限

- **GIVEN** 本变更落地后的 `src/`
- **WHEN** 检查全部本地落盘调用（`writeFileSync` / `mkdirSync`）
- **THEN** 每一处 MUST 显式设定模式，或经封装原语（`mkdirWithMode` / `writeJsonAtomic`）落盘
- **AND** MUST NOT 存在未设定模式、依赖 umask 的落盘调用

#### Scenario: 封装可被配置存储复用而不产生循环依赖

- **GIVEN** 统一封装为叶子模块
- **WHEN** `src/config-store.ts` import 该封装取权限位与原子写原语
- **THEN** 依赖关系 MUST NOT 成环（`draft-store.ts → config-store.ts` 与 `config-store.ts → 封装` 并存）
- **AND** `pnpm typecheck` MUST 通过

#### Scenario: 既有导出面与存储错误码不变

- **GIVEN** 其他模块依赖 `src/storage/draft-store.ts` 的公开面
- **WHEN** 本变更引入统一封装
- **THEN** `DraftStorageError`、`ensureDirectory`、`verifyDirectoryWritable` MUST 仍可从 `src/storage/draft-store.ts` 导入
- **AND** 写盘失败 MUST 仍映射为 `drafts/storage-unavailable`，MUST NOT 漏出 `ops/internal-error`
