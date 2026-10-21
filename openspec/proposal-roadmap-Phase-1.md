# Phase 1: 排期主数据与 Injoys 单向同步

> **返回总纲**: [proposal-roadmap.md](./proposal-roadmap.md)
> **文件名**: `proposal-roadmap-Phase-1.md`（编号与总纲阶段总览一致：Phase 1 → `Phase-1`）
> **状态**: proposed
> **来源**: `.context/architecture/risks_and_debt.md`（TD-001 / TD-006 / TD-010）；`.context/architecture/api_strategy.md` §3.1 / §3.3；`.context/architecture/data_architecture.md`；`.context/architecture/runtime_view.md`（场景 1）；`.context/architecture/adr_004_local_primary_injoys_export.md`；`.context/domain/risks_and_debt.md`（RISK-B005 / PD-003）；`.context/domain/testing_strategy.md` 模块 2
> **预计工作量与周期**: ~15 人日（**规划估算**；源文档工作量字段为 `N/A – 源文档未提供`）

## 阶段目标与范围

- **目标与交付结果**：让**本地排期**成为黄金主数据源，并打通「生成（含 `exportToSheet:true` 生成时立即导出）→ 状态推进 → 单向导出 → 显式导入」的完整链路，为 Phase 3 的排期日历 UI 与 Phase 0 端到端闭环提供宿主契约。严格遵循 `adr_004_local_primary_injoys_export.md`：本地优先、单向导出，不做实时双向同步。
- **In / Out**：
  - ✅ In：`$DSH_HOME/growth-studio/calendar/{id}.json` 排期主数据落盘服务；`workbench.generateCalendar` / `calendar.list` / `calendar.updateStatus` / `workbench.exportCalendar` / `workbench.importCalendar` 的契约与实现；五态前向推进校验；按 `externalRowId` 幂等导出；生成时 `exportToSheet:true` 的**立即导出**语义（成功 `sheetExported:true`、失败 `sheetExported:false` + 真实 `exportError`）；显式导入与冲突不覆盖规则。
  - ❌ Out：实时双向同步与冲突仲裁（PD-003 / RISK-B005，PRD Phase 3，**不在本路线图范围**）；生成时导出需用户显式请求（`exportToSheet` 默认 `false`，独立 `workbench.exportCalendar` 仍为显式导出操作）；排期日历 UI（`feat-client-schedule-view`，Phase 3）。
- **适用约束**：
  - `criterion.md` §6 SSoT-first（先补 `src/types.ts` → `src/ops-rpc.ts` 契约，再实现领域服务）；
  - `criterion.md` §4「`published` 只能经 `drafts.updatePublishUrl` 回填闭环写入」——`calendar.updateStatus` **不可**写入 `published`；
  - `criterion.md` §3.5 目录固定与统一错误边界；
  - `api_strategy.md` §3.1 导出幂等规则（以 `externalRowId` 更新而非重复插入）、§3.1 导入冲突规则（本地状态优先）；
  - `runtime_view.md` 场景 1：`exportToSheet` **默认 `false`**（默认仅落盘）；**`true` 时生成后立即导出**，成功返回 `sheetExported:true`、失败返回 `sheetExported:false` + 真实 `exportError`（不谎报）。

## 提案详情

### 提案 1: 排期主数据本地落盘服务

**Change ID:** `feat-storage-calendar-items`  
**优先级:** P0  
**预计时间:** 3 人日（规划估算）  
**状态:** proposed  
**变更类型（change_kind）:** `code`（判定依据：新增或修改宿主 / 客户端业务代码及其测试；契约文档同步属 SSoT-first 随附动作，不单独计为文档类交付）  

**业务目标（Business Goal）**:
- 落地 `$DSH_HOME/growth-studio/calendar/{id}.json` 排期黄金主数据源，使排期不再仅存在于内存或 Injoys 侧。
- 为生成 / 状态推进 / 导出 / 导入提供统一的读写与版本基础。

