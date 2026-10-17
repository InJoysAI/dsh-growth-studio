# 风险与技术债务 (Risks and Technical Debt)

> **Metadata**
> - **Source**: `.context/architecture/source/technical_architecture.md`（TAD v1.4.5）
> - **Generated At**: `2026-10-16 09:44`
> - **Updated At**: `2026-10-17 09:21`
> - **Generator**: `Context-Agent v1.0`

> ⚠️ **本文只记录源文档中有明确依据的风险与债务**。源文档未提供的字段标注 `N/A – 源文档未提供`，
> 不编造负责人、工作量或日期。业务层风险另见 `.context/domain/risks_and_debt.md`（本文聚焦**技术**风险）。

---

## ⚠️ 技术风险

### 风险矩阵

| 影响程度 ↓ / 可能性 → | 低 | 中 | 高 |
|----------------------|----|----|-----|
| **高** | 中风险 | 高风险 | 极高风险 |
| **中** | 低风险 | 中风险 | 高风险 |
| **低** | 可忽略 | 低风险 | 中风险 |

### 风险清单

#### RISK-001: 状态真实性被绕过（假「已发布」）

| 属性 | 值 |
|------|-----|
| **类别** | 安全风险 / 契约风险 |
| **可能性** | 中 |
| **影响程度** | 极高 |
| **风险等级** | **极高风险** |
| **负责人** | N/A – 源文档未提供 |
| **描述** | `published` 代表「已在平台真实发布」。若通用保存入口可直接写入该状态，或回填可用空值 / 占位符「骗过」校验，则发布闭环可被绕过，**状态失去真实性**，运营复盘基于假数据。 |
| **缓解措施** | 契约级守卫（**已在架构中强制**）：① `drafts.save` 传入 `published` 一律拒绝并返回 `drafts/published-requires-url`；② 回填 URL 必须为合法 `http(s)`，**须用 URL 解析器校验，禁止宽松正则**；③ 多渠道仅在**全部渠道**回填后才整体 `published`；④ `publishedUrls` 为服务端治理字段，`drafts.save` 必须**忽略**调用方传入值；⑤ 校验位于**宿主侧**，不依赖客户端自觉。 |
| **应急预案** | 若发现状态异常，依据 `publishedUrls` 键集合与 URL 有效性人工核对，修正状态记录。 |

#### RISK-002: 误发布 / 不可控群发

| 属性 | 值 |
|------|-----|
| **类别** | 安全风险 |
| **可能性** | 低（能力已移除） |
| **影响程度** | 极高 |
| **风险等级** | **高风险** |
| **负责人** | N/A – 源文档未提供 |
| **描述** | AI 幻觉或误操作触发正式发布 / 群发，造成不可撤销的对外影响。 |
| **缓解措施** | ① 从**所有**工具白名单、RPC 端点与文档中**彻底删除** `ops_publish_now`，使其**不存在于 catalog**，因此**无法构造调用**；② 保留平台原生确认发布步骤（Human-in-the-Loop）；③ 预填止步于平台原生「保存为草稿」；④ BrowserOS 能力开关仅决定可调用工具，不解除「禁止自动发布 / Cookie 零外发」业务守卫。 |
| **应急预案** | 在平台后台人工撤回；本插件不提供发布能力，故无需回滚代码路径。 |

#### RISK-003: 会话状态假阳性（工作台显示「就绪」但实际未登录）

| 属性 | 值 |
|------|-----|
| **类别** | 集成风险 / 架构风险 |
| **可能性** | 中 |
| **影响程度** | 高 |
| **风险等级** | **高风险** |
| **负责人** | N/A – 源文档未提供 |
| **描述** | 若会话判定与实际执行环境不一致，工作台会呈现「就绪」**假象**，用户在预填失败后才发现，浪费一轮操作。**原方案（探取日用 Chrome Cookie 库）已被证实存在此根本缺陷。** |
| **缓解措施** | ① **统一实例绑定**：登录态探测、草稿箱预填与大屏指标采集统一由**同一个** BrowserOS MCP 实例调度；② **轻量探测**：查询当前活跃 Tab 或后台导航至平台验签 URL，按页面特征 / 网络响应判定；③ **四态返回**：`unknown` / `needs_login` / `authenticated` / `no_publish_permission`，**严禁退化为 boolean**。 |
| **应急预案** | 状态为 `unknown` 时引导用户在当前 BrowserOS 实例中直接扫码登录。 |

#### RISK-004: 配置切换竞态导致跨库覆盖

