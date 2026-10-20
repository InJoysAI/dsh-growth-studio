# `fix-storage-file-permissions` 三层联合评审报告

> **评审画像**：`proposal`（Outline ↔ Proposal ↔ Context 三层联合评审）
> **评审日期**：2026-10-20
> **评审范围**：`openspec/proposal-roadmap.md` 索引行（第 153 行）+ `openspec/proposal-roadmap-Phase-0.md`「提案 7」正文（第 541–586 行）+ `openspec/changes/fix-storage-file-permissions/` 全部工件 + Manifest 登记且实际存在的相关 `.context/` 资产
> **评审方式**：只读审查；除本报告外未修改任何文件
> **证据命令**：
> - `node design/context-dev/tools/specflow/specflow.mjs status fix-storage-file-permissions` → `proposal/specs/design/tasks` 全 ✅，`Ready: none`，`ExecutionComplete: no (0/34)`
> - `node design/context-dev/tools/specflow/specflow.mjs validate fix-storage-file-permissions --strict` → `✅ OK`
> - `grep -rn "writeFileSync|mkdirSync|copyFileSync|chmod|mode:" src/` → 落盘点仅 `src/storage/draft-store.ts`、`src/config-store.ts`、`src/browser/session-guard.ts:197`
> **排除项**：`business_rules.md` / `user_journeys.md` / `edge_cases.md` / DB / UI / Legacy（判定见 §3、§1.3.3）

---

## 1. 综合结论

### 1.1 结论

**PASS (Conditional)**

| 统计 | 数量 |
|------|------|
| P0（阻塞） | **0** |
| P1（重要） | **4** |
| P2（建议） | **7** |

方向、范围与实现方案成立：提案忠实承接了 Roadmap 的业务目标、In/Out、3 条关键任务与 3 条验收项；`specflow validate --strict` 通过；未引入新的安全回归；对 API 层契约零改动的主张经核对成立。但以下 4 项 P1 必须在实施或归档前关闭，故不能给无条件 PASS：

1. **统一落盘封装的下游契约未闭合**：`src/storage/local-fs.ts` 只提供权限位 + 目录创建 + 原子写，写锁仍为 `DraftStore` 私有、错误类型仍留在 `draft-store.ts`；而 `feat-storage-metrics-snapshot` 明文要求复用「权限位 + 原子写 + 写锁 + 目录固定 + 统一错误码」的整体封装（P1-1）。
2. **`ConfigStore.save()` 吞错的覆盖论断不准确且未登记独立债务**：该行为同时违反 `criterion.md` §3.2 MUST「错误不得吞没」与 MUST NOT「虚报成功」，并命中 `RISK-005` 缓解措施 ③；提案仅以 §3.5 的 `draftsDir` 预检论证「已覆盖」，结论过强（P1-2）。
3. **「既有文件不回改」的边界对目录不成立，且「使 MUST 成立」属过度声明**：`mkdirSync` 不会修正已存在目录，配置令牌文件也可能在下次保存前长期保持宽权限（P1-3）。
4. **大纲「`src/` 内落盘调用均设定模式」与提案对 `session-guard.ts` 的排除字面冲突**：需同步大纲验收口径，或把提案 6 明确为「无遗漏」验收的硬前置（P1-4）。

### 1.2 三阶段小结

| 阶段 | 结论 | 核心发现 |
|------|------|----------|
| **阶段一：大纲 ↔ Context** | **中** | 业务目标与 §3.5 MUST / TD-013 对齐；大纲关联资产少列 4 项必要资产；大纲验收「无遗漏」与提案排除项冲突；大纲无风险字段 |
| **阶段二：大纲 ↔ 提案** | **部分一致** | 目标、In/Out、3 条关键任务、3 条验收均有落点；边界漂移集中在「统一落盘封装」的范围定义与 `session-guard` 排除；依赖声明比大纲更完整 |
| **阶段三：提案 → Context** | **基本合规（有条件）** | 未新增 MUST/MUST NOT 违反；§3.2 吞错与 §3.5 既有对象权限为**既有偏离**，提案未加剧但其中一处论断不准确；接口契约确无变更面 |

### 1.3 阶段一：大纲 ↔ `.context` 明细

#### 1.3.1 一致性评级：中

- 目标层：**高**。`openspec/proposal-roadmap-Phase-0.md:548-549` 的业务目标逐字对应 `.context/criterion.md:175` 与 `.context/architecture/risks_and_debt.md:345-355`。
- 资产层：**中**。大纲只列 3 项（`proposal-roadmap-Phase-0.md:560-566`），提案列 7 项（`proposal.md:87-97`）；缺少的 4 项均为必要依据（见 1.3.3）。
- 验收层：**中**。大纲「`src/` 内落盘调用均设定模式」（`proposal-roadmap-Phase-0.md:579`）与提案排除 `session-guard.ts`（`proposal.md:70`）字面冲突。
- 风险层：**低**。Phase-0 提案 7 块（`proposal-roadmap-Phase-0.md:541-586`）没有风险字段；TD-013 只在关联资产表出现，未形成风险条目。

#### 1.3.2 业务目标对照表

| 大纲目标 | `.context` 依据 | 对齐状态 |
|----------|----------------|:--------:|
| 使「系统文件权限仅限当前操作系统用户」在实现层成立 | `criterion.md:175`（§3.5 MUST） | ✅ |
| 避免多用户主机上草稿与配置（含 Injoys 令牌）被同机其他用户读取 | `security_policy.md:104-112`（存储层加密表：Token/草稿均以文件系统权限为保护方式）；`data_architecture.md:361`；`api_strategy.md:815-819`；`tech_stack.md:116-124` | ✅ |
| 偿还 TD-013 | `risks_and_debt.md:345-355`、追踪看板 `risks_and_debt.md:414` | ✅ |
| （替代依据是否成立）本提案不以 `business_rules.md` 为依据 | `business_rules.md:13` 明确「存储路径、锁/事务、错误码等技术约束不写在这里」；BR-030（`business_rules.md:171-178`）只约束「本地存盘/不上传」，不约束权限位；BR-071（`business_rules.md:334`）只约束凭证可见管理，不约束静态权限 | ✅ **成立** |

> **裁定**：以 `criterion.md` §3.5 + TD-013 替代 BR 作为业务目标依据**成立**。理由：业务规则文件自身声明技术约束归 criterion/architecture；权限位不改变任何用户可感知流程。建议在 `proposal.md` 增一句「无直接 BR；BR-030/BR-071 仅间接相关」以免读者误判（P2-7）。

#### 1.3.3 关联资产覆盖度

| 大纲引用（`proposal-roadmap-Phase-0.md:560-566`） | 必要性 | 判定 |
|--------------------------------------------------|:------:|------|
| `.context/criterion.md` | 必要 | ✅ 已引用 |
| `.context/architecture/risks_and_debt.md` | 必要 | ✅ 已引用（TD-013） |
| `.context/architecture/api_strategy.md` | 必要 | ✅ 已引用（§5.3） |
| `.context/architecture/security_policy.md` | 必要 | ❌ **大纲缺失**；提案已补（`proposal.md:94`）。「存储层加密」表（`security_policy.md:104-112`）是「权限位为 Token/草稿唯一保护手段」的直接依据 |
| `.context/architecture/data_architecture.md` | 必要 | ❌ **大纲缺失**；提案已补（`proposal.md:95`）。「数据治理/文件权限」（`data_architecture.md:361`）与物理模型（`data_architecture.md:251-273`）给出两类落盘位置 |
| `.context/architecture/tech_stack.md` | 必要 | ❌ **大纲缺失**；提案已补（`proposal.md:96`）。「持久化 MUST」（`tech_stack.md:116-132`）逐条列出原子写/锁/目录/权限/错误码 |
| `.context/domain/testing_strategy.md` | 必要 | ❌ **大纲缺失**；提案已补（`proposal.md:97`）。TD-013 行（`testing_strategy.md:534`）定义「落盘文件 `0o600`/目录 `0o700` 权限位、无 BDD 场景」的验收口径 |

