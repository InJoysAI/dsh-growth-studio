# 实现缺陷登记：P0-1 / P0-2 / TD-011 / TD-014 / BrowserOS 会话探测

- **登记日期**: 2026-10-16（§6 BrowserOS 会话探测追加于 2026-10-17）
- **范围**: `dsh-growth-studio` 插件的宿主侧实现、客户端契约测试与 `.context/` 契约的一致性
- **状态**: **未修复**。本文件仅为登记与取证记录；`.context/` 侧已登记（`architecture/risks_and_debt.md` 的 **TD-008 / TD-009 / TD-011 / TD-014**，其中 TD-008 / TD-009 存在覆盖缺口，见 §5；§6 的 Cookie 探测偏差对应 **RISK-003**，但该风险当前标为「已由统一实例缓解」，与实现不符，需回看）。实现侧与测试侧尚未改动。
- **修复前置**: 变更提案所需的 `openspec/config.yaml`、`openspec/proposal-roadmap.md` 已生成（见 §7）；§6 的 Cookie 探测偏差修复仍须走 SSoT-first 提案，不得仅改文档。
- **证据口径**: 所有 `文件:行号` 写于 2026-10-16 的仓库状态，后续改动可能使行号迁移，检索时以符号名（函数名 / 错误码字面量）为准。

> 权威来源：工程约束以 `.context/criterion.md` 为准；技术事实以 `.context/architecture/source/technical_architecture.md`（TAD v1.4.3）为准。本文不重复定义契约，只记录"实现与契约的落差"。

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

## 4. TD-014 客户端 RPC 消费无测试覆盖

**结论：不是运行期 bug，是测试缺口（API 层契约的同步机制未闭环）。**

### 契约（应当怎样）

| 依据 | 原文要点 |
|---|---|
| `.context/criterion.md` §7.2 | API 层契约变更后的同步 / 校验方式为 `pnpm typecheck`（宿主实现）与 `pnpm test`（覆盖面含客户端消费） |
| `.context/architecture/adr_003_custom_rpc_envelope.md`（方案 C 缺点、后果） | 契约一致性依赖 `pnpm typecheck` + `pnpm test` 保障；客户端为 JavaScript，**无编译期类型保证** |
| `.context/architecture/risks_and_debt.md` **TD-014** | 客户端消费测试缺失，已登记为技术债（中） |

信封形状（`src/ops-rpc.ts` / `RpcEnvelopeRequest`、`RpcEnvelopeResponse`，TAD §2.2）是宿主与客户端的共同契约；客户端消费侧（`callOpsRpc` / `unwrapRpcResult`）应被 `pnpm test` 覆盖，否则该"同步方式"在客户端侧无自动化证据。

### 实现（实际怎样）

| 位置 | 行为 |
|---|---|
| `tests/ops-manager.spec.ts:737` | 仅验证宿主侧 `registerOpsRpc`（信封注册 / 分发） |
| `tests/ops-manager.spec.ts:692`、`:1257` | `ConfigStore` / `DraftStore` 生命周期、并发冲突，均为宿主侧 |
| `tests/browseros-scraping.spec.ts`、`tests/isolation.spec.ts` | 采集解析与 `$DSH_HOME` 隔离，与客户端消费无关 |
| `plugin-src/management-rpc.mjs:17`（`callOpsRpc`）、`:25`（`unwrapRpcResult`）、`plugin-src/client/index.js:44`、`plugin-src/client/ops-page.js` | 客户端消费实现（JavaScript / ESM），**无对应测试** |

关键事实：`grep -rn "callOpsRpc\|unwrapRpcResult" tests/` 为**空**——现有宿主信封测试不能证明客户端消费已被覆盖。

### 影响

- 宿主信封（`{ ok, result?, error? }`）与客户端解包（`unwrapRpcResult` 取 `result.value`、失败抛错并保留 `error.code`）的一致性缺少自动化证据。
- criterion §7.2 所述「同步方式」在客户端侧目前只是**目标口径而非既有保障**，易被误读为已覆盖。
- 客户端为 JavaScript，无编译期类型校验，测试是唯一可自动化的防线。

### 建议修复方向（SSoT-first）

1. 为 `callOpsRpc` 补用例：请求构造（`method` / `payload` / `signal`）、经 `POST /api/ops` 调用、网络异常与错误码透传。
2. 为 `unwrapRpcResult` 补用例：`ok: true` 解包 `result.value`；`ok: false` 抛出并保留 `error.code` / `error.message` / `error.details`。
3. 补一条「宿主响应形状 ↔ 客户端解包」契约用例，锁定信封字段形状（当前实现口径为 `{ value }`，**不得**改为嵌套 `{ config }`）。
4. 该批变更属测试 / 实现变更，须走提案（受 §6 的 OpenSpec 资产缺失阻塞）。

