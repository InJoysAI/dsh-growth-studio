## ADDED Requirements

### Requirement: 本地落盘的新建文件与目录权限仅限当前操作系统用户

本地持久化写入 MUST 以 `mode` 显式设定权限位：新建文件 MUST 为 `0o600`、新建目录 MUST 为 `0o700`，MUST NOT 把进程 umask 当作权限来源（`.context/criterion.md` §3.5 MUST「系统文件权限仅限当前操作系统用户」；`.context/architecture/risks_and_debt.md` TD-013；`.context/architecture/data_architecture.md`「数据治理 / 文件权限」）。

覆盖范围 MUST 至少包含两类落盘位置（`.context/architecture/data_architecture.md` 物理数据模型；`criterion.md` §3.5 路径表）：

- 配置 `$DSH_HOME/ops-manager/config.json`（含 Injoys 明文令牌，`security_policy.md`「存储层加密」以本权限为唯一保护手段）；
- 草稿 `$DSH_HOME/growth-studio/drafts/{id}.json`（含未发布正文）。

实际权限位是 `mode` 与进程 umask 的交集，umask 只可能使结果更严格、不可能放宽，因此 MUST NOT 出现比 `0o600` / `0o700` 更宽松的结果。判定主判据为组 / 其他用户位全为 0（`mode & 0o077 === 0`）。

**只约束新建对象**：本要求不适用于本次变更之前已存在的文件与目录——既有目录不会被修正（建目录操作不修改已存在目录的权限），既有文件在下一次保存时经原子替换落为 `0o600`。既有对象的权限收紧不在本要求内，MUST NOT 据此宣称该 MUST 已在全量对象上成立。本要求对应 roadmap 验收项「文件权限」与「目录权限」。

#### Scenario: 新建草稿文件权限为 0o600

- **GIVEN** 草稿存储目录已就绪
- **WHEN** `DraftStore` 保存一份新草稿
- **THEN** 生成的 `{id}.json` 权限位 MUST 满足 `mode & 0o077 === 0`，且在标准 umask 下 MUST 为 `0o600`（`stat().mode`）
- **AND** MUST NOT 让同机其他操作系统用户可读该文件

#### Scenario: 新建草稿目录权限为 0o700

- **GIVEN** 目标草稿存储目录尚不存在
- **WHEN** 草稿落盘创建该目录
- **THEN** 该目录权限位 MUST 满足 `mode & 0o077 === 0`，且在标准 umask 下 MUST 为 `0o700`（`stat().mode`）
- **AND** MUST NOT 让同机其他操作系统用户可进入或列出该目录

#### Scenario: 配置文件（含 Injoys 令牌）权限为 0o600

- **GIVEN** 配置文件所在的 `ops-manager/` 目录尚未就绪
- **WHEN** `ConfigStore.save()` 写入 `$DSH_HOME/ops-manager/config.json`
- **THEN** 新建目录权限位与新建配置文件权限位 MUST 分别满足 `mode & 0o077 === 0`（标准 umask 下为 `0o700` / `0o600`）
- **AND** 写入的配置对象含 Injoys 令牌字段时，该令牌 MUST 只落在这一权限位受限的文件内

#### Scenario: 既有文件在下一次保存时被收紧

- **GIVEN** 一份既有草稿文件的权限位宽于 `0o600`（例如 `0o644`）
- **WHEN** 该草稿被再次保存
- **THEN** 保存后的文件权限位 MUST 满足 `mode & 0o077 === 0`（标准 umask 下为 `0o600`）
- **AND** 该结果 MUST 由「临时文件 + 原子替换」自然达成，MUST NOT 依赖对既有文件的额外 `chmod`

#### Scenario: 更严格的 umask 不得使结果更宽松

- **GIVEN** 进程 umask 已清除组 / 其他用户的权限位（例如 `0o077`）
- **WHEN** 本地落盘创建文件与目录
- **THEN** 实际权限位 MUST NOT 宽于 `0o600` / `0o700`
- **AND** 该结果 MUST 被视为满足本要求（本要求限定的是「不得更宽松」，不要求以放宽权限来命中精确字面值）