- **多余引用**：无。提案的 7 项均能在正文找到使用点；`api_strategy.md` 虽只提供「存储加密 N/A」一句，但它是「不能靠加密补位」的关键反证，不属多余。
- **裁定**：提案新增的 4 项全部属「必要补充」，不是「多余引用」；**大纲的资产表应补齐这 4 项**（P2-1）。
- **未列入的资产及理由**：`business_rules.md`（见 1.3.2）、`user_journeys.md`（权限位不改变旅程）、`edge_cases.md`（`edge_cases.md:11-14` 声明只收用户视角异常；全文检索无权限/umask/落盘条目）、`domain/risks_and_debt.md`（无落盘相关业务风险，检索仅命中平台账号权限 RISK-B002）、DB/UI/Legacy（Manifest `generated_files` 无 `db`/`legacy` 键；`ui` 仅 `source/` 且本提案不改 UI）。

#### 1.3.4 In/Out 边界问题清单

| # | 问题 | 证据 | 裁定 |
|---|------|------|------|
| 1 | 大纲 Out 未列 `session-guard.ts` 宿主 Cookie 临时副本 | 大纲 Out 仅 2 项（`proposal-roadmap-Phase-0.md:557-558`）；提案新增排除（`proposal.md:32`） | **范围划分正确**：Phase-0 提案 6 的 In 已明确「移除复制宿主 Cookie SQLite 并查询的路径」（`proposal-roadmap-Phase-0.md:455`），且两提案同改 `session-guard.ts` 会冲突（同文件合并理由见 `proposal-roadmap-Phase-0.md:468`）。**但**：`openspec/changes/fix-browser-session-cookie-probe/` 目前不存在，提案 6 仅为 roadmap 条目；在提案 6 落地前，`session-guard.ts:194-197` 的 `copyFileSync` 仍会创建未显式设权的临时文件。需在大纲/提案中写明该**时序依赖**（P1-4） |
| 2 | 提案额外排除 `ConfigStore.save()` 吞错 | `proposal.md:34`、`design.md:37-40` | **不修正确**（会变更 RPC 成功/失败语义，属契约变更）；**但必须升级为独立缺陷登记**（见 1.3.6、P1-2） |
| 3 | 提案额外排除 `plugin-src/client/build.mjs` | `proposal.md:33` | **正确**：`build.mjs:1,36-37` 使用 `node:fs/promises` 写构建产物，不在 `src/`，且非用户数据 |
| 4 | 大纲 In 写「新建文件 `0o600`」，未界定既有对象 | `proposal-roadmap-Phase-0.md:555`、`proposal-roadmap-Phase-0.md:577` | **对文件可接受、对目录不成立**：`mkdirSync` 不会修正已存在目录，既有 `drafts/`、`ops-manager/` 目录永远不会被收紧；配置令牌文件也可能在下一次 `config.save` 前长期宽权限。见 1.3.5、P1-3 |
| 5 | 大纲 Out 是否遗漏 `edge_cases.md` 中需排除的边缘场景 | `edge_cases.md:20-80` | **无遗漏**：无权限/umask/落盘条目；`edge_cases.md:24` 的「保存失败须如实提示」属 `drafts.save` 业务提示，不是权限位场景 |

#### 1.3.5 验收标准问题清单

| # | 大纲验收项 | 问题 | 证据 | 可验证性 |
|---|------------|------|------|:--------:|
| A1 | 文件权限 `0o600` | 只覆盖新建文件；既有文件「下次保存收紧」无测试；精确等值断言在异常 umask 下会失败（spec 只要求「不得更宽松」） | `proposal-roadmap-Phase-0.md:577`；`design.md:32-35`；`spec.md:35-40`；`tasks.md:40-42` | ✅ 可验证（需补边界） |
| A2 | 目录权限 `0o700` | 只覆盖新建目录；既有目录永不被修正；测试若直接断言 `mkdtempSync` 创建的目录会**空转通过**（`mkdtemp` 本身即 `0700`） | `proposal-roadmap-Phase-0.md:578`；`tasks.md:41` | ⚠️ 可验证性有假阳性风险 |
| A3 | `src/` 内落盘调用均设定模式 | 与提案排除 `session-guard.ts` 字面冲突；`grep "writeFileSync\|mkdirSync"` 不覆盖 `copyFileSync` 与 `fs/promises` 写法 | `proposal-roadmap-Phase-0.md:579`；`proposal.md:70`；`tasks.md:35-36` | ⚠️ 口径不完整 |
| A4 | `pnpm typecheck` + `pnpm test` | 可执行；但新用例尚不存在（0/34） | `proposal.md:71`；`tasks.md:53` | ✅ |

- **MUST/MUST NOT 覆盖**：§3.5 的权限 MUST 有落点；原子写、写锁、目录固定、错误码等 MUST 声明「保持不变」但未新增回归用例（既有 `tests/ops-manager.spec.ts` 覆盖并发冲突与错误映射，未直接断言临时文件/`rename` 路径）。
- **无法验证的条目**：`spec.md:19`「MUST NOT 让同机其他用户可读」与 `spec.md:26`「MUST NOT 让其他用户可进入或列出」只能由 `mode` 间接证明，无法在单机测试中直接证明跨用户不可读——可接受，但应在报告中标注为「以权限位等价证明」。

#### 1.3.6 风险覆盖完整度（大纲）

| 相关项 | 是否覆盖 | 证据 | 严重程度 |
|--------|:--------:|------|:--------:|
| **TD-013**（中） | ✅ 已作为主依据 | `proposal.md:5`、`proposal.md:92`、`risks_and_debt.md:345-355` | 中 |
| **RISK-005**（中，存储不可用误报） | ⚠️ 部分 | 提案讨论 `ConfigStore.save()` 吞错（`proposal.md:64`），但错误地认为已被 §3.5 预检完全覆盖；`RISK-005` 缓解 ③「不得吞异常后谎报保存成功」（`risks_and_debt.md:88`）仍成立 | 中 |
| **RISK-010**（高，测试污染真实 `$DSH_HOME`） | ✅ 任务层覆盖 | `tasks.md:44` 要求独立 `DSH_HOME`；`tests/setup-isolation.ts:26-29` 已有模块级隔离 | 高（已缓解） |
| **RISK-011**（中，令牌明文暴露） | N/A | `risks_and_debt.md:156-167` 针对 RPC 返回面，不是落盘面；落盘面由 TD-013 / `security_policy.md:104-112` 覆盖 | — |
| **TD-010**（中，`metrics/` 持久化） | ✅ 作为下游依赖间接覆盖 | `proposal.md:55`；`feat-storage-metrics-snapshot/proposal.md:13,32,65` | 中 |
| **既有对象权限残留**（新增风险） | ❌ **未覆盖** | 见 P1-3 | **中高** |
| **下游自建第二套落盘口径**（新增风险） | ❌ **未覆盖** | 见 P1-1 | **中高** |

> 大纲没有「风险与处理决定」字段，建议按 Phase-0 提案 6 的格式（`proposal-roadmap-Phase-0.md:491-496`）补一张风险表（P2-2）。

### 1.4 阶段二摘要

