# Phase 0: 契约基线与铁律缺口

> **返回总纲**: [proposal-roadmap.md](./proposal-roadmap.md)
> **文件名**: `proposal-roadmap-Phase-0.md`
> **状态**: proposed
> **来源**: `.context/criterion.md`（§4 安全约束、§3.5 数据持久化、§6 SSoT-first）、`.context/architecture/risks_and_debt.md`（TD-007 ~ TD-014）、`.context/architecture/api_strategy.md`、`.context/domain/risks_and_debt.md`
> **预计工作量与周期**: 约 11.5 人日

## 阶段目标与范围

- 目标与交付结果：优先补齐**直接触碰架构铁律**的高严重性缺口 —— 数据真实性（`workbench.overview` 汇总语义）、内容写入边界（生成路径未授权写 Injoys）、虚报成功（复盘文档编号）、最小权限（BrowserOS 动作白名单）；并补齐数据真实性所依赖的**指标历史快照**与内容边界所依赖的**唯一显式沉淀入口** `workbench.sinkToInjoysDoc`，把后续阶段建立在其上的基座做可信。
- In / Out：
  - ✅ In：`metrics/` 历史快照持久化；`workbench.sinkToInjoysDoc` 契约与实现；`workbench.overview` 汇总语义补全；生成路径写入边界修复；复盘工具如实返回；BrowserOS 动作白名单对齐与宿主侧校验；文件权限收敛。
  - ❌ Out：排期日历（Phase 1）、客户端 UI（Phase 2）、工具中枢（Phase 3）、舆情（Phase 4）、出海与技能包（Phase 5）；草稿版本快照与历史（MVP 裁决已移出范围）。
- 适用约束：criterion §3.5（目录单次操作固定、原子写入、权限仅限当前 OS 用户）、§4（铁律：仅预填不自动发布、`published` 仅经 `drafts.updatePublishUrl` + URL 解析器校验、指标可空语义、Cookie 零外发、最小权限）、§6 SSoT-first（`src/types.ts` → `src/ops-rpc.ts` → 领域服务 → 客户端 UI 与测试）。

## 提案详情

### 提案 1: 指标历史快照持久化（环比基准）

**Change ID:** `feat-metrics-history-persistence`  
**优先级:** P0  
**预计时间:** 2 人日  
**状态:** proposed

**业务目标（Business Goal）**:
- 每次指标采集成功后按 `(platform, capturedAt)` 追加写入 `$DSH_HOME/growth-studio/metrics/{YYYY-MM-DD}.json`，为环比提供**本地可信基准**。
- 使 criterion §4「历史不足以覆盖完整对比窗口时 delta 必须为 `null`」具备真实落点，而非因目录不存在而恒为 `null`。
- 缓解 RISK-006（以偏概全）/ RISK-007（环比基准不可用误读）。

**范围边界（In / Out）**:

| 类型 | 内容 |
|------|------|
| ✅ In | `metrics/` 存储服务（按日期分文件、按 `(platform, capturedAt)` 追加、原子写入 + 串行写锁） |
| ✅ In | `src/types.ts` 指标快照类型契约；采集成功后落盘钩子 |
| ✅ In | 快照读取接口（供环比基准计算消费） |
| ❌ Out | `workbench.overview` 汇总语义与响应字段（见提案 3） |
| ❌ Out | 快照保留时长 / 清理策略（源文档未提供，暂不引入） |
| ❌ Out | 向任何远端上报指标 |

> [!NOTE]
> 快照目录与草稿库同级（`$DSH_HOME/growth-studio/`）；目录须遵循 criterion §3.5 的「单次操作内固定 + 原子写入 + 权限仅限当前 OS 用户」；`capturedAt` 表示抓取时刻，与统计窗口是两个独立概念（api_strategy §3.1）。

**关联 Context 资产**:

| Scope | 关联资产 | 关联说明 |
|-------|---------|----------|
| criterion | `.context/criterion.md` | §3.5 持久化与权限、§4 环比基准与指标真实性 |
| architecture | `.context/architecture/data_architecture.md` | `metrics/{YYYY-MM-DD}.json` 存储布局与 `(platform, capturedAt)` 追加口径 |
| architecture | `.context/architecture/api_strategy.md` | §3.1「环比基准来源」与服务端强制口径 |
| architecture | `.context/architecture/risks_and_debt.md` | RISK-006 / RISK-007、TD-010 |
| domain | `.context/domain/business_rules.md` | BR-050 指标真实性、BR-052 互动与环比副标题 |

