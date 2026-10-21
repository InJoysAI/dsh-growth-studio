# Phase 2: 内容沉淀与 AI 工具中枢

> **返回总纲**: [proposal-roadmap.md](./proposal-roadmap.md)
> **文件名**: `proposal-roadmap-Phase-2.md`（编号与总纲阶段总览一致：Phase 2 → `Phase-2`）
> **状态**: proposed
> **来源**: `.context/architecture/risks_and_debt.md`（TD-001）；`.context/architecture/api_strategy.md` §3.1 / §3.5 / §3.10；`.context/architecture/security_policy.md`；`.context/architecture/adr_003_custom_rpc_envelope.md`；`.context/domain/risks_and_debt.md`（PD-002 / PD-006）；`.context/domain/testing_strategy.md` 模块 7 / 8
> **预计工作量与周期**: ~12.5 人日（**规划估算**；源文档工作量字段为 `N/A – 源文档未提供`）

## 阶段目标与范围

- **目标与交付结果**：补齐「用户显式触发」的**唯一**物料沉淀入口（`workbench.sinkToInjoysDoc`，衔接 Phase 0 已移除的未授权写入），并落地 AI 工具中枢的最小可实施契约（工具目录、白名单开关、单步调试沙箱、脱敏遥测）。
- **In / Out**：
  - ✅ In：`workbench.sinkToInjoysDoc` 契约与实现（唯一授权沉淀入口、幂等更新、`injoysDocId` 回写、目录固定）；`tools.catalog` / `tools.toggle` / `tools.executeSandbox` / `tools.telemetry` 契约与实现；宿主侧白名单强制校验；收口 PD-006 中**阶段未定**的 2 个工具（`ops_keyword_research` / `ops_generate_hooks`）的分类与归属（`ops_inspect_sessions` 已在 Phase 0 由 `fix-browser-session-cookie-probe` 按名登记）。
  - ❌ Out：5 大官方场景技能包与自定义技能包编辑器（PD-002，PRD Phase 2/3，**不在本路线图范围**）；`browser.login.*` 前台登录能力（PD-001，需 BrowserOS CDP PoC）；AI 工具中枢 UI（`feat-client-tools-console`，Phase 3）。
- **适用约束**：
  - `criterion.md` §4「写入 Injoys 必须由用户显式触发」「工具白名单宿主侧强制」「遥测必须脱敏」；
  - `criterion.md` §3.2「失败必须返回真实错误，不得以成功形状返回失败结果」；
  - `criterion.md` §3.5 目录固定（`sinkToInjoysDoc` 贯穿读取、远端调用与 `injoysDocId` 回写）；
  - 铁律：`ops_publish_now` 等发布类工具**不存在于 catalog**，`dangerous` 恒为 `false`。

## 提案详情

### 提案 1: 用户显式触发的物料沉淀入口

**Change ID:** `feat-workbench-sink-to-injoys-doc`  
**优先级:** P1  
**预计时间:** 3 人日（规划估算）  
**状态:** proposed  
**变更类型（change_kind）:** `code`（判定依据：新增或修改宿主 / 客户端业务代码及其测试；契约文档同步属 SSoT-first 随附动作，不单独计为文档类交付）  

**业务目标（Business Goal）**:
- 交付 `workbench.sinkToInjoysDoc`，作为写入 Injoys 知识文档的**唯一**用户显式触发入口，恢复被 Phase 0 移除的沉淀能力。
- 保证沉淀幂等（已存在 `injoysDocId` 时更新而非新建）、失败不谎报成功、`injoysDocId` 回写本地草稿。

**范围边界（In / Out）**:

