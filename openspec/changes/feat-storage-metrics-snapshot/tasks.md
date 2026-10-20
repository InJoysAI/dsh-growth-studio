<!-- change_kind: code -->
# 实施任务清单

> 依据 `.context/criterion.md` §6 的 SSoT-first 顺序执行：类型契约（`src/types.ts`）→ 存储 / 领域实现（`src/storage/` + `src/analytics/`）→ 宿主 RPC 与工具接入（`src/ops-rpc.ts` / `src/tools/index.ts`）→ 测试。
> 本项目 API 层为「手写 TypeScript 契约」，§7.2 记录的**生成命令为「无」**（自研 RPC 信封，无 schema 源，无 Codegen；一致性由 `pnpm typecheck` + `pnpm test` 保证），故不含 codegen 步骤。
> 对应路线图条目：`openspec/proposal-roadmap-Phase-0.md` 提案 2 / `openspec/proposal-roadmap.md` 索引行 `feat-storage-metrics-snapshot`。
> **前置**：`fix-storage-file-permissions`（统一落盘封装的 `mode` 权限位）须先完成；本提案复用其封装，不自设第二套落盘口径。3.2 依赖 A7 的统一落盘封装落地后方可实施。
> **测试隔离**：新增测试写盘一律经 `tests/setup-isolation.ts` 全局兜底（`vitest.config.ts` `setupFiles`），不写开发者真实 `$DSH_HOME`。

## 1. Roadmap 对齐

| # | roadmap 关键任务 | 对应任务 |
|---|------------------|----------|
| 1 | 补 `src/storage/` 下 metrics 快照读写服务（目录创建、按日文件追加） | 3.1、3.2 |
| 2 | 在采集成功路径接入快照写入 | 3.3 |
| 3 | 在 `workbench.overview` 的 `comparison` 中实现「上一个等长窗口」基准读取与不足时 `null` | 3.4、3.5 |
| 4 | 补测试：历史不足 → `null`；历史充足 → delta 计算正确 | 4.1、4.2 |

## 2. SSoT 先行
- [ ] 2.1 SSoT 变更判定：本提案**变更** API 层契约（`src/types.ts` 快照行类型 + `comparison` 消费），须先改契约再改实现（criterion §6）
  - 判定依据：`workbench.overview` 的 `comparison` 语义由「无基准」扩展为「接真实基准」，快照行属本地 JSON 落盘契约；数据层/IPC 层/共享层未启用（criterion §2、§7.1），无迁移与 codegen

## 3. 契约与实现
- [ ] 3.1 在 `src/types.ts` 补指标历史快照行契约类型（`PlatformMetrics[]` 按 `(platform, capturedAt)` 追加）
  - 与 `data_architecture.md` 物理数据模型「`metrics/{YYYY-MM-DD}.json` → `PlatformMetrics[]`」一致；`capturedAt` 与 `windowStart` / `windowEnd` 语义沿用既有 `PlatformMetrics` 定义
- [ ] 3.2 新增 `src/storage/metrics-store.ts`：`$DSH_HOME/growth-studio/metrics/{YYYY-MM-DD}.json` 读写服务
  - 目录不存在则创建；按日文件名；采集成功后按 `(platform, capturedAt)` 追加，同日重复追加不丢弃既有记录
  - **落盘可证性门**：仅 `source !== 'unmeasured'` 且 `windowScope === 'verified'` 的结果落盘；`unverified` / `unmeasured` 不写入快照（快照行保持纯 `PlatformMetrics[]`，不新增字段）
  - 复用前置提案 `fix-storage-file-permissions` 的统一落盘封装：临时文件 + `rename` 原子写、按绝对文件路径的串行写锁、目录 `0o700` / 文件 `0o600`；本任务**不修改** `draft-store.ts` / `config-store.ts`（其权限位改动归前置提案）
  - 写盘失败抛出可映射为 `drafts/storage-unavailable` 的存储错误，不得吞异常
  - 目录在单次操作内固定（操作开始时解析并贯穿，不在 `await` 后重解析）
