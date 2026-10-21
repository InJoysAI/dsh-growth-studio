# 提案路线图 (Proposal Roadmap)

> **Metadata**
> - **项目名称**: dsh-growth-studio（Growth Studio / 个人产品增长推广工坊）
> - **项目类型**: **已有实现项目**（依据：`.context/legacy/legacy_system_analysis.md` 不存在，因此不是棕地；但 ① `.context/architecture/risks_and_debt.md` 的 TD-001 ~ TD-015 与 `.context/domain/risks_and_debt.md` 的 PD-001 ~ PD-006 逐条记录了**现状实现**与目标契约的差距；② 仓库内已存在架构文档描述的源码目录与可运行代码 —— `src/index.ts`、`src/ops-rpc.ts`、`src/config-store.ts`、`src/types.ts`、`src/adapters/`、`src/browser/`、`src/storage/`、`src/analytics/`、`src/tools/`、`src/injoys/`、`plugin-src/client/`、`tests/`，与 `criterion.md` §1 仓库结构约束一致）
> - **规划形态**: `总纲+分Phase`
> - **判定依据**: 提案总数 M=37、Phase 数 P=5、单 Phase 最多提案数 K=15（均超出 `单文件` 阈值 M≤10 / P≤3 / K≤6 中的 M、P 与 K 条件）
> - **当前阶段**: Phase 0（安全与数据真实性修复）
> - **生成日期**: 2026-10-17
> - **基于文档**: `.context/criterion.md`、`.context/context-manifest.json`、`.context/architecture/*`（含 9 篇 ADR，含 `adr_009_browseros_capability_management.md`）、`.context/domain/*`
> - **任务状态**: in-progress（37 条提案中 4 条已 `done`：`fix-overview-metrics-null-semantics`、`feat-storage-metrics-snapshot`、`fix-storage-file-permissions`、`fix-config-save-error-swallow`；其余 33 条 `proposed`）

> **规划口径说明**
> - **阶段划分依据**: 本项目 PRD 的 Phase 1–3（舆情需求提炼 / 技能工坊与出海 / Injoys 双向同步）属**未到阶段**，`.context/architecture/constraints.md`「阶段规划」明确「未到阶段的能力不提前实现」，故本路线图**只覆盖 Phase 0（双平台最小完整闭环）的达成**；PRD §七 Phase 1–3 的交付能力**不在本路线图范围**。
> - **修复优先于新增**: 依 `.context/architecture/risks_and_debt.md` 的严重性标注，触碰 `criterion.md` 铁律 / 数据真实性 / 安全边界的缺口（TD-007 / TD-008 / TD-009 / TD-012，以及登记为「未缓解 / 待修复」的 RISK-003 与 RISK-005 缓解措施 ③「不得吞异常后谎报保存成功」）全部置于**最前的 Phase 0**；`fix-*` 表示「对现有实现的修复或对齐」，`feat-*` 表示「新增能力」。
> - **预计时间为规划估算**: 源文档与 Context 资产对工作量一律标注 `N/A – 源文档未提供`（见 `risks_and_debt.md` 各 TD 条目），本路线图中的人日数为**规划估算**，不是源文档事实；提案创建时应重新评估。
> - **数量已收窄**: 同一方法 / 同一模块内的缺陷合并为一个提案（如 `workbench.overview` 的汇总语义与硬编码热点数据；`browser.sessions` 的 Cookie 探测分支移除与 `ops_inspect_sessions` 按名登记同属会话探测模块），避免为同一文件产出互相冲突的并行提案。

**被移出的能力（阶段边界与依据）**：以下能力**不在 Phase 0 范围**（未到阶段，或阶段未指定），本路线图不为它们排提案，以避免「范围变更」与「遗漏」不可区分。

