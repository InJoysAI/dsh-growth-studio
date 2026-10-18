## ADDED Requirements

### Requirement: 汇总指标在应采平台未全部成功时必须为空

`workbench.overview` MUST 以应采平台集合 `P`（Phase 0 为 `totalChannelsCount` 对应的公众号 + B 站）与成功采集集合 `measuredPlatforms` 做**平台级覆盖门**：仅当 `measuredPlatforms == P` 时才给出汇总数字；`measuredPlatforms ⊂ P` 时所有汇总值 MUST 为 `null`，MUST NOT 只汇总已成功平台后冒充全网总量。响应 MUST 同时填充 `measuredPlatforms` 与 `unmeasuredPlatforms` 以标注覆盖范围（`.context/criterion.md` §4「汇总口径」；架构铁律 3）。本要求对应验收项「部分缺失汇总为空」。

#### Scenario: 部分渠道采集失败时汇总值为空

- **GIVEN** 「全网曝光/播放总量」应采集 2 个渠道
- **AND** 仅 1 个渠道采集成功
- **WHEN** 客户端调用 `workbench.overview`
- **THEN** `overviewMetrics` 的汇总值 MUST 为 `null`（显示语义为「暂无数据」）
- **AND** MUST NOT 只累加已成功渠道后当作全网总量
- **AND** `measuredPlatforms` MUST 仅含成功渠道，`unmeasuredPlatforms` MUST 含失败渠道

#### Scenario: 全部应采渠道成功时给出汇总数字

- **GIVEN** 应采的 2 个渠道全部采集成功
- **WHEN** 客户端调用 `workbench.overview`
- **THEN** 汇总值 MUST 为各渠道相应指标之和
- **AND** `measuredPlatforms` MUST 等于应采平台集合 `P`，`unmeasuredPlatforms` MUST 为空数组

### Requirement: 平台真实零值与采集失败严格区分

汇总与逐平台判定 MUST 把平台真实返回的 `0` 视为**有效值**参与求和，MUST 把「采集失败 / 平台不支持该指标」的 `null` 视为未知；二者 MUST NOT 混同，`null` MUST NOT 被按 `0` 计入（`.context/criterion.md` §4「零值语义」）。本要求对应验收项「真实零值参与求和」。

#### Scenario: 真实零值参与求和

- **GIVEN** 某平台真实返回该指标为 `0`
- **AND** 另一平台该指标采集失败
- **WHEN** 客户端调用 `workbench.overview`
- **THEN** 平台真实返回的 `0` MUST 作为有效值参与求和（不得被丢弃或被当作缺失）
- **AND** 采集失败的平台 MUST 计入 `unmeasuredPlatforms`，其贡献 MUST 视为未知而非 `0`

#### Scenario: 无法获取的指标为 null 而非 0

- **GIVEN** 某指标在所有应采平台均无法获取
- **WHEN** 客户端调用 `workbench.overview`
- **THEN** 该指标的汇总值 MUST 为 `null`
- **AND** MUST NOT 以 `0` 代替

### Requirement: 互动总量在任一子项缺失时必须为空

`overviewMetrics.totalEngagements` MUST 等于点赞、评论、转发、收藏四项汇总之和；当四项汇总中**任一为 `null`** 时，`totalEngagements` MUST 为 `null`；平台级覆盖门未通过时（见上一条要求）四项汇总与 `totalEngagements` MUST 均为 `null`（`.context/architecture/api_strategy.md` §3.1「部分缺失汇总规则」第 5 条；`.context/architecture/constraints.md`「铁律 3 的口径规则」第 5 条）。本要求对应验收项「互动总量口径」。

#### Scenario: 互动子项缺失导致互动总量为空

- **GIVEN** 应采平台已全部采集成功
- **AND** 其中收藏数（`favorites`）汇总为 `null`
- **WHEN** 客户端调用 `workbench.overview`
- **THEN** `totalEngagements` MUST 为 `null`
- **AND** MUST NOT 用其余三项之和对缺失项做近似补齐

#### Scenario: 互动四项齐全时给出互动总量

- **GIVEN** 点赞、评论、转发、收藏四项汇总均非 `null`
- **WHEN** 客户端调用 `workbench.overview`
- **THEN** `totalEngagements` MUST 等于四项之和
- **AND** `totalFavorites` MUST 为该四项中的收藏汇总值

### Requirement: 曝光与播放指标独立可空且不消费兼容字段

业务逻辑（含汇总）MUST 只消费可空的 `impressions`（曝光 / 阅读）与 `plays`（播放）；二者 MUST 独立且可空，无法获取时为 `null`。兼容字段 `views`（`impressions ?? plays ?? 0`）MUST 仅保留向后兼容形状，MUST NOT 被当作缺失指标的真实值（TD-005；`.context/criterion.md` §5.5 `PlatformMetrics`；BR-051）。本要求对应验收项「曝光/播放口径」。

#### Scenario: 视频渠道只贡献播放量

- **GIVEN** 某视频渠道采集成功且仅报告播放量（`plays` 非 `null`、`impressions` 为 `null`）
- **WHEN** 客户端调用 `workbench.overview`
- **THEN** 该渠道 MUST 计入 `totalPlays`
- **AND** MUST NOT 因其 `impressions` 为 `null` 而以 `views` 或 `0` 计入 `totalImpressions`

#### Scenario: 汇总不得读取兼容字段作为真实值