**关键任务**:
1. 在 `src/types.ts` 补指标快照类型（平台、`capturedAt`、可空指标字段）（0.5 人日）
2. 实现 `src/storage/` 下的 metrics 存储服务：按日期分文件、追加语义、原子写入 + 串行写锁、目录准备与可写校验（0.75 人日）
3. 在指标采集成功后接入落盘钩子，并保持「采集失败 / 不支持 → `null`」不被写入为 0（0.5 人日）
4. 补测试：追加幂等、零值 vs 缺失严格区分、目录不可写如实抛错（0.25 人日）

**验证标准**:

| 验收项 | 验收条件 | 验收方式 |
|--------|----------|----------|
| 快照落盘 | 采集成功后出现 `metrics/{YYYY-MM-DD}.json`，含 `(platform, capturedAt)` 记录 | 单元测试 + 手工检查落盘文件 |
| 零值 vs 缺失 | 真实返回 `0` 写入为 `0`；采集失败写 `null` 而非 `0` | 单元测试（两条用例） |
| 不伪造 | 无采集结果时不写入任何占位数值 | 代码审查 + 测试 |
| 审查通过 | `pnpm typecheck` 与 `pnpm test` 通过 | `pnpm typecheck` / `pnpm test` |

**依赖**:
- 前置: —
- 被依赖: `fix-analytics-overview-aggregation`、`feat-weekly-review-report`
- 约束: 不得引入外部常驻服务端或后台定时轮询（criterion §3.4）；目录单次操作内固定。

---

### 提案 2: 显式沉淀至 Injoys 知识文档（唯一授权入口）

**Change ID:** `feat-workbench-sink-to-injoys-doc`  
**优先级:** P0  
**预计时间:** 1.5 人日  
**状态:** proposed

**业务目标（Business Goal）**:
- 实现 `workbench.sinkToInjoysDoc`，作为写入 Injoys 知识文档的**唯一**用户显式授权入口（PRD §5.4.3「💾 沉淀至 Injoys 知识文档」）。
- 使「生成只保存本地」得以成立：只有该接口才允许把物料写入用户 Injoys 空间。
- 失败时如实返回真实错误，不谎报成功、不静默写本地假 ID。

**范围边界（In / Out）**:

| 类型 | 内容 |
|------|------|
| ✅ In | `src/types.ts` + `src/ops-rpc.ts` 的 `workbench.sinkToInjoysDoc` 契约；请求开始时捕获草稿目录并贯穿读取、远端写入、`injoysDocId` 回写 |
| ✅ In | 重复沉淀幂等（已有 `injoysDocId` 默认更新而非新建） |
| ✅ In | 未配置 / 调用失败时返回 `success: false` 与真实错误信息 |
| ❌ Out | 从生成 / 复盘路径移除无条件写入（见提案 4） |
| ❌ Out | 客户端沉淀按钮与操作条（Phase 2，`feat-client-studio-preview`） |
| ❌ Out | 知识库读取限制（读取不受内容写入边界约束） |

> [!NOTE]
> 该请求的目录固定须覆盖**每一次落盘**（criterion §3.5）；生成请求与该请求各自固定目录，生成不得自动延伸为远端写入。

**关联 Context 资产**:

| Scope | 关联资产 | 关联说明 |
|-------|---------|----------|
| criterion | `.context/criterion.md` | §3.5 复合 RPC 目录固定、§4 内容写入边界 |
| architecture | `.context/architecture/api_strategy.md` | §3.1 `workbench.sinkToInjoysDoc` 请求 / 响应与语义约束 |
| architecture | `.context/architecture/adr_002_prefill_only_human_in_the_loop.md` | 人工在环与显式触发边界 |
| architecture | `.context/architecture/risks_and_debt.md` | TD-001、TD-008 |
| domain | `.context/domain/business_rules.md` | BR-030、BR-033、BR-NFR-002 |

**关键任务**:
1. 按 SSoT-first 补 `src/types.ts` 与 `src/ops-rpc.ts` 的 `workbench.sinkToInjoysDoc` 契约（0.5 人日）
2. 实现链路：宿主 → `InjoysClient` → `document.create`，请求开始固定目录并贯穿（0.5 人日）
3. 幂等与失败语义：已有 `injoysDocId` 走更新；失败返回真实错误、不写假 ID（0.25 人日）
4. 补测试：未配置不谎报成功、重复沉淀不产生重复文档（0.25 人日）