### Requirement: 权限位、原子写与写锁在统一落盘封装内单点设定

本地落盘的权限位、目录创建、原子写与串行写锁 MUST 在统一落盘封装内单点定义，草稿与配置的落盘 MUST 经该封装执行（`.context/criterion.md` §3.5 MUST「原子写入（临时文件 + `rename`）+ 串行写锁保护内部回写」；同节 MUST「系统文件权限仅限当前操作系统用户」）。

- MUST NOT 在各调用点重复定义权限位字面量；
- MUST NOT 自建第二套原子写或第二套按绝对文件路径的串行写锁；
- 复用该封装 MUST NOT 形成循环依赖；
- 存储错误类型与 `drafts/storage-unavailable` 映射口径 MUST 保持单点，写失败 MUST 由各 store 以既有存储错误类型包装。

后续新增的本地落盘位置（`metrics/`、`calendar/`）MUST 复用同一封装取权限位、原子写与写锁（`feat-storage-metrics-snapshot` 已以「复用该封装、不得自设第二套落盘口径」为其显式前置条件，且其自身承诺不修改 `draft-store.ts` / `config-store.ts`）。

**覆盖范围与唯一排除项**：本要求的检查覆盖 `src/` 内的本地落盘调用（`writeFileSync` / `mkdirSync` / `appendFileSync` / `copyFileSync` / `createWriteStream` 及 `node:fs/promises` 的对应写法）。唯一排除项是 `src/browser/session-guard.ts` 把宿主 Cookie 库复制到 `os.tmpdir()` 的临时副本——该路径由本 Phase 提案 6 `fix-browser-session-cookie-probe` 整体移除（criterion §4 铁律 4「会话数据零外发」），本变更不修改它，也不重复其移除以避免同文件冲突。本要求对应 roadmap 验收项「无遗漏」。

#### Scenario: 落盘调用点均经统一封装设定权限

- **GIVEN** 本变更落地后的 `src/`
- **WHEN** 检查全部本地落盘调用
- **THEN** 每一处 MUST 显式设定模式，或经封装原语（建目录 / 原子写）落盘
- **AND** MUST NOT 存在未设定模式、依赖 umask 的落盘调用
- **AND** 除 `session-guard.ts` 的宿主 Cookie 临时副本外 MUST NOT 有其他例外

#### Scenario: 封装向后续落盘位置提供写锁，无需自建第二套

- **GIVEN** 后续落盘位置（如指标快照的按日文件）需要按绝对文件路径串行写入
- **WHEN** 该位置复用统一落盘封装
- **THEN** 封装 MUST 提供可复用的串行写锁能力与权限位、原子写，且复用方 MUST NOT 修改 `draft-store.ts` / `config-store.ts`
- **AND** MUST NOT 出现第二套锁实现或第二套权限位口径

#### Scenario: 封装可被配置存储复用而不产生循环依赖

- **GIVEN** 统一封装为不依赖项目内其他模块的模块
- **WHEN** `src/config-store.ts` 复用该封装取权限位与原子写原语
- **THEN** 依赖关系 MUST NOT 成环（`draft-store.ts → config-store.ts` 与 `config-store.ts → 封装` 并存）
- **AND** `pnpm typecheck` MUST 通过

#### Scenario: 既有导出面与存储错误码不变

- **GIVEN** 其他模块依赖 `src/storage/draft-store.ts` 的公开面
- **WHEN** 本变更引入统一封装
- **THEN** `DraftStorageError`、`ensureDirectory`、`verifyDirectoryWritable` MUST 仍可从 `src/storage/draft-store.ts` 导入
- **AND** 写盘失败 MUST 仍映射为 `drafts/storage-unavailable`，MUST NOT 漏出 `ops/internal-error`
