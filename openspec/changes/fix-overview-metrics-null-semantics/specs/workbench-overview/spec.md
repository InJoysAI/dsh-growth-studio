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

`overviewMetrics.totalEngagements` MUST 等于点赞、评论、转发、收藏四项汇总之和；当四项汇总中**任一为 `null`** 时，`totalEngagements` MUST 为 `null`；平台级覆盖门未通过时（见上一条要求）四项汇总与 `totalEngagements` MUST 均为 `null`（`.context/criterion.md` §4「汇总口径」第 5 项）。本要求对应验收项「互动总量口径」。

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

### Requirement: 覆盖标注与窗口 / 环比 / 本周排期字段契约

`workbench.overview` 的 `overviewMetrics` MUST 提供 `measuredPlatforms` / `unmeasuredPlatforms`（覆盖标注）、`comparison`（环比）与 `weeklyPipeline`（本周排期进度）；`PlatformMetrics` MUST 提供 `windowStart` / `windowEnd`（本指标所属统计窗口，区别于 `capturedAt` 采集时刻）。在无历史指标快照时，`comparison.period` MUST 为 `null` 且各 delta MUST 为 `null`，MUST NOT 以不完整历史计算近似百分比（RISK-007；`.context/architecture/api_strategy.md` §3.1）。

#### Scenario: 无历史快照时环比为空

- **GIVEN** 本地不存在可覆盖完整对比窗口的历史指标快照
- **WHEN** 客户端调用 `workbench.overview`
- **THEN** `comparison.period` MUST 为 `null`
- **AND** 各 `*DeltaPercent` MUST 为 `null`（显示语义为「暂无环比」）
- **AND** MUST NOT 编造 0% 或近似百分比

#### Scenario: 窗口字段与采集时刻相互独立

- **GIVEN** 一次采集在某 `capturedAt` 完成
- **WHEN** 客户端读取 `PlatformMetrics`
- **THEN** `windowStart` / `windowEnd` MUST 表达该指标所属统计窗口
- **AND** `windowStart` / `windowEnd` MUST NOT 被 `capturedAt` 代替

#### Scenario: 本周排期进度按状态分项

- **GIVEN** 本地无排期主数据（Phase 0）
- **WHEN** 客户端调用 `workbench.overview`
- **THEN** `weeklyPipeline` MUST 提供 `total` / `completed` / `byStatus`
- **AND** 完成数 MUST 以 `prefilled` 与 `published` 之和体现
- **AND** MUST NOT 以估算值填充缺失的排期数据