| 属性 | 值 |
|------|-----|
| **类别** | 数据风险 / 并发风险 |
| **可能性** | 中 |
| **影响程度** | 高 |
| **风险等级** | **高风险** |
| **负责人** | N/A – 源文档未提供 |
| **描述** | 复合 RPC 执行中途用户切换 `draftsDir`，若在 await 之后重新解析目录，会出现「**从 A 库读取、写入 B 库**」并**覆盖 B 库同 ID 草稿**。`workbench.prefillDraft` 会「读草稿 → 调平台 Adapter → 回写」，中间等待可能很久，风险最高。 |
| **缓解措施** | ① 目录在**单次操作内固定**，配置热切换只对**新发起**的操作生效；② 跨 `await` 的复合 RPC 必须在**请求开始时**捕获目录并贯穿全程；③ 贯穿范围包括**请求内每一次落盘**（如 用户明确触发的 `sinkToInjoysDoc` 读草稿与回写 `injoysDocId`；生成本身只写本地）；④ **写锁按绝对文件路径归属**，使不同库同 ID 草稿互不阻塞、互不覆盖。 |
| **应急预案** | 该行为是**确定语义、非异常**：不引入 `dirChangedDuringSave` 告警标记，配置页明确提示「在途保存仍写入原目录」。 |

#### RISK-005: 存储不可用被误报为成功或错误码不一致

| 属性 | 值 |
|------|-----|
| **类别** | 数据风险 / 契约风险 |
| **可能性** | 中 |
| **影响程度** | 中 |
| **风险等级** | **中风险** |
| **负责人** | N/A – 源文档未提供 |
| **描述** | ① 仅检查「目录存在」不足：**已存在但只读**的目录会让 `mkdir` 成功却在首次写入时失败；② `config.save` 先报成功、再由 `drafts.save` 以 `ENOENT` 失败，用户体验为「保存时才发现目录不可用」；③ 部分写入口漏出 `ops/internal-error`，调用方**无法一致识别可恢复的存储错误**。 |
| **缓解措施** | ① `config.save` 前**先准备并校验**目标目录（创建并删除唯一命名的探测文件），失败**拒绝保存**并返回 `config/invalid-drafts-dir`；② 写盘失败统一返回 `drafts/storage-unavailable`，须在**统一 RPC 错误边界**映射，覆盖 **所有**写入口；③ 不得吞异常后谎报保存成功。 |
| **应急预案** | 用户收到明确错误码后可切换至可写目录；旧目录草稿不做自动迁移。 |

#### RISK-006: 指标汇总以偏概全（用部分数据冒充全网总量）

| 属性 | 值 |
|------|-----|
| **类别** | 数据风险 |
| **可能性** | 中 |
| **影响程度** | 中 |
| **风险等级** | **中风险** |
| **负责人** | N/A – 源文档未提供 |
| **描述** | 部分平台采集失败时，若只汇总成功平台并当作全网总量，或把 `null` 当 0 计算，会产出虚高的运营结论，误导后续选题决策。 |
| **缓解措施** | ① 设应采平台集合 `P`：`measuredPlatforms == P` 时才给出汇总数字；② **部分缺失时汇总值为 `null`**，并填充 `measuredPlatforms` / `unmeasuredPlatforms` 供 UI 标注覆盖范围；③ **零值 vs 缺失严格区分**：真实返回 `0` 为有效值参与求和；④ `totalEngagements` 在点赞 / 评论 / 转发 / 收藏任一为 `null` 时为 `null`。 |
| **应急预案** | 首次使用时全部环比 delta 为 `null` 属**预期行为**，非缺陷（历史快照尚未积累）。 |

#### RISK-007: 环比基准不可用导致的误读

| 属性 | 值 |
|------|-----|
| **类别** | 数据风险 |
| **可能性** | 高（首次使用必然发生） |
| **影响程度** | 低 |
| **风险等级** | **中风险** |
| **负责人** | N/A – 源文档未提供 |
| **描述** | 环比是**基于本地留存的次级指标**，其可用性取决于用户已积累的历史采集次数。若历史快照不足以覆盖完整上一个窗口，用不完整历史算出的近似百分比会产生误导。 |
| **缓解措施** | ① 基准取自本地**历史指标快照**（`metrics/{YYYY-MM-DD}.json`，按 `(platform, capturedAt)` 追加）；② `comparison.period` 表示**上一个等长窗口**；③ 历史不足 → 对应 delta 为 **`null`**（UI 显示「暂无环比」），**不得**用不完整历史算近似值。 |
| **应急预案** | 首次使用时全部 delta 为 `null`，UI 明确显示「暂无环比」而非 0%。 |

#### RISK-008: `draftsDir` 变更后旧草稿「丢失」的用户认知风险

| 属性 | 值 |
|------|-----|
| **类别** | 产品风险 / 数据风险 |
| **可能性** | 中 |
| **影响程度** | 中 |
| **风险等级** | **中风险** |
| **负责人** | N/A – 源文档未提供 |
| **描述** | 切换草稿目录后旧草稿**不做自动迁移**，用户可能误判数据丢失。 |
| **缓解措施** | ① 配置页切换提示文案**须同时覆盖三件事实**：「新目录对后续操作生效；正在进行的保存仍写入原目录。旧草稿不会自动迁移。」；② 草稿库的「当前生效目录」由 `config.get` 返回，UI 据此展示**实际存储位置**。 |
| **应急预案** | 用户可手动迁移旧目录文件；`config.get` 的目录回显帮助定位。 |

