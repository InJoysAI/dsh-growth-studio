<!-- change_kind: code -->
# 实施任务清单

> 目标：为本地落盘显式设定文件 `0o600` / 目录 `0o700`，并把权限位、目录创建、原子写与写锁收敛到统一落盘封装（`src/storage/local-fs.ts`）内单点设定（criterion §3.5；TD-013）。既有语义（按绝对文件路径的串行写锁、目录在单次操作内固定、`DraftStorageError` → `drafts/storage-unavailable` 映射、`src/storage/draft-store.ts` 的导出面）**保持不变**。
>
> **范围边界**：本变更只约束**新建**文件与目录；既有对象（尤其既有 `drafts/` / `ops-manager/` 目录）**不被回改**，属已知未覆盖面，不作为验收项。写锁抽入封装是为满足 `feat-storage-metrics-snapshot` 的显式前置（复用同一封装、不得自设第二套落盘口径）；该提案明确不修改 `draft-store.ts` / `config-store.ts`。

## 1. Roadmap 对齐

| # | roadmap 关键任务 | 对应任务 |
|---|------------------|----------|
| 1 | 在统一落盘封装内为文件写入设 `mode: 0o600`、目录建立设 `0o700`，并把按绝对文件路径的串行写锁一并抽入该封装（0.75 人日） | 3.1、3.2、3.3 |
| 2 | 覆盖 `draft-store.ts` 与 `config-store.ts` 的 `writeFileSync` / `mkdirSync`（0.25 人日） | 3.2、3.3、3.4 |
| 3 | 补权限位断言测试（含既有 `0644` 文件保存后收紧为 `0o600`）（0.25 人日） | 4.1 |

## 2. SSoT 先行
- [ ] 2.1 SSoT 未更改（无需契约变更，故无 codegen 步骤）
  - 本提案不新增 / 不修改 RPC 方法、信封字段或 `src/types.ts` 领域类型（criterion §7.1 API 层契约文件为 `src/ops-rpc.ts` + `src/types.ts`，本次均不改），§7.2「生成命令 = 无」，一致性由 `pnpm typecheck` + `pnpm test` 保证。
  - 新增的 `src/storage/local-fs.ts` 是持久化基础设施的模块内实现，不是 API 层契约；不加入 `src/index.ts` 的 `export *` 公开面，避免扩大对外接口。

## 3. 统一落盘封装与权限位落地
- [ ] 3.1 新增叶子模块 `src/storage/local-fs.ts`（统一落盘封装）
  - [ ] 3.1.1 导出 `FILE_MODE = 0o600`、`DIR_MODE = 0o700` 两个常量，并写明其唯一权威来源是 criterion §3.5
  - [ ] 3.1.2 导出 `mkdirWithMode(dir)`：`mkdirSync(dir, { recursive: true, mode: DIR_MODE })`；失败时抛出原始 fs 错误，由调用方决定包装（不在本模块定义领域错误类型）
  - [ ] 3.1.3 导出 `writeJsonAtomic(filePath, value)`：写入 `${filePath}.tmp.<随机后缀>`（`writeFileSync` 传 `encoding: 'utf-8'` 与 `mode: FILE_MODE`）后 `renameSync` 原子替换；序列化用 `JSON.stringify(value, null, 2)`，与既有两处落盘一致。随机后缀取代原 `${filePath}.tmp.${Date.now()}`，消除同一毫秒内跨实例写同一路径的临时文件互相覆盖
  - [ ] 3.1.4 导出 `createFileWriteLocks()` → `{ withFileLock(filePath, fn) }`：按绝对文件路径归属的串行写锁，**每次调用返回独立锁集**（保持 `DraftStore` 现有「每实例一套锁」语义），逻辑与 `src/storage/draft-store.ts` 现有私有实现等价（串行链 + 用后释放并在无后续等待时清理）
  - [ ] 3.1.5 该模块**只** import `node:fs` / `node:path` / `node:crypto`，不 import 任何项目内模块（叶子约束：否则 `config-store.ts` 复用它将与 `draft-store.ts → config-store.ts` 成环）