**范围边界（In / Out）**:

| 类型 | 内容 |
|------|------|
| ✅ In | `src/types.ts` 的 `CalendarItem` 与 `ItemStatus` 契约（五态：`planned` / `drafting` / `draft_ready` / `prefilled` / `published`）；含 `documentId`（关联 `ContentDraft.id`，criterion §5.5）与 `externalRowId` 字段 |
| ✅ In | `src/storage/` 下 calendar 读写服务（落盘、读取、按周期 / 平台 / 状态查询） |
| ✅ In | 复用 `draftsDir` 同级布局与统一落盘封装（含目录固定与错误码映射） |
| ❌ Out | `calendar.list` 的方法实现（属提案 2）、`calendar.updateStatus` 的方法实现（属提案 3） |
| ❌ Out | Injoys 导出 / 导入（提案 4 / 5） |
| ❌ Out | 排期日历 UI（Phase 3） |

**关联 Context 资产**:

| Scope | 关联资产 | 关联说明 |
|-------|---------|----------|
| criterion | `.context/criterion.md` | §6 SSoT-first、§3.5 落盘与目录固定、§3.1 硬编码色值等（UI 无关） |
| architecture | `.context/architecture/risks_and_debt.md` | TD-010（calendar 部分）、TD-004（`draft_ready` vs `ready_for_review` 命名差异）、RISK-009（两套状态枚举映射） |
| architecture | `.context/architecture/data_architecture.md` | `calendar/{id}.json` 布局与状态映射表 |
| architecture | `.context/architecture/api_strategy.md` | §3.1 `generateCalendar` 的持久化职责 |
| architecture | `.context/architecture/adr_004_local_primary_injoys_export.md` | 本地为主、单向导出裁决 |
| architecture | `.context/architecture/adr_005_five_state_lifecycle.md` | 五态生命周期 |

**关键任务**:
1. 补 `src/types.ts` 的 `CalendarItem` / `ItemStatus` 契约（0.75 人日）
2. 实现 `calendar/` 读写服务与查询（按周期 / 平台 / 状态，`date` 升序）（1.5 人日）
3. 接入统一落盘封装（目录固定、权限位、`drafts/storage-unavailable` 类错误映射）（0.5 人日）
4. 补存储层测试（落盘 / 读取 / 排序 / 目录固定）（0.25 人日）

**验证标准**:

| 验收项 | 验收条件 | 验收方式 |
|--------|----------|----------|
| 落盘正确 | 排期项写入 `calendar/{id}.json` 并可读回 | 单元测试 |
| 查询排序 | `calendar` 查询结果按 `date` 升序 | 单元测试 |
| 五态枚举 | `ItemStatus` 与 `adr_005` 一致，无 `approved` / `archived` | 代码审查 + `pnpm typecheck` |
| 目录固定 | 单次操作内目录固定，配置切换只对新操作生效 | 单元测试 |

**依赖**:
- 前置: `fix-storage-file-permissions`
- 被依赖: `feat-calendar-generate-list`、`feat-calendar-status-transitions`、`feat-calendar-injoys-export`、`feat-calendar-injoys-import`
- 约束: 契约先行（criterion §6）；两侧枚举（`ItemStatus` vs `ContentDraft.status`）不可互换，须经映射表（RISK-009）

---

### 提案 2: 排期生成、读取与生成时立即导出

**Change ID:** `feat-calendar-generate-list`  
**优先级:** P0  
**预计时间:** 4.5 人日（规划估算）  
**状态:** proposed  
**变更类型（change_kind）:** `code`（判定依据：新增或修改宿主 / 客户端业务代码及其测试；契约文档同步属 SSoT-first 随附动作，不单独计为文档类交付）  

