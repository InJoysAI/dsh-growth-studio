# .context/domain/ — 业务领域上下文

> **Metadata**
> - **Source**: `.context/domain/source/product_requirements.md`（PRD v1.1.0）、`.context/domain/source/development_plan.md`
> - **Generated At**: `2026-10-16 09:00`
> - **Generator**: `Context-Agent v1.0`

---

## 目录用途

存储**业务领域知识**：业务方不看代码也能读懂、能验收的内容。
技术实现（代码标识符、存储路径、锁/事务、接口/错误码、框架选型）属于 `.context/criterion.md` 与 `.context/architecture/`，不在本目录重复。

**读取优先级**：
1. 日常任务 → 读取下列总结文件（快速）
2. 提案检查 → 读取总结 + 业务规则验证
3. 遇到不确定/细节问题 → **回溯 `source/` 目录验证**

> ⚠️ **若总结与源文档冲突，以 `source/` 目录中的源文档为准**

---

## 源文档（只读）

| 文件 | 类型 | 内容概要 |
|------|------|---------|
| `source/product_requirements.md` | 需求类（权威主来源） | PRD v1.1.0：产品愿景、用户画像、6 大功能模块规格、Phase 0–3 里程碑与验收标准 |
| `source/development_plan.md` | 计划类（辅助） | 开发与落地计划：实现基线与阶段任务拆解。**仅用于确认阶段范围与交付节奏，不从中抽取业务规则** |

---

## 已生成总结

| 文件 | 用途 | 主要来源 |
|------|------|---------|
| [`business_rules.md`](./business_rules.md) | 业务规则：产品定位与范围、会话四态、内容五态流转、发布确认闭环、预填安全边界、指标真实性、界面规范（BR-001 ~ BR-NFR-004） | PRD §2、§5、§6 |
| [`user_journeys.md`](./user_journeys.md) | 5 条核心用户旅程（晨会巡检 / 选题排期 / 内容创作 / 预填发布 / 舆情复盘）、3 个用户画像、异常流程、客户旅程地图 | PRD §3 |
| [`market_insights.md`](./market_insights.md) | 商业价值陈述、目标与成功度量、用户画像、竞品对标、价值主张 | PRD §2、§3.1、§7 |
| [`testing_strategy.md`](./testing_strategy.md) | 8 大模块 BDD 验收场景（含工具中枢与沙箱、热点采用与知识沉淀）、覆盖要求、性能目标、安全合规验收、UAT 流程与 Phase 0 Live 实测清单 | PRD §5、§7；开发计划 §三 |
| [`risks_and_debt.md`](./risks_and_debt.md) | 业务/项目风险 5 项（RISK-B001~B005）、内外依赖、项目债务 5 项（PD-001~005） | PRD §5、§7；开发计划 §二 |
| [`data_strategy.md`](./data_strategy.md) | 平台指标清单、公共信息、数据治理、核心指标口径定义、数据质量要求、里程碑 | PRD §5.1.2、§5.3.2、§5.6 |
| [`edge_cases.md`](./edge_cases.md) | 用户视角异常场景：AI 生成、平台会话、草稿预填、指标数据、网络、多端并发、界面状态文案 | PRD §5、§6 |

> 未生成的模板文件（`market_insights` 之外的模板章节）已按 PRD 内容适配；PRD 未涉及的章节（额度限制、内容审查、过期链接、支付异常）已在 `edge_cases.md` 中整节删除。

---

## 编号索引

### 业务规则（`business_rules.md`）

| 分组 | 编号范围 | 主题 |
|------|---------|------|
| 一 | BR-001 ~ BR-003 | 产品定位与范围 |
| 二 | BR-010 ~ BR-012 | 渠道会话状态管理（四态生命周期） |
| 三 | BR-020 ~ BR-024 | 内容日历与发布流水线（五态流转、发布闭环、**全渠道发布条件**） |
| 四 | BR-030 ~ BR-033 | 内容创作室（物料生成、多渠道适配、模拟器） |
| 五 | BR-040 ~ BR-042 | AI 运营工具中枢 |
| 六 | BR-050 ~ BR-055 | 舆情监控与数据复盘（指标真实性） |
| 七 | BR-060 | 热点选题雷达 |
| 八 | BR-070 ~ BR-073 | 引擎与平台配置 |
| 九 | BR-080 ~ BR-083 | 界面与交互规范 |
| 十 | BR-090 | 身份认证演进（产品愿景） |
| 十一 | BR-NFR-001 ~ BR-NFR-004 | 非功能性要求（PRD 明文条目摘要） |

> **铁律**：BR-021（发布确认闭环）与 BR-022（预填安全边界）—— 任何提案不得引入自动确认发布的能力。

### 风险与债务（`risks_and_debt.md`）

| 编号 | 名称 | 等级 |
|------|------|------|
| RISK-B001 | 平台页面结构变动导致预填失效 | 极高风险 |
| RISK-B002 | 平台账号权限不足导致渠道不可用 | 中风险 |
| RISK-B003 | 海外平台合规与区域可达性差异 | 高风险 |
| RISK-B004 | 人工发布环节的体验断点 | 中风险（已接受） |
| RISK-B005 | 多平台同步冲突造成数据覆盖 | 高风险 |
| PD-001 | 登录方式降级为统一浏览器实例手工扫码 | 中 |
| PD-002 | 技能工坊与第三方扩展推迟交付 | 中 |
| PD-003 | Injoys 同步能力长期停留在单向 | 中 |
| PD-004 | 图文草稿工作台界面交付滞后 | 高（Phase 0 进行中） |
| PD-005 | 舆情与需求提炼能力延后至 Phase 1 | 中 |

---

## 相关文档

- 项目准则（技术约束权威来源）→ [`../criterion.md`](../criterion.md)
- 架构总结 → [`../architecture/`](../architecture/)（部分待生成）
- 资产清单与生成状态 → [`../context-manifest.json`](../context-manifest.json)

> 是否生成见 `../context-manifest.json` 的 `generated_files.domain` 与 `pending_generation.domain`。
