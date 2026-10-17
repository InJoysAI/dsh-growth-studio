# dsh-growth-studio Context v1.0

> **Metadata**
> - **Source**: `design/context-dev/templates/context-agents.md.template`
> - **Generated At**: `2026-10-15 20:23`
> - **Updated At**: `2026-10-17 12:54`
> - **Generator**: `Context-Dev-Agent v1.0`

---

## 🚀 AI 入口说明

> **⚠️ 重要**: 本文件是 **AI 编辑工具的统一入口**。
>
> 当你（AI）打开此文件，意味着你正在进入一个已初始化的项目上下文。
>
> **执行前必读**:
> 1. `criterion.md` — 项目准则，包含必须遵守的技术约束
> 2. `context-manifest.json` — 了解当前源文件和生成状态
>
> **可用命令**: 见下方 [相关命令](#相关命令) 表格

---

## 目录说明

`.context/` 是 AI 代理的"长期记忆"目录，包含项目的结构化上下文资产。

## 目录结构

<!-- CONTEXT-TREE:START 由 `context-manifest.json#generated_files` 工具化生成，勿手工编辑 -->
```text
.context/
├── README.md
├── AGENTS.md
├── criterion.md
├── context-manifest.json
├── architecture/
│   ├── README.md
│   ├── system_design.md
│   ├── tech_stack.md
│   ├── security_policy.md
│   ├── risks_and_debt.md
│   ├── api_strategy.md
│   ├── data_architecture.md
│   ├── runtime_view.md
│   ├── cross_cutting_concepts.md
│   ├── introduction_and_goals.md
│   ├── constraints.md
│   ├── context_view.md
│   ├── container_component_view.md
│   ├── adr_001_unified_browseros_session.md
│   ├── adr_002_prefill_only_human_in_the_loop.md
│   ├── adr_003_custom_rpc_envelope.md
│   ├── adr_004_local_primary_injoys_export.md
│   ├── adr_005_five_state_lifecycle.md
│   ├── adr_006_product_switch_context_only.md
│   ├── adr_007_manual_refresh_no_persistent_connection.md
│   ├── adr_008_version_snapshot_storage.md
│   ├── adr_009_browseros_capability_management.md
│   └── source/
│       └── technical_architecture.md
├── domain/
│   ├── README.md
│   ├── business_rules.md
│   ├── user_journeys.md
│   ├── market_insights.md
│   ├── testing_strategy.md
│   ├── risks_and_debt.md
│   ├── data_strategy.md
│   ├── edge_cases.md
│   └── source/
│       ├── product_requirements.md
│       └── development_plan.md
├── openspec/
│   └── integration.md
└── history/
    └── context-sync.jsonl
```
<!-- CONTEXT-TREE:END -->

本目录树按 `context-manifest.json#generated_files`、实际 `source/` 文件及 `context_sync_history.path` 生成；审计日志不属于生成资产，精确机器清单仍以 Manifest 为准。

> 尚未创建的类别（`db/`、`ui/`、`legacy/`）说明项目未提供对应源文档，补充后由 `.agent/workflows/context-update.md` 创建。
> 分域总结文件 `domain/**`（8 个）、`architecture/**`（22 个，含 `system_design.md` 与 `tech_stack.md`）与 `.context/openspec/integration.md` 均已生成；项目根目录 `openspec/config.yaml` 已由 `.agent/workflows/context-openspec.md project` 生成（`.context/` 权威资产的只读派生快照，指纹见 Manifest `last_openspec_project`），`pending_generation` 现为 `{}`（已全部生成）。

## 核心文件

| 文件 | 用途 |
|------|------|
| `criterion.md` | 项目准则 — AI 必须遵守的工程约束（MUST / MUST NOT、SSoT 工具链与 Codegen） |
| `context-manifest.json` | 元数据清单 — 追踪源文件 hash 和生成时间 |
| `history/context-sync.jsonl` | 扁平同步/决策审计日志；默认不作为生成资产加载（已创建，持续追加） |
| `architecture/tech_stack.md` | 技术栈约束 (MUST/SHOULD) — ✅ 已生成 |
| `architecture/system_design.md` | 系统设计总结 — ✅ 已生成 |
| `domain/business_rules.md` | 业务逻辑规则 — ✅ 已生成 |
| `domain/user_journeys.md` | 用户旅程 — ✅ 已生成 |
| `domain/market_insights.md` | 市场洞察 — ✅ 已生成 |
| `domain/testing_strategy.md` | 验收测试策略 — ✅ 已生成 |
| `domain/risks_and_debt.md` | 业务风险与项目债务 — ✅ 已生成 |
| `domain/data_strategy.md` | 数据策略 — ✅ 已生成 |
| `domain/edge_cases.md` | 异常与边缘情况 — ✅ 已生成 |
| `openspec/integration.md` | OpenSpec 集成说明与资产索引 — ✅ 已生成 |

## 最新 MVP 裁决

2026-10-16：生成只保存本地，物料沉淀须用户明确触发；草稿只保留当前内容，不提供历史查看、恢复或版本快照。并发控制与指标历史保留。详见 `criterion.md` §3.5 / §4 和 `architecture/adr_008_version_snapshot_storage.md`；本轮只同步文档，不代表实现已对齐。

## 更新规则

- **增量更新**: 使用 `.agent/workflows/context-update.md` 重生成变更文件
- **新增源文档**: 使用 `.agent/workflows/context-update.md` 添加新源文件
- **全量重生成**: 删除 `context-manifest.json` 后重新运行 `.agent/workflows/context-init.md`
- **历史边界**: Manifest 只保留最近同步状态；完整历史追加到 `history/context-sync.jsonl`，禁止 `previous_sync` 递归链

## 与 OpenSpec 集成

- `.context/` 提供项目约束和业务规则
- `openspec/` 管理变更提案和任务追踪
- AI 在创建提案时必须读取 `.context/criterion.md`

## 相关命令

| 命令 | 用途 |
|------|------|
| `.agent/workflows/context-init.md` | 初始化 .context/ 目录 |
| `.agent/workflows/context-check.md` | 检查环境 / Manifest / 任务 / 提案 / 路线图 / 项目配置 / 一致性评审 |
| `.agent/workflows/context-openspec.md` | 生成 context 总结 + OpenSpec 集成 |
| `.agent/workflows/context-openspec.md proposal <change-id> [roadmap-doc]` | 生成变更提案（可显式指定提案大纲/路线图文件） |
| `.agent/workflows/context-start.md` | 基于提案开始开发 |
| `.agent/workflows/context-update.md` | 增量更新 context |
| `.agent/workflows/context-interview.md` | 交互式访谈以补全源文档信息 |
