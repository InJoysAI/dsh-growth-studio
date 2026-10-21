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

- [x] 2.1 核验 API 层契约（`src/types.ts` + `src/ops-rpc.ts`）是否需要变更 → 结论：**SSoT 未更改**
  - 依据：`src/types.ts` 中 `ContentDraft.injoysDocId`（`:81`）、`ArticleDraft.injoysDocId`（`:131`）、`WeeklyReviewReport.injoysDocId`（`:273`）、`ProductHuntLaunchKit.injoysDocId`（`:318`）已全部为 `?: string | undefined` 可选形状；`api_strategy.md` §3.1 已声明 `GenerateArticleResponse.injoysDocId?: string` 且「不因生成而创建或填充」。本提案只删除写入**调用**，不新增或修改任何契约字段。
- [x] 2.2 按 `criterion.md` §7.2 运行 API 层校验命令：`pnpm typecheck`；并运行 `pnpm test`
  - §7.2 记录的 API 层「生成命令」为**无**（自研 RPC 信封，无 schema 源可生成，Codegen 无收益），故无 codegen 步骤；契约未变更，仍须运行校验命令以证明实现与既有契约一致。
- [x] 2.3 确认本提案不引入任何新的 RPC 方法或错误码（`injoys-write-boundary` 只约束既有方法的写入边界）

## 3. 移除未授权写入（5 处，只做减法）

- [x] 3.1 `src/ops-rpc.ts` `case 'workbench.generateArticleDraft'`：删除 `injoys.saveArticleDocument(...)` 调用，以及仅为回写 `injoysDocId` 而存在的第二次 `saveDraft`
  - 保留请求开始处的 `const articleStorageDir = actualDraftStore.getDirectory()` 与首次 `saveDraft(..., { dir: articleStorageDir })`（`criterion.md` §3.5 目录固定；不得在 `await` 之后重新解析目录）
  - 响应字段 `injoysDocId` 返回 `undefined`（契约本就可选，不因生成而填充）
- [x] 3.2 `src/tools/index.ts` `ops_draft_article`：删除 `injoys.saveArticleDocument(...)`，返回 `docId: undefined`（`output.schema.docId` 非 required）
  - 本地 `actualDraftStore.saveDraft(...)` 保留，`draftId` 与 `channelVariants` 不变
- [x] 3.3 `src/tools/index.ts` `ops_draft_video_meta`：删除 `injoys.saveVideoDocument(...)`，返回 `injoysDocId: undefined`（非 required）
  - 本地 `saveDraft(...)` 保留（含 `partition` 随变体持久化）
- [x] 3.4 `src/tools/index.ts` `ops_draft_launch_kit`：删除 `injoys.saveLaunchKitDocument(phKit)` 调用；`injoysDocId` 改返回**空串**，并在该行加注释指向 `fix-doc-id-fabrication`
  - 理由：`output.schema.injoysDocId` 仍为 `{ type: 'string', required: true }`，`defineTool` 会把 required 约束到 `execute` 返回类型；可空化属被依赖提案。**不得**为此编造任何编号，也不得在本提案改 schema
  - 保留既有的生成结果返回（`tagline` / `makerComment` / `twitterThread` / `timezoneAdvice` / `summaryMarkdown`）；**不新增草稿持久化**（Launch 物料持久化属其 Phase 2 能力，本提案只做减法，不暗中扩建）
- [x] 3.5 `src/analytics/review-reporter.ts` `generateReview`：删除 `await this.injoys.saveReviewDocument(report)` 与紧随的 `report.injoysDocId = docId` 回写块
  - `ops_generate_review` 中的 `report.injoysDocId ?? 'doc_review'` 回退**保持原样**（其移除属 `fix-doc-id-fabrication` 的 In 范围）；此为已登记的过渡态
- [x] 3.6 保持 `ReviewReporter` 构造函数签名 `constructor(private readonly injoys: InjoysClient)` 不变（`new ReviewReporter(injoys)` 调用点与既有测试不受影响），并确认删除调用后无残留未使用 import / 局部变量导致 `pnpm typecheck` 失败

## 4. 文案与债务登记同步

- [x] 4.1 修正 `src/tools/index.ts` 中与契约相悖的工具描述文案（`description` 字段）
  - `ops_draft_article`：`「……并保存为 Injoys 文档。」` → `「……并保存为本地草稿（写入 Injoys 文档须用户显式触发）。」`
  - `ops_generate_review`：`「……并沉淀至 Injoys 文档。」` → `「……生成周度 / 月度运营复盘总结并返回结果（写入 Injoys 文档须用户显式触发）。」`
  - **不得**把复盘的 `description` 写成「保存至本地草稿库」：复盘只生成并返回结果，不落盘（与 `spec.md` 的 Requirement 2 / 3 一致）；只有图文 / 视频类条目可声明保存至本地草稿库
  - 同轮复核 `ops_draft_video_meta` / `ops_draft_launch_kit` 的描述：二者未声称写入 Injoys 文档，无需改动
  - 门禁见 4.4（新文案不得命中 4.4 ① 的三个旧短语，但**允许**出现「写入 Injoys 文档须用户显式触发」）
