# Phase 0: 安全与数据真实性修复

> **返回总纲**: [proposal-roadmap.md](./proposal-roadmap.md)
> **文件名**: `proposal-roadmap-Phase-0.md`（编号与总纲阶段总览一致：Phase 0 → `Phase-0`）
> **状态**: proposed
> **来源**: `.context/criterion.md` §3.2 / §3.5 / §4；`.context/architecture/risks_and_debt.md`（RISK-002 / RISK-006 / RISK-007 / TD-007 / TD-008 / TD-009 / TD-012 / TD-013）；`.context/architecture/api_strategy.md` §3.1 / §3.7；`.context/architecture/data_architecture.md`；`.context/domain/testing_strategy.md` 模块 3 / 5 / 8；`.context/domain/risks_and_debt.md`
> **预计工作量与周期**: ~10 人日（**规划估算**；源文档对 TD-007 ~ TD-014 的工作量字段一律标注 `N/A – 源文档未提供`）

## 阶段目标与范围

- **目标与交付结果**：让**既有**已实现接口先「不说假话、不越界」——修掉触碰 `criterion.md` 铁律、数据真实性与安全边界的实现缺口，使 Phase 0 端到端闭环（排期 → AI 生成 → 本地草稿 → 真实预填 → 人工确认回填 → 真实指标采集）具备可信的数据基座，为 Phase 1 起的宿主契约建设与 Phase 3 的客户端 UI 提供不违反铁律的接口。
- **In / Out**：
  - ✅ In：`workbench.overview` 的汇总空值语义与真实数据来源（TD-007 及 `src/ops-rpc.ts` 中硬编码的热点样例数据）；`metrics/` 历史快照落盘（TD-010 的 metrics 部分，作为环比基准）；生成 / 复盘路径的未授权 Injoys 文档写入（TD-008）；`ops_generate_review` 的假文档编号（TD-009）；BrowserOS 动作白名单契约与实现对齐（TD-012）；落盘文件与目录权限位（TD-013）。
  - ❌ Out：排期 `calendar/` 主数据与生成 / 导出 / 导入（属 Phase 1）；`workbench.sinkToInjoysDoc` 唯一授权沉淀入口的**实现**（属 Phase 2，本 Phase 只负责移除未授权写入）；任何客户端 UI（属 Phase 3）；统一「未找到」错误码与客户端消费测试（属 Phase 4）；双向同步与冲突解决（PRD Phase 3，**不在本路线图范围**，见 `constraints.md`「未到阶段的能力不提前实现」）。
- **适用约束**：
  - `criterion.md` §3.2「禁止虚报成功 / 禁止伪造、硬编码指标数据（无法获取的字段必须为 `null`）」；
  - `criterion.md` §4「内容写入边界」（生成只保存本地；写入 Injoys 必须由用户显式触发）、「最小权限」（BrowserOS 仅白名单动作）、「文件权限仅限当前操作系统用户」；
  - `criterion.md` §6 **SSoT-first**：类型契约 → 宿主 RPC 契约 → 领域实现 → 客户端 UI 与测试；
  - `architecture/risks_and_debt.md` RISK-006 / RISK-007（指标汇总与环比的 `null` 语义是不可协商口径）。

## 提案详情

### 提案 1: 工作台总览的汇总空值语义与真实数据来源

**Change ID:** `fix-overview-metrics-null-semantics`  
**优先级:** P0  
**预计时间:** 2 人日（规划估算）  
**状态:** proposed

**业务目标（Business Goal）**:
- 消除「以部分平台数据冒充全网总量」的虚假结论，使驾驶舱指标满足 `criterion.md` §3.2 的数据真实性要求。
- 让环比（`comparison`）与本周排期进度（`weeklyPipeline`）具备可用且语义明确的字段，为 Phase 3 的驾驶舱 UI 提供契约。
- 移除 `workbench.overview` 中硬编码的热点样例数据，杜绝编造指标。

**范围边界（In / Out）**:

| 类型 | 内容 |
|------|------|
| ✅ In | 在 `src/types.ts` 补齐 `overviewMetrics` 的 `measuredPlatforms` / `unmeasuredPlatforms` / `totalEngagements` / `totalFavorites` / `comparison` / `weeklyPipeline` 及窗口字段契约 |
| ✅ In | 在 `src/analytics/` 或 `workbench.overview` 实现「部分缺失 → 汇总为 `null`」与「真实 0 参与求和」的判定 |
| ✅ In | 移除 `src/ops-rpc.ts` 中 `workbench.overview` 硬编码的 `keyword: 'Agentic AI'` / `heatScore: 95` 等样例热点数据，改为来自真实来源或如实返回空 |
| ✅ In | 补测试覆盖「部分缺失 → `null`」与「真实 0 参与求和」两条用例 |
| ❌ Out | 指标历史快照的落盘实现（`feat-storage-metrics-snapshot`） |
| ❌ Out | 驾驶舱 UI 呈现（`feat-client-dashboard`，Phase 3） |
| ❌ Out | 采集侧的 Adapter 能力扩展（平台采集失败本身的修复不在本提案） |

> [!NOTE]
> 本提案与 `feat-storage-metrics-snapshot` 共用 `workbench.overview` 的方法出口，但契约与判定的修复（本提案）必须先完成，环比基准的落盘才有正确的消费方，故二者以 **A1 → A2** 顺序依赖，不合并为单提案。

**关联 Context 资产**:

| Scope | 关联资产 | 关联说明 |
|-------|---------|----------|
| criterion | `.context/criterion.md` | §3.2 数据真实性、§4 指标口径、§6 SSoT-first |
| architecture | `.context/architecture/risks_and_debt.md` | TD-007（高）、RISK-006、RISK-007 |
| architecture | `.context/architecture/api_strategy.md` | §3.1 `workbench.overview` 契约与「部分缺失汇总规则」权威口径 |
| architecture | `.context/architecture/data_architecture.md` | `PlatformMetrics` 注与窗口字段 |
| domain | `.context/domain/testing_strategy.md` | 模块 5 场景 4 / 5 / 6（BR-050 / BR-051 / BR-052） |

**关键任务**:
1. 按 SSoT-first 补 `src/types.ts` 的 `overviewMetrics` 字段契约（含 `windowStart` / `windowEnd`）（0.5 人日）
2. 在 `src/ops-rpc.ts` 的 `workbench.overview` 补齐字段与方法契约（0.5 人日）
3. 实现「`measuredPlatforms == P` 才给数字，否则 `null`」与「真实 0 参与求和」判定，`totalEngagements` 任一子项为 `null` 则整体 `null`（0.5 人日）
4. 移除 `src/ops-rpc.ts` 硬编码热点样例数据（`keyword` / `heatScore`），替换为真实来源或空值（0.25 人日）
5. 补 `tests/` 用例：「部分缺失 → `null`」与「真实 0 参与求和」（0.25 人日）

**风险与处理决定（按需）**:

| 风险 | 影响 | 处理决定及理由 |
|------|------|----------|
| 首次使用时全部环比 delta 为 `null` 被误报为缺陷 | 误判修复失败 | 依 RISK-007 应急预案：`null` 属**预期行为**，UI 显示「暂无环比」而非 0%；测试以此为准 |
| 移除硬编码热点后 `trends` 变空影响既有客户端 | 驾驶舱热点区展示为空 | 空值优于假数据（`criterion.md` §3.2）；真实热点来源属外部依赖，未提供时如实返回空 |

**验证标准**:

| 验收项 | 验收条件 | 验收方式 |
|--------|----------|----------|
| 部分缺失汇总为空 | 应采 2 平台仅 1 个成功采集时，汇总值为 `null` 且填充 `measuredPlatforms` / `unmeasuredPlatforms` | 单元测试 + `pnpm test` |
| 真实零值参与求和 | 平台真实返回 `0` 时作为有效值计入求和，与 `null` 严格区分 | 单元测试 |
| 互动总量口径 | `totalEngagements` 在点赞/评论/转发/收藏任一为 `null` 时为 `null` | 单元测试 |
| 无伪造数据 | `workbench.overview` 响应不含硬编码样例热点数据 | 代码审查 + `grep` 校验 |