> **口径说明**：下表「所属 PRD 后续阶段」一列指 **PRD §七 的阶段口径**（PRD Phase 1–3），**与本路线图自身的 Phase 0–4 编号体系不同**，勿混淆（例如「官方内置 5 大场景技能包 | Phase 2」指 PRD Phase 2，并非本路线图的 Phase 2「内容沉淀与 AI 工具中枢」）。

| 被移出的能力 | 所属 PRD 后续阶段 | 依据（资产路径与章节） |
|--------------|:-----------:|------------------------|
| 视频号 / 抖音渠道与视频元数据模拟器、预填 | Phase 1 | `.context/domain/source/product_requirements.md` §四（分阶段交付）、§5.4.2、§七；`.context/architecture/constraints.md`「阶段规划」 |
| `xiaohongshu` 渠道适配器 | 阶段未指定（源文档未提供） | `.context/architecture/risks_and_debt.md` TD-015（`PlatformId` 9 值但适配器未注册）；`.context/criterion.md` §5.5 注；`.context/architecture/container_component_view.md` 平台清单注 |
| `ops_keyword_research`（策划与选题）/ `ops_generate_hooks`（创意与生成）的**完整能力** | 阶段未定（源文档未提供） | `.context/domain/risks_and_debt.md` PD-006（偿还计划：阶段未定，需补阶段归属或显式标注移出）；`.context/architecture/api_strategy.md` §3.10（阶段列标「未定」）。**口径说明**：本表指其**完整能力**不排提案；归属裁决（补阶段实现 / 显式标注移出）由 Phase 2 的 `feat-tools-lifecycle-gaps` 收口，不构成「已排入未到阶段能力」 |
| 跨平台真实评论抓取与需求聚类反哺（`IssueExtractor` → Injoys 需求池） | Phase 1 | `.context/domain/business_rules.md` BR-054；`.context/domain/risks_and_debt.md` PD-005；`.context/domain/source/product_requirements.md` §5.6 |
| 基于真实数据的周 / 月增长复盘报告 | Phase 1 | `.context/domain/business_rules.md` BR-055；`.context/domain/source/product_requirements.md` §5.6、§5.5.1 |
| 海外四大渠道（YouTube / X / Product Hunt / TikTok）模拟与预填 | Phase 2 | `.context/domain/source/product_requirements.md` §5.2.1、§5.4.2、§七；`.context/domain/risks_and_debt.md` RISK-B003 |
| 官方内置 5 大场景技能包（白名单工具裁剪） | Phase 2 | `.context/domain/business_rules.md` BR-042；`.context/domain/risks_and_debt.md` PD-002；`.context/domain/source/product_requirements.md` §5.5.2 |
| 自定义技能包可视化编辑器 + 第三方 MCP 热插拔挂载 | Phase 3 | `.context/domain/risks_and_debt.md` PD-002；`.context/domain/source/product_requirements.md` §5.5.2、§四 |
| BrowserOS 交互式登录端点（`browser.login.startQr` / `pollQr` / `openHeadful` / `cancel`） | Phase 2（需 CDP PoC） | `.context/domain/risks_and_debt.md` PD-001；`.context/architecture/risks_and_debt.md` RISK-012；`.context/domain/source/product_requirements.md` §5.2.3 |
| Injoys 复杂双向同步与冲突仲裁 | Phase 3 | `.context/domain/business_rules.md` BR-024；`.context/domain/risks_and_debt.md` PD-003；`.context/architecture/risks_and_debt.md` TD-006；`.context/domain/source/product_requirements.md` §5.3.2、§七 |
| 架构组件 `FeedbackIntelligence`（评论爬取与需求提炼） | Phase 1 | `.context/architecture/system_design.md` 组件表；`.context/architecture/introduction_and_goals.md`「范围与阶段」 |
| 架构组件 `SkillEngine` / `OverseasStrategyManager` | Phase 2 | `.context/architecture/system_design.md` 组件表；`.context/architecture/context_view.md`「Out-of-Scope（本系统不负责）」 |
| 看板卡片拖拽改期（UI 批次 2） | UI 批次 2 | `.context/ui/atomic_components.md` §4「排期双视图」注「拖拽深度 = UI 批次 2」；`.context/ui/source/ui-design-direction.md` §5.3 |
| 草稿历史 / 版本查看与恢复 | 不提供（MVP 边界） | `.context/ui/atomic_components.md` §3「物料与预填栏」注「MVP **不提供**草稿历史 / 版本恢复」；`criterion.md` §3.5、`adr_008_version_snapshot_storage.md` |
| 独立工作台主视图 / 主侧边栏槽位 | 须先改 criterion §3.1 | `.context/ui/design_system.md`「实施门禁」；`.context/ui/source/ui-design-direction.md` DEC-UI-001 |
| JSX 分目录与 `styles/*.css` 拆分 | 须先改 criterion §3.3 | `.context/ui/atomic_components.md` §「概述」；`.context/ui/source/ui-design-direction.md` DEC-UI-004、§6 实施门禁 |
| 舆情需求大盘的按平台指标（播放/阅读、点赞、评论、分享、收藏） | 待宿主契约 | `workbench.overview` 仅返回全网汇总与覆盖范围，不返回逐平台明细；`PlatformMetrics` 无 RPC 暴露（`.context/architecture/api_strategy.md` §3.1、`src/types.ts`） |
| 无障碍规范细化（focus ring / ARIA / 对比度阈值 / 图标替代文本） | 待设计输入 | `.context/ui/accessibility_checklist.md` 各条标 `TODO`（源文档未写） |
| 栅格刻度 / 字体 / 间距 / 圆角 token | 待设计输入 | `.context/ui/layout_grid.md`「8pt 间距体系」、`.context/ui/design_system.md`「字体规范」「间距 / 圆角 / 阴影」、`.context/ui/design_tokens.json` 对应 `_comment` 均为 `TODO` |

