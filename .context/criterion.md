# 项目准则 (Project Criterion)

> **Metadata**
> - **Source**: `docs/product_requirements.md`, `docs/development_plan.md`, `docs/technical_architecture.md`
> - **Generated At**: `2026-10-15 20:23`
> - **Generator**: `Context-Dev-Agent v1.0`

> **用途**: 定义 AI 代理必须遵守的工程约束和技术规范。
> **权威性**: 本文件是项目约束的**权威来源**（见 §8）。

---

## 1. 仓库结构约束

```text
dsh-growth-studio/
├── src/                         # 插件宿主侧核心逻辑（TypeScript，tsc 编译至 lib/）
│   ├── adapters/                # 平台适配器注册表（AdapterRegistry，8 平台）
│   ├── analytics/               # 指标采集与复盘报告（MetricsCollector / ReviewReporter）
│   ├── browser/                 # BrowserOS 驱动与会话哨兵（BrowserDriver / SessionGuard / browseros-bridge）
│   ├── feedback/                # 评论抓取与需求提炼（CommentsCrawler / IssueExtractor / TrendsDiscoverer）
│   ├── injoys/                  # Injoys MCP 客户端代理（JSON-RPC 2.0 / HTTP）
│   ├── international/           # 出海增长与时区策略（OverseasStrategyManager）
│   ├── schedule/                # DSH 自动化任务注册（schedule-bridge）
│   ├── storage/                 # 本地草稿持久化（DraftStore）
│   ├── tools/                   # 运营工具注册中心（ops_* 工具契约）
│   ├── config-store.ts          # 配置读写（$DSH_HOME/ops-manager/config.json）
│   ├── ops-rpc.ts               # 宿主 RPC 网关与方法分发（POST /api/ops）
│   ├── types.ts                 # 领域实体与契约类型定义
│   └── index.ts                 # 插件入口（Cordis apply）
├── plugin-src/
│   ├── client/                  # 客户端源码（esbuild 打包为 window.__ModuleLoader__ 模块）
│   │   ├── build.mjs            # 客户端构建脚本
│   │   ├── index.js             # 客户端插件入口（settings.section 槽位注入）
│   │   ├── ops-page.js          # Ops Workbench 工作台界面（React 18）
│   │   └── ops-styles.js        # 工作台样式（DSH 设计令牌对齐）
│   └── management-rpc.mjs       # 客户端 RPC 封装（callOpsRpc / unwrapRpcResult）
├── lib/                         # tsc 与 esbuild 构建产物（勿手工编辑）
├── locale/                      # 国际化文案
├── tests/                       # vitest 测试
├── scripts/                     # 校验脚本（check-patch.mts / verify-live-metrics.mts）
├── design/context-dev/          # Context 工程化工具链（本文件所在体系）
├── docs/                        # 需求/架构/计划文档（源文档只读）
└── .context/                    # AI 代理长期记忆目录
```

---

## 2. 三维约束体系

| 维度 | 工具 | 约束规则 |
|------|------|---------|
| **需求层** | OpenSpec | 功能变更必须先创建并评审提案；具体命令和文件格式由 OpenSpec 工作流定义 |
| **数据层** | 未启用（本地 JSON 文件存储，非关系型数据库） | 项目无 SQL / 关系型数据库 / ORM / 迁移文件。草稿主数据以 JSON 落盘 `$DSH_HOME/growth-studio/drafts/{id}.json`，契约以 `src/types.ts` 类型为准（见 §7.3） |
| **API 层** | 启用，工具 = 手写 TypeScript 契约（宿主 RPC 信封） | 契约入口 `src/ops-rpc.ts` + `src/types.ts`；协议为自研 `POST /api/ops` RPC 信封（非 OpenAPI/TypeSpec），变更须先改契约、并保持信封结构与既有方法向后兼容 |
| **IPC 层（可选）** | 未启用 | 本插件为 DSH 宿主内进程（in-process Cordis 插件），非独立桌面端进程，无跨语言 IPC 边界；客户端与宿主经 `POST /api/ops` HTTP RPC 通信 |
| **共享层（可选）** | 未启用 | 无 API / IPC 双层，无独立共享模型目录 |

---

## 3. 技术栈强制约束

