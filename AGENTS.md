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

1. 严禁自动确认发布。`ops_publish_now` 已从工具白名单、RPC 端点与文档中彻底移除，不得以任何形式重新引入。（criterion §3.2、§4）
2. 禁止将会话数据（Cookie）向任何第三方服务上报。（criterion §4）
3. 禁止硬编码 Injoys Token、BrowserOS 凭证或任何敏感配置。（criterion §3.1、§4）
4. 宿主侧禁止内置全局通用 Master Key 或任何形式的通用凭据。（criterion §3.2）
5. 禁止绕过 BrowserOS 能力开关与统一执行检查，直接调用底层浏览器工具。（criterion §4）
6. 禁止将敏感策略 / 令牌下发到客户端。（criterion §3.4）
7. 客户端禁止绕过 `callOpsRpc` 直连 Injoys / BrowserOS MCP 或任何外部服务。（criterion §3.1）
8. 禁止虚报成功（无客户端或执行失败时严禁返回成功）。（criterion §3.2）
9. 禁止伪造 / 硬编码指标数据（无法获取的字段必须为 `null`）。（criterion §3.2）
10. 禁止绕过 `config-store` / `draft-store` 模块直接操作配置文件或草稿文件。（criterion §3.5）
11. 禁止在无锁情况下并发回写同一草稿文件。（criterion §3.5）
12. 禁止在单次操作中途重新解析 `draftsDir`。（criterion §3.5）
13. 禁止先让 `config.save` 报告成功、再由后续 `drafts.save` 以 `ENOENT` 失败。（criterion §3.5）
14. 禁止让测试写入开发者真实 `$DSH_HOME`。（criterion §3.5）
15. 禁止用宽松正则（回填 URL 的合法性须用 URL 解析器校验）。（criterion §4）

> 另有 5 条禁止项未在此列出，见 criterion §3.1、§3.3、§3.4：在客户端承载核心业务规则；硬编码色值；包含业务黑盒逻辑或本地伪造数据；引入外部常驻服务端或额外网络监听端口；在 Phase 0 引入 WebSocket / SSE 持久连接或后台定时轮询。
>
> 计数口径（可复现）：§3.1–§3.5 的 `MUST NOT` bullet 共 **18** 条；§4 安全约束中含「禁止 / 严禁 / 禁用 / 铁律」措辞的 bullet 共 **5** 条（密钥硬编码、Cookie 零外发、严禁自动发布、禁止宽松正则、禁止绕过能力开关/统一检查）；跨章节重复的 3 条按「保留更完整表述、来源写全」合并（§3.1↔§4 硬编码凭证、§3.1↔§3.3 硬编码色值、§3.2↔§4 自动发布），去重后合计 **20** 条，按「安全 / 不可逆 / 数据损失优先，其余按出现顺序」取前 15 条。

> 本节由工具根据 `criterion.md` 自动生成/刷新，不要手工修改；完整约束见 `.context/criterion.md`。

### OpenSpec 目录（由 `/context-openspec` 生成，未生成时可能不存在）

- `openspec/config.yaml` — 从 `.context/` 派生的项目上下文快照（不要手工修改）
- `openspec/proposal-roadmap.md` — 提案路线图
- `openspec/changes/` — 进行中的变更提案
- `openspec/specs/` — 当前规范

若其中部分文件不存在，请以 `.context/context-manifest.json` 的 `pending_generation` 判断各阶段状态：分域总结与 `.context/openspec/integration.md` 可能已生成，此时通常仅缺 `openspec/config.yaml`、`openspec/proposal-roadmap.md`（分别由 `.agent/workflows/context-openspec.md project` 与 `plan` 子命令生成）。

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
