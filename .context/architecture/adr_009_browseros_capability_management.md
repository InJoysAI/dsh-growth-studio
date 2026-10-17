# ADR-009: BrowserOS 能力开关取代固定动作白名单

**状态**: Accepted
**日期**: 2026-10-17（源文档 v1.4.0）
**决策者**: 用户裁决（MVP 已确认）

---

## 上下文 (Context)

早期架构以「最小权限」为名，把 BrowserOS 驱动限制为固定四动作 `tabs / navigate / snapshot / act`，并**永久禁用 `shell`/`cmd`**。该口径在 criterion §4 及多份 architecture 资产中反复复述。

但实现侧（`src/browser/browseros-bridge.ts` / `browser-driver.ts` / `browseros-ops.ts`）实际调用了 `read` / `grep` / `wait` / `upload` 等更多工具，且没有宿主侧校验。文档的「封闭白名单」与实现的「开放集合」长期分叉，形成 TD-012 安全边界缺口。

**当前面临什么问题？**

- 固定白名单**误伤合法能力**：§3.6 B站预填依赖 `upload`，§3.12.5 复合操作依赖 `navigate/snapshot/act/upload`，据此实施会写出跑不通的预填。
- 「永久禁用 shell/cmd」**不可解除**，但 BrowserOS 连接实际暴露的工具集由连接本身决定，插件无权也无需替用户一刀切封死。
- 缺宿主侧检查：即便收窄白名单，实现仍无统一入口校验，安全审查无法取证。

---

## 决策驱动因素 (Decision Drivers)

- **最小权限落地**：能力开关在宿主侧真实生效，而非仅文档声明
- **灵活性**：全部实际能力可开关，不永久封死任何工具
- **业务守卫不解除**：能力开关只决定「可调用」，不等于允许自动发布或外传 Cookie
- **复用现有集成**：不新增独立 MCP 连接、能力发现服务、后台轮询或常驻进程

---

## 备选方案 (Considered Options)

### 方案 A: 维持固定四动作白名单 + 永久禁用 shell/cmd（**旧口径，被替代**）

**优点**: 边界清晰、易于审计。

**缺点**:
- 与实现分叉（实际调用 read/grep/wait/upload），无法落地
- 误伤预填必需能力（upload）
- 永久禁用不可解除，无法适配连接实际暴露的工具集

### 方案 B: 能力开关模型（**采用**）

**描述**:
1. 复用现有 BrowserOS 工具清单，默认启用八项 `tabs / navigate / snapshot / act / read / grep / wait / upload`；
2. 其余实际暴露工具默认关闭、可手动开启；不存在永久禁用项（`shell`/`cmd` 若暴露同样由用户管理）；
3. 用户显式保存的启停选择优先于默认值，重启不重置；
4. 所有 BrowserOS 调用经 `BrowserOsMcpClient.callTool` 统一入口，集中检查「工具存在 / 启用 / 连接可用」，Adapter 禁止绕过；
5. 经 `ops_*` 调用时「运营工具开关 + 引擎能力开关」两层同时满足。

**优点**:
- 最小权限在宿主侧可实施、可审计
- 不误伤合法能力，适配连接实际暴露的工具集
- 保留业务守卫（自动发布禁止、Cookie 零外发不解除）

**缺点**:
- 需新增 `browserosCapabilities` 配置字段、`browseros.capabilities` 方法、`browser/*` 错误码与统一检查实现（当前均未实现，见 TD-012）
- 细粒度行为拦截（如区分「保存草稿」与「确认发布」按钮）**尚未确定**，不能宣称工具启停即等于行为拦截

---

## 决策 (Decision)

**我们决定采用**: **方案 B —— 能力开关模型**

理由：

1. 固定白名单与实现长期分叉，无法落地；能力开关让「最小权限」在宿主侧真实生效；
2. 复用现有集成、不新增基础设施，符合 MVP 范围；
3. 业务守卫（自动发布禁止、Cookie 零外发）**不因能力开关解除**，安全边界不被削弱。

> ⚠️ **边界（不得夸大）**：能力开关只决定「哪些 BrowserOS 工具可调用」；业务流程与守卫决定「工具可执行哪些行为」。**不得**宣称「仅靠工具启停检查就能保证不会自动发布或外传 Cookie」。细粒度行为拦截能力当前**未确定**，须如实记录边界。

---

## 后果 (Consequences)

### 正面影响

- 最小权限边界在宿主侧可实施、可审计，消除 TD-012 的「文档封闭 / 实现开放」分叉
- 预填必需能力（upload）不再被误伤
- 全部实际能力可开关，灵活适配连接实际暴露的工具集

### 负面影响

- 需新增配置字段 / 方法 / 错误码 / 统一检查（当前未实现，见 TD-012 与 TD-001）
- 未暴露工具不伪造、不承诺支持，需在 UI 如实标注不可用原因

### 风险

| 风险 | 缓解措施 |
|------|---------|
| 误把「能力开关」当「行为拦截」 | 明确边界：启用 `act` 不等于允许自动发布/外传 Cookie；细粒度拦截未定，如实记录 |
| 旧配置缺字段抛 TypeError | 默认值解析：`!= null` 短路 + `hasOwnProperty` + `Set.has`，不命中原型 |
| 用户关闭默认能力后重启被重置 | 显式保存优先于默认值，重启不重置 |

---

## 合规性 (Compliance)

此决策的执行要求：

- 所有 BrowserOS 调用**必须**经 `BrowserOsMcpClient.callTool` 统一入口，Adapter 禁止绕过
- 默认八项 + 其余默认关闭可手动开启；不存在永久禁用项
- `OpsConfig.browserosCapabilities` 默认值解析用 `Set.has` + `hasOwnProperty`（空值前置短路）
- 新增 `browser/capability-disabled` / `browser/tool-unavailable` / `browser/not-connected` 三个错误码
- **不解除**「禁止自动发布 / Cookie 零外发」业务守卫

---

## 相关文档

- 源文档 §3.12（能力管理契约）、§3.13（ops_* ↔ RPC 映射）
- `criterion.md` §4（最小权限权威口径）
- `api_strategy.md` §3.9（`browseros.capabilities`）、§2.3（browser/* 错误码）
- `security_policy.md` §授权边界、§假阳性防治
- `risks_and_debt.md` TD-012（能力开关实现尚未对齐）
