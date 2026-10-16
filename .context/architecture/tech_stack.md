# 技术栈约束 (Tech Stack)

> **Metadata**
> - **Source**: `.context/architecture/source/technical_architecture.md`（TAD v1.2.0）
> - **Generated At**: `2026-10-16 09:44`
> - **Generator**: `Context-Agent v1.0`

> ⚠️ 版本号取自 `package.json`（实际依赖，2026-10-16 核对）。若与源文档冲突，**以源文档为准**；
> 约束性表述（MUST / MUST NOT）的**权威来源为 `.context/criterion.md` §3**，本文为其结构化摘录。

---

## 约束等级说明

| 等级 | 含义 | 违反后果 |
|------|------|---------|
| **MUST** | 必须遵守 | 架构不合规，评审不通过 |
| **SHOULD** | 推荐使用 | 需在提案中说明理由 |
| **MUST NOT** | 禁止使用 | 架构不合规，可能引入安全风险 |

---

## 🧭 运行时形态（先决认知）

```yaml
形态: 无独立服务端 —— DSH 宿主内进程 Cordis 插件
语言: TypeScript（宿主侧）/ JavaScript ESM（客户端侧）
部署: 随 DSH Desktop 加载，无网络监听端口、无容器、无云资源
```

> 该形态决定了本项目**没有** K8s / Docker / CI 集群 / 数据库等常规后端栈，
> 相关章节如实标注 `N/A`，不填充模板示例值。

---

## 🔧 后端技术栈（插件宿主核心层）

| 技术 | 版本 | 约束 | 用途 |
|------|------|:----:|------|
| **Node.js** | `^22.19.0 \|\| >=24.0.0` | MUST | 运行时（`engines` 字段） |
| **TypeScript** | `^5.6.0` | MUST | 宿主侧源码语言 |
| **@deepseek-ai/cordis** | `^4.0.2` | MUST | 插件微内核、能力注册（tools / systemPrompt / connection） |
| **@deepseek-ai/dsh-tools** | `0.2.1-alpha.2` | MUST | 宿主工具注册能力 |
| **@deepseek-ai/dsh-system-prompt** | `0.2.1-alpha.2` | MUST | 系统提示词注入 |
| **@deepseek-ai/schemastery** | `^3.18.4` | MUST | Schema 校验（唯一 `dependencies` 项） |
| **ESM 模块** | — | MUST | `"type": "module"` |

**宿主侧 MUST**

- 所有 RPC 方法返回统一信封 `{ ok, result?, error? }`；失败必须**如实**抛错误码与信息
- 平台差异一律收敛到 `src/adapters/`（Adapter Pattern），**禁止**在通用流程中写平台分支
- Injoys 与 BrowserOS 调用必须集中在各自客户端封装入口
- 错误不得吞没；配置热更新须实时传给 `InjoysClient`（`updateConfig`）
- `config.save` 改 `draftsDir` 前必须**先准备并校验可写**，失败拒绝保存并返回 `config/invalid-drafts-dir`
- 会话探测、预填执行、指标采集必须由**同一个** BrowserOS MCP 实例调度
- 目录在单次操作内固定（含跨 `await` 的复合 RPC）；写锁按**绝对文件路径**归属

**宿主侧 MUST NOT**

- 内置全局通用 Master Key 或任何形式的通用凭据
- 虚报成功（无客户端或执行失败时严禁返回成功）
- 伪造 / 硬编码指标数据（无法获取必须为 `null`）
- 实现自动点击平台「正式发布 / 群发」按钮的能力（`ops_publish_now` 已彻底移除，不得以任何形式重新引入）

---

## 🎨 前端技术栈（DSH Desktop 客户端插件）

| 技术 | 版本 | 约束 | 用途 |
|------|------|:----:|------|
| **React** | 18 | MUST | 工作台 UI（`ops-page.js` + 自定义样式模块 `ops-styles.js`） |
| **JavaScript (ESM)** | — | MUST | 客户端源码（`plugin-src/client/`） |
| **esbuild** | `^0.28.2` | MUST | 客户端打包（`plugin-src/client/build.mjs`） |
| **DSH 主题令牌** | `var(--dsw-alias-*)` | MUST | 全部颜色（背景 / 边框 / 文字阶梯） |

**客户端 MUST**

- 按源文档 §2.1 的 Cordis 扩展机制封装为 `window.__ModuleLoader__.load(...)`
  - ⚠️ **实现口径（与源文档 §2.1 差异，以此为准）**：源文档 §2.1 示例写作
    `load('@deepseek-ai/dsh-ops-manager/client', ['@deepseek-ai/dsh-core/client'], …)`，
    但实际 `loaderId` 为 **`dsh-growth-studio`**，`inject` 声明为
    **`@deepseek-ai/dsh-client-connection`** 与 **`@deepseek-ai/dsh-client-ui-settings`**
    （见 `package.json` 的 `dsh.client.inject` 与 `plugin-src/client/build.mjs`）。
    该差异性质与 `params` vs `payload`（见 `api_strategy.md` §1.2、`risks_and_debt.md` TD-003）相同：**文档示例滞后于实现**。
