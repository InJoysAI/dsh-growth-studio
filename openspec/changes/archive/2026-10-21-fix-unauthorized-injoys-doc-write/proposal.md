# Change: fix-unauthorized-injoys-doc-write

## Why

`.context/criterion.md` §4「内容写入边界」（`.context/criterion.md:210`）规定：**生成只保存本地，写入 Injoys 文档必须由用户点击沉淀操作或明确要求；生成、预览、本地保存和自动同步配置均不构成该授权**。唯一被授权的写入入口是 `workbench.sinkToInjoysDoc`（`.context/criterion.md` §5.4 列为「已定义但尚未实现」，对应架构债务 `TD-001`）。

但当前实现有 **5 处**在生成 / 复盘阶段**无条件**经 `InjoysClient` 调用 `document.create` 写入用户 Injoys 空间，全都没有「用户显式触发」的前置判定：

| # | 站点 | 无条件调用 | `document.create` 出处 |
|---|------|-----------|----------------------|
| 1 | `src/ops-rpc.ts` `case 'workbench.generateArticleDraft'` | `injoys.saveArticleDocument(...)`，并把 `injoysDocId` 回写草稿 | `src/injoys/client.ts:391` |
| 2 | `src/tools/index.ts` `ops_draft_article` | `injoys.saveArticleDocument(...)` | `src/injoys/client.ts:391` |
| 3 | `src/tools/index.ts` `ops_draft_video_meta` | `injoys.saveVideoDocument(...)` | `src/injoys/client.ts:412` |
| 4 | `src/analytics/review-reporter.ts` `generateReview` | `this.injoys.saveReviewDocument(report)` | `src/injoys/client.ts:433` |
| 5 | `src/tools/index.ts` `ops_draft_launch_kit` | `injoys.saveLaunchKitDocument(phKit)` | `src/injoys/client.ts:518` |

`src/injoys/client.ts` 的 `invokeTool` 直接 `fetch(endpoint, { Authorization: Bearer <token> })`；配置了有效令牌时，这 5 处会**真的**在用户 Injoys 空间创建文档（`docs/implementation-gaps-report.md` §1）。这越过 `criterion.md` §4 的内容写入边界，也使 `.context/architecture/api_strategy.md` §3.1 已声明的契约（`workbench.generateArticleDraft` 的「MVP 写入边界：本请求只保存本地，不创建或更新 Injoys 文档」）在实现侧不成立。

`.context/architecture/risks_and_debt.md` 的 **TD-008（高）** 已登记该缺陷，但**只列了 4 处站点**，遗漏第 5 处 `ops_draft_launch_kit`（`src/tools/index.ts:933`）——尽管 `api_strategy.md` §3.10 的工具表已把它记为「无条件 `saveLaunchKitDocument`」。本提案按「同一条写入边界修复」把 5 处一并做**减法**，并同轮补登 TD-008 站点清单。

## What Changes

### 移除的写入（5 处，只做减法）

- `src/ops-rpc.ts` 的 `workbench.generateArticleDraft`：删除 `saveArticleDocument(...)` 调用，以及仅为回写 `injoysDocId` 而存在的第二次 `saveDraft`；响应的可选字段 `injoysDocId` 返回 `undefined`。
- `src/tools/index.ts` 的 `ops_draft_article`：删除 `saveArticleDocument(...)`，返回的 `docId` 为 `undefined`（`output.schema` 中 `docId` 本就不是 required）。
- `src/tools/index.ts` 的 `ops_draft_video_meta`：删除 `saveVideoDocument(...)`，返回的 `injoysDocId` 为 `undefined`（非 required）。
- `src/tools/index.ts` 的 `ops_draft_launch_kit`：删除 `saveLaunchKitDocument(phKit)` 调用。
- `src/analytics/review-reporter.ts` 的 `generateReview`：删除 `saveReviewDocument(report)` 调用与随后的 `report.injoysDocId` 回写块。

上述路径的**本地落盘行为不变**（`actualDraftStore.saveDraft` 与请求开始时捕获的草稿目录一律保留，遵循 `criterion.md` §3.5「目录在单次操作内固定」）。

### 修正的工具描述文案

`src/tools/index.ts` 中两处与契约相悖的 `description`：