**验证标准**:

| 验收项 | 验收条件 | 验收方式 |
|--------|----------|----------|
| 唯一入口 | 仅该接口写入 Injoys 文档，生成路径不再无条件写入 | 代码审查 |
| 失败如实 | Injoys 未配置 / 调用失败返回 `success: false` + 真实错误 | 单元测试 |
| 幂等 | 重复沉淀同一草稿更新而非新建 | 单元测试 |
| 审查通过 | `pnpm typecheck` 与 `pnpm test` 通过 | `pnpm typecheck` / `pnpm test` |

**依赖**:
- 前置: —
- 被依赖: `fix-studio-generation-write-boundary`、`feat-client-studio-preview`
- 约束: 目录单次操作内固定；不得谎报成功。

---

### 提案 3: `workbench.overview` 部分缺失汇总语义补全

**Change ID:** `fix-analytics-overview-aggregation`  
**优先级:** P0  
**预计时间:** 2 人日  
**状态:** proposed

**业务目标（Business Goal）**:
- 按 criterion §4 与 api_strategy §3.1 实现「部分缺失 → 汇总值为 `null`」的严格汇总语义，杜绝用不完整数据冒充全网总量（架构铁律 3）。
- 补齐响应字段 `measuredPlatforms` / `unmeasuredPlatforms` / `totalEngagements` / `totalFavorites` / `comparison` / `weeklyPipeline`。
- 真实 `0` 参与求和，与「采集失败 / 不支持」的 `null` 严格区分。

**范围边界（In / Out）**:

| 类型 | 内容 |
|------|------|
| ✅ In | `src/types.ts` 补充 `windowStart` / `windowEnd` 与汇总字段；`src/analytics/` 汇总判定（`measuredPlatforms == P` 才给数字，否则 `null`） |
| ✅ In | `comparison` 基于提案 1 的本地快照计算，历史不足时为 `null`；`weeklyPipeline` 本周排期进度 |
| ✅ In | 测试覆盖「部分缺失 → `null`」与「真实 0 参与求和」两条用例 |
| ❌ Out | 客户端驾驶舱渲染（Phase 2，`feat-client-cockpit-matrix`） |
| ❌ Out | 采集机制本身与 `views` 兼容字段的移除（仅要求不消费兼容字段） |

> [!NOTE]
> `views`（`impressions ?? plays ?? 0`）仅向后兼容，业务逻辑须消费 `impressions` / `plays` 并处理 `null`（TD-005）。

**关联 Context 资产**:

| Scope | 关联资产 | 关联说明 |
|-------|---------|----------|
| criterion | `.context/criterion.md` | §4 指标真实性（汇总口径 / 零值语义 / 环比基准） |
| architecture | `.context/architecture/api_strategy.md` | §3.1 `workbench.overview` 响应要点与「部分缺失汇总规则」 |
| architecture | `.context/architecture/risks_and_debt.md` | TD-007、TD-005、RISK-006、RISK-007 |
| architecture | `.context/architecture/data_architecture.md` | `PlatformMetrics` 注与窗口字段 |
| domain | `.context/domain/business_rules.md` | BR-050、BR-051、BR-052、BR-053 |

**关键任务**:
1. 补 `src/types.ts` 汇总字段与窗口字段契约（0.5 人日）
2. 在 `src/analytics/` 实现汇总判定与可空语义（0.75 人日）
3. 接入环比（消费提案 1 快照）与本周排期进度（0.5 人日）
4. 补两条关键测试：部分缺失 → `null`、真实 `0` 参与求和（0.25 人日）

**验证标准**:

| 验收项 | 验收条件 | 验收方式 |
|--------|----------|----------|
| 部分缺失 | 应采平台未全部成功时汇总值为 `null`，并填充 `measuredPlatforms` / `unmeasuredPlatforms` | 单元测试 |
| 零值语义 | 真实返回 `0` 作为有效值参与求和 | 单元测试 |
| 互动汇总 | `totalEngagements` 在四类互动任一为 `null` 时为 `null` | 单元测试 |
| 审查通过 | `pnpm typecheck` 与 `pnpm test` 通过 | `pnpm typecheck` / `pnpm test` |

