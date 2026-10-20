<!-- change_kind: code -->
# 实施任务清单

> 目标：为本地落盘显式设定文件 `0o600` / 目录 `0o700`，并把权限位与原子写收敛到统一落盘封装内单点设定（criterion §3.5；TD-013）。既有语义（原子写、按绝对文件路径的写锁、目录在单次操作内固定、`DraftStorageError` → `drafts/storage-unavailable` 映射、`src/storage/draft-store.ts` 的导出面）**保持不变**。

## 1. Roadmap 对齐

| # | roadmap 关键任务 | 对应任务 |
|---|------------------|----------|
| 1 | 在统一落盘封装内为文件写入设 `mode: 0o600`、目录建立设 `0o700`（0.5 人日） | 3.1、3.2、3.3 |
| 2 | 覆盖 `draft-store.ts` 与 `config-store.ts` 的 `writeFileSync` / `mkdirSync`（0.25 人日） | 3.2、3.3、3.4 |
| 3 | 补权限位断言测试（0.25 人日） | 4.1 |

## 2. SSoT 先行
- [ ] 2.1 SSoT 未更改（无需契约变更，故无 codegen 步骤）
  - 本提案不新增 / 不修改 RPC 方法、信封字段或 `src/types.ts` 领域类型（criterion §7.1 API 层契约文件为 `src/ops-rpc.ts` + `src/types.ts`，本次均不改），§7.2「生成命令 = 无」，一致性由 `pnpm typecheck` + `pnpm test` 保证。
  - 新增的 `src/storage/local-fs.ts` 是持久化基础设施的模块内实现，不是 API 层契约；不加入 `src/index.ts` 的 `export *` 公开面，避免扩大对外接口。

## 3. 统一落盘封装与权限位落地
- [ ] 3.1 新增叶子模块 `src/storage/local-fs.ts`
  - [ ] 3.1.1 导出 `FILE_MODE = 0o600`、`DIR_MODE = 0o700` 两个常量，并写明其唯一权威来源是 criterion §3.5
  - [ ] 3.1.2 导出 `mkdirWithMode(dir)`：`mkdirSync(dir, { recursive: true, mode: DIR_MODE })`；失败时抛出原始 fs 错误，由调用方决定包装（不在本模块定义领域错误类型）
  - [ ] 3.1.3 导出 `writeJsonAtomic(filePath, value)`：写入 `${filePath}.tmp.<唯一后缀>`（`writeFileSync` 传 `encoding: 'utf-8'` 与 `mode: FILE_MODE`）后 `renameSync` 原子替换；序列化用 `JSON.stringify(value, null, 2)`，与既有两处落盘一致
  - [ ] 3.1.4 该模块**只** import `node:fs` / `node:path`，不 import 任何项目内模块（叶子约束：否则 `config-store.ts` 复用它将与 `draft-store.ts → config-store.ts` 成环）
- [ ] 3.2 `src/storage/draft-store.ts` 改用统一原语
  - [ ] 3.2.1 `ensureDirectory` 的 `mkdirSync` 改为调用 `mkdirWithMode`（保留既有的 `DraftStorageError` 包装与错误文案口径）
  - [ ] 3.2.2 `writeDraftFile` 的「临时文件 + `renameSync`」改为调用 `writeJsonAtomic`（保留既有的 `DraftStorageError` 包装）
  - [ ] 3.2.3 `verifyDirectoryWritable` 的探测文件 `writeFileSync` 显式传 `mode: FILE_MODE`（探测文件清理为 best-effort，残留时也不得对其他用户可读）
  - [ ] 3.2.4 保持导出面不变：`DraftStorageError`、`ensureDirectory`、`verifyDirectoryWritable` 仍从本文件导出（`src/ops-rpc.ts`、`tests/ops-manager.spec.ts`、`src/index.ts` 的 `export *` 依赖该路径）