#### RISK-009: 两套状态枚举误用

| 属性 | 值 |
|------|-----|
| **类别** | 架构风险 / 实现风险 |
| **可能性** | 中 |
| **影响程度** | 中 |
| **风险等级** | **中风险** |
| **负责人** | N/A – 源文档未提供 |
| **描述** | 系统存在**两套不同**的状态枚举：`ItemStatus`（五态）与 `ContentDraft.status`（四态）。`draft_ready` 与 `ready_for_review` **语义等价但命名不同**，属历史差异。若在代码或接口中**直接互换赋值**，会造成状态语义错乱。 |
| **缓解措施** | ① 二者**不可互换**，必须经架构文档 §4.3 **映射表**转换；② **新增状态时必须同时更新该映射表**；③ `ItemStatus` 已收敛为 PRD §5.3.1 的**五态**，`approved` / `archived` **不得重新引入**。 |
| **应急预案** | 以 `src/types.ts` 权威定义为准，经 `pnpm typecheck` + `pnpm test` 校验一致性。 |

#### RISK-010: 测试污染开发者真实 `$DSH_HOME`

| 属性 | 值 |
|------|-----|
| **类别** | 工程风险 / 数据风险 |
| **可能性** | 高（若不遵守隔离规则） |
| **影响程度** | 中 |
| **风险等级** | **高风险** |
| **负责人** | N/A – 源文档未提供 |
| **描述** | `ConfigStore` 经 `resolveDshHome` **回退到真实主目录**。测试若直接 `new ConfigStore(undefined, …)` 并调用 `save()`，会**改写用户真实配置**。若隔离放在 `beforeAll`，钩子在收集之后才运行，用例在 describe 作用域捕获的仍是**未隔离值**，`afterEach` 恢复它会把真实目录**带回来**。 |
| **缓解措施** | ① 隔离必须在**测试文件被导入 / 收集之前**生效（`tests/setup-isolation.ts` 在**模块作用域**赋值，**不得**放 `beforeAll`）；② 每个会写配置的用例使用独立 `DSH_HOME` 或显式 `profileContext.home`；③ 加外层**哨兵 spec** 防止回归。 |
| **应急预案** | 一旦污染，用户需手工还原 `$DSH_HOME/ops-manager/config.json`。 |

#### RISK-011: 令牌明文暴露面扩大

| 属性 | 值 |
|------|-----|
| **类别** | 安全风险 |
| **可能性** | 低（当前边界清晰） |
| **影响程度** | 高 |
| **风险等级** | **中风险** |
| **负责人** | N/A – 源文档未提供 |
| **描述** | `config.get` 当前**返回明文 `token`**（供客户端表单回填与显隐切换）。该设计的前提是「仅在**宿主内 RPC**（本机进程内）暴露，不作为对外网络端点」。若未来 RPC 可被**非本机访问**，则令牌将明文外泄。 |
| **缓解措施** | **前置条件已写入架构**：若未来 RPC 可被非本机访问，**必须先**改为「只回 `hasToken: boolean`，明文另走回填专用通道」；日志与遥测**必须脱敏**，不得记录令牌。 |
| **应急预案** | 轮换 Injoys 令牌；评审时检查该接口的暴露边界。 |

#### RISK-012: Phase 2 浏览器登录端点依赖未验证的 CDP 能力

| 属性 | 值 |
|------|-----|
| **类别** | 集成风险 / 计划风险 |
| **可能性** | 中 |
| **影响程度** | 低 |
| **风险等级** | **低风险** |
| **负责人** | N/A – 源文档未提供 |
| **描述** | `browser.login.startQr` / `pollQr` / `openHeadful` / `cancel` 为 Phase 2 计划的**前台交互窗与二维码推流**设计，**需依赖 BrowserOS CDP 高级 API 验证**（源文档明示「需 PoC 验证」）。若 API 不支持，该方案需重新设计。 |
| **缓解措施** | Phase 0 **不依赖**该能力：工作台采用**引导用户在当前 BrowserOS 实例中直接扫码登录**；Phase 2 前先做 **PoC 验证**。 |
| **应急预案** | 回退到 Phase 0 的引导式扫码登录。 |

---

## 🔧 技术债务

### TD-001: 架构文档已定义但尚未实现的 RPC 方法

