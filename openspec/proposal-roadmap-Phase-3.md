# Phase 3: 客户端工作台 UI 接入

> **返回总纲**: [proposal-roadmap.md](./proposal-roadmap.md)
> **文件名**: `proposal-roadmap-Phase-3.md`（编号与总纲阶段总览一致：Phase 3 → `Phase-3`）
> **状态**: proposed
> **来源**: `.context/architecture/risks_and_debt.md`（TD-002）；`.context/domain/risks_and_debt.md`（PD-004）；`.context/architecture/adr_003_custom_rpc_envelope.md` / `adr_007_manual_refresh_no_persistent_connection.md`；`.context/architecture/api_strategy.md` §3.7 / §4；`.context/domain/testing_strategy.md` 模块 1 / 2 / 3 / 6 / 7
> **预计工作量与周期**: ~17 人日（**规划估算**；源文档工作量字段为 `N/A – 源文档未提供`）

## 阶段目标与范围

- **目标与交付结果**：把 Phase 0–2 已就绪的宿主契约接进客户端 6 大 Tab 中 Phase 0 所需的 5 个 Tab（运营驾驶舱、内容创作室、排期日历、AI 工具中枢、引擎与平台配置），偿还 PD-004（高）的界面缺口，使「草稿管理 → 多变体编辑 → 预填入口」可在界面完成。
- **In / Out**：
  - ✅ In：`config.*` 接入引擎策略配置页；驾驶舱指标 / 渠道矩阵接入；内容创作室与草稿库接入（含沉淀入口）；公众号 / B站真实样式模拟器；排期日历流水与回填入口；AI 工具中枢与沙箱控制台。
  - ❌ Out：新增宿主能力（Phase 0–2 已提供全部所需契约）；舆情监控 Tab 的评论抓取（属 PRD Phase 1，**不在本路线图范围**）；热点雷达的选题生成（数据源属 Phase 0 原型，PRD 未指定渠道，见 `risks_and_debt.md` 外部依赖）；P2 技能包 / 自定义编辑器（PD-002）。
- **适用约束**：
  - `criterion.md` §3.1「客户端禁止绕过 `callOpsRpc` 直连 Injoys / BrowserOS MCP 或任何外部服务」；
  - `criterion.md` §3.3「禁止硬编码色值」——样式走设计令牌；
  - `criterion.md` §3.4「在 Phase 0 禁止 WebSocket / SSE 持久连接或后台定时轮询」——刷新经 `adr_007_manual_refresh_no_persistent_connection.md` 的手动刷新；
  - `criterion.md` §6 SSoT-first（UI 是依赖链末端，必须等宿主契约就绪）。

## 提案详情

### 提案 1: 引擎策略配置页接入

**Change ID:** `feat-client-engine-config`  
**优先级:** P0  
**预计时间:** 2 人日（规划估算）  
**状态:** proposed

**业务目标（Business Goal）**:
- 把 `config.get` / `config.save` / `injoys.test` 接入配置页 UI，支持全局运营策略即时生效、连通性测试与凭证显隐切换。
- 展示本地草稿存储目录与切换提示文案（三件事实），落实 RISK-008 缓解措施。

**范围边界（In / Out）**:

| 类型 | 内容 |
|------|------|
| ✅ In | 配置页表单接入 `config.get`（平铺契约）/ `config.save` / `injoys.test` |
| ✅ In | 默认产品名称、基调、`draftsDir`、`reuseHostBrowserProfile`、`autoSyncToInjoys` 编辑与热更新 |
| ✅ In | 凭证掩码 + 显隐切换；目录切换提示文案（覆盖三件事实） |
| ✅ In | 硬编码色值治理：样式走设计令牌 |
| ❌ Out | `config.get` 令牌返回策略变更（RISK-011 前置条件未触发，维持明文回填） |
| ❌ Out | 新宿主配置字段 |

> [!NOTE]
> **令牌口径边界说明**：`criterion.md` §3.4 的 MUST NOT「将敏感策略 / 令牌下发到客户端」与 §4「前端支持显隐切换」存在**口径张力**，其例外边界见 `.context/architecture/security_policy.md`「令牌返回策略」：`config.get` 明文 `token` **仅在宿主内 RPC（本机进程内）**暴露、用于表单回填与显隐切换，**不作为对外网络端点**；前置条件为「若未来 RPC 可被非本机访问，必须先改为只回 `hasToken: boolean`，明文另走回填专用通道」。本提案**维持现状**（前置条件未触发），但若 RPC 暴露边界变化，须先改契约再改 UI。⛔ 本路线图不擅自修改 `criterion.md`；**该口径是否构成 §3.4 的例外仍待 criterion 侧澄清**（已登记于本 Phase「待决事项」），应经 `context-update` 并取得用户授权。

**关联 Context 资产**:

