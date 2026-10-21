<!-- change_kind: code -->
# 实施任务清单

## 1. Roadmap 对齐

| # | roadmap 关键任务 | 对应任务 |
|---|------------------|----------|
| 1 | 定位并移除生成路径的无条件 `document.create` 调用（`workbench.generateArticleDraft`、`ops_draft_article`、`ops_draft_video_meta`、`ops_draft_launch_kit`，共 4 处） | 3.1、3.2、3.3、3.4 |
| 2 | 移除 `review-reporter.ts` 复盘路径的无条件 `saveReviewDocument` 调用 | 3.5、3.6 |
| 3 | 修正 `src/tools/index.ts` 工具描述文案使之与契约一致，并补登 TD-008 第 5 处站点 | 4.1、4.2、4.3 |
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
- [ ] 4.2 同轮补登 `.context/architecture/risks_and_debt.md` 的 **TD-008**，并同步其追踪看板行，使「描述 / 影响 / 看板」三处一致
  - 「描述」与「影响」补第 5 处站点：`src/tools/index.ts` 的 `ops_draft_launch_kit`（经 `InjoysClient.saveLaunchKitDocument` → `document.create`），站点数由 4 处 → 5 处
  - 追踪看板行（`risks_and_debt.md:426`）的「状态」列由 `待处理（优先）` 改为如实状态：`部分修复（2026-10-21，站点清单已补齐、写入调用已移除；唯一授权入口 workbench.sinkToInjoysDoc 待 Phase 2）`，「更新日期」列同步为 2026-10-21
  - 同轮核验 `grep -n "TD-008" .context/architecture/risks_and_debt.md` 显示 5 处站点齐备
  - 经 `.agents/workflows/context-update.md` 刷新 `.context/context-manifest.json` 与 `.context/history/context-sync.jsonl`
  - 不改 TD-008 的「解决方案」中「先补齐 `workbench.sinkToInjoysDoc`」这一项（其实现属 Phase 2）；也不把 TD-008 标为完全「已修复」（唯一授权入口尚未实现）
  - **不**改 `.context/architecture/api_strategy.md` §3.10 工具表的「现状」列（含 A4 负责的「假编号回退（TD-009）」行）：该表的现状同步须由 A4 合入后的 `context-update` 轮次一并完成，本提案**不**在该表留下半更新状态；此结论已在 `proposal.md` 风险表登记
- [ ] 4.3 修正 `README.md` 中与修复后行为直接矛盾的 3 处表述（与 4.1 同源缺陷：对外文案把「沉淀至 Injoys 文档」描述为生成的副作用）
  - `README.md:24`「将图文底稿存入 Injoys 文档」→ 改为「保存至本地草稿库」
  - `README.md:27`「输出复盘报告沉淀至 Injoys 文档」→ 改为「生成本地复盘报告（沉淀至 Injoys 文档须用户显式触发）」
  - `README.md:39`（`ops_draft_article` 行）「存入 Injoys 文档」→ 改为「保存至本地草稿库」
  - 验收：`grep -n "存入 Injoys 文档\|沉淀至 Injoys 文档" README.md` 为空；README 与 `src/tools/index.ts` 的 `description` 口径一致
  - 边界：相对大纲 In ③（只点名 `src/tools/index.ts`）的最小扩充，理由与偏差说明见 `proposal.md` 的「提案大纲对齐」`in_scope` 行；`README.md:28`（需求池 / FAQ）与 `:61`（Launch Kit 沉淀）不在本次范围

## 5. 测试

> 说明：5.1–5.4 的改写与新增用例须沿用 `tests/setup-isolation.ts` 提供的临时 `$DSH_HOME`（`vitest.config.ts` 的 `setupFiles`），不得写开发者真实目录（`criterion.md` §3.5 MUST NOT）。

- [ ] 5.1 改写既有用例「drafts WeChat article and saves to Injoys via ops_draft_article tool」（`tests/ops-manager.spec.ts:158`）
  - 改为「生成图文后**不**发出 `document.create`」：用调用记录 mock `injoys.invokeTool`（沿用该文件既有的 `injoys.invokeTool = async (name) => {...}` 写法），断言**工具名序列不含 `document.create`**
  - 断言 `result.docId` 为 `undefined`、`result.title` 与 `result.wordCount` 仍正确
- [ ] 5.2 新增通用用例「未显式触发时不写远端」：在一次用例内依次调用 `workbench.generateArticleDraft`、`ops_draft_article`、`ops_draft_video_meta`、`ops_generate_review`
  - 断言口径：**工具名序列不含 `document.create`**（不得断言「远端工具调用总数为 0」——四条路径都会先经 `injoys.getKnowledgeContext(...)` 调用只读的 `knowledge.list`，见 `src/injoys/client.ts:250`；按「总数为 0」断言必然误杀）
  - 同时断言 `knowledge.list` 等只读调用**可以**正常发生（知识库读取不受写入边界限制），且四次调用的本地草稿均落盘