- **GIVEN** 某平台 `impressions` 与 `plays` 均为 `null`（`views` 因兼容表达式为 `0`）
- **WHEN** 汇总判定执行
- **THEN** 该平台的曝光与播放贡献 MUST 视为未知
- **AND** MUST NOT 采用 `views` 的 `0` 作为其曝光或播放值

### Requirement: 总览响应不得包含硬编码或伪造数据

`workbench.overview` 响应 MUST NOT 包含硬编码的样例热点数据（如字面量 `keyword: 'Agentic AI'` / `heatScore: 95`）；真实来源不可得时 `trends` MUST 如实返回空数组，MUST NOT 以编造数据填充（`.context/criterion.md` §3.2）。本要求对应验收项「无伪造数据」。

#### Scenario: 无真实热点来源时返回空

- **GIVEN** 本地无真实热点数据来源
- **WHEN** 客户端调用 `workbench.overview`
- **THEN** `trends` MUST 为空数组
- **AND** 响应中 MUST NOT 出现硬编码的样例 `keyword` / `heatScore`

### Requirement: 覆盖标注与环比 / 本周排期字段契约

`workbench.overview` 的 `overviewMetrics` MUST 提供 `measuredPlatforms` / `unmeasuredPlatforms`（覆盖标注）、`comparison`（环比）与 `weeklyPipeline`（本周排期进度）。

`comparison` MUST 使用权威键名 `period` / `impressionsDeltaPercent` / `playsDeltaPercent` / `engagementsDeltaPercent` / `followersDeltaPercent`，`period` 取值 MUST 为 `'7d' | '30d' | null`；MUST NOT 以 `total*DeltaPercent` 等自造键名或宽泛 `string | null` 替代源契约（`.context/architecture/source/technical_architecture.md` §3.1 `comparison`）。在无历史指标快照时，`comparison.period` MUST 为 `null` 且四个 delta MUST 均为 `null`，MUST NOT 以不完整历史计算近似百分比、MUST NOT 用 `0` 冒充「无变化」（RISK-007）。

`weeklyPipeline` MUST 提供 `total` / `completed` / `byStatus`，**统计范围为本周（自然周，周一起算）**；`completed` MUST 为 `prefilled + published` 之和；`byStatus` 的键 MUST 覆盖 `ItemStatus` 全部状态。派生来源为既有读取得到的 `calendarItems`（MUST NOT 假设其恒空）；**零结构以筛选后的本周集合为准**：当且仅当筛选后本周集合为空（原始列表为空，**或原始列表非空但全部落在上周 / 下周**）时各计数为 `0`；MUST NOT 以估算值填充，MUST NOT 把跨周 / 历史行计入本周，MUST NOT 把非空的原始列表无条件清空。

#### Scenario: 无历史快照时环比为空

- **GIVEN** 本地不存在可覆盖完整对比窗口的历史指标快照
- **WHEN** 客户端调用 `workbench.overview`
- **THEN** `comparison.period` MUST 为 `null`
- **AND** `impressionsDeltaPercent` / `playsDeltaPercent` / `engagementsDeltaPercent` / `followersDeltaPercent` MUST 均为 `null`（显示语义为「暂无环比」）
- **AND** MUST NOT 编造 `0%` 或近似百分比

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

### Requirement: 指标窗口为请求窗口，且不得把非窗口数据标为窗口增量

`PlatformMetrics` MUST 提供必填 `windowStart` / `windowEnd`（ISO 8601），表达由请求参数 `metricsWindow`（默认 `'7d'`）与采集发起时刻推导的**请求窗口**，区别于 `capturedAt` 采集时刻；二者 MUST 独立，MUST NOT 相互代替。请求窗口 MUST 贯穿调用，采集侧 MUST NOT 硬编码 `'7d'`（`.context/architecture/api_strategy.md` §3.1「指标口径」；`.context/architecture/data_architecture.md` 的 `PlatformMetrics`）。

`windowStart` / `windowEnd` MUST NOT 被解读为「数值属于该窗口」的证明：平台数值贡献 MUST 仅在**可证实该数据属于请求窗口**时计入汇总；无法证实的数据 MUST 保持未知（`null` 贡献）并沿用既有说明字段，MUST NOT 把「今日 / 累计」值标成 `7d` / `30d` 冒充窗口增量（`.context/criterion.md` §4 指标真实性）。`live` 与 `unmeasured`（无客户端）两条路径 MUST 均产出非空窗口值且口径一致。

#### Scenario: 请求窗口贯穿且默认 7d

- **GIVEN** 客户端调用 `workbench.overview` 且未传 `metricsWindow`
- **WHEN** 采集执行
- **THEN** 采集 MUST 按默认 `7d` 计算窗口
- **AND** 当请求 `metricsWindow = '30d'` 时，采集与 `windowStart` / `windowEnd` MUST 按 `30d` 计算（MUST NOT 硬编码 `'7d'`）

#### Scenario: 窗口字段与采集时刻相互独立

- **GIVEN** 一次采集在某 `capturedAt` 完成
- **WHEN** 客户端读取 `PlatformMetrics`
- **THEN** `windowStart` / `windowEnd` MUST 表达该指标所属的**请求**统计窗口
- **AND** `windowStart` / `windowEnd` MUST NOT 被 `capturedAt` 代替

#### Scenario: 非请求窗口的数据不得冒充窗口增量

- **GIVEN** 某平台数值只反映「今日」或「累计」口径，无法证实属于请求窗口
- **WHEN** 汇总判定执行
- **THEN** 该平台的该项贡献 MUST 视为未知（`null`）
- **AND** MUST NOT 把该值标成 `7d` / `30d` 的窗口增量