**验收场景（按需，建议 BDD）**:

```gherkin
场景: 部分渠道采集失败时汇总值为空（BR-050）
  Given "全网曝光/播放总量"应采集 2 个渠道
    And 仅 1 个渠道采集成功
  When 用户查看该汇总指标卡
  Then 汇总值应显示"暂无数据"
    And 不得只汇总已成功的渠道并冒充"全网总量"

场景: 平台真实零值与采集失败严格区分（BR-050 / BR-051）
  Given 某平台真实返回该指标为 0
    And 另一平台该指标采集失败
  When 用户查看指标卡
  Then 平台真实返回的 0 应正常显示为 0
    And 采集失败的平台应显示"暂无数据"
```

**依赖**:
- 前置: 无
- 被依赖: `feat-storage-metrics-snapshot`、`feat-client-dashboard`
- 约束: 必须先改契约（`src/types.ts` → `src/ops-rpc.ts`）再改领域实现（criterion §6）

---

### 提案 2: 指标历史快照落盘（环比基准）

**Change ID:** `feat-storage-metrics-snapshot`  
**优先级:** P1  
**预计时间:** 2 人日（规划估算）  
**状态:** proposed

**业务目标（Business Goal）**:
- 落地 `$DSH_HOME/growth-studio/metrics/{YYYY-MM-DD}.json` 指标历史快照，使环比有真实基准，而非恒为 `null` 的占位语义。
- 满足 `criterion.md` §4「历史不足以覆盖完整对比窗口时 delta 必须为 null」——该规则需目录真实存在才有意义。

**范围边界（In / Out）**:

| 类型 | 内容 |
|------|------|
| ✅ In | 实现 `metrics/` 目录读写服务，按 `(platform, capturedAt)` 追加写入 |
| ✅ In | 采集成功后落盘快照，供 `workbench.overview` 的 `comparison` 消费 |
| ✅ In | 历史快照不足以覆盖完整窗口时，对应 delta 为 `null` |
| ❌ Out | `calendar/` 排期主数据落盘（`feat-storage-calendar-items`，Phase 1） |
| ❌ Out | 指标采集适配器本身的修复 |
| ❌ Out | 快照的历史查看 / 恢复界面（MVP 不提供草稿历史，见 `adr_008`） |

**关联 Context 资产**:

| Scope | 关联资产 | 关联说明 |
|-------|---------|----------|
| criterion | `.context/criterion.md` | §4 环比基准与 `metrics/` 权威口径、§3.5 落盘约束 |
| architecture | `.context/architecture/risks_and_debt.md` | TD-010（metrics 部分）、RISK-007 |
| architecture | `.context/architecture/data_architecture.md` | `metrics/{YYYY-MM-DD}.json` 布局 |
| architecture | `.context/architecture/api_strategy.md` | §3.1「环比基准来源」 |

**关键任务**:
1. 补 `src/storage/` 下 metrics 快照读写服务（目录创建、按日文件追加）（0.75 人日）
2. 在采集成功路径接入快照写入（0.5 人日）
3. 在 `workbench.overview` 的 `comparison` 中实现「上一个等长窗口」基准读取与不足时 `null`（0.5 人日）
4. 补测试：历史不足 → `null`；历史充足 → delta 计算正确（0.25 人日）

**验证标准**:

| 验收项 | 验收条件 | 验收方式 |
|--------|----------|----------|
| 快照落盘 | 采集成功后 `metrics/{YYYY-MM-DD}.json` 按 `(platform, capturedAt)` 追加 | 单元测试 / 文件断言 |
| 历史不足为 null | 不足以覆盖完整对比窗口时 delta 为 `null`，不编造近似值 | 单元测试 |
| 目录固定语义 | 单次操作内目录固定，配置切换只对新操作生效 | 单元测试（参照 `criterion.md` §3.5） |

