<!-- change_kind: code -->
# 实施任务清单

> 依据 `.context/criterion.md` §6 的 SSoT-first 顺序执行：契约同步（`api_strategy.md` §3.6）→ 宿主 RPC 失败映射与 `config-store.ts` 上报（`src/ops-rpc.ts` / `src/config-store.ts`）→ 测试。
> 本项目 API 层为「手写 TypeScript 契约」（`src/ops-rpc.ts` + `src/types.ts`），§7.2 记录的**生成命令为「无」**（自研 RPC 信封，无 schema 源，无 Codegen；一致性由 `pnpm typecheck` + `pnpm test` 保证），故不含 codegen 步骤。
> 对应路线图条目：`openspec/proposal-roadmap-Phase-0.md` 提案 9 / `openspec/proposal-roadmap.md` 索引行 `fix-config-save-error-swallow`。
> **范围边界**：不新增错误码；不改 `draftsDir` 预检（`config/invalid-drafts-dir`）语义；不改客户端 UI；不动 `OpsConfig.browserosCapabilities`（提案 5）与权限位（提案 7）；落盘失败不回滚内存配置。
> **建议时序**：`fix-storage-file-permissions`（提案 7）同改 `config-store.ts` 的 `save()`，建议其落地后再实施以减少变基——无硬前置。
> **测试隔离**：新增测试写盘一律经 `tests/setup-isolation.ts` 全局兜底（`vitest.config.ts` `setupFiles`），不写开发者真实 `$DSH_HOME`。

## 1. Roadmap 对齐

| # | roadmap 关键任务 | 对应任务 |
|---|------------------|----------|
| 1 | `ConfigStore.save()` 上报配置文件写盘失败（0.25 人日） | 3.2 |
| 2 | `config.save` 经统一 RPC 错误边界映射失败信封，并同轮同步 `api_strategy.md` §3.6（0.25 人日） | 3.1、3.3、5.1 |
| 3 | 补测试：不可写 → `ok: false`（`drafts/storage-unavailable`）、可写 → `ok: true` 且落盘（0.25 人日） | 4.1、4.2 |
| 4 | （roadmap 风险行②，同轮补登 TD）`risks_and_debt.md` 新增 TD-016 + 刷新 Manifest/history | 5.2 |
| 5 | （roadmap In 范围⑤）确认客户端零改动 | 4.3 |

## 2. SSoT 先行
- [ ] 2.1 SSoT 变更判定：本提案**变更** API 层语义（`config.save` 的成功/失败口径——`src/ops-rpc.ts` 的 `config.save` case 与统一错误边界映射），但 API 层是**手写 TypeScript 契约**，无 schema 源、§7.2 生成命令为「无」；契约同步落在 `.context/architecture/api_strategy.md` §3.6（任务 5.1，同轮），不触发 codegen
  - 不变更 `src/types.ts`（`OpsConfig` 形状不变）；不新增错误码（复用既有 `drafts/storage-unavailable`）

## 3. 实现
- [ ] 3.1 契约先行（criterion §6）：先落 `src/ops-rpc.ts` `config.save` case 的两处改造 ——
  - **热更新与持久化解耦**：把 `injoys.updateConfig` 移到 `await configStore.save(toSave)` **之前**（`updateConfig` 只更新内存态、不抛错，`client.ts:77-87`）；失败路径下 `inMemory`/`InjoysClient` 仍一致，满足 `criterion.md:104` MUST「配置热更新须实时生效并传给 `InjoysClient`（`updateConfig`）」
  - **失败包装**：`save()` 抛出的落盘失败包装为 `DraftStorageError`（`ops-rpc.ts` 已 import 该类；`details.dir` 取 `configStore.getConfigDir()`，指向 `ops-manager` 配置目录；`getConfigDir()` 返回 `undefined` 时传 `$DSH_HOME/ops-manager` 字面量兜底（`DraftStorageError` 的 `dir` 必填，`draft-store.ts:172`，`strict: true`）；`message` 为面向用户的中文说明，不拼接 `errno` / 调用栈），使其经统一错误边界（`ops-rpc.ts:663-685`）映射为 `ok:false` + `drafts/storage-unavailable`，而非 `ok:true` 或 `ops/internal-error`
  - `config.save` case 的 `draftsDir` 预检（`ops-rpc.ts:131-148`，`config/invalid-drafts-dir`）与成功响应 `{ success:true, config }` 均不变
- [ ] 3.2 `src/config-store.ts` `save()` 移除吞错 + 新增只读访问器：删去 `catch { /* Ignore disk persistence failures */ }`（`config-store.ts:179-188`），让 `mkdirSync` / `writeFileSync` / `renameSync` 的落盘失败如实抛出；合并进 `inMemory` 的顺序与成功路径不变，**失败不回滚 `inMemory`**（保持运行中配置与提交表单一致，见 design.md 决策 2）
  - 新增 `getConfigDir(): string | undefined` 只读访问器（返回 `configPath` 所在目录），供 `config.save` case 填 `details.dir`；不在 RPC 层重新 `resolveDshHome(ctx)`（`connectionCtx` ≠ `ctx`，解析结果可能不一致）
  - 不在 `config-store.ts` 内新建错误类型，也不从 `config-store.ts` import `DraftStorageError`（`draft-store.ts` 已 import `config-store.ts`，反向 import 成环——错误包装放在 `ops-rpc.ts` 的 `config.save` case，见 design.md 决策 1）
- [ ] 3.3 边界核查：确认落盘失败**只**经统一 RPC 错误边界映射为 `drafts/storage-unavailable`，不泄漏 `ops/internal-error`、不被其他 case 拦截；`config/invalid-drafts-dir` 仍只在 `draftsDir` 预检处返回
- [ ] 3.4 类型与编译：`pnpm typecheck` 通过（`save()` 返回类型不变、无循环依赖）