**部分一致**。目标、In/Out、关键任务、验收项均有对应；差异集中在：

- 「统一落盘封装」被实现为只含权限位 + 原子写的 `local-fs.ts`，而下一次提案要求它同时承载写锁与统一错误码；
- 大纲「无遗漏」验收与提案对 `session-guard.ts` 的排除冲突；
- 提案比大纲多声明了 `calendar` 被依赖与 3 项 Out，属**信息更完整**而非越界。

详见 §4。

### 1.5 阶段三摘要

**基本合规（有条件）**。逐条扫描 `criterion.md` §3–§4 后，未发现本提案**新增**违反；两处 ⚠️ 均为**既有偏离**（§3.2 吞错、§3.5 既有对象权限）；接口契约确无变更面（`src/types.ts` / `src/ops-rpc.ts` 不改，`src/index.ts:133` 的 `export *` 导出面保持）。路线图依赖图自洽，但与下游的「封装」定义不自洽（P1-1）。详见 §2、§3、§5。

### 1.6 关闭条件

在进入 `context-start` 实施前关闭 P1-1～P1-4；P2 可在实施中一并处理。若 P1-3 选择「一次性收紧既有对象」，需同步 `tasks.md` 与 1 人日估算；若选择「只覆盖新写入」，需把 `proposal.md:9` 的「使 MUST 成立」改为「使新写入满足 MUST」并登记残留风险。

---

## 2. MUST / MUST NOT 合规矩阵

> 扫描范围：`.context/criterion.md` §3.1–§3.5、§4、§6、§7.1/§7.2。图例：✅ 满足或不受影响；⚠️ 有条件/既有偏离；❌ 违反。本提案只改 `src/storage/local-fs.ts`（新增）、`src/storage/draft-store.ts`、`src/config-store.ts`（`proposal.md:45-50`），不触碰客户端与 RPC。

### 2.1 §3.1 客户端

| 规则（criterion 位置） | 提案证据 | 状态 |
|------------------------|----------|:----:|
| MUST 按 Cordis 扩展机制封装 | 未改 `plugin-src/` | ✅ |
| MUST 注入 `settings.section`（`ops`/60） | 未改 | ✅ |
| MUST 全部数据经 `callOpsRpc` | 未改客户端；本提案不加外部调用 | ✅ |
| MUST 使用 DSH 主题令牌 | 未改样式 | ✅ |
| MUST NOT 硬编码 Token/凭证 | 新增文件不含任何凭据（`proposal.md:15`） | ✅ |
| MUST NOT 绕过 `callOpsRpc` 直连外部服务 | 未新增网络调用 | ✅ |
| MUST NOT 硬编码色值 | 未改 UI | ✅ |
| MUST NOT 客户端承载业务规则 | 未改客户端 | ✅ |

### 2.2 §3.2 宿主核心层

| 规则（criterion 位置） | 提案证据 | 状态 |
|------------------------|----------|:----:|
| MUST 统一 RPC 信封 | `src/ops-rpc.ts` 不改（`proposal.md:26`） | ✅ |
| MUST 平台差异收敛 Adapter | 未改 Adapter | ✅ |
| MUST Injoys/BrowserOS 调用集中 | 未改 | ✅ |
| MUST **错误不得吞没** | `src/config-store.ts:179-188` 仍 `catch {}`；提案明确不改（`proposal.md:34,64`、`design.md:37-40`） | ⚠️ **既有偏离**，见 P1-2 |
| MUST 配置热更新实时生效 | `src/ops-rpc.ts:150-156` 未改 | ✅ |
| MUST `config.save` 改 `draftsDir` 前准备并校验 | `src/ops-rpc.ts:131-148` 保留；`proposal.md:56` | ✅ |
| MUST 会话/预填/指标统一同一 BrowserOS 实例 | 未改 | ✅ |
| MUST NOT 内置 Master Key/通用凭据 | 未新增 | ✅ |
| MUST NOT **虚报成功** | 同 §3.2 吞错：配置文件写失败时 `config.save` 仍返回 `ok: true`（`src/config-store.ts:185-187` + `src/ops-rpc.ts:157-163`） | ⚠️ **既有偏离**，见 P1-2 |
| MUST NOT 伪造/硬编码指标 | 未改指标 | ✅ |
| MUST NOT 自动发布 | 未改 | ✅ |

### 2.3 §3.3 前端工程

| 规则（criterion 位置） | 提案证据 | 状态 |
|------------------------|----------|:----:|
| MUST 只调用统一 RPC | 未改客户端 | ✅ |
| MUST 状态域 `loading/error/data` | 未改 | ✅ |
| MUST `null` 指标显示「暂无数据」 | 未改 | ✅ |
| MUST 未登录提供 `去登录 ↗` | 未改 | ✅ |
| MUST 卡片即时刷新 | 未改 | ✅ |
| MUST NOT 硬编码色值 | 未改 | ✅ |
| MUST NOT 业务黑盒/本地伪造数据 | 未改 | ✅ |

### 2.4 §3.4 服务端

| 规则（criterion 位置） | 提案证据 | 状态 |
|------------------------|----------|:----:|
| MUST 分层架构（…→本地持久化基础设施层） | `local-fs.ts` 位于 `src/storage/`，只依赖 `node:fs`/`node:path`（`proposal.md:15`、`design.md:26-30`） | ✅ |
| MUST RPC 向后兼容 | 不改 RPC 方法/字段（`proposal.md:26`） | ✅ |
| MUST 手动刷新 + 局部替换 + in-flight 去重 | 未改刷新路径 | ✅ |
| MUST NOT 外部常驻服务/额外端口 | 未新增 | ✅ |
| MUST NOT 向本机 DSH 客户端之外下发敏感策略/令牌 | `config.get/save` 响应体不变；权限位只影响落盘 | ✅ |
| MUST NOT Phase 0 WebSocket/SSE/轮询 | 未新增 | ✅ |

### 2.5 §3.5 数据持久化

| 规则（criterion 位置） | 提案证据 | 状态 |
|------------------------|----------|:----:|
| MUST 原子写入 + 串行写锁 | `local-fs.ts` 集中「临时文件 + `rename`」；`DraftStore` 锁保留（`proposal.md:15,19`；`design.md:29`；`draft-store.ts:191-192,222-239`） | ✅ |
| MUST `version`/`expectedVersion` 乐观锁 | 未改（`draft-store.ts:299-308`） | ✅ |
| MUST **系统文件权限仅限当前用户** | `mode: 0o600`/`0o700`（`proposal.md:15,68-69`；`spec.md:5-12`） | ⚠️ 仅新对象；既有对象见 P1-3 |
| MUST 路径经 `resolveDshHome` | 未改（`config-store.ts:72-78`） | ✅ |
| MUST 目录在单次操作内固定 | 未改（`draft-store.ts:283`） | ✅ |
| MUST 跨 `await` 固定目录 | 未改 | ✅ |
| MUST 贯穿请求内每次落盘 | 未改 | ✅ |
| MUST 该语义为确定行为、不加告警标记 | 未改 | ✅ |
| MUST 配置页切换提示文案 | UI 不在范围；文案未改 | ✅ |
| MUST 写前准备并校验目录（探测文件） | 保留 `verifyDirectoryWritable`；探测文件补 `mode`（`draft-store.ts:145-163`；`tasks.md:28`） | ✅ |
| MUST 存储错误码统一 `drafts/storage-unavailable` | 统一边界未改（`ops-rpc.ts:663-678`）；下游新写入口需覆盖（见 P1-1） | ✅（本提案） |
| MUST 写锁按绝对文件路径归属 | 未改（`draft-store.ts:191-192`） | ✅ |
| MUST NOT 绕过 `config-store`/`draft-store` 直接操作配置/草稿 | 两 store 改为调用 `local-fs` 原语，未新增绕过路径 | ✅ |
| MUST NOT 无锁并发回写同一草稿 | 未改 | ✅ |
| MUST NOT 中途重新解析 `draftsDir` | 未改 | ✅ |
| MUST NOT 让 `config.save` 先成功、`drafts.save` 以 `ENOENT` 失败 | `draftsDir` 预检保留；但**配置文件写失败**仍假成功（不同路径） | ⚠️ 见 P1-2 |
| MUST NOT 让测试写真实 `$DSH_HOME` | `tasks.md:44` 要求独立 `DSH_HOME`；`tests/setup-isolation.ts:26-29` 模块级隔离 | ✅（需注意用例内 env 恢复） |

