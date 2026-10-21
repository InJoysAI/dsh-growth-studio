# Phase 3: 客户端工作台 UI 接入

> **返回总纲**: [proposal-roadmap.md](./proposal-roadmap.md)
> **文件名**: `proposal-roadmap-Phase-3.md`（编号与总纲阶段总览一致：Phase 3 → `Phase-3`）
> **状态**: proposed
> **来源**: `.context/architecture/risks_and_debt.md`（TD-002 / TD-012）；`.context/domain/risks_and_debt.md`（PD-004）；`.context/architecture/adr_003_custom_rpc_envelope.md` / `adr_007_manual_refresh_no_persistent_connection.md` / `adr_009_browseros_capability_management.md`；`.context/architecture/api_strategy.md` §3.4 / §3.6 / §3.7 / §3.9 / §4；`.context/domain/business_rules.md`（BR-052 / BR-074）；`.context/domain/testing_strategy.md` 模块 1 / 2 / 3 / 6 / 7
> **预计工作量与周期**: ~36.5 人日（**规划估算**；源文档工作量字段为 `N/A – 源文档未提供`。其中 19 人日来自提案 1–6，17.5 人日来自 `plan add ui` 追加的提案 7–15）

## 阶段目标与范围

- **目标与交付结果**：把 Phase 0–2 已就绪的宿主契约接进客户端 6 大 Tab 中 Phase 0 所需的 5 个 Tab（运营驾驶舱、内容创作室、排期日历、AI 工具中枢、引擎与平台配置），偿还 PD-004（高）的界面缺口，使「草稿管理 → 多变体编辑 → 预填入口」可在界面完成。
- **In / Out**：
  - ✅ In：`config.*` 接入引擎策略配置页（含 BrowserOS **能力管理**）；驾驶舱指标 / 渠道矩阵 / 引擎状态（知识库连通性 + 文档数、浏览器引擎连接状态）接入；内容创作室与草稿库接入（含沉淀入口）；公众号 / B站真实样式模拟器；排期日历流水与回填入口；AI 工具中枢与沙箱控制台。
  - ❌ Out：新增宿主能力（Phase 0–2 已提供全部所需契约）；舆情监控 Tab 的评论抓取（属 PRD Phase 1，**不在本路线图范围**）；热点雷达的选题生成（数据源属 Phase 0 原型，PRD 未指定渠道，见 `risks_and_debt.md` 外部依赖）；P2 技能包 / 自定义编辑器（PD-002）；细粒度行为拦截界面（ADR-009 边界：能力开关 ≠ 行为拦截）。
- **适用约束**：
  - `criterion.md` §3.1「客户端禁止绕过 `callOpsRpc` 直连 Injoys / BrowserOS MCP 或任何外部服务」；
  - `criterion.md` §3.3「禁止硬编码色值」——样式走设计令牌；
  - `criterion.md` §3.4「在 Phase 0 禁止 WebSocket / SSE 持久连接或后台定时轮询」——刷新经 `adr_007_manual_refresh_no_persistent_connection.md` 的手动刷新；「令牌返回边界」的本机回填例外**已由该条授权**（客户端运行在 DSH 渲染进程，属本机受信任客户端）；
  - `criterion.md` §6 SSoT-first（UI 是依赖链末端，必须等宿主契约就绪）。

## 提案详情

### 提案 1: 引擎策略配置页接入（含 BrowserOS 能力管理）

**Change ID:** `feat-client-engine-config`  
**优先级:** P0  
**预计时间:** 3 人日（规划估算）  
**状态:** proposed  
**变更类型（change_kind）:** `code`（判定依据：新增或修改宿主 / 客户端业务代码及其测试；契约文档同步属 SSoT-first 随附动作，不单独计为文档类交付）  

**业务目标（Business Goal）**:
- 把 `config.get` / `config.save` / `injoys.test` 接入配置页 UI，支持全局运营策略即时生效、连通性测试（展示延迟）与凭证显隐切换。
- 落地 **BrowserOS 能力管理** UI：基于 `browseros.capabilities` 呈现能力清单与启停，经 `config.save` 的 `browserosCapabilities` 持久化，落实 BR-074。
- 展示本地草稿存储目录与切换提示文案（三件事实），落实 RISK-008 缓解措施。

**范围边界（In / Out）**:

| 类型 | 内容 |
|------|------|
| ✅ In | 配置页表单接入 `config.get`（平铺契约）/ `config.save` / `injoys.test`（含 `latencyMs` / `documentCount`） |
| ✅ In | 默认产品名称、基调、`draftsDir`、`autoSyncToInjoys` 编辑与热更新 |
| ✅ In | BrowserOS 能力管理：`browseros.capabilities` 能力清单（默认八项启用、其余默认关闭）+ 启停开关，经 `config.save` 持久化；未暴露工具**不列出**，未连接状态灯表达连接状态 |
| ✅ In | 凭证掩码 + 显隐切换；目录切换提示文案（覆盖三件事实） |
| ✅ In | 硬编码色值治理：样式走设计令牌 |
| ❌ Out | `reuseHostBrowserProfile` 编辑入口（Phase 0 的 `fix-browser-session-cookie-probe` 已退役该字段，UI 不再提供） |
| ❌ Out | 细粒度行为拦截界面（ADR-009 边界：能力开关 ≠ 行为拦截） |
| ❌ Out | 新宿主配置字段（Phase 0–2 已提供 `browserosCapabilities`） |

> [!NOTE]
> **令牌口径已裁决（本提案不再受阻）**：`criterion.md` §3.4「令牌返回边界（本机回填例外，唯一授权口径）」已明确授权 `config.get` / `config.save` 向**本机受信任的 DSH 客户端**返回明文 `token`，仅用于表单回填与显隐切换；客户端工作台运行在 DSH Desktop 渲染进程，与宿主非同进程但属**同一 DSH 实例内的受信任客户端**，适用该例外。本提案据此实施显隐切换，**不再有待决门槛**；若未来 RPC 可被非本机访问，须先改契约（只回 `hasToken: boolean`）再改 UI。

**关联 Context 资产**:

| Scope | 关联资产 | 关联说明 |
|-------|---------|----------|
| criterion | `.context/criterion.md` | §3.1 经 `callOpsRpc`、§3.3 禁止硬编码色值、§3.4 令牌返回边界（本机回填例外）、§4 显隐切换与能力开关、§5.4 |
| architecture | `.context/architecture/api_strategy.md` | §3.6 `config.*`（平铺契约与令牌返回策略）、§3.7 `draftsDir` 变更语义、§3.9 `browseros.capabilities` |
| architecture | `.context/architecture/adr_009_browseros_capability_management.md` | 能力开关模型与边界（不夸大） |
| architecture | `.context/architecture/risks_and_debt.md` | TD-002、TD-012、RISK-008、RISK-011（令牌明文暴露面扩大） |
| domain | `.context/domain/business_rules.md` | BR-074（能力管理 / 状态灯展示规则：只展示连接状态，不推测 Profile） |
| domain | `.context/domain/testing_strategy.md` | 模块 6 场景 1 / 2 / 3 / 4 / 5 / 6 |

**关键任务**:
1. 配置页接入 `config.get`（平铺契约）与表单渲染（0.75 人日）
2. 接入 `config.save` 热更新与目录切换提示文案（0.75 人日）
3. 接入 `injoys.test` 连通性 / 延迟 / 文档数与凭证显隐（0.5 人日）
4. BrowserOS 能力管理 UI（清单 / 启停 / 未暴露不列出 / 逐项保存）（0.75 人日）
5. 样式令牌化与硬编码色值清理（0.25 人日）

**验证标准**:

| 验收项 | 验收条件 | 验收方式 |
|--------|----------|----------|
| 即时生效 | 保存后新建物料使用新配置，无需重启 | UI 验收 |
| 目录提示 | 切换目录时展示「新目录对后续操作生效；正在进行的保存仍写入原目录。旧草稿不会自动迁移」 | UI 验收 |
| 凭证显隐 | 默认掩码，点击可切明文 | UI 验收 |
| 能力管理 | 默认八项启用、其余默认关闭；关闭后保存并重启仍保持；未暴露工具不列出 | UI 验收 |
| 仅经 callOpsRpc | 客户端不直连 Injoys / BrowserOS | 代码审查 |
| 无 Profile 推测 | 状态灯只展示连接状态，不展示推测 / 硬编码的 Profile 路径 | UI 验收 + 代码审查 |

**验收场景（按需，建议 BDD）**:

```gherkin
场景: 全局运营策略即时生效
  Given 用户在工作台配置中修改默认产品名称
  When 用户保存设置
  Then 新建物料应以新的产品名称生成
    And 无需重启工作台即可生效

场景: BrowserOS 能力管理默认八项与启停保持（BR-074）
  Given 首次使用或旧配置缺少能力字段
  When 打开引擎策略配置 → BrowserOS 浏览器引擎 → 能力管理
  Then 默认八项 tabs/navigate/snapshot/act/read/grep/wait/upload 均启用
    And 其余实际暴露工具默认关闭

场景: 未暴露工具不列出（BR-074）
  Given 某工具当前连接未提供
  When 打开能力管理页
  Then 该工具不出现于清单（消失的工具就消失）
    And 未连接通过引擎状态灯（connected）表达
```

