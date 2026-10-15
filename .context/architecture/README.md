# architecture/ — 架构上下文

> **Metadata**
> - **Source**: `docs/technical_architecture.md`
> - **Generated At**: `2026-10-15 12:19`
> - **Generator**: `Context-Dev-Agent v1.0`

---

## 权威源文档

| 文件 | 说明 |
|------|------|
| [`source/technical_architecture.md`](./source/technical_architecture.md) | **权威架构设计文档**（用户指定）：`个人产品增长推广工坊（Growth Studio / dsh-growth-studio）技术架构设计说明书` |

---

## 快速索引

| 章节 | 内容 |
|------|------|
| §1.1 | 五层架构模型：客户端视图层 → 宿主 RPC 协议网关层 → 业务领域服务层 → 外部 MCP 驱动中台层 → 本地持久化基础设施层 |
| §2.1 | DSH Desktop 插件容器加载机制（Cordis `slots` / `settings.section` 槽位注入，`order: 60`） |
| §2.2 | 宿主 RPC 通信机制与协议封装（`POST /api/ops`，`RpcEnvelope` 信封） |
| §3.1–3.10 | 宿主 RPC 接口定义：`workbench.*` / `drafts.*` / `browser.sessions` / `tools.*` / `config.*` |
| §4.1 | 核心数据模型契约：`PlatformId` / `ContentKind` / `ItemStatus` / `SessionState` / `ContentDraft` / `PlatformMetrics` |
| §4.2 | 内容生命周期状态机（Planned → Drafting → DraftReady → Prefilled → Approved → Published → Archived） |
| §5.1 | 会话管理与统一 BrowserOS 实例方案（含原 Chrome SQLite 探测方案的缺陷分析） |
| §5.2 | 草稿箱预填与 Human-in-the-Loop 发布闭环（铁律：始终仅预填） |
| §5.3 | Injoys 资产协同与分阶段同步策略（Phase 0 单向导出 → Phase 3 双向同步） |
| §5.4 | 响应式设计系统与 DSH 视觉令牌对齐（`var(--dsw-alias-*)`） |
| §六 | 安全与隐私考量（凭证隔离、会话数据零外发、分发防误触） |

---

## 待生成资产

以下架构侧汇总资产将由 `.agent/workflows/context-openspec.md` 生成：

- `tech_stack.md` — 技术栈约束 (MUST/SHOULD)
- `system_design.md` — 系统设计汇总
- `security_policy.md` — 安全策略汇总

> ⚠️ `source/` 中的文件为权威只读快照，请勿直接编辑。