**验收场景（按需，建议 BDD）**:

```gherkin
场景: 历史不足时环比为空（BR-052）
  Given 本地历史指标快照不足以覆盖完整对比窗口
  When 用户查看指标卡的环比走势
  Then 环比应显示为空
    And 不得编造环比结论
```

**依赖**:
- 前置: `fix-overview-metrics-null-semantics`
- 被依赖: `feat-client-dashboard`
- 约束: 快照写入须经统一落盘封装，复用 `drafts/storage-unavailable` 类错误映射口径

---

### 提案 3: 移除生成 / 复盘路径未授权的 Injoys 文档写入

**Change ID:** `fix-unauthorized-injoys-doc-write`  
**优先级:** P0  
**预计时间:** 2 人日（规划估算）  
**状态:** proposed

**业务目标（Business Goal）**:
- 使生成（图文 / 视频元数据）与复盘路径**只写本地**，符合 `criterion.md` §4 内容写入边界：写入 Injoys 必须由用户显式触发。
- 消除「用户未授权即把物料写入其 Injoys 空间」的越界行为。

**范围边界（In / Out）**:

| 类型 | 内容 |
|------|------|
| ✅ In | 从 `src/ops-rpc.ts` 的 `workbench.generateArticleDraft`、`src/tools/index.ts` 的 `ops_draft_article` / `ops_draft_video_meta`、`src/analytics/review-reporter.ts` 移除**无条件**的 `document.create` 调用 |
| ✅ In | 修正 `src/tools/index.ts` 中与契约相悖的工具描述文案 |
| ✅ In | 补测试覆盖「未显式触发时不写远端」 |
| ✅ In | 保留 `InjoysClient.saveArticleDocument` / `saveVideoDocument` / `saveReviewDocument` 能力（供 Phase 2 的显式沉淀入口复用） |
| ❌ Out | `workbench.sinkToInjoysDoc` 唯一授权入口的**实现**（`feat-workbench-sink-to-injoys-doc`，Phase 2） |
| ❌ Out | 知识库读取能力（生成时读取知识库属允许行为，不动） |

> [!NOTE]
> 本提案只做「减法」（移除未授权写入），不实现替代入口。这样 Phase 0 与 Phase 2 之间不会出现「旧入口已删、新入口未上」的能力空洞：Phase 0 期间用户仍可经 Injoys 侧手工操作，Phase 2 再补显式沉淀入口。

**关联 Context 资产**:

| Scope | 关联资产 | 关联说明 |
|-------|---------|----------|
| criterion | `.context/criterion.md` | §4 内容写入边界、§3.5 目录固定（贯穿每次落盘） |
| architecture | `.context/architecture/risks_and_debt.md` | TD-008（高） |
| architecture | `.context/architecture/api_strategy.md` | §3.1 `generateArticleDraft` / `generateVideoMeta` 的「只保存本地」契约 |
| domain | `.context/domain/testing_strategy.md` | 模块 3 场景 1、模块 8 场景 2 / 3 |

**关键任务**:
1. 定位并移除生成路径的无条件 `document.create` 调用（`workbench.generateArticleDraft`、`ops_draft_article`、`ops_draft_video_meta`）（1 人日）
2. 移除 `review-reporter.ts` 复盘路径的无条件 `saveReviewDocument` 调用（0.5 人日）
3. 修正 `src/tools/index.ts` 工具描述文案使之与契约一致（0.25 人日）
4. 补测试：「未显式触发时无远端写入」（0.25 人日）

**风险与处理决定（按需）**:

| 风险 | 影响 | 处理决定及理由 |
|------|------|----------|
| 历史用户依赖「生成即沉淀」的隐性行为 | 行为变化 | 依 MVP 裁决（2026-10-16）：生成只保存本地，沉淀须用户明确触发；此为**目标契约**，非回归 |
| 移除调用后 `injoysDocId` 字段仍被前端读取 | 字段为空 | 契约已将其保留为可选兼容形状（`api_strategy.md` §3.1），不因生成而填充 |

