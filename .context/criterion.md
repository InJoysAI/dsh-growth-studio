# 项目准则 (Project Criterion)

> **Metadata**
> - **Source**: `docs/product_requirements.md`, `docs/development_plan.md`, `docs/technical_architecture.md`
> - **Generated At**: `2026-10-15 12:19`
> - **Generator**: `Context-Dev-Agent v1.0`

> **用途**: 定义 AI 代理必须遵守的工程约束和技术规范。
> **权威性**: 本文件是项目约束的**权威来源**（见 §8）。

---

## 1. 仓库结构约束

```text
dsh-growth-studio/
├── src/                         # 插件宿主侧核心逻辑（TypeScript，编译至 lib/）
│   ├── adapters/                # 平台适配器注册表与 8 平台元数据（AdapterRegistry）
│   ├── analytics/               # 指标采集与复盘报告（MetricsCollector / ReviewReporter）
│   ├── browser/                 # BrowserOS 驱动与会话哨兵（BrowserDriver / SessionGuard）
│   ├── feedback/                # 评论抓取与需求提炼（CommentsCrawler / IssueExtractor）
│   ├── injoys/                  # Injoys MCP 客户端代理（JSON-RPC 2.0）
│   ├── international/           # 出海增长与时区策略（OverseasStrategyManager）
│   ├── schedule/                # DSH 自动化任务注册（ops_setup_schedule）
│   ├── storage/                 # 本地草稿持久化（DraftStore）
│   ├── tools/                   # 运营工具注册中心（ops_* 工具契约）
│   ├── config-store.ts          # 配置读写
│   ├── ops-rpc.ts               # 宿主 RPC 路由与方法分发
│   ├── types.ts                 # 领域实体类型契约
│   └── index.ts                 # 插件入口（Cordis apply）
├── plugin-src/
│   ├── client/                  # 客户端源码（esbuild 打包为 window.__ModuleLoader__ 模块）
│   │   ├── build.mjs            # 客户端构建脚本
│   │   ├── index.js             # 客户端插件入口（settings.section 槽位注入）
│   │   ├── ops-page.js          # Ops Workbench 工作台界面（React 18）
│   │   └── ops-styles.js        # 工作台样式（DSH 设计令牌对齐）
│   └── management-rpc.mjs
├── lib/                         # tsc 构建产物（勿手工编辑）
├── locale/                      # 国际化文案
├── tests/                       # vitest 测试
├── design/context-dev/          # Context 工程化工具链（本文件所在体系）
├── docs/                        # 需求/架构/计划文档（源文档只读）
└── .context/                    # AI 代理长期记忆目录（生成本身即产物）
```

---

## 2. 三维约束体系

| 维度 | 工具 | 约束规则 |
|------|------|---------|
| **需求层** | OpenSpec | 功能变更必须先创建并评审提案；具体命令和文件格式由 OpenSpec 工作流定义 |
| **数据层** | 无（本地 JSON 文件存储，非关系型数据库） | 未启用。草稿/排期主数据以 JSON 文件落盘 `$DSH_HOME/growth-studio/drafts/{id}.json`；无迁移文件与 ORM。契约以 `src/types.ts` 类型为准 |
| **API 层** | 宿主 RPC 信封（`POST /api/ops`，手写 TypeScript 契约） | 未引入 OpenAPI/TypeSpec 代码生成。契约入口 `src/ops-rpc.ts` + `src/types.ts`；信封结构见 §5.1，变更须保持信封结构与既有方法向后兼容 |
| **IPC 层（可选）** | 未启用 | 本插件为 DSH 宿主内进程（in-process Cordis 插件），非独立桌面端进程，无跨语言 IPC 边界；客户端与宿主经 `POST /api/ops` HTTP RPC 通信 |
| **共享层（可选）** | 未启用 | 无 API/IPC 双层，无独立共享模型目录 |

---

## 3. 技术栈强制约束

### 3.1 客户端（DSH Desktop 客户端插件，web 平台）

```yaml
Type: DSH Desktop Client Plugin（Cordis 槽位注入扩展）
Language: JavaScript（ESM，源码 plugin-src/client/）
Framework: React 18 + esbuild 打包
Location: plugin-src/client/

MUST:
  - 通过 window.__ModuleLoader__.load('@deepseek-ai/dsh-ops-manager/client', ['@deepseek-ai/dsh-core/client'], fn) 规范封装
  - 在 settings.section 槽位注入，id: 'ops'，order: 60（置于 Jet Hub 之后）
  - 全部数据经统一的 POST /api/ops RPC 封装获取，不直连任何外部服务
  - 样式必须使用 DSH 主题令牌（var(--dsw-alias-*)），不得硬编码色值

MUST NOT:
  - 硬编码 Injoys Token、BrowserOS 凭证或任何敏感配置
  - 绕过 RPC 网关直连 Injoys / BrowserOS MCP
  - 在客户端承载核心业务规则（状态机、权限判定须在宿主侧）
```

### 3.2 插件宿主核心层（Node.js / TypeScript）