| 属性 | 值 |
|------|-----|
| **类型** | 文档债务 / 实现债务 |
| **严重性** | 中 |
| **描述** | 架构文档 §3 已定义契约、但**仍未实现**的方法：`workbench.generateCalendar`、`calendar.list`、`calendar.updateStatus`、`workbench.exportCalendar`、`workbench.importCalendar`、`workbench.sinkToInjoysDoc`、`tools.catalog`、`tools.toggle`、`tools.executeSandbox`、`tools.telemetry`；以及 v1.4.1 补齐的**字段级未实现**：`browseros.capabilities`（§3.12.3，`src/` 无此方法）、`injoys.test.documentCount`（`src/ops-rpc.ts` 当前仅返回 `{ connected; latencyMs; message }`）、`statuses.loginUrl`（`src/types.ts` `PlatformSessionStatus` 无此字段）。 |
| **影响** | 排期、显式物料沉淀、AI 工具中枢尚未可用；草稿版本历史已由 MVP 裁决移出范围；文档与实现存在落差，易被误读为「已实现」。 |
| **目标解决时间** | N/A – 源文档未提供（见 `.context/domain/source/development_plan.md` 阶段划分） |
| **解决方案** | 按 criterion §6 的 **SSoT-first** 顺序：先补 `src/types.ts` 契约 → 再补 `src/ops-rpc.ts` 方法契约 → 再实现 Adapter / 领域服务 → 最后接客户端 UI 与测试。 |
| **估算工作量** | N/A – 源文档未提供 |

### TD-002: 客户端工作台 UI 接入缺口

| 属性 | 值 |
|------|-----|
| **类型** | 实现债务 |
| **严重性** | 中 |
| **描述** | 客户端当前**仅接入** `config.get`、`config.save`、`injoys.test`、`browser.sessions`；工作台类（`workbench.*`）与草稿类（`drafts.*`）方法**待客户端 UI 接入**。 |
| **影响** | 6 大业务 Tab 中的驾驶舱、排期日历、创作室等尚不能端到端使用。 |
| **目标解决时间** | N/A – 源文档未提供（与开发计划「客户端草稿工作台 UI 待实现」一致） |
| **解决方案** | 在宿主侧方法实现完成后接入客户端；严格经 `callOpsRpc`，样式走设计令牌。 |
| **估算工作量** | N/A – 源文档未提供 |

### TD-003: 文档与实现的入参字段名差异（`params` vs `payload`）

| 属性 | 值 |
|------|-----|
| **类型** | 文档债务 |
| **严重性** | 低 |
| **描述** | 架构文档 §2.2 将请求信封入参字段写作 `params`，而**实际实现为 `payload`**（criterion §5.4 已明确「实现口径（与文档差异，以本行为准）」）。 |
| **影响** | 仅读架构文档的实现者可能写错字段名。 |
| **目标解决时间** | N/A – 源文档未提供 |
| **解决方案** | 已在 criterion §5.4 记录权威口径；架构文档 §2.2 的表述待后续修订对齐。**以 criterion 为准**。 |
| **估算工作量** | N/A – 源文档未提供 |

### TD-004: 状态枚举命名历史差异（`draft_ready` vs `ready_for_review`）

| 属性 | 值 |
|------|-----|
| **类型** | 架构债务 |
| **严重性** | 中 |
| **描述** | `CalendarItem.status` 的 `draft_ready` 与 `ContentDraft.status` 的 `ready_for_review` **语义等价但命名不同**，源文档已明示这属「两套枚举的历史差异」。 |
| **影响** | 需时刻依赖映射表转换；误用会导致状态语义错乱（见 RISK-009）。 |
| **目标解决时间** | N/A – 源文档未提供（源文档仅要求「必须经本表映射」，**未计划统一命名**） |
| **解决方案** | 短期：严格经映射表转换，新增状态时同步更新映射表。长期若需统一命名，属**破坏性变更**，须先更新架构文档与 `src/types.ts`。 |
| **估算工作量** | N/A – 源文档未提供 |

### TD-005: 本地 `views` 兼容字段的误用风险

| 属性 | 值 |
|------|-----|
| **类型** | 代码债务 |
| **严重性** | 中 |
| **描述** | `PlatformMetrics.views` 为兼容字段（`impressions ?? plays ?? 0`），其表达式**在缺失时会产出 0**，与「不可按 0 伪造缺失值」的原则冲突。 |
| **影响** | 若业务代码直接消费 `views`，会把「采集失败」误当作「0 播放」，违反指标真实性约束。 |
| **目标解决时间** | N/A – 源文档未提供 |
| **解决方案** | 架构文档与 criterion 已明确：`views` **仅向后兼容，不得作为缺失指标的真实值**。业务逻辑须消费 `impressions` / `plays` 并处理 `null`。 |
| **估算工作量** | N/A – 源文档未提供 |

### TD-006: Phase 0 排期导出无双向冲突解决

| 属性 | 值 |
|------|-----|
| **类型** | 架构债务（**有意为之**） |
| **严重性** | 低 |
| **描述** | Phase 0 采用「本地主数据 + 单向导出」，**不做复杂的实时双向冲突解决**，以避免数据覆盖。 |
| **影响** | Injoys 表格侧的手工修改不会实时回流；需显式 `workbench.importCalendar` 导入，且导入**不覆盖**本地已 `prefilled` / `published` 项的状态与 `publishedUrl`（本地状态优先）。 |
| **目标解决时间** | Phase 3（源文档 §5.3 规划：行级 ID 映射表 + 时间戳版本 + LWW + 冲突行拆分标记） |
| **解决方案** | 按源文档 §5.3 的 Phase 3 演进路径实施。 |
| **估算工作量** | N/A – 源文档未提供 |

