# .context — AI 代理长期记忆目录

> **Metadata**
> - **Source**: `docs/product_requirements.md`, `docs/development_plan.md`, `docs/technical_architecture.md`
> - **Generated At**: `2026-10-15 12:19`
> - **Generator**: `Context-Dev-Agent v1.0`

本目录由 `/context-init` 工作流生成，为 AI 代理提供 `dsh-growth-studio`（Growth Studio 个人产品增长推广工坊）的结构化项目上下文。

---

## 入口文件

| 文件 | 说明 |
|------|------|
| [`AGENTS.md`](./AGENTS.md) | **AI 统一入口** — 打开此文件即可了解上下文全貌 |
| [`criterion.md`](./criterion.md) | **项目准则** — 技术约束、安全铁律、接口契约（约束权威来源） |
| [`context-manifest.json`](./context-manifest.json) | 元数据清单 — 源文件路径、SHA-256 与生成资产登记 |

---

## 目录导航

### `architecture/` — 架构上下文
- [`source/technical_architecture.md`](./architecture/source/technical_architecture.md) — **权威架构设计文档**：Cordis 全插件式微内核分层架构、宿主 RPC 协议、核心数据模型、BrowserOS 统一实例方案与安全治理。

### `domain/` — 业务领域上下文
- [`source/product_requirements.md`](./domain/source/product_requirements.md) — **主 PRD**：产品愿景、用户画像、功能架构全景、六模块详细规格与四阶段里程碑。
- [`source/development_plan.md`](./domain/source/development_plan.md) — 开发与落地计划：实现基线状态矩阵、四阶段任务拆解、核心数据模型更新与工程防线。

### `db/` — 数据层上下文
- 本目录仅含占位说明。项目无关系型数据库，持久化为本地 JSON 文件存储。

### `ui/` — UI 设计规范上下文
- 本目录仅含占位说明。UI 规范内嵌于 PRD §六 与架构文档 §5.4。

### `legacy/` — 遗留系统上下文
- 本目录仅含占位说明。本项目为全新插件实现，无遗留代码库。

### `openspec/` — OpenSpec Context 资产
- 由 `.agent/workflows/context-openspec.md` 生成（domain / architecture / db / ui 总结、`openspec/config.yaml`、`openspec/proposal-roadmap.md`）。

---

## ⚠️ 只读约定

`*/source/` 目录中的文件是从 `docs/` **原样复制**的权威来源快照，请谨慎修改。源文档更新后应通过 `.agent/workflows/context-update.md` 重新归档，而非直接编辑归档副本。

---

## 常用命令

| 命令 | 用途 |
|------|------|
| `.agent/workflows/context-init.md` | 初始化 `.context/` 目录 |
| `.agent/workflows/context-update.md` | 增量更新（源文档变更后） |
| `.agent/workflows/context-check.md` | 检查工具链与 MCP |
| `.agent/workflows/context-openspec.md` | 生成分域总结 + OpenSpec 集成 |
| `.agent/workflows/context-start.md` | 基于提案开始开发 |
