# Phase 2: 客户端工作台 UI 接入

> **返回总纲**: [proposal-roadmap.md](./proposal-roadmap.md)
> **文件名**: `proposal-roadmap-Phase-2.md`
> **状态**: proposed
> **来源**: `.context/criterion.md`（§3.1 客户端约束、§3.3 前端工程约束）、`.context/architecture/system_design.md`、`.context/architecture/container_component_view.md`、`.context/domain/business_rules.md`（BR-010 ~ BR-012、BR-030 ~ BR-033、BR-050 ~ BR-053、BR-070 ~ BR-083）、`.context/architecture/risks_and_debt.md`（TD-002、TD-014）、`.context/domain/risks_and_debt.md`（PD-004）
> **预计工作量与周期**: 约 12 人日

## 阶段目标与范围

- 目标与交付结果：把宿主 RPC 能力接入 **6 大业务 Tab** 客户端工作台（运营驾驶舱 / 排期日历流水 / 内容创作室 / AI工具中枢 / 舆情需求大盘 / 引擎策略配置），闭环「草稿管理 → 多变体编辑 → 预填入口」，并补齐客户端 RPC 消费测试。全部数据经 `callOpsRpc` 获取，样式走 DSH 设计令牌。
- In / Out：
  - ✅ In：工作台外壳与 RPC 消费扩展；驾驶舱与渠道矩阵；排期看板；创作室与跨平台预览；引擎策略配置；客户端消费测试。
  - ❌ Out：宿主侧新方法实现（Phase 0/1/3/4 交付）；工具中枢页面（Phase 3）；舆情大盘页面（Phase 4）。
- 适用约束：criterion §3.1（不绕过 `callOpsRpc` 直连、不硬编码敏感配置与色值、不在客户端承载核心业务规则）、§3.3（`loading` / `error` / `data` 状态域；`null` 展示「暂无数据」；未登录渠道提供 `去登录 ↗`）、BR-021/BR-022 铁律、BR-050/BR-051 指标可空语义。

## 提案详情

### 提案 1: 客户端工作台外壳与 RPC 消费扩展

**Change ID:** `feat-client-workbench-shell`  
**优先级:** P0  
**预计时间:** 2.5 人日  
**状态:** proposed

**业务目标（Business Goal）**:
- 搭建 6 大 Tab 工作台外壳与路由，扩展 `plugin-src/management-rpc.mjs` 的 `callOpsRpc` 消费封装，覆盖工作台 / 草稿 / 排期类方法（TD-002、PD-004）。
- 定义统一状态域（`loading` / `error` / `data`）与卡片局部刷新 + in-flight 去重（BR-082）。
- 所有请求经 `callOpsRpc`，不手写外部 `fetch`。

**范围边界（In / Out）**:

| 类型 | 内容 |
|------|------|
| ✅ In | Tab 外壳、路由、共享状态域、`callOpsRpc` 消费扩展、卡片即时刷新与 in-flight 去重 |
| ✅ In | DSH 设计令牌对齐的样式骨架（`var(--dsw-alias-*)`） |
| ❌ Out | 各 Tab 的具体业务渲染（后续提案） |
| ❌ Out | 在客户端承载状态机 / 权限判定（须在宿主侧） |

**关联 Context 资产**:

| Scope | 关联资产 | 关联说明 |
|-------|---------|----------|
| criterion | `.context/criterion.md` | §3.1 客户端约束、§3.3 前端工程约束 |
| architecture | `.context/architecture/system_design.md` | 6 大 Tab 结构 |
| architecture | `.context/architecture/container_component_view.md` | Ops Workbench 组件归属 |
| architecture | `.context/architecture/risks_and_debt.md` | TD-002 |
| domain | `.context/domain/business_rules.md` | BR-082、BR-083 |

**关键任务**:
1. 搭建 Tab 外壳与路由（0.75 人日）
2. 扩展 `callOpsRpc` 消费封装与统一状态域（0.75 人日）
3. 实现卡片即时刷新与同卡片 in-flight 去重（0.5 人日）
4. 样式骨架对齐 DSH 令牌（0.5 人日）