### TD-007: `workbench.overview` 未实现部分缺失汇总语义（**触碰架构铁律 3**）

| 属性 | 值 |
|------|-----|
| **类型** | 实现债务 / **契约债务** |
| **严重性** | **高** |
| **描述** | 源文档 §3.1 与 criterion §4 要求：应采平台未全部成功时汇总值必须为 `null`，并填充 `measuredPlatforms` / `unmeasuredPlatforms`；`totalEngagements` 在点赞/评论/转发/收藏任一为 `null` 时为 `null`。但 `src/ops-rpc.ts` 的 `workbench.overview` 对非 `null` 值**直接累加**，且响应中**缺少** `measuredPlatforms` / `unmeasuredPlatforms` / `totalEngagements` / `totalFavorites` / `comparison` / `weeklyPipeline` 字段。 |
| **影响** | **可能产出「以偏概全」的全网总量** —— 部分平台采集失败时仍返回数字，违反**架构铁律 3**（绝不用不完整数据冒充全网总量）；环比与本周排期进度亦不可用。这是本项目**质量目标第 2 位（数据真实性）**的直接违反。 |
| **目标解决时间** | N/A – 源文档未提供（建议**优先于其他 TD**） |
| **解决方案** | 严格按 **SSoT-first**：① 先补 `src/types.ts`（含 `windowStart` / `windowEnd` 与汇总字段，见 `data_architecture.md` 的 `PlatformMetrics` 注）；② 再补 `src/ops-rpc.ts` 的类型与方法契约；③ 在 `src/analytics/` 实现汇总判定（`measuredPlatforms == P` 才给数字，否则 `null`）；④ 补测试覆盖「部分缺失 → `null`」与「真实 0 参与求和」两条用例。 |
| **估算工作量** | N/A – 源文档未提供 |

### TD-008: 生成路径未授权写入 Injoys 文档（**越过内容写入边界**）

| 属性 | 值 |
|------|-----|
| **类型** | 契约债务 / 实现债务 |
| **严重性** | **高** |
| **描述** | criterion §4「内容写入边界」与架构 §3.4 / §3.5.1 规定：生成只保存本地，写入 Injoys 文档必须由用户点击沉淀操作或明确要求（唯一授权入口为 `workbench.sinkToInjoysDoc`，尚未实现，见 TD-001）。但 `src/ops-rpc.ts` 的 `workbench.generateArticleDraft`、`src/tools/index.ts` 的 `ops_draft_article` / `ops_draft_video_meta`、`src/analytics/review-reporter.ts` 经 `InjoysClient.saveArticleDocument` / `saveVideoDocument` / `saveReviewDocument` 在**生成/复盘阶段无条件**调用 `document.create` 写入 Injoys，无任何「用户显式触发」前置判定。 |
| **影响** | 在用户未授权时即把物料写入其 Injoys 空间，越过 criterion §4 的内容写入边界；`api_strategy.md` 的 MVP 裁决说明已标注「本轮未改代码，尚未核查运行时是否已对齐」，即契约已声明、实现尚未完成核查闭环。 |
| **目标解决时间** | N/A – 源文档未提供（建议按 SSoT-first 提案优先处理） |
| **解决方案** | 按 criterion §6 顺序：① 先补齐 `workbench.sinkToInjoysDoc` 契约与实现，作为**唯一**的用户显式沉淀入口；② 从生成 / 复盘路径移除无条件的 `document.create` 调用；③ 同步修正 `src/tools/index.ts` 中与契约相悖的工具描述文案；④ 补测试覆盖「未显式触发时不写远端」。 |
| **估算工作量** | N/A – 源文档未提供 |

### TD-009: `ops_generate_review` 以字面量 `doc_review` 冒充文档编号（**虚报成功**）

| 属性 | 值 |
|------|-----|
| **类型** | 契约债务 / 实现债务 |
| **严重性** | **高** |
| **描述** | criterion §3.2「虚报成功（无客户端或执行失败时严禁返回成功）」与架构 §3.5.1「不得谎报成功，也不得静默写本地假 ID」。`src/injoys/client.ts` 的 `saveReviewDocument` 在失败 / 未配置时 `catch` 后返回 `null`；但 `src/tools/index.ts` 的 `ops_generate_review` 以 `report.injoysDocId ?? 'doc_review'` 回退为字面量假编号，并经 `output.schema` 将 `injoysDocId` 声明为 `required` 字符串，最终渲染进用户可见文案。 |
| **影响** | 知识库未连通或写入失败时，向用户与 AI 会话播报一个不存在的文档编号，调用方无法区分「已沉淀」与「未沉淀」；`domain/testing_strategy.md` 模块 8 场景 3「知识库未连通时……不得显示『沉淀成功』」在实现侧必然失败。 |
| **解决方案** | 按 criterion §6：① 将 `injoysDocId` 改为可空并取消 `required`；② 失败时如实返回未沉淀状态或抛错，不得回退占位编号；③ 补测试覆盖「知识库未连通时不得返回成功文档编号」。 |
| **目标解决时间** | N/A – 源文档未提供 |
| **估算工作量** | N/A – 源文档未提供 |