> [!NOTE]
> **`ops_draft_launch_kit`（出海 Launch 物料）的阶段边界**：该工具所属**能力**属 Phase 2，但它**当前实现中已存在**且存在越权写入 Injoys 与时间戳伪造编号两处合规缺陷（`docs/implementation-gaps-report.md` §1 / §2）。依「触碰铁律的实现缺口全部置于 Phase 0」，其**减法**合规修复已并入 Phase 0 的 `fix-unauthorized-injoys-doc-write` 与 `fix-doc-id-fabrication`；本路线图**不**提前实现 Phase 2 的出海模拟 / 预填能力。
>
> [!NOTE]
> **UI 基础层提案的追加口径（`plan add ui`）**：2026-10-21 依据 `.context/ui/*` 追加 `fix-ui-token-violations`、`feat-ui-workbench-shell`、`feat-ui-primitives-button-badge-card`、`feat-ui-metricbox-kpi`、`feat-ui-empty-state`、`feat-ui-interaction-states`、`feat-ui-responsive-breakpoints`、`feat-ui-shortcuts-guardrails`、`feat-ui-i18n-dictionary` 共 9 条，全部落在 **Phase 3**（`.context/ui/README.md`「客户端交付在项目 Phase 3」）。**追加时只增不改**：当时未改动已有 27 条提案的范围、优先级、依赖与状态。（该纪律仅约束 `plan add ui` 这一次追加；后续 `context-check plan` 的修复轮已按检查结论调整 D1–D6 的依赖字段，见下方「待协调」与「结构影响」两段的现状描述。）
>
> **待协调（只报告，不改已有提案）**：Phase 3 提案 1–6 各自带「样式令牌化 / 硬编码色值清理」子任务（0.25–0.75 人日），与 `fix-ui-token-violations` 范围重叠——实施时令牌基线统一由该提案提供，提案 1–6 复用即可，不必各自另建。另 `feat-client-dashboard` 已含「`null` → 暂无数据 / 暂无环比 + 覆盖范围」的**数据语义**，`feat-ui-metricbox-kpi` 只做**组件结构与排布**，两者是「组件 → 接入」关系，不重复实现。
>
> **结构影响（只报告）**：本 Phase 原有 6 条提案均为「Tab 内容接入」，但仓库现行 `plugin-src/client/ops-page.js` 无 Tab 容器、无 KPI Ribbon、无快捷键处理。`feat-ui-workbench-shell` **先于**提案 1–6 实施，否则 6 个 Tab 缺容器承载；该前置已作为正式依赖写入 D1–D6 的前置字段、总纲索引与依赖图（2026-10-21 检查修复轮），不再只是建议。

