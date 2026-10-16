# Phase 1: 排期日历与 Injoys 单向同步

> **返回总纲**: [proposal-roadmap.md](./proposal-roadmap.md)
> **文件名**: `proposal-roadmap-Phase-1.md`
> **状态**: proposed
> **来源**: `.context/architecture/api_strategy.md`（§3.1 排期生成 / 导出 / 导入、§3.3 `calendar.*`）、`.context/architecture/data_architecture.md`、`.context/domain/business_rules.md`（BR-020 ~ BR-024）、`.context/architecture/risks_and_debt.md`（TD-006、TD-010）
> **预计工作量与周期**: 约 9 人日

## 阶段目标与范围

- 目标与交付结果：落地**本地排期黄金主数据**（`$DSH_HOME/growth-studio/calendar/{id}.json`）、五态前向流转，以及 Injoys 表格**单向**导出 / 导入（导出幂等、导入不覆盖本地已发布状态、冲突可核对）。Phase 0/1 严格单向，不做实时双向同步。
- In / Out：
  - ✅ In：`calendar/` 持久化与类型契约；`workbench.generateCalendar`、`calendar.list`、`calendar.updateStatus`、`workbench.exportCalendar`、`workbench.importCalendar`。
  - ❌ Out：双向同步与冲突仲裁（Phase 5，`feat-injoys-bidirectional-sync`）；排期日历看板 UI（Phase 2，`feat-client-calendar-board`）。
- 适用约束：BR-020 五态不得跳级 / 回退；BR-021 全渠道不变量；BR-022 铁律仅预填不自动发布；BR-023/024 单向导出 / 导入以本地为准；criterion §3.5 持久化与并发；§6 SSoT-first。

## 提案详情

### 提案 1: 排期黄金主数据持久化（`calendar/`）

**Change ID:** `feat-calendar-store`  
**优先级:** P0  
**预计时间:** 2 人日  
**状态:** proposed

**业务目标（Business Goal）**:
- 实现 `$DSH_HOME/growth-studio/calendar/{id}.json` 排期持久化（与草稿库同级），使本地成为排期**黄金主数据源**（TD-010）。
- 在 `src/types.ts` 定义 `CalendarItem` 契约，含 `externalRowId`（Injoys 行映射）与 `documentId`（**草稿 ID，不是 Injoys 文档 ID**）。
- 复用 criterion §3.5 的原子写入 + 串行写锁 + 目录准备校验语义。

**范围边界（In / Out）**:

| 类型 | 内容 |
|------|------|
| ✅ In | `CalendarItem` 类型契约与 `calendar/` 存储服务（原子写入、写锁按绝对路径归属、目录单次操作内固定） |
| ✅ In | 按 `date` 升序读取；`externalRowId` / `documentId` 字段定义 |
| ❌ Out | 排期生成 / 状态推进 / 导入导出（后续提案） |
| ❌ Out | 双向同步（Phase 5） |

**关联 Context 资产**:

| Scope | 关联资产 | 关联说明 |
|-------|---------|----------|
| criterion | `.context/criterion.md` | §3.5 持久化、§5.5 `CalendarItem` 定义 |
| architecture | `.context/architecture/data_architecture.md` | `calendar/{id}.json` 布局与 `documentId` 关联 |
| architecture | `.context/architecture/risks_and_debt.md` | TD-010 |
| architecture | `.context/architecture/adr_005_five_state_lifecycle.md` | 五态生命周期 |

**关键任务**:
1. 在 `src/types.ts` 定义 `CalendarItem` 与相关类型（0.5 人日）
2. 实现 `src/storage/` 下的 calendar 存储服务（原子写入 + 写锁 + 目录准备校验）（1 人日）
3. 实现按 `date` 升序读取与单条读写（0.5 人日）

**验证标准**:

| 验收项 | 验收条件 | 验收方式 |
|--------|----------|----------|
| 落盘与读取 | 写入后可按 `date` 升序读回，字段完整 | 单元测试 |
| 并发安全 | 无锁并发回写被阻止；不同库同 ID 互不阻塞 | 单元测试 |
| 审查通过 | `pnpm typecheck` 与 `pnpm test` 通过 | `pnpm typecheck` / `pnpm test` |