### TD-010: `calendar/` 与 `metrics/` 持久化契约未落地

| 属性 | 值 |
|------|-----|
| **类型** | 文档债务 / 实现债务 |
| **严重性** | 中 |
| **描述** | `data_architecture.md`、`system_design.md`、`tech_stack.md` 声明 `$DSH_HOME/growth-studio/calendar/{id}.json`（排期黄金主数据源）与 `metrics/{YYYY-MM-DD}.json`（指标历史快照，按 `(platform, capturedAt)` 追加）；criterion §4 亦以 `metrics/` 作为环比基准的权威口径。但当前实现只有 `src/storage/draft-store.ts` 与 `src/config-store.ts` 执行落盘，`src/` 下没有任何 `metrics` / `calendar` 目录的读写实现。 |
| **影响** | 排期主数据与指标历史均无持久化，criterion §4「历史不足以覆盖完整对比窗口时 delta 必须为 null」因目录不存在而恒成立；读者据架构资产会误以为指标历史已落盘。 |
| **目标解决时间** | N/A – 源文档未提供 |
| **解决方案** | 按 criterion §6 先补契约 / 类型，再实现 `calendar` / `metrics` 存储服务；`data_architecture.md` 的「仍保留」措辞宜补实现状态提示，与同类处理保持一致。 |
| **估算工作量** | N/A – 源文档未提供 |

### TD-011: 错误码 `ops/not-found` 与 `ops/draft-not-found` 语义重复

| 属性 | 值 |
|------|-----|
| **类型** | 契约债务 / 代码债务 |
| **严重性** | 低 |
| **描述** | 同一语义「草稿不存在」存在两个错误码：`src/ops-rpc.ts` 的 `drafts.get` 抛 `ops/not-found`（`Draft not found`），`workbench.prefillDraft` 抛 `ops/draft-not-found`（`草稿不存在`）。而 `api_strategy.md` §AI 引用指南明文要求「错误码必须使用上方清单中的既有值，**不得自造语义相近的新码**」。 |
| **影响** | 调用方需同时处理两种「未找到」；清单内部自相冲突，削弱错误码目录的规范性。 |
| **目标解决时间** | N/A – 源文档未提供 |
| **解决方案** | 按 criterion §6 SSoT-first：在契约提案中统一为**单一「未找到」码**（建议保留 `ops/not-found`，将 `workbench.prefillDraft` 的 `ops/draft-not-found` 并入），并同步 `api_strategy.md` §2.3、`cross_cutting_concepts.md` 与调用方；**不在资产侧擅自改契约或删码**。 |
| **估算工作量** | N/A – 源文档未提供 |

### TD-012: BrowserOS 能力开关契约与实现尚未对齐（**安全边界缺口**）

| 属性 | 值 |
|------|-----|
| **类型** | 安全契约债务 / 实现债务 |
| **严重性** | **高** |
| **描述** | criterion §4「最小权限」现行口径为**能力开关模型**（默认八项 `tabs/navigate/snapshot/act/read/grep/wait/upload`、其余默认关闭可手动开启、`shell`/`cmd` 若暴露同样由用户管理），由 TAD §3.12 定义契约。实现侧：`src/browser/browseros-bridge.ts` 的 `EXPECTED_TOOLS` 现为固定 7 项（缺 `upload`），`src/browser/browser-driver.ts` 调用 `upload`；`src/` 内**尚无能力开关与统一执行检查实现**（无 `browserosCapabilities` 配置字段、无 `browseros.capabilities` 方法、无 `browser/capability-disabled` 等错误码）。 |
| **影响** | 能力开关是当前最小权限权威口径，但实现层仍是「开放集合 + 无宿主侧检查」；AI 按 criterion/TAD 实施会误判能力开关已生效，安全审查也无法据此定位越界调用。 |
| **目标解决时间** | N/A – 源文档未提供 |
| **解决方案** | 按 criterion §6 / §7.1 SSoT-first：① 在 `src/types.ts` + `src/config-store.ts` 落 `browserosCapabilities` 字段与默认八项解析（`Set.has` + `hasOwnProperty` 空值短路）；② 在 `browseros-bridge.ts` 的 `callTool` 统一入口集中检查「存在/启用/连接可用」，Adapter 禁止绕过；③ 在 `src/ops-rpc.ts` 落 `browseros.capabilities` 方法与 `browser/capability-disabled` / `browser/tool-unavailable` / `browser/not-connected` 三个错误码；④ 同步测试覆盖默认八项、显式关闭重启保持、禁用拒绝、两层开关同时满足。 |
| **估算工作量** | N/A – 源文档未提供 |

