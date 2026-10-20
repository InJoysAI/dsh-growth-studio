# Phase 0: 安全与数据真实性修复

> **返回总纲**: [proposal-roadmap.md](./proposal-roadmap.md)
> **文件名**: `proposal-roadmap-Phase-0.md`（编号与总纲阶段总览一致：Phase 0 → `Phase-0`）
> **状态**: proposed
> **来源**: `.context/criterion.md` §3.1 / §3.2 / §4 / §5.4 / §5.5 / §6；`.context/architecture/risks_and_debt.md`（RISK-002 / RISK-003 / RISK-006 / RISK-007；TD-007 / TD-008 / TD-009 / TD-012 / TD-013）；`.context/architecture/adr_009_browseros_capability_management.md`；`.context/architecture/api_strategy.md` §2.3 / §3.1 / §3.4 / §3.6 / §3.7 / §3.9 / §3.10；`.context/architecture/data_architecture.md`；`.context/architecture/security_policy.md`；`.context/domain/business_rules.md`（BR-052 / BR-074）；`.context/domain/risks_and_debt.md`（PD-006）；`.context/domain/testing_strategy.md` 模块 1 / 3 / 5 / 6 / 8
> **预计工作量与周期**: ~16 人日（**规划估算**；源文档对 TD-007 ~ TD-013 的工作量字段一律标注 `N/A – 源文档未提供`）

## 阶段目标与范围

- **目标与交付结果**：让**既有**已实现接口先「不说假话、不越界」——修掉触碰 `criterion.md` 铁律、数据真实性与安全边界的实现缺口，使 Phase 0 端到端闭环（排期 → AI 生成 → 本地草稿 → 真实预填 → 人工确认回填 → 真实指标采集）具备可信的数据基座，为 Phase 1 起的宿主契约建设与 Phase 3 的客户端 UI 提供不违反铁律的接口。
- **In / Out**：
  - ✅ In：`workbench.overview` 的汇总空值语义与真实数据来源（TD-007 及 `src/ops-rpc.ts` 中硬编码的热点样例数据）；`metrics/` 历史快照落盘（TD-010 的 metrics 部分，作为环比基准）；生成 / 复盘 / 海外 Launch 路径的未授权 Injoys 文档写入（TD-008，含第 5 处 `ops_draft_launch_kit`）；`ops_generate_review` 与 `ops_draft_launch_kit` 的假文档编号（TD-009，两处）；BrowserOS **能力开关**契约与统一执行检查（TD-012，按 `adr_009` 取代旧「固定动作白名单」口径）；`browser.sessions` 会话探测的假阳性修复与 `ops_inspect_sessions` 按名登记（RISK-003 / PD-006）；落盘文件与目录权限位（TD-013）；`injoys.test` 补可空文档数（`documentCount: number | null`）。
  - ❌ Out：排期 `calendar/` 主数据与生成 / 导出 / 导入（属 Phase 1）；`workbench.sinkToInjoysDoc` 唯一授权沉淀入口的**实现**（属 Phase 2，本 Phase 只负责移除未授权写入）；任何客户端 UI（属 Phase 3）；统一「未找到」错误码与客户端消费测试（属 Phase 4）；`browser.login.*` 前台登录（PD-001，属 Phase 2 PoC）；`ops_keyword_research` / `ops_generate_hooks`（阶段未定，见 Phase 2 的 `feat-tools-lifecycle-gaps`）；双向同步与冲突解决（PRD Phase 3，**不在本路线图范围**，见 `constraints.md`「未到阶段的能力不提前实现」）。
- **适用约束**：
  - `criterion.md` §3.2「禁止虚报成功 / 禁止伪造、硬编码指标数据（无法获取的字段必须为 `null`）」；
  - `criterion.md` §4「内容写入边界」（生成只保存本地；写入 Injoys 必须由用户显式触发）、「最小权限（能力开关）」（默认八项、其余默认关闭可手动开启、禁止绕过统一执行检查）、「会话隔离」（Cookie 零外发）、「文件权限仅限当前操作系统用户」；
  - `criterion.md` §3.1「会话探测、预填执行、指标采集必须统一由**同一个** BrowserOS MCP 实例调度」；
  - `criterion.md` §6 **SSoT-first**：类型契约 → 宿主 RPC 契约 → 领域实现 → 客户端 UI 与测试；
  - `architecture/risks_and_debt.md` RISK-006 / RISK-007（指标汇总与环比的 `null` 语义是不可协商口径）；RISK-003（会话四态，严禁退化为 boolean）。

## 提案详情

### 提案 1: 工作台总览的汇总空值语义与真实数据来源

**Change ID:** `fix-overview-metrics-null-semantics`  
**优先级:** P0  
**预计时间:** 2 人日（规划估算）  
**状态:** done

**业务目标（Business Goal）**:
- 消除「以部分平台数据冒充全网总量」的虚假结论，使驾驶舱指标满足 `criterion.md` §3.2 的数据真实性要求。
- 让环比（`comparison`）与本周排期进度（`weeklyPipeline`）具备可用且语义明确的字段，为 Phase 3 的驾驶舱 UI 提供契约。
- 移除 `workbench.overview` 中硬编码的热点样例数据，杜绝编造指标。

**范围边界（In / Out）**:

| 类型 | 内容 |
|------|------|
| ✅ In | 在 `src/types.ts` 补齐 `overviewMetrics` 的 `measuredPlatforms` / `unmeasuredPlatforms` / `totalEngagements` / `totalFavorites` / `comparison` / `weeklyPipeline` 及窗口字段契约 |
| ✅ In | 在 `src/analytics/` 或 `workbench.overview` 实现「部分缺失 → 汇总为 `null`」与「真实 0 参与求和」的判定 |
| ✅ In | 业务逻辑（含汇总）只消费可空的 `impressions`（曝光/阅读）与 `plays`（播放），**不得**用兼容字段 `views`（`impressions ?? plays ?? 0`）作为缺失指标的真实值 |
| ✅ In | 移除 `src/ops-rpc.ts` 中 `workbench.overview` 硬编码的 `keyword: 'Agentic AI'` / `heatScore: 95` 等样例热点数据，改为来自真实来源或如实返回空 |
| ✅ In | 补测试覆盖「部分缺失 → `null`」与「真实 0 参与求和」两条用例 |
| ❌ Out | 指标历史快照的落盘实现（`feat-storage-metrics-snapshot`） |
| ❌ Out | `weeklyPipeline` 的真实排期数据接入（Phase 0 无排期存储，本提案只补字段契约；真实数据由 Phase 1 的 `feat-calendar-generate-list` 接入 `workbench.overview`） |
| ❌ Out | 驾驶舱 UI 呈现（`feat-client-dashboard`，Phase 3） |
| ❌ Out | 采集侧的 Adapter 能力扩展（平台采集失败本身的修复不在本提案） |

> [!NOTE]
> 本提案与 `feat-storage-metrics-snapshot` 共用 `workbench.overview` 的方法出口，但契约与判定的修复（本提案）必须先完成，环比基准的落盘才有正确的消费方，故二者以 **A1 → A2** 顺序依赖，不合并为单提案。

**关联 Context 资产**:

| Scope | 关联资产 | 关联说明 |
|-------|---------|----------|
| criterion | `.context/criterion.md` | §3.2 数据真实性、§4 指标口径、§5.5 `PlatformMetrics`（`impressions` / `plays` 独立且可空，`views` 仅兼容）、§6 SSoT-first |
| architecture | `.context/architecture/risks_and_debt.md` | TD-007（高）、TD-005（`views` 兼容字段误用，中）、RISK-006、RISK-007 |
| architecture | `.context/architecture/api_strategy.md` | §3.1 `workbench.overview` 契约与「部分缺失汇总规则」权威口径 |
| architecture | `.context/architecture/data_architecture.md` | `PlatformMetrics` 注与窗口字段 |
| domain | `.context/domain/business_rules.md` | BR-051（曝光/播放区分口径，MUST）、BR-052（互动与关注增长汇总） |
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
| 曝光/播放口径 | `impressions` / `plays` 独立且可空；业务逻辑不把 `views` 当作缺失指标的真实值 | 单元测试 + `grep`（`views` 仅保留兼容形状） |
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
- 被依赖: `feat-storage-metrics-snapshot`、`feat-calendar-generate-list`、`feat-client-dashboard`
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
- 前置: `fix-overview-metrics-null-semantics`、`fix-storage-file-permissions`
- 被依赖: `feat-client-dashboard`
- 约束: 快照写入须经**统一落盘封装**（其 `mode` 权限位由 `fix-storage-file-permissions` 提供），复用 `drafts/storage-unavailable` 类错误映射口径；故本提案须待权限封装落地后再实施

---

### 提案 3: 移除生成 / 复盘 / 海外 Launch 路径未授权的 Injoys 文档写入

**Change ID:** `fix-unauthorized-injoys-doc-write`  
**优先级:** P0  
**预计时间:** 2.5 人日（规划估算）  
**状态:** proposed

**业务目标（Business Goal）**:
- 使生成（图文 / 视频元数据 / 海外 Launch 物料）与复盘路径**只写本地**，符合 `criterion.md` §4 内容写入边界：写入 Injoys 必须由用户显式触发。
- 消除「用户未授权即把物料写入其 Injoys 空间」的越界行为。

**范围边界（In / Out）**:

| 类型 | 内容 |
|------|------|
| ✅ In | 从 `src/ops-rpc.ts` 的 `workbench.generateArticleDraft`、`src/tools/index.ts` 的 `ops_draft_article` / `ops_draft_video_meta` / `ops_draft_launch_kit`、`src/analytics/review-reporter.ts` 移除**无条件**的 `document.create` 调用（共 **5 处**，含 `ops_draft_launch_kit` 的 `saveLaunchKitDocument`） |
| ✅ In | 修正 `src/tools/index.ts` 中与契约相悖的工具描述文案 |
| ✅ In | 同步 `.context/architecture/risks_and_debt.md` 的 **TD-008** 站点清单（补第 5 处 `ops_draft_launch_kit`），使债务登记与实现一致 |
| ✅ In | 补测试覆盖「未显式触发时不写远端」（含海外 Launch 生成路径） |
| ✅ In | 保留 `InjoysClient.saveArticleDocument` / `saveVideoDocument` / `saveReviewDocument` / `saveLaunchKitDocument` 能力（供 Phase 2 的显式沉淀入口复用） |
| ❌ Out | `workbench.sinkToInjoysDoc` 唯一授权入口的**实现**（`feat-workbench-sink-to-injoys-doc`，Phase 2） |
| ❌ Out | 海外四大渠道（YouTube / X / Product Hunt / TikTok）**模拟与预填能力本身**（属 Phase 2，见总纲「被移出的能力」）；本提案只对已存在的 `ops_draft_launch_kit` 做**减法**合规修复 |
| ❌ Out | 知识库读取能力（生成时读取知识库属允许行为，不动） |