- [ ] 3.3 `src/config-store.ts` 改用统一原语
  - [ ] 3.3.1 `save()` 的 `mkdirSync(join(this.configPath, '..'), …)` 改为调用 `mkdirWithMode` 并保留 `mode`
  - [ ] 3.3.2 `save()` 的 `writeFileSync` + `renameSync` 改为调用 `writeJsonAtomic(this.configPath, this.inMemory)`
  - [ ] 3.3.3 不改变 `save()` 既有的「写盘失败不抛出」行为（该行为不在本提案范围，见 `proposal.md` 风险末条）；仅同步 `node:fs` import，移除不再使用的 `writeFileSync` / `renameSync` / `mkdirSync`
- [ ] 3.4 全量核对 `src/` 落盘调用无遗漏
  - [ ] 3.4.1 `grep -rn "writeFileSync\|mkdirSync" src/`：剩余调用均须显式设定模式（或经 `writeJsonAtomic` / `mkdirWithMode`）
  - [ ] 3.4.2 确认排除项未被误改：`src/browser/session-guard.ts` 的宿主 Cookie 临时 `copyFileSync` 属 `fix-browser-session-cookie-probe` 的移除范围，`plugin-src/client/build.mjs` 的 `lib/` 构建产物写入不在 `src/` 范围

## 4. 测试
- [ ] 4.1 单元测试（新增 `tests/storage-permissions.spec.ts`）
  - [ ] 4.1.1 草稿文件权限位：用临时 `DSH_HOME`（`mkdtempSync`）保存新草稿后，断言 `statSync(path).mode & 0o777 === 0o600`
  - [ ] 4.1.2 草稿目录权限位：断言存储目录 `statSync(dir).mode & 0o777 === 0o700`
  - [ ] 4.1.3 配置文件权限位：`ConfigStore.save()` 写入 `config.json` 后，断言 `statSync(configPath).mode & 0o777 === 0o600`（并断言令牌字段确实落在该文件内，以证明该断言覆盖的对象正确）
  - [ ] 4.1.4 探测文件不残留：`verifyDirectoryWritable` 在目录可写时不留 `.draftstore-probe-*` 文件
  - [ ] 4.1.5 权限位不可用的运行环境（`root`）复用 `tests/ops-manager.spec.ts` 既有的 `permissionBitsEnforced` 探测口径显式跳过，不假装已覆盖；用例使用独立 `DSH_HOME`，不得写入开发者真实 `$DSH_HOME`（criterion §3.5 MUST NOT）

## 5. 手工核对
- [ ] 5.1 在本机执行一次草稿保存与一次 `config.save`，用 `ls -l` 或 `stat -c '%a %n'` 核对文件为 `600`、目录为 `700`

## 6. 验证与归档
- [ ] 6.1 验证所有验收标准
  - [ ] 6.1.1 权限位断言通过：新建草稿 / 配置文件 `0o600`、存储目录 `0o700`
  - [ ] 6.1.2 无遗漏核对通过：`grep -rn "writeFileSync\|mkdirSync" src/` 的结果均设定模式
  - [ ] 6.1.3 `pnpm typecheck` + `pnpm test` 通过
- [ ] 6.2 代码审查
  - [ ] 6.2.1 代码规范检查：`src/storage/local-fs.ts` 为叶子模块；`draft-store.ts` 的导出面与错误映射未变；无重复的权限位字面量散落在调用点
  - [ ] 6.2.2 安全性检查：`mode` 未被任何调用点覆盖为更宽松的值；无写后 `chmod` 放宽权限的路径；日志未输出令牌
- [ ] 6.3 运行 node design/context-dev/tools/specflow/specflow.mjs validate fix-storage-file-permissions --strict
- [ ] 6.4 运行 node design/context-dev/tools/specflow/specflow.mjs archive fix-storage-file-permissions --yes --no-validate
  - 仅在 6.3 通过后执行
