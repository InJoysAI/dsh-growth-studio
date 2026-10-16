# ADR-005: `ItemStatus` 收敛为五态（移除 `approved` / `archived`）

**状态**: Accepted
**日期**: 2026-10-15（源文档 v1.2.0 裁决）
**决策者**: N/A – 源文档未提供

---

## 上下文 (Context)

`CalendarItem` 的生命周期状态枚举 `ItemStatus` 在早期版本中包含七个值，其中 `approved`（工作台核验）与 `archived`（归档）两态是架构侧自行添加的。

**当前面临什么问题？**

- PRD §5.3.1 只定义了**五个**状态胶囊，与 `ItemStatus` 的七态**不能一一对应**；
- `approved` 与 `archived` **在 PRD 全文中没有定义**：既无触发条件，也无验收口径；
- 实现中这两个状态**从未被赋值** —— 是纯粹的设计冗余；
- 枚举膨胀会导致状态机、UI 展示与测试矩阵无谓复杂化。

---

## 决策驱动因素 (Decision Drivers)

- **PRD ↔ TAD 一致性**：架构状态必须与 PRD 定义严格对应
- **可验证性**：每个状态都需要明确的触发条件与验收口径
- **实现现实**：未被赋值的状态是死代码
- **状态机简洁性**：状态越少，`calendar.updateStatus` 的前向推进校验越清晰

---

## 备选方案 (Considered Options)

### 方案 A: 保留七态，在 PRD 中补定义

**描述**：为 `approved` / `archived` 补充触发条件、保留策略与 UI 展示，再同步回 PRD。

**优点**:
- 保留"人工核验关口"与"归档留存"的显式表达

**缺点**:
- 需要修改 PRD，扩大范围
- **"核验"本质是动作而非状态** —— 强行建模为状态会与发布 URL 回填机制重叠
- 引入额外状态却没有对应的用户可见价值

### 方案 B: 收敛为五态，用技术手段覆盖原意图（**采用**）

**描述**：`ItemStatus` 严格对应 PRD §5.3.1 的五个状态，移除 `approved` / `archived`；其原有意图改由技术机制承担。

**优点**:
- **严格对齐 PRD**，无未授权状态
- 状态机与映射表简洁清晰
- 原意图由**更强的机制**承担（见下）

**缺点**:
- 若未来确需归档，需先走 PRD 变更

### 方案 C: 保留 `archived`，移除 `approved`

**优点**:
- 保留归档能力的显式表达

**缺点**:
- `archived` 同样**无 PRD 依据**、无触发条件与保留策略
- 归档在 Phase 0 范围内没有实际需求（个人开发者场景）

---

## 决策 (Decision)

**我们决定采用**: **方案 B —— 收敛为五态**

```typescript
export type ItemStatus =
  | 'planned'        // 已纳入计划
  | 'drafting'       // 文案/脚本撰写中
  | 'draft_ready'    // 物料准备就绪
  | 'prefilled'      // 已推入平台草稿箱（等待人工发布）
  | 'published'      // 平台人工发布后回填 URL 确认（终态）
```

**原意图的技术替代**：

| 被移除状态 | 原意图 | 替代机制 |
|-----------|--------|---------|
| `approved` | 工作台"人工核验"关口 | **§5.2 的 Human-in-the-Loop 铁律 + 发布 URL 回填守卫** —— **核验是动作，不是状态**（见 ADR-002） |
| `archived` | "归档留存" | **发布后指标采集与 `drafts.delete`** 承担；Phase 0 **不做**独立归档态 |

**核验为什么不是状态？**

> `prefilled` → `published` 之间的"人工核验并发布"是**人工动作**（在平台后台完成），
> 系统**不为此设独立状态**；系统可观测的**唯一信号**是用户回填的发布 URL。

---

## 后果 (Consequences)

### 正面影响

- **PRD ↔ TAD 严格一一对应**，消除未授权状态
- 状态机（见 `../runtime_view.md`）与映射表简洁
- `calendar.updateStatus` 的前向推进校验（`planned` → `drafting` → `draft_ready` → `prefilled` → `published`）规则明确
- 发布真实性集中由 URL 回填守卫保证，避免"双关口"语义重叠

### 负面影响

- 无显式归档能力（Phase 0 无此需求）
- 若未来需要归档，必须先走 PRD 变更再改枚举与状态机

### 风险

| 风险 | 缓解措施 |
|------|---------|
| 历史数据或旧代码仍在写入这两个值 | 已确认**实现中从未被赋值**；若发现历史残留，按五态映射处理 |
| 后续开发者"顺手"重新引入 | criterion §5.5 明确："`approved` / `archived` 已于 2026-10-15 裁决移除，**不得重新引入**" |
| 两套枚举混淆 | 严格经 `../data_architecture.md` 的映射表转换；新增状态须同时更新映射表 |

---

## 合规性 (Compliance)

此决策的执行要求：

- `ItemStatus` **必须**严格为五态，与 PRD §5.3.1 **一一对应**
- ⛔ **禁止**重新引入 `approved` / `archived`
- ⛔ **禁止**引入 `partially_published` 等 PRD 未授权的中间态（渠道进度由 `publishedUrls` 体现）
- 排期状态**必须**只允许**前向**推进，⛔ **禁止**回退
- `published` **不得**经 `calendar.updateStatus` 写入（只能由 URL 回填闭环推进）
- 若未来确需归档，**必须**先在 PRD §5.3 定义触发条件、保留策略与 UI 展示，再同步枚举与状态机

---

## 相关文档

- `../data_architecture.md` §枚举类型、§状态机与映射、§已移除枚举值
- `../runtime_view.md` §场景 4（全渠道不变量状态机）
- `adr_002_prefill_only_human_in_the_loop.md`
- `../risks_and_debt.md` RISK-009
- `../../criterion.md` §5.5
- 源文档 §4.1（裁决记录）、§4.2、§3.3.2