- 在 `settings.section` 槽位注入，`id: 'ops'`，`order: 60`（置于 Jet Hub 之后）
- 全部数据经统一 RPC 封装 `callOpsRpc`（`POST /api/ops`）获取
- 样式一律走设计令牌：背景 `--dsw-alias-bg-layer-1/2/3`、边框 `--dsw-alias-border-l1/l2`、文字 `--dsw-alias-label-primary/secondary/tertiary`
- 指标为 `null` 时展示「暂无数据」语义，**不得显示为 0**
- 未登录平台一律提供 `去登录 ↗` 快捷外链；卡片支持即时刷新，不强制重载页面
- 状态域命名统一（`loading` / `error` / `data`）

**客户端 MUST NOT**

- 硬编码色值
- 绕过 `callOpsRpc` 直连 Injoys / BrowserOS 或任何外部服务
- 硬编码 Injoys Token、BrowserOS 凭证或任何敏感配置
- 承载核心业务规则（状态机、权限判定须在宿主侧）

> **交互点缀色**（架构文档 §5.4 权威取值，为**令牌化风格的唯一例外**）：
> 主操作蓝 `#1677ff`、安全绿 `#15803d`、告警橙 `#b45309`、活力紫 `#7c3aed`。

---

## 💾 数据库技术栈

**N/A – 源文档未提供**（本项目**无数据库**）。

| 项 | 判定 | 依据 |
|----|------|------|
| 数据层 | **未启用** | 架构文档 §5.3：本地 `$DSH_HOME/growth-studio/` 为黄金主数据源；无 SQL / Schema / 迁移 / ORM |
| 缓存 | 未启用 | — |
| 消息队列 | 未启用 | — |
| 持久化方式 | **本地 JSON 文件** | `drafts/{id}.json`(+`.versions/`)、`calendar/{id}.json`、`metrics/{YYYY-MM-DD}.json`、`ops-manager/config.json` |

**持久化 MUST**

- 原子写入（临时文件 + `rename`）+ 串行写锁
- `version` 自增 + `expectedVersion` 乐观锁
- 系统文件权限仅限当前操作系统用户
- 路径统一经 `resolveDshHome` 解析（`profileContext.home` → `DSH_HOME` → `~/.dsh` 回退）
- 目录在单次操作内固定；跨 `await` 的复合 RPC 在**请求开始时**捕获并贯穿（含请求内每一次落盘）
- 写入前**准备并验证可写**（创建并删除唯一命名探测文件）；仅检查存在性不足
- 存储错误码统一 `drafts/storage-unavailable`，须在**统一 RPC 错误边界**映射，覆盖所有写入口

**持久化 MUST NOT**

- 绕过 `config-store` / `draft-store` 模块直接操作配置文件或草稿文件
- 无锁并发回写同一草稿文件
- 单次操作中途重新解析 `draftsDir`
- 先让 `config.save` 报成功、再由 `drafts.save` 以 `ENOENT` 失败
- **让测试写入开发者真实 `$DSH_HOME`**（隔离须在测试文件被导入/收集**之前**生效，不得放 `beforeAll`）

---

## ☁️ 基础设施

**N/A – 源文档未提供**（无云基础设施）。

| 逻辑容器 | 基础设施形态 | 说明 |
|---------|-------------|------|
| 客户端视图层 | DSH Desktop 渲染进程 | 槽位注入的 React 工作台 |
| RPC 网关层 | DSH 宿主进程内 | `POST /api/ops` |
| 领域服务层 | DSH 宿主进程内 | Cordis 插件模块 |
| 本地持久化 | 用户本机文件系统 | `$DSH_HOME` |
| 浏览器执行 | BrowserOS 独立实例 + 独立用户 Profile | 会话数据本地沙箱，**零外发** |

> 无 CDN / 负载均衡 / 容器编排 / 服务网格。部署拓扑详见 `system_design.md` §部署拓扑。

---

## 🔄 DevOps 工具链

| 技术 | 版本 | 约束 | 用途 |
|------|------|:----:|------|
| **pnpm** | workspace | MUST | 包管理与脚本编排（`pnpm-workspace.yaml`） |
| **tsc** | `^5.6.0` | MUST | 构建 `pnpm build` / 类型检查 `pnpm typecheck` |
| **vitest** | `^3.0.0` | MUST | 测试 `pnpm test` (`vitest run`) |
| **esbuild** | `^0.28.2` | MUST | 客户端产物构建 `pnpm build:client` |
| **@types/node** | `^22.0.0` | SHOULD | 宿主侧类型 |

**标准命令**