### 3.1 客户端（DSH Desktop 客户端插件，web 平台）

```yaml
Type: DSH Desktop Client Plugin（Cordis 槽位注入扩展）
Language: JavaScript（ESM，源码 plugin-src/client/）
Framework: React 18 + esbuild 打包
Location: plugin-src/client/
```

MUST:
  - 按架构文档 §2.1 的 Cordis 扩展机制封装为 `window.__ModuleLoader__.load(...)` 模块（当前实现：`id: 'dsh-growth-studio'`，`inject` 声明 `@deepseek-ai/dsh-client-connection` 与 `@deepseek-ai/dsh-client-ui-settings`）
  - 在 `settings.section` 槽位注入，`id: 'ops'`，`order: 60`（置于 Jet Hub 之后）
  - 全部数据经统一 RPC 封装 `callOpsRpc`（`POST /api/ops`）获取，不直连任何外部服务
  - 样式必须使用 DSH 主题令牌（`var(--dsw-alias-*)`）：背景层级、边框层级、文字阶梯一律走令牌

MUST NOT:
  - 硬编码 Injoys Token、BrowserOS 凭证或任何敏感配置
  - 绕过 `callOpsRpc` 直连 Injoys / BrowserOS MCP 或任何外部服务
  - 硬编码背景 / 边框 / 文字色值（交互点缀色按架构文档 §5.4 指定值：主操作蓝 `#1677ff`、安全绿 `#15803d`、告警橙 `#b45309`、活力紫 `#7c3aed`）
  - 在客户端承载核心业务规则（状态机、权限判定须在宿主侧）

### 3.2 插件宿主核心层（Node.js / TypeScript）

```yaml
Structure:
  - src/index.ts:       Cordis 插件入口与能力注册（tools / systemPrompt / connection）
  - src/ops-rpc.ts:     宿主 RPC 入口层（入参校验、方法路由、响应封装）
  - src/config-store.ts: 本地配置读写（$DSH_HOME/ops-manager/config.json）
  - src/types.ts:       领域实体与契约类型定义
  - src/adapters/:      平台适配器（Adapter Pattern，按平台解耦）
  - src/injoys/:        Injoys MCP 客户端代理（JSON-RPC 2.0 / HTTP）
  - src/browser/:       BrowserOS 驱动与会话哨兵
```

MUST:
  - 所有 RPC 方法必须返回统一信封 `{ ok, result?, error? }`，失败必须如实抛出错误码与信息
  - 平台差异一律收敛到 Adapter 层，禁止在通用流程中写平台分支
  - Injoys 与 BrowserOS 调用必须集中在各自客户端封装入口
  - 错误不得吞没（开发计划 §二 基线要求：错误不吞，如实抛出）
  - 配置热更新须实时生效并传给 `InjoysClient`（`updateConfig`）
  - 会话探测、预填执行、指标采集必须统一由**同一个** BrowserOS MCP 实例调度

MUST NOT:
  - 内置全局通用 Master Key 或任何形式的通用凭据（架构文档 §6.1 凭证隔离）
  - 虚报成功（无客户端或执行失败时严禁返回成功）
  - 伪造 / 硬编码指标数据（无法获取的字段必须为 `null`）
  - 在插件内实现自动点击平台「正式发布 / 群发」按钮的能力

### 3.3 前端工程约束（工作台 UI）

```yaml
Framework: React 18
Location: plugin-src/client/
Styling: 自定义样式模块 ops-styles.js，深度对齐 DSH 设计令牌
Tabs: 6 大业务 Tab（运营驾驶舱 / 排期日历流水 / 内容创作室 / AI工具中枢 / 舆情需求大盘 / 引擎策略配置）
```

MUST:
  - 只调用统一 RPC 封装，不手写外部 `fetch`
  - 状态域与字段命名约定统一（`loading` / `error` / `data`）
  - 指标为 `null` 时展示为「暂无数据」语义，不得显示为 0
  - 未登录平台一律提供 **`去登录 ↗`** 快捷外链（零阻碍操作原则）
  - 卡片支持即时刷新，不强制重载页面

MUST NOT:
  - 硬编码色值（必须使用 `var(--dsw-alias-*)`）
  - 包含业务黑盒逻辑或本地伪造数据