**业务目标（Business Goal）**:
- 交付 `workbench.generateCalendar` 与 `calendar.list`，使「未来 7 天 / 周月视图」的排期生成与读取可用。
- 支持生成时 `exportToSheet:true` 的**立即导出**语义（复用单向导出实现，成功 / 失败如实返回），同时保持 `exportToSheet` 默认 `false`（导出默认是用户显式确认的动作）。
- 让驾驶舱的 `weeklyPipeline` 由**真实排期库**聚合（Phase 0 只交付字段契约，见 `fix-overview-metrics-null-semantics`）。

**范围边界（In / Out）**:

| 类型 | 内容 |
|------|------|
| ✅ In | `workbench.generateCalendar`（`period` / `focusVersion` / `platforms` / `exportToSheet`）与 `calendar.list`（`period` / `platform` / `status`）契约与实现 |
| ✅ In | 生成行落盘至 `calendar/{id}.json`；响应含 `totalItems` / `items` / `sheetExported` |
| ✅ In | `exportToSheet:true` 时生成后**立即导出**（复用 `feat-calendar-injoys-export` 的导出路径）：成功返回 `sheetExported:true`，失败返回 `sheetExported:false` + 真实 `exportError`，**不谎报导出成功** |
| ✅ In | 在 `workbench.overview` 响应中按周聚合 `overviewMetrics.weeklyPipeline`（`total` / `completed` / `byStatus`），数据源为 `calendar/{id}.json`；`completed` = `prefilled` + `published` |
| ✅ In | 补齐 `calendar/invalid-transition` 等预留错误码（如涉及） |
| ❌ Out | 独立 `workbench.exportCalendar` 方法本身的实现（提案 4；本提案只**复用**其导出路径做生成时立即导出） |
| ❌ Out | 状态推进（提案 3） |

> [!NOTE]
> **灰区说明（4.5 人日）**：本提案虽处 4-5 人日灰区，但生成、读取与「生成时立即导出」共用同一 `CalendarEngine` 与同一 `workbench.generateCalendar` 契约出口，拆分会使「生成后立即导出」跨提案割裂、难以单轮验收，故**不进一步拆分**；其中立即导出部分以**依赖**提案 4（`feat-calendar-injoys-export`）的方式复用导出实现，避免重复实现同一幂等导出逻辑。

**关联 Context 资产**:

| Scope | 关联资产 | 关联说明 |
|-------|---------|----------|
| criterion | `.context/criterion.md` | §6 SSoT-first、§3.1 禁止客户端承载核心业务规则、§3.2 不谎报 |
| architecture | `.context/architecture/risks_and_debt.md` | TD-001（`generateCalendar` / `calendar.list`） |
| architecture | `.context/architecture/api_strategy.md` | §3.1 `generateCalendar`（含 `exportToSheet` 与 `sheetExported` / `exportError`）、§3.3 `calendar.list` 契约 |
| architecture | `.context/architecture/runtime_view.md` | 场景 1：`exportToSheet` 默认 false；true 时生成后立即导出（成功 / 失败语义） |
| architecture | `.context/architecture/adr_004_local_primary_injoys_export.md` | 本地为主、单向导出裁决 |
| domain | `.context/domain/testing_strategy.md` | 模块 2 场景 4 / 5 |

**关键任务**:
1. 补 `src/types.ts` 的请求 / 响应契约（含 `exportToSheet` / `sheetExported` / `exportError`）（0.5 人日）
2. 实现 `workbench.generateCalendar`（生成排期行并落盘）（1.25 人日）
3. 实现 `calendar.list`（按周期 / 平台 / 状态过滤）（1 人日）
4. 将排期库接入 `workbench.overview` 响应的 `overviewMetrics.weeklyPipeline` 周聚合（`total` / `completed` / `byStatus`）（0.5 人日）
5. 实现 `exportToSheet:true` 时生成后立即导出（复用导出路径并回写 `externalRowId`；失败返回 `sheetExported:false` + `exportError`）（1 人日）
6. 补测试（生成落盘、读取过滤、`exportToSheet` 默认 false / true 立即导出、周进度聚合）（0.25 人日）

**验证标准**:

| 验收项 | 验收条件 | 验收方式 |
|--------|----------|----------|
| 生成落盘 | 生成后本地存在对应排期行 | 单元测试 |
| 默认不导出 | `exportToSheet` 缺省为 `false`，未导出时不写 Injoys | 单元测试 + mock |
| 立即导出 | `exportToSheet:true` 时生成后立即导出，成功返回 `sheetExported:true` | 单元测试 + mock |
| 导出失败不谎报 | 立即导出失败时返回 `sheetExported:false` + 真实 `exportError` | 单元测试 |
| 读取过滤 | `calendar.list` 按 `period` / `platform` / `status` 正确过滤 | 单元测试 |
| 周进度真实 | `workbench.overview` 响应的 `overviewMetrics.weeklyPipeline` 的 `total` / `completed` / `byStatus` 与本周实际排期项（含状态）一致 | 单元测试 |

**验收场景（按需，建议 BDD）**:

```gherkin
场景: 本周排期进度来自真实排期库
  Given 本地排期库中存在本周的排期项及其状态
  When 用户查看驾驶舱的本周排期进度
  Then overviewMetrics.weeklyPipeline 的 total / completed / byStatus 应与实际排期项一致
    And 不得出现无数据源支撑的进度数值

场景: 生成时立即导出（exportToSheet）
  Given 用户生成未来 7 天的排期并勾选"同时导出至 Injoys 表格"
  When Injoys 未配置或导出失败
  Then 响应应返回 sheetExported:false 与真实 exportError
    And 不得谎报导出成功
```

**依赖**:
- 前置: `feat-storage-calendar-items`、`feat-calendar-injoys-export`、`fix-overview-metrics-null-semantics`
- 被依赖: `feat-client-schedule-view`、`feat-client-dashboard`
- 约束: 导出应是用户显式确认的动作（`api_strategy.md` §3.1）——`exportToSheet` 默认 `false`；`weeklyPipeline` 的口径与窗口字段以 `fix-overview-metrics-null-semantics` 建立的契约为准；生成时立即导出须复用提案 4 的幂等导出路径

---

### 提案 3: 排期状态前向推进与校验

**Change ID:** `feat-calendar-status-transitions`  
**优先级:** P1  
**预计时间:** 2.5 人日（规划估算）  
**状态:** proposed  
**变更类型（change_kind）:** `code`（判定依据：新增或修改宿主 / 客户端业务代码及其测试；契约文档同步属 SSoT-first 随附动作，不单独计为文档类交付）  

**业务目标（Business Goal）**:
- 交付 `calendar.updateStatus`，仅允许五态**前向**推进，维护排期状态的真实性。
- 保证 `published` 不可经本接口写入，只能由回填闭环推进，避免发布闭环被绕过。
- 维护 `CalendarItem.documentId` 与 `ContentDraft.id` 的关联不变量，打通「排期 → 创作 → 预填 → 回填」。

**范围边界（In / Out）**:

| 类型 | 内容 |
|------|------|
| ✅ In | `calendar.updateStatus` 契约与实现；前向推进校验（`planned` → `drafting` → `draft_ready` → `prefilled` → `published`） |
| ✅ In | 越级 / 回退 / 经本接口写 `published` 时返回 `calendar/invalid-transition` |
| ✅ In | 与 `drafts.updatePublishUrl` 回填闭环的衔接（`prefilled` → `published` 由回填推进） |
| ✅ In | `CalendarItem.documentId` 关联不变量：进入 `draft_ready` 前必须已绑定草稿 `documentId`；生成落草稿后写回 `documentId`，预填 / 回填后同步状态（criterion §5.5） |
| ❌ Out | 经 `calendar.updateStatus` 写入 `published`（**禁止**） |
| ❌ Out | 状态推进 UI（Phase 3） |

**关联 Context 资产**:

| Scope | 关联资产 | 关联说明 |
|-------|---------|----------|
| criterion | `.context/criterion.md` | §4 `published` 唯一入口为 `drafts.updatePublishUrl`；§5.5 `CalendarItem` 与 `ContentDraft` 经 `documentId` 关联 |
| architecture | `.context/architecture/risks_and_debt.md` | TD-001、RISK-001（状态真实性）、RISK-009 |
| architecture | `.context/architecture/api_strategy.md` | §3.3 `calendar.updateStatus` 约束 |
| architecture | `.context/architecture/adr_005_five_state_lifecycle.md` | 五态与前向规则 |
| domain | `.context/domain/testing_strategy.md` | 模块 2 场景 1 / 2 / 3 |

**关键任务**:
1. 补 `calendar.updateStatus` 契约（0.5 人日）
2. 实现前向推进校验与 `calendar/invalid-transition`（1 人日）
3. 实现 `published` 拒写与回填闭环衔接（0.25 人日）
4. 实现 `documentId` 关联不变量与状态同步（生成落草稿后写回 `documentId`；预填 → `prefilled`；回填 → `published`）（0.5 人日）
5. 补测试（前向成功 / 回退拒绝 / 越级拒绝 / 写 `published` 拒绝 / `documentId` 不变量）（0.25 人日）

**验证标准**:

| 验收项 | 验收条件 | 验收方式 |
|--------|----------|----------|
| 前向推进 | 合法前向推进成功并返回更新后的 `item` | 单元测试 |
| 回退 / 越级拒绝 | 非法流转返回 `calendar/invalid-transition` | 单元测试 |
| 拒写 published | 经本接口写 `published` 被拒 | 单元测试 |
| 关联不变量 | 未绑定 `documentId` 的排期项不可推进至 `draft_ready`；生成落草稿后 `documentId` 写回 | 单元测试 |

**验收场景（按需，建议 BDD）**:

```gherkin
场景: 内容状态五态流转
  Given 一个排期项当前状态为"计划中"
  When 用户依次推进该排期项状态
  Then 状态应依次呈现为"撰写中" → "草稿就绪" → "已推草稿箱" → "已发布"

场景: 未回填 URL 不得标记为已发布
  Given 一个排期项处于"已推草稿箱"状态
    And 用户尚未填入任何平台 URL
  When 用户查看该排期项状态
  Then 状态应保持为"已推草稿箱"
```

**依赖**:
- 前置: `feat-storage-calendar-items`
- 被依赖: `feat-client-schedule-view`、`feat-client-content-studio`（从排期项发起创作并推进状态）
- 约束: `published` 只能由 `drafts.updatePublishUrl` 写入（criterion §4）

---

### 提案 4: 排期单向导出至 Injoys 表格

**Change ID:** `feat-calendar-injoys-export`  
**优先级:** P0  
**预计时间:** 3 人日（规划估算）  
**状态:** proposed  
**变更类型（change_kind）:** `code`（判定依据：新增或修改宿主 / 客户端业务代码及其测试；契约文档同步属 SSoT-first 随附动作，不单独计为文档类交付）  

**业务目标（Business Goal）**:
- 交付 `workbench.exportCalendar`，把本地排期单向写入 Injoys 表格，保持本地为黄金主数据源。
- 以 `externalRowId` 保证重复导出**幂等**，不产生重复行。

**范围边界（In / Out）**:

| 类型 | 内容 |
|------|------|
| ✅ In | `workbench.exportCalendar`（`period` / `itemIds`）契约与实现；返回 `exportedCount` / `skippedCount` / `sheetExported` |
| ✅ In | 以 `CalendarItem.externalRowId` 做更新而非重复插入；导出成功后回写 `externalRowId` |
| ✅ In | 导出链路经 `InjoysClient` 写表格；失败如实返回 |
| ❌ Out | 从 Injoys 导入（提案 5） |
| ❌ Out | 实时双向同步（PD-003，Phase 3） |

**关联 Context 资产**:

| Scope | 关联资产 | 关联说明 |
|-------|---------|----------|
| criterion | `.context/criterion.md` | §3.1 禁止客户端直连 Injoys、§6 SSoT-first |
| architecture | `.context/architecture/risks_and_debt.md` | TD-001、TD-006（单向导出有意为之） |
| domain | `.context/domain/risks_and_debt.md` | RISK-B005（多平台同步冲突造成数据覆盖；单向导出规避） |
| architecture | `.context/architecture/api_strategy.md` | §3.1 `exportCalendar` 幂等规则 |
| architecture | `.context/architecture/adr_004_local_primary_injoys_export.md` | 单向导出裁决 |
| domain | `.context/domain/testing_strategy.md` | 模块 2 场景 4 |

**关键任务**:
1. 补 `exportCalendar` 契约（0.5 人日）
2. 实现导出与 `externalRowId` 幂等更新（1.5 人日）
3. 实现导出失败如实返回与本地 `externalRowId` 回写（0.75 人日）
4. 补测试（首次导出 / 重复导出幂等 / 失败如实返回）（0.25 人日）

**验证标准**:

| 验收项 | 验收条件 | 验收方式 |
|--------|----------|----------|
| 单向导出 | 排期行真实写入 Injoys 表格 | 单元测试（mock）+ Phase 0 Live 实测 |
| 幂等 | 重复导出同一周期不产生重复行 | 单元测试 |
| 失败如实 | 导出失败返回真实错误，不谎报成功 | 单元测试 |

**验收场景（按需，建议 BDD）**:

```gherkin
场景: 排期导出至 Injoys 表格
  Given 用户已生成未来 7 天的排期
  When 用户点击"导出至 Injoys 表格"
  Then 排期行应出现在 Injoys 表格中
    And 表格中的行内容应与工作台内的排期一致
```

**依赖**:
- 前置: `feat-storage-calendar-items`
- 被依赖: `feat-calendar-generate-list`（生成时立即导出复用其导出路径）、`feat-calendar-injoys-import`、`feat-client-schedule-view`
- 约束: 以本地为准的单向导出，避免双向覆盖（RISK-B005）

---

### 提案 5: 从 Injoys 表格显式导入排期

**Change ID:** `feat-calendar-injoys-import`  
**优先级:** P1  
**预计时间:** 2 人日（规划估算）  
**状态:** proposed  
**变更类型（change_kind）:** `code`（判定依据：新增或修改宿主 / 客户端业务代码及其测试；契约文档同步属 SSoT-first 随附动作，不单独计为文档类交付）  

**业务目标（Business Goal）**:
- 交付 `workbench.importCalendar`，让 Injoys 表格侧的手工修改可经**显式**导入回流，且**不覆盖**本地已 `prefilled` / `published` 项的状态与 `publishedUrl`。
- 导入失败**不回滚已成功项**、**不谎报全量成功**。

**范围边界（In / Out）**:

| 类型 | 内容 |
|------|------|
| ✅ In | `workbench.importCalendar`（`period` 默认 `all`）契约与实现；返回 `importedCount` / `updatedCount` / `skippedCount` / `conflicts` |
| ✅ In | 冲突规则：有 `externalRowId` 命中则更新；无 ID 按 `(date, platform, topic)` 匹配；`date`/`platform` 冲突但 `topic` 不同记为 `conflicts` |
| ✅ In | 导入**不覆盖**本地 `prefilled` / `published` 的状态与 `publishedUrl` |
| ❌ Out | 自动 / 实时导入（须用户显式触发） |
| ❌ Out | 双向同步冲突仲裁（PD-003，Phase 3） |

**关联 Context 资产**:

| Scope | 关联资产 | 关联说明 |
|-------|---------|----------|
| criterion | `.context/criterion.md` | §3.2 不谎报成功、§6 SSoT-first |
| architecture | `.context/architecture/risks_and_debt.md` | TD-001、TD-006 |
| architecture | `.context/architecture/api_strategy.md` | §3.1 `importCalendar` 冲突与重复导入规则 |
| domain | `.context/domain/risks_and_debt.md` | PD-003、RISK-B005 |
| domain | `.context/domain/testing_strategy.md` | 模块 2 场景 5 |