### 2.6 §4 安全约束

| 规则（criterion 位置） | 提案证据 | 状态 |
|------------------------|----------|:----:|
| 密钥管理：禁止硬编码；令牌仅来自配置/环境；日志脱敏 | 新增模块无凭据；未改日志 | ✅ |
| 网络：HTTPS 强制、校验状态码/`isError` | 未改网络路径 | ✅ |
| 最小权限：BrowserOS 能力开关、统一检查 | 未改 | ✅ |
| 会话隔离：Cookie 零外发 | 本提案不新增外发；`session-guard.ts:194-197` 临时副本属本地文件，由提案 6 移除（`proposal.md:32`） | ✅（范围外残留见 §6） |
| 铁律：仅预填、严禁自动发布 | 未改 | ✅ |
| 发布闭环：URL 解析器校验、拒绝 `published` | 未改（`draft-store.ts:85-93,274-278`） | ✅ |
| `publishedUrls` 服务端治理 | 未改 | ✅ |
| 全渠道不变量/状态重算 | 未改 | ✅ |
| 状态优先级 | 未改 | ✅ |
| 渠道成员校验 | 未改 | ✅ |
| 预填止步原生草稿 | 未改 | ✅ |
| 内容写入边界 | 未改 | ✅ |
| 指标真实性（汇总 `null`/零值/环比） | 未改指标路径 | ✅ |

### 2.7 §6 / §7

| 规则（criterion 位置） | 提案证据 | 状态 |
|------------------------|----------|:----:|
| §6 类型契约 → RPC 契约 → 实现 → UI/测试 | 本提案不改 `src/types.ts`/`src/ops-rpc.ts`；`tasks.md:14-17` 记录「SSoT 未更改」 | ✅ |
| §7.1 API 层契约文件 | 未改；`local-fs` 为持久化基础设施，不加入 `src/index.ts` 公开面（`tasks.md:17`） | ✅ |
| §7.2 生成命令 = 无；校验 = `pnpm typecheck` + `pnpm test` | `proposal.md:26`；`tasks.md:16,53` | ✅ |

---

## 3. 业务契合度表（BR-xxx）

> 判定依据：`business_rules.md:13` 明确技术约束（存储路径、锁、错误码）不在业务规则内；`business_rules.md:476` 再次声明实现手段以 criterion/architecture 为准。因此本提案不以 BR 为直接依据。下表对 39 条 BR 逐条判定，避免「相关 BR 被跳过」。

| BR | 判定 | 提案引用位置 / 说明 |
|----|------|---------------------|
| BR-001 产品定位 | 不涉及 | 不改工作台范围 |
| BR-002 分阶段渠道 | 不涉及 | 不改渠道交付 |
| BR-003 单产品运营视野 | 不涉及 | 不改产品切换 |
| BR-010 会话四态 | 不涉及 | 不改会话探测 |
| BR-011 未登录引导 | 不涉及 | 不改 UI |
| BR-012 会话就绪度 | 不涉及 | 不改统计 |
| BR-020 内容五态 | 不涉及 | 不改状态机 |
| BR-021 发布确认闭环 | 不涉及 | 不改回填/状态计算 |
| BR-022 预填安全边界 | 不涉及 | 不改预填 |
| BR-023 排期生成 | 不涉及 | 不改排期 |
| BR-024 Injoys 排期同步 | 不涉及 | 不改同步 |
| **BR-030 物料生成与本地存盘** | **间接相关** | 保护本地草稿文件；不改变「本地主数据/不上传/只保留当前草稿」行为（`business_rules.md:171-178`）。提案未显式引用，建议补一句（P2-7） |
| BR-031 多渠道物料适配 | 不涉及 | 不改生成 |
| BR-032 真实样式预览 | 不涉及 | 不改 UI |
| BR-033 复制与沉淀 | 不涉及 | 不改沉淀 |
| BR-040 工具生命周期分类 | 不涉及 | 不改工具 |
| BR-041 单步调试沙箱 | 不涉及 | 不改工具 |
| BR-042 技能包 | 不涉及 | 不改工具 |
| BR-050 指标真实性 | 不涉及 | 不碰指标 |
| BR-051 曝光/播放口径 | 不涉及 | 不碰指标 |
| BR-052 互动与关注增长 | 不涉及 | 不碰指标 |
| BR-053 排期履约流水 | 不涉及 | 不碰排期 |
| BR-054 评论抓取 | 不涉及 | 不碰反馈 |
| BR-055 复盘报告 | 不涉及 | 不碰复盘 |
| BR-060 热点雷达 | 不涉及 | 不碰热点 |
| BR-070 引擎连接状态 | 不涉及 | 不碰引擎 |
| **BR-071 凭证用户可见管理** | **间接相关** | 令牌仍存于 `config.json`；本提案收紧其静态权限，不改回填/显隐（`business_rules.md:334`）。提案未显式引用（P2-7） |
| BR-072 全局策略即时生效 | 不涉及 | 不改配置生效 |
| BR-073 未接入引擎降级 | 不涉及 | 不改降级 |
| BR-074 BrowserOS 能力管理 | 不涉及 | 不改能力开关 |
| BR-080 设计语言一致性 | 不涉及 | 不改 UI |
| BR-081 状态颜色语义 | 不涉及 | 不改 UI |
| BR-082 卡片即时刷新 | 不涉及 | 不改 UI |
| BR-083 驾驶舱快捷行动 | 不涉及 | 不改 UI |
| BR-090 登录方式演进 | 不涉及 | 不改登录 |
| BR-NFR-001 能力覆盖范围 | 不涉及 | 不改渠道能力 |
| **BR-NFR-002 内容留存边界** | **间接相关** | 草稿/配置仍只在本机；权限收紧不改变「不自动上传」边界（`business_rules.md:450`）。无行为变更 |
| BR-NFR-003 排期跨度 | 不涉及 | 不改排期 |
| BR-NFR-004 技能包规模 | 不涉及 | 不改工具 |

**结论**：无 BR 被违反；无 BR 直接要求权限位。BR-030 / BR-071 / BR-NFR-002 为间接相关，建议在 `proposal.md` 的「关联 Context 资产」或 Why 中补一句判定，避免评审者误以为遗漏（P2-7）。

---

## 4. 大纲 ↔ 提案一致性对照表

### 4.1 总评

**部分一致**：目标与范围完全承接；任务与验收有完整落点；差异集中在「统一落盘封装」的实现范围、`session-guard` 排除的验收口径、以及提案比大纲多出的 Out/依赖信息。无「少做核心任务」，无与大纲冲突的「多做」。

### 4.2 目标覆盖