```yaml
Structure:
  - src/index.ts:      Cordis 插件入口与能力注册
  - src/ops-rpc.ts:    宿主 RPC 入口层（入参校验、方法路由、响应封装）
  - src/config-store.ts: 本地配置读写（$DSH_HOME/ops-manager/config.json）
  - src/types.ts:      领域实体与契约类型定义
  - src/adapters/:     平台适配器（Adapter Pattern，按平台解耦）
  - src/injoys/:       Injoys MCP 客户端代理（JSON-RPC 2.0 / HTTP）

MUST:
  - 所有 RPC 方法必须返回统一信封 { ok, result?, error? }，失败必须如实抛出错误码与信息
  - 平台差异一律收敛到 Adapter 层，禁止在通用流程中写平台分支
  - Injoys 与 BrowserOS 调用必须集中在各自客户端封装入口
  - 错误不得吞没（development_plan 基线要求：错误不吞，如实抛出）
  - 配置热更新须实时生效并传给 InjoysClient

MUST NOT:
  - 虚报成功（无客户端或执行失败时严禁返回成功）
  - 伪造/硬编码指标数据（无法获取的字段必须为 null）
  - 在插件内实现自动点击平台「正式发布 / 群发」按钮的能力
```

### 3.3 前端工程约束（工作台 UI）

```yaml
Framework: React 18
Location: plugin-src/client/
Styling: 自定义样式模块 ops-styles.js，深度对齐 DSH 设计令牌
Tabs: 6 大业务 Tab（驾驶舱 / 排期日历 / 创作室 / AI工具中枢 / 舆情复盘 / 引擎配置）

MUST:
  - 只调用统一 RPC 封装，不手写外部 fetch
  - 状态域与字段命名约定统一（loading / error / data）
  - 指标为 null 时展示为「暂无数据」语义，不得显示为 0
  - 未登录平台一律提供「去登录 ↗」快捷外链（零阻碍操作原则）
  - 卡片支持即时刷新，不强制重载页面

MUST NOT:
  - 硬编码色值（必须使用 var(--dsw-alias-*)）
  - 包含业务黑盒逻辑或本地伪造数据
```

### 3.4 服务端

```yaml
Language: 无独立服务端（DSH 宿主内进程 Cordis 插件）
Framework: Cordis 4.x（@deepseek-ai/cordis）
Location: src/

MUST:
  - 会话探测、预填执行、指标采集统一由同一个 BrowserOS MCP 实例调度
  - RPC 接口演进须向后兼容，或按版本显式升级

MUST NOT:
  - 引入外部常驻服务端或额外网络监听端口
  - 将敏感策略/令牌下发到客户端
```

### 3.5 数据持久化

```yaml
Type: 本地 JSON 文件存储（无数据库）
Path:
  - 草稿库: $DSH_HOME/growth-studio/drafts/{id}.json
  - 配置:   $DSH_HOME/ops-manager/config.json
Structure: ContentDraft / PlatformMetrics / CalendarItem（见 §5.5 与架构文档 §4.1）

MUST:
  - 原子写入 + 串行写锁保护内部回写
  - 版本自增（version）与 expectedVersion 乐观锁并发控制
  - 系统文件权限仅限当前操作系统用户

MUST NOT:
  - 直接跨模块裸写配置文件（须经 config-store）
  - 在无锁情况下并发回写同一草稿文件
```

---

## 4. 安全约束

- **认证方式**: Injoys MCP 使用 `Authorization: Bearer {token}`；平台登录态由 BrowserOS 实例自身的用户 Profile 承载
- **密钥管理**: 禁止硬编码；令牌仅允许来自用户配置或环境变量回退；前端支持显隐切换；日志必须脱敏
- **网络要求**: HTTPS 强制；Injoys 调用须校验 HTTP 状态码与 `result.isError`
- **最小权限**: BrowserOS 驱动仅允许 `tabs / navigate / snapshot / act` 白名单动作；会话数据零外发，不向任何第三方上报 Cookie
- **审计与风控**:
  - **铁律：始终仅预填草稿，严禁自动确认发布**。`ops_publish_now` 工具已彻底移除，不得以任何形式重新引入
  - 预填完成后返回草稿直达链接，由人工在平台后台完成最终发布
  - 发布后由用户回填平台真实 URL，状态方可流转为 `published`

---

## 5. 接口契约（最小依赖）

