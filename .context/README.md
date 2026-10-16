# .context/ — 项目长期记忆目录

> **Metadata**
> - **Source**: `docs/product_requirements.md`, `docs/development_plan.md`, `docs/technical_architecture.md`
> - **Generated At**: `2026-10-15 20:23`
> - **Updated At**: `2026-10-16 11:53`
> - **Generator**: `Context-Dev-Agent v1.0`

> **用途**: 为 AI 代理提供 `dsh-growth-studio`（Growth Studio）项目的结构化上下文资产。
> **权威性**: 工程约束以 `criterion.md` 为准；源文档细节以各 `source/` 归档副本为准。

---

## 资产索引

| 文件 / 目录 | 作用 |
|------|------|
| `criterion.md` | **项目准则**：MUST / MUST NOT、技术栈约束、SSoT 工具链与 Codegen（约束权威来源） |
| `AGENTS.md` | Context 目录说明与资产索引（AI 统一入口） |
| `context-manifest.json` | 元数据清单：源文件 hash、生成资产、待生成资产 |
| `domain/source/product_requirements.md` | PRD 源文档（只读，权威细节） |
| `domain/source/development_plan.md` | 开发与落地计划源文档（只读，含实现基线状态矩阵） |
| `architecture/source/technical_architecture.md` | 技术架构设计说明书源文档（只读，权威技术输入） |
| `openspec/integration.md` | OpenSpec 集成说明与 Context 资产索引（`CONTEXT_ASSET_INDEX`） |
| `history/context-sync.jsonl` | 同步/决策审计日志（首次 `context-update sync` 时创建） |

---

## 目录说明

- `*/source/` 目录中的文件为**源文档权威副本，只读**；源文档变更请走 `.agent/workflows/context-update.md`，不要直接改归档副本。
- 分域总结文件（`architecture/system_design.md`、`domain/business_rules.md` 等）由 `.agent/workflows/context-openspec.md` 生成，是否已生成见 `context-manifest.json` 的 `generated_files` 与 `pending_generation`。
- 本项目当前**未提供** DB Schema / UI 规范 / 遗留代码库文档，因此未创建 `db/`、`ui/`、`legacy/` 目录；后续补充文档时由 `context-update` 创建。

---

## 更新方式

| 场景 | 命令 |
|------|------|
| 源文档变更后同步 | `.agent/workflows/context-update.md` |
| 生成分域总结 + OpenSpec 集成 | `.agent/workflows/context-openspec.md` |
| 全量重生成 | 删除 `context-manifest.json` 后重新运行 `.agent/workflows/context-init.md` |


## 最新 MVP 裁决（2026-10-16）

内容生成只保存本地，写入 Injoys 文档须用户明确触发。MVP 只保留当前草稿，不提供历史查看、恢复或草稿版本快照；并发版本号和指标历史保留。详见 `criterion.md` §3.5 / §4、`architecture/adr_008_version_snapshot_storage.md`。此次只同步文档，实现须另行核查。