**依赖**:
- 前置: —
- 被依赖: `feat-calendar-generation`、`feat-calendar-status-flow`、`feat-calendar-injoys-export`、`feat-calendar-injoys-import`
- 约束: 不得绕过 calendar-store 直接操作排期文件；目录单次操作内固定。

---

### 提案 2: 排期日历生成（7 天 / 周 / 月）

**Change ID:** `feat-calendar-generation`  
**优先级:** P0  
**预计时间:** 2 人日  
**状态:** proposed

**业务目标（Business Goal）**:
- 实现 `workbench.generateCalendar`：一键 AI 生成未来 7 天 / 周 / 月发布排期并落盘（BR-023、BR-NFR-003）。
- 导出为**用户显式确认**动作（`exportToSheet` 默认 `false`），生成本身不触发导出。
- 生成结果返回 `items` 与 `sheetExported` / `exportError`。

**范围边界（In / Out）**:

| 类型 | 内容 |
|------|------|
| ✅ In | `src/types.ts` + `src/ops-rpc.ts` 契约；生成逻辑；落盘为 `CalendarItem` |
| ✅ In | `exportToSheet` 默认 `false`，未导出时 `sheetExported: false`、`exportError: undefined` |
| ❌ Out | 导出实现（见提案 4） |
| ❌ Out | 客户端排期生成入口（Phase 2） |

> [!NOTE]
> 生成时按 criterion §3.5 捕获目录并贯穿；`period` 支持 `week` / `month`，默认单次跨度为 7 天（BR-NFR-003）。

**关联 Context 资产**:

| Scope | 关联资产 | 关联说明 |
|-------|---------|----------|
| criterion | `.context/criterion.md` | §3.5 目录固定、§6 SSoT-first |
| architecture | `.context/architecture/api_strategy.md` | §3.1 `workbench.generateCalendar` 请求 / 响应 |
| domain | `.context/domain/business_rules.md` | BR-023、BR-024、BR-NFR-003 |
| domain | `.context/domain/user_journeys.md` | Journey 2b（排期生成与导出） |

**关键任务**:
1. 补 `src/types.ts` / `src/ops-rpc.ts` 契约（0.5 人日）
2. 实现生成逻辑并落盘为 `CalendarItem`（1 人日）
3. 实现 `exportToSheet` 默认 `false` 语义与返回字段（0.25 人日）
4. 补测试：生成落盘、默认不导出（0.25 人日）

**验证标准**:

| 验收项 | 验收条件 | 验收方式 |
|--------|----------|----------|
| 生成落盘 | 生成后 `calendar/` 出现对应排期项，`totalItems` 与 `items` 一致 | 单元测试 |
| 不隐式导出 | 默认 `exportToSheet: false`，未导出时 `sheetExported: false` | 单元测试 |
| 审查通过 | `pnpm typecheck` 与 `pnpm test` 通过 | `pnpm typecheck` / `pnpm test` |

**依赖**:
- 前置: `feat-calendar-store`
- 被依赖: `feat-calendar-injoys-export`
- 约束: 导出须为用户显式动作。

---

### 提案 3: 排期五态流转与列表读取

**Change ID:** `feat-calendar-status-flow`  
**优先级:** P0  
**预计时间:** 1.5 人日  
**状态:** proposed

**业务目标（Business Goal）**:
- 实现 `calendar.list`（按 `period` / `platform` / `status` 过滤、`date` 升序）与 `calendar.updateStatus`。
- 服务端强制**前向**推进 `planned → drafting → draft_ready → prefilled → published`，禁止跳级 / 回退；`published` 不可经本接口写入，只能由 `drafts.updatePublishUrl` 闭环推进；越级返回 `calendar/invalid-transition`（BR-020、BR-021）。

**范围边界（In / Out）**:

| 类型 | 内容 |
|------|------|
| ✅ In | `calendar.list` / `calendar.updateStatus` 契约与实现；前向推进校验与 `calendar/invalid-transition` |
| ✅ In | 阻塞经本接口写入 `published` |
| ❌ Out | 状态映射表变更（两套枚举经架构 §4.3 映射，不改命名） |
| ❌ Out | 客户端看板渲染（Phase 2） |

**关联 Context 资产**:

| Scope | 关联资产 | 关联说明 |
|-------|---------|----------|
| criterion | `.context/criterion.md` | §5.5 `ItemStatus` 五态、§6 SSoT-first |
| architecture | `.context/architecture/api_strategy.md` | §3.3 `calendar.list` / `calendar.updateStatus` 与服务端约束 |
| architecture | `.context/architecture/adr_005_five_state_lifecycle.md` | 五态生命周期 |
| architecture | `.context/architecture/risks_and_debt.md` | RISK-009（两套枚举）、TD-004 |
| domain | `.context/domain/business_rules.md` | BR-020、BR-021 |

**关键任务**:
1. 补 `calendar.list` / `calendar.updateStatus` 契约（0.5 人日）
2. 实现前向推进校验与非法流转错误码（0.5 人日）
3. 实现列表过滤与排序（0.5 人日）

**验证标准**:

| 验收项 | 验收条件 | 验收方式 |
|--------|----------|----------|
| 前向推进 | 合法前向推进成功，跳级 / 回退返回 `calendar/invalid-transition` | 单元测试 |
| 不写 published | 经本接口写 `published` 被拒绝 | 单元测试 |
| 审查通过 | `pnpm typecheck` 与 `pnpm test` 通过 | `pnpm typecheck` / `pnpm test` |

**依赖**:
- 前置: `feat-calendar-store`
- 被依赖: `feat-client-calendar-board`
- 约束: `published` 仅由发布回填闭环推进。

---

### 提案 4: 排期单向导出至 Injoys 表格（幂等）

**Change ID:** `feat-calendar-injoys-export`  
**优先级:** P1  
**预计时间:** 2 人日  
**状态:** proposed

**业务目标（Business Goal）**:
- 实现 `workbench.exportCalendar`：把本地排期单向导出至 Injoys Spreadsheet，以 `CalendarItem.externalRowId` 为准**更新而非重复插入**，成功后回写 `externalRowId`，重复导出同一周期幂等（BR-023、BR-024）。
- 知识库未连通时导出动作如实提示不可用，不返回假成功（BR-073）。

**范围边界（In / Out）**:

| 类型 | 内容 |
|------|------|
| ✅ In | `workbench.exportCalendar` 契约与实现；幂等更新语义；`externalRowId` 回写 |
| ✅ In | 返回 `exportedCount` / `skippedCount` / `sheetExported`；失败如实返回 |
| ❌ Out | 双向同步与冲突仲裁（Phase 5） |
| ❌ Out | 导出为隐式动作（须用户显式触发） |

**关联 Context 资产**:

| Scope | 关联资产 | 关联说明 |
|-------|---------|----------|
| architecture | `.context/architecture/api_strategy.md` | §3.1 `workbench.exportCalendar` 与幂等规则 |
| architecture | `.context/architecture/adr_004_local_primary_injoys_export.md` | 本地优先、单向导出 |
| domain | `.context/domain/business_rules.md` | BR-023、BR-024、BR-073 |
| architecture | `.context/architecture/risks_and_debt.md` | TD-006 |

**关键任务**:
1. 补 `workbench.exportCalendar` 契约（0.5 人日）
2. 实现按 `externalRowId` 更新而非插入的幂等导出（1 人日）
3. 实现 `externalRowId` 回写与失败如实返回（0.5 人日）

**验证标准**:

| 验收项 | 验收条件 | 验收方式 |
|--------|----------|----------|
| 幂等 | 重复导出同一周期不产生重复行 | 单元测试 |
| 回写 | 导出成功后本地回写 `externalRowId` | 单元测试 |
| 未连通 | 知识库未连通时不返回假成功 | 单元测试 |
| 审查通过 | `pnpm typecheck` 与 `pnpm test` 通过 | `pnpm typecheck` / `pnpm test` |

