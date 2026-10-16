# Phase 4: 舆情复盘与选题反哺

> **返回总纲**: [proposal-roadmap.md](./proposal-roadmap.md)
> **文件名**: `proposal-roadmap-Phase-4.md`
> **状态**: proposed
> **来源**: `.context/domain/business_rules.md`（BR-050、BR-054、BR-055、BR-060）、`.context/domain/user_journeys.md`（Journey 5）、`.context/domain/risks_and_debt.md`（PD-005）、`.context/architecture/risks_and_debt.md`（TD-001、TD-010）、`.context/criterion.md`（§4 指标真实性、内容写入边界）
> **预计工作量与周期**: 约 9 人日

## 阶段目标与范围

- 目标与交付结果：打通「真实评论抓取 → 需求聚类（Bug / 功能建议）→ 沉淀 Injoys 需求池 → 周度复盘报告 → 热点选题反哺创作室」闭环，所有结论基于真实数据，数据不足如实标注。
- In / Out：
  - ✅ In：评论抓取、需求聚类与沉淀、周度复盘报告、热点选题雷达与一键采用。
  - ❌ Out：指标采集与汇总（Phase 0 已交付）；出海热点来源渠道（PRD 未指定，Phase 5 及以后）。
- 适用约束：criterion §4（指标真实性、内容写入边界：需求沉淀须用户显式触发）；BR-054 反哺需求必须来自真实评论；BR-055 复盘基于真实指标、数据不足如实标注；BR-060 采用选题进入创作室预填标题与基调（不自动生成排期）。

## 提案详情

### 提案 1: 真实评论抓取

**Change ID:** `feat-feedback-comment-crawl`  
**优先级:** P1  
**预计时间:** 2.5 人日  
**状态:** proposed

**业务目标（Business Goal）**:
- 从真实发布的图文与视频中抓取用户评论（公众号 + B站起步），不使用占位或示例数据（BR-054、PD-005）。
- 复用统一 BrowserOS 实例调度，抓取失败如实提示原因，不以示例评论冒充真实反馈。

**范围边界（In / Out）**:

| 类型 | 内容 |
|------|------|
| ✅ In | 评论抓取链路（`CommentsCrawler`）、按平台 / 内容来源抓取、失败如实报错 |
| ✅ In | 抓取结果结构与本地留存 |
| ❌ Out | 需求聚类与沉淀（见提案 2） |
| ❌ Out | 使用示例 / 占位评论 |

> [!NOTE]
> 抓取须经统一 BrowserOS 实例（criterion §3.2）；会话数据（Cookie）零外发。

**关联 Context 资产**:

| Scope | 关联资产 | 关联说明 |
|-------|---------|----------|
| criterion | `.context/criterion.md` | §3.2 统一 BrowserOS 实例、§4 会话零外发 |
| architecture | `.context/architecture/runtime_view.md` | 统一实例调度的时序细节 |
| domain | `.context/domain/business_rules.md` | BR-054 |
| domain | `.context/domain/user_journeys.md` | Journey 5（舆情复盘与需求反哺） |
| domain | `.context/domain/risks_and_debt.md` | PD-005 |

**关键任务**:
1. 实现评论抓取链路与统一实例调度（1 人日）
2. 定义抓取结果结构与本地留存（0.5 人日）
3. 失败如实报错、空评论提示（0.75 人日）
4. 补测试：真实抓取、失败不伪造（0.25 人日）

**验证标准**:

| 验收项 | 验收条件 | 验收方式 |
|--------|----------|----------|
| 真实来源 | 抓取结果来自真实评论，无占位数据 | 单元测试 + 手工验证 |
| 空评论 | 无评论时提示暂无可分析评论 | 手工验证 |
| 失败如实 | 抓取失败返回真实原因，不伪造结果 | 单元测试 |
| 会话安全 | Cookie 不向任何第三方上报 | 代码审查 |

**依赖**:
- 前置: `feat-client-workbench-shell`
- 被依赖: `feat-feedback-needs-clustering`
- 约束: 统一 BrowserOS 实例；会话数据零外发。