**依赖**:
- 前置: `feat-browseros-capability-toggle`、`fix-browser-session-cookie-probe`、`feat-injoys-test-document-count`
- 被依赖: 无
- 约束: 样式走设计令牌（criterion §3.3）；能力开关 UI 不得宣称具备细粒度行为拦截（ADR-009 边界）；令牌显隐依 criterion §3.4 本机回填例外

---

### 提案 2: 运营驾驶舱接入

**Change ID:** `feat-client-dashboard`  
**优先级:** P0  
**预计时间:** 3.5 人日（规划估算）  
**状态:** proposed  
**变更类型（change_kind）:** `code`（判定依据：新增或修改宿主 / 客户端业务代码及其测试；契约文档同步属 SSoT-first 随附动作，不单独计为文档类交付）  

**业务目标（Business Goal）**:
- 把 `workbench.overview` / `browser.sessions` / `injoys.test` 接入驾驶舱，呈现指标卡（含互动与关注增长）、渠道矩阵连通度与头部引擎状态。
- 正确呈现指标 `null` 语义（暂无数据 / 暂无环比）与四态会话，避免「以偏概全」误导用户；知识库引擎状态展示真实延迟与文档数，浏览器引擎状态**仅**展示连接状态。

**范围边界（In / Out）**:

| 类型 | 内容 |
|------|------|
| ✅ In | 驾驶舱接入 `workbench.overview`（指标卡 / 汇总 / 环比 / **互动与关注增长** / 本周排期进度）与 `browser.sessions`（渠道矩阵四态） |
| ✅ In | `null` 语义呈现：汇总缺失显示「暂无数据」、环比不足显示「暂无环比」，并展示 `measuredPlatforms` / `unmeasuredPlatforms` 覆盖范围 |
| ✅ In | 头部引擎状态：知识库中枢展示连通性 + `latencyMs` + `documentCount`（缺失为「暂无数据」，不显示 0）；浏览器引擎**仅**展示连接状态与「去登录 ↗」引导（不展示推测 Profile 路径） |
| ✅ In | 快捷行动组跳转创作室；手动刷新（无持久连接 / 轮询） |
| ❌ Out | 热点雷达真实选题来源（外部依赖未指定渠道） |
| ❌ Out | 指标采集适配器修复 |
| ❌ Out | BrowserOS Profile 路径展示（BR-074：仅在现有连接能真实提供时展示，MVP 不推测） |

**关联 Context 资产**:

| Scope | 关联资产 | 关联说明 |
|-------|---------|----------|
| criterion | `.context/criterion.md` | §3.1、§3.3、§3.4（禁止持久连接 / 轮询） |
| architecture | `.context/architecture/risks_and_debt.md` | TD-002、RISK-003（会话四态）、RISK-006 / RISK-007（null 语义） |
| architecture | `.context/architecture/api_strategy.md` | §3.1 `workbench.overview`、§3.4 `browser.sessions`、§3.6 `injoys.test` |
| architecture | `.context/architecture/adr_007_manual_refresh_no_persistent_connection.md` | 手动刷新裁决 |
| domain | `.context/domain/business_rules.md` | BR-052（互动与关注增长汇总）、BR-074（状态灯展示规则） |
| domain | `.context/domain/testing_strategy.md` | 模块 1 场景 1 / 2 / 3 / 4 / 5、模块 5 场景 4 / 5 / 6 |

**关键任务**:
1. 接入 `workbench.overview` 指标卡与汇总（含互动与关注增长、null 呈现与覆盖范围标注）（1.25 人日）
2. 接入 `browser.sessions` 渠道矩阵四态与连通度统计（0.75 人日）
3. 头部引擎状态（知识库：`injoys.test` 连通性 / 延迟 / 文档数；浏览器：`browser.sessions` 连接状态）与快捷行动组跳转（0.75 人日）
4. 手动刷新交互与样式令牌化（0.75 人日）

**验证标准**:

| 验收项 | 验收条件 | 验收方式 |
|--------|----------|----------|
| 汇总空值呈现 | 部分缺失时汇总显示「暂无数据」，不显示求和数字 | UI 验收 |
| 0 与缺失可区分 | 真实 0 显示为 0，采集失败显示「暂无数据」 | UI 验收 |
| 四态呈现 | 会话四态（未知 / 需登录 / 已认证 / 无权限）颜色与文案正确 | UI 验收 |
| 互动与关注增长 | 依 BR-052 呈现互动与关注增长汇总；缺失为「暂无数据」 | UI 验收 |
| 引擎状态灯 | 知识库展示延迟与文档数（缺失「暂无数据」）；浏览器仅展示连接状态 | UI 验收 |
| 无轮询 | 无 WebSocket / SSE / 后台轮询，仅手动刷新 | 代码审查 |

**验收场景（按需，建议 BDD）**:

```gherkin
场景: 分发矩阵连通度统计
  Given 工作台支持 2 个渠道
    And 其中仅 1 个渠道处于"已认证就绪"状态
  When 用户查看"分发矩阵连通度"指标卡
  Then 该指标应显示为 "1 / 2"
    And 不得显示为 "2 / 2"

场景: 部分渠道采集失败时汇总值为空（BR-050）
  Given "全网曝光/播放总量"应采集 2 个渠道
    And 仅 1 个渠道采集成功
  When 用户查看该汇总指标卡
  Then 汇总值应显示"暂无数据"
    And 界面应能看出哪些渠道未被采集

场景: 驾驶舱头部引擎状态
  Given 知识库中枢已正确配置且可连通
    And 浏览器引擎实例未启动
  When 用户查看驾驶舱头部
  Then 知识库中枢状态灯应为绿色并展示延迟与文档数
    And 浏览器引擎状态灯应为红色且仅表达连接状态
```

**依赖**:
- 前置: `fix-overview-metrics-null-semantics`、`feat-storage-metrics-snapshot`、`feat-calendar-generate-list`、`fix-browser-session-cookie-probe`、`feat-injoys-test-document-count`
- 被依赖: 无
- 约束: 依赖 Phase 0 的汇总语义、环比基准、统一会话四态与 `documentCount` 契约，以及 Phase 1 的 `weeklyPipeline` 周聚合；UI 只呈现，不自行计算全网汇总

---

### 提案 3: 内容创作室与草稿库接入

**Change ID:** `feat-client-content-studio`  
**优先级:** P0  
**预计时间:** 3 人日（规划估算）  
**状态:** proposed  
**变更类型（change_kind）:** `code`（判定依据：新增或修改宿主 / 客户端业务代码及其测试；契约文档同步属 SSoT-first 随附动作，不单独计为文档类交付）  

**业务目标（Business Goal）**:
- 把生成（`workbench.generateArticleDraft` / `generateVideoMeta`）、草稿库（`drafts.*`）与唯一沉淀入口（`workbench.sinkToInjoysDoc`）接入创作室。
- 让用户在界面完成「生成 → 编辑覆盖保存 → 显式沉淀」闭环，落实 PD-004 的核心体验。

**范围边界（In / Out）**:

| 类型 | 内容 |
|------|------|
| ✅ In | 生成输入（特性 / 受众 / 基调）与多渠道物料生成接入 |
| ✅ In | 草稿库列表 / 编辑 / 覆盖保存（`drafts.list` / `drafts.get` / `drafts.save`） |
| ✅ In | 「沉淀至 Injoys 知识文档」入口接入 `workbench.sinkToInjoysDoc`（显式触发） |
| ✅ In | 一键复制物料 |
| ✅ In | 从排期项发起创作时建立 `CalendarItem.documentId ↔ ContentDraft.id` 关联并推进排期状态（宿主侧不变量见 `feat-calendar-status-transitions`，criterion §5.5） |
| ❌ Out | 公众号 / B站模拟器（提案 4） |
| ❌ Out | 草稿历史 / 版本恢复（MVP 不提供） |

**关联 Context 资产**:

| Scope | 关联资产 | 关联说明 |
|-------|---------|----------|
| criterion | `.context/criterion.md` | §3.1、§3.3、§4 显式沉淀 |
| architecture | `.context/architecture/risks_and_debt.md` | TD-002、TD-008（沉淀边界） |
| architecture | `.context/architecture/api_strategy.md` | §3.1 生成 / 沉淀、§3.2 草稿类 |
| architecture | `.context/architecture/adr_008_version_snapshot_storage.md` | 单份草稿存储（无历史） |
| domain | `.context/domain/testing_strategy.md` | 模块 3 场景 1 / 2 / 5、模块 8 场景 2 / 3 |

**关键任务**:
1. 生成表单与多渠道物料生成接入（0.75 人日）
2. 草稿库列表 / 编辑器 / 覆盖保存接入（1.25 人日）
3. 沉淀入口接入与未连通提示（0.5 人日）
4. 一键复制物料与样式令牌化（0.5 人日）

**验证标准**:

| 验收项 | 验收条件 | 验收方式 |
|--------|----------|----------|
| 生成即本地存盘 | 生成后草稿本地持久化，重启可查看 | UI 验收 |
| 覆盖保存 | 二次编辑覆盖保存，无历史快照 | UI 验收 |
| 显式沉淀 | 未点击沉淀则无远端写入；点击后按真实结果显示成功 / 失败 | UI 验收 + 网络检查 |
| 复制一致 | 剪贴板内容与预览物料一致 | UI 验收 |

**验收场景（按需，建议 BDD）**:

```gherkin
场景: 物料生成与本地存盘
  Given 用户位于内容创作室
    And 用户已输入本次更新特性、目标受众与基调风格
  When 用户触发 AI 生成物料
  Then 应生成结合产品知识库的多渠道物料
    And 物料应自动保存至本地草稿库
    And 未经用户明确要求不得创建或更新 Injoys 文档

场景: 当前草稿编辑与覆盖保存
  Given 本地草稿库中存在一份草稿
  When 用户手动编辑正文与标题并再次存盘
  Then 应覆盖保存当前草稿内容
    And MVP 不创建历史快照或提供历史查看与恢复
```

**依赖**:
- 前置: `feat-workbench-sink-to-injoys-doc`、`feat-calendar-status-transitions`
- 被依赖: `feat-client-feed-simulators`
- 约束: 沉淀必须显式触发（criterion §4）

---

### 提案 4: 公众号 / B站 真实样式模拟器

**Change ID:** `feat-client-feed-simulators`  
**优先级:** P1  
**预计时间:** 3 人日（规划估算）  
**状态:** proposed  
**变更类型（change_kind）:** `code`（判定依据：新增或修改宿主 / 客户端业务代码及其测试；契约文档同步属 SSoT-first 随附动作，不单独计为文档类交付）  

**业务目标（Business Goal）**:
- 交付微信公众号图文卡片模拟器与 B站视频元数据卡片模拟器，做到「所见即所得」，减少预填后的意外。
- 复用创作室草稿数据，呈现朋友圈分享卡片 / 文章详情、3 套候选标题、结构化简介、标签词云与分区。

**范围边界（In / Out）**:

| 类型 | 内容 |
|------|------|
| ✅ In | 公众号图文卡片模拟器（朋友圈分享卡片 + 文章详情预览，Markdown 代码高亮） |
| ✅ In | B站视频元数据模拟器（3 套候选标题 / 简介 / 标签词云 / 分区选择） |
| ✅ In | `titleCandidates` 恒为 3 的呈现约束 |
| ❌ Out | 新增宿主字段（复用 Phase 0 契约） |
| ❌ Out | 其他平台模拟器（Phase 1/2 平台不在范围） |

**关联 Context 资产**:

| Scope | 关联资产 | 关联说明 |
|-------|---------|----------|
| criterion | `.context/criterion.md` | §3.1、§3.3 |
| architecture | `.context/architecture/risks_and_debt.md` | TD-002 |
| architecture | `.context/architecture/api_strategy.md` | §3.1 `generateVideoMeta` 的 `titleCandidates` 恒为 3、分区映射 |
| domain | `.context/domain/testing_strategy.md` | 模块 3 场景 3 / 4 |

**关键任务**:
1. 公众号图文卡片模拟器（分享卡片 + 详情预览 + 代码高亮）（1.25 人日）
2. B站视频元数据模拟器（标题 / 简介 / 标签词云 / 分区）（1.25 人日）
3. 复用草稿数据与样式令牌化（0.5 人日）

**验证标准**:

| 验收项 | 验收条件 | 验收方式 |
|--------|----------|----------|
| 图文模拟 | 展示朋友圈分享卡片与文章详情，Markdown 代码高亮 | UI 验收 |
| 视频模拟 | 展示 3 套候选标题、结构化简介、标签词云与分区 | UI 验收 |
| 数量约束 | 候选标题恒为 3 | UI 验收 |

**验收场景（按需，建议 BDD）**:

```gherkin
场景: 微信公众号图文卡片模拟器
  Given 用户已生成一篇公众号图文物料
  When 用户打开公众号图文卡片模拟器
  Then 应展示朋友圈分享卡片预览
    And 应展示公众号文章详情预览
    And Markdown 代码应高亮显示

场景: B站视频元数据卡片模拟器
  Given 用户已生成一份 B站视频物料
  When 用户打开 B站视频元数据卡片模拟器
  Then 应展示 3 套候选标题
    And 应展示标签词云与分区选择
```

**依赖**:
- 前置: `feat-client-content-studio`
- 被依赖: 无
- 约束: 候选标题数量恒为 3（`api_strategy.md` §3.1）

---

### 提案 5: 排期日历流水与回填入口

**Change ID:** `feat-client-schedule-view`  
**优先级:** P1  
**预计时间:** 3.5 人日（规划估算）  
**状态:** proposed  
**变更类型（change_kind）:** `code`（判定依据：新增或修改宿主 / 客户端业务代码及其测试；契约文档同步属 SSoT-first 随附动作，不单独计为文档类交付）  

**业务目标（Business Goal）**:
- 把排期生成 / 读取 / 状态推进 / 单向导出 / 显式导入接入排期日历 Tab，呈现周 / 月视图与五态流水。
- 在流水内完成「一键预填 → 人工发布 → 回填 URL → 已发布」的闭环操作与状态可见。

**范围边界（In / Out）**:

| 类型 | 内容 |
|------|------|
| ✅ In | 排期生成 / 读取（`workbench.generateCalendar` / `calendar.list`）接入周 / 月视图 |
| ✅ In | 状态推进（`calendar.updateStatus`）与回填 URL（`drafts.updatePublishUrl`）入口 |
| ✅ In | 导出至 Injoys 表格入口（`workbench.exportCalendar`，显式触发，展示成功 / 跳过 / 失败结果） |
| ✅ In | 从 Injoys 导入入口（`workbench.importCalendar`，显式触发） |
| ✅ In | 状态胶囊样式（五态）与「草稿直达链接」外链 |
| ❌ Out | 自动状态推进 / 自动导出 / 自动导入 |
| ❌ Out | 双向同步（PRD Phase 3） |

**关联 Context 资产**:

| Scope | 关联资产 | 关联说明 |
|-------|---------|----------|
| criterion | `.context/criterion.md` | §3.1、§3.3、§4（`published` 仅经回填） |
| architecture | `.context/architecture/risks_and_debt.md` | TD-002、TD-006 |
| architecture | `.context/architecture/api_strategy.md` | §3.3 `calendar.*`、§3.1 导出 / 导入 |
| domain | `.context/domain/testing_strategy.md` | 模块 2 场景 1–10 |

**关键任务**:
1. 周 / 月视图与排期生成 / 读取接入（1.25 人日）
2. 状态推进与五态胶囊呈现（0.75 人日）
3. 预填直达链接与回填 URL 入口（0.75 人日）
4. 导出至 Injoys 表格入口与成功 / 跳过 / 失败提示（0.5 人日）
5. Injoys 导入入口与样式令牌化（0.25 人日）

**验证标准**:

| 验收项 | 验收条件 | 验收方式 |
|--------|----------|----------|
| 五态呈现 | 状态依五态呈现对应胶囊样式 | UI 验收 |
| 回填闭环 | 预填后状态为「已推草稿箱」，回填 URL 后才「已发布」 | UI 验收 |
| 部分回填 | 多渠道部分回填固定停留「已推草稿箱」，可看出已回填数量 | UI 验收 |
| 导出入口 | 触发导出后展示 `exportedCount` / `skippedCount`；导出失败如实提示，不谎报成功 | UI 验收 |
| 导入入口 | 触发导入后展示 `importedCount` / `updatedCount` / `conflicts` | UI 验收 |

**验收场景（按需，建议 BDD）**:

```gherkin
场景: 发布确认闭环（人工发布 + 回填 URL）
  Given 一个排期项状态为"草稿就绪"
    And 用户已点击"一键预填至草稿箱"且预填成功
  When 预填动作完成
  Then 状态应变为"已推草稿箱"
    And 界面应展示"前往平台草稿箱 ↗"外链
    And 状态不得自动变为"已发布"

场景: 多渠道草稿部分回填（BR-021）
  Given 一个草稿面向 2 个渠道
    And 该草稿状态为"已推草稿箱"
  When 用户只为其中 1 个渠道填入有效 URL
  Then 状态应固定停留在"已推草稿箱"
    And 界面应能看出 2 个渠道中已回填 1 个

场景: 排期单向导出（BR-024）
  Given 本地排期库中存在待导出的排期项
  When 用户点击"导出至 Injoys 表格"
  Then 应以 externalRowId 幂等更新远端表格行
    And 界面应展示 exportedCount 与 skippedCount
    And 导出失败时应如实提示，不得显示为成功
```

**依赖**:
- 前置: `feat-calendar-generate-list`、`feat-calendar-status-transitions`、`feat-calendar-injoys-export`、`feat-calendar-injoys-import`
- 被依赖: 无
- 约束: `published` 仅经 `drafts.updatePublishUrl` 写入（criterion §4）；导出 / 导入均为用户显式触发

---

### 提案 6: AI 工具中枢与沙箱控制台

**Change ID:** `feat-client-tools-console`  
**优先级:** P2  
**预计时间:** 3 人日（规划估算）  
**状态:** proposed  
**变更类型（change_kind）:** `code`（判定依据：新增或修改宿主 / 客户端业务代码及其测试；契约文档同步属 SSoT-first 随附动作，不单独计为文档类交付）  