| 大纲目标（Phase-0:548-549） | 提案对应位置 | 覆盖状态 |
|------------------------------|--------------|:--------:|
| 使 §3.5 文件权限 MUST 在实现层成立 | `proposal.md:5-9`（Why）、`proposal.md:15-20`（What） | ✅（措辞过强，见 P1-3） |
| 避免多用户主机草稿/配置被同机用户读取 | `proposal.md:7,60` | ✅ |
| 偿还 TD-013 | `proposal.md:5,92` | ✅ |

### 4.3 边界漂移清单

| 类型 | 内容 | 判定 |
|------|------|------|
| 多做（相对大纲字面） | 新增 `src/storage/local-fs.ts` 叶子模块，承载权限位常量 + `mkdirWithMode` + `writeJsonAtomic` | **大纲许可**：In 写明「或在统一落盘封装内集中设定」（`proposal-roadmap-Phase-0.md:555`）；下游 `feat-storage-metrics-snapshot` 也要求可复用写盘原语（`feat-storage-metrics-snapshot/proposal.md:61`）。**不属越界**，但 1 人日估算需在追加锁原语后复核（并入 P1-1 / M-1） |
| 多做 | `verifyDirectoryWritable` 探测文件补 `mode`（`tasks.md:28`） | **必要**：否则「无遗漏」不成立；属 In 的自然延伸 |
| 多做 | 提案新增 3 项 Out（session-guard / build.mjs / ConfigStore 吞错） | **信息更完整**，但大纲 Out 未列；需同步大纲（P1-4、M-5） |
| 少做 | 不回改既有文件/目录 | 文件可接受（下次保存覆盖）；**目录不可接受**（永不被修正）→ P1-3 |
| 少做 | 未补 `metrics/` 的写锁/错误映射 | 属下游范围，但下游要求复用本提案封装 → P1-1 |
| 边界漂移 | 无其他 | — |

### 4.4 关键任务映射

| 大纲关键任务（Phase-0:568-571） | tasks.md 对应 | 状态 |
|----------------------------------|---------------|:----:|
| 1. 统一落盘封装内文件 `0o600` / 目录 `0o700`（0.5 人日） | 3.1（3.1.1–3.1.4）、3.2、3.3 | ✅ |
| 2. 覆盖 `draft-store.ts` 与 `config-store.ts` 的 `writeFileSync`/`mkdirSync`（0.25 人日） | 3.2（3.2.1–3.2.4）、3.3（3.3.1–3.3.3）、3.4（3.4.1–3.4.2） | ✅（3.4.2 增加排除项核对） |
| 3. 补权限位断言测试（0.25 人日） | 4.1（4.1.1–4.1.5） | ✅ |

**任务缺口**：

1. 若 M-1 选择方案 A（把写锁/错误封装纳入统一封装），需新增「抽取/复用写锁原语」任务与对应测试；当前无此任务（P1-1）。
2. 无「既有文件下次保存收紧」的验证任务；`design.md:33` 的结论未进入 tasks（P2-4）。
3. 无「保留原子写语义」的回归用例（临时文件 + `rename`、无 `.tmp` 残留）；重构后仅靠既有成功路径间接覆盖（P2-4）。
4. 无 `win32` 跳过策略；`permissionBitsEnforced` 只处理 `root`（`tasks.md:44`；`tests/ops-manager.spec.ts:1873-1890`）（P2-4）。
5. 无「用例内临时 `DSH_HOME` 的恢复/隔离方式」说明（`tasks.md:40-44` 只说独立目录，未说通过 `profileContext.home` 或 `afterEach` 恢复；RISK-010 / `criterion.md:191`）（P2-4）。

### 4.5 验收标准传递

| 大纲验收（Phase-0:577-579） | spec 场景 | tasks | 传递状态 |
|------------------------------|-----------|-------|:--------:|
| 文件权限 `0o600` | `spec.md:14-19`（草稿）、`spec.md:28-33`（配置） | 4.1.1、4.1.3 | ✅（未覆盖既有文件） |
| 目录权限 `0o700` | `spec.md:21-26`、`spec.md:30-32` | 4.1.2 | ✅（仅新目录；测试可能空转） |
| `src/` 无遗漏 | `spec.md:50-55` | 3.4、6.1.2 | ⚠️ 与 `session-guard` 排除冲突；grep 口径不完整 |
| （提案新增）`pnpm typecheck` + `pnpm test` | — | 6.1.3 | ✅ |
| （提案新增）umask 不更宽松 | `spec.md:35-40` | 4.1.1–4.1.3（精确等值） | ⚠️ 测试断言与 spec 语义不完全一致 |

**弱化/丢失**：无核心验收丢失；「无遗漏」被提案**显式收窄**（排除 `session-guard`），需在大纲同步，否则属未声明弱化（P1-4）。

### 4.6 依赖声明差异

| 项 | 大纲（Phase-0:581-584） | 提案（`proposal.md:54-56`） | 差异 |
|----|--------------------------|------------------------------|------|
| 前置 | 无 | 无 | ✅ 一致 |
| 被依赖 | 仅 `feat-storage-metrics-snapshot` | `feat-storage-metrics-snapshot`（显式）+ Phase 1 `feat-storage-calendar-items` | 提案更完整；大纲「被依赖」字段少列 calendar，但约束行（`Phase-0:584`）已要求 calendar 复用 → 建议对齐（P2-3） |
| 约束 | `metrics/`/`calendar/` 复用同一封装 | 同左 + 其余 §3.5 MUST/MUST NOT 保持不变 | ✅ 一致 |

**与 `feat-storage-metrics-snapshot` 的自洽性**：

- 该提案 `proposal.md:13,32,65` 与 `design.md:12,22,64`、`tasks.md:7,29` 都把「权限位 + 原子写 + 写锁 + 目录固定 + 统一错误码」作为显式前置，并声明「不修改 `draft-store.ts` / `config-store.ts`」。
- 本提案的 `local-fs.ts` 只提供 **权限位 + 目录创建 + 原子写**（`proposal.md:15`）；写锁是 `DraftStore` 的私有成员（`draft-store.ts:191-192,222-239`），错误类型仍由 `draft-store.ts` 导出（`proposal.md:63`），错误码映射在 `ops-rpc.ts:663-678`。
- 因此下游若严格「不修改两文件」且「不自设第二套落盘口径」，将**无法复用写锁**，只能自建 `Map<string, Promise>`（第二套）或修改 `draft-store.ts`（违背承诺）。→ **P1-1**。

### 4.7 两项重点裁定

**裁定 A：新增 `local-fs.ts` 是否超出大纲许可 / 1 人日扩张？**

- **不超许可**。大纲 In 明确允许「或在统一落盘封装内集中设定」（`Phase-0:555`）；`local-fs.ts` 是「集中设定」的最自然实现。下游提案也把「抽取可导出写盘原语」视为本提案的实现细节（`feat-storage-metrics-snapshot/proposal.md:61`）。
- **工时需复核**：大纲 1 人日 = 0.5 + 0.25 + 0.25；新增模块 + 重构 2 文件 + 5 类测试 + 手工核对，仍可能在 1 人日内完成；但若采纳 M-1 方案 A（追加写锁原语），应把工时上调并写入大纲（并入 P1-1 / M-1）。

**裁定 B：`DraftStorageError` 留在 `draft-store.ts`、只抽原语，是否满足下游「复用统一落盘封装、不得自设第二套落盘口径」的前置？**