- `ops_draft_article`：「……并保存为 Injoys 文档。」→ 明确产物只保存到本地草稿库。
- `ops_generate_review`：「……并沉淀至 Injoys 文档。」→ 明确生成复盘总结并返回结果（复盘不落盘，不得声称已保存本地草稿文件）；写入 Injoys 文档须用户显式触发。

### 同步的债务登记

- `.context/architecture/risks_and_debt.md` 的 **TD-008** 描述与影响范围补第 5 处站点（`src/tools/index.ts` 的 `ops_draft_launch_kit`，经 `InjoysClient.saveLaunchKitDocument`），使债务登记与实现一致。
- 经 `.agents/workflows/context-update.md` 刷新 `.context/context-manifest.json` 与 `.context/history/context-sync.jsonl`。

### 真实工具调度校验的配套修正

`ops_draft_article` / `ops_draft_video_meta` 的返回对象不再显式携带值为 `undefined` 的 `docId` / `injoysDocId`（宿主 `ToolRuntime` 对成功返回做无损 JSON 快照，`undefined` 会被判为 `invalid output`），并在两者 `output.schema` 补登一直返回却未声明的 `draftId`。后者是既有缺陷（`additionalProperties: false` 下真实调度必然失败），与 `injoysDocId` 的可空化契约无关；不补登则本提案的「生成仍落盘本地草稿」在真实调度下不成立。

### 保留的能力

`InjoysClient` 的 `saveArticleDocument` / `saveVideoDocument` / `saveReviewDocument` / `saveLaunchKitDocument` 四个方法**保留不动**（连实现一并保留），供 Phase 2 的用户显式沉淀入口 `feat-workbench-sink-to-injoys-doc` 复用。本提案删除的是生成 / 复盘路径的**调用**，不是能力。

### 已在路线图中排除的事项（Out of Scope）

- `workbench.sinkToInjoysDoc` 唯一授权沉淀入口的**实现**（`feat-workbench-sink-to-injoys-doc`，Phase 2）。本提案不实现替代入口：Phase 0 期间用户仍可在 Injoys 侧手工操作，Phase 2 再补显式沉淀入口，避免出现「旧入口已删、新入口未上」的能力空洞。
- 海外四大渠道（YouTube / X / Product Hunt / TikTok）**模拟与预填能力本身**（Phase 2）。本提案只对**已存在**的 `ops_draft_launch_kit` 做减法合规修复，不提前实现 Phase 2 能力。
- 文档编号的可空化契约与假编号回退（`ops_generate_review` 的 `report.injoysDocId ?? 'doc_review'` 字面量、`ops_draft_launch_kit` 的 `output.schema.injoysDocId.required`、`saveLaunchKitDocument` 的 `doc_launch_${Date.now()}` 时间戳兜底）——属紧随的 `fix-doc-id-fabrication`（本提案的被依赖方）。
- 知识库读取能力（生成时读取知识库属允许行为，不动）。
- **知识库未连通时的「沉淀不可用」场景的 Phase 0 验收**：本提案移除写入后，Phase 0 期间已不存在任何文档沉淀入口，故 `edge_cases.md` §5「知识库中枢未连通 → 文档沉淀不执行」与 `testing_strategy.md` 模块 8 场景 2 / 3 在 Phase 0 **不可触发**，其验收属 Phase 2（`proposal-roadmap-Phase-0.md` 阶段整体验收已声明「模块 8 场景 2 / 3 不在本 Phase 验收」）。
- **生成侧在知识库未连通时返回兜底上下文**（`src/injoys/client.ts` 的 `getKnowledgeContext` 默认上下文分支）属既有行为，本提案不移除也不核查；本提案只处理写入边界。
- **AI 生成不可用 / 重试 / 生成内容不完整**（`.context/domain/edge_cases.md:25` / `:27`）的处理不因删除调用而变化，也不在本提案扩建；本提案不移除生成能力，且**不得**破坏既有的保存失败错误传播（`criterion.md:182` 的 `drafts/storage-unavailable` 统一映射保持原样）。
- 任何客户端 UI 改动（Phase 3）。