**验证标准**:

| 验收项 | 验收条件 | 验收方式 |
|--------|----------|----------|
| 统一入口 | 全部数据经 `callOpsRpc`，无手写 `fetch` | 代码审查 |
| 状态域 | 组件统一使用 `loading` / `error` / `data` | 代码审查 |
| 令牌 | 无硬编码背景 / 边框 / 文字色值 | 代码审查 |
| 刷新去重 | 同卡片并发刷新只发一次请求 | 手工验证 + 测试 |

**依赖**:
- 前置: —
- 被依赖: `feat-client-cockpit-matrix`、`feat-client-calendar-board`、`feat-client-studio-preview`、`feat-client-engine-config`、`feat-client-rpc-coverage`、`feat-tools-hub-sandbox`、`feat-feedback-comment-crawl`、`feat-trends-radar`
- 约束: 不在客户端承载核心业务规则。

---

### 提案 2: 运营驾驶舱与渠道矩阵接入

**Change ID:** `feat-client-cockpit-matrix`  
**优先级:** P0  
**预计时间:** 2 人日  
**状态:** proposed

**业务目标（Business Goal）**:
- 接入 `workbench.overview`：全网曝光 / 播放、互动汇总、排期履约与环比卡片，`null` 一律展示「暂无数据」而非 0（BR-050、BR-051、BR-052、BR-053）。
- 接入渠道矩阵与四态会话状态灯（`unknown` / `needs_login` / `authenticated` / `no_publish_permission`），未登录渠道提供 `去登录 ↗`（BR-010、BR-011、BR-012）。
- 就绪渠道统计只计 `authenticated`，不显示两个以上平台卡片（Phase 0 范围为公号 + B站，BR-002）。

**范围边界（In / Out）**:

| 类型 | 内容 |
|------|------|
| ✅ In | 核心指标卡、互动 / 履约卡、环比副标题、渠道矩阵与会话四态灯、`去登录 ↗` 外链 |
| ✅ In | `null` → 「暂无数据」；标注「全网非去重曝光与播放累计人次」口径 |
| ❌ Out | 指标采集与汇总判定（宿主侧，Phase 0） |
| ❌ Out | 自动发布 / 群发入口（铁律禁止） |

**关联 Context 资产**:

| Scope | 关联资产 | 关联说明 |
|-------|---------|----------|
| criterion | `.context/criterion.md` | §3.3 `null` 展示语义、§4 指标真实性 |
| architecture | `.context/architecture/api_strategy.md` | §3.1 `workbench.overview` 响应字段 |
| domain | `.context/domain/business_rules.md` | BR-002、BR-010、BR-011、BR-012、BR-050 ~ BR-053 |
| domain | `.context/domain/user_journeys.md` | Journey 1（晨会巡检与大盘监控） |

**关键任务**:
1. 接入核心指标卡与环比副标题（0.5 人日）
2. `null` → 「暂无数据」与口径标注（0.5 人日）
3. 渠道矩阵与会话四态灯 + `去登录 ↗`（0.75 人日）
4. 就绪度统计与「🔄 刷新大盘」快捷动作（0.25 人日）

**验证标准**:

| 验收项 | 验收条件 | 验收方式 |
|--------|----------|----------|
| 不显示 0 | 指标为 `null` 时显示「暂无数据」 | 手工验证 |
| 四态灯 | 未登录显示琥珀色 + `去登录 ↗`，无权限显示红色 | 手工验证 |
| 就绪度 | 一渠道未登录时连通度为 `1 / 2` | 手工验证 |
| 刷新 | 仅目标卡片更新，页面其他状态不丢失 | 手工验证 |

**依赖**:
- 前置: `feat-client-workbench-shell`、`fix-analytics-overview-aggregation`
- 被依赖: —
- 约束: 不显示假就绪、不按 0 伪造缺失值。

---

### 提案 3: 排期日历流水看板接入

**Change ID:** `feat-client-calendar-board`  
**优先级:** P1  
**预计时间:** 2 人日  
**状态:** proposed

