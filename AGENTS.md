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

1. 严禁任何自动点击最终确认发布的行为，`ops_publish_now` 已彻底移除，不得以任何形式重新引入。（criterion §4）
2. 预填止步于平台原生「保存为草稿」，不得触发或越过正式发布步骤。（criterion §4）
3. `published` 只能经 `drafts.updatePublishUrl` 回填合法 http(s) URL（须用 URL 解析器校验）后写入；`drafts.save` 必须拒绝 `published` 且忽略传入的 `publishedUrls`；多渠道草稿仅在全部渠道回填有效 URL 后才整体 `published`，渠道集合变化须重算状态；回填渠道必须属于该草稿。（criterion §4）
4. 禁止将会话数据（Cookie）向任何第三方服务上报，会话在本地沙箱运行。（criterion §4）
5. 采集失败或平台不支持的指标必须为 `null`，不得按 0 或估算值伪造填充；应采平台未全部成功时汇总值为 `null`，真实零值 `0` 与缺失严格区分。（criterion §4）
6. 禁止硬编码密钥 / 令牌 / 敏感配置，令牌仅允许来自用户配置或环境变量回退，日志必须脱敏。（criterion §4）
7. 宿主侧禁止内置全局通用 Master Key 或任何形式的通用凭据。（criterion §3.2）
8. 禁止虚报成功（无客户端或执行失败时严禁返回成功）。（criterion §3.2）
9. 客户端禁止绕过 `callOpsRpc` 直连 Injoys、BrowserOS 或任何外部服务。（criterion §3.1）
10. 客户端禁止硬编码色值，必须使用 DSH 设计令牌 `var(--dsw-alias-*)`。（criterion §3.1）
11. 禁止绕过 `config-store` / `draft-store` 模块直接操作配置文件或草稿文件。（criterion §3.5）
12. 草稿目录须在单次操作内固定（含跨 `await` 的复合 RPC，不得中途重新解析）；写入前须准备**并验证可写**；存储失败统一返回 `drafts/storage-unavailable`；`config.save` 改目录须先校验，不得先报成功后由 `drafts.save` 报 ENOENT。（criterion §3.2/§3.5）
13. 禁止让测试写入开发者真实 `$DSH_HOME`（`ConfigStore` 会回退到真实主目录）：隔离须在测试文件**被导入/收集前**生效（模块作用域赋值，不得放 `beforeAll`——否则 describe 捕获的未隔离值会被 `afterEach` 恢复）。每个写配置的用例使用独立 `DSH_HOME` 或显式 `profileContext.home`。（criterion §3.5）
14. Phase 0 禁止引入 WebSocket / SSE 持久连接或后台定时轮询；刷新由用户手动触发、局部替换并做并发去重。（criterion §3.4）

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