> [!NOTE]
> **`ops_draft_launch_kit` 的阶段边界**：该工具所属**能力**（出海 Launch 物料）属 Phase 2，但它在**当前实现中已存在**且**无用户显式触发判定即写入 Injoys**——这是**在线**触碰 `criterion.md` §4 铁律的缺口。依 `docs/implementation-gaps-report.md` §1（TD-008 登记不完整，只列 4 处站点），本提案按「同一条写入边界修复」将其并入（与已属 Phase 1 能力的 `review-reporter.ts` 复盘路径同性质），**不**提前实现 Phase 2 的出海能力。
>
> **只做减法**：本提案不实现替代入口。这样 Phase 0 与 Phase 2 之间不会出现「旧入口已删、新入口未上」的能力空洞：Phase 0 期间用户仍可经 Injoys 侧手工操作，Phase 2 再补显式沉淀入口。

**关联 Context 资产**:

| Scope | 关联资产 | 关联说明 |
|-------|---------|----------|
| criterion | `.context/criterion.md` | §4 内容写入边界、§3.5 目录固定（贯穿每次落盘） |
| architecture | `.context/architecture/risks_and_debt.md` | TD-008（高；本提案同轮补登第 5 处站点 `ops_draft_launch_kit`） |
| architecture | `.context/architecture/api_strategy.md` | §3.1 `generateArticleDraft` / `generateVideoMeta` 的「只保存本地」契约 |
| domain | `.context/domain/testing_strategy.md` | 模块 3 场景 1（宿主生成路径「未经明确要求不得创建 / 更新」）；沉淀界面的 模块 8 场景 2 / 3 属 Phase 2 / 3 |

**关键任务**:
1. 定位并移除生成路径的无条件 `document.create` 调用（`workbench.generateArticleDraft`、`ops_draft_article`、`ops_draft_video_meta`、`ops_draft_launch_kit`，共 4 处）（1.5 人日）
2. 移除 `review-reporter.ts` 复盘路径的无条件 `saveReviewDocument` 调用（0.5 人日）
3. 修正 `src/tools/index.ts` 工具描述文案使之与契约一致，并补登 TD-008 第 5 处站点（0.25 人日）
4. 补测试：「未显式触发时无远端写入」（1 条通用 + 1 条覆盖海外 Launch 生成路径）（0.25 人日）

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
| 海外 Launch 不写远端 | `ops_draft_launch_kit` 不再无条件经 `saveLaunchKitDocument` 触发 `document.create` | 单元测试 + `grep` |
| 文案一致 | 工具描述不再暗示「生成即沉淀」 | 代码审查 |

**验收场景（按需，建议 BDD）**:

```gherkin
场景: 物料生成与本地存盘
  Given 用户位于内容创作室
  When 用户触发 AI 生成物料
  Then 物料应自动保存至本地草稿库
    And 未经用户明确要求不得创建或更新 Injoys 文档

场景: 复盘路径不得无条件写入 Injoys
  Given 用户触发周度复盘
  When 复盘生成完成
  Then 不得向 Injoys 发出无条件的 saveReviewDocument 请求
    And 未经用户明确要求不得创建或更新 Injoys 文档

场景: 海外 Launch 物料生成不得无条件写入 Injoys
  Given 海外 Launch 物料生成路径已存在（`ops_draft_launch_kit`）
  When 用户仅触发物料生成
  Then 不得向 Injoys 发出无条件的 saveLaunchKitDocument 请求
    And 未经用户明确要求不得创建或更新 Injoys 文档
```

**依赖**:
- 前置: 无
- 被依赖: `fix-doc-id-fabrication`、`feat-workbench-sink-to-injoys-doc`
- 约束: 生成只保存本地；请求开始时捕获草稿目录并贯穿每次落盘（`criterion.md` §3.5）

---

### 提案 4: 工具不得以字面量 / 时间戳冒充文档编号

**Change ID:** `fix-doc-id-fabrication`  
**优先级:** P0  
**预计时间:** 1.5 人日（规划估算）  
**状态:** proposed

**业务目标（Business Goal）**:
- 消除「知识库未连通或写入失败时仍向用户播报不存在的文档编号」的虚报成功，满足 `criterion.md` §3.2。
- 让调用方能区分「已沉淀」与「未沉淀」（含 `ops_generate_review` 与 `ops_draft_launch_kit` 两处）。

**范围边界（In / Out）**:

| 类型 | 内容 |
|------|------|
| ✅ In | 将 `ops_generate_review` 与 `ops_draft_launch_kit` 的 `injoysDocId` 改为可空并取消 `output.schema` 的 `required`（**两处**） |
| ✅ In | 移除 `ops_generate_review` 的 `report.injoysDocId ?? 'doc_review'` 字面量回退 |
| ✅ In | 将 `InjoysClient.saveLaunchKitDocument` 返回类型改为 `Promise<string \| null>`，移除其在 `catch` 后回退 `doc_launch_${Date.now()}` 的**时间戳伪造编号**行为 |
| ✅ In | 同步 `.context/architecture/risks_and_debt.md` 的 **TD-009** 站点清单（补第 2 处 `ops_draft_launch_kit` / `saveLaunchKitDocument`），使债务登记与实现一致 |
| ✅ In | 补测试覆盖「知识库未连通时不得返回成功文档编号」（两处工具） |
| ❌ Out | 生成路径的未授权写入移除（`fix-unauthorized-injoys-doc-write`） |
| ❌ Out | `InjoysClient.saveReviewDocument` 的 `catch → null` 行为本身（如属实现缺陷，另行提案） |