### TD-013: criterion 文件权限约束无实现落点

| 属性 | 值 |
|------|-----|
| **类型** | 实现债务 |
| **严重性** | 中 |
| **描述** | criterion §3.5 MUST 声明「系统文件权限仅限当前操作系统用户」（`criterion.md` §3.5），但 `src/storage/draft-store.ts` 与 `src/config-store.ts` 的 `writeFileSync` / `mkdirSync` 均未传 `mode`（`grep -rn "mode:" src/` 为空），实际权限取决于进程 umask。 |
| **影响** | 多用户主机上草稿与配置（含 Injoys 令牌）可能对同机其他用户可读，与 MUST 声明不符。 |
| **目标解决时间** | N/A – 源文档未提供 |
| **解决方案** | 补实现：草稿 / 配置文件写入显式 `mode: 0o600`、目录 `0o700`（或在统一落盘封装内集中设定），并补权限位断言测试。属实现变更，须走提案。 |
| **估算工作量** | N/A – 源文档未提供 |

### TD-014: 客户端 RPC 消费无测试覆盖（契约同步机制未闭环）

| 属性 | 值 |
|------|-----|
| **类型** | 测试债务 |
| **严重性** | 中 |
| **描述** | criterion §7.2 将 `pnpm test` 列为 API 层契约的同步/校验方式之一。但 `tests/`（`ops-manager.spec.ts`、`browseros-scraping.spec.ts`、`isolation.spec.ts`）仅覆盖宿主侧 `registerOpsRpc`、`ConfigStore`、`DraftStore`、领域服务与适配器，**无任何用例引用 `callOpsRpc` / `unwrapRpcResult`**（`grep -rn "callOpsRpc\|unwrapRpcResult" tests/` 为空）。客户端消费实现位于 `plugin-src/management-rpc.mjs`（`callOpsRpc` / `unwrapRpcResult`）与 `plugin-src/client/index.js`、`plugin-src/client/ops-page.js`，为 JavaScript（ESM），无编译期类型校验，亦无对应测试。 |
| **影响** | 宿主信封与客户端消费的字段/错误语义一致性缺少自动化证据；criterion §7.2 所述「同步方式」在客户端侧目前只是目标口径而非既有保障，易被误读为已覆盖。 |
| **目标解决时间** | N/A – 源文档未提供 |
| **解决方案** | 补客户端消费测试：对 `callOpsRpc`（`POST /api/ops` 请求构造、错误码透传）与 `unwrapRpcResult`（`ok/result/error` 解包、失败抛出）建立用例，并可加一条「宿主响应形状 ↔ 客户端解包」契约用例。属测试/实现变更，须走提案。 |
| **估算工作量** | N/A – 源文档未提供 |

### TD-015: `PlatformId` 含 `xiaohongshu`（9 值）但适配器未注册

| 属性 | 值 |
|------|-----|
| **类型** | 契约 / 实现债务 |
| **严重性** | 中 |
| **描述** | 源文档 §4.1（v1.4.4）与 criterion §5.5 的 `PlatformId` 已含 `xiaohongshu`（9 值），但 `src/adapters/registry.ts` 构造函数只注册 8 个适配器（`WeChatArticleAdapter` / `BilibiliVideoAdapter` / `ChannelsVideoAdapter` / `DouyinVideoAdapter` / `YouTubeAdapter` / `TikTokAdapter` / `TwitterXAdapter` / `ProductHuntAdapter`），`src/adapters/` 无 `XiaohongshuAdapter`。 |
| **影响** | `AdapterRegistry.get('xiaohongshu')` 返回空；`workbench.prefillDraft` 对 `xiaohongshu` 命中 `ops/platform-unsupported`。契约（枚举 9 值）与实现（8 个适配器）存在「枚举声明 vs 适配器注册」落差。 |
| **目标解决时间** | N/A – 源文档未提供（需先确认 `xiaohongshu` 是否属 Phase 0/1 交付范围） |
| **解决方案** | 二选一：① 若近期不需 `xiaohongshu`，维持现状并保留本债务条目（不改契约枚举，避免与 criterion §5.5 冲突）；② 若需支持，新增 `XiaohongshuAdapter`（`src/adapters/`）并经 `AdapterRegistry` 注册、补测试。二者均属**新增能力 / 实现变更**，须走 SSoT-first 提案。 |
| **估算工作量** | N/A – 源文档未提供 |

> ⚠️ 本文档**只记录债务，不在架构资产内修改实现**。生成资产已忠实于源文档契约；
> 修复须由实现侧按 criterion §6 的顺序完成。

---

## 📊 追踪看板