- [ ] 3.2 `src/storage/draft-store.ts` 改用统一落盘封装
  - [ ] 3.2.1 `ensureDirectory` 的 `mkdirSync` 改为调用 `mkdirWithMode`（保留既有的 `DraftStorageError` 包装与错误文案口径）
  - [ ] 3.2.2 `writeDraftFile` 的「临时文件 + `renameSync`」改为调用 `writeJsonAtomic`（保留既有的 `DraftStorageError` 包装）
  - [ ] 3.2.3 删除私有 `writeLocks` / `withFileLock`，改为实例持有 `createFileWriteLocks()` 的返回值；`saveDraft` / `updatePrefillResult` / `markPublished` 三处调用点改用封装的 `withFileLock`，**锁键（绝对文件路径）与串行语义不变**
  - [ ] 3.2.4 `verifyDirectoryWritable` 的探测文件 `writeFileSync` 显式传 `mode: FILE_MODE`（探测文件清理为 best-effort，残留时也不得对其他用户可读）
  - [ ] 3.2.5 保持导出面不变：`DraftStorageError`、`ensureDirectory`、`verifyDirectoryWritable` 仍从本文件导出（`src/ops-rpc.ts`、`tests/ops-manager.spec.ts`、`src/index.ts` 的 `export *` 依赖该路径）
- [ ] 3.3 `src/config-store.ts` 改用统一落盘封装
  - [ ] 3.3.1 `save()` 的 `mkdirSync(join(this.configPath, '..'), …)` 改为调用 `mkdirWithMode` 并保留 `mode`
  - [ ] 3.3.2 `save()` 的 `writeFileSync` + `renameSync` 改为调用 `writeJsonAtomic(this.configPath, this.inMemory)`
  - [ ] 3.3.3 **保留** `save()` 的失败如实抛出语义（由归档提案 `fix-config-save-error-swallow` 落地，TD-016 已修复）：改用封装原语后抛出的仍是 fs 原始错误，`config.save` case 处包装为 `DraftStorageError` 并附 `details.dir`（取 `getConfigDir()`）的现状不变；**不得**在 `config-store.ts` 内新增 `try/catch` 把失败重新吞掉或改回静默。仅同步 `node:fs` import，移除不再使用的 `writeFileSync` / `renameSync` / `mkdirSync`
- [ ] 3.4 全量核对 `src/` 落盘调用无遗漏
  - [ ] 3.4.1 执行 `grep -rn "writeFileSync\|mkdirSync\|appendFileSync\|copyFileSync\|createWriteStream" src/` 与 `grep -rn "from 'node:fs/promises'" src/`（含 `writeFile` / `mkdir` 用法）：剩余调用均须显式设定模式（或经 `writeJsonAtomic` / `mkdirWithMode`），逐条给出结论
  - [ ] 3.4.2 确认排除项未被误改：`src/browser/session-guard.ts` 的宿主 Cookie 临时 `copyFileSync` 属 `fix-browser-session-cookie-probe` 的移除范围（该提案目录尚未创建，属**时序依赖**：本提案先落地时该临时文件仍为未显式设权，需在交付说明中如实标注，不以未创建的下游提案阻塞本提案）；`plugin-src/client/build.mjs` 的 `lib/` 构建产物写入不在 `src/` 范围
  - [ ] 3.4.3 确认既有对象不被回改：本变更不新增任何对既有文件 / 目录的 `chmod`（范围界定见 `proposal.md` 与 `design.md` 决策 3）