### 验收口径

- `pnpm test` 中存在引用 `callOpsRpc` / `unwrapRpcResult` 的用例，且覆盖成功解包与失败透传两条路径。
- 信封字段形状或错误语义变更时，客户端消费用例**会失败**（而非静默通过）。

---

## 5. 与 `.context/` 登记项的对应关系

| 本文 | `.context` 登记 | 类型 | 严重性 |
|---|---|---|---|
| §1 P0-1（5 处写入站点） | `architecture/risks_and_debt.md` **TD-008** | 契约 / 实现债务 | 高 |
| §2 P0-2（`ops_generate_review` + `ops_draft_launch_kit` 2 处假编号） | `architecture/risks_and_debt.md` **TD-009** | 契约 / 实现债务 | 高 |
| §3 TD-011 | `architecture/risks_and_debt.md` **TD-011** | 契约 / 代码债务 | 低 |
| §4 TD-014（客户端消费测试缺口） | `architecture/risks_and_debt.md` **TD-014** | 测试债务 | 中 |
| §6 BrowserOS 会话探测（读日用 Cookie 当已认证） | `architecture/risks_and_debt.md` **RISK-003**（状态当前误标「已缓解」） | 实现偏差 / 风险 | 高 |

> ⚠️ **已知覆盖缺口**：TD-008 仅登记 4 处写入站点（漏 `ops_draft_launch_kit`）；TD-009 仅登记 `ops_generate_review` 一处假编号（漏 `ops_draft_launch_kit` / `saveLaunchKitDocument`）。两处需在下次 `.context` 维护时补登（并同步 Manifest 与 history）。
> ⚠️ **新增覆盖缺口（§6）**：RISK-003 在 `risks_and_debt.md` 的状态为「已由统一实例缓解」，但实现侧 `browser.sessions`（`reuseHostBrowserProfile` 默认 true）仍在读取日用浏览器 Cookie 判定登录态，与「统一实例探测」目标不一致；需回看并补登为「未缓解/待修复」。

相关但不在本文范围（已另行登记）：

- **TD-007** `workbench.overview` 缺失"部分缺失 → `null`"汇总语义。
- **TD-010** `calendar/` 与 `metrics/` 持久化契约未落地。
- **TD-012** BrowserOS 动作白名单契约与实现不一致（安全边界缺口）。
- **TD-013** criterion 文件权限约束无实现落点。
- **PD-006**（`domain/risks_and_debt.md`）PRD §5.5.1 中 3 个 `ops_*` 工具未实现且未按名登记。

覆盖闭环见 `.context/domain/testing_strategy.md` 的"风险覆盖对照（RISK ↔ 验收场景）"。

---

## 6. BrowserOS 会话探测：读日用浏览器 Cookie 当已认证（实现偏差）

**结论：相对「统一实例探测」目标，是实现偏差（制造会话假阳性）；不是崩溃型 bug，是历史 `reuseHostBrowserProfile` 路径未被移除。**

### 目标（应当怎样）

| 依据 | 原文要点 |
|---|---|
| `.context/architecture/source/technical_architecture.md` §5.1.2 | 彻底收敛为统一 BrowserOS 实例：登录态探测、预填、指标采集由同一实例调度；轻量探测经 BrowserOS MCP 查询活跃 Tab / 验签 URL |
| `.context/architecture/source/technical_architecture.md` §5.1.3 | dsh-growth-studio 复用当前连接的 BrowserOS 实例；Profile 创建/路径/隔离由 BrowserOS 或宿主管理；插件**不自行读取日用浏览器 Cookie，也不切换 Profile** |
| `.context/architecture/source/technical_architecture.md` §3.10.1 | `reuseHostBrowserProfile` 标记为**待废弃的历史配置**，不应再读取宿主浏览器 Cookie 作为 BrowserOS 已认证证据 |
| `.context/architecture/risks_and_debt.md` RISK-003 | 会话状态假阳性（工作台显示「就绪」但实际未登录）；「原方案（探取日用 Chrome Cookie 库）已被证实存在此根本缺陷」 |

### 实现（实际怎样）