**验证标准**:

| 验收项 | 验收条件 | 验收方式 |
|--------|----------|----------|
| 生成不写远端 | 调用生成方法后无 `document.create` 请求发出 | 单元测试（mock InjoysClient）+ 代码审查 |
| 复盘不写远端 | 复盘路径无无条件 `saveReviewDocument` 调用 | 单元测试 + `grep` |
| 文案一致 | 工具描述不再暗示「生成即沉淀」 | 代码审查 |

**验收场景（按需，建议 BDD）**:

```gherkin
场景: 物料生成与本地存盘
  Given 用户位于内容创作室
  When 用户触发 AI 生成物料
  Then 物料应自动保存至本地草稿库
    And 未经用户明确要求不得创建或更新 Injoys 文档

场景: 知识库未连通时沉淀不可用（BR-073）
  Given 知识库中枢未连通
  When 用户点击"沉淀至 Injoys 知识文档"
  Then 界面应明确提示该能力不可用
    And 不得显示"沉淀成功"
```

**依赖**:
- 前置: 无
- 被依赖: `fix-review-doc-id-fabrication`、`feat-workbench-sink-to-injoys-doc`
- 约束: 生成只保存本地；请求开始时捕获草稿目录并贯穿每次落盘（`criterion.md` §3.5）

---

### 提案 4: 复盘工具不得以字面量冒充文档编号

**Change ID:** `fix-review-doc-id-fabrication`  
**优先级:** P0  
**预计时间:** 1 人日（规划估算）  
**状态:** proposed

**业务目标（Business Goal）**:
- 消除「知识库未连通或写入失败时仍向用户播报不存在的文档编号」的虚报成功，满足 `criterion.md` §3.2。
- 让调用方能区分「已沉淀」与「未沉淀」。

**范围边界（In / Out）**:

| 类型 | 内容 |
|------|------|
| ✅ In | 将 `ops_generate_review` 的 `injoysDocId` 改为可空并取消 `output.schema` 的 `required` |
| ✅ In | 失败 / 未配置时如实返回未沉淀状态或抛错，移除 `report.injoysDocId ?? 'doc_review'` 回退 |
| ✅ In | 补测试覆盖「知识库未连通时不得返回成功文档编号」 |
| ❌ Out | 生成路径的未授权写入移除（`fix-unauthorized-injoys-doc-write`） |
| ❌ Out | `InjoysClient.saveReviewDocument` 的 `catch → null` 行为本身（如属实现缺陷，另行提案） |

**关联 Context 资产**:

| Scope | 关联资产 | 关联说明 |
|-------|---------|----------|
| criterion | `.context/criterion.md` | §3.2 虚报成功 |
| architecture | `.context/architecture/risks_and_debt.md` | TD-009（高）、架构 §3.5.1「不得谎报成功，也不得静默写本地假 ID」 |
| domain | `.context/domain/testing_strategy.md` | 模块 8 场景 3 |

**关键任务**:
1. 将 `ops_generate_review` 的 `injoysDocId` 改为可空并取消 `required`（0.5 人日）
2. 移除 `doc_review` 字面量回退，失败时如实返回未沉淀状态（0.25 人日）
3. 补测试：「未连通时不返回成功文档编号」（0.25 人日）

**验证标准**:

| 验收项 | 验收条件 | 验收方式 |
|--------|----------|----------|
| 无假编号 | 知识库未连通 / 写入失败时响应不含字面量文档编号 | 单元测试 |
| schema 一致 | `output.schema` 不再将 `injoysDocId` 声明为 required | 代码审查 |
| 可区分状态 | 调用方可据响应判断是否已沉淀 | 单元测试 |

**验收场景（按需，建议 BDD）**:

```gherkin
场景: 知识库未连通时沉淀不可用（BR-073）
  Given 知识库中枢未连通
  When 用户触发周度复盘
  Then 不得显示"沉淀成功"
    And 不得返回不存在的文档编号
```

