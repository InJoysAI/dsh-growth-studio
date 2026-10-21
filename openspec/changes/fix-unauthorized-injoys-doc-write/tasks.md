<!-- change_kind: code -->
# 实施任务清单

## 1. Roadmap 对齐

| # | roadmap 关键任务 | 对应任务 |
|---|------------------|----------|
| 1 | 定位并移除生成路径的无条件 `document.create` 调用（`workbench.generateArticleDraft`、`ops_draft_article`、`ops_draft_video_meta`、`ops_draft_launch_kit`，共 4 处） | 3.1、3.2、3.3、3.4 |
| 2 | 移除 `review-reporter.ts` 复盘路径的无条件 `saveReviewDocument` 调用 | 3.5、3.6 |
| 3 | 修正 `src/tools/index.ts` 工具描述文案使之与契约一致，并补登 TD-008 第 5 处站点 | 4.1、4.2 |
| 4 | 补测试：「未显式触发时无远端写入」（1 条通用 + 1 条覆盖海外 Launch 生成路径） | 5.1、5.2、5.3、5.4 |

## 2. SSoT 先行/检查

- [ ] 2.1 核验 API 层契约（`src/types.ts` + `src/ops-rpc.ts`）是否需要变更 → 结论：**SSoT 未更改**
  - 依据：`src/types.ts` 中 `ContentDraft.injoysDocId`（`:81`）、`ArticleDraft.injoysDocId`（`:131`）、`WeeklyReviewReport.injoysDocId`（`:273`）、`ProductHuntLaunchKit.injoysDocId`（`:318`）已全部为 `?: string | undefined` 可选形状；`api_strategy.md` §3.1 已声明 `GenerateArticleResponse.injoysDocId?: string` 且「不因生成而创建或填充」。本提案只删除写入**调用**，不新增或修改任何契约字段。
- [ ] 2.2 按 `criterion.md` §7.2 运行 API 层校验命令：`pnpm typecheck`；并运行 `pnpm test`
  - §7.2 记录的 API 层「生成命令」为**无**（自研 RPC 信封，无 schema 源可生成，Codegen 无收益），故无 codegen 步骤；契约未变更，仍须运行校验命令以证明实现与既有契约一致。
- [ ] 2.3 确认本提案不引入任何新的 RPC 方法或错误码（`injoys-write-boundary` 只约束既有方法的写入边界）

## 3. 移除未授权写入（5 处，只做减法）

- [ ] 3.1 `src/ops-rpc.ts` `case 'workbench.generateArticleDraft'`：删除 `injoys.saveArticleDocument(...)` 调用，以及仅为回写 `injoysDocId` 而存在的第二次 `saveDraft`
  - 保留请求开始处的 `const articleStorageDir = actualDraftStore.getDirectory()` 与首次 `saveDraft(..., { dir: articleStorageDir })`（`criterion.md` §3.5 目录固定；不得在 `await` 之后重新解析目录）
  - 响应字段 `injoysDocId` 返回 `undefined`（契约本就可选，不因生成而填充）
- [ ] 3.2 `src/tools/index.ts` `ops_draft_article`：删除 `injoys.saveArticleDocument(...)`，返回 `docId: undefined`（`output.schema.docId` 非 required）
  - 本地 `actualDraftStore.saveDraft(...)` 保留，`draftId` 与 `channelVariants` 不变
- [ ] 3.3 `src/tools/index.ts` `ops_draft_video_meta`：删除 `injoys.saveVideoDocument(...)`，返回 `injoysDocId: undefined`（非 required）
  - 本地 `saveDraft(...)` 保留（含 `partition` 随变体持久化）
- [ ] 3.4 `src/tools/index.ts` `ops_draft_launch_kit`：删除 `injoys.saveLaunchKitDocument(phKit)` 调用；`injoysDocId` 改返回**空串**，并在该行加注释指向 `fix-doc-id-fabrication`
  - 理由：`output.schema.injoysDocId` 仍为 `{ type: 'string', required: true }`，`defineTool` 会把 required 约束到 `execute` 返回类型；可空化属被依赖提案。**不得**为此编造任何编号，也不得在本提案改 schema
- [ ] 3.5 `src/analytics/review-reporter.ts` `generateReview`：删除 `await this.injoys.saveReviewDocument(report)` 与紧随的 `report.injoysDocId = docId` 回写块
  - `ops_generate_review` 中的 `report.injoysDocId ?? 'doc_review'` 回退**保持原样**（其移除属 `fix-doc-id-fabrication` 的 In 范围）；此为已登记的过渡态
- [ ] 3.6 保持 `ReviewReporter` 构造函数签名 `constructor(private readonly injoys: InjoysClient)` 不变（`new ReviewReporter(injoys)` 调用点与既有测试不受影响），并确认删除调用后无残留未使用 import / 局部变量导致 `pnpm typecheck` 失败

## 4. 文案与债务登记同步

