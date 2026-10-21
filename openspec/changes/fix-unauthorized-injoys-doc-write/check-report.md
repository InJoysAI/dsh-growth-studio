# fix-unauthorized-injoys-doc-write 修订复核

复核日期：2026-10-21。**当前综合结论：MODIFY；未关闭项 P0：0、P1：2、P2：1。** 下文首轮快照中的 P0：1 / P1：4 / P2：2 是历史数量，不是本次数量。当前结论以本节为准；历史引用按首轮文件版本解释，不可用来定位修订后提案的新行号。

## A. 本轮范围与实测

本轮核查用户修订后的三个工件、既有源码、指定大纲条目和工作流权限解释，唯一写入仍为本报告，未修改任何其他项目文件。用户所称“17 处”为语义修改计数，未作为机器校验指标；实际 git diff 为三份工件 88 行新增、48 行删除。三个工件无 check-report 引用、无双花括号占位符；spec 实测为 **4 Requirement / 8 Scenario**（`openspec/changes/fix-unauthorized-injoys-doc-write/specs/injoys-write-boundary/spec.md:3`、`:41`、`:54`、`:72`）。

| 本轮重新执行的命令 | 退出码 | 结果 |
|---|---:|---|
| `pnpm typecheck` | 0 | 通过，校验既有 src，不表示测试文件参与编译 |
| `pnpm test` | 0 | 8 个文件、132 个用例通过；既有 BrowserOS 未注册提示无失败 |
| `node design/context-dev/tools/specflow/specflow.mjs validate fix-unauthorized-injoys-doc-write --strict` | 0 | OK |
| `node design/context-dev/tools/specflow/specflow.mjs status fix-unauthorized-injoys-doc-write` | 0 | ArtifactsComplete=yes；ExecutionComplete=no，0/30；design 未创建 |
| `node design/context-dev/tools/specflow/specflow.mjs roadmap-status --check` | 0 | 状态与 change 目录一致 |

源码尚未实施删除，因此本次全绿是现有实现基线与提案格式校验，不是修复代码或交付门禁已通过的证明（`openspec/changes/fix-unauthorized-injoys-doc-write/tasks.md:23`、`:99` 仍为未完成任务；`src/tools/index.ts:635` 仍有回退）。

## B. 原问题逐条复核与关闭状态

| 原问题 | 当前判定 | 修订后具体证据 |
|---|---|---|
| Q-01 / M-1（原 P0） | **正文 P0 已关闭**；大纲传播纳入 R-02 | `openspec/changes/fix-unauthorized-injoys-doc-write/proposal.md:77` 明确同一用户可用版本，`:79` 区分归档和交付，`:80` 包含两工具空值渲染与 §3.10 同步，`:81` 覆盖三情形，`:82` 明确登记不豁免 MUST NOT；`tasks.md:99`–`:105` 有可执行门禁。该方案满足首轮推荐，不要求 A4 前移或合并提案职责 |
| Q-02 / M-2（原 P1） | **主体修复，仍部分未关闭，见 R-01** | `openspec/changes/fix-unauthorized-injoys-doc-write/tasks.md:68`–`:73` 分开三条落盘与复盘返回；`:75` Launch 不新增持久化；`:77` 正确解释 required 与 typecheck；`:85`、`:97` 限定 U2 范围；`:47` 修正 grep 仅定位。spec `:15` 与 `:23` 分开视频工具/RPC。但 spec 的文案要求仍把复盘说成保存到草稿库 |
| Q-03 / M-3（原 P1） | **原先“建议句命中禁词”的矛盾已关闭**；文案真实性归 R-01，大纲同步归 R-02 | `openspec/changes/fix-unauthorized-injoys-doc-write/tasks.md:40`、`:41`、`:53` 改用“写入 Injoys 文档须用户显式触发”，不会命中 `:57` 的三个旧短语；`:59` 加人工语义核对。`specs/injoys-write-boundary/spec.md:56` 允许授权边界说明。`:56` 虽说“不一刀切”、`:57` 实际仍用短语 grep，但已选定不命中短语的新措辞，原先不可同时满足的问题不再存在，无需反复要求改 grep 方案 |
| Q-04 / M-4（原 P1） | **正文部分已关闭，大纲部分未关闭，归 R-02** | `openspec/changes/fix-unauthorized-injoys-doc-write/proposal.md:57` 明确 AI 不可用/重试/内容不完整不扩建，保留保存失败传播；`:112` 保留 RISK-004 与 U2 决定。但 `openspec/proposal-roadmap-Phase-0.md:243` 风险表仍无 RISK-004，`:219`–`:221` Out 仍未细分上述异常 |
| Q-05 / M-5（原 P1） | **正文披露已关闭，源规划差异仍存在，不另新增重复问题** | `openspec/changes/fix-unauthorized-injoys-doc-write/proposal.md:73` 如实记录上游阶段/顺序冲突，不宣称 BR-033 整体满足；`:164` 保留该说明。源证据仍为 `.context/domain/business_rules.md:201`、`:204`、`.context/architecture/api_strategy.md:335`、`.context/architecture/risks_and_debt.md:297`。大纲尚未承接说明，归 R-02 |
| Q-06 / M-6（原 P2） | **未关闭，见 R-03** | `openspec/proposal-roadmap-Phase-0.md:232`–`:235` 仍仅四份资产，未补首轮确认的六份直接相关资产；正文 `openspec/changes/fix-unauthorized-injoys-doc-write/proposal.md:133`–`:142` 已齐全，不要求重复补正文 |
| Q-07 / M-7（原 P2） | **已关闭** | `openspec/changes/fix-unauthorized-injoys-doc-write/proposal.md:149` 已为 in-progress，与 `openspec/proposal-roadmap.md:194`、`openspec/proposal-roadmap-Phase-0.md:203` 一致 |

本次未关闭项按下面三个事项计数；同一大纲同步组不再按 M-1/M-3/M-4/M-5 重复计数。三个阶段当前小结：Outline ↔ Context 仍为“中”（R-02/R-03）；Outline ↔ Proposal 仍“部分一致”（正文优于大纲但未同步）；Proposal → Context 的 P0 门禁方案通过，仍有复盘文案真实性的 P1（R-01）。

## C. 当前待处理事项与最小修改建议

### R-01 / M-R1：P1 [CONFLICT] 复盘“不落盘”与“文案必须说保存到草稿库”仍相互矛盾

**涉及层：提案内容。**

反向证据是修订后的明确规定：`openspec/changes/fix-unauthorized-injoys-doc-write/specs/injoys-write-boundary/spec.md:43` 说复盘作为返回值，不落盘为草稿；`:50` 明确不得新增草稿文件；`openspec/changes/fix-unauthorized-injoys-doc-write/tasks.md:72`、`:91` 同样要求不落盘。源码 `src/tools/index.ts:612`、`:616`、`:630` 只采指标、调 reporter 并返回。

但仍有以下正向落盘宣称：

- `openspec/changes/fix-unauthorized-injoys-doc-write/specs/injoys-write-boundary/spec.md:56` 对工具描述/README 通称“产物保存至本地草稿库”。
- 同文件 `:60` 指定同时检查 ops_draft_article 和 ops_generate_review，`:62` 要求“两者的 description”明确说“产物只保存到本地草稿库”。这不是无关范围的泛称，直接强制复盘作错误的落盘承诺。
- 同文件 `:67` 明确包括复盘路径，`:70` 仍要求相关条目称保存至本地草稿库。
- `openspec/changes/fix-unauthorized-injoys-doc-write/tasks.md:58` 要求包括 ops_generate_review / README 复盘条目的新文案明确产物保存至本地草稿库；`proposal.md:124` 与 `tasks.md:92` 的统称“保存至本地”也宜同步区分，避免继承同一误解。

因此用户所称“Q-02 五个子项全改”尚不能认定完全成立。先前的四次文件断言错误已经修好，但这份事实又在文案 Scenario 和门禁中残留。不是要求增加复盘落盘，而是让文案跟执行与 spec Requirement 2 一致。

**最小修改**：把该 Requirement、两个文案 Scenario 与任务门禁分别规定为“图文/视频保存本地草稿；复盘仅生成并返回结果，不承诺持久化；二者写入 Injoys 均须用户显式触发”。README 复盘建议可用“生成并返回复盘报告（写入 Injoys 文档须用户显式触发）”，避免“保存到草稿库”的含义。保留现有“不新增复盘持久化”和修正后的禁词方案。

**验收**：description/README 的复盘条目不得承诺本地草稿文件已保存；图文/视频条目仍承诺实际已有的本地落盘；spec `:43`、`:50` 与文案 Requirement/Scenario、tasks 4.4 不再互相否定。不改任何生成/复盘源码契约。

### R-02 / M-R2：P1 [MISSING] 大纲侧的交付约束、风险/范围与正文尚未同步

**涉及层：大纲；正文已有对应内容，保留即可。**

当前 `openspec/proposal-roadmap-Phase-0.md:281`–`:284`、`:857` 只列 A3→A4 严格顺序，没有正文 `proposal.md:77` 的同版本交付约束；`:215`、`:257` 仍不含 README 同源三处；`:243`–`:248` 仍缺 RISK-004（高）；`:219`–`:221` 未承接生成异常/未连通边界；`:226` 还称不存在能力空洞，与正文 `proposal.md:73` 承认“手工操作不构成插件内能力无空档”的澄清不一致。上游的 Phase 0 入口与先补入口口径也仍需明确为规划差异。

**最小修改**：在负责路线图维护的后续授权轮次，把上述内容定点回填当前提案条目与内容写入边界线，保留 A3→A4 依赖和两个正确索引状态。无需重生成全套路线图，也不要求为修正大纲增加业务能力。

**验收**：大纲和 proposal/tasks 对用户交付组合、README 范围、RISK-004/U2、异常 Out、阶段差异的叙述一致；索引状态仍通过 roadmap-status。此欠账不要求阻止本地开发验证，也不恢复已关闭的正文 P0，但仍阻止把“三层一致性已全部收口”作为结论。

### R-03 / M-R3：P2 [MISSING] 大纲仍缺六份直接相关资产

**涉及层：大纲。** 位置 `openspec/proposal-roadmap-Phase-0.md:228`–`:235`。

缺失清单仍为 `.context/architecture/constraints.md:51`、`.context/architecture/data_architecture.md:113`、`.context/architecture/runtime_view.md:105`、`.context/architecture/cross_cutting_concepts.md:80`、`.context/domain/business_rules.md:173`、`.context/domain/edge_cases.md:25`。原报告不要求补正文，也不要求补用户排除的资产。

**最小修改/验收**：与 M-R2 同一大纲维护轮次补六份资产和相关规则；不创造不存在的 DB/legacy 路径，不扩展到无关文档。

## D. 对“工作流硬门禁与不阻塞”解释的核查

`design/context-dev/openspec/AGENTS.md:23`–`:26` 确实规定子命令只运行命中模块，禁止顺便生成其他模块的产物；`.agents/workflows/context-openspec.md:54` 也有对应限制。故在 **proposal 子命令轮次**中不顺带运行 plan/重生成大纲，取舍合理。本轮用户只要求核查，继续遵守只写报告，不改路线图。

但应准确区分：原文是“禁止顺便生成其他模块产物”，不是全项目永久禁止定点修订大纲；用户之后明确授权的路线图修订不被这个子命令路由自动否决。更重要的是，写入权限边界不会自动关闭跨层一致性问题，不能据此声称 M-1/M-3/M-4/M-5/M-6 的**大纲部分**已解决。

`.agents/workflows/context-check.md:93` 所在 plan 检查入口本身属于检查流程；通用审查协议 `design/context-dev/check/AGENTS.md:3`、`:12` 规定默认只读、报告与修复分离。因此“跑一次 context-check plan”可以发现/报告这些欠账，**不会仅凭检查命令自动回填**。后续若要修改，应明确授权大纲修订并按对应工作流执行；无需为了本提案的少量修订自动重生成整份路线图。

