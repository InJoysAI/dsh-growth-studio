# 项目准则 (Project Criterion) — dsh-growth-studio

> **Metadata**
> - **Source**: `docs/product_requirements.md`, `docs/development_plan.md`, `docs/technical_architecture.md`
> - **Generated At**: `2026-10-15 13:17`
> - **Generator**: `Context-Dev-Agent v1.0`

---

## 1. 仓库结构约束

```text
dsh-growth-studio/                 # DSH 桌面端 Cordis 全插件（宿主侧 + 浏览器侧）
├── src/                          # 宿主侧插件源码（TypeScript，编译到 lib/）
│   ├── index.ts                  # 插件入口：注册 RPC 端点与 ops_* 工具
│   ├── ops-rpc.ts                # 宿主 RPC 网关（POST /api/ops 方法路由）
│   ├── types.ts                  # 领域类型契约（PlatformId / ItemStatus / SessionState / ContentDraft…）
│   ├── config-store.ts           # 配置持久化（$DSH_HOME/ops-manager/config.json）
│   ├── adapters/                 # 平台适配器与注册表
│   ├── analytics/                # 指标聚合与复盘报告
│   ├── browser/                  # 会话探活 / BrowserOS 驱动 / 预填执行
│   ├── feedback/                 # 评论抓取 / 需求提炼 / 热点发现
│   ├── injoys/                   # Injoys MCP 客户端（JSON-RPC 2.0 / HTTP）
│   ├── international/            # 出海策略与时区
│   ├── schedule/                 # DSH 自动化任务桥接
│   ├── storage/                  # 本地草稿库（$DSH_HOME/growth-studio/drafts/）
│   └── tools/                    # ops_* 工具定义与文案
├── plugin-src/                   # 浏览器侧源码（React 18 + esbuild）
│   ├── client/                   # 客户端 UI（settings.section slot 注入）
│   └── management-rpc.mjs        # 客户端 RPC 调用封装
├── lib/                          # 构建产物（git 忽略，不入库）
├── docs/                         # 需求 / 开发计划 / 架构文档
│   ├── product_requirements.md
│   ├── development_plan.md
│   └── technical_architecture.md
├── tests/                        # vitest 用例
├── scripts/                      # 校验脚本（.mts）
├── design/context-dev/           # Context 工作流工具链（不要手工修改）
├── .context/                     # AI 代理上下文资产
└── .agent/workflows/             # Context 工作流命令
```

> ⚠️ 本项目是 **DSH 插件包**，不是独立应用：它没有自有服务端进程，宿主为 DSH Desktop。

---

## 2. 三维约束体系

| 维度 | 工具 | 约束规则 |
|------|------|---------|
| **需求层** | OpenSpec | 功能变更必须先创建并评审提案；具体命令和文件格式由 OpenSpec 工作流定义（`.agent/workflows/context-openspec.md proposal <change-id>`） |
| **数据层** | 未启用（见 §7.3） | 本地 JSON 文件持久化，无关系型 Schema / 迁移体系 |
| **API 层** | 未启用（见 §7.3） | 宿主 RPC 契约以 `src/types.ts` + 架构文档 §3 的 TypeScript 接口为准 |
| **IPC 层（可选）** | 未启用（见 §7.3） | 客户端 ↔ 宿主经 `POST /api/ops` RPC 信封通信，契约见 §5 |
| **共享层（可选）** | 未启用 | 无独立共享模型（客户端为打包 JS，不消费宿主类型产物） |

---

## 3. 技术栈强制约束

### 3.1 客户端（浏览器侧插件 UI）

```yaml
Type: DSH Desktop 客户端插件（Cordis slot 注入）
Language: JavaScript (ESM 源码) + React 18
Framework: React 18 + esbuild bundle
Location: plugin-src/client/
Runtime: 由 window.__ModuleLoader__.load() 装载，注入 settings.section slot (id: ops, order: 60)

MUST:
  - 仅负责 UI 渲染与交互，不承载核心业务规则
  - 所有宿主调用集中在 management-rpc.mjs 的 callOpsRpc / unwrapRpcResult 单一封装入口
  - 样式使用 DSH 设计令牌（var(--dsw-alias-*)），禁止硬编码色值
  - 会话状态严格呈现四态语义（unknown / needs_login / authenticated / no_publish_permission），不得简化为布尔

MUST NOT:
  - 硬编码密钥 / 令牌 / 敏感配置
  - 绕过 callOpsRpc 直连 Injoys、BrowserOS 或任何外部服务
  - 复制宿主业务逻辑（如指标计算、排期生成）到客户端
```

### 3.2 宿主侧核心层（TypeScript 插件）