| 类型 | 内容 |
|------|------|
| ✅ In | `workbench.sinkToInjoysDoc`（`draftId` / `platform` / `title`）契约与实现；链路 宿主 → `InjoysClient` → `document.create` |
| ✅ In | 成功后回写 `ContentDraft.injoysDocId`；重复沉淀幂等（更新而非新建） |
| ✅ In | 请求开始时捕获目录并贯穿读取、远端调用与回写（criterion §3.5） |
| ✅ In | 未配置 / 失败时返回 `success: false` 与真实错误信息 |
| ❌ Out | 生成路径的自动沉淀（Phase 0 已移除，不得恢复） |
| ❌ Out | 知识库的读取能力（既有能力，不改） |

**关联 Context 资产**:

| Scope | 关联资产 | 关联说明 |
|-------|---------|----------|
| criterion | `.context/criterion.md` | §4 内容写入边界、§3.5 目录贯穿、§3.2 不谎报 |
| architecture | `.context/architecture/risks_and_debt.md` | TD-008 解决方案第 ① 步、RISK-004（跨 await 目录固定） |
| architecture | `.context/architecture/api_strategy.md` | §3.1 `sinkToInjoysDoc` 语义与约束 |
| architecture | `.context/architecture/security_policy.md` | 内容写入边界的完整语义 |
| domain | `.context/domain/testing_strategy.md` | 模块 8 场景 2 / 3 |

**关键任务**:
1. 补 `src/types.ts` / `src/ops-rpc.ts` 的 `sinkToInjoysDoc` 契约（0.5 人日）
2. 实现沉淀链路与 `injoysDocId` 回写（1.25 人日）
3. 实现幂等（已存在则更新）与请求内目录固定（0.75 人日）
4. 补测试（显式触发成功 / 未配置如实失败 / 幂等更新 / 目录贯穿）（0.5 人日）

**风险与处理决定（按需）**:

| 风险 | 影响 | 处理决定及理由 |
|------|------|----------|
| 沉淀期间用户切换 `draftsDir` | 跨库覆盖同 ID 草稿 | 依 RISK-004 / criterion §3.5：请求开始时捕获目录并贯穿读取、远端调用与回写；属**确定语义**，不引入告警标记 |
| Injoys 侧重复文档 | 知识库冗余 | 默认更新既有 `injoysDocId` 文档，保证幂等 |

**验证标准**:

| 验收项 | 验收条件 | 验收方式 |
|--------|----------|----------|
| 显式触发才写远端 | 仅当调用本方法时才写 Injoys | 单元测试（mock）+ 代码审查 |
| 幂等 | 重复沉淀同一草稿更新而非新建 | 单元测试 |
| 失败如实 | 未配置 / 失败返回 `success: false` 与真实错误 | 单元测试 |
| 目录贯穿 | 请求内多次落盘针对同一目录 | 单元测试 |

**验收场景（按需，建议 BDD）**:

```gherkin
场景: 物料沉淀至 Injoys 知识文档（BR-033）
  Given 用户已生成一份渠道物料
  When 用户点击"沉淀至 Injoys 知识文档"
  Then 该物料应出现在 Injoys 知识文档中
    And 可在 Injoys 侧检索到该文档

场景: 知识库未连通时沉淀不可用（BR-073）
  Given 知识库中枢未连通
  When 用户点击"沉淀至 Injoys 知识文档"
  Then 界面应明确提示该能力不可用
    And 不得显示"沉淀成功"
```

**依赖**:
- 前置: `fix-unauthorized-injoys-doc-write`
- 被依赖: `feat-client-content-studio`
- 约束: 唯一授权入口；生成 / 预览 / 本地保存 / 自动同步配置均不能替代本次显式要求

---

### 提案 2: 工具目录与白名单开关

**Change ID:** `feat-tools-catalog-toggle`  
**优先级:** P1  
**预计时间:** 3 人日（规划估算）  
**状态:** proposed  
**变更类型（change_kind）:** `code`（判定依据：新增或修改宿主 / 客户端业务代码及其测试；契约文档同步属 SSoT-first 随附动作，不单独计为文档类交付）  