**依赖**:
- 前置: `feat-metrics-history-persistence`
- 被依赖: `feat-client-cockpit-matrix`
- 约束: 不得用不完整数据冒充全网总量；不得按 0 伪造缺失值。

---

### 提案 4: 生成路径移除未授权 Injoys 文档写入

**Change ID:** `fix-studio-generation-write-boundary`  
**优先级:** P0  
**预计时间:** 1.5 人日  
**状态:** proposed

**业务目标（Business Goal）**:
- 从生成 / 复盘路径移除**无条件**的 `document.create` 调用，使「生成只保存本地」在运行时成立。
- 保证写入 Injoys 只能经提案 2 的显式入口触发。
- 同步修正 `src/tools/index.ts` 中与契约相悖的工具描述文案。

**范围边界（In / Out）**:

| 类型 | 内容 |
|------|------|
| ✅ In | 移除 `workbench.generateArticleDraft`、`ops_draft_article` / `ops_draft_video_meta`、`analytics/review-reporter.ts` 生成 / 复盘阶段的无条件远端写入 |
| ✅ In | 修正工具描述文案；补测试「未显式触发时不写远端」 |
| ✅ In | 保留知识库**读取**（不受内容写入边界约束） |
| ❌ Out | 复盘编号虚报（见提案 5） |
| ❌ Out | 显式沉淀入口本身（提案 2） |

> [!NOTE]
> 本提案依赖提案 2 先落地 `workbench.sinkToInjoysDoc`，否则会移除用户在界面上唯一的沉淀途径。

**关联 Context 资产**:

| Scope | 关联资产 | 关联说明 |
|-------|---------|----------|
| criterion | `.context/criterion.md` | §4 内容写入边界、§3.2 不虚报成功 |
| architecture | `.context/architecture/api_strategy.md` | §3.1 生成接口「MVP 写入边界」 |
| architecture | `.context/architecture/risks_and_debt.md` | TD-008 |
| domain | `.context/domain/business_rules.md` | BR-030、BR-NFR-002 |
| domain | `.context/domain/user_journeys.md` | Journey 3（生成后自动本地存盘） |

**关键任务**:
1. 定位并移除生成 / 复盘路径中无条件的 `saveArticleDocument` / `saveVideoDocument` / `saveReviewDocument` 调用（0.5 人日）
2. 修正 `src/tools/index.ts` 与契约相悖的工具描述文案（0.25 人日）
3. 补测试：未显式触发沉淀时不发生远端写入，且草稿仍正确落盘（0.5 人日）
4. 回归验证生成链路本地落盘行为不变（0.25 人日）

**验证标准**:

| 验收项 | 验收条件 | 验收方式 |
|--------|----------|----------|
| 无未授权写入 | 生成 / 复盘阶段不调用任何远端文档写入 | 代码审查 + 单元测试 |
| 本地仍可用 | 生成后草稿仍按原语义落盘并返回 `id` / `draftSaved` | 单元测试 |
| 文案一致 | 工具描述不再暗示生成即写 Injoys | 代码审查 |
| 审查通过 | `pnpm typecheck` 与 `pnpm test` 通过 | `pnpm typecheck` / `pnpm test` |

**依赖**:
- 前置: `feat-workbench-sink-to-injoys-doc`
- 被依赖: `feat-client-studio-preview`
- 约束: 不得移除知识库读取能力；不得谎报保存成功。

---

### 提案 5: 复盘工具如实返回沉淀状态（不虚报编号）

**Change ID:** `fix-review-honest-doc-id`  
**优先级:** P0  
**预计时间:** 1 人日  
**状态:** proposed

**业务目标（Business Goal）**:
- 修正 `ops_generate_review` 以字面量 `doc_review` 冒充 Injoys 文档编号的行为，消除「虚报成功」（criterion §3.2）。
- 将 `injoysDocId` 改为可空并取消 `output.schema` 的 `required`，失败时如实返回未沉淀状态或抛错。
- 使 domain/testing_strategy 模块 8 场景 3「知识库未连通时不得显示沉淀成功」在实现侧可通过。

**范围边界（In / Out）**:

| 类型 | 内容 |
|------|------|
| ✅ In | `src/tools/index.ts` 的 `ops_generate_review` 输出契约与文案修正；失败 / 未配置时如实返回 |
| ✅ In | 补测试「知识库未连通时不得返回成功文档编号」 |
| ❌ Out | 复盘报告内容与指标口径（见 `feat-weekly-review-report`） |
| ❌ Out | 沉淀入口本身（提案 2） |

