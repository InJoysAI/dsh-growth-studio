# Phase 3: AI 工具中枢与契约清理

> **返回总纲**: [proposal-roadmap.md](./proposal-roadmap.md)
> **文件名**: `proposal-roadmap-Phase-3.md`
> **状态**: proposed
> **来源**: `.context/architecture/api_strategy.md`（§3.5 工具中枢与沙箱、§2.3 错误码清单）、`.context/domain/business_rules.md`（BR-040、BR-041）、`.context/domain/risks_and_debt.md`（PD-006）、`.context/architecture/risks_and_debt.md`（TD-001、TD-011）
> **预计工作量与周期**: 约 5 人日

## 阶段目标与范围

- 目标与交付结果：交付 AI 工具中枢 —— 工具目录、白名单启停（宿主侧强制）、可视化单步调试沙箱与脱敏遥测；并清理工具登记遗漏与重复「未找到」错误码。
- In / Out：
  - ✅ In：`tools.catalog` / `tools.toggle` / `tools.executeSandbox` / `tools.telemetry` 与沙箱 UI；工具全景登记补全；错误码收敛。
  - ❌ Out：场景技能包与工具裁剪（Phase 5，`feat-scenario-skill-packs`）；发布类工具（不存在于 catalog）。
- 适用约束：criterion §3.4（宿主内进程，不引入额外网络监听）、§4（无发布能力、Cookie 零外发）、§5.3（遥测脱敏）；api_strategy §3.5（白名单宿主侧强制、`tools/disabled`、不得以成功形状返回失败）。

## 提案详情

### 提案 1: AI 工具中枢与单步调试沙箱

**Change ID:** `feat-tools-hub-sandbox`  
**优先级:** P1  
**预计时间:** 3 人日  
**状态:** proposed

**业务目标（Business Goal）**:
- 实现 `tools.catalog` / `tools.toggle` / `tools.executeSandbox` / `tools.telemetry`，交付工具目录（五类分组）与可视化单步调试沙箱（BR-040、BR-041）。
- 白名单启停状态持久化到本地配置，重启后保持；`enabled === false` 的工具在**宿主侧**拒绝执行并返回 `tools/disabled`，不依赖前端隐藏按钮。
- 沙箱实时展示返回结果与执行耗时；遥测脱敏（不记录令牌 / Cookie / 完整正文）。

**范围边界（In / Out）**:

| 类型 | 内容 |
|------|------|
| ✅ In | 四个 `tools.*` 契约与实现；工具描述符（`category` / `driver` / `paramsSchema` / `enabled` / `dangerous`）；沙箱 UI（表单渲染 + 结果 + `durationMs`） |
| ✅ In | 启停状态持久化；宿主侧白名单强制；脱敏遥测 |
| ❌ Out | 场景技能包与白名单切片（Phase 5） |
| ❌ Out | 发布类工具（`ops_publish_now` 不存在于 catalog，无法构造调用） |

> [!NOTE]
> `dangerous` 在 Phase 0 恒为 `false`，因发布工具已移除；沙箱执行必须与服务端白名单**同源校验**，前端传入的工具名一律不可信。

**关联 Context 资产**:

| Scope | 关联资产 | 关联说明 |
|-------|---------|----------|
| criterion | `.context/criterion.md` | §3.2 不虚报成功、§3.4 不引入额外监听、§4 无发布能力、§5.3 遥测脱敏 |
| architecture | `.context/architecture/api_strategy.md` | §3.5 `tools.*` 契约与约束 |
| architecture | `.context/architecture/security_policy.md` | 工具治理与脱敏 |
| domain | `.context/domain/business_rules.md` | BR-040、BR-041 |
| architecture | `.context/architecture/risks_and_debt.md` | TD-001 |

**关键任务**:
1. 补 `src/types.ts` / `src/ops-rpc.ts` 的 `tools.*` 契约与工具描述符（0.75 人日）
2. 实现白名单启停持久化与宿主侧强制校验（0.5 人日）
3. 实现沙箱执行、结果与 `durationMs` 返回（0.75 人日）
4. 实现脱敏遥测（0.5 人日）
5. 接入沙箱 UI（表单 + 结果 + 耗时）（0.5 人日）

**验证标准**:

| 验收项 | 验收条件 | 验收方式 |
|--------|----------|----------|
| 宿主侧强制 | `enabled === false` 的工具被宿主拒绝并返回 `tools/disabled` | 单元测试 |
| 无发布工具 | catalog 中不存在任何发布类工具 | 单元测试 + 代码审查 |
| 脱敏 | 遥测不含令牌 / Cookie / 完整正文 | 单元测试 |
| 失败如实 | 失败返回真实错误与 `durationMs`，不以成功形状返回 | 单元测试 |

**依赖**:
- 前置: `feat-client-workbench-shell`
- 被依赖: `fix-tool-catalog-registration`、`feat-scenario-skill-packs`
- 约束: 白名单校验在宿主侧；不引入额外网络监听端口。

---

### 提案 2: 工具全景缺失工具登记或显式移出范围

**Change ID:** `fix-tool-catalog-registration`  
**优先级:** P2  
**预计时间:** 1 人日  
**状态:** proposed