**依赖**:
- 前置: `feat-calendar-store`、`feat-calendar-generation`
- 被依赖: `feat-injoys-bidirectional-sync`
- 约束: 单向、以本地为准；失败不谎报全量成功。

---

### 提案 5: 从 Injoys 表格单向导入排期（冲突可核对）

**Change ID:** `feat-calendar-injoys-import`  
**优先级:** P1  
**预计时间:** 1.5 人日  
**状态:** proposed

**业务目标（Business Goal）**:
- 实现 `workbench.importCalendar`：从 Injoys 表格导入排期行，按 api_strategy §3.1 的冲突与重复导入规则处理（同 `externalRowId` 更新；无 ID 按 `(date, platform, topic)` 三元组匹配；`date`/`platform` 冲突但 `topic` 不同视为不同项并记入 `conflicts`）。
- 导入**不覆盖**本地已 `prefilled` / `published` 项的状态与 `publishedUrl`（本地状态优先）；过程失败不回滚已成功项，如实返回计数（BR-024）。

**范围边界（In / Out）**:

| 类型 | 内容 |
|------|------|
| ✅ In | `workbench.importCalendar` 契约与实现；冲突规则；本地状态优先 |
| ✅ In | 返回 `importedCount` / `updatedCount` / `skippedCount` / `conflicts` |
| ❌ Out | 双向同步与冲突仲裁（Phase 5） |
| ❌ Out | 本地已发布项被远端覆盖 |

**关联 Context 资产**:

| Scope | 关联资产 | 关联说明 |
|-------|---------|----------|
| architecture | `.context/architecture/api_strategy.md` | §3.1 `workbench.importCalendar` 与冲突规则 |
| architecture | `.context/architecture/adr_004_local_primary_injoys_export.md` | 本地优先 |
| domain | `.context/domain/business_rules.md` | BR-021、BR-023、BR-024 |
| architecture | `.context/architecture/risks_and_debt.md` | TD-006、RISK-004 |

**关键任务**:
1. 补 `workbench.importCalendar` 契约（0.5 人日）
2. 实现三条匹配 / 冲突规则与本地状态优先（0.75 人日）
3. 实现计数返回与失败不回滚语义（0.25 人日）

**验证标准**:

| 验收项 | 验收条件 | 验收方式 |
|--------|----------|----------|
| 匹配规则 | 同 ID 更新、三元组匹配更新 / 新增、`topic` 不同记入 `conflicts` | 单元测试 |
| 本地优先 | 导入不覆盖本地 `prefilled` / `published` 状态与 `publishedUrl` | 单元测试 |
| 失败不定 | 部分失败如实返回已导入计数，不谎报全量成功 | 单元测试 |
| 审查通过 | `pnpm typecheck` 与 `pnpm test` 通过 | `pnpm typecheck` / `pnpm test` |

**依赖**:
- 前置: `feat-calendar-store`
- 被依赖: `feat-injoys-bidirectional-sync`
- 约束: 单向、以本地为准；不覆盖已发布凭据。

---

## 执行顺序与依赖

- `feat-calendar-store` 为全阶段前置，必须先完成。
- 完成后 `feat-calendar-generation` 与 `feat-calendar-status-flow` 可并行；`feat-calendar-injoys-export` 依赖 `feat-calendar-generation`；`feat-calendar-injoys-import` 仅依赖 `feat-calendar-store`，可与导出并行。

- 跨阶段前置条件：无（不依赖 Phase 0）。
- 提供给后续阶段的能力：排期主数据与 RPC（供 Phase 2 看板消费）、单向导入 / 导出（供 Phase 5 双向同步演进）。

## 阶段整体验收

- 全量 `pnpm typecheck` 与 `pnpm test` 通过。
- 五态流转不得跳级 / 回退；`published` 不经 `calendar.updateStatus` 写入。
- 导出幂等、导入不覆盖本地已发布状态；Phase 0/1 不对外宣称支持双向实时同步（BR-024）。