> [!IMPORTANT]
> **已登记的过渡态（A3 → A4 严格顺序）**：`ops_generate_review` 与 `ops_draft_launch_kit` 的 `output.schema.injoysDocId` 仍为 `{ type: 'string', required: true }`，而 `defineTool` 会把 required 约束到 `execute` 的返回类型（`node_modules/@deepseek-ai/dsh-tools/lib/types/schema.d.ts:210` 的 `Promise<InferValue<NoInfer<O>>>`），因此本提案无法在这两处返回空值形状：
> - `ops_draft_launch_kit` 因 schema 仍要求字符串，`injoysDocId` 返回**空串**（并在代码注释中指向 `fix-doc-id-fabrication`），不编造任何编号。
> - `ops_generate_review` 的 `report.injoysDocId ?? 'doc_review'` 字面量回退**保持原样**（移除该回退属 `fix-doc-id-fabrication` 的 In 范围）。移除写入后，该回退在正常路径也会命中，这是本提案引入的、**已知且必须在 A4 消除**的过渡态。
>
> 同理，`ops_draft_launch_kit` 的渲染分支（`src/tools/index.ts` 中 `**Injoys 文档编号**: \`${value.injoysDocId}\`` 无 `?` 判定）与两处工具的 `output.schema` 可空化同属 A4 收口范围，本提案不修改；`spec/injoys-write-boundary` 已把这三处的过渡态口径写清（`undefined` 与 `''` 分别对应哪些工具）。
>
> 因此本提案**不应单独长期停留**，须由 `fix-doc-id-fabrication` 紧随落地（A4 的前置即为本提案）。本提案的交付不宣称已解决 `TD-009`（虚报成功）。

> [!NOTE]
> **覆盖边界的如实声明**：本提案只覆盖 `document.create`（Injoys 文档）写入，口径与 `TD-008` 一致。`ops_plan_calendar` 的「同步写入 Injoys 表格」、`ops_fetch_metrics` 的「同步至 Injoys 指标表格」、`ops_extract_feedback` 的「沉淀至 Injoys 需求池」同属对用户 Injoys 空间的远端写入，但**不在 `TD-008` 口径与本提案范围内**，也不因本提案而被认为已合规。这些站点是否构成缺陷取决于「工具被调用是否即视为用户显式触发」（`business_rules.md` BR-NFR-002 把这三类写入列为用户主动触发的业务功能），本提案不做裁决；建议由后续 `context-check` / `context-update` 轮次判定是否为其单列债务登记。

> [!IMPORTANT]
> **上游规划差异（如实记录，不擅改源文档）**：`.context/domain/business_rules.md:201` / `:204` 与 `.context/architecture/api_strategy.md:335` 把「沉淀至 Injoys 知识文档」入口标为 **Phase 0 首版**，`.context/architecture/risks_and_debt.md:297` 的 TD-008 解决方案亦要求「**先**补齐 `workbench.sinkToInjoysDoc` 作为唯一入口，**再**移除生成路径写入」；而路线图把入口延至 Phase 2（`openspec/proposal-roadmap-Phase-0.md:219` / `:226`，`openspec/proposal-roadmap.md:207`）并**先**做删除。本提案按路线图拆分执行（先止血越权写入），**不**宣称 BR-033 的「沉淀入口首版」能力已满足，也**不**把入口实现提前为本提案的前置；上游口径的追溯与同步属后续 `context-update` 的职责，本提案不改源文档。Phase 0 期间的能力替代方式为在 Injoys 侧手工沉淀，不构成插件内能力无空档。

### 交付门禁（用户可用版本）

本提案（A3）与 `fix-doc-id-fabrication`（A4）**必须作为同一个用户可用版本交付**：

