# .context/architecture/ — 架构上下文

> **Metadata**
> - **Source**: `docs/technical_architecture.md`
> - **Generated At**: `2026-10-15 20:23`
> - **Generator**: `Context-Dev-Agent v1.0`

---

## 源文档（只读，权威技术输入）

| 文件 | 内容概要 |
|------|---------|
| `source/technical_architecture.md` | 技术架构设计说明书：5 层架构（客户端视图层 / 宿主 RPC 网关层 / 业务领域服务层 / 外部 MCP 集成层 / 本地持久化基础设施层）、`POST /api/ops` RPC 信封契约、领域实体、统一 BrowserOS 实例方案、仅预填的人机协同发布闭环、Injoys 分阶段同步策略、设计令牌约束与安全治理 |

> 本项目 `docs/` 下**没有** `docs/architecture.md`；上述文件为唯一权威架构输入。

---

## 待生成总结（由 `.agent/workflows/context-openspec.md` 生成）

| 文件 | 状态 | 用途 |
|------|:----:|------|
| `system_design.md` | ⏳ 待生成 | 系统设计：微内核分层、RPC 网关、领域服务聚合 |
| `tech_stack.md` | ⏳ 待生成 | 技术栈约束（TypeScript / Cordis 4.x / React 18 / esbuild / vitest） |
| `security_policy.md` | 按需 | 安全策略：仅预填铁律、会话零外发、令牌与日志脱敏 |
| `data_architecture.md` | 按需 | 本地 JSON 主数据 + Injoys 单向导出/导入 |
| `api_strategy.md` / `container_component_view.md` / `runtime_view.md` / `deployment_view.md` / `context_view.md` / `cross_cutting_concepts.md` / `introduction_and_goals.md` / `constraints.md` / `risks_and_debt.md` / `adr_template.md` | 按需 | 其余架构视图与决策记录 |

> 是否生成见 `../context-manifest.json` 的 `generated_files.architecture` 与 `pending_generation.architecture`。
