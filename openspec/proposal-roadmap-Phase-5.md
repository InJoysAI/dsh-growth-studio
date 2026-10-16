# Phase 5: 出海平台与技能工坊

> **返回总纲**: [proposal-roadmap.md](./proposal-roadmap.md)
> **文件名**: `proposal-roadmap-Phase-5.md`
> **状态**: proposed
> **来源**: `.context/domain/business_rules.md`（BR-002、BR-042、BR-090）、`.context/domain/market_insights.md`、`.context/domain/risks_and_debt.md`（RISK-B003、PD-001、PD-002、PD-003）、`.context/architecture/risks_and_debt.md`（RISK-012、TD-006）、`.context/architecture/system_design.md`（`OverseasStrategyManager`）、`.context/architecture/introduction_and_goals.md`
> **预计工作量与周期**: 约 12 人日

## 阶段目标与范围

- 目标与交付结果：接入海外 4 平台（YouTube / X / Product Hunt / TikTok，先 PoC 再交付）、交付 5 大官方场景技能包（白名单 4~6 工具）、验证浏览器交互式登录端点 PoC，并推进 Injoys 排期双向同步与冲突仲裁。
- In / Out：
  - ✅ In：海外平台适配器与出海时区策略；5 大场景技能包；`browser.login.*` PoC；Injoys 双向同步与冲突解决。
  - ❌ Out：自定义技能包编辑器与第三方服务动态挂载（PRD 更后阶段）；现有国内平台能力重做。
- 适用约束：BR-002/BR-042 分阶段渠道与技能包口径；BR-042 技能包名称以 PRD 为准（名称取舍须产品负责人确认）；BR-090 登录方式演进须以 PoC 结论为准，**不得表述为「已支持」或「将支持」**；BR-024 Phase 3 才支持双向同步与冲突仲裁；criterion §4 铁律（仅预填、Cookie 零外发、最小权限）。

> [!NOTE]
> 本路线图的 Phase 编号是**实施规划阶段**，与 PRD §七 里程碑编号不是同一套：本 Phase 5 覆盖 PRD 所述 **Phase 2（出海平台 / 技能包 / 登录 PoC）** 与 **Phase 3（双向同步 / 自定义技能编辑器）** 的交付内容。

## 提案详情

### 提案 1: 海外 4 平台适配器接入

**Change ID:** `feat-overseas-platform-adapters`  
**优先级:** P1  
**预计时间:** 4 人日  
**状态:** proposed

**业务目标（Business Goal）**:
- 接入 YouTube / X / Product Hunt / TikTok 四个海外平台适配器与出海增长 / 时区策略（`OverseasStrategyManager`），扩充「就绪渠道」范围（BR-002）。
- 按 RISK-B003 先以 PoC 验证浏览器侧可行性并输出可行性报告与边界定义，验证通过后再进入交付；无法稳定支持的平台降级为「物料生成 + 手工发布」，不承诺预填能力。
- 出海物料提供推文串与 Launch Kit 模拟器（BR-032）。

**范围边界（In / Out）**:

| 类型 | 内容 |
|------|------|
| ✅ In | 4 平台适配器（经 Adapter 层解耦）、时区策略、海外渠道就绪统计、推文串 / Launch Kit 模拟器 |
| ✅ In | 交付前 PoC 可行性验证与边界定义 |
| ❌ Out | 内嵌扫码登录（见提案 3） |
| ❌ Out | 未通过 PoC 平台的预填能力承诺 |

> [!NOTE]
> 平台差异一律收敛到 Adapter 层，禁止在通用流程中写平台分支（criterion §3.2）；未通过验证的平台降级为「物料生成 + 手工发布」。

**关联 Context 资产**:

| Scope | 关联资产 | 关联说明 |
|-------|---------|----------|
| criterion | `.context/criterion.md` | §3.2 平台差异收敛到 Adapter、§4 铁律 |
| architecture | `.context/architecture/system_design.md` | `OverseasStrategyManager`、AdapterRegistry |
| domain | `.context/domain/business_rules.md` | BR-002、BR-032 |
| domain | `.context/domain/risks_and_debt.md` | RISK-B003、PD-001 |
| domain | `.context/domain/market_insights.md` | 海外渠道目标与合规差异 |

**关键任务**:
1. 4 平台浏览器侧 PoC 与可行性报告 / 边界定义（1 人日）
2. 实现 4 平台适配器（1.5 人日）
3. 实现出海增长与时区策略（0.75 人日）
4. 推文串 / Launch Kit 模拟器（0.5 人日）
5. 补测试与就绪统计接入（0.25 人日）

**验证标准**:

| 验收项 | 验收条件 | 验收方式 |
|--------|----------|----------|
| PoC 先行 | 交付前产出可行性报告与边界定义 | 文档检查 |
| 适配解耦 | 平台差异仅在 Adapter 层，通用流程无平台分支 | 代码审查 |
| 就绪统计 | 仅交付渠道出现在就绪渠道统计 | 单元测试 / 手工验证 |
| 降级 | 未通过验证的平台降级为物料生成 + 手工发布 | 手工验证 |