> **`.context` 登记补登**：`architecture/risks_and_debt.md` 的 TD-008 仅登记 4 处写入站点、TD-009 仅登记 `ops_generate_review` 一处假编号（见 `docs/implementation-gaps-report.md` §5 的「已知覆盖缺口」）。上述两个 Phase 0 提案已把「补登第 5 处 / 第 2 处站点」列入 In-scope，实施时须同轮刷新 `.context` 资产、Manifest 与 `history`。

---

## 🗺️ 阶段总览

| 阶段 | 名称 | 目标 | 预计周期 | 提案数 | 详情 |
|:----:|------|------|----------|:------:|------|
| Phase 0 | 安全与数据真实性修复 | 消除触碰铁律 2 / 铁律 3 / 铁律 4、内容写入边界、安全边界与配置落盘真实性的实现缺口，让既有接口先「不说假话、不越界」 | ~21 人日 | 10 | [Phase-0](./proposal-roadmap-Phase-0.md) |
| Phase 1 | 排期主数据与 Injoys 单向同步 | 让排期成为本地黄金主数据源，并打通生成 / 状态推进 / 单向导出 / 显式导入 | ~15 人日 | 5 | [Phase-1](./proposal-roadmap-Phase-1.md) |
| Phase 2 | 内容沉淀与 AI 工具中枢 | 补齐「用户显式触发」的唯一沉淀入口，并落地工具目录 / 白名单 / 沙箱 / 遥测 | ~12.5 人日 | 5 | [Phase-2](./proposal-roadmap-Phase-2.md) |
| Phase 3 | 客户端工作台 UI 接入 | 把宿主侧契约接进 6 大 Tab 中 Phase 0 所需的 5 个 Tab，补齐 PD-004 的界面缺口 | ~37 人日 | 15 | [Phase-3](./proposal-roadmap-Phase-3.md) |
| Phase 4 | 契约收口与端到端验收 | 统一重复错误码、补齐客户端 RPC 消费测试，为 Phase 0 Live 实测与签收做准备 | ~3 人日 | 2 | [Phase-4](./proposal-roadmap-Phase-4.md) |

> Phase 顺序按 **SSoT-first 依赖**而非严重性单独排序：Phase 0 是必须最先做的合规修复；Phase 1 / 2 提供后续 UI 所依赖的宿主契约；Phase 3 的客户端 UI 之所以不在 Phase 0，是因为它**依赖**前序契约（`criterion.md` §6：类型契约 → 宿主 RPC 契约 → 领域实现 → 客户端 UI 与测试）。PD-004（高严重性）的界面缺口在 Phase 3 集中偿还。

---

## 🔗 依赖关系图

> 覆盖全部 37 个提案（含跨 Phase 依赖）。

