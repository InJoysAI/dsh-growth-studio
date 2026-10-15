# architecture/ — 架构域资产

> **Metadata**
> - **Source**: `docs/technical_architecture.md`
> - **Generated At**: `2026-10-15 13:17`
> - **Generator**: `Context-Dev-Agent v1.0`

---

## 用途

承载架构层的**权威输入**（`source/`，只读）与派生的架构总结资产。

---

## 内容

| 路径 | 类型 | 说明 |
|------|------|------|
| [`source/technical_architecture.md`](./source/technical_architecture.md) | 源文档（**权威输入**，只读） | 《个人产品增长推广工坊技术架构设计说明书》：5 层架构、宿主 RPC 接口定义、核心数据模型、会话统一实例方案、预填发布闭环、安全治理 |
| `tech_stack.md` 等总结文件 | 派生资产（**尚未生成**） | 由 `/context-openspec` 生成；未生成时不存在 |

> 本项目架构文档由用户显式指定为唯一权威来源；`docs/architecture.md` 不存在，无候选冲突。

---

## 关键结论（供快速定位）

| 主题 | 架构文档位置 |
|------|-------------|
| 分层架构模型（5 层） | §1.1 |
| 插件容器加载与 slot 注入 | §2.1 |
| 宿主 RPC 通信机制与协议封装（`POST /api/ops`） | §2.2 |
| RPC 接口定义（`workbench.*` / `drafts.*` / `browser.*` / `tools.*` / `config.*`） | §3.1–§3.10 |
| 核心数据模型契约（`PlatformId` / `ItemStatus` / `SessionState` / `ContentDraft` / `PlatformMetrics`） | §4.1 |
| 内容生命周期状态机 | §4.2 |
| 统一 BrowserOS 实例方案（废弃 Chrome Cookie 探测） | §5.1 |
| 预填与 Human-in-the-loop 发布闭环（铁律） | §5.2 |
| Injoys 协同与分阶段同步策略 | §5.3 |
| 设计令牌（DSH 视觉对齐） | §5.4 |
| 安全与隐私考量 | §6 |