结论是：可以把大纲维护安排到独立轮次；可以开始受交付门禁约束的开发；但当前仍不能认定全量 MODIFY 已收口。尤其 R-01 仍是三个提案工件内部的可修订矛盾，与大纲写入门禁无关。

## E. 复核记录与历史快照边界

本次仅更新 check-report.md。已重读最终报告并检查新基线、逐问题关闭状态、剩余等级数量与修改位置；首轮完整 MUST/MUST NOT 矩阵、BR 表、F1–F14、路线图与风险分析保留在后文作为证据快照。源代码未变化，F1–F14 的源事实仍适用；首轮提案行号因本轮修订已漂移，应以本轮 B/C 节的新引用定位。首轮对 `.context/criterion.md:109` 的 ❌ 评价是**旧方案历史状态**，当前正文交付方案已满足门禁设计要求，不能当作本次未关闭 P0。

---

# 首轮评审快照（历史记录）

评审日期：2026-10-21。综合结论：**MODIFY**。独立发现共 **P0 1 项、P1 4 项、P2 2 项**。同一发现的子证据不重复计数；既有实现债务不另计为本提案缺陷。

## 1. 范围、基线与综合结论

唯一产物为本文件。未修改 proposal、tasks、spec、路线图、Context 或源码。按 `.agents/workflows/context-check.md:123` 所在的 review proposal 执行契约及 `design/context-dev/check/review/AGENTS.md:103` 所在三层评审规则执行；用户指定范围优先。

实际工件是 `proposal.md`、`tasks.md` 和 `specs/injoys-write-boundary/spec.md`；未创建 design.md。严格校验接受无 design 的工件集合，不据此报缺陷。Context 资产按 `.context/context-manifest.json:55`、`:75` 的登记范围加载，补读 `.context/openspec/integration.md:11` 的索引；`.context/db/`、`.context/legacy/` 实测不存在，不引用幽灵文件。用户列为非直接相关的资产不要求补充引用；security_policy 与 user_journeys 仅用于必要的交叉核对。

### 1.1 先行实测基线

以下五项在阅读提案后、实体评审前执行；退出码由进程返回，非根据文档自述判断。

| 命令 | 退出码 | 实测结果 |
|---|---:|---|
| `pnpm typecheck` | 0 | `tsc -p tsconfig.json --noEmit` 通过 |
| `pnpm test` | 0 | 8 个测试文件、132 个用例全部通过；3 条 BrowserOS 未注册提示来自既有生命周期用例，无失败 |
| `node design/context-dev/tools/specflow/specflow.mjs validate fix-unauthorized-injoys-doc-write --strict` | 0 | `✅ OK` |
| `node design/context-dev/tools/specflow/specflow.mjs status fix-unauthorized-injoys-doc-write` | 0 | proposal/specs/tasks 存在；design 未创建；ArtifactsComplete=yes；ExecutionComplete=no，0/28 完成 |
| `node design/context-dev/tools/specflow/specflow.mjs roadmap-status --check` | 0 | 路线图状态与 change 目录一致 |

基线全绿，无环境失败项。测试隔离入口为 `vitest.config.ts:9`、`tests/setup-isolation.ts:26`、`:29`，测试自身使用临时目录，不是向开发者真实 DSH_HOME 写入。上述执行不代表提案已实施：任务仍全未勾选（`openspec/changes/fix-unauthorized-injoys-doc-write/tasks.md:15`、`:89`）。

### 1.2 三阶段小结

| 阶段 | 结论 | 核心依据 |
|---|---|---|
| Outline ↔ Context | **中** | 两个业务目标有明确来源；但大纲资产表缺 6 份直接相关资产，风险表缺 RISK-004，未明确生成异常和未连通沉淀的排除口径（`openspec/proposal-roadmap-Phase-0.md:207`、`:228`、`:243`；`.context/domain/business_rules.md:173`、`:204`） |
| Outline ↔ Proposal | **部分一致** | 4 条关键任务、4 条验收与 3 个 BDD 均有映射；正文补上 RISK-004 和边界说明，README 是必要的小幅扩充；有过时状态和不可执行验收（`openspec/changes/fix-unauthorized-injoys-doc-write/tasks.md:8`、`:65`、`:82`；`openspec/changes/fix-unauthorized-injoys-doc-write/proposal.md:99`、`:135`，均位于本 change 目录） |
| Proposal → Context | **需修改** | 删除 5 处写入符合内容边界；A4 归属正确，但仅写“紧随”不能阻止 A3 独立交付后正常复盘恒发假编号（`openspec/changes/fix-unauthorized-injoys-doc-write/proposal.md:62`、`:66`、`:102`；`.context/criterion.md:109`） |


## 2. 问题清单与待澄清事项

### P0：Q-01 [CONFLICT] 正常路径必然播报假文档编号，缺少可执行交付门禁

证据：`openspec/changes/fix-unauthorized-injoys-doc-write/tasks.md:32` 删除 report 编号回写，`openspec/changes/fix-unauthorized-injoys-doc-write/tasks.md:33` 强制保留 `?? 'doc_review'`；`src/tools/index.ts:635` 返回它，`:604` 无条件渲染为“Injoys 文档编号”。因此 A3 后每次正常复盘均命中假编号，而修复前只在未配置/失败等无真实编号时命中（`src/analytics/review-reporter.ts:92`、`:94`）。这扩大了 `.context/criterion.md:109` 禁止的虚报成功。

`openspec/changes/fix-unauthorized-injoys-doc-write/proposal.md:59`、`:62`、`:102` **已经诚实登记扩大**，不是遗漏披露；但 `openspec/changes/fix-unauthorized-injoys-doc-write/proposal.md:153` 的风险接受不能豁免工程 MUST NOT。A4 确实负责取消 required、移除回退（`openspec/proposal-roadmap-Phase-0.md:304`、`:305`），并非要求 A3 抢做 A4。问题在大纲和提案均只规定实施顺序，未规定用户可用版本的交付组合；`openspec/changes/fix-unauthorized-injoys-doc-write/tasks.md:90` 允许 A3 单独归档。

需裁决：选择“A3→A4 分步实施、共同验证、同一用户可用版本交付”还是把两工具最小的编号可选化/渲染修复前移。推荐前者，保持职责划分，代价是 A3 不能独立对用户交付；若要 A3 单独交付，必须同步调整两份大纲和 A3/A4 范围，代价是扩大 A3 契约与测试修改。不得以继续未授权写入作为替代。见 M-1。

### P1：Q-02 [CONFLICT] 测试与验收混淆“返回本地结果”“草稿落盘”和两种入口字段

- `openspec/changes/fix-unauthorized-injoys-doc-write/tasks.md:64` 声称四条路径都读取知识库、`:65` 要求四次本地草稿均落盘。实际 `ops_generate_review` 只采指标、调用 reporter 并返回（`src/tools/index.ts:612`、`:616`、`:630`）；reporter 无知识库读取、无草稿存储（`src/analytics/review-reporter.ts:20`、`:79`、`:97`）。删除文档写入不会新增落盘。前三个内容入口才有 saveDraft（`src/ops-rpc.ts:407`；`src/tools/index.ts:239`、`:333`）。应断言三条内容路径落盘、复盘结果正确返回；知识库记录只针对实际读取的路径，不要求复盘产生 knowledge.list。
- `openspec/changes/fix-unauthorized-injoys-doc-write/proposal.md:108` 要求四条生成路径均有本地草稿，但 Launch execute 只构造内容并返回、没有 saveDraft（`src/tools/index.ts:926`、`:953`）。`openspec/changes/fix-unauthorized-injoys-doc-write/specs/injoys-write-boundary/spec.md:5` 将 Launch 一并置于“只保存本地草稿”的 MUST；这超出了“保持既有落盘、只做减法”（`openspec/changes/fix-unauthorized-injoys-doc-write/proposal.md:31`、`openspec/changes/fix-unauthorized-injoys-doc-write/tasks.md:30`）。需把 Launch 本轮口径写为“不写远端、保留生成结果返回”，将新增 Launch 持久化明确留待其 Phase 2 能力；若坚持新增持久化须改大纲并拆任务，不能暗中扩建。
- `openspec/changes/fix-unauthorized-injoys-doc-write/specs/injoys-write-boundary/spec.md:18` 同时覆盖 `ops_draft_video_meta` / `workbench.generateVideoMeta`，却在 `openspec/changes/fix-unauthorized-injoys-doc-write/specs/injoys-write-boundary/spec.md:20` 要求两者都返回 videoPath。RPC 实际返回 id、draftSaved、titleCandidates、description、tags（`src/ops-rpc.ts:495`），工具才返回 videoPath 和 titleVariant1/2/3（`src/tools/index.ts:293`）。须按入口分别写 BDD，保留各自契约。
- `openspec/changes/fix-unauthorized-injoys-doc-write/tasks.md:87` 声称“四条生成路径”均保留“请求开始捕获目录”。只有 RPC 图文可由 U2 证明；工具图文/视频在知识库 await 后调用默认 saveDraft（`src/tools/index.ts:205`、`:239`、`:310`、`:333`），Launch 无落盘。不能把 U2 的证据范围扩大到其他路径。无需因此在本提案加一套目录机制，先修正验收描述并如实标注既有未覆盖面。
- `openspec/changes/fix-unauthorized-injoys-doc-write/tasks.md:68` 把“不应返回 undefined”说成“toBeUndefined 断言在 pnpm typecheck 下不成立”，技术表述不准确：required 约束的是 execute 实现返回值；expect 断言本身可编译，且 `tsconfig.json:18` 根本未包含 tests。`openspec/changes/fix-unauthorized-injoys-doc-write/tasks.md:67` / `:72` 的空串断言与本提案过渡值相容，`openspec/changes/fix-unauthorized-injoys-doc-write/tasks.md:71` 的 reporter undefined 也相容；应保留断言并修正理由。

影响：实施者无法同时满足“只做减法”和上述验收，可能误加持久化、改 RPC 响应或误称已有测试覆盖。见 M-2。

### P1：Q-03 [CONFLICT] 建议文案与 grep 空结果门禁互相冲突

`openspec/changes/fix-unauthorized-injoys-doc-write/tasks.md:51` 建议“生成本地复盘报告（沉淀至 Injoys 文档须用户显式触发）”，但 `openspec/changes/fix-unauthorized-injoys-doc-write/tasks.md:53` / `:82` 要求 grep `沉淀至 Injoys 文档` 为空；该建议文字必然匹配。`openspec/changes/fix-unauthorized-injoys-doc-write/tasks.md:40` 的工具描述同样允许这段授权说明，而 `openspec/changes/fix-unauthorized-injoys-doc-write/tasks.md:82` 又禁绝该短语。`openspec/changes/fix-unauthorized-injoys-doc-write/specs/injoys-write-boundary/spec.md:51` / `:57` 禁止的是暗示生成副作用的语义，不能用原始短语一刀切近似它。

需选择：把建议统一改为不命中禁词且准确的“仅生成本地复盘结果；用户主动沉淀另行处理”，或保留授权说明，将 grep 改为检查旧的完整错误句子，并人工核对新句子的授权语义。后者允许正常业务术语存在，更贴近 `openspec/changes/fix-unauthorized-injoys-doc-write/specs/injoys-write-boundary/spec.md:44`。README 三处修改本身必要（`README.md:24`、`:27`、`:39`），不应转出提案。见 M-3。

### P1：Q-04 [MISSING] 大纲未传递 RISK-004 与异常边界