**关联 Context 资产**:

| Scope | 关联资产 | 关联说明 |
|-------|---------|----------|
| criterion | `.context/criterion.md` | §3.2 虚报成功 |
| architecture | `.context/architecture/risks_and_debt.md` | TD-009（高；本提案同轮补登第 2 处站点 `ops_draft_launch_kit` / `saveLaunchKitDocument`）、架构 §3.5.1「不得谎报成功，也不得静默写本地假 ID」 |
| domain | `.context/domain/testing_strategy.md` | 模块 8 场景 3 的**宿主复盘路径子集**（「不返回假编号」）；完整沉淀界面场景（点击「沉淀至 Injoys 知识文档」的 模块 8 场景 2 / 3）依赖 Phase 2 接口与 Phase 3 界面，不在本 Phase |

**关键任务**:
1. 将 `ops_generate_review` 与 `ops_draft_launch_kit` 的 `injoysDocId` 改为可空并取消 `required`（两处）（0.75 人日）
2. 移除 `doc_review` 字面量回退与 `saveLaunchKitDocument` 的时间戳伪造（返回类型改 `Promise<string | null>`）（0.5 人日）
3. 补测试：「未连通 / 写入失败时不返回成功文档编号」（两处工具）（0.25 人日）

**验证标准**:

| 验收项 | 验收条件 | 验收方式 |
|--------|----------|----------|
| 无假编号 | 知识库未连通 / 写入失败时响应不含字面量文档编号 | 单元测试 |
| 时间戳不伪造 | `saveLaunchKitDocument` 失败 / 未配置时返回 `null`，不再回退 `doc_launch_${Date.now()}` | 单元测试 |
| schema 一致 | `output.schema` 不再将 `injoysDocId` 声明为 required（两处工具） | 代码审查 |
| 可区分状态 | 调用方可据响应判断是否已沉淀 | 单元测试 |

**验收场景（按需，建议 BDD）**:

```gherkin
场景: 知识库未连通时沉淀不可用（BR-073）
  Given 知识库中枢未连通
  When 用户触发周度复盘
  Then 不得显示"沉淀成功"
    And 不得返回不存在的文档编号

场景: 海外 Launch 物料未沉淀时不得编造编号
  Given 知识库中枢未连通
  When 用户触发海外 Launch 物料沉淀
  Then 不得返回 `doc_launch_<时间戳>` 形式的编号
    And 应如实返回未沉淀状态（`injoysDocId` 为 null）
```

**依赖**:
- 前置: `fix-unauthorized-injoys-doc-write`
- 被依赖: 无
- 约束: 与前置提案同属 Injoys 写入链路的「减法」先后顺序；失败必须如实返回，不得以成功形状包装失败（criterion §3.2）

---

### 提案 5: BrowserOS 能力开关契约与统一执行检查

**Change ID:** `feat-browseros-capability-toggle`  
**优先级:** P0  
**预计时间:** 3 人日（规划估算）  
**状态:** proposed

**业务目标（Business Goal）**:
- 落地 `adr_009_browseros_capability_management.md` 的**能力开关模型**，消除 TD-012 的「文档封闭白名单 / 实现开放集合」安全边界分叉。
- 使「最小权限」在**宿主侧真实生效**：所有 BrowserOS 调用经 `BrowserOsMcpClient.callTool` 统一入口集中检查「工具存在 / 启用 / 连接可用」，Adapter 禁止绕过。
- 让预填必需能力（`upload`）不再被旧「固定四动作」口径误伤，同时**不解除**「禁止自动发布 / Cookie 零外发」业务守卫。

**范围边界（In / Out）**:

| 类型 | 内容 |
|------|------|
| ✅ In | `src/types.ts` / `src/config-store.ts` 落 `OpsConfig.browserosCapabilities` 字段与**默认八项**解析（`tabs` / `navigate` / `snapshot` / `act` / `read` / `grep` / `wait` / `upload`；其余实际暴露工具默认关闭；`Set.has` + `hasOwnProperty` 空值前置短路） |
| ✅ In | `src/ops-rpc.ts` 落只读方法 `browseros.capabilities`（返回 `capabilities: BrowserOsCapabilityDescriptor[]` 与 `connected`）；配置读写仍走 `config.save`，本接口**不承接写操作** |
| ✅ In | 在 `browseros-bridge.ts` 的 `callTool` 统一入口集中检查「工具存在 / 启用 / 连接可用」，并将 `EXPECTED_TOOLS` 补齐为八项（补 `upload`，与 `browser-driver.ts` 的调用点对齐） |
| ✅ In | 新增错误码 `browser/capability-disabled`（工具存在但开关关）、`browser/tool-unavailable`（工具未暴露）、`browser/not-connected`（未连接）；经 `ops_*` 调用时「运营工具开关 + 引擎能力开关」**两层同时满足** |
| ✅ In | 同轮同步资产复述文案：`criterion.md` §4（已为能力开关口径，核对无残留「固定四动作 / 永久禁用 shell/cmd」旧措辞）、`api_strategy.md` §3.9 / §2.3、`security_policy.md` / `constraints.md` / `context_view.md` / `system_design.md` / `container_component_view.md` / `risks_and_debt.md` 中约 8 处白名单复述 |
| ❌ Out | 细粒度行为拦截（如区分「保存草稿」与「确认发布」按钮）——当前**未确定**，本提案不宣称具备，边界如实记录 |
| ❌ Out | `browser.login.*` 的前台登录能力（PD-001，Phase 2 PoC） |
| ❌ Out | 能力管理 UI（`feat-client-engine-config`，Phase 3） |

