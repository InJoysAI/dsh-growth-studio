## Context

`.context/criterion.md` §3.2 把「错误不得吞没」列为 MUST、把「不虚报成功」列为 MUST NOT；`.context/architecture/risks_and_debt.md` RISK-005 缓解措施 ③ 点名「不得吞异常后谎报保存成功」。但 `src/config-store.ts` 的 `save()`（`config-store.ts:179-188`）以 `catch { /* Ignore disk persistence failures */ }` 吞掉 `mkdirSync` / `writeFileSync` / `renameSync` 的落盘失败，`src/ops-rpc.ts` 的 `config.save` case（`ops-rpc.ts:150`）随后照常返回 `{ ok:true, value:{ success:true, config } }`——配置文件不可写时用户看到「保存成功」，重启后配置（含明文 Injoys 令牌）回退。

需要澄清的覆盖关系：criterion §3.5 的 `draftsDir` 前置预检（`src/ops-rpc.ts:131-148`，返回 `config/invalid-drafts-dir`）只覆盖草稿目录的可用性，不覆盖配置文件自身的写盘失败——本提案不把它当作已覆盖，也不改动其语义。

相关权威口径：`.context/criterion.md` §3.2 / §3.5 / §3.4 / §6；`.context/architecture/risks_and_debt.md` RISK-005、RISK-010；`.context/architecture/api_strategy.md` §2.3 / §3.6 / §3.7；`.context/architecture/constraints.md`（架构铁律）；`.context/architecture/runtime_view.md`（`config.save` 目标目录不可用失败路径）；`.context/architecture/cross_cutting_concepts.md`（前置校验优先）；`.context/architecture/data_architecture.md`（`config.json` 物理布局与权限）；`.context/architecture/tech_stack.md`（持久化 MUST/MUST NOT）；`.context/architecture/system_design.md`（QS-6 存储失败可感知的质量场景）；`.context/architecture/security_policy.md`（`config.json` 明文令牌的保护方式，邻近约束）。

## Goals / Non-Goals

- Goals
  - `ConfigStore.save()` 落盘失败如实抛出，不再被 `catch {}` 吞没。
  - `config.save` 把该失败经统一 RPC 错误边界（`ops-rpc.ts:663-685`）映射为 `ok:false` + `drafts/storage-unavailable` 失败信封，而非 `ok:true` 或 `ops/internal-error`。
  - 同轮同步 `api_strategy.md` §3.6 契约（写失败映射 + `success` 失败语义）与 §2.3 / §3.7 触发条件扩容（消除「§3.6 覆盖、§2.3 仅限目录」的契约内部矛盾），并在 `risks_and_debt.md` 补登 TD-016。
  - 成功路径、`draftsDir` 预检语义、客户端 UI、错误码清单、内存合并顺序均不变。
- Non-Goals
  - 新增错误码（复用 `drafts/storage-unavailable`）。
  - `draftsDir` 预检语义、客户端提示文案 / UI、`OpsConfig.browserosCapabilities`、权限位（提案 5 / Phase 3 / 提案 7）。
  - 落盘失败的内存回滚（决策 2）。
  - 把 `success` 字段重构为信封级标志（`ok` 已是信封级，`value.success` 保持既有形状）。
  - `config.json.tmp` 残留清理（既有行为：原子写保证目标文件要么旧要么新，残留下次保存被覆盖，不损坏数据）。
  - `configPath` 未解析时 `save()` 直接跳过：构造期 `try` 内 `resolveDshHome`/`join` 对字符串入参不抛错 → `configPath` 恒有值，「无落盘却成功」路径不可达，无需处理。

## Decisions

- **Decision 1: 失败包装放在 `ops-rpc.ts` 的 `config.save` case，不从 `config-store.ts` import `DraftStorageError`**
  - `src/storage/draft-store.ts` 已 import `src/config-store.ts`（`resolveDshHome` / `defaultDraftsDir`，`draft-store.ts:13`）。若 `config-store.ts` 反向 import `draft-store.ts` 取 `DraftStorageError`，即成环——TS 编译 / ESM 加载层面均须避免。
  - 因此 `config-store.ts` `save()` 只移除吞错 `catch`、让原生 `fs` 异常（`EACCES` / `EROFS` / `ENOENT` 等）如实抛出；在 `ops-rpc.ts` 的 `config.save` case 处把它包装为 `DraftStorageError`（`ops-rpc.ts` 已 import 该类，`details.dir` 取 `ops-manager` 配置目录），交给既有统一错误边界（`ops-rpc.ts:663-685`）单点映射为 `drafts/storage-unavailable`。
  - 这样错误名与「草稿」的既有绑定关系不动、映射口径仍单点、`config-store.ts` 不新增对 `storage/` 的依赖。
  - Alternatives considered：在 `config-store.ts` 内新建 `ConfigStorageError` 并由统一边界新增一条 `instanceof` 映射（被否：新增错误类型 + 第二条映射路径，且错误码仍须是 `drafts/storage-unavailable`——多此一举）；把 `DraftStorageError` 抽到叶子模块再让 `config-store.ts` import（被否：搬动 `draft-store.ts` 的导出会动到 `src/index.ts` 的 `export *`、`ops-rpc.ts`、`tests/` 的既有 import 路径，扩大本次 diff 而无行为收益——`fix-storage-file-permissions` 决策 2 已确立「错误类型不搬」）。