```yaml
Structure:
  - src/index.ts:        插件入口（注册 RPC 与工具，编排依赖）
  - src/ops-rpc.ts:      宿主 RPC 网关（POST /api/ops 方法路由 + 信封序列化）
  - src/types.ts:        领域类型契约
  - src/tools/:          ops_* 工具定义
  - src/browser/:        BrowserOS 统一实例驱动（会话探活 / 预填 / 抓取）
  - src/storage/:        本地草稿库
  - src/config-store.ts: 配置读写

MUST:
  - 统一 RPC 信封：{ ok, result: { value }, error: { code, message, details? } }
  - 通过 ctx.tools / MCP 客户端注册与调用工具，不自行实现 HTTP 客户端绕过 MCP
  - 指标采集失败或平台不支持时返回 null，并如实标注
  - 统一错误类型与用户可读错误映射

MUST NOT:
  - 内置全局通用 Master Key
  - 自动确认发布（见 §4 铁律）
  - 伪造 / 估算 / 回填虚假运营指标
```

### 3.3 前端工程约束

```yaml
Framework: React 18（external: react / react-dom）
Location: plugin-src/client/
Bundle: node plugin-src/client/build.mjs → lib/client/ops.js
Styling: 注入式样式（ops-styles.js）+ DSH 设计令牌

MUST:
  - 构建产物经 esbuild 打包为 window.__ModuleLoader__.load(...) 包裹格式
  - 文案面向运营人员，避免技术术语直出
  - 长任务提供即时刷新，不强制整页重载

MUST NOT:
  - 手写 fetch 请求（统一走 callOpsRpc）
  - 在客户端包含业务黑盒逻辑
```

### 3.4 宿主运行时（Node）

```yaml
Language: TypeScript 5.6 (strict)
Module: NodeNext / ES2023
Location: src/ （编译产物 lib/，git 忽略）
Node: ^22.19.0 || >=24.0.0
Build: pnpm build (tsc) / pnpm build:client (esbuild) / pnpm build:all
Test: pnpm test (vitest)

MUST:
  - 以 DSH 插件身份运行，服从 Cordis 生命周期与配置补丁（cordis.patch.yml）
  - 依赖声明与 peerDependencies 一致；构建产物不入库

MUST NOT:
  - 引入与 DSH 宿主冲突的运行时依赖
```

### 3.5 数据持久化

```yaml
Type: 本地 JSON 文件
Path:
  - 配置: $DSH_HOME/ops-manager/config.json
  - 草稿: $DSH_HOME/growth-studio/drafts/{id}.json
Structure: ContentDraft（含 channelVariants / status / version / prefillResults / publishedUrls）
原子性: 写入临时文件后 renameSync（见 src/storage/draft-store.ts）

MUST:
  - 通过 config-store / draft-store 模块读写
  - 草稿版本自增；状态流转遵循内容生命周期状态机
  - 文件权限仅限当前操作系统用户

MUST NOT:
  - 绕过 store 模块直接操作配置文件或草稿文件
```

---

## 4. 安全约束

- **认证方式**: Injoys MCP 使用 `Authorization: Bearer <token>`；令牌来源为工作台配置或 `INJOYS_MCP_TOKEN` 环境变量
- **密钥管理**: 禁止硬编码；仅允许 env / 用户输入 / 本地配置；前端支持显隐切换；日志必须脱敏
- **网络要求**: 本机回环通信（BrowserOS `http://127.0.0.1:9002/mcp`）；Injoys 走 HTTPS；连接失败不阻断 DSH 启动（`failOnStartupError: false`）
- **最小权限**: 客户端仅调用明确注册的 RPC 方法；工具白名单按场景技能包裁剪
- **会话数据零外发**: BrowserOS 会话在本地沙箱运行，不向任何第三方上报 Cookie 数据
- **分发防误触（铁律）**:
  - **严禁任何自动点击最终确认发布的行为**，`ops_publish_now` 已彻底移除
  - 始终采取"预填至草稿箱（Draft Prefill）"策略，保留平台原生确认发布步骤
  - 预填止步于草稿保存，发布后由人工回填正式 URL
- **数据真实性**: 采集失败或平台不支持时指标必须为 `null`，不得按 0 或估算值填充

---

## 5. 接口契约（最小依赖）

### 5.1 认证方式
- Header: `Authorization: Bearer <INJOYS_MCP_TOKEN>`

### 5.2 宿主 RPC 端点

- **URL**: `POST /api/ops`
- **请求信封**:
  ```json
  { "method": "workbench.overview", "params": {} }
  ```
- **成功响应信封**:
  ```json
  { "ok": true, "result": { "value": {} } }
  ```
- **错误响应信封**:
  ```json
  { "ok": false, "error": { "code": "ops/unknown-method", "message": "…", "details": {} } }
  ```

### 5.3 RPC 方法清单（以架构文档 §3 为准）

| 域 | 方法 |
|----|------|
| 工作台 | `workbench.overview`、`workbench.generateCalendar`、`workbench.generateArticleDraft`、`workbench.generateVideoMeta`、`workbench.prefillDraft` |
| 草稿 | `drafts.list`、`drafts.get`、`drafts.save`、`drafts.delete`、`drafts.updatePublishUrl` |
| 浏览器 | `browser.sessions`（Phase 2 愿景：`browser.login.*`，需 PoC） |
| 工具中枢 | `tools.catalog`、`tools.toggle`、`tools.executeSandbox`、`tools.telemetry` |
| 配置 | `config.get`、`config.save`、`injoys.test` |