- A3 **可以**单独合入与归档（供开发验证、代码审查与依赖解锁），但**不得**单独作为「已满足 `criterion.md:109` 不虚报成功」的用户可用交付发布。
- 用户可用版本的交付组合 = A3（移除 5 处写入）+ A4（两处 `injoysDocId` 可空化并取消 `output.schema.required`、移除 `ops_generate_review` 的 `?? 'doc_review'` 回退、修正 `ops_draft_launch_kit` 与 `ops_generate_review` 的编号空值渲染分支）+ 紧随的 `api_strategy.md` §3.10 现状列同步（`:752`–`:754`、`:758`）。
- 组合验收：**正常路径、知识库未连通、写入失败**三种情形下均不出现 `doc_review` 或 `doc_launch_<时间戳>` 形式的编号；未沉淀时呈现「未沉淀」语义。
- 理由：A3 单独交付会使 `ops_generate_review` 在**正常路径**必然命中 `report.injoysDocId ?? 'doc_review'`（移除写入后 `report.injoysDocId` 恒为 `undefined`，`src/tools/index.ts` 必然兜底），即把 `criterion.md:109` 禁止的虚报成功从「失败路径偶发」扩大为「正常路径恒发」。上文已登记该扩大，但**登记不构成豁免**：工程 MUST NOT 无法以风险接受方式绕过，只能由交付组合收口。本门禁不新增任何防御机制，只界定交付组合。

## Impact

### 涉及的规范（Specs）

- **新增**：`specs/injoys-write-boundary/spec.md` — 生成 / 复盘路径的 Injoys 文档写入边界（4 条 Requirement：生成不写远端、复盘不写远端、工具描述与 README 功能说明一致、写入能力保留；共 8 个 Scenario，按 RPC 图文 / 工具图文 / 工具视频 / RPC 视频 / 复盘 / 海外 Launch 分别写清各自契约）。

### 涉及的代码

- **修改**：
  - `src/ops-rpc.ts`（`workbench.generateArticleDraft` 分支）
  - `src/tools/index.ts`（`ops_draft_article` / `ops_draft_video_meta` / `ops_draft_launch_kit`，含两处 `description` 文案）
  - `src/analytics/review-reporter.ts`（`generateReview`）
  - `README.md`（`:24` / `:27` / `:39` 三处把「沉淀至 Injoys 文档」描述为生成副作用的对外文案）
  - `tests/ops-manager.spec.ts`（既有断言改写 + 新增用例）
- **不修改**（明确保留）：`src/injoys/client.ts` 的四个 `save*Document` 方法；`src/types.ts` 的领域类型；`plugin-src/` 客户端代码。
- **新增**：无。

### 依赖关系

- **前置**：无。
- **被依赖**：`fix-doc-id-fabrication`（严格顺序：本提案移除写入后，`injoysDocId` 的假编号回退与可空化契约才有明确的收口对象）、`feat-workbench-sink-to-injoys-doc`（Phase 2 的显式沉淀入口复用本提案保留的 `InjoysClient` 写入能力）。
- **约束**：生成只保存本地；请求开始时捕获草稿目录并贯穿每次落盘（`criterion.md` §3.5）。

### 风险与注意事项