- [ ] 4.1 修正 `src/tools/index.ts` 中与契约相悖的工具描述文案（`description` 字段）
  - `ops_draft_article`：「……并保存为 Injoys 文档。」→ 明确产物只保存到本地草稿库
  - `ops_generate_review`：「……并沉淀至 Injoys 文档。」→ 明确只生成本地复盘，沉淀至 Injoys 文档须用户显式触发
  - 同轮复核 `ops_draft_video_meta` / `ops_draft_launch_kit` 的描述：二者未声称写入 Injoys 文档，无需改动
- [ ] 4.2 同轮补登 `.context/architecture/risks_and_debt.md` 的 **TD-008**：在「描述」与「影响」中补第 5 处站点 `src/tools/index.ts` 的 `ops_draft_launch_kit`（经 `InjoysClient.saveLaunchKitDocument` → `document.create`），使债务站点清单与实现一致（由 4 处 → 5 处）
  - 经 `.agents/workflows/context-update.md` 刷新 `.context/context-manifest.json` 与 `.context/history/context-sync.jsonl`
  - 不改 TD-008 的「解决方案」中「先补齐 `workbench.sinkToInjoysDoc`」这一项（其实现属 Phase 2）
  - **不**改 `.context/architecture/api_strategy.md` §3.10 工具表的「现状」列（含 A4 负责的「假编号回退（TD-009）」行），该表的现状同步归后续 `context-update` / `context-check` 轮次，已在 `proposal.md` 风险表中登记

## 5. 测试

- [ ] 5.1 改写既有用例「drafts WeChat article and saves to Injoys via ops_draft_article tool」（`tests/ops-manager.spec.ts:158`）
  - 改为「生成图文后**不**发出 `document.create`」：用调用记录 mock `injoys.invokeTool`，断言工具名序列不含 `document.create`
  - 断言 `result.docId` 为 `undefined`、`result.title` 与 `result.wordCount` 仍正确
- [ ] 5.2 新增通用用例「未显式触发时不写远端」：在一次用例内依次调用 `workbench.generateArticleDraft`、`ops_draft_article`、`ops_draft_video_meta`、`ops_generate_review`，断言四次调用期间远端工具调用总数为 0，且四次调用的本地草稿均落盘
- [ ] 5.3 新增海外 Launch 专项用例：`ops_draft_launch_kit` 生成后无 `document.create`（覆盖 TD-008 未登记的第 5 处站点），并断言 `injoysDocId` 不是任何编号（空值语义）
- [ ] 5.4 修正既有断言以匹配新行为
  - `tests/ops-manager.spec.ts:341` 的 `expect(report.injoysDocId).toBeDefined()` → `toBeUndefined()`（复盘不再回写编号）
  - `tests/ops-manager.spec.ts:644` 的 `expect(result.injoysDocId).toBeDefined()` → 断言未沉淀（空串）
  - 删除 `tests/ops-manager.spec.ts:2298` 为 `saveArticleDocument` 打的桩（移除调用后已不可达）

## 6. 验证与归档

- [ ] 6.1 验证验收标准
  - [ ] 6.1.1 生成路径不写远端：`workbench.generateArticleDraft` / `ops_draft_article` / `ops_draft_video_meta` / `ops_draft_launch_kit` 四处的单元测试通过
  - [ ] 6.1.2 复盘路径不写远端：`ReviewReporter.generateReview` / `ops_generate_review` 用例通过
  - [ ] 6.1.3 文案一致：`ops_draft_article` 与 `ops_generate_review` 的 `description` 不再出现「保存为 Injoys 文档」「沉淀至 Injoys 文档」
  - [ ] 6.1.4 能力保留：`InjoysClient.saveArticleDocument` / `saveVideoDocument` / `saveReviewDocument` / `saveLaunchKitDocument` 四个方法仍存在且可被显式调用
- [ ] 6.2 运行 `pnpm typecheck` 与 `pnpm test`，两者全部通过
- [ ] 6.3 代码审查
  - [ ] 6.3.1 `grep` 确认 `src/` 内生成 / 复盘 / 海外 Launch 路径不再出现 `saveArticleDocument` / `saveVideoDocument` / `saveReviewDocument` / `saveLaunchKitDocument` 的**调用点**（仅 `src/injoys/client.ts` 的**定义**保留）
  - [ ] 6.3.2 确认四条生成路径的本地落盘与目录固定语义未变（请求开始时捕获目录、无中途重新解析）
  - [ ] 6.3.3 确认未新增远端写入、未绕过 `InjoysClient` 直连、未改动客户端代码
- [ ] 6.4 运行 node design/context-dev/tools/specflow/specflow.mjs validate fix-unauthorized-injoys-doc-write --strict
- [ ] 6.5 运行 node design/context-dev/tools/specflow/specflow.mjs archive fix-unauthorized-injoys-doc-write --yes --no-validate
  - 仅在 6.4 通过后执行