### 5.4 对外工具（`ops_*`）

以工具白名单形式注册到 DSH `ctx.tools`：`ops_plan_calendar`、`ops_draft_article`、`ops_draft_video_meta`、`ops_push_drafts`、`ops_fetch_metrics`、`ops_generate_review`、`ops_fetch_comments`、`ops_extract_feedback`、`ops_discover_trends`、`ops_setup_schedule`、`ops_draft_launch_kit`。

### 5.5 错误码规范

- 错误码格式: `ops/<kebab-case>`（如 `ops/unknown-method`）
- 错误响应包含：`code`, `message`, 可选 `details`
- 错误码必须向后兼容或按版本演进

---

## 6. SSoT-first 执行顺序

```text
Schema/迁移（如有）        ← 本项目未启用数据层契约
    ↓
共享模型（如有）           ← 未启用
    ↓
API/IPC 契约（如有）       ← 未启用独立契约文件；以 src/types.ts + 架构文档 §3 为准
    ↓
Codegen                   ← 无
    ↓
业务实现与测试
```

> OpenSpec 的提案、验证和归档命令由 `/context-*` 工作流维护，不在项目准则中重复定义。

---

## 7. SSoT 文件路径与工具链

> 由 `/context-init` 的 SSoT 选型写入（见 `design/context-dev/tools/SSoT/AGENTS.md`）。**工具以架构文档为准**，文档未指定时才使用默认。提案、实施、检查一律以本节为准。

### 7.1 文件路径

| 层 | 契约文件/目录 | 用途 |
|----|-------------|------|
| 数据层 | 未启用 | — |
| 共享层 | 未启用 | — |
| API 层 | 未启用（等价契约见 `src/types.ts`、架构文档 §3） | 宿主 RPC 契约 |
| IPC 层 | 未启用（等价契约见 §5.2 信封与 §5.3 方法清单） | 客户端 ↔ 宿主 RPC |

### 7.2 工具链与 Codegen

| 层 | 契约工具 | 校验命令 | 生成命令 | 生成产物（路径 → 消费方） | 产物是否提交 | 选型依据 |
|----|---------|---------|---------|--------------------------|:-----------:|---------|
| 数据层 | 无（未启用） | `pnpm typecheck` | 无（原因：无关系型 Schema，持久化为本地 JSON） | — | — | 架构文档 §1.1、§5.3（本地 JSON 主数据） |
| API 层 | 无（未启用） | `pnpm typecheck` | 无（原因：契约由 `src/types.ts` 与架构文档 §3 的 TypeScript 接口承载） | — | — | 架构文档 §2.2、§3 |
| IPC 层 | 无（未启用） | `pnpm typecheck` + `pnpm test` | 无（原因：客户端为打包 JS，不消费类型产物；靠 `tests/ops-manager.spec.ts` 校验 RPC 行为一致） | — | — | 架构文档 §2.2、§3.1–§3.10 |
| 共享层 | 无（未启用） | — | 无（原因：API 层与 IPC 层均未启用） | — | — | 架构文档 §4.1 |

### 7.3 各层启用/未启用的决策依据

> 由 `/context-init` 写入；未启用某层（或整体不初始化 SSoT）时也必须在此写明原因。这是决策记录的唯一位置，Manifest 不重复记录。

| 层 | 判定 | 依据（引用架构文档章节） |
|----|------|------------------------|
| 数据层 | **未启用** | 架构文档 §1.1、§5.3：持久化为本地 JSON（`$DSH_HOME`），无关系型数据库、Schema 或迁移体系；源码中 `node:sqlite` 仅用于废弃路径下读取宿主浏览器 Cookie，非项目自有数据模型 |
| API 层 | **未启用** | 架构文档 §2.2、§3：对外无 REST/GraphQL/gRPC 契约；宿主 RPC 为插件内部方法路由，契约以 `src/types.ts` 与架构文档 TypeScript 接口为准，不存在 OpenAPI 消费方 |
| IPC 层 | **未启用** | 架构文档 §2.1、§2.2：客户端与宿主同为 TypeScript/JavaScript 生态，RPC 信封与 11 个 `ops_*` 工具契约由宿主类型与测试保证；客户端为 esbuild 打包、不消费 `.d.ts` 产物，引入 JSON Schema/TypeSpec 无法产生可用 codegen |
| 共享层 | **未启用** | 依赖 API 层与 IPC 层；两者均未启用，无跨层可复用模型需求 |

> **整体结论**: 本项目**不初始化 SSoT 骨架**，理由为上述四层均无契约工具可落地的消费方；技术约束改由 `src/types.ts`（类型契约）+ 架构文档 §3（RPC 接口定义）+ `tests/`（行为校验）承载。

---

## 8. 统一入口

本文件（`.context/criterion.md`）是项目约束的**权威来源**。

`openspec/config.yaml` 是供 OpenSpec 注入上下文的派生快照，不是独立权威来源，也不应手工维护。

> 💡 仅当源文档（PRD/架构等）变化时才需更新 `.context/`；业务代码变更不触发重生成。