- [ ] 3.3 在采集成功路径接入快照写入
  - `src/ops-rpc.ts` 的 `workbench.overview` 与 `src/tools/index.ts` 的 `ops_fetch_metrics` 在采集完成后追加快照写入
  - 写入失败按统一存储错误口径如实上报（整体调用以 `drafts/storage-unavailable` 失败信封返回，不回滚已发生的采集副作用），不得虚报「已落盘」
  - 同步校正 `ops_fetch_metrics` 工具描述，提及本地 `metrics/` 快照落盘
- [ ] 3.4 新增 `src/analytics/metrics-comparison.ts`：环比基准与 delta 计算纯函数
  - 输入当前窗口结果 + 上一个等长窗口快照记录 + 应采平台集合 `P`，输出 `MetricsComparison`
  - **「历史充足」判定（可测试）**：对每个 `p ∈ P`，在上一个等长窗口内至少有一条 `windowStart` / `windowEnd` 完整覆盖该窗口的快照记录；任一平台缺失即为「历史不足」
  - 历史不足 → `period: null` 且四个 delta 全 `null`
  - 历史充足 → `period` 为 `'7d'` / `'30d'`，四个 delta 按基准计算（缺失值不按 `0` 计算）
- [ ] 3.5 在 `src/ops-rpc.ts` 的 `workbench.overview` 消费上述基准，替换「无历史 → 五键恒 `null`」的占位实现
  - 请求窗口 `metricsWindow` 决定「上一个等长窗口」的长度；`comparison` 键名与 `period` 取值不变

## 4. 测试
- [ ] 4.1 单元测试
  - [ ] 4.1.1 落盘：采集成功后 `metrics/{YYYY-MM-DD}.json` 按 `(platform, capturedAt)` 追加；同日重复追加不丢既有记录
  - [ ] 4.1.2 权限位：新建目录 `0o700`、新建快照文件 `0o600`（`stat().mode` 断言）
  - [ ] 4.1.3 历史不足 → delta 为 `null`（含首次使用无历史、缺任一应采平台基准）
  - [ ] 4.1.4 历史充足 → delta 按上一个等长窗口基准计算正确
  - [ ] 4.1.5 目录固定语义：单次操作内目录固定，配置切换只对新操作生效
  - [ ] 4.1.6 落盘可证性门：`windowScope: 'unverified'` 结果不落盘；构造「unverified 累计值 + 历史看似充足」用例，断言 delta 仍为 `null`
- [ ] 4.2 集成测试
  - [ ] 4.2.1 `workbench.overview` 采集成功后快照落盘且 `comparison` 消费基准
  - [ ] 4.2.2 快照写入失败时调用以 `drafts/storage-unavailable` 失败信封返回（断言 `error.code`，不虚报成功）

## 5. 文档
- [ ] 5.1 同步 Context 资产（`.context/architecture/risks_and_debt.md` TD-010 metrics 部分、`data_architecture.md` / `api_strategy.md` 实现状态注记），并运行 `bash design/context-dev/scripts/check-context-manifest.sh`

## 6. 验证与归档
- [ ] 6.1 验证所有验收标准
  - [ ] 6.1.1 快照落盘：采集成功后 `metrics/{YYYY-MM-DD}.json` 按 `(platform, capturedAt)` 追加
  - [ ] 6.1.2 历史不足为 `null`：不足以覆盖完整对比窗口时 delta 为 `null`，不编造近似值
  - [ ] 6.1.3 目录固定语义：单次操作内目录固定，配置切换只对新操作生效
- [ ] 6.2 代码审查
  - [ ] 6.2.1 代码规范检查（`pnpm typecheck`）
  - [ ] 6.2.2 安全性检查（权限位、存储错误口径、无伪造数据）
- [ ] 6.3 运行 node design/context-dev/tools/specflow/specflow.mjs validate feat-storage-metrics-snapshot --strict
- [ ] 6.4 运行 node design/context-dev/tools/specflow/specflow.mjs archive feat-storage-metrics-snapshot --yes --no-validate
  - 仅在 6.3 通过后执行