| 风险 | 影响 | 处理决定及理由 |
|------|------|----------|
| 历史用户依赖「生成即沉淀」的隐性行为 | 行为变化 | 依 MVP 裁决（2026-10-16）：生成只保存本地、沉淀须用户明确触发；这是**目标契约**，不是回归。`.context/architecture/api_strategy.md:15` 已声明该裁决，本轮即为实现侧的核查闭环。 |
| **RISK-004（高）** 配置切换竞态跨库覆盖 | 删除 `workbench.generateArticleDraft` 的第二次 `saveDraft`（仅为回写 `injoysDocId`）时，若误改或误移首次 `saveDraft` 的目录参数、或把 `getDirectory()` 移到 `await` 之后，会在配置切换时「A 库读、B 库写」并覆盖 B 库同 ID 草稿 | 保留请求开始处的 `articleStorageDir = actualDraftStore.getDirectory()` 与首次 `saveDraft(..., { dir: articleStorageDir })`（`tasks.md` 3.1），不在 `await` 后重新解析目录（`criterion.md` §3.5）；回归证据为既有 `U2: 图文生成在知识库等待期间切换目录，不得产生双库副本` 用例（`tests/ops-manager.spec.ts:2261`，见 `tasks.md` 5.4 / 6.3.2），不新增重复用例 |
| 移除调用后 `injoysDocId` / `docId` 字段仍被读取 | 字段为空 | 契约已将其保留为**可选兼容形状**（`api_strategy.md` §3.1；`src/types.ts` 中四处 `injoysDocId?: string \| undefined` 全部可选），不因生成而填充。客户端渲染已有 `*(未同步)*` 分支（`ops_draft_article` / `ops_draft_video_meta`）。 |
| `ops_draft_launch_kit` 的 `injoysDocId` 因 schema 仍为 required 字符串而返回空串 | 用户可见文案出现空的「Injoys 文档编号」 | 依「不得编造编号」优先：空值优于假编号（`criterion.md` §3.2）。该字段的可空化、`required` 取消与渲染分支属 `fix-doc-id-fabrication`，本提案以代码注释标注并在此登记。 |
| `ops_generate_review` 的 `doc_review` 回退在移除写入后于正常路径也命中（属**高**风险：A3 单独交付时每次正常复盘都播报假编号） | 过渡期内仍播报假编号，把 `criterion.md:109` 的虚报成功从「失败路径偶发」扩大为「正常路径恒发」 | **登记 + 交付门禁收口**：移除该回退属 `fix-doc-id-fabrication` 的 In 范围（本提案的 Out），A3 只作开发中间状态，用户可用交付须按上文「交付门禁（用户可用版本）」与 A4 组合（含两处空值渲染与 §3.10 现状同步）。**风险登记不构成对 MUST NOT 的豁免** |
| `.context/architecture/api_strategy.md` §3.10 工具表的「现状」列（`无条件写 Injoys（TD-008）` / `无条件 saveLaunchKitDocument`）在本提案与 A4 实施后过时 | 契约资产的现状描述与实现不一致 | 本提案按路线图范围只补登 TD-008 站点清单，不扩写 §3.10 的现状列（该表同轮还含 A4 负责的「假编号回退（TD-009）」行）；§3.10 现状列的同步归后续 `context-update` / `context-check` 轮次，此处如实登记以免被误认为已对齐。 |
| 删除写入后 `ReviewReporter` 的 `injoys` 构造参数不再被使用 | 可能出现「未使用成员」告警 | 保留构造函数签名（`new ReviewReporter(injoys)` 调用点与既有测试不变）；`tsconfig.json` 未启用 `noUnusedLocals` / `noUnusedParameters`，不构成编译错误；不为此改动公共构造函数形状。 |

### 验证标准

- ✅ 三个内容入口（`workbench.generateArticleDraft`、`ops_draft_article`、`ops_draft_video_meta`）调用后无 `document.create` 请求发出，且各自仍把物料落盘为**本地草稿**（保留既有 `saveDraft` 与 `draftSaved` / `draftId` 返回）。
- ✅ `ops_draft_launch_kit` 调用后无 `document.create` 请求发出，并保留既有的生成结果返回（`tagline` / `makerComment` / `twitterThread` / `timezoneAdvice` / `summaryMarkdown`）；本提案**不为其新增草稿持久化**（Launch 持久化属其 Phase 2 能力，见 Out of Scope）。
- ✅ 复盘路径（`ReviewReporter.generateReview` / `ops_generate_review`）无 `saveReviewDocument` / `document.create` 请求，复盘结果照常返回；复盘**不落盘**，也**不**读取知识库（`ops_generate_review` 只采集指标并调用 reporter）。
- ✅ `ops_draft_article` / `ops_generate_review` 的工具描述与 `README.md` 的 `:24` / `:27` / `:39` 三处同源文案同步修正——旧的「保存为 Injoys 文档」「存入 Injoys 文档」「沉淀至 Injoys 文档」表述消失；且**按入口区分落盘承诺**：图文 / 视频条目说明保存至本地草稿库，复盘条目只说明生成并返回结果（不得声称已落盘），两者均说明写入 Injoys 文档须用户显式触发。
- ✅ `InjoysClient` 的四个 `save*Document` 方法仍可被显式调用并返回值（能力保留）。
- ✅ 除 `README.md` 三处外，其余项目文档无需改动（本提案不涉及接口设计变更，故不更新 `.context/architecture/api_strategy.md` 的请求/响应示例）。
- ✅ `pnpm typecheck` + `pnpm test` 通过；用户可用版本的交付组合见上文「交付门禁（用户可用版本）」。
- ✅ `ops_draft_article` / `ops_draft_video_meta` 经真实 `ToolRuntime` 注册与调度（非直接调用 `execute`）返回 `isError: false`，证明返回值通过宿主无损 JSON 校验。

