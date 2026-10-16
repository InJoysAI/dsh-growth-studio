# 实现缺陷登记：P0-1 / P0-2 / TD-011

- **登记日期**: 2026-10-16
- **范围**: `dsh-growth-studio` 插件的宿主侧实现与 `.context/` 契约的一致性
- **状态**: **未修复**。本文件仅为登记与取证记录；`.context/` 侧已登记（`architecture/risks_and_debt.md` 的 **TD-008 / TD-009 / TD-011**，其中 TD-008 / TD-009 存在覆盖缺口，见 §4），实现侧尚未改动。
- **修复前置**: 创建变更提案所需的 `openspec/config.yaml`、`openspec/proposal-roadmap.md` **尚未生成**，见文末 §5。
- **证据口径**: 所有 `文件:行号` 写于 2026-10-16 的仓库状态，后续改动可能使行号迁移，检索时以符号名（函数名 / 错误码字面量）为准。

> 权威来源：工程约束以 `.context/criterion.md` 为准；技术事实以 `.context/architecture/source/technical_architecture.md`（TAD v1.3.0）为准。本文不重复定义契约，只记录"实现与契约的落差"。

---

## 1. P0-1 生成路径未授权写入 Injoys 文档

**结论：相对现行契约，是功能缺陷（越权远端写入）；不是崩溃型 bug，代码是有意为之、未跟进 2026-10-16 的契约裁决。**

### 契约（应当怎样）

| 依据 | 原文要点 |
|---|---|
| `.context/criterion.md:200` | 内容写入边界：生成只保存本地，写入 Injoys 文档必须由用户点击沉淀操作或明确要求；生成、预览、本地保存和自动同步配置均不构成该授权 |
| `.context/criterion.md:168` | 生成接口在等待知识库后只写本地草稿；**生成不得自动延伸为远端写入** |
| `.context/criterion.md:269` | 生成只保存本地，沉淀须用户明确触发 |
| `.context/architecture/source/technical_architecture.md:490` | 写入边界：只保存本地草稿，**不调用 Injoys 文档写入**；仅用户明确触发后才沉淀 |

唯一被授权的入口是 `workbench.sinkToInjoysDoc`，**尚未实现**（见 `.context/architecture/risks_and_debt.md` TD-001）。

### 实现（实际怎样）

| 位置 | 行为 |
|---|---|
| `src/ops-rpc.ts:372`（`case 'workbench.generateArticleDraft'`）→ `:405` | 生成草稿后**无条件**调用 `injoys.saveArticleDocument(...)` |
| `src/tools/index.ts:228`（`ops_draft_article`） | 生成图文后调用 `injoys.saveArticleDocument(...)` |
| `src/tools/index.ts:321`（`ops_draft_video_meta`） | 生成视频元数据后调用 `injoys.saveVideoDocument(...)` |
| `src/analytics/review-reporter.ts:92`（`ops_generate_review` 路径） | 生成复盘后调用 `injoys.saveReviewDocument(report)` |
| `src/tools/index.ts:928`（`ops_draft_launch_kit`） | 生成海外 Launch 物料后调用 `injoys.saveLaunchKitDocument(phKit)` |
| `src/injoys/client.ts:389 / :410 / :431 / :516` | 上述四个方法经 `invokeTool('document.create', ...)` 发起真实 HTTP 调用 |

关键事实：`src/injoys/client.ts` 的 `invokeTool` 直接 `fetch(endpoint, { headers: { Authorization: 'Bearer ' + token } })`。
**配置了有效 token 时会真的在用户 Injoys 空间创建文档**；未配置 token 时通常 401 → 被 `catch` → 返回 `null`（静默失败，与 P0-2 组合后还会造成假编号）。

五处调用均**没有**"用户显式触发"的前置判定。

### 影响

- 在用户未授权（仅"生成"）时，物料/复盘即被写入其 Injoys 空间，越过 `criterion §4` 的内容写入边界。
- `.context/architecture/api_strategy.md` 的 MVP 裁决说明已标注"本轮未改代码，尚未核查运行时是否已对齐"，即契约已声明、实现未闭环。
- **登记不完整（待补登）**：`.context/architecture/risks_and_debt.md` 的 **TD-008 只列了 4 处站点**（`ops-rpc.ts` / `ops_draft_article` / `ops_draft_video_meta` / `review-reporter.ts`），**未涵盖第 5 处 `ops_draft_launch_kit`（`src/tools/index.ts:928`）**；TD-008 的描述与影响范围应一并扩写。