**业务目标（Business Goal）**:
- 把 `tools.catalog` / `tools.toggle` / `tools.executeSandbox` / `tools.telemetry` 接入工具中枢 Tab，按五类分组呈现工具、支持启停与单步调试。
- 保证前端隐藏按钮不构成安全边界——禁用工具在宿主侧被拒（`tools/disabled`）。

**范围边界（In / Out）**:

| 类型 | 内容 |
|------|------|
| ✅ In | 工具目录五类分组呈现与启停开关（`tools.catalog` / `tools.toggle`） |
| ✅ In | 单步调试沙箱（参数表单 / 卡片渲染 / 结构化结果 / 耗时） |
| ✅ In | 遥测视图（`tools.telemetry`，脱敏条目） |
| ✅ In | 「工具清单不含自动发布工具」的界面呈现 |
| ❌ Out | 技能包与自定义编辑器（PD-002，不在范围） |
| ❌ Out | 工具实现本身（Phase 2 已提供） |

**关联 Context 资产**:

| Scope | 关联资产 | 关联说明 |
|-------|---------|----------|
| criterion | `.context/criterion.md` | §3.1、§3.3、§4 白名单宿主侧强制 |
| architecture | `.context/architecture/risks_and_debt.md` | TD-002、TD-001（`tools.*`） |
| architecture | `.context/architecture/api_strategy.md` | §3.5 `tools.*` 契约 |
| domain | `.context/domain/testing_strategy.md` | 模块 7 场景 1 / 2 / 3 |

**关键任务**:
1. 工具目录五类分组与启停开关接入（1 人日）
2. 单步调试沙箱（表单 / 卡片渲染 / 结果 / 耗时）接入（1.25 人日）
3. 遥测视图接入与样式令牌化（0.75 人日）

**验证标准**:

| 验收项 | 验收条件 | 验收方式 |
|--------|----------|----------|
| 五类分组 | 目录按五类分组展示 | UI 验收 |
| 无发布工具 | 目录不含自动发布工具 | UI 验收 |
| 单步可用 | 无需多轮对话完成单步运行并展示耗时 | UI 验收 |
| 宿主侧校验 | 禁用工具即使被构造调用也被拒 | UI + 单元测试 |

**验收场景（按需，建议 BDD）**:

```gherkin
场景: 工具按生命周期分类呈现（BR-040）
  Given 用户位于 AI 工具中枢
  When 用户查看工具目录
  Then 工具应按五类分组

场景: 单步调试沙箱（BR-041）
  Given 用户位于可视化单步调试沙箱
  When 用户填写参数并运行某个工具
  Then 应展示该工具的结构化返回结果
    And 应展示执行耗时
```

**依赖**:
- 前置: `feat-tools-catalog-toggle`、`feat-tools-sandbox-execute`、`feat-tools-telemetry`
- 被依赖: 无
- 约束: 白名单校验在宿主侧，UI 隐藏不构成安全边界（criterion §4）

---

### 提案 7: 清理未授权令牌与未授权 HEX

**Change ID:** `fix-ui-token-violations`  
**优先级:** P0  
**预计时间:** 1 人日（规划估算）  
**状态:** proposed  
**变更类型（change_kind）:** `code`（判定依据：修改 `plugin-src/client/ops-styles.js` 样式代码，无文档/配置交付物）  

**业务目标（Business Goal）**:
- 清除现行 `ops-styles.js` 中**未被 criterion 授权**的宿主变量与 HEX，使工作台样式回到「只绑 `var(--dsw-alias-*)` + 四个授权点缀色」的合规基线。
- 为后续全部 UI 提案（壳层 / 原子 / 指标卡）提供可复用、可校验的令牌基线，避免新组件沿用违规写法。

**范围边界（In / Out）**:

| 类型 | 内容 |
|------|------|
| ✅ In | 替换未授权变量 `--dsw-alias-border-default`（现行 2 处：`.dim-ops-header` 下边框、1 处 `background-color`）为 `--dsw-alias-border-l1/l2` |
| ✅ In | 清除未授权 HEX `#22c55e`（`.dim-ops-notice[data-kind="success"]`）、`#ef4444` / `#b91c1c`（`.dim-ops-notice[data-kind="error"]`），改用授权告警橙 `#b45309` + 危险语义文字 |
| ✅ In | 移除 `var(--dsw-alias-*, #hex)` 中**未授权 HEX 作 fallback** 的写法（现行 32 处），改为不带 fallback 的纯令牌引用 |
| ✅ In | 保留 `#1677ff` / `#15803d` / `#b45309` / `#7c3aed` 四个授权点缀色不动 |
| ❌ Out | 新增任何令牌 / 新增宿主 error alias（须另案登记，见 `design_tokens.json` 的 `component.button.danger._comment`） |
| ❌ Out | 视觉重构、布局调整、组件拆分（属提案 8–15） |
| ❌ Out | 新增独立红 HEX 表达 `no_publish_permission`（PRD 写「红色指示灯」，但 criterion 未授权；仍以文字 + 告警橙表达） |

**关联 Context 资产**:

| Scope | 关联资产 | 关联说明 |
|-------|---------|----------|
| criterion | `.context/criterion.md` | §3.3 MUST NOT「硬编码背景 / 边框 / 文字色值」，点缀色仅四个授权 HEX |
| ui | `.context/ui/design_system.md` | 「颜色系统」表面/文字必须走令牌；「语义 / 点缀色（唯一允许的 HEX）」表 |
| ui | `.context/ui/design_tokens.json` | `alias.color.*` 授权绑定集合；`component.button.danger._comment` 说明不得另造红 HEX |
| ui | `.context/ui/source/ui-design-direction.md` | §4.2 明确禁止 `--dsw-alias-border-default` / `--dsw-alias-brand-primary` / `--dsw-alias-status-*` 与未授权 HEX 作 fallback |

**关键任务**:
1. 盘点并替换未授权变量与 HEX（0.5 人日）
2. 移除 32 处未授权 HEX fallback，校验宿主主题下不出现无色值（0.5 人日）

**验证标准**:

| 验收项 | 验收条件 | 验收方式 |
|--------|----------|----------|
| 无未授权变量 | `ops-styles.js` 不再出现 `--dsw-alias-border-default` / `--dsw-alias-brand-primary` / `--dsw-alias-status-*` | 代码审查 + grep |
| 无未授权 HEX | 除四个授权值外无其它 HEX 字面量 | 代码审查 + grep |
| 无 HEX fallback | 无 `var(--dsw-alias-*, #hex)` 形式 | 代码审查 |
| 主题跟随 | Light / Dark 主题下表面与文字层级正常，无透明或继承异常 | UI 验收 |

**依赖**:
- 前置: 无
- 被依赖: `feat-ui-workbench-shell`、`feat-ui-primitives-button-badge-card`、`feat-ui-metricbox-kpi`、`feat-ui-empty-state`、`feat-ui-interaction-states`、`feat-ui-responsive-breakpoints`（均以本提案的合规基线为准）
- 约束: 不得为消除违规而新增令牌或宿主 alias；未授权语义须先提案登记再使用

---

### 提案 8: 工作台壳层（HeaderCockpit + Sticky KPI Ribbon + 六 Tab）

**Change ID:** `feat-ui-workbench-shell`  
**优先级:** P0  
**预计时间:** 3 人日（规划估算）  
**状态:** proposed  
**变更类型（change_kind）:** `code`（判定依据：在 `ops-page.js` 新增壳层与 Tab 容器代码）  

**业务目标（Business Goal）**:
- 在**现行** `settings.section` 入口内落地工作台壳层骨架：`HeaderCockpit` → Sticky KPI Ribbon → Segmented Tabs → Active Workspace Canvas，使 6 大 Tab 有稳定容器承载。
- 落实 DEC-UI-003 的 Tab 顺序与命名（对齐 PRD §四 / criterion §3.3），并提供 HeaderCockpit 的三个快捷行动与全局刷新入口。
- 让后续 Tab 内容提案（本 Phase 提案 1–6）有可挂载的画布位，消除「有内容、无容器」的结构缺口。

**范围边界（In / Out）**:

| 类型 | 内容 |
|------|------|
| ✅ In | 壳层垂直结构：HeaderCockpit / Sticky KPI Ribbon / SegmentedTabs / Active Workspace Canvas |
| ✅ In | 六个 Tab 容器与切换（运营驾驶舱 / 排期日历流水 / 内容创作室 / AI工具中枢 / 舆情需求大盘 / 引擎策略配置），顺序与命名对齐 PRD |
| ✅ In | HeaderCockpit 内容位：产品名、当前产品、Injoys MCP 状态位、BrowserOS `authenticated` 计数位（**项目 Phase 0** 分母为 2）、快捷行动（`+ 生成 7 天排期日历` / `✍ 新建多端物料` / `🔄 刷新大盘`） |
| ✅ In | Sticky KPI Ribbon 容器（4 个 MetricBox 挂载位；组件本体属提案 10） |
| ✅ In | 保留 Megaphone 图标在**宿主导航 chrome**（`index.js` 注入），工作台画布内不重复放置 |
| ❌ Out | 独立主视图 / 主侧边栏槽位（DEC-UI-001：须先提案更新 criterion §3.1，本批不授权） |
| ❌ Out | 各 Tab 的业务内容接入（本 Phase 提案 1–6 已各自承载） |
| ❌ Out | 快捷键绑定（提案 14）、断点样式（提案 13）、i18n 取词（提案 15） |