**依赖**:
- 前置: `fix-unauthorized-injoys-doc-write`
- 被依赖: 无
- 约束: 与前置提案同属 Injoys 写入链路的「减法」先后顺序；失败必须如实返回，不得以成功形状包装失败（criterion §3.2）

---

### 提案 5: BrowserOS 动作白名单契约与实现对齐

**Change ID:** `fix-browseros-action-whitelist`  
**优先级:** P0  
**预计时间:** 2 人日（规划估算）  
**状态:** proposed

**业务目标（Business Goal）**:
- 使「仅允许 `tabs / navigate / snapshot / act`、禁用 shell/cmd」的最小权限边界在**实现层**真实生效，而非仅存在于文档。
- 消除「文档层封闭白名单、实现层开放集合」的安全边界缺口，使安全审查可定位越界动作。

**范围边界（In / Out）**:

| 类型 | 内容 |
|------|------|
| ✅ In | 同轮定稿 `criterion.md` §4 权威口径（确认 `read` / `grep` / `wait` / `upload` 是否纳入允许集，或收紧为仅四动作） |
| ✅ In | 对齐 `src/browser/browseros-bridge.ts` 的 `EXPECTED_TOOLS` 与 `browser-driver.ts` / `browseros-ops.ts` 调用点 |
| ✅ In | 补宿主侧动作白名单校验实现 |
| ✅ In | 同步 `security_policy.md` / `constraints.md` / `context_view.md` / `system_design.md` / `container_component_view.md` / `risks_and_debt.md` 等约 8 处复述文案 |
| ❌ Out | BrowserOS 驱动禁用 shell/cmd 的既有约束（维持不变） |
| ❌ Out | `browser.login.*` 的前台登录能力（PD-001，Phase 2 PoC） |

> [!NOTE]
> 本提案的 Change ID 与既有空脚手架目录 `openspec/changes/fix-browseros-action-whitelist/specs/browseros-security/` 对齐（该目录当前仅有结构、无文件）。⛔ 依 `criterion.md` §6 / §7.1，**不得只改资产文案**，必须同轮改实现，否则文档-实现继续分叉。

**关联 Context 资产**:

| Scope | 关联资产 | 关联说明 |
|-------|---------|----------|
| criterion | `.context/criterion.md` | §4 最小权限（权威口径，本提案须同轮定稿）、§7.1 |
| architecture | `.context/architecture/risks_and_debt.md` | TD-012（高）、RISK-002 |
| architecture | `.context/architecture/security_policy.md` | 白名单断言与安全语义 |
| architecture | `.context/architecture/container_component_view.md` | 组件表与容器图两处白名单复述 |
| architecture | `.context/architecture/constraints.md` | 动作白名单约束复述 |

**关键任务**:
1. 确认并冻结权威白名单口径（四动作 vs 纳入 `read`/`grep`/`wait`/`upload`）（0.5 人日）
2. 对齐 `EXPECTED_TOOLS` 与各调用点（`browser-driver.ts` 的 `upload`、`browseros-ops.ts` 的 `read`/`wait`）（0.75 人日）
3. 实现宿主侧动作白名单校验（越界动作拒绝）（0.5 人日）
4. 同步约 8 处资产复述文案（0.25 人日）

**验证标准**:

| 验收项 | 验收条件 | 验收方式 |
|--------|----------|----------|
| 白名单有实现 | `src/` 内存在动作白名单校验且越界动作被拒 | 单元测试 + `grep` |
| 实现与文档一致 | `EXPECTED_TOOLS` 与 criterion §4 权威口径一致 | 代码审查 + 逐处比对 |
| 无 shell/cmd | 驱动不暴露 shell / cmd 动作 | 代码审查 |

**依赖**:
- 前置: 无
- 被依赖: 无
- 约束: 属 SSoT 契约变更，须 `criterion.md` §7.1 与实现**同轮**落地（criterion §6）

---

### 提案 6: 落盘文件与目录权限位实现