**关联 Context 资产**:

| Scope | 关联资产 | 关联说明 |
|-------|---------|----------|
| criterion | `.context/criterion.md` | §3.2 不虚报成功 |
| architecture | `.context/architecture/risks_and_debt.md` | TD-009 |
| domain | `.context/domain/testing_strategy.md` | 模块 8 场景 3 验收口径 |
| domain | `.context/domain/business_rules.md` | BR-055 |

**关键任务**:
1. 将 `injoysDocId` 改为可空并取消 `required`（0.25 人日）
2. 失败 / 未配置时如实返回未沉淀状态或抛错，移除 `?? 'doc_review'` 回退（0.25 人日）
3. 修正用户可见文案，不再播报不存在的编号（0.25 人日）
4. 补测试覆盖知识库未连通场景（0.25 人日）

**验证标准**:

| 验收项 | 验收条件 | 验收方式 |
|--------|----------|----------|
| 无假编号 | 未沉淀时 `injoysDocId` 为空 / 缺失，不出现 `doc_review` | 单元测试 |
| 如实报错 | 写入失败时返回真实错误，不返回成功形状 | 单元测试 |
| 审查通过 | `pnpm typecheck` 与 `pnpm test` 通过 | `pnpm typecheck` / `pnpm test` |

**依赖**:
- 前置: —
- 被依赖: —
- 约束: 不得为「消除文档落差」而谎报成功。

---

### 提案 6: BrowserOS 动作白名单契约与实现对齐

**Change ID:** `fix-browseros-action-whitelist`  
**优先级:** P0  
**预计时间:** 2 人日  
**状态:** proposed

**业务目标（Business Goal）**:
- 按 criterion §6 / §7.1 SSoT-first **同轮定稿**：确认允许动作集合并对齐实现，消除「文档层封闭白名单、实现层开放集合」的安全边界缺口（TD-012）。
- 在宿主侧补动作白名单校验，使最小权限边界由实现强制，而非仅靠文档声明。
- 同步 `EXPECTED_TOOLS`、调用点与约 8 处复述文案，避免文档-实现继续分叉。

**范围边界（In / Out）**:

| 类型 | 内容 |
|------|------|
| ✅ In | 定稿 criterion §4 权威口径（`read` / `grep` / `wait` / `upload` 是否纳入允许集，或收紧为四动作） |
| ✅ In | 对齐 `src/browser/browseros-bridge.ts` 的 `EXPECTED_TOOLS` 与 `browser-driver.ts` / `browseros-ops.ts` 调用点；补宿主侧白名单校验 |
| ✅ In | 同步 `security_policy.md` / `constraints.md` / `context_view.md` / `system_design.md` / `container_component_view.md` / `risks_and_debt.md` 等复述文案 |
| ❌ Out | shell / cmd 能力（明确禁用，不得纳入） |
| ❌ Out | 浏览器登录端点 PoC（Phase 5，`feat-browser-login-poc`） |

> [!NOTE]
> ⛔ 不得只改资产文案（会造成文档-实现继续分叉）；`.context/*/source/` 与 `design/context-dev/` 不可手工修改，criterion 的口径变更须走 context-update。已有同名变更脚手架 `openspec/changes/fix-browseros-action-whitelist`，实施时复用。

**关联 Context 资产**:

| Scope | 关联资产 | 关联说明 |
|-------|---------|----------|
| criterion | `.context/criterion.md` | §4 最小权限、§6 / §7.1 SSoT-first |
| architecture | `.context/architecture/security_policy.md` | BrowserOS 白名单完整契约 |
| architecture | `.context/architecture/risks_and_debt.md` | TD-012、RISK-002 |
| architecture | `.context/architecture/constraints.md` | 最小权限约束表述 |
| architecture | `.context/architecture/container_component_view.md` | 组件表与容器图两处白名单复述 |

**关键任务**:
1. 定稿白名单权威口径并走 context-update 同步 criterion 与复述文案（0.5 人日）
2. 对齐 `EXPECTED_TOOLS` 与全部调用点（0.5 人日）
3. 实现宿主侧动作白名单校验（0.5 人日）
4. 补测试：越界动作被拒绝、允许动作通过（0.5 人日）