**依赖**:
- 前置: `feat-client-engine-config`
- 被依赖: `feat-browser-login-poc`
- 约束: 先 PoC 后交付；不承诺未验证能力。

---

### 提案 2: 5 大官方场景技能包与工具裁剪

**Change ID:** `feat-scenario-skill-packs`  
**优先级:** P2  
**预计时间:** 3 人日  
**状态:** proposed

**业务目标（Business Goal）**:
- 交付 5 大官方内置技能包，每个技能包仅注入 4~6 个白名单工具，收敛上下文规模（BR-042、BR-NFR-004、PD-002）。
- 启用技能包后可用工具范围收敛为该包白名单，经工具中枢呈现。

**范围边界（In / Out）**:

| 类型 | 内容 |
|------|------|
| ✅ In | 5 大官方技能包与白名单切片（`SkillEngine`）；启用后工具范围收敛 |
| ✅ In | 与工具中枢启停能力联动 |
| ❌ Out | 自定义技能包编辑器与第三方服务动态挂载（PRD 更后阶段） |
| ❌ Out | 擅自改用开发计划中的技能包名称 |

> [!NOTE]
> 技能包名称**以 PRD §5.5.2 为准**（新版本发布、全球出海、舆情监听、热点排期、多端改编）。开发计划另有不一致表述，两组名称的取舍须在交付前由产品负责人确认；确认前提案不得自行改用开发计划名称（BR-042 名称口径说明）。

**关联 Context 资产**:

| Scope | 关联资产 | 关联说明 |
|-------|---------|----------|
| criterion | `.context/criterion.md` | §3.1 不在客户端承载业务规则、§4 铁律 |
| domain | `.context/domain/business_rules.md` | BR-042、BR-NFR-004 |
| domain | `.context/domain/risks_and_debt.md` | PD-002 |
| architecture | `.context/architecture/api_strategy.md` | §3.5 工具治理（白名单切片） |

**关键任务**:
1. 实现 `SkillEngine` 与技能包白名单切片（1 人日）
2. 交付 5 大官方技能包（1 人日）
3. 启用后工具范围收敛与中枢联动（0.75 人日）
4. 补测试：启用后可用工具收敛为白名单（0.25 人日）

**验证标准**:

| 验收项 | 验收条件 | 验收方式 |
|--------|----------|----------|
| 白名单收敛 | 启用技能包后可用工具收敛为该包 4~6 个工具 | 单元测试 |
| 名称口径 | 技能包名称以 PRD 为准，未擅自改用计划名称 | 文档检查 |
| 无发布工具 | 技能包白名单不含任何发布类工具 | 单元测试 |

**依赖**:
- 前置: `feat-tools-hub-sandbox`
- 被依赖: —
- 约束: 白名单不含发布类工具；名称口径以 PRD 为准。

---

### 提案 3: 浏览器交互式登录端点 PoC 验证

**Change ID:** `feat-browser-login-poc`  
**优先级:** P2  
**预计时间:** 2 人日  
**状态:** proposed

**业务目标（Business Goal）**:
- 按 BR-090 / RISK-012 对 `browser.login.startQr` / `pollQr` / `openHeadful` / `cancel` 做 **PoC 验证**：验证内嵌扫码浮层、可视前台认证小窗、隔离登录环境三项设想是否可行，依赖 BrowserOS CDP 高级 API。
- 交付物是**可行性报告与能力边界定义**，而非既有功能承诺；验证不通过则不交付该能力，回退到 Phase 0 的引导式扫码登录。

**范围边界（In / Out）**:

| 类型 | 内容 |
|------|------|
| ✅ In | CDP 能力 PoC；可行性报告与边界定义；不通过时的回退方案 |
| ❌ Out | 未验证前对外宣称「已支持 / 将支持」 |
| ❌ Out | 绕过最小权限的动作（禁用 shell / cmd） |

> [!NOTE]
> ⚠️ 不得把 PoC 表述为「已支持」或「将支持」；实际交付范围以验证结论为准（BR-090）。

**关联 Context 资产**:

| Scope | 关联资产 | 关联说明 |
|-------|---------|----------|
| criterion | `.context/criterion.md` | §4 最小权限、会话零外发 |
| architecture | `.context/architecture/risks_and_debt.md` | RISK-012、RISK-003 |
| domain | `.context/domain/business_rules.md` | BR-090、BR-010 |
| domain | `.context/domain/risks_and_debt.md` | PD-001 |
| architecture | `.context/architecture/api_strategy.md` | §3.4 `browser.login.*`（Phase 2 愿景） |

**关键任务**:
1. CDP 能力验证脚本与三项设想可行性结论（1 人日）
2. 输出可行性报告与能力边界定义（0.5 人日）
3. 不通过时的回退方案确认（0.5 人日）

