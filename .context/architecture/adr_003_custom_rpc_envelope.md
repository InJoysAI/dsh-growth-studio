# ADR-003: 自研 RPC 信封 `POST /api/ops`（非 REST / OpenAPI / gRPC）

**状态**: Accepted
**日期**: 2026-10-15（源文档 TAD v1.4.5、PRD 基线 v1.2.2）
**决策者**: N/A – 源文档未提供

---

## 上下文 (Context)

客户端工作台（React 18，运行在 DSH Desktop 渲染进程）需要调用宿主侧（Node.js / TypeScript，Cordis 插件）的领域服务：草稿 CRUD、排期生成、指标聚合、会话探测等。

**当前面临什么问题？**

- 需要一套**统一、可校验、可版本演进**的调用约定；
- 但本项目是**单插件、单仓**形态：宿主为 TypeScript、客户端为 JavaScript（DSH Desktop 渲染层，经 `POST /api/ops` 消费信封），TS 类型不跨该边界共享，也没有需要生成客户端 SDK 的跨语言外部消费方；
- 常规 REST/OpenAPI 会引入 schema 定义与 Codegen 链路，可能**没有对应收益**；
- 需要统一表达成功与失败，且失败必须能携带**机器可读的错误码**（如 `drafts/published-requires-url`）。

---

## 决策驱动因素 (Decision Drivers)

- **契约先行**：数据层与 API 层的变更须先改契约再实现（criterion §6 SSoT-first）
- **无 Codegen 成本**：宿主侧 TypeScript 内部直接引用 `src/types.ts`；客户端 JavaScript 按信封运行时形状消费，无需生成产物
- **错误语义**：需要稳定的机器可读错误码驱动 UI 分支
- **实施成本**：避免为单机插件引入 Codegen 工具链的维护负担

---

## 备选方案 (Considered Options)

### 方案 A: REST + OpenAPI + Codegen

**描述**：定义 OpenAPI 3.0 规范，生成 TypeScript 客户端与服务端类型。

**优点**:
- 行业标准，工具链成熟
- 自动生成类型，减少手写错误

**缺点**:
- 宿主侧 TypeScript 已在仓内直接共享 `src/types.ts`；客户端为 JavaScript 且协议为自研信封（非 schema 驱动），**Codegen 无收益**
- 引入额外工具链与构建步骤（生成、校验、产物提交策略）
- REST 资源语义与本项目的"命令式操作"（`prefillDraft`、`generateVideoMeta`）**不贴合**
- 无跨语言外部消费方（客户端为同仓 JavaScript），标准化的互操作价值无法兑现

### 方案 B: gRPC / Protobuf

**描述**：以 `.proto` 定义服务，二进制传输。

**优点**:
- 强类型、高性能、跨语言

**缺点**:
- 对本机回环 HTTP 调用而言，序列化性能优势**无意义**
- 引入 protobuf 工具链与构建复杂度
- 无跨语言外部消费方（客户端为同仓 JavaScript）

### 方案 C: 自研 RPC 信封 `POST /api/ops`（**采用**）

**描述**：单一端点 `POST /api/ops`，以 `{ method, params/payload }` 调用，统一信封返回 `{ ok, result?, error? }`。契约以**手写 TypeScript** 承载（`src/types.ts` + `src/ops-rpc.ts`）。

**优点**:
- 宿主侧**同语言直接引用类型**、客户端按信封运行时消费，无需 Codegen
- 错误码可自由设计（`{domain}/{kebab-reason}`），语义精确
- 命令式方法名与业务动作一一对应，可读性高
- 单一端点便于统一信封校验与**统一错误边界**

**缺点**:
- 非标准协议，无现成工具生态（对单机插件影响有限）
- 契约一致性依赖 `pnpm typecheck` + `pnpm test` 手工保障
- 方法入参字段名在文档与实现间存在差异（见下方"风险"）

---

## 决策 (Decision)

**我们决定采用**: **方案 C —— 自研 RPC 信封**

理由：

1. **明确无收益即不引入**：criterion §7.2 明确记录"协议为自研信封、无 schema 源可生成，且客户端为 JavaScript 不共享 TS 类型，Codegen 无收益"；
2. 本项目的调用多为**命令式动作**（生成、预填、回填），REST 的资源语义反而是负担；
3. 统一信封 + 统一错误边界，恰好满足"存储错误码在所有写入口一致"这一硬需求（见 ADR-004 与 criterion §3.5）；
4. 契约以**手写 TS** 承载，仍满足"契约先行"约束 —— 只是没有 Codegen 步骤，同步方式为 `pnpm typecheck` + `pnpm test`。

---

## 后果 (Consequences)

### 正面影响

- 零 Codegen 工具链负担；宿主侧类型经 `src/types.ts` 直接共享
- 错误码体系自主可控，可精确表达业务失败原因
- 单一端点便于实现**统一 RPC 错误边界**，保证所有写入口返回同一存储错误码
- 便于向后兼容演进（新增方法不影响既有调用）

### 负面影响

- 无 OpenAPI 文档自动生成，接口文档需手工维护
- 契约一致性依赖工具链检查（`pnpm typecheck` / `pnpm test`），缺少编译期跨语言保证
- 新接入者需先理解自研信封而非通用 REST 约定

### 风险

| 风险 | 缓解措施 |
|------|---------|
| **文档与实现的字段名差异**：源文档 §2.2 写作 `params`，实际实现为 `payload` | criterion §5.4 已明确"实现口径（与文档差异，以本行为准）"；实现侧不得擅自改名 |
| 契约与实现漂移 | SSoT-first 顺序 + `pnpm typecheck` + `pnpm test` 双重校验 |
| `config.get` 返回结构被误改为嵌套 | 源文档明确：早期嵌套草案**从未实现**；改为嵌套属**破坏性变更**，须走版本化迁移（新旧字段并存至少一个版本）并同步更新客户端 |

---

## 合规性 (Compliance)

此决策的执行要求：

- 所有 RPC 方法**必须**返回统一信封 `{ ok, result?, error? }`
- 网关**必须**强制校验 `Content-Type: application/json`、`type === 'client-request'`、`method === 'ops'` 且 `payload` **必须存在**
- 方法入参字段名**必须**使用 `payload`（**不得**改为 `params`）
- 契约变更**必须**按 SSoT-first 顺序：`src/types.ts` → `src/ops-rpc.ts` → 实现 → 客户端与测试
- 业务代码**禁止**手写与契约等价的类型 / DTO
- 客户端**必须**经统一封装 `callOpsRpc` 调用，⛔ **禁止**绕过直连外部服务
- 错误码**必须**使用既有清单中的值，**不得**自造语义相近的新码

---

## 相关文档

- `api_strategy.md` §传输与协议、§错误码清单
- `container_component_view.md` §3.1 宿主 RPC 网关
- `tech_stack.md` §SSoT 与 Codegen 约束
- `risks_and_debt.md` TD-003
- `../criterion.md` §5.2 / §5.3 / §5.4 / §6 / §7
- 源文档 §2.2、§3