> [!NOTE]
> **入口形态约束（本提案的实施前提）**：DEC-UI-001 明确「当前可实施入口仅为 `settings.section`（`id: 'ops'` / `order: 60`），独立主视图须先走 OpenSpec 提案更新 criterion §3.1 后再落地」。本提案**只做画布内壳层**，不改槽位、不注册新槽位，因此不触达该门禁；`HeaderCockpit` 中的「当前产品 / 引擎状态」只作**展示位**，数据接入仍由 `feat-client-dashboard` 与 `feat-client-engine-config` 承担。

**关联 Context 资产**:

| Scope | 关联资产 | 关联说明 |
|-------|---------|----------|
| criterion | `.context/criterion.md` | §3.1 槽位与 `callOpsRpc`、§3.3 六 Tab 命名与禁止硬编码色值 |
| ui | `.context/ui/design_system.md` | 「主布局」Sticky KPI Ribbon + 分段 Tab；「工作台骨架约束」自上而下四段结构 |
| ui | `.context/ui/atomic_components.md` | §3 `HeaderCockpit` / `TopKpiRibbon`、§4「工作台壳层」模板、§5 页面文件对照表 |
| ui | `.context/ui/layout_grid.md` | 「壳层垂直结构（非横向栅格）」四段顺序与 KPI Ribbon sticky |
| ui | `.context/ui/source/ui-design-direction.md` | §4.1 壳层结构、DEC-UI-001 / DEC-UI-003、BR-080 Megaphone 归属 |

**关键任务**:
1. 壳层四段结构与 Canvas 挂载位（1 人日）
2. SegmentedTabs 六 Tab 容器与切换态（含选中态 `#1677ff`）（1 人日）
3. HeaderCockpit 内容位与快捷行动组（含 Megaphone 归属核对）（0.75 人日）
4. Sticky KPI Ribbon 容器与滚动吸顶（0.25 人日）

**验证标准**:

| 验收项 | 验收条件 | 验收方式 |
|--------|----------|----------|
| 四段结构 | 自上而下为 HeaderCockpit / KPI Ribbon / SegmentedTabs / Canvas | UI 验收 |
| Tab 顺序 | 六 Tab 顺序与命名与 PRD §四、criterion §3.3 完全一致，不另造文案 | UI 验收 + 代码审查 |
| 吸顶 | 滚动时 KPI Ribbon 保持 sticky | UI 验收 |
| 槽位未变 | 仍为 `settings.section` / `id: 'ops'` / `order: 60`，无新槽位 | 代码审查 |
| Megaphone 唯一 | 画布内无重复 Megaphone 图标，导航 chrome 图标仍在 | UI 验收 |

**依赖**:
- 前置: `fix-ui-token-violations`
- 被依赖: `feat-ui-responsive-breakpoints`、`feat-ui-shortcuts-guardrails`
- 约束: 入口维持 `settings.section`（DEC-UI-001 门禁）；Tab 文案与顺序不得另造

---

### 提案 9: 原子组件 Button / Badge 状态灯 / Card

**Change ID:** `feat-ui-primitives-button-badge-card`  
**优先级:** P0  
**预计时间:** 2.5 人日（规划估算）  
**状态:** proposed  
**变更类型（change_kind）:** `code`（判定依据：在 `ops-page.js` / `ops-styles.js` 内新增可复用组件与样式类）  

**业务目标（Business Goal）**:
- 抽取 Button（主 / 次 / 告警(危险语义) / 图标）、Badge 状态灯（`SessionState` 四态 + `null` 中性徽章）、Card 三个原子，供壳层与各 Tab 复用。
- 固化「危险变体用告警橙 + 必含危险语义文字」「`null` 用中性徽章」「无权限不得写成故障」三条视觉纪律，避免各 Tab 各写一套。

**范围边界（In / Out）**:

| 类型 | 内容 |
|------|------|
| ✅ In | Button 四变体（主 / 次 / 告警 / 图标）与 Loading / 禁用态；主按钮禁止连点 |
| ✅ In | Badge 状态灯：`SessionState` 四态（`unknown` / `needs_login` / `authenticated` / `no_publish_permission`）与 `null` 中性徽章 |
| ✅ In | Card 容器（标题 / 图标 / Hover 描边），类名前缀 `dim-ops-*` / `dim-status-*` |
| ✅ In | 组件落位：**写入现行** `ops-page.js` + `ops-styles.js`（不拆目录，见 NOTE） |
| ❌ Out | JSX 分目录与 `components/ui/*.jsx`（DEC-UI-004：须先提案更新 criterion §3.3） |
| ❌ Out | 任何自动发布 / 群发控件（criterion §4 铁律） |
| ❌ Out | 独立红 HEX / 宿主 error alias（未授权） |

> [!NOTE]
> **工程形态约束**：DEC-UI-004 明确 `components/ui/*.jsx` 分目录属**目标重构**，且「目录重构须先提案更新 criterion §3.3」。本提案据此**不拆目录**，组件以 `ops-page.js` 内的可复用函数 + `ops-styles.js` 内的类实现；若后续单独批准 criterion §3.3 更新提案，可按同一组件契约平移，不构成返工。

**关联 Context 资产**:

| Scope | 关联资产 | 关联说明 |
|-------|---------|----------|
| criterion | `.context/criterion.md` | §3.3 样式令牌化、MUST NOT 硬编码色值、MUST NOT 承载状态机 |
| ui | `.context/ui/atomic_components.md` | §1 原子（Button / Badge / 输入框 / 状态点）、§5 现行实现面说明 |
| ui | `.context/ui/design_system.md` | 「组件规范」Button / Card / Badge 状态灯；四态文案与配色 |
| ui | `.context/ui/interaction_states.md` | 「组件状态矩阵」Card / Button / Badge 行；`no_publish_permission` 禁止写成「故障」 |
| ui | `.context/ui/design_tokens.json` | `component.button.*` / `component.badge.*` / `component.card.*` |

**关键任务**:
1. Button 四变体与 Loading / 禁用态（1 人日）
2. Badge 状态灯四态 + `null` 中性徽章（0.75 人日）
3. Card 容器与 Hover 描边（0.5 人日）
4. 类名与令牌对齐、旧用法替换（0.25 人日）

**验证标准**:

| 验收项 | 验收条件 | 验收方式 |
|--------|----------|----------|
| 危险变体 | 背景/描边为 `#b45309` 且按钮文字含危险语义；无独立红 HEX | UI 验收 + 代码审查 |
| 四态文案 | 四态文案为 未知 / 需登录 / 已认证就绪 / 无权限；`no_publish_permission` 不显示为「故障」 | UI 验收 |
| null 徽章 | `null` 指标使用中性徽章，不渲染为 0 | UI 验收 |
| 无发布控件 | 组件集中不存在正式发布 / 群发按钮 | 代码审查 |
| 令牌合规 | 全部走 `var(--dsw-alias-*)` + 四个授权 HEX | 代码审查 |

**依赖**:
- 前置: `fix-ui-token-violations`
- 被依赖: `feat-ui-metricbox-kpi`、`feat-ui-empty-state`、`feat-ui-interaction-states`
- 约束: 组件不含业务规则（状态机 / 权限判定在宿主侧）；不拆 JSX 目录

---

### 提案 10: MetricBox 指标卡组件（结构与排布）

**Change ID:** `feat-ui-metricbox-kpi`  
**优先级:** P1  
**预计时间:** 1.5 人日（规划估算）  
**状态:** proposed  
**变更类型（change_kind）:** `code`（判定依据：新增 `MetricBox` 组件与其样式类）  

**业务目标（Business Goal）**:
- 交付 MetricBox 组件：`label` / `caption` / `value` / `delta` / `coverage` 五段结构，**数值与「暂无数据」互斥**，供 Sticky KPI Ribbon 的 4 个 KPI 复用。
- 提供「覆盖范围」与「暂无环比」的固定展示位，使宿主返回的 `measuredPlatforms` / `unmeasuredPlatforms` 与 `comparison` 有确定落点。

**范围边界（In / Out）**:

| 类型 | 内容 |
|------|------|
| ✅ In | MetricBox 五段结构与两种互斥形态（有值 / `null`） |
| ✅ In | 4 个 KPI 的命名与副标题位（PRD §5.1.2）：全网曝光/播放总量、互动与关注增长、排期履约流水、分发矩阵连通度 |
| ✅ In | 覆盖范围展示位（`measuredPlatforms` / `unmeasuredPlatforms`）与「暂无环比」文案位 |
| ✅ In | 第 4 项只统计 `authenticated`、**项目 Phase 0** 分母为 2 的展示约束 |
| ❌ Out | 数据接入与 `null` 判定逻辑（`feat-client-dashboard` 已承载；本提案只做结构与呈现位） |
| ❌ Out | 前端重算全网汇总（criterion：只展示宿主汇总） |
| ❌ Out | 环比计算（宿主侧 `feat-storage-metrics-snapshot` 提供） |