### 建议修复方向（SSoT-first）

1. 先补齐 `workbench.sinkToInjoysDoc` 契约与实现，作为**唯一**的用户显式沉淀入口。
2. 从生成 / 复盘路径移除无条件的 `document.create` 调用。
3. 修正 `src/tools/index.ts:164`（`ops_draft_article` 的描述文案"……并保存为 Injoys 文档"）等与契约相悖的实现侧文案。
4. 补测试：`未显式触发沉淀时不产生远端写入`。

### 验收口径

- 仅调用生成类工具、不触发沉淀时，Injoys 侧不新增任何文档。
- 只有显式触发 `sinkToInjoysDoc` 后才产生远端写入。

---

## 2. P0-2 `ops_generate_review` 以字面量 `doc_review` 冒充文档编号

**结论：是明确的代码 bug（虚假返回值）。**

### 契约（应当怎样）

| 依据 | 原文要点 |
|---|---|
| `.context/criterion.md:109` | MUST NOT：虚报成功（无客户端或执行失败时严禁返回成功） |
| `.context/architecture/source/technical_architecture.md:566` | **不得**谎报成功，也**不得**静默写本地假 ID |

### 实现（实际怎样）

| 位置 | 行为 |
|---|---|
| `src/injoys/client.ts:431`（`saveReviewDocument`） | 失败 / 未配置时 `catch {}` 后返回 `null` |
| `src/tools/index.ts:630` | `injoysDocId: report.injoysDocId ?? 'doc_review'` —— 为 `null` 时回退为字面量假编号 |
| `src/tools/index.ts:592` | `output.schema` 将 `injoysDocId` 声明为 `{ type: 'string', required: true }` |
| `src/tools/index.ts:599` | 该值被渲染进用户可见文案"**Injoys 文档编号**: \`...\`" |

### 影响

- 知识库未连通或写入失败时，向用户与 AI 会话播报一个**不存在的文档编号**；调用方无法区分"已沉淀"与"未沉淀"。
- `.context/domain/testing_strategy.md` 模块 8 场景 3「知识库未连通时……不得显示『沉淀成功』」在实现侧**必然失败**。

### 同类第二处：`ops_draft_launch_kit` / `saveLaunchKitDocument`

同一「编造假编号」模式还有一处，且更隐蔽（失败路径不返回 `null`，而是**编造带时间戳的编号**）：

| 位置 | 行为 |
|---|---|
| `src/injoys/client.ts:516`（`saveLaunchKitDocument`） | 返回类型为 **非空** `Promise<string>`；`catch` 后回退 `kit.injoysDocId ?? \`doc_launch_${Date.now()}\`` —— 用时间戳伪造编号 |
| `src/tools/index.ts:928`（`ops_draft_launch_kit`） | 生成阶段调用该写入方法（与 P0-1 同一处越权写入） |
| `src/tools/index.ts:907` | `injoysDocId: { type: 'string', required: true }` |
| `src/tools/index.ts:917` | 渲染进用户可见文案"**Injoys 文档编号**: \`...\`" |

因此 **TD-009 的登记同样不完整**（只覆盖 `ops_generate_review`，未覆盖 `ops_draft_launch_kit`）。

对照：`ops_draft_article`（`src/tools/index.ts:197`）与 `ops_draft_video_meta`（`:302`）**已正确**按可空处理（`value.docId ? ... : '*(未同步)*'`），是本批工具中做对的两个——可作修复时的参照实现。

### 建议修复方向（SSoT-first）

1. 将 `injoysDocId` 改为可空并取消 `required`（`ops_generate_review` 与 `ops_draft_launch_kit` 两处）。
2. 失败时如实返回"未沉淀"状态或抛错，不得回退占位编号；`saveLaunchKitDocument` 返回类型改为 `Promise<string | null>`，删除 `doc_launch_${Date.now()}` 兜底。
3. 补测试：`知识库未连通时不得返回成功文档编号`。

### 验收口径

- Injoys 未连通 / 写入失败时，工具不再返回任何文档编号，且不显示"沉淀成功"。

---

## 3. TD-011 错误码 `ops/not-found` 与 `ops/draft-not-found` 语义重复

**结论：不是运行期 bug，是 API/契约设计不一致（技术债）。**

### 证据