```mermaid
graph LR
    subgraph P0["Phase 0 安全与数据真实性修复"]
        A1["fix-overview-metrics-null-semantics"]
        A2["feat-storage-metrics-snapshot"]
        A3["fix-unauthorized-injoys-doc-write"]
        A4["fix-doc-id-fabrication"]
        A5["feat-browseros-capability-toggle"]
        A6["fix-browser-session-cookie-probe"]
        A7["fix-storage-file-permissions"]
        A8["feat-injoys-test-document-count"]
        A9["fix-config-save-error-swallow"]
        A10["feat-metrics-window-verified-capture"]
    end
    subgraph P1["Phase 1 排期主数据与 Injoys 单向同步"]
        B1["feat-storage-calendar-items"]
        B2["feat-calendar-generate-list"]
        B3["feat-calendar-status-transitions"]
        B4["feat-calendar-injoys-export"]
        B5["feat-calendar-injoys-import"]
    end
    subgraph P2["Phase 2 内容沉淀与 AI 工具中枢"]
        C1["feat-workbench-sink-to-injoys-doc"]
        C2["feat-tools-catalog-toggle"]
        C3["feat-tools-sandbox-execute"]
        C4["feat-tools-telemetry"]
        C5["feat-tools-lifecycle-gaps"]
    end
    subgraph P3["Phase 3 客户端工作台 UI 接入"]
        D1["feat-client-engine-config"]
        D2["feat-client-dashboard"]
        D3["feat-client-content-studio"]
        D4["feat-client-feed-simulators"]
        D5["feat-client-schedule-view"]
        D6["feat-client-tools-console"]
        D7["fix-ui-token-violations"]
        D8["feat-ui-workbench-shell"]
        D9["feat-ui-primitives-button-badge-card"]
        D10["feat-ui-metricbox-kpi"]
        D11["feat-ui-empty-state"]
        D12["feat-ui-interaction-states"]
        D13["feat-ui-responsive-breakpoints"]
        D14["feat-ui-shortcuts-guardrails"]
        D15["feat-ui-i18n-dictionary"]
    end
    subgraph P4["Phase 4 契约收口与端到端验收"]
        E1["fix-not-found-error-code-unify"]
        E2["fix-client-rpc-consumption-tests"]
    end

    A1 --> A2
    A7 --> A2
    A1 --> A10
    A2 --> A10
    A10 --> D2
    A7 --> B1
    A1 --> B2
    A1 --> D2
    A2 --> D2
    A3 --> A4
    A3 --> C1
    A5 --> D1
    A6 --> D1
    A6 --> D2
    A8 --> D1
    A8 --> D2

    B1 --> B2
    B1 --> B3
    B1 --> B4
    B4 --> B2
    B4 --> B5
    B1 --> B5
    B2 --> D5
    B2 --> D2
    B3 --> D5
    B3 --> D3
    B4 --> D5
    B5 --> D5

    C1 --> D3
    C2 --> C3
    C2 --> C5
    C2 --> D6
    C3 --> C4
    C3 --> D6
    C4 --> D6

    D3 --> D4

    D7 --> D8
    D8 --> D1
    D8 --> D2
    D8 --> D3
    D8 --> D4
    D8 --> D5
    D8 --> D6
    D7 --> D9
    D9 --> D10
    D10 --> D2
    D9 --> D11
    D9 --> D12
    D8 --> D13
    D8 --> D14
    D12 --> D14
```

---

## 📇 提案索引

> 索引只做定位：Change ID、优先级、前置依赖、状态与各 Phase 文件中的提案块**完全一致**，详细内容只写在 Phase 文件里。