- **不满足（按下游现有措辞）**。理由见 4.6：缺少可复用的**写锁**与**统一错误类型/映射**；下游的「封装」是 5 项能力，本提案的「封装」只有 3 项（模式 + 目录 + 原子写）。术语同名异指，会在下游实施时暴露为返工。
- **可接受的替代**：若明确把「统一落盘封装」定义为「`local-fs` 原语 + 各 store 复用 `DraftStorageError` + 各 store 复用同一写锁实现」，并让 `local-fs` 导出锁原语，则满足；若坚持只抽原语，则必须同步改写下游的前置措辞，承认「写锁/错误映射仍由各 store 自行承担」，否则下游无法在不违约的前提下实施。→ **P1-1 / M-1**。

---

## 5. 路线图关联分析

### 5.1 依赖图核对

```text
fix-overview-metrics-null-semantics (done)
                └──> feat-storage-metrics-snapshot (in-progress)  ──> feat-client-dashboard (Phase 3)
fix-storage-file-permissions (in-progress) ──┘
                └──> feat-storage-calendar-items (Phase 1)（约束复用，非硬前置）
fix-browser-session-cookie-probe (P0, proposed) ── 负责移除 session-guard.ts 的 Cookie 临时副本
```

| 核对项 | 证据 | 结论 |
|--------|------|:----:|
| 索引行与 Phase 块一致 | `proposal-roadmap.md:153`（P1 / 前置无 / in-progress） vs `proposal-roadmap-Phase-0.md:543-546` | ✅ |
| 前置为本提案的下游项目 | `proposal-roadmap.md:148`（metrics 前置含本提案）；`proposal-roadmap-Phase-0.md:642`（须先于 metrics 完成） | ✅ |
| 本提案的前置 | `Phase-0:581-582` 前置无；与索引一致 | ✅ |
| 执行顺序 | `Phase-0:642-645` 将本提案列为 metrics 的硬前置，且与 `feat-injoys-test-document-count` 可并行 | ✅ |
| 下游当前状态 | `specflow status fix-storage-file-permissions` → 本提案 0/34；metrics 状态 `in-progress`，其 `tasks.md:7` 明示等待本提案 | ⚠️ 下游「进行中」但硬前置未完成，属计划态而非执行冲突；建议在 metrics 任务 3.2 标注「阻塞于本提案归档」 |

### 5.2 冲突点与重叠建设风险

| 风险点 | 证据 | 影响 | 裁定 |
|--------|------|------|------|
| 同一文件重叠修改 | 本提案改 `draft-store.ts`/`config-store.ts`；metrics 明确不改（`feat-storage-metrics-snapshot/proposal.md:61`、`tasks.md:29`） | 无文件级冲突 | ✅ 划分正确 |
| 「统一封装」语义重叠 | 本提案 `local-fs` 只有 3 项能力；metrics 要求 5 项（`feat-storage-metrics-snapshot/design.md:12,22`） | 下游要么自建锁（违反「不得自设第二套」），要么改 `draft-store`（违反「不修改」承诺） | ⚠️ **P1-1** |
| 统一错误边界 | `ops-rpc.ts:663-678` 以 `instanceof DraftStorageError` 映射；`local-fs` 不定义错误类型 | metrics 若抛原始 fs 错误 → 漏出 `ops/internal-error`，违反 `criterion.md:183` | ⚠️ **P1-1** |
| Cookie 临时副本移除的时序 | 本提案排除（`proposal.md:32`）；提案 6 仅 roadmap 存在（`Phase-0:439-537`），`openspec/changes/fix-browser-session-cookie-probe/` 尚未创建 | 本提案先落地时，`session-guard.ts:197` 仍会产生未显式设权的临时文件 | ⚠️ **P1-4**（范围仍正确，需时序说明） |
| Phase 1 calendar 复用 | `Phase-0:584` 要求 calendar 复用同一封装 | 与 metrics 同样的「锁/错误」缺口 | ⚠️ 随 P1-1 一并解决 |

### 5.3 整合建议

1. 把「统一落盘封装」定义为**两层**：
   - `src/storage/local-fs.ts`：叶子原语（`FILE_MODE`/`DIR_MODE`/`mkdirWithMode`/`writeJsonAtomic`/可选 `createFileLock`）；
   - 各 store：复用 `DraftStorageError` 与统一 RPC 错误边界。
   并在本提案 spec 与 metrics 提案中**使用同一措辞**，避免同名异指。
2. 在 metrics 提案的依赖章节补一句「本提案不修改 `draft-store.ts`/`config-store.ts`；若需写锁，调用 `local-fs` 导出的同一锁原语」。
3. 在 roadmap 的 Phase-0 提案 7 块补「被依赖：`feat-storage-metrics-snapshot`、`feat-storage-calendar-items`（Phase 1，约束复用）」，与提案对齐（P2-3）。

---

## 6. 风险清单

| 风险ID | 触发条件 | 影响 | 缓解方案 | 责任归属 |
|--------|----------|------|----------|----------|
| **R-01** 既有配置令牌文件长期宽权限 | 升级前 `$DSH_HOME/ops-manager/config.json` 为 `0644`，且用户此后不再保存配置 | 同机其他用户可读取明文 Injoys Token；「使 MUST 成立」不成立 | 选择 M-4 方案 A（首次加载/保存时对已知配置路径做一次性 `chmod 0600`，失败如实上报或记录）或方案 B（改写声明并登记残留 + 后续迁移提案） | 提案作者 / 安全评审 |
| **R-02** 既有目录永不被收紧 | `drafts/`、`ops-manager/` 已存在且为 `0755`；`mkdirSync` 不修改既有目录 | 其他用户可列出文件名（内容仍受 `0600` 保护）；§3.5「权限仅限当前用户」对目录不成立 | 在 `design.md` 明确「目录也不回改」；或对**插件自有目录**（`$DSH_HOME/growth-studio`、`ops-manager`）做一次性收紧；用户自选 `draftsDir` 不主动 `chmod` | 提案作者 |
| **R-03** 下游自建第二套写盘口径 | metrics/calendar 需要写锁，但 `local-fs` 未导出 | 两套锁语义漂移、并发覆盖；违反下游「不得自设第二套」 | M-1 方案 A（导出锁原语）或方案 B（改写双方措辞） | 提案作者 / 下游作者 |
| **R-04** `config.save` 假成功 | `ops-manager` 目录不可写或配置文件只读 | `config.save` 返回 `ok: true` 但未落盘；违反 §3.2 MUST/MUST NOT 与 RISK-005 ③ | 本提案不修（正确）；**登记独立缺陷提案**（M-3），并修正 `proposal.md:64` 的覆盖论断 | 提案作者 / 路线图维护者 |
| **R-05** Cookie 临时副本残留 | 本提案先于提案 6 落地 | `os.tmpdir()` 下出现未显式设权的 Cookie 库副本（实际位取决于源文件模式与 umask） | 在提案 6 的 In 中保留移除承诺（已存在，`Phase-0:455`）；本提案在 Out 中注明时序；不重复改同一文件 | 路线图维护者 |
| **R-06** 权限断言在 root/Windows/异常 umask 下失真 | CI 以 root 运行；或开发机为 Windows；或 umask 极严 | 用例跳过（root）或误报失败（Windows/异常 umask），验收证据不足 | 复用 `permissionBitsEnforced` 跳过（`tests/ops-manager.spec.ts:1873-1890`）；补 `win32` 跳过；断言「不更宽松」而非仅精确等值（M-6） | 提案作者 / QA |
| **R-07** 测试污染真实 `$DSH_HOME` | 新用例直接 `new ConfigStore(undefined)` 或临时改 `process.env.DSH_HOME` 未恢复 | 改写开发者真实配置（RISK-010） | 沿用 `tests/setup-isolation.ts:26-29`；每个用例用独立 `DSH_HOME`/`profileContext.home`，并在用例内恢复（M-6） | 提案作者 / QA |
| **R-08** 循环依赖 | 原语放进 `draft-store.ts` 再由 `config-store.ts` 复用 | `draft-store → config-store → draft-store` 成环，typecheck/运行失败 | 叶子模块（已采用，`design.md:26-30`）；`pnpm typecheck` 验证 | 提案作者 |
| **R-09** 临时文件残留/同毫秒碰撞 | `rename` 失败或同一毫秒多次写入 | 目录残留 `.tmp` 文件（`0600`，不泄露内容）；极端情况下碰撞 | 临时名用 `randomBytes` 唯一后缀；失败路径 `finally` 清理（低优先，可在实现中处理） | 提案作者 |
| **R-10** 1 人日估算偏紧 | 采纳 M-1 方案 A 或 M-4 方案 A 追加任务 | 交付延期 | 在 roadmap 提案 7 与 `tasks.md` 重新估算；把新增任务列入「关键任务」映射 | 路线图维护者 |