`openspec/proposal-roadmap-Phase-0.md:243` 风险表只有隐性行为依赖/编号为空；但删除第二次 saveDraft 会触及第一次落盘的固定目录参数（`src/ops-rpc.ts:397`、`:422`、`:434`）。`.context/architecture/risks_and_debt.md:66`、`:73`、`:76` 将其列为**高风险 RISK-004**。正文 `openspec/changes/fix-unauthorized-injoys-doc-write/proposal.md:99` / `openspec/changes/fix-unauthorized-injoys-doc-write/tasks.md:24` 已正确补足，大纲仍遗漏。大纲验证表 `openspec/proposal-roadmap-Phase-0.md:254` 也未要求本地存盘/目录固定回归，虽 BDD `:265` 写了本地存盘。

大纲 Out `openspec/proposal-roadmap-Phase-0.md:219` 仅列 3 类排除，未说明 `.context/domain/edge_cases.md:25`、`:27` 的内容不完整/AI 不可用，以及 `:140` 的未连通知识库依赖动作。正文 `openspec/changes/fix-unauthorized-injoys-doc-write/proposal.md:55`、`:56` 已合理区分 Phase 2 沉淀验收和既有生成兜底，但仍未明确 AI 服务失败/重试不在本次删除调用的范围。应补清范围，保留存储失败真实上报（`.context/criterion.md:182`）；不要求新建 AI 失败能力或重复 U2。见 M-4。

### P1：Q-05 [CONFLICT] 上游阶段/先后顺序冲突未作为差异解释

来源在上游：`.context/domain/business_rules.md:201`、`:204`、`.context/architecture/api_strategy.md:335` 均标沉淀入口 Phase 0 首版；`.context/architecture/risks_and_debt.md:297` 明写“先补齐”沉淀入口、再删生成写入。路线图却在 `openspec/proposal-roadmap-Phase-0.md:219`、`:226` 及 `openspec/proposal-roadmap.md:207` 将入口延至 Phase 2 并先做删除。提案继承后者（`openspec/changes/fix-unauthorized-injoys-doc-write/proposal.md:51`），还要求保留前者的“先补齐”原文（`openspec/changes/fix-unauthorized-injoys-doc-write/tasks.md:47`）。

内容写入边界本身无冲突，且不能为等待 Phase 2 而继续越权。应在大纲/提案明确记录“本轮按路线图拆分先止血；入口阶段目标仍与 Context 有规划差异”，不宣称 BR-033 的整个首版能力已经满足；若要消除上游冲突，由后续 context-update 追溯既有裁决授权再同步资产，不能在本轮擅改源文档。不是要求提前实现入口。见 M-5。

### P2：Q-06 [MISSING] 大纲资产引用不足

`openspec/proposal-roadmap-Phase-0.md:232` 仅引用 criterion、risks、api、testing 四份文件。缺少的 6 份直接相关资产、具体落点见第 3 节；正文 `openspec/changes/fix-unauthorized-injoys-doc-write/proposal.md:119` 至 `:128` 已全部引用，故不要求在正文重复加引用。见 M-6。

### P2：Q-07 [STALE] 提案抄录索引状态过时

`openspec/changes/fix-unauthorized-injoys-doc-write/proposal.md:135` 仍记 proposed，而实际 `openspec/proposal-roadmap.md:194` 和 `openspec/proposal-roadmap-Phase-0.md:203` 均为 in-progress。只需修正文中的抄录，不改正确的两个路线图状态；specflow roadmap-status 已实测通过。见 M-7。

待澄清问题按上述 Q-01→Q-07 排序。Q-01 是交付阻塞决策；Q-02～Q-05 有明确最小修改方案，无需为开始修订逐项索取批准；Q-06、Q-07 为可追溯性修订。本轮仅记录，不实施这些修改。

## 3. 阶段一：Outline ↔ Context

### 3.1 业务目标对照

| 大纲目标 | .context 依据 | 对齐状态 |
|---|---|---|
| 生成/复盘只写本地，Injoys 写入须显式触发（`openspec/proposal-roadmap-Phase-0.md:207`） | `.context/domain/business_rules.md:173`、`:204`、`:223`、`:452`；`.context/criterion.md:210` | ✅ 写入边界有依据；“只写本地”不可据此声称所有路径已有文件持久化，见 Q-02 |
| 消除未授权写入用户空间（`openspec/proposal-roadmap-Phase-0.md:208`） | `.context/domain/business_rules.md:204`、`:453`；`.context/architecture/risks_and_debt.md:294` | ✅ 未凭空发明业务目标 |

### 3.2 关联资产覆盖度

| 资产及证据 | 大纲缺失 | 提案正文缺失 | 关联原因 |
|---|---|---|---|
| `.context/architecture/constraints.md:51` | 是 | 否，`openspec/changes/fix-unauthorized-injoys-doc-write/proposal.md:125` | 已有 Launch 减法修复不等于提前实现 Phase 2 |
| `.context/architecture/data_architecture.md:113`、`:289` | 是 | 否，`openspec/changes/fix-unauthorized-injoys-doc-write/proposal.md:122` | 编号仅在主动沉淀后回写 |
| `.context/architecture/runtime_view.md:105`、`:473` | 是 | 否，`openspec/changes/fix-unauthorized-injoys-doc-write/proposal.md:123` | 生成无远端写入，失败如实返回 |
| `.context/architecture/cross_cutting_concepts.md:80`、`:81` | 是 | 否，`openspec/changes/fix-unauthorized-injoys-doc-write/proposal.md:124` | 不谎报、不伪造 |
| `.context/domain/business_rules.md:173`、`:204`、`:223`、`:354`、`:452` | 是 | 否，`openspec/changes/fix-unauthorized-injoys-doc-write/proposal.md:126` | BR-030/033/040/073/NFR-002 |
| `.context/domain/edge_cases.md:25`、`:140` | 是 | 否，`openspec/changes/fix-unauthorized-injoys-doc-write/proposal.md:128` | 生成异常与知识库未连通 |

上表独立缺失文件为 **6 份**（constraints、data_architecture、runtime_view、cross_cutting_concepts、business_rules、edge_cases）。大纲现有 4 份 + 缺失 6 份 = 正文实际引用的 10 份 Context 权威资产（`openspec/changes/fix-unauthorized-injoys-doc-write/proposal.md:119` 至 `:128`）。没有提案正文缺失，也没有多余 Context 引用；路线图 `openspec/changes/fix-unauthorized-injoys-doc-write/proposal.md:129` 属追溯来源，不计 Context 权威文档。Manifest/Integration 为审查入口，不能机械要求列入业务资产表；用户列明不直接相关的文档不构成缺失。

### 3.3 In/Out 与验收问题

大纲 5 处调用、工具描述、TD-008 补站点、测试和能力保留（`openspec/proposal-roadmap-Phase-0.md:214` 至 `:218`）与 `.context/criterion.md:210` 一致；不得扩大成实现海外模拟器或显式沉淀入口（`.context/architecture/constraints.md:51`）。Out 的生成异常/知识库未连通分层见 Q-04；Phase 0 没有沉淀入口不意味着 BR-073 全局失效，更不能排除 A4 的不返回假编号验收（`openspec/proposal-roadmap-Phase-0.md:866`）。

大纲 4 项验收都可用 mock/grep/代码审查验证（`openspec/proposal-roadmap-Phase-0.md:254` 至 `:257`），不是完全不可验证。但遗漏 `.context/criterion.md:178` 等待知识库后仍写起始目录的直接验收，也没防止 `.context/criterion.md:109` 被过渡态破坏；正文分别补了 U2 和风险披露，前者充分，后者需 M-1 的交付门禁。本提案无吞吐、延迟、比例或容量等数值型业务要求，**无需量化 KPI**；“5 处调用”“0 次 document.create”和“三套标题”是覆盖/契约断言，不应另造性能指标（`openspec/changes/fix-unauthorized-injoys-doc-write/proposal.md:152`；`.context/architecture/api_strategy.md:327`）。

### 3.4 RISK-001～012 逐项筛选

| 风险 | 原资产位置/等级 | 相关性与大纲遗漏判断 |
|---|---|---|
| RISK-001 | `.context/architecture/risks_and_debt.md:27`，极高 | 不改 published/URL 守卫，不要求扩充风险表 |
| RISK-002 | 同文件 `:40`，高 | 不新增发布能力，不要求扩充 |
| RISK-003 | 同文件 `:53`，高 | 不改会话探测，不要求扩充 |
| RISK-004 | 同文件 `:66`，高 | **相关且大纲遗漏**；正文 `openspec/changes/fix-unauthorized-injoys-doc-write/proposal.md:99` 已覆盖，Q-04 |
| RISK-005 | 同文件 `:79`，中 | 保留首次 saveDraft 的错误传播；不改 config/统一错误边界（`openspec/changes/fix-unauthorized-injoys-doc-write/tasks.md:24`），已有机制覆盖，不要求新防御任务 |
| RISK-006 | 同文件 `:92`，中 | 不改指标汇总算法（`openspec/changes/fix-unauthorized-injoys-doc-write/tasks.md:32` 仅删尾部写入），既有问题不可归为此次新增缺陷 |
| RISK-007 | 同文件 `:105`，中 | 不改指标历史/环比，无需新增登记 |
| RISK-008 | 同文件 `:120`，中 | 不改目录配置/迁移语义，Q-04 保留目录不变量即可 |
| RISK-009 | 同文件 `:133`，中 | 不改状态枚举或映射，无需新增登记 |
| RISK-010 | 同文件 `:146`，高 | 测试相关，但 `openspec/changes/fix-unauthorized-injoys-doc-write/tasks.md:58` 已沿用 setup 隔离，无须重复开发隔离；大纲可引用该既有机制，不视为独立遗漏缺陷 |
| RISK-011 | 同文件 `:159`，中 | 不改配置/token 返回或日志，接口暴露面未扩大 |
| RISK-012 | 同文件 `:172`，低 | 不实现 CDP 登录，明确 Out，无需扩充 |

遗漏清单仅 **RISK-004（高）**；不要求把所有间接相关风险搬进大纲。

## 4. 阶段二：Outline ↔ Proposal

### 4.1 目标与章节映射

| 大纲目标 | 提案对应章节 | 覆盖状态 |
|---|---|---|
| 只写本地/显式授权（`openspec/proposal-roadmap-Phase-0.md:207`） | `openspec/changes/fix-unauthorized-injoys-doc-write/proposal.md:5` Why、`:23` What Changes、`:139` business_goal；`openspec/changes/fix-unauthorized-injoys-doc-write/specs/injoys-write-boundary/spec.md:5`、`:32` | 已覆盖；落盘表述需 Q-02 修正 |
| 消除未授权上传（同文件 `:208`） | `openspec/changes/fix-unauthorized-injoys-doc-write/proposal.md:7` 五站点、`:25` 至 `:29` 删除清单 | 已覆盖 |

### 4.2 大纲 ↔ 提案一致性对照

