# Phase 4: 契约收口与端到端验收

> **返回总纲**: [proposal-roadmap.md](./proposal-roadmap.md)
> **文件名**: `proposal-roadmap-Phase-4.md`（编号与总纲阶段总览一致：Phase 4 → `Phase-4`）
> **状态**: proposed
> **来源**: `.context/architecture/risks_and_debt.md`（TD-011 / TD-014）；`.context/criterion.md` §7.2；`.context/architecture/api_strategy.md` §2.3 / §4；`.context/domain/testing_strategy.md`（Phase 0 Live 实测清单 / Definition of Done）
> **预计工作量与周期**: ~3 人日（**规划估算**；源文档工作量字段为 `N/A – 源文档未提供`）

## 阶段目标与范围

- **目标与交付结果**：收口契约层面的两处遗留——统一「未找到」错误码、补齐客户端 RPC 消费测试——为 Phase 0 的 Live 实测与 Sign-off 提供契约同步机制的自动化证据。
- **In / Out**：
  - ✅ In：`ops/not-found` 与 `ops/draft-not-found` 语义重复的收敛；`callOpsRpc` / `unwrapRpcResult` 的客户端消费测试与「宿主响应 ↔ 客户端解包」契约用例。
  - ❌ Out：新增 RPC 方法（Phase 0–2 已提供）；Live 实测本身（属 UAT 流程，由 `testing_strategy.md` 的 Alpha / Beta / Sign-off 阶段执行）；`config.yaml` 生成（**禁止**，见 plan 模块约束）。
- **适用约束**：
  - `criterion.md` §7.2「`pnpm test` 是 API 层契约的同步 / 校验方式之一」；
  - `api_strategy.md` §2.3「错误码必须使用既有值，不得自造语义相近的新码」；
  - `criterion.md` §3.5 测试隔离（禁止写入开发者真实 `$DSH_HOME`，RISK-010）。

## 提案详情

### 提案 1: 统一「未找到」错误码

**Change ID:** `fix-not-found-error-code-unify`  
**优先级:** P2  
**预计时间:** 1 人日（规划估算）  
**状态:** proposed

**业务目标（Business Goal）**:
- 消除同一语义「草稿不存在」的两个错误码（`ops/not-found` 与 `ops/draft-not-found`），使调用方只需处理一种「未找到」。
- 对齐 `api_strategy.md` §2.3 错误码目录的规范性要求。

**范围边界（In / Out）**:

| 类型 | 内容 |
|------|------|
| ✅ In | 统一为单一「未找到」码（建议保留 `ops/not-found`，将 `workbench.prefillDraft` 的 `ops/draft-not-found` 并入） |
| ✅ In | 同步 `api_strategy.md` §2.3、`cross_cutting_concepts.md` 与调用方 |
| ✅ In | 补测试覆盖统一后的错误码 |
| ❌ Out | 在资产侧擅自改契约或删码（**禁止**） |
| ❌ Out | 其他错误码的语义调整 |

> [!NOTE]
> 本提案仅涉及**一个**错误码语义的统一，属契约收口；依 `api_strategy.md` §2.3，`ops/not-found` 与 `ops/draft-not-found` 均在当前清单内，收敛须**同轮**更新契约资产与调用方，避免清单内部继续自相冲突。

**关联 Context 资产**:

| Scope | 关联资产 | 关联说明 |
|-------|---------|----------|
| criterion | `.context/criterion.md` | §6 SSoT-first、§7.1 契约权威 |
| architecture | `.context/architecture/risks_and_debt.md` | TD-011 |
| architecture | `.context/architecture/api_strategy.md` | §2.3 错误码清单 |
| architecture | `.context/architecture/cross_cutting_concepts.md` | 错误码表述同步 |

**关键任务**:
1. 收敛 `workbench.prefillDraft` 的 `ops/draft-not-found` 到 `ops/not-found`（0.5 人日）
2. 同步 `api_strategy.md` §2.3 与 `cross_cutting_concepts.md` 及调用方（0.25 人日）
3. 补测试（统一后错误码）（0.25 人日）

**验证标准**:

| 验收项 | 验收条件 | 验收方式 |
|--------|----------|----------|
| 单一未找到码 | 草稿不存在仅返回一种错误码 | 单元测试 |
| 资产一致 | 契约资产与实现错误码一致 | 代码审查 + 逐处比对 |
| 无自造码 | 不引入语义相近的新码 | `grep` |

**依赖**:
- 前置: 无
- 被依赖: 无
- 约束: 依赖链末端，不影响其他提案的功能实现（仅错误码语义收敛）