### 关联 Context 资产

| Scope | 资产路径 | 关联说明 |
|-------|---------|---------|
| criterion | `.context/criterion.md` | §4「内容写入边界」（`:210`）、§4「最小权限」与「审计与风控」、§3.2「错误不得吞没 / 不得虚报成功」、§3.5「目录在单次操作内固定」、§6 SSoT-first、§7.1 / §7.2 SSoT 路径与校验命令 |
| architecture | `.context/architecture/risks_and_debt.md` | TD-008（高，本提案偿还对象，同轮补登第 5 处站点）；TD-001（`workbench.sinkToInjoysDoc` 未实现）；TD-009（由被依赖提案 `fix-doc-id-fabrication` 偿还）；RISK-004 缓解措施 ③ |
| architecture | `.context/architecture/api_strategy.md` | §3.1 `workbench.generateArticleDraft` / `workbench.generateVideoMeta` 的「只保存本地」契约与「MVP 写入边界」；§3.1 `workbench.sinkToInjoysDoc` 为唯一授权入口；§3.10 工具表（`ops_*` 现状与阶段）；§3.7 目录固定口径 |
| architecture | `.context/architecture/data_architecture.md` | `ContentDraft.injoysDocId` 仅经 `workbench.sinkToInjoysDoc` 成功后写入 |
| architecture | `.context/architecture/runtime_view.md` | 生成路径时序「不创建或更新远端文档」；Injoys 沉淀失败不得谎报成功 |
| architecture | `.context/architecture/cross_cutting_concepts.md` | 「不谎报」「不伪造」（不得静默写本地假 ID） |
| architecture | `.context/architecture/constraints.md` | 阶段边界：未到阶段的能力不提前实现（本提案只做减法，不提前实现 Phase 2 出海能力） |
| domain | `.context/domain/business_rules.md` | BR-030（物料生成与本地存盘，主数据留本机不自动上传）、BR-033（沉淀仅在用户显式触发时执行）、BR-040（工具「外部依赖」标注语义不代表自动写入授权——工具描述文案修正的直接依据）、BR-073（知识库未连通时不得返回看似成功的结果）、BR-NFR-002（内容留存边界） |
| domain | `.context/domain/testing_strategy.md` | 模块 3 场景 1「物料生成与本地存盘」（未经用户明确要求不得创建或更新 Injoys 文档）；模块 8 场景 2 / 3 属 Phase 2 / 3，不在本 Phase 验收 |
| domain | `.context/domain/edge_cases.md` | §5「知识库中枢未连通」：依赖知识库的动作（含文档沉淀）不执行、不展示为成功 |
| openspec | `openspec/proposal-roadmap.md` + `openspec/proposal-roadmap-Phase-0.md` | Phase 0 提案 3 的大纲条目（本提案的命中的 roadmap 条目） |

### 提案大纲对齐（Roadmap Alignment）