**业务目标（Business Goal）**:
- 接入排期日历流水 Tab：周 / 月视图、排期项五态胶囊展示、一键生成 7 天排期的入口，以及「导出至 Injoys 表格」与「从 Injoys 导入」两个独立动作（BR-020、BR-023、BR-024、BR-NFR-003）。
- 通过宿主 RPC 完成生成 / 状态推进 / 导入导出，界面不承载状态机。

**范围边界（In / Out）**:

| 类型 | 内容 |
|------|------|
| ✅ In | 周 / 月视图、五态胶囊、生成入口、独立导入 / 导出动作、状态推进交互 |
| ✅ In | 冲突核对结果的界面呈现（`conflicts`） |
| ❌ Out | 排期持久化与业务逻辑（宿主侧，Phase 1） |
| ❌ Out | 双向同步入口（Phase 5 前不提供） |

**关联 Context 资产**:

| Scope | 关联资产 | 关联说明 |
|-------|---------|----------|
| architecture | `.context/architecture/api_strategy.md` | §3.1 / §3.3 排期 RPC |
| domain | `.context/domain/business_rules.md` | BR-020、BR-023、BR-024、BR-NFR-003 |
| domain | `.context/domain/user_journeys.md` | Journey 2b（排期生成与导出） |
| architecture | `.context/architecture/adr_005_five_state_lifecycle.md` | 五态胶囊 |

**关键任务**:
1. 周 / 月视图与五态胶囊渲染（0.75 人日）
2. 生成 7 天排期入口与结果呈现（0.5 人日）
3. 独立导出 / 导入动作与冲突核对呈现（0.5 人日）
4. 状态推进交互（经宿主 RPC）（0.25 人日）

**验证标准**:

| 验收项 | 验收条件 | 验收方式 |
|--------|----------|----------|
| 视图 | 周 / 月切换正常，项按 `date` 升序 | 手工验证 |
| 五态 | 胶囊样式与文案一致，不可跳级 / 回退 | 手工验证 |
| 独立动作 | 导出与导入为两个独立入口 | 手工验证 |
| 审查通过 | 无硬编码色值、数据经 `callOpsRpc` | 代码审查 |

**依赖**:
- 前置: `feat-client-workbench-shell`、`feat-calendar-status-flow`
- 被依赖: —
- 约束: Phase 0/1 不提供双向同步入口。

---

### 提案 4: 内容创作室与跨平台预览接入

**Change ID:** `feat-client-studio-preview`  
**优先级:** P0  
**预计时间:** 3 人日  
**状态:** proposed

**业务目标（Business Goal）**:
- 接入内容创作室：草稿管理、多变体编辑、跨平台真实样式预览（公众号朋友圈分享卡片 + 文章详情，B站 3 套候选标题 + 结构化简介 + 标签词云 + 分区），以及预填入口（BR-030、BR-031、BR-032、BR-033）。
- 提供「一键复制物料」与「💾 沉淀至 Injoys 知识文档」操作条（沉淀经 `workbench.sinkToInjoysDoc` 显式触发）。
- 生成只保存本地；草稿覆盖保存（MVP 不提供历史查看 / 恢复）。

**范围边界（In / Out）**:

| 类型 | 内容 |
|------|------|
| ✅ In | 草稿列表 / 详情、多变体编辑与覆盖保存、跨平台模拟器、一键复制、显式沉淀操作条、预填入口 |
| ✅ In | 视频号 / 抖音（Phase 1 渠道）与 X / Product Hunt（Phase 2 渠道）的模拟器预留 |
| ❌ Out | 生成与写入边界的宿主侧逻辑（Phase 0） |
| ❌ Out | 草稿版本历史 / 恢复（MVP 已移出范围） |
| ❌ Out | 自动发布能力（铁律禁止） |

> [!NOTE]
> 预填止步于平台原生「保存为草稿」，完成后展示草稿直达链接；状态不变为「已发布」，直至用户回填真实 URL（BR-021、BR-022）。

**关联 Context 资产**:

| Scope | 关联资产 | 关联说明 |
|-------|---------|----------|
| criterion | `.context/criterion.md` | §3.1 不绕过 RPC、§3.3 前端约束、§4 内容写入边界 |
| architecture | `.context/architecture/api_strategy.md` | §3.1 生成 / 沉淀 / 预填接口、§3.2 草稿接口 |
| domain | `.context/domain/business_rules.md` | BR-030、BR-031、BR-032、BR-033、BR-021、BR-022 |
| domain | `.context/domain/user_journeys.md` | Journey 3（创作与多端自适应）、Journey 4（自动化预填与人工发布） |
| architecture | `.context/architecture/adr_002_prefill_only_human_in_the_loop.md` | 人工在环 |

**关键任务**:
1. 草稿列表 / 详情与多变体编辑、覆盖保存（0.75 人日）
2. 公众号与 B站预览模拟器（0.75 人日）
3. 一键复制与「💾 沉淀至 Injoys 知识文档」操作条（0.5 人日）
4. 预填入口与草稿直达链接、回填 URL 交互（0.75 人日）
5. 预留视频号 / 抖音 / X / Product Hunt 模拟器位（0.25 人日）

**验证标准**:

| 验收项 | 验收条件 | 验收方式 |
|--------|----------|----------|
| 预览联动 | 修改标题后预览卡片同步更新 | 手工验证 |
| 本地优先 | 生成后草稿出现在草稿库，重启后仍存在 | 手工验证 |
| 显式沉淀 | 仅点击沉淀操作条才写 Injoys 文档 | 手工验证 |
| 无自动发布 | 全量 UI 中不存在自动确认发布入口 | 代码审查 |

**依赖**:
- 前置: `feat-client-workbench-shell`、`feat-workbench-sink-to-injoys-doc`、`fix-studio-generation-write-boundary`
- 被依赖: —
- 约束: 仅预填；不提供草稿历史。

---

### 提案 5: 引擎策略配置 Tab 接入

**Change ID:** `feat-client-engine-config`  
**优先级:** P1  
**预计时间:** 1.5 人日  
**状态:** proposed

**业务目标（Business Goal）**:
- 接入引擎策略配置 Tab：知识库 / 浏览器引擎连通性状态灯、一键连通性测试与延迟诊断、凭证显隐切换、接入地址 / 凭证 / 草稿目录配置、默认产品与调性配置（BR-070、BR-071、BR-072、BR-073）。
- 展示草稿库「当前生效目录」并覆盖切换提示文案三件事实。

**范围边界（In / Out）**:

| 类型 | 内容 |
|------|------|
| ✅ In | 状态灯、连通性测试、凭证掩码 / 显隐、配置表单（经 `config.get` / `config.save` / `injoys.test`）、目录回显与提示文案 |
| ❌ Out | 配置持久化与热更新逻辑（宿主侧已实现） |
| ❌ Out | 敏感策略 / 令牌下发到客户端 |

**关联 Context 资产**:

| Scope | 关联资产 | 关联说明 |
|-------|---------|----------|
| criterion | `.context/criterion.md` | §3.1 不硬编码敏感配置、§3.4 不下发令牌、§3.5 目录提示文案 |
| architecture | `.context/architecture/api_strategy.md` | §3.6 配置契约、§3.7 `draftsDir` 变更语义 |
| domain | `.context/domain/business_rules.md` | BR-070、BR-071、BR-072、BR-073 |
| architecture | `.context/architecture/risks_and_debt.md` | RISK-008、RISK-011 |

**关键任务**:
1. 状态灯与一键连通性测试 / 延迟诊断（0.5 人日）
2. 凭证掩码 / 显隐与配置表单（0.5 人日）
3. 草稿目录回显与切换提示文案（三件事实）（0.5 人日）

**验证标准**:

| 验收项 | 验收条件 | 验收方式 |
|--------|----------|----------|
| 状态灯 | 断开引擎变红，重连变绿 | 手工验证 |
| 掩码 | 凭证默认掩码，可切换明文 | 手工验证 |
| 即时生效 | 修改默认产品名后无需重启即生效 | 手工验证 |
| 提示文案 | 目录提示覆盖三件事实 | 手工验证 |