### 3.4 服务端

```yaml
Language: 无独立服务端（DSH 宿主内进程 Cordis 插件）
Framework: Cordis 4.x（@deepseek-ai/cordis）
Location: src/
```

MUST:
  - 遵循分层架构：客户端视图层 → 宿主 RPC 网关层 → 业务领域服务层 → 外部 MCP 集成层 → 本地持久化基础设施层
  - RPC 接口演进须向后兼容，或按版本显式升级
  - 数据刷新遵循架构文档 §5.5：Phase 0 由用户手动触发 RPC 刷新并做局部状态替换，同一卡片并发刷新须做 in-flight 去重

MUST NOT:
  - 引入外部常驻服务端或额外网络监听端口
  - 将敏感策略 / 令牌下发到客户端
  - 在 Phase 0 引入 WebSocket / SSE 持久连接或后台定时轮询（须先在架构文档补齐连接生命周期、断线重连与令牌校验方案）

### 3.5 数据持久化

```yaml
Type: 本地 JSON 文件存储（无数据库）
Path:
  - 草稿库: $DSH_HOME/growth-studio/drafts/{id}.json
  - 配置:   $DSH_HOME/ops-manager/config.json
Structure: ContentDraft / PlatformMetrics / CalendarItem（见 §5.5 与架构文档 §4.1）
```

MUST:
  - 原子写入（临时文件 + rename）+ 串行写锁保护内部回写
  - 版本自增（`version`）与 `expectedVersion` 乐观锁并发控制
  - 系统文件权限仅限当前操作系统用户
  - 文件路径统一经 `resolveDshHome` 解析（`profileContext.home` → `DSH_HOME` → `~/.dsh` 回退）

MUST NOT:
  - 绕过 `config-store` / `draft-store` 模块直接操作配置文件或草稿文件
  - 在无锁情况下并发回写同一草稿文件

---

## 4. 安全约束

- **认证方式**: Injoys MCP 使用 `Authorization: Bearer {token}`；平台登录态由 BrowserOS 实例自身的用户 Profile 承载
- **密钥管理**: 禁止硬编码；令牌仅允许来自用户配置或环境变量回退（`INJOYS_MCP_ENDPOINT` / `INJOYS_MCP_TOKEN`）；前端支持显隐切换；日志必须脱敏
- **网络要求**: HTTPS 强制；Injoys 调用须校验 HTTP 状态码与 `result.isError`
- **最小权限**: BrowserOS 驱动仅允许 `tabs / navigate / snapshot / act` 白名单动作；禁用 shell/cmd；会话数据零外发
- **会话隔离**: BrowserOS 会话在本地沙箱运行，**禁止将会话数据（Cookie）向任何第三方服务上报**
- **审计与风控**:
  - **铁律：始终仅预填草稿，严禁自动确认发布**。`ops_publish_now` 已从工具白名单、RPC 端点与文档中彻底移除，不得以任何形式重新引入
  - 预填止步于平台原生「保存为草稿」：微信公众号填标题 / 作者 / 正文并触发平台原生保存草稿按键；B站创作者中心填标题 / 简介 / 标签 / 分区并保存草稿
  - 预填完成后返回草稿直达链接，由人工在平台后台完成最终发布
  - 发布后由用户回填平台真实 URL，状态方可流转为 `published`
- **指标真实性**: 采集失败或平台不支持的指标必须为 `null`，不得按 0 或估算值伪造填充

---

## 5. 接口契约（最小依赖）

> 本插件无第三方兼容 / 代理接口；业务接口统一使用 RPC 信封。

### 5.1 认证方式
- Injoys MCP: `Authorization: Bearer {token}`
- 宿主 RPC: 插件进程内调用，无额外鉴权头

### 5.2 统一成功响应（RPC 信封）

```typescript
interface RpcEnvelopeResponse<T = unknown> {
  ok: true
  result: { value: T }
}
```

### 5.3 统一错误响应（RPC 信封）

```typescript
interface RpcEnvelopeResponse {
  ok: false
  error: {
    code: string          // 机器可读错误码，如 'ops/bad-request'
    message: string       // 用户可读错误信息
    details?: unknown     // 可选：内部/开发调试信息
  }
}
```