| 大纲章节 | 提案对应位置 | 一致性 | 差异说明 |
|---|---|---|---|
| In 5 处删除（`openspec/proposal-roadmap-Phase-0.md:214`） | `openspec/changes/fix-unauthorized-injoys-doc-write/proposal.md:25` 至 `:29`、`openspec/changes/fix-unauthorized-injoys-doc-write/tasks.md:23` 至 `:33` | 一致 | RPC 还删除仅为编号回写存在的第二次 saveDraft，符合减法 |
| 文案（同文件 `:215`） | `openspec/changes/fix-unauthorized-injoys-doc-write/proposal.md:35`、`openspec/changes/fix-unauthorized-injoys-doc-write/tasks.md:38`、`:49` | 最小扩充 | README 三处同源虚假表述纳入必要；应回填大纲，见 M-3 |
| TD-008 清单（同文件 `:216`） | `openspec/changes/fix-unauthorized-injoys-doc-write/tasks.md:42` 至 `:48` | 覆盖且细化 | 补看板、保留部分修复状态；现状表延后更新属有登记的同步欠账 |
| 测试（同文件 `:217`） | `openspec/changes/fix-unauthorized-injoys-doc-write/tasks.md:60` 至 `:75` | 已映射，执行口径有误 | Q-02；不是未安排测试 |
| 能力保留（同文件 `:218`） | `openspec/changes/fix-unauthorized-injoys-doc-write/proposal.md:47`、`openspec/changes/fix-unauthorized-injoys-doc-write/tasks.md:83`、`openspec/changes/fix-unauthorized-injoys-doc-write/specs/injoys-write-boundary/spec.md:62` | 一致 | 不删除 InjoysClient 的 save 方法 |
| Out（同文件 `:219` 至 `:221`） | `openspec/changes/fix-unauthorized-injoys-doc-write/proposal.md:51` 至 `:57` | 覆盖且细化 | A4 假编号处理单列 Out，与相邻 A4 In 一致；异常范围仍需 Q-04 |
| 风险（同文件 `:243`） | `openspec/changes/fix-unauthorized-injoys-doc-write/proposal.md:98` 至 `:104` | 正文比大纲充分 | RISK-004/过渡态都在正文，需回填大纲 |
| 生成验收（同文件 `:254`） | `openspec/changes/fix-unauthorized-injoys-doc-write/proposal.md:108`、`openspec/changes/fix-unauthorized-injoys-doc-write/specs/injoys-write-boundary/spec.md:5` 至 `:28`、`openspec/changes/fix-unauthorized-injoys-doc-write/tasks.md:80` | 覆盖，有错误增强 | Launch 落盘要求没有对应执行任务，Q-02 |
| 复盘验收（同文件 `:255`） | `openspec/changes/fix-unauthorized-injoys-doc-write/proposal.md:109`、`openspec/changes/fix-unauthorized-injoys-doc-write/specs/injoys-write-boundary/spec.md:32` 至 `:40`、`openspec/changes/fix-unauthorized-injoys-doc-write/tasks.md:81` | 一致 | reporter 未设置编号与工具暂时返回假编号必须区分 |
| Launch 验收（同文件 `:256`） | `openspec/changes/fix-unauthorized-injoys-doc-write/specs/injoys-write-boundary/spec.md:22` 至 `:28`、`openspec/changes/fix-unauthorized-injoys-doc-write/tasks.md:66`、`:80` | 一致 | A3 暂为空串，不用 undefined；A4 才可选化 |
| 文案验收（同文件 `:257`） | `openspec/changes/fix-unauthorized-injoys-doc-write/specs/injoys-write-boundary/spec.md:44` 至 `:58`、`openspec/changes/fix-unauthorized-injoys-doc-write/tasks.md:82` | 覆盖，有自相矛盾门禁 | Q-03 |
| BDD 三场景（同文件 `:262`、`:268`、`:274`） | `openspec/changes/fix-unauthorized-injoys-doc-write/specs/injoys-write-boundary/spec.md:7`、`:15`、`:22`、`:34`；`openspec/changes/fix-unauthorized-injoys-doc-write/tasks.md:80`、`:81` | 全部继承 | 视频新增细化；缺陷是入口字段混淆，不是 BDD 缺失 |
| 依赖（同文件 `:282` 至 `:284`） | `openspec/changes/fix-unauthorized-injoys-doc-write/proposal.md:90` 至 `:92`、`:142` | 一致 | 前置无，被依赖 A4/Phase 2 入口，目录约束保留 |
| 优先级/状态（`openspec/proposal-roadmap.md:194`） | `openspec/changes/fix-unauthorized-injoys-doc-write/proposal.md:135`；Phase 文件 `:201`、`:203` | 部分一致 | 两路线图均 P0/无前置/in-progress，正文误抄 proposed，Q-07 |

### 4.3 关键任务原子化

| 大纲关键任务 | tasks 第 1 章映射 | 实际任务是否存在/可执行 |
|---|---|---|
| 4 处生成调用删除（`openspec/proposal-roadmap-Phase-0.md:238`） | `openspec/changes/fix-unauthorized-injoys-doc-write/tasks.md:8` → 3.1/3.2/3.3/3.4 | 全部存在，`openspec/changes/fix-unauthorized-injoys-doc-write/tasks.md:23`、`:26`、`:28`、`:30`；无悬空编号 |
| reporter 删除（同文件 `:239`） | `openspec/changes/fix-unauthorized-injoys-doc-write/tasks.md:9` → 3.5/3.6 | 全部存在，`openspec/changes/fix-unauthorized-injoys-doc-write/tasks.md:32`、`:34`；保留构造签名合理 |
| 文案/TD-008（同文件 `:240`） | `openspec/changes/fix-unauthorized-injoys-doc-write/tasks.md:10` → 4.1/4.2/4.3 | 全部存在；4.3 为新增 README，需纠正文案验收 |
| 通用/Launch 测试（同文件 `:241`） | `openspec/changes/fix-unauthorized-injoys-doc-write/tasks.md:11` → 5.1/5.2/5.3/5.4 | 全部存在；5.2 的四次落盘口径有误 |

无关键任务漏映射，无映射到不存在编号；差异是任务条件错误。4.2 的 `grep -n "TD-008"`（`openspec/changes/fix-unauthorized-injoys-doc-write/tasks.md:45`）只定位债务标题/看板，不能单独证明正文有 5 站点；需结合读取完整 TD-008 或五站点清单逐项核对，属于 Q-02 的验证口径细化，不另计问题。

### 4.4 五项特有判定

1. **过渡态归属正确，交付接受方式不足**：Launch 空串、review 回退均在 A4 的两 schema/假编号范围（`openspec/proposal-roadmap-Phase-0.md:304` 至 `:306`）。required string 可返回空串，不强制返回真实编号；保持 review 的假编号并非类型系统唯一解。扩大已披露，需 M-1 的交付组合；不能当作未披露漏洞重复报错。
2. **SSoT 未更改成立，但不是“所有契约资产都无需同步”**：`src/types.ts:81`、`:131`、`:273`、`:318` 本就可选；RPC 信封/方法/字段不变，`openspec/changes/fix-unauthorized-injoys-doc-write/tasks.md:15` 至 `:19` 无需改类型或 codegen。API §3.10 的 `:752` 至 `:754` 是“当前实现差距”，不是类型契约。允许依 `openspec/changes/fix-unauthorized-injoys-doc-write/tasks.md:48`、`openspec/changes/fix-unauthorized-injoys-doc-write/proposal.md:103` 合并 A4 后一次 context-update，前提是在 M-1 同次交付中完成；无期限拖延不成立。不需要改 §3.1 请求/响应示例。
3. **README 扩充必要，应回填大纲**：`README.md:24`、`:27`、`:39` 在代码修复后会直接失真；不应转到不确定的文档轮次。`openspec/changes/fix-unauthorized-injoys-doc-write/proposal.md:140` 已申明偏差，透明但不能替代上游范围一致性。其引用“大纲 In③”也不准确：描述文案在 `openspec/proposal-roadmap-Phase-0.md:215` 为第 2 条 In，`:216` 第 3 条才是 TD-008，应按具体文案行引用，避免自造序号。
4. **既有断言清单完整，新增口径需修正**：F10 的 4 处均被 `openspec/changes/fix-unauthorized-injoys-doc-write/tasks.md:60`、`:71`、`:72`、`:73` 覆盖；完整搜索还找到 `tests/ops-manager.spec.ts:1460` 的独立 saveArticleDocument 失败测试，它验证保留方法，保持不动合理。`toBe('')` / reporter `toBeUndefined()` 区分正确，类型说明问题见 Q-02。U2 闸门覆盖 RPC 图文知识库等待切库，故“不新增同一 U2 回归”成立；不等于证明所有工具目录固定。
5. **覆盖边界声明诚实且足够**：`openspec/changes/fix-unauthorized-injoys-doc-write/proposal.md:69` 明确表格/指标表/需求池写入不在 document.create 范围，不宣称它们已合规；`openspec/changes/fix-unauthorized-injoys-doc-write/tasks.md:47` 明确 TD-008 只部分修复，不会合理地让人误认全部偿还。后续可按 `.context/domain/business_rules.md:453` 的显式触发语义专项审查，再决定是否单列债务；证据尚不足以本轮强制给这三类行为定罪。该后续工作不阻塞这 5 处删除，不要求扩充 README 其他条目。

## 5. 阶段三：MUST / MUST NOT 逐条合规矩阵

矩阵逐条保留 §3.1–3.5 的 49 个 MUST/MUST NOT bullet，重复规则也不合并；另逐条列 §3.4 令牌返回补充和 §4 各条。✅ 表示本提案方案满足该规则，非声明整个既有代码库已合规；⚠️ 表示边界/覆盖需说明；❌ 为冲突。N/A 必须有不适用理由。源文原子 bullet 内的多个条件保留在同一行；安全子 bullet 各占一行。