- [x] 4.2 同轮补登 `.context/architecture/risks_and_debt.md` 的 **TD-008**，并同步其追踪看板行，使「描述 / 影响 / 看板」三处一致
  - 「描述」与「影响」补第 5 处站点：`src/tools/index.ts` 的 `ops_draft_launch_kit`（经 `InjoysClient.saveLaunchKitDocument` → `document.create`），站点数由 4 处 → 5 处
  - 追踪看板行（`risks_and_debt.md:426`）的「状态」列由 `待处理（优先）` 改为如实状态：`部分修复（2026-10-21，站点清单已补齐、写入调用已移除；唯一授权入口 workbench.sinkToInjoysDoc 待 Phase 2）`，「更新日期」列同步为 2026-10-21
  - 核验方式：`grep -n "TD-008" .context/architecture/risks_and_debt.md` **只用于定位**（命中的是标题行与看板行），不足以证明正文已列 5 处站点；须**读取完整 TD-008 条目**（`:288`–`:298`）逐项核对 5 处站点（`src/ops-rpc.ts:425`、`src/tools/index.ts:231`、`:324`、`:933`、`src/analytics/review-reporter.ts:92`）
  - 经 `.agents/workflows/context-update.md` 刷新 `.context/context-manifest.json` 与 `.context/history/context-sync.jsonl`
  - 不改 TD-008 的「解决方案」中「先补齐 `workbench.sinkToInjoysDoc`」这一项（其实现属 Phase 2，且该「先补齐」顺序与路线图拆分的差异见 `proposal.md` 的「上游规划差异」说明）；也不把 TD-008 标为完全「已修复」（唯一授权入口尚未实现）
  - **不**改 `.context/architecture/api_strategy.md` §3.10 工具表的「现状」列（含 A4 负责的「假编号回退（TD-009）」行）：该表的现状同步须并入 A4 的**同一交付组合**完成（见 6.4 交付门禁），本提案**不**在该表留下半更新状态；此结论已在 `proposal.md` 风险表登记
- [x] 4.3 修正 `README.md` 中与修复后行为直接矛盾的 3 处表述（与 4.1 同源缺陷：对外文案把「写入 Injoys 文档」描述为生成的副作用）
  - `README.md:24`「将图文底稿存入 Injoys 文档」→ 改为「将图文底稿保存至本地草稿库」
  - `README.md:27`「输出复盘报告沉淀至 Injoys 文档」→ 改为「生成并返回复盘报告（写入 Injoys 文档须用户显式触发）」（**不得**写成「保存至本地草稿库」——复盘不落盘）
  - `README.md:39`（`ops_draft_article` 行）「存入 Injoys 文档」→ 改为「保存至本地草稿库」
  - 边界：相对大纲 In 中「修正 `src/tools/index.ts` 中与契约相悖的工具描述文案」一条（`openspec/proposal-roadmap-Phase-0.md:215`）的最小扩充，理由与偏差说明见 `proposal.md` 的「提案大纲对齐」`in_scope` 行；`README.md:28`（需求池 / FAQ）与 `:61`（Launch Kit 沉淀）不在本次范围
- [x] 4.4 文案门禁（4.1 / 4.3 共用；须与 `spec.md` 的 Requirement 3 语义一致，不得用原始短语一刀切，避免「建议文案命中禁词」的自相矛盾）
  - ① 旧表述消失：`grep -n "保存为 Injoys 文档\|存入 Injoys 文档\|沉淀至 Injoys 文档" src/tools/index.ts README.md` 为空
  - ② 正面表述存在（**按入口区分落盘承诺**）：图文 / 视频条目（`ops_draft_article` 的 `description`、`README.md:24` / `:39`）须说明产物保存至本地草稿库；复盘条目（`ops_generate_review` 的 `description`、`README.md:27`）须说明生成并返回结果，**不得**承诺本地草稿文件已保存
  - ③ 语义人工核对：新文案不得把写入 Injoys 文档描述为生成的副作用；**允许**出现「写入 Injoys 文档须用户显式触发」这类授权边界说明（不等价于禁词），也不得扩大到表格 / 需求池 / 海外功能介绍

## 5. 测试

> 说明：5.1–5.4 的改写与新增用例须沿用 `tests/setup-isolation.ts` 提供的临时 `$DSH_HOME`（`vitest.config.ts` 的 `setupFiles`），不得写开发者真实目录（`criterion.md` §3.5 MUST NOT）。