| Change ID | Phase | 标题 | 优先级 | 前置依赖 | 状态 | 详情 |
|-----------|:-----:|------|:------:|----------|------|------|
| `fix-overview-metrics-null-semantics` | 0 | 工作台总览的汇总空值语义与真实数据来源 | P0 | 无 | done | [Phase-0](./proposal-roadmap-Phase-0.md) |
| `feat-storage-metrics-snapshot` | 0 | 指标历史快照落盘（环比基准） | P1 | `fix-overview-metrics-null-semantics`、`fix-storage-file-permissions` | done | [Phase-0](./proposal-roadmap-Phase-0.md) |
| `fix-unauthorized-injoys-doc-write` | 0 | 移除生成 / 复盘 / 海外 Launch 路径未授权的 Injoys 文档写入 | P0 | 无 | proposed | [Phase-0](./proposal-roadmap-Phase-0.md) |
| `fix-doc-id-fabrication` | 0 | 工具不得以字面量 / 时间戳冒充文档编号 | P0 | `fix-unauthorized-injoys-doc-write` | proposed | [Phase-0](./proposal-roadmap-Phase-0.md) |
| `feat-browseros-capability-toggle` | 0 | BrowserOS 能力开关契约与统一执行检查 | P0 | 无 | proposed | [Phase-0](./proposal-roadmap-Phase-0.md) |
| `fix-browser-session-cookie-probe` | 0 | 统一 BrowserOS 会话探测并登记会话探活工具 | P0 | 无 | proposed | [Phase-0](./proposal-roadmap-Phase-0.md) |
| `fix-storage-file-permissions` | 0 | 落盘文件与目录权限位实现 | P1 | 无 | done | [Phase-0](./proposal-roadmap-Phase-0.md) |
| `feat-injoys-test-document-count` | 0 | `injoys.test` 补文档数（可空）契约 | P1 | 无 | proposed | [Phase-0](./proposal-roadmap-Phase-0.md) |
| `fix-config-save-error-swallow` | 0 | 配置写盘失败如实上报（不虚报成功） | P0 | 无 | done | [Phase-0](./proposal-roadmap-Phase-0.md) |
| `feat-metrics-window-verified-capture` | 0 | 公众号 / B站 指标窗口化可证采集 | P1 | `fix-overview-metrics-null-semantics`、`feat-storage-metrics-snapshot` | proposed | [Phase-0](./proposal-roadmap-Phase-0.md) |
| `feat-storage-calendar-items` | 1 | 排期主数据本地落盘服务 | P0 | `fix-storage-file-permissions` | proposed | [Phase-1](./proposal-roadmap-Phase-1.md) |
| `feat-calendar-generate-list` | 1 | 排期生成、读取与生成时立即导出 | P0 | `feat-storage-calendar-items`、`feat-calendar-injoys-export`、`fix-overview-metrics-null-semantics` | proposed | [Phase-1](./proposal-roadmap-Phase-1.md) |
| `feat-calendar-status-transitions` | 1 | 排期状态前向推进与校验 | P1 | `feat-storage-calendar-items` | proposed | [Phase-1](./proposal-roadmap-Phase-1.md) |
| `feat-calendar-injoys-export` | 1 | 排期单向导出至 Injoys 表格 | P0 | `feat-storage-calendar-items` | proposed | [Phase-1](./proposal-roadmap-Phase-1.md) |
| `feat-calendar-injoys-import` | 1 | 从 Injoys 表格显式导入排期 | P1 | `feat-storage-calendar-items`、`feat-calendar-injoys-export` | proposed | [Phase-1](./proposal-roadmap-Phase-1.md) |
| `feat-workbench-sink-to-injoys-doc` | 2 | 用户显式触发的物料沉淀入口 | P1 | `fix-unauthorized-injoys-doc-write` | proposed | [Phase-2](./proposal-roadmap-Phase-2.md) |
| `feat-tools-catalog-toggle` | 2 | 工具目录与白名单开关 | P1 | 无 | proposed | [Phase-2](./proposal-roadmap-Phase-2.md) |
| `feat-tools-sandbox-execute` | 2 | 单步调试沙箱执行 | P1 | `feat-tools-catalog-toggle` | proposed | [Phase-2](./proposal-roadmap-Phase-2.md) |
| `feat-tools-telemetry` | 2 | 工具执行遥测（脱敏） | P2 | `feat-tools-sandbox-execute` | proposed | [Phase-2](./proposal-roadmap-Phase-2.md) |
| `feat-tools-lifecycle-gaps` | 2 | 补齐生命周期分类未定阶段的 2 个工具 | P2 | `feat-tools-catalog-toggle` | proposed | [Phase-2](./proposal-roadmap-Phase-2.md) |
| `feat-client-engine-config` | 3 | 引擎策略配置页接入（含 BrowserOS 能力管理） | P0 | `feat-browseros-capability-toggle`、`fix-browser-session-cookie-probe`、`feat-injoys-test-document-count`、`feat-ui-workbench-shell` | proposed | [Phase-3](./proposal-roadmap-Phase-3.md) |
| `feat-client-dashboard` | 3 | 运营驾驶舱接入 | P0 | `fix-overview-metrics-null-semantics`、`feat-storage-metrics-snapshot`、`feat-metrics-window-verified-capture`、`feat-calendar-generate-list`、`fix-browser-session-cookie-probe`、`feat-injoys-test-document-count`、`feat-ui-workbench-shell`、`feat-ui-metricbox-kpi` | proposed | [Phase-3](./proposal-roadmap-Phase-3.md) |
| `feat-client-content-studio` | 3 | 内容创作室与草稿库接入 | P0 | `feat-workbench-sink-to-injoys-doc`、`feat-calendar-status-transitions`、`feat-ui-workbench-shell` | proposed | [Phase-3](./proposal-roadmap-Phase-3.md) |
| `feat-client-feed-simulators` | 3 | 公众号 / B站 真实样式模拟器 | P1 | `feat-client-content-studio`、`feat-ui-workbench-shell` | proposed | [Phase-3](./proposal-roadmap-Phase-3.md) |
| `feat-client-schedule-view` | 3 | 排期日历流水与回填入口 | P1 | `feat-calendar-generate-list`、`feat-calendar-status-transitions`、`feat-calendar-injoys-export`、`feat-calendar-injoys-import`、`feat-ui-workbench-shell` | proposed | [Phase-3](./proposal-roadmap-Phase-3.md) |
| `feat-client-tools-console` | 3 | AI 工具中枢与沙箱控制台 | P2 | `feat-tools-catalog-toggle`、`feat-tools-sandbox-execute`、`feat-tools-telemetry`、`feat-ui-workbench-shell` | proposed | [Phase-3](./proposal-roadmap-Phase-3.md) |
| `fix-ui-token-violations` | 3 | 清理未授权令牌与未授权 HEX | P0 | 无 | proposed | [Phase-3](./proposal-roadmap-Phase-3.md) |
| `feat-ui-workbench-shell` | 3 | 工作台壳层（HeaderCockpit + Sticky KPI Ribbon + 六 Tab） | P0 | `fix-ui-token-violations` | proposed | [Phase-3](./proposal-roadmap-Phase-3.md) |
| `feat-ui-primitives-button-badge-card` | 3 | 原子组件 Button / Badge 状态灯 / Card | P0 | `fix-ui-token-violations` | proposed | [Phase-3](./proposal-roadmap-Phase-3.md) |
| `feat-ui-metricbox-kpi` | 3 | MetricBox 指标卡组件（结构与排布） | P1 | `feat-ui-primitives-button-badge-card` | proposed | [Phase-3](./proposal-roadmap-Phase-3.md) |
| `feat-ui-empty-state` | 3 | EmptyState 空状态组件 | P1 | `feat-ui-primitives-button-badge-card` | proposed | [Phase-3](./proposal-roadmap-Phase-3.md) |
| `feat-ui-interaction-states` | 3 | 交互状态与微动效 | P0 | `feat-ui-primitives-button-badge-card` | proposed | [Phase-3](./proposal-roadmap-Phase-3.md) |
| `feat-ui-responsive-breakpoints` | 3 | 1280 / 960 断点响应式布局 | P1 | `feat-ui-workbench-shell` | proposed | [Phase-3](./proposal-roadmap-Phase-3.md) |
| `feat-ui-shortcuts-guardrails` | 3 | 快捷键与防呆 | P1 | `feat-ui-workbench-shell`、`feat-ui-interaction-states` | proposed | [Phase-3](./proposal-roadmap-Phase-3.md) |
| `feat-ui-i18n-dictionary` | 3 | i18n 文案字典（`locale/*.json` + `ops.<area>.<name>`） | P1 | 无 | proposed | [Phase-3](./proposal-roadmap-Phase-3.md) |
| `fix-not-found-error-code-unify` | 4 | 统一「未找到」错误码 | P2 | 无 | proposed | [Phase-4](./proposal-roadmap-Phase-4.md) |
| `fix-client-rpc-consumption-tests` | 4 | 客户端 RPC 消费测试覆盖 | P1 | 无 | proposed | [Phase-4](./proposal-roadmap-Phase-4.md) |