| 规则（criterion.md 位置） | 提案证据与核对 | 状态 |
|---|---|---|
| `.context/criterion.md:74` MUST：按架构文档 §2.1 的 Cordis 扩展机制封装为 `window.__ModuleLoader__.load(...)` 模块（当前实现：`id: 'dsh-growth-studio'`，`inject` 声明 `@deepseek-ai/dsh-client-connection` 与 `@deepseek-ai/dsh-client-ui-settings`） | `openspec/changes/fix-unauthorized-injoys-doc-write/proposal.md:57`、`:85`；`openspec/changes/fix-unauthorized-injoys-doc-write/tasks.md:88` 明确不修改客户端，无新增 UI/客户端执行路径 | N/A（客户端不在本轮影响面） |
| `.context/criterion.md:75` MUST：在 `settings.section` 槽位注入，`id: 'ops'`，`order: 60`（置于 Jet Hub 之后） | `openspec/changes/fix-unauthorized-injoys-doc-write/proposal.md:57`、`:85`；`openspec/changes/fix-unauthorized-injoys-doc-write/tasks.md:88` 明确不修改客户端，无新增 UI/客户端执行路径 | N/A（客户端不在本轮影响面） |
| `.context/criterion.md:76` MUST：全部数据经统一 RPC 封装 `callOpsRpc`（`POST /api/ops`）获取，不直连任何外部服务 | `openspec/changes/fix-unauthorized-injoys-doc-write/proposal.md:57`、`:85`；`openspec/changes/fix-unauthorized-injoys-doc-write/tasks.md:88` 明确不修改客户端，无新增 UI/客户端执行路径 | N/A（客户端不在本轮影响面） |
| `.context/criterion.md:77` MUST：样式必须使用 DSH 主题令牌（`var(--dsw-alias-*)`）：背景层级、边框层级、文字阶梯一律走令牌 | `openspec/changes/fix-unauthorized-injoys-doc-write/proposal.md:57`、`:85`；`openspec/changes/fix-unauthorized-injoys-doc-write/tasks.md:88` 明确不修改客户端，无新增 UI/客户端执行路径 | N/A（客户端不在本轮影响面） |
| `.context/criterion.md:80` MUST NOT：硬编码 Injoys Token、BrowserOS 凭证或任何敏感配置 | `openspec/changes/fix-unauthorized-injoys-doc-write/proposal.md:57`、`:85`；`openspec/changes/fix-unauthorized-injoys-doc-write/tasks.md:88` 明确不修改客户端，无新增 UI/客户端执行路径 | N/A（客户端不在本轮影响面） |
| `.context/criterion.md:81` MUST NOT：绕过 `callOpsRpc` 直连 Injoys / BrowserOS MCP 或任何外部服务 | `openspec/changes/fix-unauthorized-injoys-doc-write/proposal.md:57`、`:85`；`openspec/changes/fix-unauthorized-injoys-doc-write/tasks.md:88` 明确不修改客户端，无新增 UI/客户端执行路径 | N/A（客户端不在本轮影响面） |
| `.context/criterion.md:82` MUST NOT：硬编码背景 / 边框 / 文字色值（交互点缀色按架构文档 §5.4 指定值：主操作蓝 `#1677ff`、安全绿 `#15803d`、告警橙 `#b45309`、活力紫 `#7c3aed`） | `openspec/changes/fix-unauthorized-injoys-doc-write/proposal.md:57`、`:85`；`openspec/changes/fix-unauthorized-injoys-doc-write/tasks.md:88` 明确不修改客户端，无新增 UI/客户端执行路径 | N/A（客户端不在本轮影响面） |
| `.context/criterion.md:83` MUST NOT：在客户端承载核心业务规则（状态机、权限判定须在宿主侧） | `openspec/changes/fix-unauthorized-injoys-doc-write/proposal.md:57`、`:85`；`openspec/changes/fix-unauthorized-injoys-doc-write/tasks.md:88` 明确不修改客户端，无新增 UI/客户端执行路径 | N/A（客户端不在本轮影响面） |
| `.context/criterion.md:99` MUST：所有 RPC 方法必须返回统一信封 `{ ok, result?, error? }`，失败必须如实抛出错误码与信息 | `openspec/changes/fix-unauthorized-injoys-doc-write/tasks.md:19` 不改方法/错误码；RPC 删除尾部副作用仍保留信封（`src/ops-rpc.ts:443`） | ✅ |
| `.context/criterion.md:100` MUST：平台差异一律收敛到 Adapter 层，禁止在通用流程中写平台分支 | `openspec/changes/fix-unauthorized-injoys-doc-write/proposal.md:25` 至 `:29` 仅删调用，不新增平台分支 | ✅ |
| `.context/criterion.md:101` MUST：Injoys 与 BrowserOS 调用必须集中在各自客户端封装入口 | `openspec/changes/fix-unauthorized-injoys-doc-write/tasks.md:88` 保留客户端入口，不另建直连 | ✅ |
| `.context/criterion.md:102` MUST：错误不得吞没（开发计划 §二 基线要求：错误不吞，如实抛出） | `openspec/changes/fix-unauthorized-injoys-doc-write/tasks.md:23` 保留首次 saveDraft 异常传播；保留 save 方法既有 catch（`src/injoys/client.ts:399`、`:441`）是原有债务，不扩成本次新缺陷 | ⚠️ |
| `.context/criterion.md:103` MUST：配置热更新须实时生效并传给 `InjoysClient`（`updateConfig`） | `openspec/changes/fix-unauthorized-injoys-doc-write/proposal.md:25` 至 `:29` 仅删除内容写入调用，`openspec/changes/fix-unauthorized-injoys-doc-write/tasks.md:88` 不扩展其他执行路径；该规则对应模块未修改 | N/A（无对应能力或接口变化） |
| `.context/criterion.md:104` MUST：`config.save` 修改 `draftsDir` 前必须**先准备并校验**目标目录；不可用时拒绝保存并返回 `config/invalid-drafts-dir`，不得先报成功 | `openspec/changes/fix-unauthorized-injoys-doc-write/proposal.md:25` 至 `:29` 仅删除内容写入调用，`openspec/changes/fix-unauthorized-injoys-doc-write/tasks.md:88` 不扩展其他执行路径；该规则对应模块未修改 | N/A（无对应能力或接口变化） |
| `.context/criterion.md:105` MUST：会话探测、预填执行、指标采集必须统一由**同一个** BrowserOS MCP 实例调度 | `openspec/changes/fix-unauthorized-injoys-doc-write/proposal.md:25` 至 `:29` 仅删除内容写入调用，`openspec/changes/fix-unauthorized-injoys-doc-write/tasks.md:88` 不扩展其他执行路径；该规则对应模块未修改 | N/A（无对应能力或接口变化） |
| `.context/criterion.md:108` MUST NOT：内置全局通用 Master Key 或任何形式的通用凭据（架构文档 §6.1 凭证隔离） | `openspec/changes/fix-unauthorized-injoys-doc-write/proposal.md:25` 至 `:29` 仅删除内容写入调用，`openspec/changes/fix-unauthorized-injoys-doc-write/tasks.md:88` 不扩展其他执行路径；该规则对应模块未修改 | N/A（无对应能力或接口变化） |
| `.context/criterion.md:109` MUST NOT：虚报成功（无客户端或执行失败时严禁返回成功） | `openspec/changes/fix-unauthorized-injoys-doc-write/proposal.md:62`、`:102` 承认正常路径假编号，`openspec/changes/fix-unauthorized-injoys-doc-write/tasks.md:33` 保留；Q-01 | ❌ |
| `.context/criterion.md:110` MUST NOT：伪造 / 硬编码指标数据（无法获取的字段必须为 `null`） | `openspec/changes/fix-unauthorized-injoys-doc-write/tasks.md:32` 不改指标计算；`src/analytics/review-reporter.ts:38` 所在算法既有真实性问题属其他债务，不认作本轮修复 | N/A（未改指标算法） |
| `.context/criterion.md:111` MUST NOT：在插件内实现自动点击平台「正式发布 / 群发」按钮的能力 | `openspec/changes/fix-unauthorized-injoys-doc-write/proposal.md:25` 至 `:29` 仅删除内容写入调用，`openspec/changes/fix-unauthorized-injoys-doc-write/tasks.md:88` 不扩展其他执行路径；该规则对应模块未修改 | N/A（无对应能力或接口变化） |
| `.context/criterion.md:123` MUST：只调用统一 RPC 封装，不手写外部 `fetch` | `openspec/changes/fix-unauthorized-injoys-doc-write/proposal.md:57`、`:85`；`openspec/changes/fix-unauthorized-injoys-doc-write/tasks.md:88` 明确不修改客户端，无新增 UI/客户端执行路径 | N/A（客户端不在本轮影响面） |
| `.context/criterion.md:124` MUST：状态域与字段命名约定统一（`loading` / `error` / `data`） | `openspec/changes/fix-unauthorized-injoys-doc-write/proposal.md:57`、`:85`；`openspec/changes/fix-unauthorized-injoys-doc-write/tasks.md:88` 明确不修改客户端，无新增 UI/客户端执行路径 | N/A（客户端不在本轮影响面） |
| `.context/criterion.md:125` MUST：指标为 `null` 时展示为「暂无数据」语义，不得显示为 0 | `openspec/changes/fix-unauthorized-injoys-doc-write/proposal.md:57`、`:85`；`openspec/changes/fix-unauthorized-injoys-doc-write/tasks.md:88` 明确不修改客户端，无新增 UI/客户端执行路径 | N/A（客户端不在本轮影响面） |
| `.context/criterion.md:126` MUST：未登录平台一律提供 **`去登录 ↗`** 快捷外链（零阻碍操作原则） | `openspec/changes/fix-unauthorized-injoys-doc-write/proposal.md:57`、`:85`；`openspec/changes/fix-unauthorized-injoys-doc-write/tasks.md:88` 明确不修改客户端，无新增 UI/客户端执行路径 | N/A（客户端不在本轮影响面） |
| `.context/criterion.md:127` MUST：卡片支持即时刷新，不强制重载页面 | `openspec/changes/fix-unauthorized-injoys-doc-write/proposal.md:57`、`:85`；`openspec/changes/fix-unauthorized-injoys-doc-write/tasks.md:88` 明确不修改客户端，无新增 UI/客户端执行路径 | N/A（客户端不在本轮影响面） |
| `.context/criterion.md:130` MUST NOT：硬编码色值（必须使用 `var(--dsw-alias-*)`） | `openspec/changes/fix-unauthorized-injoys-doc-write/proposal.md:57`、`:85`；`openspec/changes/fix-unauthorized-injoys-doc-write/tasks.md:88` 明确不修改客户端，无新增 UI/客户端执行路径 | N/A（客户端不在本轮影响面） |
| `.context/criterion.md:131` MUST NOT：包含业务黑盒逻辑或本地伪造数据 | `openspec/changes/fix-unauthorized-injoys-doc-write/proposal.md:57`、`:85`；`openspec/changes/fix-unauthorized-injoys-doc-write/tasks.md:88` 明确不修改客户端，无新增 UI/客户端执行路径 | N/A（客户端不在本轮影响面） |
| `.context/criterion.md:142` MUST：遵循分层架构：客户端视图层 → 宿主 RPC 网关层 → 业务领域服务层 → 外部 MCP 集成层 → 本地持久化基础设施层 | `openspec/changes/fix-unauthorized-injoys-doc-write/proposal.md:80` 至 `:85` 保留宿主/领域/客户端边界，`openspec/changes/fix-unauthorized-injoys-doc-write/tasks.md:88` 不新建调用链 | ✅ |
| `.context/criterion.md:143` MUST：RPC 接口演进须向后兼容，或按版本显式升级 | `openspec/changes/fix-unauthorized-injoys-doc-write/tasks.md:16` 沿用可选形状；AI 工具结果的行为变化与交付限制见 Q-01/Q-02 | ⚠️ |
| `.context/criterion.md:144` MUST：数据刷新遵循架构文档 §5.5：Phase 0 由用户手动触发 RPC 刷新并做局部状态替换，同一卡片并发刷新须做 in-flight 去重 | `openspec/changes/fix-unauthorized-injoys-doc-write/proposal.md:25` 至 `:29` 仅删除内容写入调用，`openspec/changes/fix-unauthorized-injoys-doc-write/tasks.md:88` 不扩展其他执行路径；该规则对应模块未修改 | N/A（无对应能力或接口变化） |
| `.context/criterion.md:147` MUST NOT：引入外部常驻服务端或额外网络监听端口 | `openspec/changes/fix-unauthorized-injoys-doc-write/proposal.md:25` 至 `:29` 仅删除内容写入调用，`openspec/changes/fix-unauthorized-injoys-doc-write/tasks.md:88` 不扩展其他执行路径；该规则对应模块未修改 | N/A（无对应能力或接口变化） |
| `.context/criterion.md:148` MUST NOT：将敏感策略 / 令牌下发到**本机 DSH 客户端之外**的调用方（**本机回填例外见下方「令牌返回边界」**） | `openspec/changes/fix-unauthorized-injoys-doc-write/proposal.md:25` 至 `:29` 仅删除内容写入调用，`openspec/changes/fix-unauthorized-injoys-doc-write/tasks.md:88` 不扩展其他执行路径；该规则对应模块未修改 | N/A（无对应能力或接口变化） |
| `.context/criterion.md:149` MUST NOT：在 Phase 0 引入 WebSocket / SSE 持久连接或后台定时轮询（须先在架构文档补齐连接生命周期、断线重连与令牌校验方案） | `openspec/changes/fix-unauthorized-injoys-doc-write/proposal.md:25` 至 `:29` 仅删除内容写入调用，`openspec/changes/fix-unauthorized-injoys-doc-write/tasks.md:88` 不扩展其他执行路径；该规则对应模块未修改 | N/A（无对应能力或接口变化） |
| `.context/criterion.md:172` MUST：原子写入（临时文件 + rename）+ 串行写锁保护内部回写 | `openspec/changes/fix-unauthorized-injoys-doc-write/tasks.md:24`、`:27`、`:29` 保留 DraftStore，未新增文件写入实现 | ✅ |
| `.context/criterion.md:173` MUST：版本自增（`version`）与 `expectedVersion` 乐观锁并发控制；MVP 只保留当前草稿 `{id}.json`，不创建版本快照、不提供历史查看或恢复（架构 §4.4） | `openspec/changes/fix-unauthorized-injoys-doc-write/tasks.md:23` 只删第二次 saveDraft；不新增历史或版本快照，首次写入仍由 DraftStore 控制 | ✅ |
| `.context/criterion.md:174` MUST：系统文件权限仅限当前操作系统用户 | `openspec/changes/fix-unauthorized-injoys-doc-write/tasks.md:27`、`:29` 继续用 DraftStore；权限实现保持 `.context/architecture/security_policy.md:113` 的既有保证 | ✅ |
| `.context/criterion.md:175` MUST：文件路径统一经 `resolveDshHome` 解析（`profileContext.home` → `DSH_HOME` → `~/.dsh` 回退） | `openspec/changes/fix-unauthorized-injoys-doc-write/tasks.md:58` 沿用隔离 home，`openspec/changes/fix-unauthorized-injoys-doc-write/tasks.md:24` 继续宿主目录解析 | ✅ |
| `.context/criterion.md:176` MUST：**目录在单次操作内固定**：一次草稿操作（加锁 → 读取 → 版本校验 → 写临时文件 → rename）必须始终针对同一目录；配置热切换只对**新发起**的操作生效，在途操作继续使用原目录 | `openspec/changes/fix-unauthorized-injoys-doc-write/tasks.md:24` 保留固定 articleStorageDir，U2 `tests/ops-manager.spec.ts:2323`；不得扩大覆盖声明（Q-02） | ✅（RPC 图文） |
| `.context/criterion.md:177` MUST：**跨 `await` 的复合 RPC 同样须固定目录**：如 `workbench.prefillDraft`（读草稿 → 调 Adapter → 回写）必须在请求开始时捕获目录并贯穿，禁止在 await 之后重新解析；客户端不得指定任意路径 | `openspec/changes/fix-unauthorized-injoys-doc-write/tasks.md:24`、`:87`；RPC 图文请求开始捕获；其他工具未被 U2 证明（Q-02），未改 prefill/sink 请求 | ⚠️ |
| `.context/criterion.md:178` MUST：**贯穿范围含请求内每一次落盘**：生成接口在等待知识库后只写本地草稿；用户明确触发的 `workbench.sinkToInjoysDoc` 须在其请求开始时捕获目录，贯穿读取、远端写入和回写 `injoysDocId`；两个请求各自固定目录，生成不得自动延伸为远端写入 | `openspec/changes/fix-unauthorized-injoys-doc-write/tasks.md:23`、`:24` 与 `openspec/changes/fix-unauthorized-injoys-doc-write/specs/injoys-write-boundary/spec.md:5` 删除远端写入，保留等待后本地落盘；显式 sink 属 `openspec/changes/fix-unauthorized-injoys-doc-write/proposal.md:51` Out | ✅ |
| `.context/criterion.md:179` MUST：**该语义为确定行为，不得当作异常**：不引入 `dirChangedDuringSave` 之类的告警标记 | `openspec/changes/fix-unauthorized-injoys-doc-write/tasks.md:24` 保留确定语义，未新增目录变化告警 | ✅ |
| `.context/criterion.md:180` MUST：**配置页切换提示文案**（实现时照此展示）：新目录对后续操作生效；正在进行的保存仍写入原目录。旧草稿不会自动迁移 | `openspec/changes/fix-unauthorized-injoys-doc-write/proposal.md:57`、`:85` 不改配置 UI 或提示 | N/A（不改配置界面） |
| `.context/criterion.md:181` MUST：**写入前准备并校验目录**：目标目录不存在则创建，且必须**验证确实可写**（创建并删除唯一命名的探测文件）；仅检查存在性不足——已存在但只读的目录会让 `mkdir` 成功却在首次写入失败。不可用须如实抛错（`DraftStorageError`） | `openspec/changes/fix-unauthorized-injoys-doc-write/tasks.md:27`、`:29` 继续调用既有 saveDraft；预检由 `src/storage/draft-store.ts:146`、`:150` 提供 | ✅ |
| `.context/criterion.md:182` MUST：**存储错误码统一**：写盘失败一律返回 `drafts/storage-unavailable`，须在**统一 RPC 错误边界**映射，覆盖 `drafts.save` / `drafts.updatePublishUrl` / 预填回写等**所有**写入口，不得漏出 `ops/internal-error` | `openspec/changes/fix-unauthorized-injoys-doc-write/tasks.md:24` 保留存储异常；`openspec/changes/fix-unauthorized-injoys-doc-write/proposal.md:92` 不更改统一边界；无需新建重试/错误体系 | ✅ |
| `.context/criterion.md:183` MUST：**写锁按绝对文件路径归属**，使不同库中的同 ID 草稿互不阻塞、互不覆盖 | `openspec/changes/fix-unauthorized-injoys-doc-write/tasks.md:24` 沿用存储实现；`src/storage/draft-store.ts:192` 既有锁按绝对路径 | ✅ |
| `.context/criterion.md:186` MUST NOT：绕过 `config-store` / `draft-store` 模块直接操作配置文件或草稿文件 | `openspec/changes/fix-unauthorized-injoys-doc-write/tasks.md:24`、`:27`、`:29` 通过 DraftStore，不直接操作草稿文件 | ✅ |
| `.context/criterion.md:187` MUST NOT：在无锁情况下并发回写同一草稿文件 | `openspec/changes/fix-unauthorized-injoys-doc-write/tasks.md:23` 删除第二次回写；`openspec/changes/fix-unauthorized-injoys-doc-write/tasks.md:24` 首次落盘沿用原锁 | ✅ |
| `.context/criterion.md:188` MUST NOT：在单次操作中途重新解析 `draftsDir`（会导致「从 A 库读取、写入 B 库」并覆盖 B 库同 ID 草稿） | `openspec/changes/fix-unauthorized-injoys-doc-write/tasks.md:24` 显式保留目录；Q-02 纠正四条路径证据范围 | ✅（修改点） |
| `.context/criterion.md:189` MUST NOT：先让 `config.save` 报告成功、再由后续 `drafts.save` 以 `ENOENT` 失败 | `openspec/changes/fix-unauthorized-injoys-doc-write/proposal.md:25` 至 `:29` 仅删除内容写入调用，`openspec/changes/fix-unauthorized-injoys-doc-write/tasks.md:88` 不扩展其他执行路径；该规则对应模块未修改 | N/A（无对应能力或接口变化） |
| `.context/criterion.md:190` MUST NOT：**让测试写入开发者真实的 `$DSH_HOME`**：`ConfigStore` 经 `resolveDshHome` 回退到真实主目录，测试直接 `new ConfigStore(undefined, …)` 并调用 `save()` 会改写用户真实配置。隔离必须在**测试文件被导入/收集之前**生效（`tests/setup-isolation.ts` 在模块作用域赋值，**不得**放在 `beforeAll`——钩子在收集之后才运行，用例在 describe 作用域捕获的仍是未隔离值，`afterEach` 恢复它会把真实目录带回来）；每个会写配置的用例应使用独立 `DSH_HOME` 或显式 `profileContext.home` | `openspec/changes/fix-unauthorized-injoys-doc-write/tasks.md:58` 要求 setupFiles 隔离；实测 `tests/setup-isolation.ts:26`、`:29` 在收集前生效 | ✅ |
| `.context/criterion.md:154` 令牌例外按本机受信任客户端而非同进程界定 | `openspec/changes/fix-unauthorized-injoys-doc-write/proposal.md:85` 不修改客户端/令牌链路 | N/A（无令牌回填改动） |
| `.context/criterion.md:156` config.save 同属本机回填例外，不可外传 | `openspec/changes/fix-unauthorized-injoys-doc-write/proposal.md:85` 不改配置响应 | N/A（无配置响应改动） |
| `.context/criterion.md:158` 若对非本机暴露，先回 hasToken；日志遥测脱敏 | `openspec/changes/fix-unauthorized-injoys-doc-write/tasks.md:88` 未增加网络暴露或日志 | N/A（不扩大暴露面） |
| `.context/criterion.md:196` Bearer 认证与 BrowserOS Profile 登录态 | `openspec/changes/fix-unauthorized-injoys-doc-write/proposal.md:47` 保留 InjoysClient 实现 | N/A（认证方案未改） |
| `.context/criterion.md:197` 密钥禁硬编码、限定来源、显隐、脱敏 | `openspec/changes/fix-unauthorized-injoys-doc-write/proposal.md:85` 不改客户端/配置；`openspec/changes/fix-unauthorized-injoys-doc-write/tasks.md:88` 不增加直连 | N/A（无凭据配置或日志变化） |
| `.context/criterion.md:198` HTTPS 强制、HTTP 状态及 result.isError 校验 | `openspec/changes/fix-unauthorized-injoys-doc-write/proposal.md:47` 保留网络实现；`src/injoys/client.ts:67` 既有回环 HTTP 不因本提案认可为远端 HTTPS 合规 | N/A（未改变传输层） |
| `.context/criterion.md:199` 能力开关默认八项、集中检查、业务守卫独立 | `openspec/changes/fix-unauthorized-injoys-doc-write/proposal.md:52`、`:57` 排除浏览器能力/UI；`openspec/changes/fix-unauthorized-injoys-doc-write/tasks.md:88` 无绕过 | N/A（无 BrowserOS 调用变更） |
| `.context/criterion.md:200` Cookie 不向第三方上报 | `openspec/changes/fix-unauthorized-injoys-doc-write/tasks.md:88` 不新增远端调用，也未增加会话数据读取 | ✅ |
| `.context/criterion.md:202` 绝不自动确认发布，禁止重引 ops_publish_now | `openspec/changes/fix-unauthorized-injoys-doc-write/proposal.md:52`、`openspec/changes/fix-unauthorized-injoys-doc-write/tasks.md:88` 不新增发布或预填能力 | ✅ |
| `.context/criterion.md:203` URL 解析器、published 专用写入口与拒绝码 | `openspec/changes/fix-unauthorized-injoys-doc-write/tasks.md:24` 保留 DraftStore；不改回填入口 | N/A（发布状态守卫未改） |
| `.context/criterion.md:204` publishedUrls 为宿主治理字段，通用保存忽略外传值 | `openspec/changes/fix-unauthorized-injoys-doc-write/tasks.md:27`、`:29` 未改变 publishedUrls 输入处理 | N/A（不改发布凭据处理） |
| `.context/criterion.md:205` 全渠道 URL 条件、渠道变动重算、同锁保证 | `openspec/changes/fix-unauthorized-injoys-doc-write/tasks.md:24` 保留存储模块；无状态规则变更 | N/A（无渠道状态变更） |
| `.context/criterion.md:206` 状态优先级、部分回填固定 prefilled、剪除孤儿 URL | `openspec/changes/fix-unauthorized-injoys-doc-write/tasks.md:27`、`:29` 保留既有存盘；`src/storage/draft-store.ts:292` 既有实现未改 | N/A（无状态规则变更） |
| `.context/criterion.md:207` 回填渠道须属于变体集合，不写盘不增版本 | `openspec/changes/fix-unauthorized-injoys-doc-write/proposal.md:80` 限定 generateArticle 分支，不改 updatePublishUrl | N/A（无 URL 回填变更） |
| `.context/criterion.md:208` 预填止于平台原生保存草稿 | `openspec/changes/fix-unauthorized-injoys-doc-write/proposal.md:52` 不扩展预填能力 | N/A（无预填变更） |
| `.context/criterion.md:209` 预填返回直达链接、最终人工发布 | `openspec/changes/fix-unauthorized-injoys-doc-write/proposal.md:52`、`:57` 不改预填/UI | N/A（无预填变更） |
| `.context/criterion.md:210` 生成仅本地，显式授权才写文档，知识库可读取 | `openspec/changes/fix-unauthorized-injoys-doc-write/proposal.md:25` 至 `:29`、`openspec/changes/fix-unauthorized-injoys-doc-write/specs/injoys-write-boundary/spec.md:5`、`:32` 删除五调用；`openspec/changes/fix-unauthorized-injoys-doc-write/tasks.md:64` 按 document.create 名称断言 | ✅（验收表述另见 Q-02） |
| `.context/criterion.md:211` 指标失败为 null，不得伪造/估算/补零 | `openspec/changes/fix-unauthorized-injoys-doc-write/tasks.md:32` 不改 reporter 指标计算，只删写入尾部 | N/A（既有指标问题未承诺偿还） |
| `.context/criterion.md:212` 未全采集不冒充总量，标注覆盖范围 | `openspec/changes/fix-unauthorized-injoys-doc-write/tasks.md:32` 无指标汇总规则变化 | N/A（无汇总规则变更） |
| `.context/criterion.md:213` 真实 0 有效，与失败 null 区分 | `openspec/changes/fix-unauthorized-injoys-doc-write/tasks.md:32` 无指标计算变化 | N/A（无零值规则变更） |
| `.context/criterion.md:214` 环比用本地历史，不足时 delta=null | `openspec/changes/fix-unauthorized-injoys-doc-write/tasks.md:32` 无历史/环比改动 | N/A（无环比规则变更） |