- [x] 5.1 改写既有用例「drafts WeChat article and saves to Injoys via ops_draft_article tool」（`tests/ops-manager.spec.ts:158`）
  - 改为「生成图文后**不**发出 `document.create`」：用调用记录 mock `injoys.invokeTool`（沿用该文件既有的 `injoys.invokeTool = async (name) => {...}` 写法），断言**工具名序列不含 `document.create`**
  - 断言 `result.docId` 为 `undefined`、`result.title` 与 `result.wordCount` 仍正确
- [x] 5.2 新增通用用例「未显式触发时不写远端」：在一次用例内依次调用 `workbench.generateArticleDraft`（经 RPC）、`ops_draft_article`、`ops_draft_video_meta`、`ops_generate_review`，用调用记录 mock `injoys.invokeTool`
  - 断言口径：**工具名序列不含 `document.create`**（不得断言「远端工具调用总数为 0」——`workbench.generateArticleDraft` / `ops_draft_article` / `ops_draft_video_meta` 会先经 `injoys.getKnowledgeContext(...)` 调用只读的 `knowledge.list`，见 `src/injoys/client.ts:250`；按「总数为 0」断言必然误杀）
  - **按入口分开取证，不得混用**：
    - `workbench.generateArticleDraft` / `ops_draft_article` / `ops_draft_video_meta`：三条内容路径各自仍有本地落盘（`src/ops-rpc.ts:407`；`src/tools/index.ts:239`、`:333`），须断言草稿文件真实产生（文件断言）
    - `ops_generate_review`：只采集指标并调用 reporter（`src/tools/index.ts:612`、`:616`），**不落盘、不读取知识库**——不得要求它产生草稿文件或 `knowledge.list` 调用；只断言「无 `document.create`」且复盘结果字段照常返回
  - 知识库只读调用只针对**实际读取**的路径断言（上面前三条 + `ops_draft_launch_kit`），不得笼统称为「四条路径都读取知识库」
- [x] 5.3 新增海外 Launch 专项用例（覆盖 TD-008 未登记的第 5 处站点）：`ops_draft_launch_kit` 生成后无 `document.create`
  - 本轮口径：**不写远端 + 保留既有生成结果返回**（`tagline` / `makerComment` / `twitterThread` / `timezoneAdvice` / `summaryMarkdown`），且**不新增草稿持久化**（Launch 物料持久化属其 Phase 2 能力，本提案只做减法，见 `proposal.md` 的 Out of Scope）；用例不得断言 Launch 产生草稿文件
  - 断言 `expect(result.injoysDocId).toBe('')`，并加注释「`src/tools/index.ts:912` 仍为 `required: string`，实现只能返回字符串；A4（`fix-doc-id-fabrication`）落地后改为 `toBeUndefined()`」
  - **不得**写 `toBeUndefined()`：`output.schema` 的 `required: true` 经 `defineTool` 约束的是 **`execute` 实现返回值类型**（`node_modules/@deepseek-ai/dsh-tools/lib/types/schema.d.ts:210`），实现无法返回 `undefined`，故该断言断言的是实现不可能产生的值。（注意：`pnpm typecheck` 只覆盖 `src`（`tsconfig.json` 的 `include` 仅 `src`），测试文件的断言能否编译与此无关——不要以「typecheck 会失败」作为理由）
  - 渲染分支（`src/tools/index.ts:922` 无 `value.injoysDocId ? ...` 判定）属 A4 的收口范围，本用例不新增渲染断言
- [x] 5.4 修正既有断言以匹配新行为
  - `tests/ops-manager.spec.ts:341` 的 `expect(report.injoysDocId).toBeDefined()` → `toBeUndefined()`（复盘不再回写编号）
  - `tests/ops-manager.spec.ts:644` 的 `expect(result.injoysDocId).toBeDefined()` → `toBe('')`（与 5.3 同一过渡态口径）
  - `tests/ops-manager.spec.ts:2298` 的 `(injoys as any).saveArticleDocument = async () => undefined` 桩改为「记录调用 + 显式断言未调用」：`let articleSaves = 0`，桩体改为 `async () => { articleSaves += 1; return 'unexpected' }`，并在该用例末尾断言 `expect(articleSaves).toBe(0)`
    - 理由：该桩位于 `U2: 图文生成在知识库等待期间切换目录，不得产生双库副本` 用例中（`:2291` 配置了不可达 endpoint `http://127.0.0.1:1/mcp`）。删除 3.1 的调用点后该桩已不可达，**不会**因此产生真实网络请求；改为显式断言既不触网，又能防止「未来误加回该调用」，比直接删除多一条防回归证据
  - **不新增**目录固定（RISK-004）回归用例：既有 `U2` 用例（`tests/ops-manager.spec.ts:2261`）已在 `getKnowledgeContext` 等待期间切换目录并断言「整个请求留在发起时的 A 库、B 库无副本」，即 RISK-004 的自动化证据；本提案只须保证该用例继续通过（见 6.3.2），不重复建设
    - 证据范围**仅限 RPC 图文**（`workbench.generateArticleDraft`）；**不得**据此声称工具图文 / 视频或 Launch 也具备同样的目录固定语义（见 6.3.2 的如实声明）