**业务目标（Business Goal）**:
- 处理 PD-006：PRD §5.5.1 列出的 `ops_keyword_research`（策划与选题）、`ops_generate_hooks`（创意与生成）、`ops_inspect_sessions`（系统与调度）三者未实现且未按名登记的问题。
- 明确三者是「补实现并按名登记」还是「显式标注移出范围」，使规划层能从资产区分「遗漏」与「已裁决范围变更」。
- 使 BR-040 验收点「工具中枢按五类分组展示，每组包含对应工具」可在实现侧判定。

**范围边界（In / Out）**:

| 类型 | 内容 |
|------|------|
| ✅ In | 三者的阶段归属裁决（补实现登记，或显式移出范围并登记在案） |
| ✅ In | 若补实现：在 `src/tools/index.ts` 注册并按五类登记 |
| ❌ Out | 与 `ops_keyword_research` 等无关的工具重构 |
| ❌ Out | 场景技能包白名单（Phase 5） |

> [!NOTE]
> 三者阶段归属源文档未标注，须由产品负责人补阶段归属或显式标注移出范围；本提案不擅自扩大实现范围。

**关联 Context 资产**:

| Scope | 关联资产 | 关联说明 |
|-------|---------|----------|
| domain | `.context/domain/risks_and_debt.md` | PD-006 |
| domain | `.context/domain/business_rules.md` | BR-040 |
| architecture | `.context/architecture/api_strategy.md` | §3.5 工具治理与 catalog |

**关键任务**:
1. 与产品负责人确认三者阶段归属（补实现或移出）（0.25 人日）
2. 按结论登记到 catalog 或显式标注移出范围（0.5 人日）
3. 补测试 / 文档断言五类分组完整性（0.25 人日）

**验证标准**:

| 验收项 | 验收条件 | 验收方式 |
|--------|----------|----------|
| 无悬空 | 三者均有明确阶段归属或「移出范围」登记 | 文档检查 + catalog 断言 |
| 分组完整 | 五类分组每组含对应工具 | 单元测试 |
| 审查通过 | `pnpm typecheck` 与 `pnpm test` 通过 | `pnpm typecheck` / `pnpm test` |

**依赖**:
- 前置: `feat-tools-hub-sandbox`
- 被依赖: —
- 约束: 不擅自扩大实现范围；以产品裁决为准。

---

### 提案 3: 重复「未找到」错误码收敛

**Change ID:** `fix-rpc-error-code-dedup`  
**优先级:** P2  
**预计时间:** 1 人日  
**状态:** proposed

**业务目标（Business Goal）**:
- 收敛 TD-011：同一语义「草稿不存在」存在 `ops/not-found`（`drafts.get`）与 `ops/draft-not-found`（`workbench.prefillDraft`）两个错误码。
- 按 criterion §6 SSoT-first 统一为**单一「未找到」码**（建议保留 `ops/not-found`），并同步 `api_strategy.md` 错误码清单与调用方；不在资产侧擅自改契约。

**范围边界（In / Out）**:

| 类型 | 内容 |
|------|------|
| ✅ In | 统一「未找到」错误码；同步契约清单与调用方；补测试 |
| ✅ In | 更新 `api_strategy.md` §2.3 与相关复述 |
| ❌ Out | 自造语义相近的新码 |
| ❌ Out | 其他错误码语义变更 |

**关联 Context 资产**:

| Scope | 关联资产 | 关联说明 |
|-------|---------|----------|
| criterion | `.context/criterion.md` | §6 SSoT-first、§7.1 权威契约 |
| architecture | `.context/architecture/api_strategy.md` | §2.3 错误码清单、§3.2 `drafts.get`、§3.1 `workbench.prefillDraft` |
| architecture | `.context/architecture/risks_and_debt.md` | TD-011 |
| architecture | `.context/architecture/cross_cutting_concepts.md` | 错误码复述 |

**关键任务**:
1. 统一错误码并同步 `src/ops-rpc.ts` 调用点（0.5 人日）
2. 同步 `api_strategy.md` / `cross_cutting_concepts.md` 清单与调用方（0.25 人日）
3. 补测试断言单一「未找到」码（0.25 人日）

**验证标准**:

| 验收项 | 验收条件 | 验收方式 |
|--------|----------|----------|
| 单一码 | 「草稿不存在」只返回一个错误码 | 单元测试 |
| 清单一致 | 契约清单与实现一致 | 文档检查 + 代码审查 |
| 审查通过 | `pnpm typecheck` 与 `pnpm test` 通过 | `pnpm typecheck` / `pnpm test` |

**依赖**:
- 前置: —
- 被依赖: —
- 约束: 使用既有错误码，不自造新码。

---

## 执行顺序与依赖

- `feat-tools-hub-sandbox` 先落地，`fix-tool-catalog-registration` 依赖其 catalog 能力。
- `fix-rpc-error-code-dedup` 与工具中枢无依赖，可并行。

- 跨阶段前置条件：`feat-tools-hub-sandbox` 依赖 Phase 2 的 `feat-client-workbench-shell`。
- 提供给后续阶段的能力：工具目录与启停能力（供 Phase 5 技能包白名单切片消费）。

## 阶段整体验收

- 全量 `pnpm typecheck` 与 `pnpm test` 通过。
- 白名单强制性在宿主侧成立；catalog 中不存在任何发布类工具。
- 工具五类分组每组含对应工具，或已显式登记移出范围。
- 「未找到」语义只有单一错误码。