### 5.4 关键接口

宿主 RPC 网关：`POST /api/ops`。架构文档 §2.2 规定的请求信封为：

```typescript
interface RpcEnvelopeRequest {
  method: string
  params?: Record<string, unknown>
}
```

> **实现口径（与文档差异，以本行为准）**：实际传输为 DSH connection 包装 —— 客户端发
> `{ type: 'client-request', rpcId, method: 'ops', payload: { method, payload } }`，
> 宿主回 `{ type: 'server-response', rpcId, result }`，其中 `result` 为 §5.2 / §5.3 的信封。
> 方法入参字段名实现为 `payload`（架构文档写作 `params`）。网关强制校验
> `Content-Type: application/json`、`type === 'client-request'`、`method === 'ops'` 且 `payload` 必须存在。

**已在 `src/ops-rpc.ts` 登记的方法**（当前实现基线）：

- **工作台**: `workbench.overview`、`workbench.generateArticleDraft`、`workbench.generateVideoMeta`、`workbench.prefillDraft`
- **草稿**: `drafts.list`、`drafts.get`、`drafts.save`、`drafts.delete`、`drafts.updatePublishUrl`
- **浏览器**: `browser.sessions`（返回额外含 `reuseHostBrowserProfile`）
- **配置**: `config.get`、`config.save`、`injoys.test`

**架构文档 §3 已定义但尚未实现的方法**（新增须先补契约再实现）：

- `workbench.generateCalendar`（排期生成与 Injoys 单向导出）
- `tools.catalog`、`tools.toggle`、`tools.executeSandbox`、`tools.telemetry`（AI 工具中枢与沙箱）
- `browser.login.startQr` / `pollQr` / `openHeadful` / `cancel`（Phase 2 愿景，需 BrowserOS CDP PoC 验证）

> 客户端当前仅接入 `config.get`、`config.save`、`injoys.test`、`browser.sessions`；
> 工作台 / 草稿类方法待客户端 UI 接入（与开发计划「客户端草稿工作台 UI 待实现」一致）。

### 5.5 核心领域类型（权威定义在 `src/types.ts`）

- `PlatformId`: `wechat_mp` | `wechat_channels` | `bilibili` | `douyin` | `xiaohongshu` | `youtube` | `twitter_x` | `product_hunt` | `tiktok`
- `ContentKind`: `article` | `video` | `post`
- `ItemStatus`: `planned` → `drafting` → `draft_ready` → `prefilled` → `approved` → `published` → `archived`（内容生命周期状态机见架构文档 §4.2）
- `SessionState`: `unknown` | `needs_login` | `authenticated` | `no_publish_permission`（**严禁退化为 boolean**，杜绝假阳性）
- `PlatformMetrics`: `impressions`（曝光 / 阅读）与 `plays`（播放）**必须独立且可空**；无法获取时为 `null`，不得按 0 计算；`views` 仅为兼容字段（`impressions ?? plays ?? 0`）
- `ContentDraft`: 含 `channelVariants`、`version`、`prefillResults`、`publishedUrls`（见架构文档 §4.1）

> 注：`AdapterRegistry` 当前注册 8 个平台适配器（`wechat_mp` / `bilibili` / `wechat_channels` / `douyin` / `youtube` / `tiktok` / `twitter_x` / `product_hunt`）；
> `xiaohongshu` 已列入 `PlatformId` 但尚未注册适配器。

---

## 6. SSoT-first 执行顺序

```
类型契约（src/types.ts，如有变更）
    ↓
宿主 RPC 方法契约（src/ops-rpc.ts）
    ↓
Adapter / 领域服务实现
    ↓
客户端 UI 与测试
```

> 本项目未初始化独立 `SSoT/` 契约目录（决策依据见 §7.3）；API 层为「启用，工具 = 手写」，
> 因此**契约先行的约束依然生效**，只是没有 Codegen 步骤。
> OpenSpec 的提案、验证和归档命令由 `/context-*` 工作流维护，不在项目准则中重复定义。

---

## 7. SSoT 文件路径与工具链

> 由 `/context-init` 的 SSoT 选型写入。**工具以架构文档为准**。提案、实施、检查一律以本节为准。