## 4. 测试
- [ ] 4.1 单元测试（新增 `tests/storage-permissions.spec.ts`）
  - [ ] 4.1.1 草稿文件权限位：保存新草稿后断言 `(statSync(file).mode & 0o077) === 0`（主判据：组 / 其他用户无任何位），并在标准 umask 下追加 `(statSync(file).mode & 0o777) === 0o600`
  - [ ] 4.1.2 草稿目录权限位：目标目录**不得预先创建**——断言由封装创建的 `$DSH_HOME/growth-studio/drafts`，而非 `mkdtempSync` 生成的根目录（后者本身即 `0700`，直接断言会空转通过）；断言 `(statSync(dir).mode & 0o077) === 0`，并在标准 umask 下追加 `=== 0o700`
  - [ ] 4.1.3 配置文件权限位：`ConfigStore.save()` 写入 `config.json` 后，断言 `(statSync(configPath).mode & 0o077) === 0`（标准 umask 下追加 `=== 0o600`），并断言令牌字段确实落在该文件内（以证明该断言覆盖的对象正确）
  - [ ] 4.1.4 既有文件在下一次保存时收紧：预置一份权限为 `0644` 的草稿文件，经保存后断言变为 `0o600`；既有**目录**不被回改属已知范围外行为，若需记录则在用例注释中标注「非验收项」（不在断言中把它当作通过条件）
  - [ ] 4.1.5 写入成功路径不残留 `*.tmp.*` 文件（保存后列出目录，断言无临时文件残留）
  - [ ] 4.1.6 探测文件不残留：`verifyDirectoryWritable` 在目录可写时不留 `.draftstore-probe-*` 文件
  - [ ] 4.1.7 环境无关性：`process.platform === 'win32'` 或权限位不可用的运行环境（`root`，复用 `tests/ops-manager.spec.ts` 既有的 `permissionBitsEnforced` 探测口径）显式跳过并输出原因，不假装已覆盖
  - [ ] 4.1.8 隔离：用例使用独立 `DSH_HOME`（或用例内设置 `process.env.DSH_HOME` / 显式 `profileContext.home` 并在 `finally` 恢复）；隔离须在测试文件被导入 / 收集之前生效（`tests/setup-isolation.ts` 模块作用域），不得写入开发者真实 `$DSH_HOME`（criterion §3.5 MUST NOT；RISK-010）

## 5. 手工核对
- [ ] 5.1 在本机执行一次草稿保存与一次 `config.save`，用 `stat -c '%a %n'` 核对新建文件为 `600`、新建目录为 `700`
- [ ] 5.2 用 `stat -c '%a %n'` 记录**升级前已存在**的 `drafts/` / `ops-manager/` 与 `config.json` 的实际权限位，作为「既有对象残留」的现场证据（预期：目录可能仍为 `755`、未再保存的 `config.json` 仍为 `644`；此为已知未覆盖面，不计入验收）

## 6. 验证与归档
- [ ] 6.1 验证所有验收标准
  - [ ] 6.1.1 权限位断言通过：新建草稿 / 配置文件 `0o600`、新建存储目录 `0o700`（含既有 `0644` 文件保存后收紧）
  - [ ] 6.1.2 无遗漏核对通过：`grep`（见 3.4.1）的结果逐条可解释——每处要么设定模式，要么属 3.4.2 的明确排除项
  - [ ] 6.1.3 写锁抽取未改变语义：并发 / 串行相关既有用例（`tests/ops-manager.spec.ts`）全部通过
  - [ ] 6.1.4 `pnpm typecheck` + `pnpm test` 通过，且测试运行后 `git status` 无真实 `$DSH_HOME` 变更
- [ ] 6.2 代码审查
  - [ ] 6.2.1 代码规范检查：`src/storage/local-fs.ts` 为叶子模块；`draft-store.ts` 的导出面与错误映射未变；无重复的权限位字面量散落在调用点
  - [ ] 6.2.2 安全性检查：`mode` 未被任何调用点覆盖为更宽松的值；无写后 `chmod` 放宽权限的路径；日志未输出令牌
- [ ] 6.3 运行 node design/context-dev/tools/specflow/specflow.mjs validate fix-storage-file-permissions --strict
- [ ] 6.4 运行 node design/context-dev/tools/specflow/specflow.mjs archive fix-storage-file-permissions --yes --no-validate
  - 仅在 6.3 通过后执行