§4 的 `.context/criterion.md:201` 是“审计与风控”分组标题，无独立规则，其 8 个子 bullet 已在 :202–:209 分行检查；代码块中的目录清单不是 MUST，不计入 49 条。§6 / §7 补充核对：`openspec/changes/fix-unauthorized-injoys-doc-write/tasks.md:15` 至 `:19` 已在实现前核验类型/方法契约，符合 `.context/criterion.md:304`、`:306`；契约入口为 `:329`，`openspec/changes/fix-unauthorized-injoys-doc-write/tasks.md:17` 校验命令对应 `:337`，无 codegen 的结论符合 `:343`。API 文档现状同步例外见第 4.4 节，不将其混称为类型契约变更。

## 6. 业务规则契合度

| BR-xxx | 满足/不满足/缺失 | 提案引用位置 | 证据 |
|---|---|---|---|
| BR-030 | 满足禁止自动上传；持久化验收表述有缺陷 | `openspec/changes/fix-unauthorized-injoys-doc-write/proposal.md:126`、`:25`、`openspec/changes/fix-unauthorized-injoys-doc-write/tasks.md:27`、`:29` | `.context/domain/business_rules.md:173`；RPC 图文及工具图文/视频保留落盘，Launch 不可虚称已有落盘（Q-02） |
| BR-033 | 满足显式授权边界；首版入口阶段存在上游差异 | `openspec/changes/fix-unauthorized-injoys-doc-write/proposal.md:51`、`:126` | `.context/domain/business_rules.md:201`、`:204` 要 Phase 0 入口，与 Phase 2 规划冲突（Q-05），不应判整条已交付 |
| BR-040 | 满足依赖标记不代表上传授权；不涉及分类 UI | `openspec/changes/fix-unauthorized-injoys-doc-write/proposal.md:37`、`:38`、`:126` | `.context/domain/business_rules.md:223` 明确两入口可共享服务，不要求工具反调 RPC |
| BR-073 | 不满足正常复盘不播报沉淀成功的要求；其他降级不在影响面 | `openspec/changes/fix-unauthorized-injoys-doc-write/proposal.md:55`、`:56`、`:62`、`:126` | `.context/domain/business_rules.md:354`、`:355`；`src/tools/index.ts:604`、`:635` 仍假编号，Q-01；生成只读兜底不等于远端沉淀成功 |
| BR-NFR-002 | 满足本轮五处文档写入边界 | `openspec/changes/fix-unauthorized-injoys-doc-write/proposal.md:5`、`:69`、`:126` | `.context/domain/business_rules.md:452`、`:453`、`:454`；没有将 Cookie 发送给 Injoys 的方案；不宣称其他表格/需求池站点已合规 |
| BR-021 | N/A（未触碰发布确认闭环） | `openspec/changes/fix-unauthorized-injoys-doc-write/proposal.md:25`、`:85` | `.context/domain/business_rules.md:122`、`:129`；`src/ops-rpc.ts:420` 仍 ready_for_review，不添加 published 写入 |
| BR-022 | N/A（未触碰预填/正式发布铁律） | `openspec/changes/fix-unauthorized-injoys-doc-write/proposal.md:52`、`openspec/changes/fix-unauthorized-injoys-doc-write/tasks.md:88` | `.context/domain/business_rules.md:141`、`:143`；无自动发布新增 |