**业务目标（Business Goal）**:
- 交付 `tools.catalog` 与 `tools.toggle`，提供 AI 工具中枢的工具清单与启停治理，启停状态持久化到本地配置。
- 保证 `ops_publish_now` 等发布类工具**不存在于 catalog**，使自动发布能力无法构造调用。

**范围边界（In / Out）**:

| 类型 | 内容 |
|------|------|
| ✅ In | `OpsToolDescriptor` 契约（`name` / `description` / `category` / `driver` / `paramsSchema` / `enabled` / `dangerous`） |
| ✅ In | `tools.catalog`、`tools.toggle` 实现；启停状态持久化到本地配置，重启后保持 |
| ✅ In | `category` 按五类：`planning` / `creative` / `publishing` / `analytics` / `system` |
| ❌ Out | 沙箱执行（提案 3）、遥测（提案 4） |
| ❌ Out | 补齐 / 收口 2 个阶段未定的缺失工具（提案 5） |
| ❌ Out | 工具中枢 UI（Phase 3） |

**关联 Context 资产**:

| Scope | 关联资产 | 关联说明 |
|-------|---------|----------|
| criterion | `.context/criterion.md` | §4 工具白名单宿主侧强制、铁律（无发布工具） |
| architecture | `.context/architecture/risks_and_debt.md` | TD-001（`tools.catalog` / `tools.toggle`）、RISK-002 |
| architecture | `.context/architecture/api_strategy.md` | §3.5 `OpsToolDescriptor` 与 `tools.*` 契约 |
| domain | `.context/domain/risks_and_debt.md` | PD-006（工具分类登记） |
| domain | `.context/domain/testing_strategy.md` | 模块 7 场景 1 / 2 |

**关键任务**:
1. 补 `OpsToolDescriptor` 与 catalog / toggle 契约（0.5 人日）
2. 实现工具清单聚合（从 `src/tools/index.ts` 现有工具登记）（1 人日）
3. 实现 toggle 与启停状态持久化（1 人日）
4. 补测试（清单分类 / 无发布工具 / toggle 持久化）（0.5 人日）

**验证标准**:

| 验收项 | 验收条件 | 验收方式 |
|--------|----------|----------|
| 五类分组 | catalog 工具按五类分组，`dangerous` 恒为 `false` | 单元测试 |
| 无发布工具 | catalog 中不存在任何自动确认发布的工具 | 单元测试 + `grep` |
| 持久化 | toggle 后重启仍保持启停状态 | 单元测试 |

**验收场景（按需，建议 BDD）**:

```gherkin
场景: 工具按生命周期分类呈现（BR-040）
  Given 用户位于 AI 工具中枢
  When 用户查看工具目录
  Then 工具应按"策划与选题 / 创意与生成 / 分发与执行 / 分析与监听 / 系统与调度"五类分组

场景: 工具清单不含自动发布工具（BR-022 铁律）
  Given 用户位于 AI 工具中枢
  When 用户查看全量工具目录
  Then 目录中不得存在任何自动确认发布的工具
```

**依赖**:
- 前置: 无
- 被依赖: `feat-tools-sandbox-execute`、`feat-tools-lifecycle-gaps`、`feat-client-tools-console`
- 约束: 白名单强制校验在宿主侧（提案 3），本提案只负责清单与开关

---

### 提案 3: 单步调试沙箱执行

**Change ID:** `feat-tools-sandbox-execute`  
**优先级:** P1  
**预计时间:** 3 人日（规划估算）  
**状态:** proposed  
**变更类型（change_kind）:** `code`（判定依据：新增或修改宿主 / 客户端业务代码及其测试；契约文档同步属 SSoT-first 随附动作，不单独计为文档类交付）  

**业务目标（Business Goal）**:
- 交付 `tools.executeSandbox`，支持用户填写参数单步运行某个工具（无需多轮对话），并如实返回结果与耗时。
- 沙箱执行必须与服务端白名单**同源校验**，前端传入的工具名一律不可信。