| Scope | 关联资产 | 关联说明 |
|-------|---------|----------|
| criterion | `.context/criterion.md` | §3.1 经 `callOpsRpc`、§3.3 禁止硬编码色值、§3.4 令牌下发边界、§3.5、§4 显隐切换 |
| architecture | `.context/architecture/security_policy.md` | 「令牌返回策略」：明文 token 的暴露边界与「非本机可达」前置条件 |
| architecture | `.context/architecture/risks_and_debt.md` | TD-002、RISK-008、RISK-011（令牌明文暴露面扩大） |
| architecture | `.context/architecture/api_strategy.md` | §3.6 `config.*`（`config.get` 平铺契约与令牌返回策略）、§3.7 `draftsDir` 变更语义 |
| domain | `.context/domain/testing_strategy.md` | 模块 6 场景 1 / 2 / 3 / 4 |

**关键任务**:
1. 配置页接入 `config.get`（平铺契约）与表单渲染（0.75 人日）
2. 接入 `config.save` 热更新与目录切换提示文案（0.75 人日）
3. 接入 `injoys.test` 连通性与凭证显隐（0.25 人日）
4. 样式令牌化与硬编码色值清理（0.25 人日）

**验证标准**:

| 验收项 | 验收条件 | 验收方式 |
|--------|----------|----------|
| 即时生效 | 保存后新建物料使用新配置，无需重启 | UI 验收 |
| 目录提示 | 切换目录时展示「新目录对后续操作生效；正在进行的保存仍写入原目录。旧草稿不会自动迁移」 | UI 验收 |
| 凭证显隐 | 默认掩码，点击可切明文 | UI 验收 |
| 仅经 callOpsRpc | 客户端不直连 Injoys / BrowserOS | 代码审查 |

**验收场景（按需，建议 BDD）**:

```gherkin
场景: 全局运营策略即时生效
  Given 用户在工作台配置中修改默认产品名称
  When 用户保存设置
  Then 新建物料应以新的产品名称生成
    And 无需重启工作台即可生效

场景: 本地草稿存储目录配置
  Given 用户配置页中展示了本地草稿存储目录
  When 用户将目录更改为一个新的可用位置并保存
  Then 后续新发起的草稿操作应写入新目录
    And 界面应提示"新目录对后续操作生效；正在进行的保存仍写入原目录。旧草稿不会自动迁移"
```

**依赖**:
- 前置: 无
- 被依赖: 无
- 约束: 样式走设计令牌（criterion §3.3）

---

### 提案 2: 运营驾驶舱接入

**Change ID:** `feat-client-dashboard`  
**优先级:** P0  
**预计时间:** 3 人日（规划估算）  
**状态:** proposed

**业务目标（Business Goal）**:
- 把 `workbench.overview` / `browser.sessions` 接入驾驶舱，呈现指标卡、渠道矩阵连通度与头部引擎状态。
- 正确呈现指标 `null` 语义（暂无数据 / 暂无环比）与四态会话，避免「以偏概全」误导用户。

**范围边界（In / Out）**:

| 类型 | 内容 |
|------|------|
| ✅ In | 驾驶舱接入 `workbench.overview`（指标卡 / 汇总 / 环比 / 本周排期进度）与 `browser.sessions`（渠道矩阵四态） |
| ✅ In | `null` 语义呈现：汇总缺失显示「暂无数据」、环比不足显示「暂无环比」，并展示 `measuredPlatforms` / `unmeasuredPlatforms` 覆盖范围 |
| ✅ In | 头部引擎状态（知识库中枢 / 浏览器引擎）、快捷行动组跳转创作室 |
| ✅ In | 手动刷新（无持久连接 / 轮询） |
| ❌ Out | 热点雷达真实选题来源（外部依赖未指定渠道） |
| ❌ Out | 指标采集适配器修复 |

**关联 Context 资产**:

| Scope | 关联资产 | 关联说明 |
|-------|---------|----------|
| criterion | `.context/criterion.md` | §3.1、§3.3、§3.4（禁止持久连接 / 轮询） |
| architecture | `.context/architecture/risks_and_debt.md` | TD-002、RISK-003（会话四态）、RISK-006 / RISK-007（null 语义） |
| architecture | `.context/architecture/api_strategy.md` | §3.1 `workbench.overview`、§3.4 `browser.sessions` |
| architecture | `.context/architecture/adr_007_manual_refresh_no_persistent_connection.md` | 手动刷新裁决 |
| domain | `.context/domain/testing_strategy.md` | 模块 1 场景 1 / 2 / 3 / 4 / 5、模块 5 场景 4 / 5 / 6 |

**关键任务**:
1. 接入 `workbench.overview` 指标卡与汇总（含 null 呈现与覆盖范围标注）（1.25 人日）
2. 接入 `browser.sessions` 渠道矩阵四态与连通度统计（0.75 人日）
3. 头部引擎状态与快捷行动组跳转（0.5 人日）
4. 手动刷新交互与样式令牌化（0.5 人日）

**验证标准**:

| 验收项 | 验收条件 | 验收方式 |
|--------|----------|----------|
| 汇总空值呈现 | 部分缺失时汇总显示「暂无数据」，不显示求和数字 | UI 验收 |
| 0 与缺失可区分 | 真实 0 显示为 0，采集失败显示「暂无数据」 | UI 验收 |
| 四态呈现 | 会话四态（未知 / 需登录 / 已认证 / 无权限）颜色与文案正确 | UI 验收 |
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
```

**依赖**:
- 前置: `fix-overview-metrics-null-semantics`、`feat-storage-metrics-snapshot`
- 被依赖: 无
- 约束: 依赖 Phase 0 的汇总语义与环比基准；UI 只呈现，不自行计算全网汇总

---

### 提案 3: 内容创作室与草稿库接入

**Change ID:** `feat-client-content-studio`  
**优先级:** P0  
**预计时间:** 3 人日（规划估算）  
**状态:** proposed

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
- 前置: `feat-workbench-sink-to-injoys-doc`
- 被依赖: `feat-client-feed-simulators`
- 约束: 沉淀必须显式触发（criterion §4）

---

### 提案 4: 公众号 / B站 真实样式模拟器

**Change ID:** `feat-client-feed-simulators`  
**优先级:** P1  
**预计时间:** 3 人日（规划估算）  
**状态:** proposed

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
**预计时间:** 3 人日（规划估算）  
**状态:** proposed

**业务目标（Business Goal）**:
- 把排期生成 / 读取 / 状态推进 / 导入接入排期日历 Tab，呈现周 / 月视图与五态流水。
- 在流水内完成「一键预填 → 人工发布 → 回填 URL → 已发布」的闭环操作与状态可见。

**范围边界（In / Out）**:

| 类型 | 内容 |
|------|------|
| ✅ In | 排期生成 / 读取（`workbench.generateCalendar` / `calendar.list`）接入周 / 月视图 |
| ✅ In | 状态推进（`calendar.updateStatus`）与回填 URL（`drafts.updatePublishUrl`）入口 |
| ✅ In | 从 Injoys 导入入口（`workbench.importCalendar`，显式触发） |
| ✅ In | 状态胶囊样式（五态）与「草稿直达链接」外链 |
| ❌ Out | 自动状态推进 / 自动导入 |
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
4. Injoys 导入入口与样式令牌化（0.25 人日）

**验证标准**:

| 验收项 | 验收条件 | 验收方式 |
|--------|----------|----------|
| 五态呈现 | 状态依五态呈现对应胶囊样式 | UI 验收 |
| 回填闭环 | 预填后状态为「已推草稿箱」，回填 URL 后才「已发布」 | UI 验收 |
| 部分回填 | 多渠道部分回填固定停留「已推草稿箱」，可看出已回填数量 | UI 验收 |

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
```

**依赖**:
- 前置: `feat-calendar-generate-list`、`feat-calendar-status-transitions`、`feat-calendar-injoys-import`
- 被依赖: 无
- 约束: `published` 仅经 `drafts.updatePublishUrl` 写入（criterion §4）

---

### 提案 6: AI 工具中枢与沙箱控制台

**Change ID:** `feat-client-tools-console`  
**优先级:** P2  
**预计时间:** 3 人日（规划估算）  
**状态:** proposed

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

## 执行顺序与依赖

- **可并行三条主线**：
  1. `feat-client-engine-config`（无前置，可最先启动）。
  2. 内容线：`feat-client-content-studio` → `feat-client-feed-simulators`。
  3. 排期线：`feat-client-schedule-view`；工具线：`feat-client-tools-console`。
- **驾驶舱线**：`feat-client-dashboard` 待 Phase 0 的汇总语义与环比基准完成后再接入。
- 跨阶段前置条件：驾驶舱依赖 Phase 0（A1 / A2）；创作室依赖 Phase 2（C1）；排期视图依赖 Phase 1（B2 / B3 / B5）；工具控制台依赖 Phase 2（C2 / C3 / C4）。
- 提供给后续阶段的能力：可端到端操作的 Phase 0 工作台界面（供 Phase 0 Live 实测与签收）。

## 阶段整体验收

- 模块 1 / 2 / 3 / 6 / 7 BDD 场景通过；PD-004 的界面缺口闭合（草稿管理 → 多变体编辑 → 预填入口可视化）。
- 代码审查确认：客户端仅经 `callOpsRpc` 访问宿主；无硬编码色值；无 WebSocket / SSE / 后台轮询（`criterion.md` §3.1 / §3.3 / §3.4）。
- Phase 0 Live 实测清单中界面相关项可勾选（状态呈现、生成持久化、预填入口、回填 URL）。

## 待决事项（按需）

- 热点雷达 Tab 的真实选题来源（PRD 未指定具体渠道）：本路线图不安排该 Tab 的选题生成，待来源明确后另行提案。
- **令牌下发口径待澄清**（关联提案 1）：`criterion.md` §3.4（MUST NOT 下发令牌）与 §4（前端显隐切换）的口径张力尚未在 criterion 侧裁决；本例的例外边界现引自 `.context/architecture/security_policy.md`「令牌返回策略」。是否将该例外正式写入 `criterion.md` 需经 `context-update` 并取得用户授权，本次不改。