**Change ID:** `fix-storage-file-permissions`  
**优先级:** P1  
**预计时间:** 1 人日（规划估算）  
**状态:** proposed

**业务目标（Business Goal）**:
- 使 `criterion.md` §3.5「系统文件权限仅限当前操作系统用户」在实现层成立，避免多用户主机上草稿与配置（含 Injoys 令牌）被同机其他用户读取。

**范围边界（In / Out）**:

| 类型 | 内容 |
|------|------|
| ✅ In | 草稿 / 配置文件写入显式 `mode: 0o600`、目录 `0o700`（或在统一落盘封装内集中设定） |
| ✅ In | 补权限位断言测试 |
| ❌ Out | 存储加密（源文档未提供，N/A） |
| ❌ Out | `metrics/` / `calendar/` 的业务实现（分别属本 Phase 提案 2 与 Phase 1） |

**关联 Context 资产**:

| Scope | 关联资产 | 关联说明 |
|-------|---------|----------|
| criterion | `.context/criterion.md` | §3.5 文件权限 MUST |
| architecture | `.context/architecture/risks_and_debt.md` | TD-013（中） |
| architecture | `.context/architecture/api_strategy.md` | §5.3「存储加密 N/A，依赖文件系统权限仅限当前 OS 用户」 |

**关键任务**:
1. 在统一落盘封装内为文件写入设 `mode: 0o600`、目录建立设 `0o700`（0.5 人日）
2. 覆盖 `draft-store.ts` 与 `config-store.ts` 的 `writeFileSync` / `mkdirSync`（0.25 人日）
3. 补权限位断言测试（0.25 人日）

**验证标准**:

| 验收项 | 验收条件 | 验收方式 |
|--------|----------|----------|
| 文件权限 | 新建草稿 / 配置文件权限为 `0o600` | 单元测试断言 `stat().mode` |
| 目录权限 | 存储目录权限为 `0o700` | 单元测试 |
| 无遗漏 | `src/` 内落盘调用均设定模式 | `grep` + 代码审查 |

**依赖**:
- 前置: 无
- 被依赖: 无
- 约束: 后续 `metrics/` / `calendar/` 落盘须复用同一封装（Phase 1 / 本 Phase 提案 2）

---

## 执行顺序与依赖

本 Phase 内可并行的两条主线：

1. **数据真实性线**：`fix-overview-metrics-null-semantics` → `feat-storage-metrics-snapshot`（严格顺序）。
2. **安全边界线**：`fix-unauthorized-injoys-doc-write` → `fix-review-doc-id-fabrication`（严格顺序）；`fix-browseros-action-whitelist`、`fix-storage-file-permissions` 与两条主线**均可并行**。

- 跨阶段前置条件：无（本 Phase 是路线图起点）。
- 提供给后续阶段的能力：正确的汇总 `null` 语义与环比基准（供 Phase 3 驾驶舱）、只写本地的生成路径与 `InjoysClient` 文档写入能力（供 Phase 2 显式沉淀入口）、对齐后的 BrowserOS 白名单与落盘权限（供所有后续落盘）。

## 阶段整体验收

- `criterion.md` §3.2 / §4 相关的 BDD 场景通过：模块 5 场景 4 / 5 / 6、模块 3 场景 1、模块 8 场景 2 / 3。
- `pnpm typecheck` + `pnpm test` 通过；新增用例覆盖「部分缺失 → `null`」「真实 0 参与求和」「未显式触发不写远端」「未连通不返回成功文档编号」「白名单越界被拒」「文件权限位」。
- `workbench.overview` 响应不再包含硬编码样例数据；`src/` 内生成 / 复盘路径无无条件 `document.create` 调用；`src/` 内存在动作白名单校验实现。

## 待决事项（按需）

- BrowserOS 权威白名单是否纳入 `read` / `grep` / `wait` / `upload`（提案 5 任务 1 需与 `criterion.md` §4 同轮定稿）——影响资产约 8 处复述文案的定稿方向。