---

## 7. 待澄清问题（P0 / P1 / P2）

### P0（阻塞）

- 无。

### P1（重要，实施/归档前必须关闭）

| 编号 | 问题 | 证据 | 建议裁决 |
|------|------|------|----------|
| **P1-1** | 「统一落盘封装」是否包含写锁与统一错误类型/映射？当前只抽原语，是否满足 `feat-storage-metrics-snapshot` 的显式前置？ | `proposal.md:15,63`；`draft-store.ts:191-192,222-239`；`feat-storage-metrics-snapshot/proposal.md:32,61`、`design.md:12,22`、`tasks.md:29` | 采纳 M-1 方案 A（推荐）或 B；两者必须选一并在双方文档同步 |
| **P1-2** | `ConfigStore.save()` 吞错是否为独立缺陷？提案「已被 §3.5 预检覆盖」的论断是否成立？ | `config-store.ts:179-188`；`ops-rpc.ts:131-148,157-163`；`criterion.md:103,110`；`risks_and_debt.md:78-89`；`proposal.md:64`；`design.md:37-40` | **应升级为独立缺陷登记**（新 change-id 或 TD）。§3.5 预检只覆盖 `draftsDir`，不覆盖配置文件写失败；§3.2 MUST/MUST NOT 与 RISK-005 ③ 仍成立。修正提案措辞，不在本提案修复 |
| **P1-3** | 「既有文件不回改」的边界是否可接受？目录与配置令牌文件的残留如何处理？ | `design.md:32-35,49-51`；`proposal.md:9`；`mkdirSync` 语义（`draft-store.ts:121-131`）；`data_architecture.md:361` | 文件：可接受「下次保存收紧」，但需补测试与明确残留；**目录：不可接受「永不修正」**。至少对插件自有目录与配置路径做一次性收紧，或把声明改为「仅新写入满足 MUST」并登记残留风险 |
| **P1-4** | 大纲「`src/` 内落盘调用均设定模式」与提案排除 `session-guard.ts` 如何对齐？ | `Phase-0:579`；`proposal.md:70`；`tasks.md:35-36`；`session-guard.ts:194-197`；`Phase-0:455,468` | 二选一：① 大纲改为「除宿主 Cookie 临时副本（由提案 6 整体移除）」；② 把提案 6 声明为本提案「无遗漏」验收的硬前置（并补依赖）。推荐 ①，避免本提案被未创建的下游提案阻塞 |

### P2（建议）

| 编号 | 问题 | 证据 | 建议 |
|------|------|------|------|
| **P2-1** | 大纲关联资产少列 `security_policy` / `data_architecture` / `tech_stack` / `testing_strategy` | `Phase-0:560-566` vs `proposal.md:87-97` | 补入大纲；提案侧无需删减（4 项均必要，非多余） |
| **P2-2** | 大纲无风险字段，未显式覆盖 TD-013 / RISK-005 / RISK-010 | `Phase-0:541-586`；`risks_and_debt.md:345-355,78-89,143-154` | 按提案 6 的格式补「风险与处理决定」表，至少列 TD-013、RISK-005、RISK-010 |
| **P2-3** | 大纲「被依赖」只列 metrics，未列 Phase 1 calendar（约束行已要求） | `Phase-0:583-584` | 补 `feat-storage-calendar-items` 或注明「约束复用、非硬前置」 |
| **P2-4** | 测试设计可证性不足：目录断言可能空转（`mkdtemp` 本身 `0700`）；精确等值与 spec「不得更宽松」不一致；无 `win32` 跳过；无「既有文件下次保存收紧」用例；无原子写回归用例；env 恢复未说明 | `tasks.md:40-44`；`spec.md:35-40`；`tests/ops-manager.spec.ts:1873-1890`；`setup-isolation.ts:26-29` | 见 M-6：明确目标目录不得预创建；断言 `(mode & 0o077) === 0` 且在标准 umask 下再断言精确值；补 `win32` 跳过；补既有文件收紧与无 `.tmp` 残留用例；说明 `DSH_HOME` 设置/恢复方式 |
| **P2-5** | 「无遗漏」grep 口径不完整（缺 `copyFileSync`、`fs/promises` 写法）；spec 未记录 `session-guard` 排除 | `tasks.md:35`；`spec.md:50-55`；`session-guard.ts:197`；`build.mjs:1,36-37` | 扩展 grep；在 spec 的覆盖范围写一句排除项及其归属提案 |
| **P2-6** | spec 过度规定实现（「叶子模块」应属 design）；「重复定义字面量/自建第二套原子写」引用 §3.5 MUST NOT 的「绕过 store」不精确 | `spec.md:44-48`；`design.md:26-30`；`criterion.md:187` | 把叶子约束留在 design；spec 只保留行为要求（无循环依赖、复用同一原语）；引用改为 §3.5 MUST「原子写入」+ 本提案决策 |
| **P2-7** | 提案未写明 BR 立场、未显式声明四铁律合规、未引用 RISK-005/RISK-010 | `proposal.md:3-9,58-64`；`business_rules.md:13,171-178,334`；`openspec/config.yaml:211-218` | 补一句「无直接 BR；BR-030/071/NFR-002 间接相关」；补四铁律保持声明；风险表引用 RISK-005/010 |

---

## 8. 修改建议（M-n）

### M-1（P1-1；涉及层：**提案 + 下游提案 + spec**）

- **位置**：`proposal.md:15,52-56,63`；`design.md:26-30`；`tasks.md:20-33`；`spec.md:42-48`；`openspec/changes/feat-storage-metrics-snapshot/proposal.md:32,61`、`design.md:12,22`、`tasks.md:29`
- **内容**：二选一。
  - **方案 A（推荐）**：在 `src/storage/local-fs.ts` 增加可导出的、按绝对路径归属的锁原语（如 `createFileLock()` / `withFileLock()`），`DraftStore` 改为复用；明确 `local-fs` 负责「权限位 + 目录 + 原子写 + 锁」，`DraftStorageError` 仍由 `draft-store.ts` 导出、由各 store 在写失败时包装；在 spec 中把「统一落盘封装」定义为该组合。
  - **方案 B**：保持只抽原语，但在本提案与 metrics 提案同时改写措辞：「写锁与错误映射仍由各 store 自行实现，但必须复用 `local-fs` 的权限位/原子写，并抛出 `DraftStorageError`」；删除下游「复用写锁」的表述。