- [ ] 5.3 新增海外 Launch 专项用例（覆盖 TD-008 未登记的第 5 处站点）：`ops_draft_launch_kit` 生成后无 `document.create`
  - 断言 `expect(result.injoysDocId).toBe('')`，并加注释「该字段在 `src/tools/index.ts:912` 仍为 `required: string`，故只能为空串；A4（`fix-doc-id-fabrication`）落地后改为 `toBeUndefined()`」
  - **不得**写 `toBeUndefined()`：`output.schema` 的 `required: true` 经 `defineTool` 约束 `execute` 返回类型为 `string`，该断言在 `pnpm typecheck` 下不成立
  - 渲染分支（`src/tools/index.ts:922` 无 `value.injoysDocId ? ...` 判定）属 A4 的收口范围，本用例不新增渲染断言
- [ ] 5.4 修正既有断言以匹配新行为
  - `tests/ops-manager.spec.ts:341` 的 `expect(report.injoysDocId).toBeDefined()` → `toBeUndefined()`（复盘不再回写编号）
  - `tests/ops-manager.spec.ts:644` 的 `expect(result.injoysDocId).toBeDefined()` → `toBe('')`（与 5.3 同一过渡态口径）
  - `tests/ops-manager.spec.ts:2298` 的 `(injoys as any).saveArticleDocument = async () => undefined` 桩改为「记录调用 + 显式断言未调用」：`let articleSaves = 0`，桩体改为 `async () => { articleSaves += 1; return 'unexpected' }`，并在该用例末尾断言 `expect(articleSaves).toBe(0)`
    - 理由：该桩位于 `U2: 图文生成在知识库等待期间切换目录，不得产生双库副本` 用例中（`:2291` 配置了不可达 endpoint `http://127.0.0.1:1/mcp`）。删除 3.1 的调用点后该桩已不可达，**不会**因此产生真实网络请求；改为显式断言既不触网，又能防止「未来误加回该调用」，比直接删除多一条防回归证据
  - **不新增**目录固定（RISK-004）回归用例：既有 `U2` 用例（`tests/ops-manager.spec.ts:2261`）已在 `getKnowledgeContext` 等待期间切换目录并断言「整个请求留在发起时的 A 库、B 库无副本」，即 RISK-004 的自动化证据；本提案只须保证该用例继续通过（见 6.3.2），不重复建设

## 6. 验证与归档

- [ ] 6.1 验证验收标准
  - [ ] 6.1.1 生成路径不写远端：`workbench.generateArticleDraft` / `ops_draft_article` / `ops_draft_video_meta` / `ops_draft_launch_kit` 四处的单元测试通过
  - [ ] 6.1.2 复盘路径不写远端：`ReviewReporter.generateReview` / `ops_generate_review` 用例通过
  - [ ] 6.1.3 文案一致：`ops_draft_article` 与 `ops_generate_review` 的 `description` 不再出现「保存为 Injoys 文档」「沉淀至 Injoys 文档」；`README.md` 亦不再出现「存入 Injoys 文档」「沉淀至 Injoys 文档」（`grep -n` 为空）
  - [ ] 6.1.4 能力保留：`InjoysClient.saveArticleDocument` / `saveVideoDocument` / `saveReviewDocument` / `saveLaunchKitDocument` 四个方法仍存在且可被显式调用
- [ ] 6.2 运行 `pnpm typecheck` 与 `pnpm test`，两者全部通过
- [ ] 6.3 代码审查
  - [ ] 6.3.1 `grep` 确认 `src/` 内生成 / 复盘 / 海外 Launch 路径不再出现 `saveArticleDocument` / `saveVideoDocument` / `saveReviewDocument` / `saveLaunchKitDocument` 的**调用点**（仅 `src/injoys/client.ts` 的**定义**保留）
  - [ ] 6.3.2 确认四条生成路径的本地落盘与目录固定语义未变（请求开始时捕获目录、无中途重新解析），以既有 `U2: 图文生成在知识库等待期间切换目录，不得产生双库副本` 用例（`tests/ops-manager.spec.ts:2261`）为自动化证据（RISK-004）
  - [ ] 6.3.3 确认未新增远端写入、未绕过 `InjoysClient` 直连、未改动客户端代码
- [ ] 6.4 运行 node design/context-dev/tools/specflow/specflow.mjs validate fix-unauthorized-injoys-doc-write --strict
- [ ] 6.5 运行 node design/context-dev/tools/specflow/specflow.mjs archive fix-unauthorized-injoys-doc-write --yes --no-validate
  - 仅在 6.4 通过后执行