> [!NOTE]
> **边界不得夸大（ADR-009）**：能力开关只决定「哪些 BrowserOS 工具可调用」，**不等于**允许自动发布或外传 Cookie；流程守卫与业务守卫另计。依 `criterion.md` §6 / §7.1，本提案属 SSoT 契约变更，须**同轮**改契约资产与实现（`src/types.ts` → `src/ops-rpc.ts` → `browseros-bridge.ts`），**不得只改资产文案**。

**关联 Context 资产**:

| Scope | 关联资产 | 关联说明 |
|-------|---------|----------|
| criterion | `.context/criterion.md` | §4 最小权限（能力开关权威口径）、§5.4、§6 SSoT-first、§7.1 |
| architecture | `.context/architecture/adr_009_browseros_capability_management.md` | 能力开关模型决策与边界 |
| architecture | `.context/architecture/risks_and_debt.md` | TD-012（高）、RISK-002（业务守卫不解除） |
| architecture | `.context/architecture/api_strategy.md` | §3.9 `browseros.capabilities`、§2.3 错误码、§3.6 `config.save` |
| architecture | `.context/architecture/security_policy.md` | 授权边界与假阳性防治 |
| domain | `.context/domain/business_rules.md` | BR-074（默认八项 / 启停保持 / 两层开关 / 行为边界） |
| domain | `.context/domain/testing_strategy.md` | 模块 6 场景 5 / 6 / 7 / 8 |

**关键任务**:
1. 落 `OpsConfig.browserosCapabilities` 字段与默认八项解析（`Set.has` + `hasOwnProperty` 空值短路）（0.75 人日）
2. 落 `browseros.capabilities` 只读方法与 `browser/*` 三个错误码（0.75 人日）
3. 在 `callTool` 统一入口集中检查「存在 / 启用 / 连接可用」并实现两层开关同时满足（0.75 人日）
4. 同轮同步约 8 处资产复述文案（去掉旧「固定动作白名单」口径）（0.5 人日）
5. 补测试：默认八项、显式关闭重启保持、未暴露不列出、禁用拒绝、两层开关（0.25 人日）

**验证标准**:

| 验收项 | 验收条件 | 验收方式 |
|--------|----------|----------|
| 默认八项 | 首次使用或旧配置缺字段时八项默认启用，其余默认关闭 | 单元测试 |
| 启停保持 | 显式关闭并保存后重启仍保持关闭，不重置 | 单元测试 |
| 未暴露不列出 | 连接当前未提供的工具不出现在清单 | 单元测试 |
| 统一检查 | 所有 BrowserOS 调用经 `callTool` 单一入口校验；禁用返回 `browser/capability-disabled`、未暴露返回 `browser/tool-unavailable`、未连接返回 `browser/not-connected` | 单元测试 + `grep` |
| 两层开关 | 经 `ops_*` 调用时运营工具开关与引擎能力开关**同时满足**才执行 | 单元测试 |
| 守卫不解除 | 能力开关不改变「不自动发布 / Cookie 零外发」业务守卫 | 代码审查 |

**验收场景（按需，建议 BDD）**:

```gherkin
场景: BrowserOS 能力管理默认八项与启停保持（BR-074）
  Given 首次使用或旧配置缺少能力字段
  When 打开引擎策略配置 → BrowserOS 浏览器引擎 → 能力管理
  Then 默认八项 tabs/navigate/snapshot/act/read/grep/wait/upload 均启用
    And 其余实际暴露工具默认关闭

场景: 未暴露工具不列出（BR-074）
  Given 某工具当前连接未提供
  When 打开能力管理页
  Then 该工具不出现于清单（消失的工具就消失）

场景: 两层开关的执行拒绝（BR-074）
  Given 一个 ops_* 运营工具调用 BrowserOS 底层工具
  When 运营工具开关开启、而所调用的 BrowserOS 能力开关关闭
  Then 执行被拒绝
    And 返回「已禁用」语义，不执行底层工具
```

**依赖**:
- 前置: 无
- 被依赖: `feat-client-engine-config`（能力管理 UI 消费 `browseros.capabilities` 与 `config.save` 的能力字段）
- 约束: 契约先行（criterion §6）；能力开关不解除业务守卫（ADR-009）；不得新增独立 MCP 连接 / 后台轮询 / 常驻进程

---

### 提案 6: 统一 BrowserOS 会话探测并登记会话探活工具

**Change ID:** `fix-browser-session-cookie-probe`  
**优先级:** P0  
**预计时间:** 2.5 人日（规划估算）  
**状态:** proposed

