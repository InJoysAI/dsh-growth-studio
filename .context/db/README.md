# db/ — 数据层上下文

> **Metadata**
> - **Source**: `docs/technical_architecture.md`, `docs/development_plan.md`
> - **Generated At**: `2026-10-15 12:19`
> - **Generator**: `Context-Dev-Agent v1.0`

---

## ⏩ 未提供 DB Schema 设计文档

本项目**不使用关系型数据库**，因此 `source/` 目录为空，无 DB 源文档需要归档。

---

## 数据持久化事实（替代说明）

数据层契约内嵌于架构文档与源码，而非独立 DB Schema 文档：

| 项 | 事实 |
|----|------|
| 存储类型 | 本地 JSON 文件存储（无 SQL / 无 ORM / 无迁移文件） |
| 草稿库路径 | `$DSH_HOME/growth-studio/drafts/{id}.json` |
| 配置路径 | `$DSH_HOME/ops-manager/config.json` |
| 类型事实源 | `src/types.ts`（`ContentDraft` / `PlatformMetrics` / `CalendarItem` 等） |
| 并发控制 | 版本自增（`version`）+ `expectedVersion` 乐观锁 + 原子写入 + 串行写锁 |
| 远端资产 | Injoys Spreadsheet（排期表）与 Injoys Document（图文文档）经 MCP 调用，非本地 DB |

### 参考章节

- 架构文档 §1.1（本地运行与持久化基础设施层）
- 架构文档 §4.1（核心数据模型契约）
- 架构文档 §5.3（Injoys 资产协同与分阶段同步策略）
- 开发计划 §4.2（本地草稿实体 `ContentDraft`）

---

## 待生成资产

`schema_design.md` 将由 `.agent/workflows/context-openspec.md` 生成（内容将基于上述本地 JSON 契约，而非 DB Schema）。