> [!NOTE]
> **与 `feat-client-dashboard` 的边界**：该提案 In-scope 已含「`null` 语义呈现：汇总缺失显示『暂无数据』、环比不足显示『暂无环比』，并展示 `measuredPlatforms` / `unmeasuredPlatforms`」的**数据语义**。本提案**不重复**该语义实现，只交付**组件结构与排布**；两者是「组件 → 接入」关系，实施时以 `feat-client-dashboard` 的语义为准，本提案不另立判定规则。

**关联 Context 资产**:

| Scope | 关联资产 | 关联说明 |
|-------|---------|----------|
| criterion | `.context/criterion.md` | §3.3 指标 `null` →「暂无数据」不得显示为 0；不得承载业务黑盒 |
| ui | `.context/ui/atomic_components.md` | §2「指标卡 MetricBox」HTML 结构（有值 / null 两分支）与「数值与暂无数据互斥」 |
| ui | `.context/ui/design_system.md` | 「组件规范 → MetricBox」四个 Sticky KPI 与副标题、覆盖范围、暂无环比、非去重注释 |
| ui | `.context/ui/interaction_states.md` | 「MetricBox / null」规则与互斥要求 |
| ui | `.context/ui/design_tokens.json` | `alias.color.text.tertiary`（null 徽章）、`component.badge.neutral` |

**关键任务**:
1. MetricBox 五段结构与两种互斥形态（0.75 人日）
2. 4 个 KPI 命名 / 副标题 / 覆盖范围位（0.5 人日）
3. Ribbon 内排布对接与令牌化（0.25 人日）

**验证标准**:

| 验收项 | 验收条件 | 验收方式 |
|--------|----------|----------|
| 互斥 | 有值与「暂无数据」不同时出现 | UI 验收 |
| 真实 0 | 真实 `0` 走有值分支并显示 `0` | UI 验收 |
| 覆盖范围 | 可展示已采 / 未采平台清单 | UI 验收 |
| 暂无环比 | delta 为空时显示「暂无环比」，不显示 0% | UI 验收 |
| 连通度分母 | **项目 Phase 0** 显示 `n / 2` | UI 验收 |

**依赖**:
- 前置: `feat-ui-primitives-button-badge-card`
- 被依赖: 无
- 约束: 只呈现宿主汇总，不在前端重算

---

### 提案 11: EmptyState 空状态组件

**Change ID:** `feat-ui-empty-state`  
**优先级:** P1  
**预计时间:** 1.5 人日（规划估算）  
**状态:** proposed  
**变更类型（change_kind）:** `code`（判定依据：新增 `EmptyState` 组件与其样式类）  

**业务目标（Business Goal）**:
- 交付统一空状态组件「微图标 + 解释文案 + 行动按钮」，供 6 个 Tab 的空列表 / 未登录 / 无数据场景复用。
- 落实「`needs_login` 提供 `去登录 ↗` 且不阻断工作台」的零阻碍原则，避免各 Tab 各写一套空态文案。

**范围边界（In / Out）**:

| 类型 | 内容 |
|------|------|
| ✅ In | EmptyState 三段结构（微图标 / 解释文案 / CTA）与紧凑排布 |
| ✅ In | `needs_login` 场景的 `去登录 ↗` 外链变体（新窗口、不夹带会话） |
| ✅ In | 无数据 / 无结果 / 未配置三类文案位（文案由各 Tab 传入） |
| ❌ Out | 外链登录流程本身（属 `fix-browser-session-cookie-probe` / `feat-client-engine-config`） |
| ❌ Out | 登录墙式整页遮挡（criterion：`needs_login` 不得挡住整个视图） |
| ❌ Out | 图标资源新增（源文档未给出图标清单，见 NOTE） |

> [!NOTE]
> **图标来源未定**：`atomic_components.md` 将「空状态微图标」标为 `TODO`（源文档未给图标规范），`accessibility_checklist.md` 的「图标/Emoji 替代文本」同为 `TODO`。本提案只用**现行仓库已有**的矢量图标或文本符号，不新增美术资源、不编造图标规范；若后续补图标规范，另案处理。

**关联 Context 资产**:

| Scope | 关联资产 | 关联说明 |
|-------|---------|----------|
| criterion | `.context/criterion.md` | §3.3 未登录平台一律提供 `去登录 ↗`（零阻碍原则） |
| ui | `.context/ui/atomic_components.md` | §2「空状态 EmptyState」：微图标 + 解释文案 + CTA |
| ui | `.context/ui/design_system.md` | 「组件规范 → EmptyState」结构固定与不泄露 Cookie |
| ui | `.context/ui/accessibility_checklist.md` | 「空状态：微图标 + 解释文案 + CTA」「未登录提供 `去登录 ↗`，不阻断工作台」 |
| ui | `.context/ui/source/ui-design-direction.md` | DEC-UI-010 空状态决策 |

**关键任务**:
1. EmptyState 三段结构与三种文案位（0.75 人日）
2. `去登录 ↗` 外链变体与安全约束（0.5 人日）
3. 现有空态场景替换与令牌化（0.25 人日）

**验证标准**:

| 验收项 | 验收条件 | 验收方式 |
|--------|----------|----------|
| 三段结构 | 图标 + 文案 + CTA 同时存在，顺序固定 | UI 验收 |
| 去登录 | `needs_login` 时出现 `去登录 ↗`，可点击跳转 | UI 验收 |
| 不阻断 | 空态下仍可切换 Tab 并浏览工作台 | UI 验收 |
| 零泄露 | 外链不含 Cookie / 令牌参数 | 代码审查 |

**依赖**:
- 前置: `feat-ui-primitives-button-badge-card`
- 被依赖: 无
- 约束: 不新增图标资源；空态不得阻塞工作台

---

### 提案 12: 交互状态与微动效

**Change ID:** `feat-ui-interaction-states`  
**优先级:** P0  
**预计时间:** 2.5 人日（规划估算）  
**状态:** proposed  
**变更类型（change_kind）:** `code`（判定依据：新增动效样式、Toast / 常驻通知条组件与刷新去重逻辑）  

**业务目标（Business Goal）**:
- 统一 150–200ms 微动效区间与 `cubic-bezier(0.16, 1, 0.3, 1)` 缓动，消除各处缓动与时长不一致。
- 交付 Toast（滑入 200ms、停留 5s 淡出）与**预填成功常驻通知条**两个不同组件，落实「常驻通知条不自动消失」。
- 实现刷新入口的 **in-flight 去重**（卡片原地探活 / Header「刷新大盘」/ `Cmd/Ctrl+R` 共用同一状态），且不引入 WebSocket / SSE / 轮询。

**范围边界（In / Out）**:

| 类型 | 内容 |
|------|------|
| ✅ In | 卡片 Hover：`translateY(-2px)` + `#1677ff` 描边 + `0 4px 16px -2px rgba(0,0,0,0.08)`，180ms 统一缓动 |
| ✅ In | 状态灯 `authenticated` 的 `dimStatusPulse` 2.4s 呼吸 |
| ✅ In | Toast：`dimOpsSlideDown` 200ms 进入、停留 5s 淡出 |
| ✅ In | 预填成功**常驻通知条**（不自动消失，含「前往平台草稿箱 ↗」） |
| ✅ In | 刷新 in-flight 去重：按卡片 / 对应 RPC 维度，未完成时重复触发只执行一次 |
| ❌ Out | WebSocket / SSE / 后台定时轮询（criterion §3.4 明令禁止） |
| ❌ Out | `prefers-reduced-motion`（源文档未规定，见 NOTE） |
| ❌ Out | 快捷键按键绑定（提案 14 负责；本提案只提供去重状态供其复用） |

> [!NOTE]
> **两项源文档缺口**：① `motion_tokens.md` 记 `dimOpsSlideDown` 关键帧百分比为 `TODO`（源文档未给），本提案需自行定义 0% / 100% 的 transform / opacity 并写入注释说明来源为实施决策；② `prefers-reduced-motion` 源文档未规定，本提案**不擅自引入**，留待确认后另案。

**关联 Context 资产**:

| Scope | 关联资产 | 关联说明 |
|-------|---------|----------|
| criterion | `.context/criterion.md` | §3.4 禁止 WebSocket / SSE / 后台轮询；同一卡片并发刷新须 in-flight 去重 |
| ui | `.context/ui/motion_tokens.md` | Duration / Easing 表、`dimStatusPulse` 关键帧、Toast 与卡片 Hover 规格 |
| ui | `.context/ui/interaction_states.md` | 「Toast / 通知条」两类组件差异、「工作台数据域 / 刷新去重」 |
| ui | `.context/ui/design_system.md` | Card Hover 样式与状态灯呼吸 |
| ui | `.context/ui/accessibility_checklist.md` | 「刷新入口共用 in-flight 去重」 |

**关键任务**:
1. 微动效令牌与卡片 / 状态灯动效（0.75 人日）
2. Toast 与常驻通知条两组件（1 人日）
3. 刷新 in-flight 去重状态机（0.75 人日）