本轮相关 BR 逐条列出，不将“未触及”冒充整个产品已满足；不要求为与此变更无关的所有 BR 新增任务。`.context/domain/user_journeys.md:122`、`:138` 的本地保存与失败提示提供交叉佐证，不是强制补引资产。

## 7. 路线图关联、接口契约与整合建议

依赖链实测为：A3 `fix-unauthorized-injoys-doc-write` → A4 `fix-doc-id-fabrication`；A3 → Phase 2 `feat-workbench-sink-to-injoys-doc`。索引证据 `openspec/proposal-roadmap.md:194`、`:195`、`:207`，提案证据 `openspec/changes/fix-unauthorized-injoys-doc-write/proposal.md:90`、`:91`。A3 的优先级 P0、无前置、in-progress 与 Phase 块 `openspec/proposal-roadmap-Phase-0.md:201`、`:203` 一致；唯一抄录差异为 Q-07。

A4 与 A3 会顺序改同文件同区域：`src/tools/index.ts:597`、`:635`、`:912`、`:933`，并需先后调整 Launch 测试 `tests/ops-manager.spec.ts:644`。A3 先删调用/暂空串，A4 再取消 required/去回退/修正空值呈现；不得把 A3 的空串测试照搬为 A4 最终验收。`openspec/proposal-roadmap-Phase-0.md:857` 已规定严格顺序；M-1 只加强用户交付门禁，不反转依赖。

`feat-injoys-test-document-count` 也改 `src/ops-rpc.ts`，但在 injoys.test 响应区域（`openspec/proposal-roadmap-Phase-0.md:631`、`:648`），A3 在 generateArticle 区域（`src/ops-rpc.ts:392`）。这是同文件合并/上下文行号漂移风险，不是功能依赖，不应无依据新增硬前置。变基后复核相应 case、运行原有 typecheck/test 即可；相关单元测试与响应字段不能互相覆盖。

接口兼容性：

- RPC 返回的 injoysDocId 不再填充属于既有可选形状（`src/types.ts:81`、`.context/architecture/api_strategy.md:294`、`:298`），序列化后 undefined 通常表现为字段省略；不能要求线上 JSON 带字面值 undefined。方法/信封不变，目标契约兼容，行为是纠正已有越界。
- `ops_*` 由 AI 会话消费，其 canonical schema 与 render 都是契约面（`.context/architecture/api_strategy.md:743`；`node_modules/@deepseek-ai/dsh-tools/lib/types/schema.d.ts:187`、`:190`）。图文 docId / 视频 injoysDocId 本就可选（`src/tools/index.ts:191`、`:299`），现有 render 有空值分支（`:200`、`:305`）。Launch 的空串是 schema 兼容但语义退化；review 的 doc_review 是 schema 合法但业务不合规（`:597`、`:604`、`:635`），不能仅凭 typecheck 认定兼容且正确。
- 同仓客户端当前仅调用 config.get/config.save/browser.sessions/injoys.test（`plugin-src/client/ops-page.js:36`、`:51`、`:72`、`:100`）；`rg` 检查 plugin-src 无 injoysDocId/docId 消费。`plugin-src/management-rpc.mjs:17`、`:25` 是通用信封封装，不因空编号而需改。没有证据表明外部 AI 调用方都能兼容空串，因此风险须对用户可见版本收口，而非虚称所有调用方已验证。
- `ReviewReporter` 保留构造函数无运行时不兼容（`src/analytics/review-reporter.ts:15`，`openspec/changes/fix-unauthorized-injoys-doc-write/tasks.md:34`）；未使用参数不会被当前 tsconfig 判错（`tsconfig.json:2` 至 `:18`），无需为美观扩大签名变更。

## 8. 技术与交付风险清单

责任归属为建议执行角色，不虚构已指定个人；原资产负责人多为 N/A（`.context/architecture/risks_and_debt.md:74`）。

| 风险ID | 触发条件 | 影响 | 缓解方案 | 责任归属 |
|---|---|---|---|---|
| R-A3-A4（高，Q-01） | A3 合入并单独交付，A4 延迟 | 每次正常复盘都播报 doc_review；Launch 显示空编号（`openspec/changes/fix-unauthorized-injoys-doc-write/proposal.md:62`、`:101`） | A3→A4 同次用户交付，最终复盘/Launch 无假编号，两个 render 表示未沉淀；完成 §3.10 同步 | A3/A4 实施者与交付评审者 |
| RISK-004（高，Q-04） | 删除第二次 saveDraft 时误改首次 dir 或捕获时机 | 切库时写错库/产生副本（`src/ops-rpc.ts:397`、`:422`） | 保留 `openspec/changes/fix-unauthorized-injoys-doc-write/tasks.md:24`，沿用 U2 `tests/ops-manager.spec.ts:2261`，不重复建测试 | A3 实施者/代码评审者 |
| R-VERIFY（中，Q-02） | 把复盘/Launch 返回结果当作草稿文件或混淆 RPC 字段 | 不可通过验收或暗中扩建 Phase 2 | 按入口分别断言、本轮保持真实已有落盘，见 M-2 | A3 任务与 spec 维护者 |
| R-DOC（中，Q-03） | 按建议改 README 后执行禁词 grep | 正确授权说明仍被判失败 | 校验完整旧错误句子 + 新说明语义，见 M-3 | 文案/测试维护者 |
| R-PLAN（中，Q-05） | 实施者同时照搬“先补入口”和“Phase 2 才实现” | 排序冲突、错误宣称 BR-033 已满足 | 明示差异与阶段裁决来源，必要时后续 context-update | 路线图维护者/资产维护者 |
| R-SYNC（中） | §3.10 同步延期超过 A4 交付 | 现状表仍称无条件写入（`openspec/changes/fix-unauthorized-injoys-doc-write/proposal.md:103`、`openspec/changes/fix-unauthorized-injoys-doc-write/tasks.md:48`） | 合并 A4 后一次同步 :752–:754、:758 的真实现状，作为 M-1 共同交付项 | A4 实施者/Context 维护者 |
| R-MERGE（低） | document-count 与 A3 同时修改 ops-rpc | 人工合并丢 case 或字段 | 按 `openspec/proposal-roadmap-Phase-0.md:631` 与 `src/ops-rpc.ts:392` 分支复核，变基后常规检查 | 两变更实施者 |

无需引入新监控、指标仪表盘、告警位或额外常驻服务。这里的风险可由交付门禁、mock 工具调用记录、文件断言和既有 U2 验证；`.context/criterion.md:179` 还明确禁止把目录切换确定语义当异常告警。

## 9. 可执行修改建议（本轮不执行）

### M-1（P0，Q-01；两者均需同步）

位置：`openspec/proposal-roadmap-Phase-0.md:281`、`:857`；`openspec/changes/fix-unauthorized-injoys-doc-write/proposal.md:66`、`:102`、`:153`；`openspec/changes/fix-unauthorized-injoys-doc-write/tasks.md:89`、`:90`。

保持 A3→A4 实施顺序，明确 A3 中间状态仅供开发验证，用户可用交付必须同时包含 A4 的两工具可选化/回退移除/空值渲染修正。把 §3.10 现状同步挂入同次交付，避免无期限延后。可独立完成 A3 开发与记录，但不可把它单独作为满足“不虚报成功”的发布成果。若需单独交付，改大纲将两工具最小空值契约与渲染处理前移，并同步重划 A4，不能只改正文。

验收：组合版本生成/复盘无 document.create；正常、未配置与失败场景均不播报 doc_review/doc_launch 时间戳编号，空结果呈现“未沉淀”；两提案校验与测试通过，现状表如实同步。此为防止已知必发业务错误的必要门禁，不是要求新防御机制。

### M-2（P1，Q-02；提案内容；涉及 Launch 落盘措辞时同步大纲澄清）