**依赖**:
- 前置: `feat-client-workbench-shell`
- 被依赖: `feat-overseas-platform-adapters`
- 约束: 不下发敏感策略 / 令牌到客户端。

---

### 提案 6: 客户端 RPC 消费测试覆盖

**Change ID:** `feat-client-rpc-coverage`  
**优先级:** P1  
**预计时间:** 1 人日  
**状态:** proposed

**业务目标（Business Goal）**:
- 为 `callOpsRpc`（`POST /api/ops` 请求构造、错误码透传）与 `unwrapRpcResult`（`ok` / `result` / `error` 解包、失败抛出）建立测试用例，并可加一条「宿主响应形状 ↔ 客户端解包」契约用例（TD-014）。
- 使 criterion §7.2 所述「客户端消费同步方式」具备自动化证据。

**范围边界（In / Out）**:

| 类型 | 内容 |
|------|------|
| ✅ In | `plugin-src/management-rpc.mjs` 的请求构造与解包测试；错误码透传 |
| ✅ In | 宿主响应形状 ↔ 客户端解包契约用例 |
| ❌ Out | 改造客户端实现本身 |
| ❌ Out | 宿主侧 RPC 测试（已覆盖） |

**关联 Context 资产**:

| Scope | 关联资产 | 关联说明 |
|-------|---------|----------|
| criterion | `.context/criterion.md` | §7.2 校验命令与客户端消费缺口 |
| architecture | `.context/architecture/risks_and_debt.md` | TD-014 |
| architecture | `.context/architecture/api_strategy.md` | §1.2 信封契约与 §2 响应格式 |

**关键任务**:
1. 建立 `callOpsRpc` 请求构造与错误码透传用例（0.5 人日）
2. 建立 `unwrapRpcResult` 解包 / 抛出用例（0.25 人日）
3. 加一条宿主响应 ↔ 客户端解包契约用例（0.25 人日）

**验证标准**:

| 验收项 | 验收条件 | 验收方式 |
|--------|----------|----------|
| 请求构造 | 断言客户端发出 `{ type, rpcId, method: 'ops', payload }` | 单元测试 |
| 解包 | 成功取 `result.value`，失败按 `error.code` 抛出 | 单元测试 |
| 契约一致 | 宿主信封形状与客户端解包一致 | 单元测试 |
| 审查通过 | `pnpm test` 通过 | `pnpm test` |

**依赖**:
- 前置: `feat-client-workbench-shell`
- 被依赖: —
- 约束: 测试不得写入开发者真实 `$DSH_HOME`。

---

## 执行顺序与依赖

- `feat-client-workbench-shell` 为全阶段前置。
- 完成后 `feat-client-cockpit-matrix`、`feat-client-studio-preview`、`feat-client-engine-config`、`feat-client-rpc-coverage` 可并行推进；`feat-client-calendar-board` 依赖 `feat-calendar-status-flow`（Phase 1）完成后接入。

- 跨阶段前置条件：`feat-client-cockpit-matrix` 依赖 Phase 0 的 `fix-analytics-overview-aggregation`；`feat-client-studio-preview` 依赖 Phase 0 的 `feat-workbench-sink-to-injoys-doc` 与 `fix-studio-generation-write-boundary`；`feat-client-calendar-board` 依赖 Phase 1 的排期 RPC。
- 提供给后续阶段的能力：可复用的 Tab 外壳与 `callOpsRpc` 消费层（供 Phase 3 工具中枢、Phase 4 舆情大盘）。

## 阶段整体验收

- 全量 `pnpm typecheck` 与 `pnpm test` 通过。
- 全部客户端数据经 `callOpsRpc`，无手写 `fetch`；无硬编码色值；客户端不承载核心业务规则。
- 铁律在 UI 侧成立：无自动发布入口；`null` 不显示为 0；未登录渠道有 `去登录 ↗`；生成只保存本地、沉淀须显式触发。
- PD-004（工作台界面交付滞后）在本阶段闭合。