**业务目标（Business Goal）**:
- 消除 RISK-003「会话状态假阳性」：移除读取宿主 Chrome / Chromium **Cookie 库**的会话探测分支（已证实存在根本缺陷），改为按 `criterion.md` §3.1 仅经**同一个** BrowserOS MCP 实例做轻量探测（当前活跃 Tab / 页面特征），并严格保持四态 `SessionState`（**严禁退化为 boolean**）。
- 补齐 `browser.sessions` 契约中已定义、实现缺失的 `statuses.loginUrl`，使 `needs_login` 平台可提供「去登录 ↗」外链（PRD §5.2.1 / §六.3）。
- 登记 PD-006 中属 Phase 0 的 `ops_inspect_sessions` 工具名（映射到已实现的 `browser.sessions`），使 BR-040 的「系统与调度」类目具备**已实现**工具。

**范围边界（In / Out）**:

| 类型 | 内容 |
|------|------|
| ✅ In | 移除 `SessionGuard.checkAllRealSessions` / `findHostBrowserCookiesPath` / `PLATFORM_COOKIE_RULES` 的**宿主 Cookie 库读取路径**（复制宿主 Cookie SQLite 并 `node:sqlite` 查询），以及 `browser.sessions` 中据此产生的假阳性判定 |
| ✅ In | `browser.sessions` 统一走 `checkBrowserSessions`（同一 BrowserOS 实例的活跃 Tab 轻量探测），四态返回保持不变 |
| ✅ In | 补齐 `statuses.loginUrl` 契约与实现（`needs_login` 时提供登录入口外链） |
| ✅ In | `reuseHostBrowserProfile` **兼容退出**：`browser.sessions` 不再读取该字段决定探测路径（强制统一实例探测），但**保留** `OpsConfig.reuseHostBrowserProfile` 字段、`browser.sessions` 响应字段与旧配置解析，避免破坏既有配置；同轮在 `criterion.md` §5.4 与 `api_strategy.md` §3.4 **标注该字段为「待废弃」**（引用 TAD §3.10.1） |
| ✅ In | 在 `src/tools/index.ts` 按名注册 `ops_inspect_sessions`（`system` 类，调用 `browser.sessions`），纳入 `tools.catalog` 五类分组（登记即可，`tools.catalog` 契约属 Phase 2） |
| ✅ In | 补测试：四态（含 `unknown` / `no_publish_permission`）不回退为 boolean；`needs_login` 含 `loginUrl`；无宿主 Cookie 库读取路径；`reuseHostBrowserProfile=true` 时不读本机 Cookie SQLite |
| ❌ Out | `reuseHostBrowserProfile` 字段的**彻底移除**（留待后续版本单列提案；本提案只做兼容退出） |
| ❌ Out | `browser.login.*` 前台登录能力（PD-001，Phase 2 PoC） |
| ❌ Out | `ops_keyword_research` / `ops_generate_hooks`（阶段未定，Phase 2 `feat-tools-lifecycle-gaps`） |
| ❌ Out | BrowserOS 能力开关（`feat-browseros-capability-toggle`，本 Phase 提案 5） |
| ❌ Out | 渠道矩阵 / 引擎状态 UI（Phase 3） |

> [!NOTE]
> **合并理由**：会话探测分支移除、`reuseHostBrowserProfile` 兼容退出、`ops_inspect_sessions` 按名登记三者同属 `browser.sessions` **一条链路**（同一 `src/ops-rpc.ts` 分支与同一 `SessionGuard` / 同一契约），拆成并行提案会同时改写同一处代码与契约、互相冲突，故合并为一个提案。
>
> **为何是「兼容退出」而非「彻底退役」**：依 `docs/implementation-gaps-report.md` §6 建议修复方向 #2——「先忽略该字段并强制统一实例探测，**保留字段与旧配置解析**（不直接删字段破坏旧配置），后续版本再彻底移除」。故本提案在 `criterion.md` §5.4 / `api_strategy.md` §3.4 只**标注「待废弃」**，不删除字段、不改响应形状；彻底移除留待后续版本单列提案（届时才更新契约基线）。

**关联 Context 资产**:

| Scope | 关联资产 | 关联说明 |
|-------|---------|----------|
| criterion | `.context/criterion.md` | §3.1「会话探测 / 预填 / 指标采集统一由同一 BrowserOS 实例调度」、§3.2 不虚报、§5.4 实现基线、§5.5 `SessionState` 四态、§6 SSoT-first |
| architecture | `.context/architecture/risks_and_debt.md` | RISK-003（高，未缓解 / 待修复）、TD-012 相关（BrowserOS 调用集中入口） |
| architecture | `.context/architecture/api_strategy.md` | §3.4 `browser.sessions`（含 `loginUrl`、`reuseHostBrowserProfile` 由本提案标注「待废弃」）、§3.10 `ops_inspect_sessions` 映射 |
| architecture | `.context/architecture/adr_001_unified_browseros_session.md` | 统一 BrowserOS 会话裁决 |
| domain | `.context/domain/risks_and_debt.md` | PD-006（`ops_inspect_sessions` 属 Phase 0） |
| domain | `.context/domain/business_rules.md` | BR-074（Profile / 状态灯展示规则：只展示连接状态，不推测 Profile） |
| domain | `.context/domain/testing_strategy.md` | 模块 1 场景 1 / 3（四态、未知与无权限） |