**验证标准**:

| 验收项 | 验收条件 | 验收方式 |
|--------|----------|----------|
| 契约一致 | `EXPECTED_TOOLS` 与 criterion §4 权威口径一致 | 代码审查 |
| 校验生效 | 越界动作在宿主侧被拒绝并如实报错 | 单元测试 |
| 文案一致 | 各处复述文案与定稿口径一致 | 文档检查 |
| 审查通过 | `pnpm typecheck` 与 `pnpm test` 通过 | `pnpm typecheck` / `pnpm test` |

**依赖**:
- 前置: —
- 被依赖: —
- 约束: 禁用 shell / cmd；不得只改文案不改实现。

---

### 提案 7: 配置与草稿文件权限收敛到当前 OS 用户

**Change ID:** `fix-storage-file-permissions`  
**优先级:** P1  
**预计时间:** 1.5 人日  
**状态:** proposed

**业务目标（Business Goal）**:
- 让 criterion §3.5「系统文件权限仅限当前操作系统用户」具备实现落点，避免多用户主机上草稿与配置（含 Injoys 令牌）对同机其他用户可读（TD-013）。
- 在统一落盘封装内集中设定权限，而非散落各写入点。

**范围边界（In / Out）**:

| 类型 | 内容 |
|------|------|
| ✅ In | 草稿 / 配置文件写入显式 `mode: 0o600`、目录 `0o700`（统一落盘封装集中设定） |
| ✅ In | 补权限位断言测试 |
| ❌ Out | 存储加密（源文档未提供，N/A） |
| ❌ Out | 既有文件权限的批量迁移（仅保证新写入与创建） |

**关联 Context 资产**:

| Scope | 关联资产 | 关联说明 |
|-------|---------|----------|
| criterion | `.context/criterion.md` | §3.5 文件权限仅限当前 OS 用户 |
| architecture | `.context/architecture/risks_and_debt.md` | TD-013、RISK-011 |
| architecture | `.context/architecture/security_policy.md` | 令牌与配置的存储安全边界 |

**关键任务**:
1. 在统一落盘封装内集中设定文件 `0o600` / 目录 `0o700`（0.5 人日）
2. 覆盖 `draft-store` / `config-store` 的全部写入点（0.5 人日）
3. 补权限位断言测试（0.5 人日）

**验证标准**:

| 验收项 | 验收条件 | 验收方式 |
|--------|----------|----------|
| 文件权限 | 新建配置文件 / 草稿文件为 `0o600` | 单元测试（断言权限位） |
| 目录权限 | 新建目录为 `0o700` | 单元测试 |
| 审查通过 | `pnpm typecheck` 与 `pnpm test` 通过 | `pnpm typecheck` / `pnpm test` |

**依赖**:
- 前置: —
- 被依赖: —
- 约束: 不得绕过 `config-store` / `draft-store` 直接写文件。

---

## 执行顺序与依赖

- 关键路径：`feat-metrics-history-persistence` → `fix-analytics-overview-aggregation`；`feat-workbench-sink-to-injoys-doc` → `fix-studio-generation-write-boundary`。
- 可并行：`fix-review-honest-doc-id`、`fix-browseros-action-whitelist`、`fix-storage-file-permissions` 与上述两条关键路径互不阻塞。
- 建议顺序：先落地两个「能力前置」提案（指标历史、显式沉淀），再处理依赖它们的两个修复，最后并行处理其余三个独立修复。

- 跨阶段前置条件：无（本阶段为基座，不依赖其他阶段）。
- 提供给后续阶段的能力：可信指标历史与汇总语义（供 Phase 2 驾驶舱、Phase 4 复盘消费）、唯一显式沉淀入口与写入边界（供 Phase 2 创作室消费）、对齐后的最小权限边界与文件权限。

## 阶段整体验收

- 全量 `pnpm typecheck` 与 `pnpm test` 通过。
- 铁律四查：① 无自动发布能力、`ops_publish_now` 仍不存在；② `published` 仅经 `drafts.updatePublishUrl` + URL 解析器校验写入；③ 部分缺失汇总为 `null`、真实 `0` 参与求和；④ 无未授权 Injoys 写入、无虚报沉淀成功。
- 文档-实现一致性：BrowserOS 白名单口径与复述文案一致；`workbench.overview` 字段与 api_strategy §3.1 契约一致。