位置：`openspec/changes/fix-unauthorized-injoys-doc-write/tasks.md:64`、`:65`、`:68`、`:45`、`:87`；`openspec/changes/fix-unauthorized-injoys-doc-write/proposal.md:31`、`:108`；`openspec/changes/fix-unauthorized-injoys-doc-write/specs/injoys-write-boundary/spec.md:5`、`:18`、`:20`；`openspec/proposal-roadmap-Phase-0.md:207`。

分开四类证据：RPC 图文、工具图文、工具视频保留真实本地草稿；复盘只验证结果返回、无 saveReviewDocument/document.create；Launch 本轮保留内存结果返回并阻断文档写入，不暗中新增持久化。knowledge.list 只针对实际读取的调用，允许存在但不强制复盘读取；视频 BDD 区分 RPC titleCandidates 与工具 titleVariant1/2/3、videoPath。U2 只证明 RPC 图文，纠正“四条都请求开始捕获目录”的笼统声明。空串/undefined 是实现返回值约束，不是 expect 断言的编译限制；grep TD-008 后应读取完整条目逐一核对站点。

验收：按这些任务能仅删调用及必要返回值清理而通过；不修改视频 RPC 字段，不为复盘/Launch 新增草稿文件写入。五个调用站点逐一有负向记录断言，三个已落盘内容入口有文件断言，U2 继续通过。若决定新增 Launch 持久化，则需另行改大纲/明确阶段范围，而非保持“只做减法”。

### M-3（P1，Q-03；两者均需同步）

位置：`openspec/changes/fix-unauthorized-injoys-doc-write/tasks.md:40`、`:51`、`:53`、`:54`、`:82`；`openspec/changes/fix-unauthorized-injoys-doc-write/specs/injoys-write-boundary/spec.md:51`、`:57`；`openspec/proposal-roadmap-Phase-0.md:215`、`:257`。

保留 README 三处范围扩充，回填大纲的文案条目和验收方式，修正 In③ 的错误编号。推荐允许“显式沉淀”正常术语：grep 确认原先声称生成即写入的完整旧句已消失，再审查新句准确区分本地生成与用户主动沉淀；不要要求通用短语 grep 为空。或统一使用不命中禁词的准确文案并同步任务，两方案择一即可。

验收：文案和门禁不再互相否定，README :24/:27/:39 与对应 description 一致；不扩大到表格/需求池/海外功能介绍。

### M-4（P1，Q-04；大纲为主，提案内容补 AI 异常边界）

位置：`openspec/proposal-roadmap-Phase-0.md:219`、`:243`、`:254`；`openspec/changes/fix-unauthorized-injoys-doc-write/proposal.md:55`。

大纲补 RISK-004（高），复用正文 `openspec/changes/fix-unauthorized-injoys-doc-write/proposal.md:99` 的捕获目录/保留首次 saveDraft/U2 决定；验证表明确等待知识库期间切库后仍只存 A 库、B 无副本。Out 区分：未连通沉淀入口验收待 Phase 2/3；生成知识库兜底保持既有；AI 生成不可用/重试/不完整内容处理不因本次删调用扩建，但不得破坏现有保存失败错误传播。

验收：大纲与正文风险/边界一致，U2 按 `tests/ops-manager.spec.ts:2323`、`:2324` 验证；无重复测试或 dirChangedDuringSave 标记。

### M-5（P1，Q-05；两者，标明上游来源）

位置：`openspec/proposal-roadmap-Phase-0.md:219`、`:226`；`openspec/changes/fix-unauthorized-injoys-doc-write/proposal.md:51`、`:120`、`:126`；`openspec/changes/fix-unauthorized-injoys-doc-write/tasks.md:47`。

增加明确的规划差异说明：BR-033/API 的 Phase 0 目标和 TD-008 的“先补入口”是上游口径；本路线图先移除越权、后 Phase 2 交付入口，不等同已经满足首版入口要求。保留能力但不能宣称插件能力无空档，Injoys 侧手工操作只是替代工作方式。后续要改 `.context` 时按 context-update 查证裁决并同步，不在本只读评审中改源文档，也不因上游冻结而忽略冲突。

验收：评审者可看出哪个阶段目标仍未满足、为什么先止血、谁负责后续同步；不新增 sink 实现作为 A3 前置。

### M-6（P2，Q-06；大纲）

位置：`openspec/proposal-roadmap-Phase-0.md:228`。

补第 3.2 节列出的 6 份直接相关 Context 资产及具体规则/章节；正文已有引用无需重加，不要求 security_policy/user_journeys 或任何不存在的目录。

验收：目标、本地字段回写、运行时、不谎报、阶段与边缘场景均可从资产表追溯到实际文件。

### M-7（P2，Q-07；提案内容）

位置：`openspec/changes/fix-unauthorized-injoys-doc-write/proposal.md:135`。

将索引状态抄录从 proposed 更正为 in-progress，或引用实际索引而避免复制易过时状态。

验收：与 `openspec/proposal-roadmap.md:194`、`openspec/proposal-roadmap-Phase-0.md:203` 一致；不得改回正确路线图来迎合旧文案。

## 10. F1–F14 逐条回源核对结果

源码检索实际使用 `rg -n 'saveArticleDocument|saveVideoDocument|saveReviewDocument|saveLaunchKitDocument' src/`（与指定 grep 等价），并逐一读取调用上下文和底层方法；不是照抄提案表。其余项同样读取实际对应文件。

| # | 待核对事实 | 实测结果（文件:行号） | 与提案自述是否一致 |
|---|---|---|---|
| F1 | 5 处无条件文档写入调用 | **成立**。`src/ops-rpc.ts:425`、`src/tools/index.ts:231`、`:324`、`:933`、`src/analytics/review-reporter.ts:92`；另 4 命中为方法定义而非调用，无显式沉淀前置条件 | 一致，`openspec/changes/fix-unauthorized-injoys-doc-write/proposal.md:7` 至 `:15`；“无条件”指调用层，底层仍可能因配置/网络失败无实际写入 |
| F2 | 全落到 4 处 document.create | **成立**。`src/injoys/client.ts:391`、`:412`、`:433`、`:518` 分别对应文章/视频/复盘/Launch，文章被两站点复用 | 一致，`openspec/changes/fix-unauthorized-injoys-doc-write/proposal.md:11` 至 `:15` |
| F3 | TD-008 仅登记四站点、遗漏 Launch，看板待处理 | **成立**。`.context/architecture/risks_and_debt.md:294` 只有 RPC 图文、工具图文/视频、reporter；`:426` 状态待处理（优先）；`:297` 仍要求先补入口 | 一致，`openspec/changes/fix-unauthorized-injoys-doc-write/proposal.md:19`、`openspec/changes/fix-unauthorized-injoys-doc-write/tasks.md:42`；其排序冲突另见 Q-05 |
| F4 | API §3.1 本地边界、§3.10 现状表 | **成立**。`.context/architecture/api_strategy.md:15` MVP 裁决，`:298` 图文，`:326` 视频；`:752`、`:753` 无条件写入，`:754` Launch，`:758` 假编号回退 | 一致；该表明确现状含义见 `:744`，延后同步仅可有界接受（第 4.4 节） |
| F5 | 四领域 injoysDocId 已可选 | **成立**。`src/types.ts:81` ContentDraft、`:131` ArticleDraft、`:273` WeeklyReviewReport、`:318` ProductHuntLaunchKit 均为 `?: string \| undefined` | 一致，`openspec/changes/fix-unauthorized-injoys-doc-write/tasks.md:16`；无需为 A3 修改类型，工具 required 不能用领域可选性代替 |
| F6 | Launch/review required 与回退/无空分支 | **成立**。`src/tools/index.ts:912`、`:922`；`:597`、`:635`；复盘 render 同样无空分支在 `:604` | 一致，`openspec/changes/fix-unauthorized-injoys-doc-write/proposal.md:60` 至 `:64`；过渡归属正确，交付门禁不足 |
| F7 | defineTool required 约束 execute 返回 | **成立**。`node_modules/@deepseek-ai/dsh-tools/lib/types/schema.d.ts:187` 注明成功输出 schema 执行约束，`:210` 为 Promise<InferValue<NoInfer<O>>> | 核心一致；`openspec/changes/fix-unauthorized-injoys-doc-write/tasks.md:68` 对 expect 编译限制的推论不成立，Q-02 |
| F8 | criterion 四条关键边界 | **成立**。`.context/criterion.md:210` 内容写入、`:178` 等待知识库后只写本地并贯穿每次落盘、`:102` 错误不吞、`:109` 不虚报成功 | 引用一致；风险接受不能豁免 :109，Q-01 |
| F9 | U2 闸门切 A→B、只写 A | **成立**。`tests/ops-manager.spec.ts:2261` 用例，`:2277` 闸门，`:2293` 替换 getKnowledgeContext，`:2313` 切 B，`:2323` A=1、`:2324` B=0；本轮全量测试通过 | 一致，`openspec/changes/fix-unauthorized-injoys-doc-write/tasks.md:75`；仅证明 RPC 图文，不证明所有工具，Q-02 |
| F10 | 4 处既有断言/桩需调整 | **成立**。`tests/ops-manager.spec.ts:158` 用例名，实际编号断言 `:190`；`:341` report 已定义、`:644` Launch 已定义、`:2298` U2 saveArticle 桩 | 全部被 `openspec/changes/fix-unauthorized-injoys-doc-write/tasks.md:60`、`:71`、`:72`、`:73` 覆盖；无漏改。`:1460` 保留方法失败测试不需改 |
| F11 | README 三处生成即文档表述 | **成立**。`README.md:24`、`:27`、`:39` 逐句确认；其他表格/需求池条目未并入 | 一致，`openspec/changes/fix-unauthorized-injoys-doc-write/tasks.md:49` 至 `:54`；修改必要，验收矛盾见 Q-03 |
| F12 | getKnowledgeContext 调 knowledge.list，不能断总远端数为 0 | **成立**。`src/injoys/client.ts:250`；因此应排除 document.create，而不是排除所有远端调用 | 基本一致，`openspec/changes/fix-unauthorized-injoys-doc-write/tasks.md:64`；其“四条都先读取”过度概括不成立，复盘无该读取，Q-02 |
| F13 | 未启用 noUnusedLocals/noUnusedParameters | **成立**。`tsconfig.json:2` 至 `:18` 无两选项；`:18` 只 include src；保留 `src/analytics/review-reporter.ts:15` 成员不会因此报编译错 | 一致，`openspec/changes/fix-unauthorized-injoys-doc-write/proposal.md:104`、`openspec/changes/fix-unauthorized-injoys-doc-write/tasks.md:34`；无需为此改公共构造函数 |
| F14 | A4/Phase 2 依赖与 A4 三项 In | **成立**。`openspec/proposal-roadmap.md:195`、`:207` 前置 A3；`openspec/proposal-roadmap-Phase-0.md:304` 两工具可选化取消 required、`:305` 去 doc_review、`:306` Launch 返回 Promise<string \| null> 去时间戳回退 | 一致，`openspec/changes/fix-unauthorized-injoys-doc-write/proposal.md:53`、`:91`；应保持范围归属并加强联合交付，不误报 A3 漏做 A4 |

F1–F14 的核心待核对事实全部成立；提案据此额外推出的“四路径都读知识库/都落盘”“expect 断言受 pnpm typecheck 禁止”等结论并不成立，已计入 Q-02，不因事实清单通过而放过提案推论错误。

## 11. 完整性与只读复核

本报告包含五项基线退出码、三阶段结论、逐条 MUST/MUST NOT 矩阵、逐 BR 映射、大纲/目标/任务/依赖对照、路线图与接口影响、风险责任、P0/P1/P2 清单、M-1～M-7 修改建议以及 F1～F14 实测结果。所有修改建议仅供后续用户明确要求后的修复，本次未回写到提案或加入报告引用。报告完成后重新读取并检查章节、矩阵条数、路径和 Markdown 完整性。