**关键任务**:
1. 移除宿主 Cookie 库读取路径（`checkAllRealSessions` / `findHostBrowserCookiesPath` / `PLATFORM_COOKIE_RULES`）与 `browser.sessions` 中的假阳性分支（1 人日）
2. 统一走 `checkBrowserSessions` 并保持四态（0.5 人日）
3. 补齐 `statuses.loginUrl` 契约与实现（0.25 人日）
4. `reuseHostBrowserProfile` 兼容退出（不再读取该字段），同轮在 criterion §5.4 / api_strategy §3.4 标注「待废弃」（0.5 人日）
5. 注册 `ops_inspect_sessions` 工具名并补测试（0.25 人日）

**风险与处理决定（按需）**:

| 风险 | 影响 | 处理决定及理由 |
|------|------|----------|
| 移除 Cookie 探测后部分平台状态更保守（多为 `unknown`） | 偶发需用户手动确认登录 | 依 RISK-003 应急预案：`unknown` 时引导用户在当前 BrowserOS 实例中直接扫码登录；**假阴性（提示登录）优于假阳性（显示就绪但实际未登录）** |
| `reuseHostBrowserProfile` 兼容退出 | 旧配置字段暂被忽略（仍可解析） | 依 `docs/implementation-gaps-report.md` §6 建议：**保留**字段与旧配置解析（不破坏旧配置），默认值解析对未知字段短路（不抛 `TypeError`）；客户端编辑入口在 Phase 3 一并移除；彻底移除留待后续版本单列提案 |

**验证标准**:

| 验收项 | 验收条件 | 验收方式 |
|--------|----------|----------|
| 无 Cookie 库读取 | `src/` 内不存在读取宿主 Chrome / Chromium Cookie 库的路径 | `grep` + 代码审查 |
| 统一实例 | 会话探测仅经同一 BrowserOS MCP 实例（活跃 Tab 轻量探测） | 代码审查 |
| 四态不回退 | `SessionState` 保持四态，`unknown` / `no_publish_permission` 可区分，未退化为 boolean | 单元测试 |
| 登录外链 | `needs_login` 平台返回 `loginUrl` | 单元测试 |
| 兼容退出 | `reuseHostBrowserProfile=true` 时仍只经 BrowserOS 实例探测（不读本机 Cookie）；字段与旧配置解析保留，`criterion.md` §5.4 / `api_strategy.md` §3.4 标注「待废弃」 | 单元测试 + 逐处比对 |
| 工具登记 | `ops_inspect_sessions` 在 `src/tools/index.ts` 可检索，映射 `browser.sessions` | `grep` |

**验收场景（按需，建议 BDD）**:

```gherkin
场景: 渠道会话四态呈现
  Given 用户已打开工作台
    And 微信公众号已在浏览器实例中完成扫码登录
    And B站尚未登录
  When 用户查看渠道矩阵网格
  Then 微信公众号卡片应显示"已认证就绪"状态
    And B站卡片应显示"需登录"状态
    And B站卡片应展示"去登录 ↗"按钮

场景: 未知与无权限两态（BR-010）
  Given 工作台尚未探测某渠道的会话状态
  When 用户查看渠道矩阵网格
  Then 该渠道应显示"未知 / 探测中"状态
    And 不得显示为"已认证就绪"

场景: 复用宿主 Profile 开关不得触发 Cookie 库读取
  Given 旧配置中 reuseHostBrowserProfile 为 true
  When 调用 browser.sessions
  Then 会话状态仍只基于 BrowserOS 实例探测
    And 不得读取本机 Chrome / Chromium 的 Cookie SQLite
```

**依赖**:
- 前置: 无
- 被依赖: `feat-client-engine-config`（引擎 / 平台状态展示）、`feat-client-dashboard`（渠道矩阵四态）
- 约束: 统一实例绑定（criterion §3.1）；四态严禁退化（§5.5）；Cookie 零外发（§4）——本提案只**移除**宿主 Cookie 读取，不新增任何会话数据外发

---

### 提案 7: 落盘文件与目录权限位实现

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
- 被依赖: `feat-storage-metrics-snapshot`
- 约束: 后续 `metrics/` / `calendar/` 落盘须复用同一封装（Phase 1 / 本 Phase 提案 2）；`metrics/` 部分即 `feat-storage-metrics-snapshot` 的显式前置

---

### 提案 8: `injoys.test` 补文档数（可空）契约

**Change ID:** `feat-injoys-test-document-count`  
**优先级:** P1  
**预计时间:** 1.5 人日（规划估算）  
**状态:** proposed

**业务目标（Business Goal）**:
- 补齐 `injoys.test` 契约中已定义、实现缺失的 `documentCount: number | null`，使引擎状态可展示真实文档数。
- 遵守 `criterion.md` §3.2 数据真实性：未配置令牌或探活失败时 `documentCount` 必须为 `null`，**不得按 0 伪造**。

**范围边界（In / Out）**:

| 类型 | 内容 |
|------|------|
| ✅ In | 在 `src/types.ts` / `src/ops-rpc.ts` 的 `injoys.test` 响应补 `documentCount: number | null` |
| ✅ In | 经 `knowledge.list` 探活取真实文档数；未配置令牌或探活失败时返回 `null`，且未配置令牌时**不得发请求并谎报「认证失败」** |
| ✅ In | 补测试：连通时返回真实文档数、未配置 / 失败时返回 `null`（不为 0） |
| ❌ Out | `injoys.test` 的既有 `connected` / `latencyMs` / `message` 字段语义（不改） |
| ❌ Out | 知识库读取的其它能力（不改） |
| ❌ Out | 引擎状态灯 / 驾驶舱的 `documentCount` 展示（`feat-client-dashboard`，Phase 3） |