| 位置 | 行为 |
|---|---|
| `src/browser/session-guard.ts:151`（`findHostBrowserCookiesPath`） | 枚举 Linux/macOS/Windows 下 Chrome/Chromium/Edge/Brave/BrowserOS 的 `Cookies` SQLite 路径，返回首个存在的 |
| `src/browser/session-guard.ts:187`（`checkAllRealSessions`） | 拷贝该 SQLite 到临时文件，用 `node:sqlite` 读 `cookies` 表，按 `PLATFORM_COOKIE_RULES` 匹配 cookie 名，命中即判定 `authenticated` |
| `src/ops-rpc.ts:185`（`browser.sessions`） | `reuseHostBrowserProfile` 默认 true 时，走 `checkAllRealSessions` 路径；仅当 `activeTabs.length > 0` 时才用 `checkBrowserSessions` 覆盖，否则直接用 Cookie 结果 |

关键事实：`DEFAULT_OPS_CONFIG.reuseHostBrowserProfile = true`（`src/config-store.ts:64`），因此**默认就会读日用浏览器 Cookie**。这与 `checkBrowserSessions`（基于 BrowserOS 活跃 Tab URL）是两条路径：前者把「Cookie 存在」当「BrowserOS 已认证」，正是 §5.1.1 立论批判的「实例不一致 → 假就绪」。

### 影响

- 工作台可能显示「authenticated（就绪）」而实际 BrowserOS 实例未登录，用户预填时才失败（RISK-003 假阳性）。
- 与「会话数据零外发」的隐私承诺存在落差：虽然实现是本地拷贝 SQLite 到临时文件（不向第三方上报），但把个人 Cookie 读入进程内存，与「仅存在性探测」的隐私边界不符（TAD §5.1.1 第 3 点已指出该落差）。

### 建议修复方向（SSoT-first）

1. 在 `browser.sessions` 中**移除** `checkAllRealSessions`（读日用 Cookie）分支，统一走 `checkBrowserSessions`（BrowserOS 活跃 Tab / 验签 URL 探测）。
2. `reuseHostBrowserProfile` 经**兼容方案退出**：先忽略该字段并强制统一实例探测，保留字段与旧配置解析（不直接删字段破坏旧配置），后续版本再彻底移除。
3. 同步 `.context/architecture/risks_and_debt.md`：RISK-003 状态由「已由统一实例缓解」改为「未缓解/待修复」，并在 TD-012 之外单列该探测分支移除任务。
4. 补测试：`browser.sessions` 不因 `reuseHostBrowserProfile=true` 而读本机 Cookie SQLite。

### 验收口径

- `reuseHostBrowserProfile=true` 时，`browser.sessions` 仍只基于 BrowserOS 实例探测，不读日用浏览器 Cookie。
- 日用 Chrome 存在登录 Cookie 但 BrowserOS 实例未登录时，会话状态返回 `needs_login` / `unknown`，而非 `authenticated`。

---

## 7. 修复前置：OpenSpec 资产状态

2026-10-16 已生成 `openspec/config.yaml` 与 `openspec/proposal-roadmap.md`（见 `context-manifest.json#last_openspec_project`）。故本报告 §1～§4 的修复可走提案；§6 的 Cookie 探测偏差修复**同样须走 SSoT-first 提案**（先改 `criterion.md` §7.1 契约 / 类型，再实现，再测试），不得仅改文档。

---

## 8. 建议的修复顺序（提案内）

按 `criterion §6` 的 SSoT-first 顺序，§1～§4 可并入**同一条**修复提案（同批接口 / 工具 / 客户端契约测试）；§6 的 Cookie 探测移除建议**单列一条提案**（安全边界，与能力开关提案解耦）：

```
§1～§4（写入边界 / 假编号 / 错误码 / 客户端测试）:
  src/types.ts（injoysDocId 可空等类型调整，如有）
      ↓
  src/ops-rpc.ts（补 sinkToInjoysDoc 契约；统一错误码）
      ↓
  src/tools/index.ts（工具 schema / 描述 / 去假编号）与 src/injoys/client.ts、src/analytics/
      ↓
  测试 + .context 资产回填 + Manifest / history 刷新
  （含 TD-014：callOpsRpc / unwrapRpcResult 客户端消费用例 + 信封形状契约用例）

§6（BrowserOS 会话探测去 Cookie 化）:
  src/browser/session-guard.ts（移除 checkAllRealSessions 调用）+ src/ops-rpc.ts（browser.sessions 分支）
      ↓
  src/config-store.ts（reuseHostBrowserProfile 兼容退出）
      ↓
  .context 资产回填（RISK-003 状态 + 新增 TD）+ Manifest / history 刷新
```

优先级：P0-2（真 bug，可独立小修）≥ P0-1（越权写入，行为范围较大）> §6 会话探测偏差（安全/假阳性）> TD-011（设计一致性）> TD-014（补客户端消费测试；无契约变更，可随同批提案收口）。