## 4. 测试
- [ ] 4.1 单元测试
  - [ ] 4.1.1 不可写 → `ok:false`（二选一触发）：
    - a) `ops-manager/` 目录只读（`chmod 0500`，tmp 写入抛 `EACCES`）；**复用 `permissionBitsEnforced` 探测与 `buildIsolatedRpcStack` 隔离栈（`tests/ops-manager.spec.ts:1835-1890`），在 `root`/`win32` 下显式跳过并输出原因**，避免空转通过
    - b) `ops-manager/` 路径被普通文件占用（`mkdirSync` 抛 `EEXIST`，与权限无关、跨平台可复现）
    - `config.save` 返回 `ok:false` 且 `error.code === 'drafts/storage-unavailable'`（断言 code，不得为 `ok:true` 或 `ops/internal-error`）；断言 `error.message` 为中文说明、不含 `errno`/`Error: ENOENT`/调用栈等技术细节；断言 `details.dir` 指向 `ops-manager` 配置目录（对应 spec「失败信封技术细节口径」）；注：POSIX 下 `rename` 可覆盖只读**文件**，故不采用「`config.json` 只读」作为触发条件
  - [ ] 4.1.2 可写 → `ok:true` 且落盘：目录可写时 `config.save` 返回 `ok:true`，`config.json` 已写入 `$DSH_HOME/ops-manager/` 且内容含令牌字段（文件断言）
- [ ] 4.2 回归 / 边界测试
  - [ ] 4.2.1 `config/invalid-drafts-dir` 预检语义不变：`draftsDir` 不可用时仍返回该码，不受本次失败映射影响
  - [ ] 4.2.2 `ops/internal-error` 不再误吞写盘失败：确认非 `DraftStorageError` 的其它异常才走 `ops/internal-error`
  - [ ] 4.2.3 失败路径下 `injoys.updateConfig` 已先执行：`config.save` 在不可写条件下返回 `ok:false` 时，断言 `InjoysClient` 经 `updateConfig` 后的 `getConfig().endpoint`/`token` 与提交的新配置一致（`updateConfig` 在 `save()` 之前执行；对非空字段成立，空串提交的既有语义分裂不在本提案范围内——`config-store.ts:171` 仅 `length>0` 时合并 `inMemory` 而 `client.ts:80` 仅 `!== undefined` 时赋值）
- [ ] 4.3 手动测试
  - [ ] 4.3.1 客户端零改动审查：`plugin-src/management-rpc.mjs` `unwrapRpcResult` 在 `ok:false` 时抛错、`plugin-src/client/ops-page.js` `handleSave` catch 进入「保存失败」提示分支——只审查不改动
  - [ ] 4.3.2 在配置页提交一次保存、再把 `ops-manager/` 置为只读再保存一次，确认第二次弹出「保存失败」而非「保存成功」

## 5. 文档
- [ ] 5.1 同轮同步 `.context/architecture/api_strategy.md`（三处同轮改，消除契约内部矛盾）：
  - §3.6 `config.save` 契约补写「配置文件写盘失败 → `ok:false` + `error.code='drafts/storage-unavailable'`」，并明确 `success` 字段的失败语义（`ok:false` 时响应不含 `value.success`）
  - §2.3 `drafts/storage-unavailable` 触发条件由「**目录**不可写或创建失败」扩容为「目录不可写 / 创建失败 / **配置文件写盘失败**，统一 RPC 错误边界映射、覆盖所有写入口」；确认不新增错误码（复用该码）
  - §3.7 写失败诚实性口径同步加「含配置文件写盘失败」
- [ ] 5.1.1 `.context/architecture/cross_cutting_concepts.md`（错误码与错误边界段）`drafts/storage-unavailable` 触发条件同步扩容，与 §2.3 措辞一致
- [ ] 5.2 经 `.agents/workflows/context-update.md` 在 `.context/architecture/risks_and_debt.md` 补登 **TD-016**（对象：`ConfigStore.save()` 吞掉配置文件写盘失败），并刷新 Manifest / history

## 6. 验证与归档
- [ ] 6.1 验证所有验收标准
  - [ ] 6.1.1 不虚报成功：不可写（目录只读或路径被文件占用）→ `ok:false` + `drafts/storage-unavailable`（单测断言 code）
  - [ ] 6.1.2 正常路径不变：可写 → `ok:true` 且 `config.json` 落盘（单测 + 文件断言）
  - [ ] 6.1.3 契约一致：`api_strategy.md` §3.6 写明失败映射与 `success` 失败语义；§2.3 `drafts/storage-unavailable` 触发条件已扩容为覆盖配置文件写盘失败、`cross_cutting_concepts.md` 同步；§2.3 无新增错误码（比对 + `grep`）
  - [ ] 6.1.4 客户端零改动：`ok:false` 时 `unwrapRpcResult` 抛错、`handleSave` 进入失败提示分支（代码审查）
- [ ] 6.2 代码审查
  - [ ] 6.2.1 代码规范检查（`pnpm typecheck` 通过；无循环依赖；`save()` 返回类型不变）
  - [ ] 6.2.2 安全性检查（明文令牌仍只在 `config.save` 响应体按 §3.4 返回；`drafts/storage-unavailable` 信封 `details` 仅含 `dir`，不泄令牌）
- [ ] 6.3 运行 node design/context-dev/tools/specflow/specflow.mjs validate fix-config-save-error-swallow --strict
- [ ] 6.4 运行 node design/context-dev/tools/specflow/specflow.mjs archive fix-config-save-error-swallow --yes --no-validate
  - 仅在 6.3 通过后执行