- **Decision 2: 落盘失败不回滚 `inMemory`**
  - `save()` 的既有顺序是「先合并进 `inMemory`（`config-store.ts:155-177`）再落盘（179-188）」。失败时进程内配置已生效、下次重启按 `config.json` 实际内容回退。
  - 选择**保持该顺序、失败只如实上报**：回滚 `inMemory` 会让运行中配置与用户刚提交的表单不一致（其它在内存中已采用新配置的调用方行为与盘上文件脱节），属于另一处语义变更，超出「不虚报成功」的本提案范围；roadmap 风险行⑤也明确「保持现状并如实上报，回滚语义另属独立决策」。
  - Alternatives considered：失败时回滚 `inMemory`（被否：会让「内存配置 ≠ 盘上配置」的不一致更难定位，且属于独立语义决策，不应搭本次修复的便车）。

- **Decision 3: `injoys.updateConfig` 提前到 `await configStore.save()` 之前**
  - `ops-rpc.ts` 的 `config.save` case 原顺序为「`await save()` → `updateConfig`」。若 `save()` 抛错，`:151-156` 的 `updateConfig` 不再执行——`inMemory` 已是新令牌（`config.get` 返回新值），但 `InjoysClient` 仍持旧令牌，界面显示与真实调用分裂，违背 `criterion.md:104` MUST「配置热更新须实时生效并传给 `InjoysClient`（`updateConfig`）」。
  - 选择**把 `updateConfig` 移到 `await save()` 之前**：`updateConfig`（`client.ts:77-87`）只更新 `endpoint`/`token` 并清目标缓存、不抛错，提前执行无副作用；失败路径下 `inMemory`/`InjoysClient` 仍一致，与「不回滚 `inMemory`」自洽。
  - Alternatives considered：在 `catch` 中转调 `updateConfig` 后重抛（被否：多一条 `catch`→中转→重抛路径，且仍要先接住异常才能转发，不如「先热更新再持久化」直接）；失败时把 `InjoysClient` 回滚到旧令牌（被否：与「不回滚 `inMemory`」矛盾，会造成新的内存/客户端分裂）。

- **Decision 4: `details.dir` 由 `ConfigStore` 只读访问器提供，不在 RPC 层重解析**
  - `configPath` 是 `private readonly`（`config-store.ts:82`）。若在 `ops-rpc.ts` 重新 `resolveDshHome(ctx)`，可能与 `ConfigStore` 构造期解析结果不一致（`index.ts` 的 `connectionCtx` 与 `ctx` 不是同一对象）。
  - 选择**在 `ConfigStore` 加 `getConfigDir(): string | undefined`**（返回 `configPath` 所在目录），`config.save` case 用它填 `details.dir`——单一解析来源、不新增第二处 `resolveDshHome` 调用。**兜底**：`getConfigDir()` 返回 `undefined`（`configPath` 未解析）时，`DraftStorageError` 的 `dir` 参数（`draft-store.ts:172`，`strict: true`）必填——传 `$DSH_HOME/ops-manager` 字面量而非 `undefined`，保证信封形状恒含 `details.dir`。
  - Alternatives considered：在 RPC 层直接 `resolveDshHome(ctx)`（被否：`connectionCtx`≠`ctx` 时解析结果可能与 `ConfigStore` 构造期不一致，`details.dir` 失真）。

## Risks / Trade-offs

- **`config.save` 由「恒成功」变「可能失败」**：客户端此前从未收到该失败。既有 `unwrapRpcResult` 抛错 + `handleSave` catch「保存失败」分支已存在，同一信封形状仅 `ok`/`error.code` 如实，属纠错非破坏性变更，无需 UI 改动。
- **`drafts/storage-unavailable` 语义扩展**：该码原本面向草稿目录不可用，现也覆盖配置文件写盘失败。统一边界按「写入口失败 → 存储不可用」的口径本就如此设计（`ops-rpc.ts` 边界注释明确「every write entry point … reports the same code」），`details.dir` 指向 `ops-manager` 目录即可区分为配置失败，不需另设码。**契约同步缺口**：`api_strategy.md` §2.3（`:114`）与 `cross_cutting_concepts.md`（`:39`）现有触发条件仍限定「目录」，须同轮扩容为「目录不可写 / 创建失败 / 配置文件写盘失败」，否则实现者可能把配置失败回退到 `ops/internal-error` 违反 `criterion.md:183`——已列入 tasks 5.1/5.1.1。
- **测试污染真实 `$DSH_HOME`（RISK-010，高）**：新用例一律经 `tests/setup-isolation.ts` 使用独立 `DSH_HOME`。
- **同文件并行改动**：与 `feat-browseros-capability-toggle`（同改 `config-store.ts`）、`fix-storage-file-permissions`（同改 `save()`）的串行 / 变基按 roadmap 处理，不构成依赖。

## Migration Plan

无数据迁移、无 API 形状变更。`config.json` 读写格式不变；失败仅是「原本被吞的落盘错误如实返回」。客户端无需改动即获得正确的失败提示。

## Open Questions

- 无。原「是否回滚内存配置」已按决策 2 定为「不回滚、如实上报」；「错误类型归属」已按决策 1 定为「包装在 `ops-rpc.ts`、不动 `config-store.ts` 依赖方向」。