### 7.1 文件路径

| 层 | 契约文件/目录 | 用途 |
|----|-------------|------|
| 数据层 | 未启用 | 无数据库迁移 / Schema；本地 JSON 持久化 |
| 共享层（可选） | 未启用 | 无 API / IPC 双层 |
| API 层 | `src/ops-rpc.ts` + `src/types.ts` | 宿主 RPC 方法与信封契约（手写 TS）；客户端消费方 `plugin-src/management-rpc.mjs` + `plugin-src/client/ops-page.js` |
| IPC 层（可选） | 未启用 | 插件为宿主内进程，无 IPC 边界 |

### 7.2 工具链与 Codegen

| 层 | 契约工具 | 校验命令 | 生成命令 | 生成产物（路径 → 消费方） | 产物是否提交 | 选型依据 |
|----|---------|---------|---------|--------------------------|:-----------:|---------|
| 数据层 | — | — | — | — | — | 架构文档 §5.3 / 开发计划 §4.2：本地 `$DSH_HOME/growth-studio/` 为黄金主数据源，无 DB |
| API 层 | 手写 TypeScript 契约（`RpcEnvelope` 信封 + `src/types.ts` 领域类型） | `pnpm typecheck`（`tsc -p tsconfig.json --noEmit`）；测试 `pnpm test`（vitest） | 无（前后端同进程、同语言 TypeScript，无跨语言消费方，Codegen 无收益；同步方式：契约变更后由 `pnpm typecheck` + `pnpm test` 校验实现一致） | 无（类型经 `src/types.ts` 直接共享） | — | 架构文档 §2.2、§3：`POST /api/ops` 为项目内自研 RPC 信封，非 REST/OpenAPI/gRPC |
| IPC 层（可选） | — | — | — | — | — | 架构文档 §1.1：客户端视图层经宿主 RPC 网关通信，非 IPC |
| 共享层（可选） | — | — | — | — | — | 无 API / IPC 双层可复用模型 |

规则：
- 契约变更后必须执行该层「生成命令」，并使用生成产物；业务代码**禁止**手写与契约等价的类型/DTO（有明确注释说明的「非契约扩展字段」除外）。
- 「生成命令」为「无」时，已在上表写明原因及手工同步 / 校验方式。
- 本表所列工具缺失时，`check-env` 应报告缺失，不得声称校验通过。

> 判定口径：某层有契约（即使是手写的 TypeScript 类型）即为「启用，工具 = 手写」，生成命令写「无（原因）」；只有该层完全不存在才写「未启用」。

### 7.3 各层启用/未启用的决策依据

| 层 | 判定 | 依据（引用架构文档章节） |
|----|------|------------------------|
| 数据层 | 未启用 | 架构文档 §1.1「本地持久化基础设施层」与 §5.3：持久化为 `$DSH_HOME` 下 JSON 文件；文档中无 SQL / 关系型数据库 / Schema / 迁移 / ORM 任何描述，契约即 `src/types.ts` 类型 |
| API 层 | **启用（工具 = 手写）** | 架构文档 §2.2 定义宿主 RPC 通信机制（`POST /api/ops` + 信封）并明确信封字段；§3 逐条定义 RPC API Reference。协议为自研信封而非 REST/OpenAPI/gRPC，且无跨语言消费方，故以手写 TypeScript 契约承载，不引入 TypeSpec/OpenAPI + Codegen |
| IPC 层 | 未启用 | 架构文档 §1.1：客户端视图层与宿主经「宿主 RPC 协议网关层」以 HTTP POST 通信，插件为宿主内进程，不存在原生/前端跨边界 IPC |
| 共享层 | 未启用 | 依赖 API 层与 IPC 层同时启用；本项目仅 API 层启用 |

> 若未来引入独立服务端或跨语言消费方，应重新执行 `.agent/workflows/context-init.md` 的 SSoT 选型。

---

## 8. 统一入口

本文件（`.context/criterion.md`）是项目约束的**权威来源**。

`openspec/config.yaml` 是供 OpenSpec 注入上下文的派生快照，不是独立权威来源，也不应手工维护。

> 💡 仅当源文档（PRD / 架构等）变化时才需更新 `.context/`；业务代码变更不触发重生成。