| 位置 | 错误码 | 语义 |
|---|---|---|
| `src/ops-rpc.ts:247`（`drafts.get`） | `ops/not-found` | `Draft not found` |
| `src/ops-rpc.ts:576`（`workbench.prefillDraft`） | `ops/draft-not-found` | `草稿不存在` |

两者表达同一语义"草稿不存在"。而 `.context/architecture/api_strategy.md:760`（AI 引用指南）明文要求：

> 错误码必须使用上方清单中的既有值，**不得自造语义相近的新码**。

现有两张清单（`api_strategy.md` §2.3 与 `cross_cutting_concepts.md`）均如实收录了这两个码，故不是"清单遗漏"，而是"清单内部重复"。

### 影响

- 调用方需同时处理两种"未找到"；削弱错误码目录的规范性。
- 不影响功能正确性。

### 建议修复方向（SSoT-first）

1. 在契约提案中统一为**单一"未找到"码**（建议保留 `ops/not-found`，将 `workbench.prefillDraft` 的 `ops/draft-not-found` 并入）。
2. 同步 `api_strategy.md` §2.3、`cross_cutting_concepts.md` 与调用方。
3. **不得在资产侧擅自改契约或删码**——须先走提案。

### 验收口径

- 全仓 `code:` 字面量集合中，"草稿不存在"语义仅对应一个错误码。

---

## 4. 与 `.context/` 登记项的对应关系

| 本文 | `.context` 登记 | 类型 | 严重性 |
|---|---|---|---|
| §1 P0-1（5 处写入站点） | `architecture/risks_and_debt.md` **TD-008** | 契约 / 实现债务 | 高 |
| §2 P0-2（`ops_generate_review` + `ops_draft_launch_kit` 2 处假编号） | `architecture/risks_and_debt.md` **TD-009** | 契约 / 实现债务 | 高 |
| §3 TD-011 | `architecture/risks_and_debt.md` **TD-011** | 契约 / 代码债务 | 低 |

> ⚠️ **已知覆盖缺口**：TD-008 仅登记 4 处写入站点（漏 `ops_draft_launch_kit`）；TD-009 仅登记 `ops_generate_review` 一处假编号（漏 `ops_draft_launch_kit` / `saveLaunchKitDocument`）。两处需在下次 `.context` 维护时补登（并同步 Manifest 与 history）。

相关但不在本文范围（已另行登记）：

- **TD-007** `workbench.overview` 缺失"部分缺失 → `null`"汇总语义。
- **TD-010** `calendar/` 与 `metrics/` 持久化契约未落地。
- **PD-006**（`domain/risks_and_debt.md`）PRD §5.5.1 中 3 个 `ops_*` 工具未实现且未按名登记。

覆盖闭环见 `.context/domain/testing_strategy.md` 的"风险覆盖对照（RISK ↔ 验收场景）"。

---

## 5. 修复前置：OpenSpec 资产尚未生成

按 `.context/openspec/integration.md` 的硬门禁，**当前不得创建变更提案**：

- `openspec/config.yaml` 缺失且登记在 `pending_generation` → 必须先"生成项目级 OpenSpec 集成"。
- `openspec/proposal-roadmap.md` 缺失 → 停止提案创建，不得把待生成路径当作已存在文件。

正确的解阻顺序：

| 序 | 命令 | 产出 |
|:--:|---|---|
| 1 | `.agent/workflows/context-openspec.md project` | `openspec/config.yaml` |
| 2 | `.agent/workflows/context-openspec.md plan` | `openspec/proposal-roadmap.md` |
| 3 | `.agent/workflows/context-openspec.md proposal <change-id>` | 变更提案（需 roadmap 中存在对应条目作为锚点） |

> 子命令模式为"只执行命中的那一个模块"的硬门禁，需逐个执行。

---

## 6. 建议的修复顺序（提案内）

按 `criterion §6` 的 SSoT-first 顺序，三者可并入**同一条**修复提案（同批接口 / 工具）：

```
src/types.ts（injoysDocId 可空等类型调整，如有）
    ↓
src/ops-rpc.ts（补 sinkToInjoysDoc 契约；统一错误码）
    ↓
src/tools/index.ts（工具 schema / 描述 / 去假编号）与 src/injoys/client.ts、src/analytics/
    ↓
测试 + .context 资产回填 + Manifest / history 刷新
```

优先级：P0-2（真 bug，可独立小修）≥ P0-1（越权写入，行为范围较大）> TD-011（设计一致性）。