| ID | 类型 | 名称 | 严重性 / 等级 | 负责人 | 状态 | 更新日期 |
|----|------|------|--------------|--------|------|---------|
| RISK-001 | 风险 | 状态真实性被绕过 | 极高 | N/A | 已由契约守卫缓解 | 2026-10-16 |
| RISK-002 | 风险 | 误发布 / 不可控群发 | 高 | N/A | 已由能力移除缓解 | 2026-10-16 |
| RISK-003 | 风险 | 会话状态假阳性 | 高 | N/A | 未缓解 / 待修复（Cookie 探测分支待提案移除） | 2026-10-16 |
| RISK-004 | 风险 | 配置切换竞态跨库覆盖 | 高 | N/A | 已由目录固定缓解 | 2026-10-16 |
| RISK-005 | 风险 | 存储不可用误报 | 中 | N/A | 已由前置校验缓解 | 2026-10-16 |
| RISK-006 | 风险 | 指标汇总以偏概全 | 中 | N/A | 已定义契约方案，落实待 TD-007 | 2026-10-16 |
| RISK-007 | 风险 | 环比基准不可用误读 | 中 | N/A | 已由 null 语义缓解 | 2026-10-16 |
| RISK-008 | 风险 | 旧草稿「丢失」认知 | 中 | N/A | 已由提示文案缓解 | 2026-10-16 |
| RISK-009 | 风险 | 两套状态枚举误用 | 中 | N/A | 监控中（依赖映射表） | 2026-10-16 |
| RISK-010 | 风险 | 测试污染真实 `$DSH_HOME` | 高 | N/A | 已由模块级隔离缓解 | 2026-10-16 |
| RISK-011 | 风险 | 令牌明文暴露面扩大 | 中 | N/A | 监控中（边界前置条件） | 2026-10-16 |
| RISK-012 | 风险 | Phase 2 CDP 能力未验证 | 低 | N/A | 待 PoC | 2026-10-16 |
| TD-001 | 技术债 | 未实现 RPC 方法 | 中 | N/A | 待处理 | 2026-10-16 |
| TD-002 | 技术债 | 客户端 UI 接入缺口 | 中 | N/A | 待处理 | 2026-10-16 |
| TD-003 | 技术债 | 字段名文档差异 | 低 | N/A | 已记录权威口径 | 2026-10-16 |
| TD-004 | 技术债 | 状态枚举命名差异 | 中 | N/A | 长期 | 2026-10-16 |
| TD-005 | 技术债 | `views` 兼容字段误用 | 中 | N/A | 监控中 | 2026-10-16 |
| TD-006 | 技术债 | 排期无双向同步 | 低 | N/A | 计划 Phase 3 | 2026-10-16 |
| TD-007 | 技术债 | `workbench.overview` 未实现部分缺失汇总语义（**违反铁律 3**） | **高** | N/A | **待处理（优先）** | 2026-10-16 |
| TD-008 | 技术债 | 生成路径未授权写入 Injoys 文档（**越过内容写入边界**） | **高** | N/A | **待处理（优先）** | 2026-10-16 |
| TD-009 | 技术债 | `ops_generate_review` 以字面量 `doc_review` 冒充文档编号（**虚报成功**） | **高** | N/A | **待处理（优先）** | 2026-10-16 |
| TD-010 | 技术债 | `calendar/` 与 `metrics/` 持久化契约未落地 | 中 | N/A | 待处理 | 2026-10-16 |
| TD-011 | 技术债 | 错误码 `ops/not-found` 与 `ops/draft-not-found` 语义重复 | 低 | N/A | 待处理 | 2026-10-16 |
| TD-012 | 技术债 | BrowserOS 能力开关契约与实现尚未对齐（安全边界缺口） | 高 | N/A | 待处理 | 2026-10-16 |
| TD-013 | 技术债 | criterion 文件权限约束无实现落点 | 中 | N/A | 待处理 | 2026-10-16 |
| TD-014 | 技术债 | 客户端 RPC 消费无测试覆盖（契约同步机制未闭环） | 中 | N/A | 待处理 | 2026-10-16 |
| TD-015 | 技术债 | `PlatformId` 含 `xiaohongshu`（9 值）但适配器未注册 | 中 | N/A | 待处理 | 2026-10-17 |

---

## 🔗 相关文档

| 文档 | 关系 |
|------|------|
| `security_policy.md` | 安全守卫的完整契约 |
| `runtime_view.md` | 风险场景的时序细节 |
| `data_architecture.md` | 状态映射与持久化布局 |
| `../domain/risks_and_debt.md` | 业务层风险与项目债务 |
| `../criterion.md` | **约束权威来源** |

---

## AI 引用指南

当 AI 进行架构规划时：
1. 检查风险清单，避免触发已识别风险（尤其 RISK-001 / 002 / 004 / 010）
2. 优先解决中高严重性技术债务
3. 在提案中标注相关风险缓解措施
4. 不得为「消除文档落差」而跳过 SSoT-first 顺序直接实现
