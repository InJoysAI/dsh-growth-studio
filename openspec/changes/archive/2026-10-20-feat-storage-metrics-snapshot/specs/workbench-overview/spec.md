## MODIFIED Requirements

### Requirement: 覆盖标注与环比 / 本周排期字段契约

`workbench.overview` 的 `overviewMetrics` MUST 提供 `measuredPlatforms` / `unmeasuredPlatforms`（覆盖标注）、`comparison`（环比）与 `weeklyPipeline`（本周排期进度）。

`comparison` MUST 使用权威键名 `period` / `impressionsDeltaPercent` / `playsDeltaPercent` / `engagementsDeltaPercent` / `followersDeltaPercent`，`period` 取值 MUST 为 `'7d' | '30d' | null`；MUST NOT 以 `total*DeltaPercent` 等自造键名或宽泛 `string | null` 替代源契约（`.context/architecture/source/technical_architecture.md` §3.1 `comparison`）。`comparison` 的基准 MUST 取自本地指标历史快照的**上一个等长窗口**（`7d` 对上一个 7 天，`30d` 同理）：历史快照不足以覆盖完整对比窗口时，`comparison.period` MUST 为 `null` 且四个 delta MUST 均为 `null`，MUST NOT 以不完整历史计算近似百分比、MUST NOT 用 `0` 冒充「无变化」（RISK-007）；历史快照足以覆盖完整对比窗口时，`period` MUST 为对应的 `'7d'` / `'30d'` 且四个 delta MUST 按基准计算。

`weeklyPipeline` MUST 提供 `total` / `completed` / `byStatus`，**统计范围为本周（自然周，周一起算）**；`completed` MUST 为 `prefilled + published` 之和；`byStatus` 的键 MUST 覆盖 `ItemStatus` 全部状态。派生来源为既有读取得到的 `calendarItems`（MUST NOT 假设其恒空）；**零结构以筛选后的本周集合为准**：当且仅当筛选后本周集合为空（原始列表为空，**或原始列表非空但全部落在上周 / 下周**）时各计数为 `0`；MUST NOT 以估算值填充，MUST NOT 把跨周 / 历史行计入本周，MUST NOT 把非空的原始列表无条件清空。

#### Scenario: 无历史快照时环比为空

- **GIVEN** 本地不存在可覆盖完整对比窗口的历史指标快照
- **WHEN** 客户端调用 `workbench.overview`
- **THEN** `comparison.period` MUST 为 `null`
- **AND** `impressionsDeltaPercent` / `playsDeltaPercent` / `engagementsDeltaPercent` / `followersDeltaPercent` MUST 均为 `null`（显示语义为「暂无环比」）
- **AND** MUST NOT 编造 `0%` 或近似百分比

#### Scenario: 历史充足时环比给出等长窗口基准 delta

- **GIVEN** 本地历史指标快照足以覆盖完整上一个等长窗口
- **WHEN** 客户端调用 `workbench.overview`
- **THEN** `comparison.period` MUST 为对应的 `'7d'` 或 `'30d'`
- **AND** 四个 delta MUST 按上一个等长窗口基准计算得出

#### Scenario: 本周排期进度按状态分项

- **GIVEN** 既有读取得到的 `calendarItems` 同时包含本周（自然周，周一起算）行与跨周行
- **WHEN** 客户端调用 `workbench.overview`
- **THEN** `weeklyPipeline` MUST 提供 `total` / `completed` / `byStatus`，且**只统计本周行**
- **AND** 完成数 MUST 以 `prefilled` 与 `published` 之和体现
- **AND** `byStatus` MUST 覆盖 `ItemStatus` 全部状态
- **AND** MUST NOT 计入跨周行，MUST NOT 以估算值填充缺失的排期数据

#### Scenario: 筛选后本周集合为空时为零结构

- **GIVEN** 筛选后本周集合为空（原始 `calendarItems` 为空，**或原始列表非空但全部落在上周 / 下周**）
- **WHEN** 客户端调用 `workbench.overview`
- **THEN** `weeklyPipeline.total` / `completed` MUST 为 `0`
- **AND** `byStatus` 各状态计数 MUST 为 `0`
- **AND** MUST NOT 因原始列表非空而返回非零，也 MUST NOT 把上周 / 下周行计入