| 命令 | 作用 |
|------|------|
| `pnpm build` | `tsc -p tsconfig.json` |
| `pnpm build:client` | `node plugin-src/client/build.mjs` |
| `pnpm build:all` | 宿主 + 客户端全量构建 |
| `pnpm typecheck` | `tsc -p tsconfig.json --noEmit` |
| `pnpm typecheck:tests` | `tsc -p tsconfig.tests.json` |
| `pnpm test` | `vitest run` |

> ⚠️ **CI 平台未定义** —— N/A – 源文档未提供（仓库内无 CI 配置描述）。

---

## 📦 核心依赖

### 后端（宿主）

| 包 | 版本 | 类型 | 用途 |
|----|------|------|------|
| `@deepseek-ai/schemastery` | `^3.18.4` | dependency | Schema 校验（**运行时唯一直接依赖**） |
| `@deepseek-ai/cordis` | `^4.0.2` | peer | 微内核 |
| `@deepseek-ai/dsh-tools` | `^0.2.1-alpha.2` | peer | 工具注册 |
| `@deepseek-ai/dsh-system-prompt` | `^0.2.1-alpha.2` | peer | 提示词注入 |

### 前端（客户端）

| 包 | 版本 | 类型 | 用途 |
|----|------|------|------|
| `@deepseek-ai/dsh-client-connection` | — | 宿主注入 | 客户端连接能力（`inject` 声明） |
| `@deepseek-ai/dsh-client-ui-settings` | — | 宿主注入 | Settings 槽位能力（`inject` 声明） |
| React 18 | 18 | 宿主提供 | UI 框架 |

---

## 🧱 仓库结构约束（criterion §1）

| 目录 | 用途 |
|------|------|
| `src/` | 宿主侧 TS 源码（`index.ts` / `ops-rpc.ts` / `config-store.ts` / `types.ts` / `adapters/` / `injoys/` / `browser/`） |
| `plugin-src/client/` | 客户端 JS 源码与 esbuild 构建脚本 |
| `lib/` | 构建产物（`main` / `types` / `exports`） |
| `tests/` | vitest 测试（含 `setup-isolation.ts`） |
| `locale/` | 国际化资源 |
| `design/context-dev/` | Context 工具链（**不手工修改**） |
| `.context/` | AI 上下文资产 |

---

## 🔗 SSoT 与 Codegen 约束（criterion §7）

| 层 | 契约工具 | 校验命令 | 生成命令 |
|----|---------|---------|---------|
| 数据层 | 未启用（无 DB） | — | — |
| **API 层** | **手写 TypeScript**（`src/types.ts` + `src/ops-rpc.ts` 信封） | `pnpm typecheck` + `pnpm test` | **无**（同进程同语言，无跨语言消费方，Codegen 无收益） |
| IPC 层 | 未启用（无 IPC 边界） | — | — |
| 共享层 | 未启用 | — | — |

> **SSoT-first 顺序**：类型契约（`src/types.ts`）→ 宿主 RPC 方法契约（`src/ops-rpc.ts`）→ Adapter / 领域服务实现 → 客户端 UI 与测试。
> 业务代码**禁止**手写与契约等价的类型 / DTO（有明确注释的「非契约扩展字段」除外）。

---

## 🎯 关键技术决策索引

| 决策 | 结论 | ADR |
|------|------|-----|
| 会话管理 | 统一 BrowserOS 实例（否决日用 Chrome Cookie 探取） | `adr_001_unified_browseros_session.md` |
| 发布模型 | 仅预填 + 人工发布 + URL 回填闭环 | `adr_002_prefill_only_human_in_the_loop.md` |
| RPC 协议 | 自研信封 `POST /api/ops`，非 REST/OpenAPI/gRPC | `adr_003_custom_rpc_envelope.md` |
| 持久化 | 本地 JSON 为黄金主数据源，Injoys 单向导出 | `adr_004_local_primary_injoys_export.md` |
| `ItemStatus` | 收敛为五态，移除 `approved` / `archived` | `adr_005_five_state_lifecycle.md` |
| 产品切换 | 仅切换生成上下文，不做数据隔离 | `adr_006_product_switch_context_only.md` |
| 刷新策略 | 手动触发 + 局部替换 + in-flight 去重，无持久连接 | `adr_007_manual_refresh_no_persistent_connection.md` |
| 草稿版本 | 独立版本快照存储，非破坏性恢复 | `adr_008_version_snapshot_storage.md` |

---

## AI 引用指南

当 AI 生成代码时：
1. 使用 **MUST** 等级技术，禁止使用 **MUST NOT** 技术
2. 优先使用 **SHOULD** 等级技术，偏离时须说明理由
3. 遵循指定版本要求；新增依赖前先确认不违反 criterion §3
4. 契约变更走 criterion §7 的 SSoT-first 顺序，不得跳步
5. 遇到本文与 `../criterion.md` 或 `source/` 冲突时，**以它们为准**