## 6. 验证与归档

- [x] 6.1 验证验收标准
  - [x] 6.1.1 生成路径不写远端：`workbench.generateArticleDraft` / `ops_draft_article` / `ops_draft_video_meta` / `ops_draft_launch_kit` 四处的单元测试通过；前三条另有草稿文件断言，Launch 只断言「无远端写入 + 生成结果保留」（不要求落盘）
  - [x] 6.1.2 复盘路径不写远端：`ReviewReporter.generateReview` / `ops_generate_review` 用例通过（含「不新增草稿文件」与「复盘结果照常返回」两项）
  - [x] 6.1.3 文案一致：`ops_draft_article` 与 `ops_generate_review` 的 `description`、以及 `README.md` 均不再出现「保存为 Injoys 文档」「存入 Injoys 文档」「沉淀至 Injoys 文档」；且**按入口区分落盘承诺**——图文 / 视频条目说明保存至本地草稿库，复盘条目只说明生成并返回结果（不得声称落盘），两者均说明写入 Injoys 文档须用户显式触发（见 4.4 的三步门禁）
  - [x] 6.1.4 能力保留：`InjoysClient.saveArticleDocument` / `saveVideoDocument` / `saveReviewDocument` / `saveLaunchKitDocument` 四个方法仍存在且可被显式调用
- [x] 6.2 运行 `pnpm typecheck` 与 `pnpm test`，两者全部通过
- [x] 6.3 代码审查
  - [x] 6.3.1 `grep` 确认 `src/` 内生成 / 复盘 / 海外 Launch 路径不再出现 `saveArticleDocument` / `saveVideoDocument` / `saveReviewDocument` / `saveLaunchKitDocument` 的**调用点**（仅 `src/injoys/client.ts` 的**定义**保留）
  - [x] 6.3.2 确认目录固定语义未被破坏，**按证据范围如实声明、不得扩大**：只有 RPC 图文由既有 `U2: 图文生成在知识库等待期间切换目录，不得产生双库副本` 用例（`tests/ops-manager.spec.ts:2261`）证明（RISK-004）；工具图文 / 视频在 `await getKnowledgeContext` **之后**才以默认目录调用 `saveDraft`（`src/tools/index.ts:205`→`:239`、`:310`→`:333`），**不经**请求开始处的目录捕获，属**既有未覆盖面**；`ops_draft_launch_kit` 无落盘。本提案不新增目录机制，只如实标注该未覆盖面
  - [x] 6.3.3 确认未新增远端写入、未绕过 `InjoysClient` 直连、未改动客户端代码
- [x] 6.4 交付门禁（用户可用版本）：确认本提案**不**单独作为用户可用交付发布，而须与 `fix-doc-id-fabrication`（A4）构成同一交付组合
  - 组合内容：A3 的 5 处写入移除 + A4 的两处 `injoysDocId` 可空化并取消 `output.schema.required` + 移除 `?? 'doc_review'` 回退 + 修正 `ops_draft_launch_kit`（`src/tools/index.ts:922`）与 `ops_generate_review`（`:604`）的空值渲染 + 并入 `api_strategy.md` §3.10 现状列同步（`:752`–`:754`、`:758`）
  - 组合验收：**正常路径 / 知识库未连通 / 写入失败**三种情形均不出现 `doc_review` 或 `doc_launch_<时间戳>` 形式的编号，未沉淀时呈现「未沉淀」语义
  - 理由：本提案单独交付会使 `ops_generate_review` 在正常路径必然命中 `?? 'doc_review'`（`src/tools/index.ts:635`），即把 `criterion.md:109` 的虚报成功从失败路径偶发扩大为正常路径恒发；登记该风险不构成对 MUST NOT 的豁免（见 `proposal.md` 的「交付门禁（用户可用版本）」）
- [x] 6.5 运行 node design/context-dev/tools/specflow/specflow.mjs validate fix-unauthorized-injoys-doc-write --strict
- [ ] 6.6 运行 node design/context-dev/tools/specflow/specflow.mjs archive fix-unauthorized-injoys-doc-write --yes --no-validate
  - 仅在 6.5 通过后执行；归档是流程动作，**不**代表已满足 `criterion.md:109`（该满足条件由 6.4 的交付组合界定）
