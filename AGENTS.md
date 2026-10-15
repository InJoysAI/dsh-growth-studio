# dsh-growth-studio

<!-- CONTEXT-DEV:START -->
## AI 入口（由 `/context-init` 生成，仅此区块可被工具自动更新）

### 开始工作前必读（按顺序）

1. `.context/criterion.md` — 项目准则：MUST / MUST NOT、技术栈约束、SSoT 工具链与 Codegen（**约束权威来源**）
2. `.context/AGENTS.md` — Context 目录说明与资产索引
3. `.context/context-manifest.json` — 源文档与已生成资产的当前状态

按需阅读：
- `.context/*/source/` — 原始 PRD / 架构等源文档（细节以此为准，只读）
- `.context/architecture/`、`.context/domain/`、`.context/db/`、`.context/ui/` 下的总结文件（是否已生成见 manifest 的 `generated_files`）

### 关键禁止项（摘自 `.context/criterion.md`，仅为提醒，**以 criterion.md 为准**）

1. 严禁任何自动点击最终确认发布的行为，`ops_publish_now` 已彻底移除。（criterion §4）
2. 预填止步于平台原生「保存为草稿」，不得触发或越过正式发布步骤。（criterion §4）
3. 采集失败或平台不支持的指标必须为 `null`，不得按 0 或估算值伪造填充。（criterion §4）
4. 禁止硬编码密钥 / 令牌 / 敏感配置，日志必须脱敏。（criterion §4）
5. 禁止将会话数据（Cookie）向任何第三方服务上报，会话在本地沙箱运行。（criterion §4）
6. 客户端禁止绕过 `callOpsRpc` 直连 Injoys、BrowserOS 或任何外部服务。（criterion §3.1）
7. 客户端禁止硬编码色值，必须使用 DSH 设计令牌 `var(--dsw-alias-*)`。（criterion §3.1）
8. 宿主侧禁止内置全局通用 Master Key。（criterion §3.2）
9. 禁止绕过 `config-store` / `draft-store` 模块直接操作配置文件或草稿文件。（criterion §3.5）

> 本节由工具根据 `criterion.md` 自动生成/刷新，不要手工修改；完整约束见 `.context/criterion.md`。

### OpenSpec 目录（由 `/context-openspec` 生成，未生成时可能不存在）

- `openspec/config.yaml` — 从 `.context/` 派生的项目上下文快照（不要手工修改）
- `openspec/proposal-roadmap.md` — 提案路线图
- `openspec/changes/` — 进行中的变更提案
- `openspec/specs/` — 当前规范

若这些文件不存在，说明还没有运行 `.agent/workflows/context-openspec.md`。

### 工作流命令（`.agent/workflows/`）

| 命令 | 用途 |
|------|------|
| `.agent/workflows/context-init.md` | 初始化 Context（归档源文档、生成准则、初始化 SSoT） |
| `.agent/workflows/context-openspec.md` | 生成 Context 总结、`config.yaml`、`proposal-roadmap.md` |
| `.agent/workflows/context-openspec.md proposal <change-id> [roadmap-doc]` | 创建并校验变更提案 |
| `.agent/workflows/context-start.md` | 按提案实施并归档 |
| `.agent/workflows/context-check.md` | 检查环境 / Manifest / 任务 / 提案 / 路线图等 |
| `.agent/workflows/context-update.md` | 维护 Context（源文档变更后同步） |
| `.agent/workflows/context-interview.md` | 交互式访谈以补全源文档信息 |

### 规则

- 功能变更先创建提案（`.agent/workflows/context-openspec.md proposal <change-id>`），再实施。
- 数据层 / API / IPC 变更：先改 `.context/criterion.md` §7.1 中对应层的契约，再运行 §7.2 记录的生成与校验命令。
- 不要手工修改 `.context/*/source/`、`openspec/config.yaml` 和 `design/context-dev/`；源文档变更请走 `context-update`。
- 约束冲突时以 `.context/criterion.md` 为准。
<!-- CONTEXT-DEV:END -->