> 业务接口采用统一响应信封；本插件无第三方兼容/代理接口。

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
    code: string          // 机器可读错误码
    message: string       // 用户可读错误信息
    details?: unknown     // 可选：内部/开发调试信息
  }
}
```

### 5.4 关键接口

宿主 RPC 网关：`POST /api/ops`，请求体为
```typescript
interface RpcEnvelopeRequest {
  method: string
  params?: Record<string, unknown>
}
```

已登记方法族（详见架构文档 §3）：

- **工作台**: `workbench.overview`、`workbench.generateCalendar`、`workbench.generateArticleDraft`、`workbench.generateVideoMeta`、`workbench.prefillDraft`
- **草稿**: `drafts.list`、`drafts.get`、`drafts.save`、`drafts.delete`、`drafts.updatePublishUrl`
- **浏览器**: `browser.sessions`（`browser.login.*` 为 Phase 2 愿景，需 PoC 验证）
- **工具中枢**: `tools.catalog`、`tools.toggle`、`tools.executeSandbox`、`tools.telemetry`
- **配置**: `config.get`、`config.save`、`injoys.test`

### 5.5 核心领域类型（权威定义在 `src/types.ts`）

- `PlatformId`: `wechat_mp` | `wechat_channels` | `bilibili` | `douyin` | `youtube` | `twitter_x` | `product_hunt` | `tiktok`
- `ContentKind`: `article` | `video` | `post`
- `ItemStatus`: `planned` → `drafting` → `draft_ready` → `prefilled` → `approved` → `published` → `archived`
- `SessionState`: `unknown` | `needs_login` | `authenticated` | `no_publish_permission`（**严禁退化为 boolean**，杜绝假阳性）
- `PlatformMetrics`: `impressions`（曝光/阅读）与 `plays`（播放）**必须独立且可空**；无法获取时为 `null`，不得按 0 计算

---

## 6. SSoT-first 执行顺序

```
类型契约（src/types.ts，如有变更）
    ↓
宿主 RPC 方法契约（src/ops-rpc.ts）
    ↓
Adapter / 服务实现
    ↓
客户端 UI 与测试
```

> OpenSpec 的提案、验证和归档命令由 `/context-*` 工作流维护，不在项目准则中重复定义。

---

## 7. SSoT 文件路径与工具链

> 由 `/context-init` 的 SSoT 选型写入。本项目经决策判定**不初始化独立 SSoT 契约目录**，原因见 §7.3。

### 7.1 文件路径

| 层 | 契约文件/目录 | 用途 |
|----|-------------|------|
| 数据层 | 未启用（`src/types.ts` 为类型事实源） | 无数据库迁移；本地 JSON 持久化 |
| 共享层（可选） | 未启用 | 无 API/IPC 双层 |
| API 层 | `src/ops-rpc.ts` + `src/types.ts` | 宿主 RPC 方法与信封契约（手写 TS） |
| IPC 层（可选） | 未启用 | 插件为宿主内进程，无 IPC 边界 |

### 7.2 工具链与 Codegen

| 层 | 契约工具 | 校验命令 | 生成命令 | 生成产物（路径 → 消费方） | 产物是否提交 | 选型依据 |
|----|---------|---------|---------|--------------------------|:-----------:|---------|
| 数据层 | 无（不适用） | 无 | 无（项目无数据库，本地 JSON 文件存储） | 无 | - | 架构文档 §5.3 / 开发计划 §4.2（本地 `$DSH_HOME/growth-studio/` 为黄金主数据源） |
| API 层 | 手写 TypeScript 契约（`RpcEnvelope` 信封） | `pnpm typecheck` | 无（前后端同进程同语言 TypeScript，无跨语言消费方，无需 codegen） | 无（类型直接由 `src/types.ts` 共享） | - | 架构文档 §2.2、§3（RPC 信封为项目内自研协议，非标准 REST/OpenAPI） |
| IPC 层（可选） | 未启用 | - | - | - | - | 架构文档 §1.1：客户端视图层经宿主 RPC 网关通信，非 IPC |
| 共享层（可选） | 未启用 | - | - | - | - | 无 API/IPC 双层可复用模型 |

规则：
- 契约变更后必须执行该层「生成命令」，并使用生成产物；业务代码**禁止**手写与契约等价的类型/DTO（有明确注释说明的「非契约扩展字段」除外）。
- 「生成命令」为「无」时，已在上表写明原因及手工同步/校验方式。
- 本表所列工具缺失时，`check-env` 应报告缺失，不得声称校验通过。

### 7.3 未初始化独立 SSoT 的决策依据

| 检测层 | 判定 | 原因 |
|--------|------|------|
| 数据层 | 未启用 | 项目无 SQL/关系型数据库/ORM/迁移；持久化为进程内 JSON 文件读写，契约即 `src/types.ts` 类型 |
| API 层 | 未启用（以现有 TS 契约替代） | 架构文档定义的是自研 `POST /api/ops` RPC 信封，非 REST/OpenAPI/gRPC/GraphQL；无跨语言消费方，引入 TypeSpec→OpenAPI→codegen 属额外负担且与文档冲突 |
| IPC 层 | 未启用 | 插件为 DSH 宿主内进程，无原生/前端跨边界 IPC |
| 共享层 | 未启用 | 依赖 API 层与 IPC 层同时启用 |

> 若未来引入独立服务端或跨语言消费方，应重新执行 `.agent/workflows/context-init.md` 的 SSoT 选型。

---

## 8. 统一入口

本文件（`.context/criterion.md`）是项目约束的**权威来源**。

`openspec/config.yaml` 是供 OpenSpec 注入上下文的派生快照，不是独立权威来源，也不应手工维护。

> 💡 仅当源文档（PRD/架构等）变化时才需更新 `.context/`；业务代码变更不触发重生成。

---