- **验收口径**：`feat-storage-metrics-snapshot` 可在**不修改** `draft-store.ts`/`config-store.ts` 且**不新写第二套锁实现**的前提下完成；`grep -rn "0o600\|0o700"` 仅出现在 `local-fs.ts` 与测试；`pnpm typecheck` + `pnpm test` 通过；双方文档对「统一落盘封装」的措辞逐字一致。

### M-2（P2-6；涉及层：**提案**）

- **位置**：`spec.md:42-48`；`design.md:26-30`
- **内容**：把「封装 MUST 为不 import 任何项目内模块的叶子模块」从 spec 移到 design（design 已有）；spec 只保留「权限位与原子写单点定义、调用点不得重复字面量/自建原子写、无循环依赖」；把引用从 §3.5 MUST NOT「绕过 store」改为 §3.5 MUST「原子写入」+ 本提案决策。
- **验收口径**：spec 中不再出现「叶子模块」等实现结构要求；每条 MUST 均能追溯到 criterion 的行为约束或 design 决策；`specflow validate --strict` 仍通过。

### M-3（P1-2；涉及层：**提案 + 路线图**）

- **位置**：`proposal.md:34,64`；`design.md:37-40,53-55`；`proposal-roadmap-Phase-0.md:541-586`（或新提案目录）
- **内容**：① 修正论断：§3.5 预检只覆盖 `draftsDir`，不覆盖 `ops-manager/config.json` 写失败；该行为同时违反 §3.2 MUST「错误不得吞没」、MUST NOT「虚报成功」与 RISK-005 ③。② 把 `design.md:53-55` 的 Open Question 改为已决事项：**登记独立缺陷**（建议新 change-id `fix-config-save-error-swallow`，或在 `risks_and_debt.md` 新增 TD 并经 `context-update` 落库）。③ 本提案仍不修复。
- **验收口径**：`proposal.md` 不再声称该缺陷已被覆盖；路线图或 `.context` 存在可检索的独立缺陷条目；本提案 diff 不触碰 `config-store.ts` 的 catch 行为。

### M-4（P1-3；涉及层：**大纲 + 提案**）

- **位置**：`proposal.md:9,66-71`；`design.md:13-18,32-35,49-51`；`spec.md:5-12`；`proposal-roadmap-Phase-0.md:555,577-578`
- **内容**：二选一。
  - **方案 A（推荐，安全优先）**：增加「一次性收紧」任务：对**插件自有的** `$DSH_HOME/ops-manager/config.json` 与 `$DSH_HOME/growth-studio`（及其 `drafts/`）在首次加载/写入时检查并 `chmod` 到 `0600`/`0700`；用户自选 `draftsDir` 不主动 `chmod`（避免改变用户目录语义），仅在文档提示。失败处理需明确（不得静默吞掉；可降级为告警并继续，但必须如实记录）。
  - **方案 B（最小改动）**：保持不回改，但把 `proposal.md:9` 改为「使**新写入**满足 MUST」；在 `design.md:32-35` 明确「既有**目录**也不会被修正（`mkdir` 不 chmod）」，并在风险清单登记残留；另立后续迁移提案。
- **验收口径**：新增/修改后的测试能区分「预置 `0644` 文件 / `0755` 目录」的行为；文档声明与测试结果一致；若选 A，`ls -l`/`stat` 手工核对覆盖既有对象；若选 B，残留风险在 `proposal.md` 与 roadmap 可检索。

### M-5（P1-4、P2-1、P2-2、P2-3；涉及层：**大纲**）

- **位置**：`openspec/proposal-roadmap-Phase-0.md:541-586`
- **内容**：① 关联资产表补 4 项（security_policy / data_architecture / tech_stack / testing_strategy）；② 验收「无遗漏」改为「除 `src/browser/session-guard.ts` 的宿主 Cookie 临时副本（由提案 6 整体移除）」或把提案 6 列为硬前置；③ 补「风险与处理决定」表（TD-013 / RISK-005 / RISK-010 / 既有对象残留）；④ 「被依赖」补 Phase 1 calendar（或注明约束复用）。
- **验收口径**：大纲字段与 `proposal.md:87-97,54-56,58-64` 逐项一致；索引行仍为 P1/前置无/in-progress；`proposal-roadmap.md:153` 不需改（除非状态变化）。

### M-6（P2-4、P2-5；涉及层：**提案**）

- **位置**：`tasks.md:34-36,38-44`；`spec.md:50-55`
- **内容**：① 明确目录断言的目标目录**不得预创建**（例如断言 `$DSH_HOME/growth-studio/drafts`，而非 `mkdtempSync` 根目录）；② 断言改为「`(mode & 0o077) === 0`」为主，标准 umask 下再断言精确 `0600`/`0700`；③ 增加 `process.platform === 'win32'` 跳过；④ 增加「预置 `0644` 草稿/配置，保存后变 `0600`」用例（若 M-4 选 B，则改为记录当前行为并标注不在验收）；⑤ 增加「保存成功后无 `.tmp.*` 残留」用例；⑥ 说明 `DSH_HOME` 通过 `profileContext.home` 或用例内设置并在 `finally` 恢复；⑦ grep 扩展为 `writeFileSync|mkdirSync|appendFileSync|copyFileSync|createWriteStream|fs/promises` 的 `writeFile|mkdir`；⑧ 在 spec 覆盖范围注明 `session-guard` 排除。
- **验收口径**：新用例在非 root POSIX 环境全部通过；在 root/Windows 下显式跳过并输出原因；`grep` 结果可逐条解释（每处要么设模式、要么属于明确排除项）；测试运行后 `git status` 无真实 `$DSH_HOME` 变更。

### M-7（P2-7；涉及层：**提案**）

- **位置**：`proposal.md:3-9`（Why）、`proposal.md:58-64`（风险）
- **内容**：① 补「无直接 BR；BR-030（本地主数据）/BR-071（凭证可见管理）/BR-NFR-002（留存边界）仅间接相关，本提案不改变其行为」；② 补一句四铁律合规声明（本提案不触碰发布/状态/指标聚合/会话数据，仅收紧落盘权限）；③ 风险表补 RISK-005（吞错）与 RISK-010（测试隔离）的引用。
- **验收口径**：`proposal.md` 可检索到 `BR-030`/`BR-071`/`BR-NFR-002` 与 `RISK-005`/`RISK-010`；四铁律声明与 `openspec/config.yaml:211-218` 的 proposal 规则一致；不新增无依据的能力声明。

---

## 9. 评审复核清单

| 复核项 | 结果 |
|--------|:----:|
| 报告已写入 `openspec/changes/fix-storage-file-permissions/check-report.md` | ✅ |
| 包含综合结论（PASS / PASS (Conditional) / MODIFY / FAIL） | ✅ `PASS (Conditional)` |
| 包含 MUST/MUST NOT 矩阵（§3.1–§3.5、§4、§6、§7） | ✅ §2 |
| 包含 BR-xxx 业务契合度表（39 条逐条） | ✅ §3 |
| 包含大纲 ↔ 提案一致性对照表 | ✅ §4 |
| 包含路线图关联与依赖分析 | ✅ §5 |
| 包含风险清单 | ✅ §6 |
| 包含 P0/P1/P2 待澄清问题 | ✅ §7（P0=0，P1=4，P2=7） |
| 包含 M-n 修改建议（涉及层/位置/内容/验收口径） | ✅ §8（M-1～M-7） |
| 无模板占位符、无未闭合表格 | ✅ |

> **最终结论**：`PASS (Conditional)`。提案可进入实施准备，但 P1-1～P1-4 必须先关闭；P2 建议在实施同一轮处理。评审为只读，本报告不自动修复任何提案或 Context 资产。