**验证标准**:

| 验收项 | 验收条件 | 验收方式 |
|--------|----------|----------|
| 交付物为报告 | 产出可行性报告与边界定义，而非功能上线声明 | 文档检查 |
| 回退可用 | 验证不通过时回退到引导式扫码登录 | 手工验证 |
| 会话安全 | Cookie 零外发 | 代码审查 |

**依赖**:
- 前置: `feat-overseas-platform-adapters`
- 被依赖: —
- 约束: 以 PoC 结论为准；最小权限禁用 shell / cmd。

---

### 提案 4: Injoys 排期双向同步与冲突仲裁

**Change ID:** `feat-injoys-bidirectional-sync`  
**优先级:** P2  
**预计时间:** 3 人日  
**状态:** proposed

**业务目标（Business Goal）**:
- 在 Phase 1 单向导入 / 导出基础上，按 PRD §5.3 规划引入**行级 ID 映射表 + 时间戳版本 + LWW + 冲突行拆分标记**，支持本地排期与 Injoys 表格的实时双向同步与冲突解决（BR-024、PD-003、TD-006）。
- 明确冲突解决规则后再交付，避免本地与云端同一条记录被同时修改而相互覆盖（RISK-B005）。

**范围边界（In / Out）**:

| 类型 | 内容 |
|------|------|
| ✅ In | 行级 ID 映射表、时间戳版本、LWW、冲突行拆分标记；双向同步与冲突仲裁规则 |
| ✅ In | 冲突解决规则收口（未收口则维持单向，不升级） |
| ❌ Out | 破坏 Phase 1 单向导入 / 导出的既有语义 |
| ❌ Out | 覆盖式盲写 |

**关联 Context 资产**:

| Scope | 关联资产 | 关联说明 |
|-------|---------|----------|
| architecture | `.context/architecture/api_strategy.md` | §3.1 导入 / 导出冲突规则、§3.3 排期接口 |
| architecture | `.context/architecture/adr_004_local_primary_injoys_export.md` | 由单向到双向的演进边界 |
| architecture | `.context/architecture/risks_and_debt.md` | TD-006、RISK-004 |
| domain | `.context/domain/business_rules.md` | BR-024 |
| domain | `.context/domain/risks_and_debt.md` | RISK-B005、PD-003 |

**关键任务**:
1. 设计并实现行级 ID 映射表 + 时间戳版本（1 人日）
2. 实现 LWW 与冲突行拆分标记 / 冲突仲裁（1 人日）
3. 接入双向同步并保留单向回退（0.75 人日）
4. 补测试：冲突不覆盖、LWW 判定、冲突标记（0.25 人日）

**验证标准**:

| 验收项 | 验收条件 | 验收方式 |
|--------|----------|----------|
| 不覆盖 | 同记录双向修改按冲突规则处理，不静默覆盖 | 单元测试 |
| LWW | 按时间戳版本判定，冲突行有拆分标记 | 单元测试 |
| 回退 | 规则未收口时维持单向模式 | 手工验证 |
| 审查通过 | `pnpm typecheck` 与 `pnpm test` 通过 | `pnpm typecheck` / `pnpm test` |

**依赖**:
- 前置: `feat-calendar-injoys-import`、`feat-calendar-injoys-export`
- 被依赖: —
- 约束: 冲突规则未收口不得升级为双向；不得覆盖式盲写。

---

## 执行顺序与依赖

- `feat-overseas-platform-adapters` 先产出 PoC 与适配器；`feat-browser-login-poc` 依赖其结论。
- `feat-scenario-skill-packs` 依赖 Phase 3 的 `feat-tools-hub-sandbox`，可与海外适配器并行。
- `feat-injoys-bidirectional-sync` 依赖 Phase 1 的导入 / 导出，可与上述并行。

- 跨阶段前置条件：`feat-overseas-platform-adapters` 依赖 Phase 2 的 `feat-client-engine-config`；`feat-scenario-skill-packs` 依赖 Phase 3 的 `feat-tools-hub-sandbox`；`feat-injoys-bidirectional-sync` 依赖 Phase 1 的单向能力。
- 提供给后续阶段的能力：海外渠道与出海策略、技能包体系、登录端点能力边界、双向同步（PRD 更后阶段的自定义技能编辑器与第三方动态挂载的基座）。

## 阶段整体验收

- 全量 `pnpm typecheck` 与 `pnpm test` 通过。
- 海外平台先 PoC 后交付，未验证平台降级为「物料生成 + 手工发布」。
- 技能包名称以 PRD 为准、白名单 4~6 个工具且不含发布类工具。
- 登录端点以可行性报告为交付物，不表述为「已支持 / 将支持」。
- 双向同步冲突规则收口后方可升级；不得覆盖式盲写；铁律（仅预填、Cookie 零外发）持续成立。