---

## 📦 各 Phase 详情

- **Phase 0: 安全与数据真实性修复** — 让既有接口先合规：汇总空值语义与真实来源、内容写入边界、虚报成功（含复盘 / 海外 Launch 假编号与 `config.save` 配置落盘失败）、BrowserOS 能力开关与会话探测、文件权限、`injoys.test` 可空文档数、**指标窗口化可证采集**（承接 A1/A2 遗留的采集侧缺口） → [Phase-0](./proposal-roadmap-Phase-0.md)
- **Phase 1: 排期主数据与 Injoys 单向同步** — 排期成为本地黄金主数据源并打通生成（含生成时立即导出）/ 推进 / 导出 / 导入 → [Phase-1](./proposal-roadmap-Phase-1.md)
- **Phase 2: 内容沉淀与 AI 工具中枢** — 补齐唯一授权沉淀入口与工具目录 / 沙箱 / 遥测，并标注阶段未定的工具缺口 → [Phase-2](./proposal-roadmap-Phase-2.md)
- **Phase 3: 客户端工作台 UI 接入** — 把契约接进驾驶舱 / 创作室 / 排期 / 工具 / 引擎配置 5 个 Tab（含 BrowserOS 能力管理页）；另含 UI 基础层（令牌合规 / 壳层 / 原子组件 / 指标卡 / 空状态 / 交互状态 / 断点 / 快捷键 / i18n） → [Phase-3](./proposal-roadmap-Phase-3.md)
- **Phase 4: 契约收口与端到端验收** — 错误码统一、客户端消费测试，支撑 Phase 0 Live 实测与签收 → [Phase-4](./proposal-roadmap-Phase-4.md)