**关联 Context 资产**:

| Scope | 关联资产 | 关联说明 |
|-------|---------|----------|
| criterion | `.context/criterion.md` | §3.2 不伪造数据（无法获取须为 `null`）、§5.4 实现基线 |
| architecture | `.context/architecture/api_strategy.md` | §3.6 `injoys.test` 契约（`documentCount: number \| null` 权威口径） |
| domain | `.context/domain/testing_strategy.md` | 模块 6 场景 1（连通性测试与延迟诊断） |

**关键任务**:
1. 补 `injoys.test` 响应的 `documentCount` 契约（`src/types.ts`）（0.5 人日）
2. 在 `src/ops-rpc.ts` 的 `injoys.test` 实现真实文档数读取与 `null` 语义（0.75 人日）
3. 补测试（连通返回文档数 / 未配置或失败返回 `null`）（0.25 人日）

**验证标准**:

| 验收项 | 验收条件 | 验收方式 |
|--------|----------|----------|
| 真实文档数 | 连通时 `documentCount` 为 `knowledge.list` 返回的真实文档数 | 单元测试（mock） |
| 不伪造 | 未配置令牌或探活失败时 `documentCount` 为 `null`，不为 0 | 单元测试 |
| 不谎报 | 未配置令牌时不发请求、不返回「认证失败」，返回明确提示 | 单元测试 |

**依赖**:
- 前置: 无
- 被依赖: `feat-client-dashboard`（引擎状态展示文档数）、`feat-client-engine-config`（连通性测试展示文档数）
- 约束: 契约先行（criterion §6）；缺失数据一律 `null`（§3.2）

---

## 执行顺序与依赖

本 Phase 内可并行推进的四条主线：

1. **数据真实性线**：`fix-overview-metrics-null-semantics` → `feat-storage-metrics-snapshot`（严格顺序）；`fix-storage-file-permissions` 是 `feat-storage-metrics-snapshot` 的**前置**（统一落盘封装的权限位），须先于其完成。
2. **内容写入边界线**：`fix-unauthorized-injoys-doc-write` → `fix-doc-id-fabrication`（严格顺序）；覆盖 5 处写入站点（含 `ops_draft_launch_kit`）与 2 处假编号（`ops_generate_review` / `ops_draft_launch_kit`）；`feat-injoys-test-document-count` 与 `fix-storage-file-permissions` 同属基础设施补强，可并行。
3. **安全边界线**：`feat-browseros-capability-toggle`（能力开关契约与统一执行检查）与 `fix-browser-session-cookie-probe`（会话探测假阳性修复 + 工具登记）**互不重叠**，可并行；二者均为 `feat-client-engine-config`（Phase 3）的前置。
4. 上述各线之间无相互阻塞，可整体并行。

- 跨阶段前置条件：无（本 Phase 是路线图起点）。
- 提供给后续阶段的能力：正确的汇总 `null` 语义与环比基准（供 Phase 3 驾驶舱）；只写本地的生成路径与 `InjoysClient` 文档写入能力（供 Phase 2 显式沉淀入口）；对齐后的 BrowserOS 能力开关、统一会话四态与落盘权限（供所有后续落盘与 Phase 3 引擎 / 平台配置页）；`ops_inspect_sessions` 工具名（供 Phase 2 工具目录分类）。

## 阶段整体验收

- `criterion.md` §3.2 / §3.4 / §4 相关的 BDD 场景通过：模块 5 场景 4 / 5 / 6、模块 3 场景 1（宿主生成路径未经明确要求不得创建 / 更新 Injoys 文档）、模块 1 场景 1 / 3（会话四态不回退）、模块 6 场景 5 / 6 / 7 / 8（能力开关默认八项 / 未暴露不列出 / 两层开关）。**模块 8 场景 2 / 3 依赖沉淀能力（Phase 2 的 `feat-workbench-sink-to-injoys-doc`）与沉淀界面（Phase 3），不在本 Phase 验收**；本 Phase 只验证宿主路径「未授权写入已移除」「复盘不返回假编号」「未连通不谎报」。
- `pnpm typecheck` + `pnpm test` 通过；新增用例覆盖「部分缺失 → `null`」「真实 0 参与求和」「未显式触发不写远端（生成 / 复盘 / 海外 Launch）」「未连通不返回成功文档编号（复盘 / 海外 Launch）」「能力开关默认八项 / 启停保持 / 禁用拒绝 / 两层开关」「会话四态与 `loginUrl`」「`reuseHostBrowserProfile=true` 不读本机 Cookie」「文件权限位」「`injoys.test` 文档数为 `null`」。
- `workbench.overview` 响应不再包含硬编码样例数据；`src/` 内生成 / 复盘 / 海外 Launch 路径无无条件 `document.create` 调用；`src/` 内存在 `callTool` 统一执行检查实现、无宿主 Chrome / Chromium Cookie 库读取路径；`browser.sessions` 不再依据 `reuseHostBrowserProfile` 读取宿主 Cookie（字段保留但已标注「待废弃」）。

## 待决事项（按需）

- 无。旧「固定四动作白名单 / 永久禁用 shell/cmd」口径已由 `adr_009_browseros_capability_management.md` 与 `criterion.md` §4 的**能力开关模型**取代，本 Phase 按其定稿实施，不再保留待决项。