---

### 提案 2: 客户端 RPC 消费测试覆盖

**Change ID:** `fix-client-rpc-consumption-tests`  
**优先级:** P1  
**预计时间:** 2 人日（规划估算）  
**状态:** proposed

**业务目标（Business Goal）**:
- 建立客户端消费（`callOpsRpc` / `unwrapRpcResult`）的自动化用例，使 `criterion.md` §7.2 所述「契约同步方式」在客户端侧成为既有保障，而非仅目标口径。
- 覆盖宿主响应形状与客户端解包的一致性，以及错误码透传。

**范围边界（In / Out）**:

| 类型 | 内容 |
|------|------|
| ✅ In | `callOpsRpc` 用例：`POST /api/ops` 请求构造（含 `payload` 字段）、错误码透传 |
| ✅ In | `unwrapRpcResult` 用例：`ok` / `result` / `error` 解包、失败抛出 |
| ✅ In | 一条「宿主响应形状 ↔ 客户端解包」契约用例 |
| ✅ In | 遵守测试隔离（`tests/setup-isolation.ts` 模块级赋值），不污染真实 `$DSH_HOME` |
| ❌ Out | 宿主侧既有测试（`ops-manager.spec.ts` 等） |
| ❌ Out | 为客户端引入 TypeScript 编译期校验（源文档未要求） |

**关联 Context 资产**:

| Scope | 关联资产 | 关联说明 |
|-------|---------|----------|
| criterion | `.context/criterion.md` | §7.2 契约同步方式、§3.5 测试隔离 |
| architecture | `.context/architecture/risks_and_debt.md` | TD-014、RISK-010（测试隔离） |
| architecture | `.context/architecture/api_strategy.md` | §1.2 信封契约、§2.3 错误码 |
| domain | `.context/domain/testing_strategy.md` | Definition of Done / 覆盖要求 |

**关键任务**:
1. 补 `callOpsRpc` 用例（请求构造、`payload` 字段、错误码透传）（0.75 人日）
2. 补 `unwrapRpcResult` 用例（解包与失败抛出）（0.75 人日）
3. 补「宿主响应 ↔ 客户端解包」契约用例，并确保测试隔离（0.5 人日）

**风险与处理决定（按需）**:

| 风险 | 影响 | 处理决定及理由 |
|------|------|----------|
| 测试污染真实 `$DSH_HOME` | 改写用户真实配置 | 依 RISK-010：隔离须在测试文件被导入 / 收集之前生效（`tests/setup-isolation.ts` 模块作用域赋值），不得放 `beforeAll` |

**验证标准**:

| 验收项 | 验收条件 | 验收方式 |
|--------|----------|----------|
| 请求构造 | `callOpsRpc` 构造 `{ type:'client-request', rpcId, method:'ops', payload:{ method, payload } }` | 单元测试 |
| 错误码透传 | 宿主错误码经客户端解包后可被调用方获取 | 单元测试 |
| 解包语义 | `unwrapRpcResult` 对 `ok/result/error` 正确处理，失败抛出 | 单元测试 |
| 契约一致 | 「宿主响应形状 ↔ 客户端解包」用例通过 | 单元测试 |
| 测试隔离 | 用例不写入真实 `$DSH_HOME` | 隔离哨兵 spec |

**依赖**:
- 前置: 无
- 被依赖: 无
- 约束: 测试必须在模块作用域完成隔离（RISK-010）

---

## 执行顺序与依赖

- 两个提案**完全独立**，可并行推进；均无前置依赖，也不被其他提案依赖。
- 跨阶段前置条件：`fix-client-rpc-consumption-tests` 的「宿主响应形状 ↔ 客户端解包」契约用例需宿主侧 `/api/ops` 信封与错误码已稳定（Phase 0–2 提供）。
- 提供给后续阶段的能力：契约同步的自动化证据（供 Phase 0 Live 实测与 Sign-off 阶段引用）。

## 阶段整体验收

- `pnpm test` 通过，新增用例覆盖 `callOpsRpc` 与 `unwrapRpcResult`（此前 `tests/` 无任何用例引用二者）。
- `pnpm typecheck` 通过；错误码清单无重复语义条目。
- 测试隔离哨兵 spec 通过，确认未写入开发者真实 `$DSH_HOME`。
- 可据本 Phase 证据进入 `testing_strategy.md` 的 Alpha / Beta（Live 实测）/ Sign-off 阶段流程。

## 待决事项（按需）

- 无。本 Phase 为收口阶段，不引入新能力。