**范围边界（In / Out）**:

| 类型 | 内容 |
|------|------|
| ✅ In | `tools.executeSandbox`（`name` / `params` / `dryRun?`）契约与实现；返回 `ok` / `result` / `error` / `durationMs` / `logs` |
| ✅ In | 宿主侧白名单强制校验：`enabled === false` 拒绝并返回 `tools/disabled` |
| ✅ In | 失败返回真实错误与 `durationMs`，不以成功形状返回失败结果 |
| ❌ Out | 遥测记录（提案 4） |
| ❌ Out | 技能包 / 多轮编排（PD-002，不在范围） |

**关联 Context 资产**:

| Scope | 关联资产 | 关联说明 |
|-------|---------|----------|
| criterion | `.context/criterion.md` | §4 白名单宿主侧强制、§3.2 不谎报 |
| architecture | `.context/architecture/risks_and_debt.md` | TD-001（`tools.executeSandbox`） |
| architecture | `.context/architecture/api_strategy.md` | §3.5 `tools.executeSandbox` 约束 |
| architecture | `.context/architecture/adr_003_custom_rpc_envelope.md` | 统一信封与错误边界 |
| domain | `.context/domain/testing_strategy.md` | 模块 7 场景 3 |

**关键任务**:
1. 补 `executeSandbox` 契约（0.5 人日）
2. 实现白名单同源校验与 `tools/disabled`（0.75 人日）
3. 实现工具单步执行与真实结果 / 耗时返回（1.25 人日）
4. 补测试（禁用拒绝 / 执行成功 / 失败如实返回）（0.5 人日）

**验证标准**:

| 验收项 | 验收条件 | 验收方式 |
|--------|----------|----------|
| 宿主侧校验 | `enabled === false` 的工具执行被拒（不依赖前端隐藏按钮） | 单元测试 |
| 真实结果 | 成功返回结果，失败返回真实错误与 `durationMs` | 单元测试 |
| 单步可用 | 无需多轮对话即可单步运行 | 单元测试 |

**验收场景（按需，建议 BDD）**:

```gherkin
场景: 单步调试沙箱（BR-041）
  Given 用户位于可视化单步调试沙箱
  When 用户填写参数并运行某个工具
  Then 应展示该工具的结构化返回结果
    And 应展示执行耗时
    And 无需经过多轮对话即可完成单步运行
```

**依赖**:
- 前置: `feat-tools-catalog-toggle`
- 被依赖: `feat-tools-telemetry`、`feat-client-tools-console`
- 约束: 前端传入的工具名不可信，校验在宿主侧

---

### 提案 4: 工具执行遥测（脱敏）

**Change ID:** `feat-tools-telemetry`  
**优先级:** P2  
**预计时间:** 2 人日（规划估算）  
**状态:** proposed  
**变更类型（change_kind）:** `code`（判定依据：新增或修改宿主 / 客户端业务代码及其测试；契约文档同步属 SSoT-first 随附动作，不单独计为文档类交付）  

**业务目标（Business Goal）**:
- 交付 `tools.telemetry`，记录工具执行（工具名 / 时间 / 耗时 / 成败 / 错误码）供性能审计。
- 遥测记录**必须脱敏**：不得记录令牌、Cookie 或完整正文。

**范围边界（In / Out）**:

| 类型 | 内容 |
|------|------|
| ✅ In | `tools.telemetry`（`limit?`）契约与实现 |
| ✅ In | 执行时写入脱敏遥测条目（`toolName` / `startedAt` / `durationMs` / `ok` / `errorCode?`） |
| ✅ In | 明确排除令牌 / Cookie / 完整正文 |
| ❌ Out | 遥测的导出 / 上报到任何第三方（**禁止**） |
| ❌ Out | 保留时长策略（源文档未提供，N/A） |

**关联 Context 资产**:

| Scope | 关联资产 | 关联说明 |
|-------|---------|----------|
| criterion | `.context/criterion.md` | §4 遥测脱敏、会话数据零外发 |
| architecture | `.context/architecture/risks_and_debt.md` | TD-001（`tools.telemetry`）、RISK-011（脱敏） |
| architecture | `.context/architecture/api_strategy.md` | §3.5、§5.3 遥测脱敏要求 |
| architecture | `.context/architecture/security_policy.md` | 敏感字段与日志脱敏 |

**关键任务**:
1. 补 `telemetry` 契约（0.5 人日）
2. 实现脱敏遥测写入（0.75 人日）
3. 实现 `tools.telemetry` 读取（0.5 人日）
4. 补测试（记录字段 / 无敏感字段）（0.25 人日）

**验证标准**:

| 验收项 | 验收条件 | 验收方式 |
|--------|----------|----------|
| 记录完整 | 遥测含工具名 / 时间 / 耗时 / 成败 / 错误码 | 单元测试 |
| 脱敏 | 遥测条目不含令牌 / Cookie / 完整正文 | 单元测试 + 代码审查 |
| 零外发 | 遥测不向任何第三方上报 | 代码审查 |

**依赖**:
- 前置: `feat-tools-sandbox-execute`
- 被依赖: `feat-client-tools-console`
- 约束: 脱敏为硬性要求（criterion §4）

---

### 提案 5: 收口生命周期分类中阶段未定的 2 个工具

**Change ID:** `feat-tools-lifecycle-gaps`  
**优先级:** P2  
**预计时间:** 1.5 人日（规划估算）  
**状态:** proposed  
**变更类型（change_kind）:** `mixed`（判定依据：交付物可能是「补阶段归属并实现/登记」（代码）或「显式标注移出范围」（文档），二者并列且未裁决，故按混合计）  

**业务目标（Business Goal）**:
- 收口 PRD §5.5.1「工具全景与生命周期分类」中**阶段未定**、且未实现的 `ops_keyword_research`（策划与选题）、`ops_generate_hooks`（创意与生成）两个工具：或补阶段归属并实现 / 登记，或**显式标注移出范围**。
- 使 BR-040「工具中枢按五类分组展示，**每组包含对应工具**」在「策划与选题 / 创意与生成」两类不再存在「类别无对应工具」的不可判定缺口。

**范围边界（In / Out）**:

| 类型 | 内容 |
|------|------|
| ✅ In | 对 `ops_keyword_research` / `ops_generate_hooks` 各自裁定「实现（按名登记，纳入 `tools.catalog` 五类分组）」或「**显式标注移出范围**」，并记录依据 |
| ✅ In | 若某工具移出范围，在资产侧**显式标注**，避免「遗漏」与「范围变更」不可区分，且 `src/tools/index.ts` 不残留半成品登记 |
| ❌ Out | `ops_inspect_sessions`（属 Phase 0，已在 `fix-browser-session-cookie-probe` 中按名登记，本提案不重复） |
| ❌ Out | 5 大官方场景技能包（PD-002，不在范围） |
| ❌ Out | 工具中枢 UI（Phase 3） |

> [!NOTE]
> PD-006 原列 3 个未实现工具；其中 `ops_inspect_sessions` 已由 Phase 0 的 `fix-browser-session-cookie-probe` 按名登记并映射到已实现的 `browser.sessions`（`api_strategy.md` §3.10 阶段列标 Phase 0），故本提案收窄为 `ops_keyword_research` / `ops_generate_hooks` 两项。二者在 `api_strategy.md` §3.10 的阶段列标「未定」，PRD / 开发计划未提供阶段归属，故本提案按「能实现则实现、否则显式标注移出范围」处理；**具体取舍为待决事项**，须在提案创建时依 `criterion.md` §3.1「不在客户端承载核心业务规则」与 SSoT 顺序定夺。

**关联 Context 资产**:

| Scope | 关联资产 | 关联说明 |
|-------|---------|----------|
| criterion | `.context/criterion.md` | §3.1、§6 SSoT-first |
| domain | `.context/domain/risks_and_debt.md` | PD-006（阶段未定的 2 个工具） |
| architecture | `.context/architecture/api_strategy.md` | §3.5 `category` 五类定义、§3.10 `ops_*` 映射（`ops_keyword_research` / `ops_generate_hooks` 阶段「未定」） |
| domain | `.context/domain/testing_strategy.md` | 模块 7 场景 1（BR-040） |

**关键任务**:
1. 确认 `ops_keyword_research` / `ops_generate_hooks` 的归属阶段与分类（0.5 人日）
2. 对选择实现者按名登记 / 实现（0.75 人日）
3. 对移出范围者补显式标注，并核对 `src/tools/index.ts` 无半成品残留（0.25 人日）

**验证标准**:

| 验收项 | 验收条件 | 验收方式 |
|--------|----------|----------|
| 分类完整 | 「策划与选题 / 创意与生成」两类均有对应工具（或显式标注移出） | 单元测试 + 资产审查 |
| 取舍定性 | 两个工具在 `criterion.md` §3.1 与 SSoT 顺序下各自定妥「实现」或「移出范围」，并记录依据 | 资产审查 + 代码审查 |
| 实现则登记 | **对选择实现的工具**：工具名在 `src/tools/index.ts` 可检索，并纳入 `tools.catalog` 对应五类分组 | `grep` + 单元测试 |
| 移出则标注 | **对选择移出范围的工具**：在资产侧显式标注移出范围与理由，且 `src/tools/index.ts` 不残留半成品登记 | `grep` + 资产审查 |
| 不重复登记 | `ops_inspect_sessions` 不在本提案重复登记（已在 Phase 0 完成） | `grep` + 代码审查 |

**验收场景（按需，建议 BDD）**:

```gherkin
场景: 工具按生命周期分类呈现（BR-040）
  Given 用户位于 AI 工具中枢
  When 用户查看工具目录
  Then 每组应包含属于该类的工具
```

**依赖**:
- 前置: `feat-tools-catalog-toggle`
- 被依赖: 无
- 约束: 分类以 `api_strategy.md` §3.5 五类为准；`ops_inspect_sessions` 的登记归属 Phase 0，本提案不越界

---

## 执行顺序与依赖

- **关键路径**：`feat-tools-catalog-toggle` → `feat-tools-sandbox-execute` → `feat-tools-telemetry`。
- **可并行**：`feat-workbench-sink-to-injoys-doc` 与工具主线**完全并行**；`feat-tools-lifecycle-gaps` 只依赖 catalog。
- 跨阶段前置条件：`feat-workbench-sink-to-injoys-doc` 依赖 Phase 0 的 `fix-unauthorized-injoys-doc-write`（先移除未授权写入，再补唯一授权入口）。
- 提供给后续阶段的能力：唯一沉淀入口（供 Phase 3 `feat-client-content-studio`）；`tools.*` 契约（供 Phase 3 `feat-client-tools-console`）。

## 阶段整体验收

- 模块 7 / 8 BDD 场景通过：工具五类分组、目录无发布工具、单步沙箱、物料沉淀、知识库未连通时沉淀不可用。
- `pnpm typecheck` + `pnpm test` 通过；新增用例覆盖显式触发、幂等沉淀、白名单宿主侧校验、遥测脱敏、工具分类完整。
- 代码审查确认：`tools.*` 链路无令牌 / Cookie / 完整正文外泄，catalog 无发布类工具。

## 待决事项（按需）

- PD-006 中阶段未定的 2 个工具（`ops_keyword_research` / `ops_generate_hooks`）属「实现」还是「显式移出范围」（提案 5 任务 1）；PRD / 开发计划未标注其交付阶段，需在提案创建时定夺并同步资产。（`ops_inspect_sessions` 已属 Phase 0，不在本待决项内。）