---

### 提案 2: 评论聚类为需求并沉淀 Injoys 需求池

**Change ID:** `feat-feedback-needs-clustering`  
**优先级:** P1  
**预计时间:** 2 人日  
**状态:** proposed

**业务目标（Business Goal）**:
- 将抓取到的评论聚类提炼为 Bug 与功能建议，结构化沉淀至 Injoys 需求池（BR-054）。
- 反哺的需求必须来源于真实抓取的评论；沉淀为**用户显式触发**的写入（内容写入边界）。

**范围边界（In / Out）**:

| 类型 | 内容 |
|------|------|
| ✅ In | 需求聚类（`IssueExtractor`）与结构化结果；经显式入口沉淀 Injoys 需求池 |
| ✅ In | 沉淀失败如实返回，不谎报成功 |
| ❌ Out | 评论抓取本身（提案 1） |
| ❌ Out | 自动静默写入远端 |

**关联 Context 资产**:

| Scope | 关联资产 | 关联说明 |
|-------|---------|----------|
| criterion | `.context/criterion.md` | §3.2 不虚报成功、§4 内容写入边界 |
| domain | `.context/domain/business_rules.md` | BR-054、BR-NFR-002 |
| domain | `.context/domain/user_journeys.md` | Journey 5 |
| architecture | `.context/architecture/api_strategy.md` | 显式写入语义（参照 `sinkToInjoysDoc`） |

**关键任务**:
1. 实现需求聚类与 Bug / 功能建议结构化（1 人日）
2. 经显式入口沉淀 Injoys 需求池（0.5 人日）
3. 沉淀失败如实返回（0.25 人日）
4. 补测试：真实评论 → 至少 1 条需求、失败不谎报（0.25 人日）

**验证标准**:

| 验收项 | 验收条件 | 验收方式 |
|--------|----------|----------|
| 来源真实 | 需求可追溯至真实评论 | 单元测试 |
| 显式触发 | 未显式触发时不写远端 | 单元测试 |
| 失败如实 | 沉淀失败返回真实错误 | 单元测试 |
| 审查通过 | `pnpm typecheck` 与 `pnpm test` 通过 | `pnpm typecheck` / `pnpm test` |

**依赖**:
- 前置: `feat-feedback-comment-crawl`
- 被依赖: —
- 约束: 需求来源于真实评论；沉淀须显式触发。

---

### 提案 3: 周度运营复盘报告

**Change ID:** `feat-weekly-review-report`  
**优先级:** P1  
**预计时间:** 2 人日  
**状态:** proposed

**业务目标（Business Goal）**:
- 生成周度 / 月度复盘报告，数字与指标大屏一致，基于真实采集指标与本地历史快照（BR-055）。
- 数据不足时如实标注（如环比为 `null`），不用估算值补齐结论。

**范围边界（In / Out）**:

| 类型 | 内容 |
|------|------|
| ✅ In | 复盘报告生成（消费指标历史与汇总结果）；数据不足标注；与 `ops_setup_schedule` 的周度巡检联动 |
| ❌ Out | 指标采集与汇总判定（Phase 0） |
| ❌ Out | 用估算值补齐结论 |

**关联 Context 资产**:

| Scope | 关联资产 | 关联说明 |
|-------|---------|----------|
| criterion | `.context/criterion.md` | §4 指标真实性与环比基准 |
| domain | `.context/domain/business_rules.md` | BR-050、BR-052、BR-055 |
| architecture | `.context/architecture/api_strategy.md` | §3.1 汇总与环比、§3.8 `ops_setup_schedule` |
| architecture | `.context/architecture/risks_and_debt.md` | RISK-006、RISK-007 |

**关键任务**:
1. 实现周度复盘报告生成，消费指标历史与汇总（1 人日）
2. 数据不足如实标注（0.5 人日）
3. 与 `ops_setup_schedule` 周度巡检联动（0.25 人日）
4. 补测试：报告数字与大盘一致（0.25 人日）

**验证标准**:

| 验收项 | 验收条件 | 验收方式 |
|--------|----------|----------|
| 数字一致 | 报告中数字与指标大屏一致 | 单元测试 |
| 数据不足 | 历史不足时环比标注为空 / 数据不足，不用估算补齐 | 单元测试 |
| 巡检联动 | 周度巡检可触发报告生成，失败如实返回 | 单元测试 |
| 审查通过 | `pnpm typecheck` 与 `pnpm test` 通过 | `pnpm typecheck` / `pnpm test` |

**依赖**:
- 前置: `feat-metrics-history-persistence`
- 被依赖: —
- 约束: 不得用估算值补齐结论；不得谎报巡检已注册。

---

### 提案 4: 热点选题雷达与一键采用

**Change ID:** `feat-trends-radar`  
**优先级:** P2  
**预计时间:** 2.5 人日  
**状态:** proposed

**业务目标（Business Goal）**:
- 拉取与当前产品领域（AI 智能体、自动化、出海增长）相关的选题切入点，展示热度指数与契合平台（BR-060）。
- 「采用此选题创作 ➔」进入创作室并预填标题与基调（**不自动生成排期**）。

**范围边界（In / Out）**:

| 类型 | 内容 |
|------|------|
| ✅ In | 雷达拉取（`TrendsDiscoverer`）、热度指数与契合平台展示、一键采用 → 创作室预填 |
| ✅ In | 与创作室路由联动 |
| ❌ Out | 自动生成排期（采用选题只进创作室） |
| ❌ Out | 出海热点来源渠道的最终选型（PRD 未指定，Phase 5 及以后） |

> [!NOTE]
> 「采用此选题创作 ➔」（通往创作室）与「+ 生成 7 天排期日历」（独立入口）目的地与结果不同，不得混用（user_journeys Journey 2 入口区分）。

**关联 Context 资产**:

| Scope | 关联资产 | 关联说明 |
|-------|---------|----------|
| domain | `.context/domain/business_rules.md` | BR-060、BR-083 |
| domain | `.context/domain/user_journeys.md` | Journey 2（选题策划）、入口区分说明 |
| architecture | `.context/architecture/api_strategy.md` | §3.1 `trends` 聚合数据 |
| domain | `.context/domain/risks_and_debt.md` | 外部依赖：产品领域热点来源（PRD 未指定渠道） |

**关键任务**:
1. 实现热点雷达拉取与数据结构（1 人日）
2. 热度指数与契合平台展示（0.5 人日）
3. 一键采用 → 创作室预填标题与基调（0.75 人日）
4. 补测试 / 手工验证采用后创作室预填（0.25 人日）

**验证标准**:

| 验收项 | 验收条件 | 验收方式 |
|--------|----------|----------|
| 采用预填 | 采用后创作室出现已预填标题与基调 | 手工验证 |
| 不生成排期 | 采用选题不自动生成排期 | 手工验证 |
| 真实来源 | 雷达数据来自真实来源，不伪造 | 代码审查 |

**依赖**:
- 前置: `feat-client-workbench-shell`
- 被依赖: —
- 约束: 采用选题 ≠ 生成排期；不引入自动发布。

---

## 执行顺序与依赖

- `feat-feedback-comment-crawl` → `feat-feedback-needs-clustering` 为串联链路。
- `feat-weekly-review-report` 依赖 Phase 0 的 `feat-metrics-history-persistence`，可与评论链路并行。
- `feat-trends-radar` 独立，可与上述并行。

- 跨阶段前置条件：`feat-weekly-review-report` 依赖 Phase 0 的指标历史；`feat-client-*` 依赖 Phase 2 的客户端外壳。
- 提供给后续阶段的能力：真实评论与需求数据、复盘能力、选题来源，供出海阶段复用。

## 阶段整体验收

- 全量 `pnpm typecheck` 与 `pnpm test` 通过。
- 反哺需求全部来自真实评论；沉淀于用户显式触发；复盘数字与大盘一致、数据不足如实标注。
- 采用选题只进创作室预填，不自动生成排期、不自动发布。