**验证标准**:

| 验收项 | 验收条件 | 验收方式 |
|--------|----------|----------|
| 时长区间 | 微交互落在 150–200ms，缓动为统一 `cubic-bezier(0.16, 1, 0.3, 1)` | 代码审查 |
| 常驻不消失 | 预填成功通知条不随 5s 自动消失；Toast 才消失 | UI 验收 |
| 去重 | 未完成时连续点击 / 快捷键只发一次请求；完成后释放 | UI 验收 + 代码审查 |
| 无持久连接 | 无 WebSocket / SSE / `setInterval` 轮询 | 代码审查 |

**依赖**:
- 前置: `feat-ui-primitives-button-badge-card`
- 被依赖: `feat-ui-shortcuts-guardrails`
- 约束: 无持久连接；去重不得只靠快捷键防抖

---

### 提案 13: 1280 / 960 断点响应式布局

**Change ID:** `feat-ui-responsive-breakpoints`  
**优先级:** P1  
**预计时间:** 1.5 人日（规划估算）  
**状态:** proposed  
**变更类型（change_kind）:** `code`（判定依据：新增 `@media` 断点样式与栅格规则）  

**业务目标（Business Goal）**:
- 按 DEC-UI-013 落地 960px 折叠主断点与 1280px 宽屏断点，使 KPI Ribbon 与创作室分屏在三种宽度下正确重排。
- 保证 13/14 寸笔记本全屏、外接显示器与桌面分屏三种实际使用场景可用。

**范围边界（In / Out）**:

| 类型 | 内容 |
|------|------|
| ✅ In | 三档断点：`≥1280`（宽屏）/ `960–1279`（标准）/ `<960`（窄屏单列流） |
| ✅ In | KPI Ribbon：`≥960` 4 列等宽单行 → `<960` 2×2 网格 |
| ✅ In | 创作室分屏：`≥1280` 50% / 50% → `960–1279` 55% / 45% → `<960` 上下堆叠（上编辑、下模拟器） |
| ✅ In | 断点变量 `--ops-bp-compact: 960px` / `--ops-bp-wide: 1280px` |
| ❌ Out | 全局 12 列栅格列数 / Margin / Gutter（源文档未定义，见 NOTE） |
| ❌ Out | 移动端 / 触控尺寸适配（目标为桌面工作台） |
| ❌ Out | 8pt 间距刻度（`spacing-*` 源文档为 TODO） |

> [!NOTE]
> **不编造栅格数值**：`layout_grid.md` 明确「源文档**未定义**传统 12 列栅格的列数 / Margin / Gutter」，并给出「不发明 `--grid-columns-desktop: 12`」的约束。本提案只实现源文档**写明**的布局行为（断点、KPI 列数、创作室比例、堆叠），其余保持现状或留 TODO，不自行设定刻度。

**关联 Context 资产**:

| Scope | 关联资产 | 关联说明 |
|-------|---------|----------|
| criterion | `.context/criterion.md` | §3.3 禁止硬编码色值（断点样式同样走令牌） |
| ui | `.context/ui/layout_grid.md` | 断点表、栅格配置表、CSS 变量示例（`--ops-bp-*` / `--ops-studio-*`） |
| ui | `.context/ui/design_system.md` | 「工作台骨架约束」KPI Ribbon 三种宽度的列数 |
| ui | `.context/ui/source/ui-design-direction.md` | DEC-UI-013 与 §4.4 响应式断点 |

**关键任务**:
1. 断点变量与 KPI Ribbon 重排（0.75 人日）
2. 创作室分屏三档比例与堆叠（0.75 人日）

**验证标准**:

| 验收项 | 验收条件 | 验收方式 |
|--------|----------|----------|
| 三档断点 | 1280 / 960 边界行为与源文档一致 | UI 验收（缩放窗口） |
| KPI 重排 | `≥960` 单行 4 列；`<960` 2×2 | UI 验收 |
| 创作室比例 | 50/50 → 55/45 → 堆叠 逐档正确 | UI 验收 |
| 无编造刻度 | 未引入源文档未定义的列数 / Margin / Gutter | 代码审查 |

**依赖**:
- 前置: `feat-ui-workbench-shell`
- 被依赖: 无
- 约束: 只实现源文档写明的布局行为

---

### 提案 14: 快捷键与防呆

**Change ID:** `feat-ui-shortcuts-guardrails`  
**优先级:** P1  
**预计时间:** 2 人日（规划估算）  
**状态:** proposed  
**变更类型（change_kind）:** `code`（判定依据：新增键盘事件处理与二次防呆弹层）  

**业务目标（Business Goal）**:
- 落地 DEC-UI-014 的四个高频快捷键：`Cmd/Ctrl+S`（保存草稿）、`Cmd/Ctrl+Enter`（预填 + 二次防呆）、`Cmd/Ctrl+R`（刷新大盘，阻止浏览器硬刷新）、`Esc`（关闭抽屉 / 弹层）。
- 以二次防呆弹层与执行中 Loading 保护「仅预填、人工发布」的闭环，避免误触。

**范围边界（In / Out）**:

| 类型 | 内容 |
|------|------|
| ✅ In | `Cmd/Ctrl+S` 触发 `drafts.save` + Toast「草稿已保存」（作用域：创作室编辑区） |
| ✅ In | `Cmd/Ctrl+Enter` 触发预填，**执行前二次防呆弹层**，执行中按钮 Loading 且禁止连点 |
| ✅ In | `Cmd/Ctrl+R` 刷新大盘并**阻止浏览器默认硬刷新**，复用提案 12 的 in-flight 去重 |
| ✅ In | `Esc` 关闭 AI 工具调试抽屉 / 快捷表单弹层 |
| ❌ Out | 自动确认发布类快捷键（criterion §4 铁律，严禁） |
| ❌ Out | 快捷键自定义 / 配置界面（源文档未提供） |
| ❌ Out | 焦点环与键盘可达性规范（`accessibility_checklist.md` 标为 TODO，见 NOTE） |

> [!NOTE]
> **可达性缺口不自行补齐**：`accessibility_checklist.md` 将「焦点可见且顺序合理」「语义化 HTML / ARIA」「图标替代文本」「表单错误焦点移动」均标为 `TODO`（源文档未写）。本提案只实现源文档**已写明**的快捷键与防呆，不擅自制定 focus ring 或 ARIA 规范；这些缺口另需设计输入。

**关联 Context 资产**:

| Scope | 关联资产 | 关联说明 |
|-------|---------|----------|
| criterion | `.context/criterion.md` | §4 铁律「始终仅预填草稿，严禁自动确认发布」 |
| ui | `.context/ui/accessibility_checklist.md` | 「快捷键表（源文档权威）」四行与「发布与安全相关的可操作性」 |
| ui | `.context/ui/interaction_states.md` | Button Loading「预填中不可再点」、`Cmd/Ctrl+Enter` 二次防呆 |
| ui | `.context/ui/design_system.md` | Button「`Cmd/Ctrl+Enter` 触发预填前必须二次防呆弹层」 |
| ui | `.context/ui/source/ui-design-direction.md` | DEC-UI-014 与 §4.5 快捷键系统 |

**关键任务**:
1. 四个快捷键的监听与作用域隔离（0.75 人日）
2. 二次防呆弹层与 Loading 保护（0.75 人日）
3. `Cmd/Ctrl+R` 阻止硬刷新并接入去重（0.5 人日）

**验证标准**:

| 验收项 | 验收条件 | 验收方式 |
|--------|----------|----------|
| 保存 | `Cmd/Ctrl+S` 在创作室触发保存并出 Toast | UI 验收 |
| 预填防呆 | `Cmd/Ctrl+Enter` 先弹二次确认，确认后才执行 | UI 验收 |
| 阻止硬刷新 | `Cmd/Ctrl+R` 不刷新页面，只刷新大盘 | UI 验收 |
| Esc | 抽屉 / 弹层可被 Esc 关闭 | UI 验收 |
| 无发布快捷键 | 不存在触发正式发布 / 群发的按键 | 代码审查 |

**依赖**:
- 前置: `feat-ui-workbench-shell`、`feat-ui-interaction-states`
- 被依赖: 无
- 约束: 严禁任何自动确认发布入口；刷新去重与 Toast 复用 `feat-ui-interaction-states` 的实现，不另建一套

---

### 提案 15: i18n 文案字典（`locale/*.json` + `ops.<area>.<name>`）

**Change ID:** `feat-ui-i18n-dictionary`  
**优先级:** P1  
**预计时间:** 2 人日（规划估算）  
**状态:** proposed  
**变更类型（change_kind）:** `code`（判定依据：新增 `locale` 键与取词调用，替换组件内硬编码文案）  

**业务目标（Business Goal）**:
- 按 DEC-UI-015 建立 `ops.<area>.<name>` 键空间，把工作台文案从组件内字面量迁到 `locale/zh.json` / `locale/en.json`。
- 落地取词优先级链 `ctx.i18n.text` → 当前 locale → `zh.json`，为后续多语言留出唯一扩展点。

**范围边界（In / Out）**:

| 类型 | 内容 |
|------|------|
| ✅ In | 键命名规范 `ops.<area>.<name>`（area = tab / 组件域，name = 语义名） |
| ✅ In | 首版中文文案全量入 `locale/zh.json`，`locale/en.json` 同键位补齐 |
| ✅ In | 取词优先级链 `ctx.i18n.text` → 当前 locale → `zh.json` 的实现与回退 |
| ✅ In | 现行硬编码中文文案（按钮 / 表单标签 / 状态文案 / Toast / 空态）迁出组件 |
| ❌ Out | 新增语言包（源文档只要求 `locale/*.json` 机制，未列目标语言） |
| ❌ Out | 文案措辞改写（本提案只做**搬运与键化**，不改语义；文案修订另案） |
| ❌ Out | 数值 / 时间本地化格式规范（源文档未提供） |

> [!NOTE]
> **`ctx.i18n` 可用性待核**：`plugin-src/client/index.js` 当前 `inject` 仅声明 `['slots', 'connection']`，仓库内无 `i18n` 取词调用，`.context/architecture/*` 与 `src/*.ts` 亦未描述宿主 i18n 服务。实施前须先核实宿主是否提供 `ctx.i18n.text`：**可用**则按其 API 接入；**不可用**则本提案退化为「`locale/*.json` 字典 + 本地取词函数（优先级链保留）」，并在报告中如实说明降级，不得伪称已接入宿主 i18n。

**关联 Context 资产**:

| Scope | 关联资产 | 关联说明 |
|-------|---------|----------|
| criterion | `.context/criterion.md` | §3.1 客户端注入与 `callOpsRpc`；§3.3 文案约定 |
| ui | `.context/ui/design_system.md` | 「文案」`locale/*.json` 键 `ops.<area>.<name>`；`ctx.i18n.text` 优先级链 |
| ui | `.context/ui/accessibility_checklist.md` | 「首版中文；键 `ops.<area>.<name>` 写入 `locale/*.json`」 |
| ui | `.context/ui/atomic_components.md` | 各组件文案位（按钮 / 状态 / 空态 / Toast） |
| ui | `.context/ui/source/ui-design-direction.md` | DEC-UI-015 与 §4.6 i18n |

**关键任务**:
1. 键空间设计与 `zh.json` / `en.json` 骨架（0.5 人日）
2. 取词函数与优先级链 / 回退实现（0.75 人日）
3. 组件文案键化迁移（0.75 人日）

**验证标准**:

| 验收项 | 验收条件 | 验收方式 |
|--------|----------|----------|
| 键规范 | 所有键形如 `ops.<area>.<name>`，无散乱命名 | 代码审查 |
| 双语同键 | `zh.json` 与 `en.json` 键集合一致，无缺键 | 脚本比对 |
| 回退 | 当前 locale 缺键时回退 `zh.json`，不显示键名 | UI 验收 |
| 无硬编码 | 组件内不再有中文字面量文案 | 代码审查 |
| 如实降级 | 宿主 i18n 不可用时不伪称已接入 | 实施报告 |

**依赖**:
- 前置: 无
- 被依赖: 无
- 约束: 只做文案搬运与键化，不改写语义；`ctx.i18n` 可用性须先核实；可与 `feat-ui-workbench-shell` 并行，但文案键化建议在壳层与原子层落定后收尾，避免二次迁移

---

## 执行顺序与依赖

- **可并行三条主线**：
  1. `feat-client-engine-config`（依赖 Phase 0 的 `feat-browseros-capability-toggle`、`fix-browser-session-cookie-probe` 与 `feat-injoys-test-document-count`，契约就绪后即可实施；令牌显隐依 criterion §3.4 本机回填例外，无待决门槛）。
  2. 内容线：`feat-client-content-studio`（依赖 Phase 2 的 `feat-workbench-sink-to-injoys-doc` 与 Phase 1 的 `feat-calendar-status-transitions`）→ `feat-client-feed-simulators`。
  3. 排期线：`feat-client-schedule-view`；工具线：`feat-client-tools-console`。
- **驾驶舱线**：`feat-client-dashboard` 待 Phase 0 的汇总语义、环比基准、统一会话四态与 `documentCount` 契约，以及 Phase 1 的 `weeklyPipeline` 周聚合完成后再接入。
- 跨阶段前置条件：引擎配置依赖 Phase 0（A5 能力开关 / A6 会话探测 / A8 `injoys.test` 文档数契约）；驾驶舱依赖 Phase 0（A1 / A2 / A6 / A8）与 Phase 1（B2 的 `weeklyPipeline` 周聚合）；创作室依赖 Phase 2（C1）与 Phase 1（B3 的 `documentId` 关联不变量）；排期视图依赖 Phase 1（B2 / B3 / B4 / B5）；工具控制台依赖 Phase 2（C2 / C3 / C4）。
- 提供给后续阶段的能力：可端到端操作的 Phase 0 工作台界面（供 Phase 0 Live 实测与签收）。
- **UI 基础层线（由 `plan add ui` 追加）**：
  - 先 `fix-ui-token-violations`（无前置，清掉未授权令牌与 HEX，作为全部新增 UI 的合规基线）。
  - 再 `feat-ui-primitives-button-badge-card`（依赖上一条）→ 其下三条并行：`feat-ui-metricbox-kpi`、`feat-ui-empty-state`、`feat-ui-interaction-states`。
  - `feat-ui-workbench-shell` 与原子层可并行开工，但**须在提案 1–6 的 Tab 内容接入之前完成**，否则 6 个 Tab 缺壳层容器；`feat-ui-responsive-breakpoints` 与 `feat-ui-shortcuts-guardrails` 排在壳层之后（后者还依赖 `feat-ui-interaction-states` 的 in-flight 去重与 Toast）。
  - `feat-ui-i18n-dictionary` 无前置，建议在壳层与原子层文案落定后收尾，避免二次迁移。
  - **待协调（只报告，不改提案 1–6）**：提案 1–6 各自带「样式令牌化」子任务，与 `fix-ui-token-violations` 存在范围重叠；实施时令牌基线统一由 `fix-ui-token-violations` 提供，提案 1–6 复用而不另建一套。
- 跨阶段前置条件（新增部分）：无。新增 UI 提案的前置全部落在本 Phase 内，不引入新的跨阶段依赖。

## 阶段整体验收

- 模块 1 / 2 / 3 / 6 / 7 BDD 场景通过；PD-004 的界面缺口闭合（草稿管理 → 多变体编辑 → 预填入口可视化）。
- **跨提案联合验收「排期 → 创作 → 预填 → 回填」**：由 `feat-calendar-status-transitions`（宿主 `documentId` 不变量）+ `feat-client-content-studio`（从排期项发起创作时建立关联）+ `feat-client-schedule-view`（预填 / 回填入口）联合保证——从排期项发起创作后自动写回 `CalendarItem.documentId`，无 `documentId` 不可进入「草稿就绪」，预填后「已推草稿箱」，回填 URL 后才「已发布」。
- 代码审查确认：客户端仅经 `callOpsRpc` 访问宿主；无硬编码色值；无 WebSocket / SSE / 后台轮询（`criterion.md` §3.1 / §3.3 / §3.4）。
- Phase 0 Live 实测清单中界面相关项可勾选（状态呈现、生成持久化、预填入口、回填 URL、能力管理启停）。

## 待决事项（按需）

- 热点雷达 Tab 的真实选题来源（PRD 未指定具体渠道）：本路线图不安排该 Tab 的选题生成，待来源明确后另行提案。
- 无障碍规范缺口（focus ring / 语义化 HTML / ARIA / 图标替代文本 / 表单错误焦点）：`.context/ui/accessibility_checklist.md` 明确标为 `TODO`（源文档未写），故本 Phase 新增的 UI 提案**不排**这些项，也不自行制定规范；需设计侧补充输入后另案提案。
- 栅格刻度与字体规范缺口（12 列 / Margin / Gutter / 字号 / 行高 / 间距刻度 / 圆角）：`.context/ui/layout_grid.md`、`.context/ui/design_system.md`、`.context/ui/design_tokens.json` 均标为 `TODO`（源文档未给），`feat-ui-responsive-breakpoints` 只实现源文档写明的断点行为，不编造刻度。
- `ctx.i18n` 宿主可用性未核：`plugin-src/client/index.js` 的 `inject` 仅声明 `slots` / `connection`，仓库内无 i18n 取词调用，Context 资产与 `src/*.ts` 也未描述宿主 i18n 服务。`feat-ui-i18n-dictionary` 实施前须核实；不可用时按「本地字典 + 保留优先级链」降级并如实说明。
- 舆情需求大盘的**按平台指标**（播放/阅读、点赞、评论、分享、收藏）无宿主契约支撑：`workbench.overview` 只返回全网汇总与覆盖范围，不返回逐平台明细（`PlatformMetrics` 为内部类型，无 RPC 暴露），故本 Phase **不为该 Tab 的按平台指标展示排提案**；待契约补齐后再议。
- 预填成功常驻通知条与 Toast 的视觉规格：`motion_tokens.md` 记 `dimOpsSlideDown` 关键帧百分比为 `TODO`，由 `feat-ui-interaction-states` 以实施决策补齐并在代码注释标注来源。