| 字段 | 内容 |
|------|------|
| roadmap_source_primary | `openspec/proposal-roadmap.md`（提案索引行 `:194`：`fix-unauthorized-injoys-doc-write` \| Phase 0 \| P0 \| 前置：无 \| in-progress） |
| roadmap_source_supplement | `openspec/proposal-roadmap-Phase-0.md`（本提案条目正文在「提案 3: 移除生成 / 复盘 / 海外 Launch 路径未授权的 Injoys 文档写入」，`:198`–`:284`）；另按命令行参数补充读取同名 `roadmap-doc`，内容与上者一致，不改变主来源结论 |
| phase | Phase 0（安全与数据真实性修复） |
| change_kind | `code` |
| business_goal | 使生成（图文 / 视频元数据 / 海外 Launch 物料）与复盘路径**只写本地**，符合 `criterion.md` §4 内容写入边界；消除「用户未授权即把物料写入其 Injoys 空间」的越界行为（澄清：「只写本地」指**不写远端**；其中 `ops_draft_launch_kit` 本轮不落盘，见 `in_scope` 与 Out of Scope） |
| in_scope | 移除 5 处无条件 `document.create` 调用（含 `ops_draft_launch_kit` 的 `saveLaunchKitDocument`）；修正 `src/tools/index.ts` 相悖文案；同轮补登 TD-008 第 5 处站点（含追踪看板行）；补「未显式触发时不写远端」测试（含海外 Launch 路径）；保留四个 `InjoysClient.save*Document` 能力。**相对大纲 In 中「修正 `src/tools/index.ts` 中与契约相悖的工具描述文案」一条（`openspec/proposal-roadmap-Phase-0.md:215`）的最小扩充**：一并修正 `README.md:24` / `:27` / `:39` 三处同源文案（理由：这三处与 `src/tools/index.ts` 的 `description` 是同一缺陷的对外表述，本提案落地后由真变假；不扩及 `README.md:28` / `:61`） |
| out_of_scope | `workbench.sinkToInjoysDoc` 唯一授权入口的实现（Phase 2）；海外四大渠道模拟与预填能力本身（Phase 2）；知识库读取能力；文档编号可空化、假编号回退与两处工具的编号渲染（属被依赖提案 `fix-doc-id-fabrication`）；知识库未连通时「沉淀不可用」场景的 Phase 0 验收（无入口可触发，属 Phase 2）；生成侧知识库兜底上下文与 AI 生成不可用 / 重试 / 内容不完整的处理（既有行为，本轮不扩建，但不得破坏既有保存失败错误传播） |
| dependencies | 前置：无。被依赖：`fix-doc-id-fabrication`（严格顺序，且与之构成同一用户可用版本交付组合）、`feat-workbench-sink-to-injoys-doc`（Phase 2） |
| acceptance_criteria | 生成路径无 `document.create`（4 处站点）；复盘路径无无条件 `saveReviewDocument`；`ops_draft_launch_kit` 不再经 `saveLaunchKitDocument` 触发远端写入；工具描述与 `README.md` 文案不再暗示「生成即沉淀」；既有 `U2` 目录固定用例（RISK-004）继续通过（验证方式：单元测试 mock `InjoysClient` + `grep` + 代码审查） |
| key_tasks | ①定位并移除生成路径 4 处无条件 `document.create`；②移除 `review-reporter.ts` 的无条件 `saveReviewDocument`；③修正工具描述文案并补登 TD-008 第 5 处站点；④补测试「未显式触发时无远端写入」（1 条通用 + 1 条覆盖海外 Launch） |
| risks | 见上文「风险与注意事项」：历史隐性行为依赖（属目标契约变更）、`injoysDocId` 字段变空、launch kit 空串过渡态、`doc_review` 回退过渡态（A3 单独交付时正常路径恒发，由「交付门禁」收口）、`api_strategy.md` §3.10 现状列过时（须并入 A4 交付组合）、`ReviewReporter.injoys` 变为未使用参数、上游规划差异（BR-033 入口阶段口径） |
| related_context_assets | 见上文「关联 Context 资产」表 |
| milestones | N/A（roadmap 条目未提供；按 4 条 key_tasks 拆解为 `tasks.md` 第 3–5 章执行） |
| coverage_scope | 5 处写入站点（4 处生成 + 1 处复盘）、2 处工具描述文案与 `README.md:24` / `:27` / `:39` 三处同源文案；不含客户端 UI、沉淀入口实现与 Launch 新增持久化 |
| gate_vs_non_gate | N/A（roadmap 条目未提供） |
| change_management | 属 Phase 0「内容写入边界线」，与 `fix-doc-id-fabrication` 严格顺序且**组合交付**（见上文「交付门禁（用户可用版本）」）；上游规划差异（BR-033 / `api_strategy.md` 的入口阶段口径与 TD-008「先补齐」顺序）已如实登记，不擅改源文档；不修改 roadmap 条目 |
| ops_support | N/A（roadmap 条目未提供） |
| kpi | N/A（roadmap 条目未提供） |
| risk_acceptance_policy | 过渡态（launch kit 空串、`doc_review` 回退）**仅在 A3 作为开发中间状态时**被接受并登记；用户可用交付须按「交付门禁（用户可用版本）」与 A4 组合，使正常 / 知识库未连通 / 写入失败三种情形均不出现假编号。**不得**以风险接受豁免 `criterion.md:109`，也不得据此宣称 `TD-009` 已修复 |
