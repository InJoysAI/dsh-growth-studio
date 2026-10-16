# .context/architecture/ — 架构上下文

> **Metadata**
> - **Source**: `.context/architecture/source/technical_architecture.md`（TAD v1.3.0）
> - **Generated At**: `2026-10-16 09:44`
> - **Updated At**: `2026-10-16 11:05`
> - **Generator**: `Context-Agent v1.0`

---

## 源文档（只读，权威技术输入）

| 文件 | 内容概要 |
|------|---------|
| `source/technical_architecture.md` | 技术架构设计说明书 v1.3.0：5 层架构（客户端视图层 / 宿主 RPC 网关层 / 业务领域服务层 / 外部 MCP 集成层 / 本地持久化基础设施层）、`POST /api/ops` RPC 信封契约、领域实体与状态机、统一 BrowserOS 实例方案、仅预填的人机协同发布闭环、Injoys 分阶段同步策略、设计令牌约束与安全治理 |

> 本项目 `docs/` 下**没有** `docs/architecture.md`；上述文件为唯一权威架构输入。
> ⚠️ **若下方总结与 `source/` 冲突，以 `source/` 目录中的源文档为准。**
> ⚠️ 约束的**权威来源**是 `../criterion.md`。

---

## 已生成总结

### 核心（必须）

| 文件 | 用途 |
|------|------|
| `system_design.md` | **系统设计总览** —— 分层架构、质量目标与场景、C4 L1 上下文、组件职责、数据存储、外部依赖、部署拓扑、8 个关键运行时场景索引、核心领域类型速览 |
| `tech_stack.md` | **技术栈约束** —— 各层 MUST / MUST NOT、真实依赖版本、标准命令、SSoT 与 Codegen 约束、关键决策索引 |

### 架构视图

| 文件 | 用途 |
|------|------|
| `container_component_view.md` | **C4 L2/L3** —— 容器清单（Workbench / RPC 网关 / 领域服务 / 适配器 / Injoys / BrowserOS / 存储）、组件级视图（网关、DraftManager、适配器层）、分层依赖规则 |
| `context_view.md` | **上下文与边界** —— C4 L1 业务上下文、参与者、外部系统、In-Scope / Out-of-Scope、技术上下文与"不采用"清单、数据流向与隐私边界 |
| `runtime_view.md` | **运行时视图** —— 8 个架构显著性场景的序列图与决策点（排期导出、创作落盘、草稿预填、URL 回填闭环、指标采集、当前草稿单文件保存、目录切换、会话探测）+ 异常与恢复表 |
| `data_architecture.md` | **数据架构** —— 实体模型（`CalendarItem` / `ContentDraft` / `PlatformMetrics` / 枚举）、双状态机与映射表、本地文件布局、MVP 单份草稿设计、一致性模型、数据字典、数据治理 |

### 接口与安全

| 文件 | 用途 |
|------|------|
| `api_strategy.md` | **接口契约** —— 传输与协议（含 `params` vs `payload` 实现口径差异）、信封规范、**错误码清单**、全部 RPC 方法契约、方法实现状态、安全规范 |
| `security_policy.md` | **安全策略** —— 认证与令牌策略（含明文返回边界）、授权的能力边界模型、加密、**敏感数据处理与会话零外发**、**发布防误触与 9 条契约守卫**、合规现状 |
| `cross_cutting_concepts.md` | **跨切面概念** —— 错误处理与统一错误边界、可观测性与遥测脱敏、缓存隔离、并发与刷新策略、配置与密钥管理、调度、设计令牌、测试隔离 |

### 约束、风险与目标

| 文件 | 用途 |
|------|------|
| `constraints.md` | **约束条件** —— 技术/组织/合规约束、技术标准、SSoT 契约先行、**四条架构铁律**与"绝对禁止的技术引入"清单 |
| `risks_and_debt.md` | **技术风险与技术债务** —— 12 条风险（含风险矩阵与缓解措施）、7 项技术债（含 TD-007「`workbench.overview` 未实现部分缺失汇总语义」，严重性高）、追踪看板 |
| `introduction_and_goals.md` | **介绍与目标** —— 业务驱动力、Top 5 质量目标与取舍取向、6 个质量场景、利益相关者矩阵、阶段范围 |

### 架构决策记录 (ADR)

| 文件 | 决策 |
|------|------|
| `adr_001_unified_browseros_session.md` | 统一 BrowserOS 实例管理会话（**否决**日用 Chrome Cookie 探取：实例不一致 / WAL 不完整 / 隐私落差） |
| `adr_002_prefill_only_human_in_the_loop.md` | 仅预填 + 人工发布 + URL 回填闭环（**彻底移除**自动发布能力） |
| `adr_003_custom_rpc_envelope.md` | 自研 RPC 信封 `POST /api/ops`（非 REST / OpenAPI / gRPC，**无 Codegen**） |
| `adr_004_local_primary_injoys_export.md` | 本地 JSON 为黄金主数据源，Injoys 单向导出 |
| `adr_005_five_state_lifecycle.md` | `ItemStatus` 收敛为五态（**移除** `approved` / `archived`） |
| `adr_006_product_switch_context_only.md` | 产品切换仅切换生成上下文，**不做数据隔离** |
| `adr_007_manual_refresh_no_persistent_connection.md` | 手动刷新 + 局部替换 + in-flight 去重，**无持久连接** |
| `adr_008_version_snapshot_storage.md` | MVP 只保留当前草稿；不提供历史版本与快照（原文件名保留追溯） |

---

## 阅读路径建议

| 场景 | 建议顺序 |
|------|---------|
| **快速了解项目** | `system_design.md` → `context_view.md` → `introduction_and_goals.md` |
| **开始改代码** | `../criterion.md` → `constraints.md` → `tech_stack.md` → `container_component_view.md` |
| **改接口 / 契约** | `../criterion.md` §6–§7 → `api_strategy.md` → `data_architecture.md` |
| **安全评审** | `security_policy.md` → `context_view.md` §数据流向与隐私边界 → `adr_002` |
| **理解某条设计取舍** | `adr_*.md`（8 条决策记录） |
| **排查风险 / 规划工作** | `risks_and_debt.md` |
| **实现具体流程** | `runtime_view.md`（8 个场景时序） |

---

## 关键提示

> ⚠️ **总结与源文档冲突时，以 `source/` 为准。**
> ⚠️ **约束冲突时，以 `../criterion.md` 为准。**
> ⚠️ 源文档**未提供**的信息已如实标注 `N/A – 源文档未提供`，**未编造**内容填充模板。
> 📌 是否已生成见 `../context-manifest.json` 的 `generated_files.architecture`（当前 21 项，`pending_generation.architecture` 已清空）。

> 📌 `deployment_view.md` **未生成**：本项目为宿主内单机插件，无云基础设施 / 容器编排 / CI 环境分层，
> 部署拓扑已并入 `system_design.md` §部署拓扑（源文档无依据支撑独立部署视图，不生成空壳）。