---

## 待决事项

- `xiaohongshu` 渠道适配器是否纳入交付：`PlatformId`（criterion §5.5）与源文档 §4.1（v1.4.4）均含 9 值，但 `AdapterRegistry` 仅注册 8 个适配器（TD-015）。源文档未指明其所属阶段，故本路线图**暂不排提案**；需产品负责人确认后再定（维持现状则不注册适配器，`prefillDraft` 对 `xiaohongshu` 返回 `ops/platform-unsupported`）。
- `ops_keyword_research` / `ops_generate_hooks` 的阶段归属：PRD §5.5.1 列出但未标注交付阶段（PD-006 / `api_strategy.md` §3.10 阶段列标「未定」）。二者是否在 Phase 0 交付（影响 BR-040「每组包含对应工具」的验收）需产品负责人裁决；本路线图在 Phase 2 的 `feat-tools-lifecycle-gaps` 中以「实现或显式标注移出范围」收口，但**具体取舍待定**。
- 热点雷达 Tab 的真实选题来源：PRD 未指定具体渠道（`risks_and_debt.md` 外部依赖），本路线图不安排该 Tab 的选题生成，待来源明确后另行提案。

---

> 💡 创建单个提案时使用：`.agents/workflows/context-openspec.md proposal <change-id> [roadmap-doc]`
> 💡 本形态下 `roadmap-doc` 可指定对应的 Phase 文件；不指定时也会按总纲索引自动读取。