**关键任务**:
1. 补 `importCalendar` 契约（0.5 人日）
2. 实现导入与冲突 / 更新规则（1 人日）
3. 实现「本地状态优先」不覆盖与部分失败如实返回（0.25 人日）
4. 补测试（更新 / 新增 / 冲突标记 / 不覆盖已发布）（0.25 人日）

**验证标准**:

| 验收项 | 验收条件 | 验收方式 |
|--------|----------|----------|
| 显式导入 | 远端排期行出现在工作台排期看板 | 单元测试 + Live 实测 |
| 本地状态优先 | 导入不覆盖已 `prefilled` / `published` 的状态与 `publishedUrl` | 单元测试 |
| 不谎报 | 导入部分失败时如实返回计数与错误 | 单元测试 |

**验收场景（按需，建议 BDD）**:

```gherkin
场景: 从 Injoys 表格导入排期
  Given Injoys 表格中已存在若干排期行
  When 用户执行"从 Injoys 表格导入"
  Then 已有排期行应出现在工作台的排期看板中
```

**依赖**:
- 前置: `feat-storage-calendar-items`、`feat-calendar-injoys-export`
- 被依赖: `feat-client-schedule-view`
- 约束: 显式触发；导入不覆盖本地已发布结果（`api_strategy.md` §3.1）

---

## 执行顺序与依赖

- **关键路径**：`feat-storage-calendar-items` → `feat-calendar-injoys-export` → `feat-calendar-generate-list`（生成时立即导出复用导出路径）→ `feat-calendar-injoys-import`。
- **可并行**：`feat-calendar-status-transitions`、`feat-calendar-injoys-export` 只依赖 `feat-storage-calendar-items`，可先行并行；`feat-calendar-generate-list` 须待 `feat-calendar-injoys-export` 完成（其 `exportToSheet:true` 立即导出复用同一路径）。
- 跨阶段前置条件：`feat-calendar-generate-list` 的 `weeklyPipeline` 字段口径依赖 Phase 0 的 `fix-overview-metrics-null-semantics`。
- 提供给后续阶段的能力：排期主数据与四类方法与契约（供 Phase 3 `feat-client-schedule-view` 消费）；`externalRowId` 幂等语义（供未来 Phase 3 双向同步演进）；`weeklyPipeline` 的真实周聚合（供 Phase 3 `feat-client-dashboard`）；`documentId` 关联不变量（供 Phase 3 创作室 → 预填 → 回填链路）。

## 阶段整体验收

- 模块 2 BDD 场景通过：状态五态流转、发布确认闭环、未回填不得已发布、导出至 Injoys、从 Injoys 导入。
- 宿主侧联动闭环：由 `feat-calendar-generate-list` + `feat-calendar-status-transitions` 保证——生成落草稿后写回 `CalendarItem.documentId`、无 `documentId` 不可进入 `draft_ready`、预填推进至 `prefilled`、回填 `publishedUrl` 后推进至 `published`；`weeklyPipeline` 的 `total` / `completed` / `byStatus` 与本周真实排期项一致（端到端「排期 → 创作 → 预填 → 回填」联合验收在 Phase 3 完成）。
- Phase 0 Live 实测清单中「排期行能真实写入 Injoys 表格并读取回显」可勾选。
- `pnpm typecheck` + `pnpm test` 通过；新增用例覆盖生成落盘、生成时立即导出（成功 / 失败如实返回）、状态前向校验、`documentId` 关联不变量、周进度聚合、导出幂等、导入冲突与本地状态优先。

## 待决事项（按需）

- 无。本 Phase 严格限定单向导出 / 导入，双向同步冲突规则属 PRD Phase 3，已明确移出本路线图范围（见总纲「规划口径说明」）。
